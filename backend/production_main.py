from __future__ import annotations

"""Production runtime fixes for VeritasAI analysis endpoints.

This wrapper keeps the security/authentication layer from secure_main.py while
providing one canonical trained text classifier for both direct text and URL
content analysis, plus ephemeral trained video inference.
"""

import os
from pathlib import Path
from typing import Any, Dict, List

import secure_main as secure
from fastapi import HTTPException

legacy = secure.legacy

# ---------------------------------------------------------------------------
# Canonical trained text classifier
# ---------------------------------------------------------------------------
# Keep the default model small enough for CPU deployments. The model is a
# genuine fine-tuned fake-news classifier, not a zero-shot classifier.
TEXT_MODEL_ID = os.getenv(
    "TEXT_MODEL_ID",
    "mrm8488/bert-tiny-finetuned-fake-news-detection",
)
_TEXT_MODEL = None


def _load_production_text_model():
    global _TEXT_MODEL

    if _TEXT_MODEL is not None:
        return _TEXT_MODEL

    if secure.pipeline is None:
        raise RuntimeError("transformers is not installed")

    # top_k=None returns both class scores instead of only the winning class.
    _TEXT_MODEL = secure.pipeline(
        "text-classification",
        model=TEXT_MODEL_ID,
        truncation=True,
        max_length=512,
        top_k=None,
    )
    return _TEXT_MODEL


def _text_scores(text: str) -> Dict[str, float]:
    if not text or not text.strip():
        raise ValueError("Text content is empty")

    classifier = _load_production_text_model()
    raw = classifier(text.strip())

    # Transformers can return either [{...}, {...}] or [[{...}, {...}]]
    # depending on the installed pipeline version and batching behaviour.
    if raw and isinstance(raw[0], list):
        raw = raw[0]

    fake = None
    real = None
    for item in raw or []:
        label = str(item.get("label", "")).strip().lower()
        score = float(item.get("score", 0.0))

        if "fake" in label or "false" in label or label in {"label_0", "0"}:
            fake = score
        elif "real" in label or "true" in label or label in {"label_1", "1"}:
            real = score

    # The selected model is a binary fake-news classifier. Some Transformers
    # versions expose generic LABEL_0/LABEL_1 names, so retain the established
    # model mapping as a fallback when semantic labels are unavailable.
    if fake is None and real is None and raw:
        first = raw[0]
        label = str(first.get("label", "")).strip().lower()
        score = float(first.get("score", 0.5))
        if label in {"label_0", "0"}:
            fake = score
            real = 1.0 - score
        elif label in {"label_1", "1"}:
            real = score
            fake = 1.0 - score

    if fake is None and real is not None:
        fake = 1.0 - real
    if real is None and fake is not None:
        real = 1.0 - fake

    if fake is None or real is None:
        raise RuntimeError("Trained text model returned unrecognized classification labels")

    fake = max(0.0, min(1.0, float(fake)))
    real = max(0.0, min(1.0, float(real)))
    total = fake + real
    if total <= 0:
        raise RuntimeError("Trained text model returned invalid classification scores")

    return {"fake_score": fake / total, "real_score": real / total}


def _production_text_classifier():
    """Adapter compatible with the legacy text-analysis helpers."""

    class _Adapter:
        def __call__(self, text: str, **_: Any) -> Dict[str, List[float]]:
            scores = _text_scores(text)
            return {
                "labels": ["fake news", "real news"],
                "scores": [scores["fake_score"], scores["real_score"]],
            }

    return _Adapter()


def _production_content_score(text: str) -> Dict[str, float]:
    """Canonical score function used by BOTH text and URL analysis."""
    return _text_scores(text)


# Replace the legacy zero-shot path and the secure wrapper's older adapter.
# Both /api/analyze/text and /api/analyze/url resolve these functions at
# request time, so they now use exactly the same trained classifier.
legacy._load_text_classifier = _production_text_classifier
legacy._model_content_score = _production_content_score
secure._TEXT_MODEL_ID = TEXT_MODEL_ID
secure._TEXT_MODEL = None


# ---------------------------------------------------------------------------
# Ephemeral trained video analysis
# ---------------------------------------------------------------------------
def _trained_video_probability(frame_bgr: Any) -> float:
    """Run the already-trained image deepfake classifier on one video frame."""
    if secure.pipeline is None:
        raise RuntimeError("transformers is not installed")

    if secure._IMAGE_MODEL is None:
        secure._IMAGE_MODEL = secure.pipeline(
            "image-classification",
            model=secure._IMAGE_MODEL_ID,
        )

    rgb = legacy.cv2.cvtColor(frame_bgr, legacy.cv2.COLOR_BGR2RGB)
    raw = secure._IMAGE_MODEL(rgb)

    if raw and isinstance(raw[0], list):
        raw = raw[0]

    fake = None
    real = None
    for item in raw:
        label = str(item.get("label", "")).lower()
        score = float(item.get("score", 0.5))
        if "fake" in label or "deepfake" in label or label in {"label_1", "1"}:
            fake = score
        elif "real" in label or "authentic" in label or label in {"label_0", "0"}:
            real = score

    if fake is None and real is None:
        raise RuntimeError("Trained image model returned no recognized real/fake labels")

    if fake is None:
        fake = max(0.0, min(1.0, 1.0 - float(real)))
    if real is None:
        real = max(0.0, min(1.0, 1.0 - float(fake)))

    fake, _ = secure._calibrate_binary(float(fake), float(real))
    return max(0.0, min(1.0, fake))


def _analyze_video_payload(payload: bytes, filename: str) -> legacy.AnalysisResponse:
    """Analyze video ephemerally using trained frame-level deepfake inference.

    No video or extracted frames are written outside a TemporaryDirectory.
    """
    suffix = Path(filename or "uploaded-video.mp4").suffix or ".mp4"
    import tempfile

    with tempfile.TemporaryDirectory(prefix="veritas_video_") as temp_dir:
        source_path = Path(temp_dir) / f"input{suffix}"
        frame_dir = Path(temp_dir) / "frames"
        frame_dir.mkdir(parents=True, exist_ok=True)

        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded video file is empty")

        source_path.write_bytes(payload)

        try:
            frame_paths = legacy._extract_video_frames(
                str(source_path),
                str(frame_dir),
            )
        except Exception as exc:
            legacy.logger.exception("Video frame extraction failed: %s", exc)
            raise HTTPException(
                status_code=422,
                detail="Video could not be decoded. Try an MP4/H.264 video.",
            ) from exc

        if not frame_paths:
            raise HTTPException(
                status_code=422,
                detail="No frames could be extracted from this video.",
            )

        sampled_paths = frame_paths[: min(len(frame_paths), 12)]
        fake_scores: List[float] = []

        try:
            for frame_path in sampled_paths:
                frame_bgr = legacy.cv2.imread(frame_path, legacy.cv2.IMREAD_COLOR)
                if frame_bgr is None:
                    continue
                fake_scores.append(_trained_video_probability(frame_bgr))
        except Exception as exc:
            legacy.logger.exception("Trained video inference failed: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Video detection model is unavailable. Please try again shortly.",
            ) from exc

        if not fake_scores:
            raise HTTPException(
                status_code=422,
                detail="No readable frames were available for video analysis.",
            )

        average_fake = sum(fake_scores) / len(fake_scores)
        fake_frame_ratio = sum(score >= 0.5 for score in fake_scores) / len(fake_scores)
        fake_probability = (0.75 * average_fake) + (0.25 * fake_frame_ratio)

    if 0.45 <= fake_probability <= 0.55:
        prediction: legacy.Prediction = "UNCERTAIN"
        confidence = int(round(50 + abs(fake_probability - 0.5) * 120))
        confidence = max(45, min(69, confidence))
    else:
        prediction = "FAKE" if fake_probability > 0.55 else "REAL"
        confidence = int(round(max(fake_probability, 1.0 - fake_probability) * 100))
        confidence = max(55, min(99, confidence))

    deepfake_score = int(round(fake_probability * 100))
    reasons = [
        f"Processed {len(fake_scores)} sampled video frames with ephemeral FFmpeg/OpenCV extraction.",
        "No uploaded video or extracted frame is persisted after analysis.",
        f"Trained image deepfake classifier reused frame-by-frame: {secure._IMAGE_MODEL_ID}.",
        f"Average frame fake probability: {average_fake * 100:.1f}%.",
        f"Frames classified as fake: {fake_frame_ratio * 100:.1f}%.",
        "Frame-level probabilities were aggregated into the final video authenticity score.",
    ]

    return legacy.AnalysisResponse(
        prediction=prediction,
        confidence=confidence,
        reasons=reasons,
        deepfakeScore=deepfake_score,
    )


legacy._analyze_video_payload = _analyze_video_payload

app = secure.app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))

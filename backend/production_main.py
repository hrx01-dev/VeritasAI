from __future__ import annotations

"""Production runtime fixes for VeritasAI analysis endpoints.

Keeps the security/authentication layer from secure_main.py while providing:
- explicit PyTorch text inference (no transformers.pipeline dependency)
- trained image/video inference
- ephemeral video processing
- one canonical text scoring path for direct text and URL analysis
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
TEXT_MODEL_ID = os.getenv(
    "TEXT_MODEL_ID",
    "mrm8488/bert-tiny-finetuned-fake-news-detection",
)
_TEXT_TOKENIZER = None
_TEXT_MODEL = None


def _load_production_text_model():
    """Load the text model explicitly instead of using transformers.pipeline.

    This is deliberately isolated from the image/video dependencies. A failure
    in facenet/torchvision/timm must never turn text analysis into a 503.
    """
    global _TEXT_TOKENIZER, _TEXT_MODEL

    if _TEXT_TOKENIZER is not None and _TEXT_MODEL is not None:
        return _TEXT_TOKENIZER, _TEXT_MODEL

    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except Exception as exc:
        raise RuntimeError("PyTorch/Transformers text runtime is unavailable") from exc

    try:
        tokenizer = AutoTokenizer.from_pretrained(TEXT_MODEL_ID)
        model = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_ID)
        model.eval()
        model.to("cpu")
    except Exception as exc:
        raise RuntimeError(
            f"Unable to load trained text model '{TEXT_MODEL_ID}'"
        ) from exc

    _TEXT_TOKENIZER = tokenizer
    _TEXT_MODEL = model
    return tokenizer, model


def _label_is_fake(label: str) -> bool:
    label = label.strip().lower()
    return any(value in label for value in ("fake", "false", "misinformation", "hoax"))


def _label_is_real(label: str) -> bool:
    label = label.strip().lower()
    return any(value in label for value in ("real", "true", "factual", "reliable"))


def _text_scores(text: str) -> Dict[str, float]:
    if not text or not text.strip():
        raise ValueError("Text content is empty")

    tokenizer, model = _load_production_text_model()
    import torch

    encoded = tokenizer(
        text.strip(),
        return_tensors="pt",
        truncation=True,
        max_length=512,
    )

    with torch.inference_mode():
        logits = model(**encoded).logits
        probabilities = torch.softmax(logits, dim=-1)[0].detach().cpu().tolist()

    id2label = getattr(model.config, "id2label", {}) or {}
    labels = [str(id2label.get(i, f"LABEL_{i}")) for i in range(len(probabilities))]

    fake = 0.0
    real = 0.0
    fake_indices = []
    real_indices = []

    for index, label in enumerate(labels):
        if _label_is_fake(label):
            fake_indices.append(index)
        elif _label_is_real(label):
            real_indices.append(index)

    if fake_indices:
        fake = sum(probabilities[i] for i in fake_indices)
    if real_indices:
        real = sum(probabilities[i] for i in real_indices)

    # Most binary HF fake-news models expose LABEL_0/LABEL_1 rather than
    # semantic labels. mrm8488's model uses LABEL_0=fake and LABEL_1=real.
    if fake == 0.0 and real == 0.0 and len(probabilities) == 2:
        fake, real = probabilities[0], probabilities[1]

    # For an unexpected multi-class model, fall back to the model's strongest
    # class rather than returning an unusable zero score.
    if fake == 0.0 and real == 0.0:
        best = max(range(len(probabilities)), key=probabilities.__getitem__)
        best_label = labels[best].lower()
        if _label_is_fake(best_label):
            fake = probabilities[best]
            real = 1.0 - fake
        elif _label_is_real(best_label):
            real = probabilities[best]
            fake = 1.0 - real
        else:
            fake = probabilities[best]
            real = 1.0 - fake

    total = fake + real
    if total <= 0:
        raise RuntimeError("Trained text model returned invalid probabilities")

    fake /= total
    real /= total
    fake, real = secure._calibrate_binary(fake, real)
    return {"fake_score": fake, "real_score": real}


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


# Patch every text-analysis path to the same explicit PyTorch implementation.
legacy._load_text_classifier = _production_text_classifier
legacy._model_content_score = _production_content_score
secure._load_text_classifier = _production_text_classifier
secure._TEXT_MODEL_ID = TEXT_MODEL_ID
secure._TEXT_MODEL = None


# ---------------------------------------------------------------------------
# Ephemeral trained video analysis
# ---------------------------------------------------------------------------
def _trained_video_probability(frame_bgr: Any) -> float:
    """Run the trained image deepfake classifier on one video frame."""
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

    The upload and extracted frames exist only inside TemporaryDirectory and
    are removed automatically when analysis completes or raises an exception.
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

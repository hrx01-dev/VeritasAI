from __future__ import annotations

"""Production runtime fixes for VeritasAI analysis endpoints.

This wrapper keeps the security/authentication layer from secure_main.py while
replacing the memory-heavy text model and incompatible legacy Xception video
checkpoint with lightweight/reliable trained inference paths.
"""

import os
from pathlib import Path
from typing import Any, List

import secure_main as secure
from fastapi import HTTPException

legacy = secure.legacy

# The previous RoBERTa fake-news model is ~500 MB on disk. That is unnecessarily
# large for the CPU deployment and can starve the same process that serves the
# image/video models. BERT-Tiny is ~18 MB and is still a fine-tuned fake-news
# classifier.
secure._TEXT_MODEL_ID = os.getenv(
    "TEXT_MODEL_ID",
    "mrm8488/bert-tiny-finetuned-fake-news-detection",
)
secure._TEXT_MODEL = None


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
    The known-working trained image detector is reused for sampled frames,
    avoiding the incompatible FaceForensics Xception/timm checkpoint path in
    the legacy implementation.
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

        # Keep CPU inference bounded while still covering the clip.
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


# Legacy route handlers resolve this function through main.py's globals at
# request time, so replacing it here updates both video endpoints.
legacy._analyze_video_payload = _analyze_video_payload

app = secure.app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))

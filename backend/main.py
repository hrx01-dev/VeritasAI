from __future__ import annotations

import logging
import os
import random
import re
import shutil
import subprocess
import threading
import tempfile
import uuid
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

try:
    import requests  # pyright: ignore[reportMissingImports]
except ImportError:
    requests = None

try:
    from bs4 import BeautifulSoup  # pyright: ignore[reportMissingImports]
except ImportError:
    BeautifulSoup = None

try:
    import yt_dlp  # pyright: ignore[reportMissingImports,reportMissingModuleSource]
except ImportError:
    yt_dlp = None

try:
    from transformers import pipeline  # pyright: ignore[reportMissingImports]
except ImportError:
    pipeline = None

try:
    import cv2  # pyright: ignore[reportMissingImports]
except ImportError:
    cv2 = None

try:
    from imageio_ffmpeg import get_ffmpeg_exe  # pyright: ignore[reportMissingImports]
except ImportError:
    get_ffmpeg_exe = None

try:
    import numpy as np  # pyright: ignore[reportMissingImports]
except ImportError:
    np = None

try:
    import torch  # pyright: ignore[reportMissingImports]
    import torch.nn as nn  # pyright: ignore[reportMissingImports]
    from facenet_pytorch import MTCNN  # pyright: ignore[reportMissingImports]
    from PIL import Image  # pyright: ignore[reportMissingImports]
    from torchvision import transforms  # pyright: ignore[reportMissingImports]
    import timm  # pyright: ignore[reportMissingImports]
except ImportError:
    torch = None
    nn = None
    MTCNN = None
    Image = None
    transforms = None
    timm = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth as firebase_auth
except ImportError:
    firebase_admin = None
    credentials = None
    firestore = None
    firebase_auth = None

Prediction = Literal["FAKE", "REAL", "UNCERTAIN"]
AnalysisType = Literal["text", "url", "image", "video"]

logger = logging.getLogger(__name__)

app = FastAPI(title="VeritasAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USERS: Dict[str, Dict[str, str]] = {}
ANALYSIS_HISTORY: List[dict] = []
FIRESTORE_DB = None
TEXT_CLASSIFIER = None
TEXT_CLASSIFIER_LOCK = threading.Lock()
VIDEO_MODEL = None
VIDEO_MODEL_LOCK = threading.Lock()
FACE_DETECTOR = None
FACE_DETECTOR_LOCK = threading.Lock()
VIDEO_DEVICE = "cuda" if torch and torch.cuda.is_available() else "cpu"
TEXT_LABELS = ["fake news", "real news"]
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
VIDEO_FRAME_LIMIT = max(10, min(20, int(os.getenv("VIDEO_FRAME_LIMIT", "20"))))
VIDEO_FRAME_FPS = float(os.getenv("VIDEO_FRAME_FPS", "2.0"))
VIDEO_FACE_LIMIT = int(os.getenv("VIDEO_FACE_LIMIT", "64"))
VIDEO_URL_MAX_BYTES = int(os.getenv("VIDEO_URL_MAX_BYTES", str(250 * 1024 * 1024)))
DEFAULT_XCEPTION_WEIGHTS = Path(__file__).resolve().parent / "models" / "faceforensics_xception.pth"

FAKE_CUE_KEYWORDS = {
    "urgent",
    "shocking",
    "secret",
    "exclusive",
    "they don't want you to know",
    "miracle",
    "guaranteed",
    "unverified",
    "rumor",
}

REAL_CUE_KEYWORDS = {
    "according to",
    "reported by",
    "study",
    "data",
    "source",
    "official",
    "evidence",
    "verified",
    "confirmed",
}

CLICKBAIT_KEYWORDS = {
    "you won't believe",
    "shocking",
    "breaking",
    "must see",
    "gone wrong",
    "secret",
    "what happened next",
    "this trick",
    "guaranteed",
    "exclusive",
    "urgent",
    "miracle",
}

SUSPICIOUS_TLDS = {
    "zip",
    "click",
    "top",
    "xyz",
    "gq",
    "work",
    "party",
    "review",
    "country",
    "stream",
}


if nn is not None:
    class XceptionBinaryClassifier(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.model = timm.create_model("xception", pretrained=False, num_classes=2)

        def forward(self, x: Any) -> Any:
            return self.model(x)
else:
    # Fallback class for when torch is not available
    class XceptionBinaryClassifier:
        def __init__(self) -> None:
            pass


class UserResponse(BaseModel):
    name: str
    email: EmailStr


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)
    remember_me: bool = False


class SignupRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)
    accept_terms: bool


class TextAnalysisRequest(BaseModel):
    text: str = Field(min_length=1)


class UrlAnalysisRequest(BaseModel):
    url: str = Field(min_length=1)


class VideoUrlAnalysisRequest(BaseModel):
    url: str = Field(min_length=1)


class AnalysisResponse(BaseModel):
    prediction: Prediction
    confidence: int
    reasons: List[str]
    manipulationScore: Optional[int] = None
    deepfakeScore: Optional[int] = None
    visualization: Optional[str] = None
    trustScore: Optional[int] = None
    domainQualityScore: Optional[int] = None
    keywordRiskScore: Optional[int] = None
    shortExplanation: Optional[str] = None
    badge: Optional[Literal["SAFE", "NOT_SAFE"]] = None


class HistoryItem(BaseModel):
    id: str
    type: AnalysisType
    content: str
    result: Prediction
    confidence: int
    timestamp: str
    reasons: List[str] = Field(default_factory=list)
    manipulationScore: Optional[int] = None
    deepfakeScore: Optional[int] = None
    trustScore: Optional[int] = None
    domainQualityScore: Optional[int] = None
    keywordRiskScore: Optional[int] = None
    shortExplanation: Optional[str] = None
    badge: Optional[Literal["SAFE", "NOT_SAFE"]] = None
    visualization: Optional[str] = None


class VideoReadinessResponse(BaseModel):
    ready: bool
    ffmpegAvailable: bool
    fallbackFfmpegAvailable: bool
    weightsConfigured: bool
    weightsPath: Optional[str] = None
    missing: List[str]


def _init_firestore() -> None:
    global FIRESTORE_DB

    if firebase_admin is None or firestore is None:
        logger.warning("firebase-admin is not installed. Falling back to in-memory storage.")
        return

    try:
        if not firebase_admin._apps:
            service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            if service_account_path:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
            else:
                # Uses GOOGLE_APPLICATION_CREDENTIALS or default application credentials.
                firebase_admin.initialize_app()

        FIRESTORE_DB = firestore.client()
        logger.info("Firestore initialized for backend persistence.")
    except Exception as exc:
        FIRESTORE_DB = None
        logger.warning("Unable to initialize Firestore (%s). Using in-memory storage.", exc)


def _get_user_record(email_key: str) -> Optional[Dict[str, Any]]:
    if FIRESTORE_DB is not None:
        snapshot = FIRESTORE_DB.collection("users").document(email_key).get()
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            return {
                "name": data.get("name", ""),
                "email": data.get("email", ""),
                "password": data.get("password", ""),
            }

    return USERS.get(email_key)


def _save_user_record(email_key: str, user: Dict[str, str]) -> None:
    USERS[email_key] = user

    if FIRESTORE_DB is None or firestore is None:
        return

    FIRESTORE_DB.collection("users").document(email_key).set(
        {
            **user,
            "emailKey": email_key,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_user_email(user_email: Optional[str]) -> Optional[str]:
    if not user_email:
        return None

    normalized = user_email.strip().lower()
    return normalized or None


def _prediction_seed(seed_text: str) -> bool:
    # Make pseudo-random results deterministic for repeated identical inputs.
    return hash(seed_text) % 2 == 0


def _base_result(seed: str, fake_reasons: List[str], real_reasons: List[str]) -> AnalysisResponse:
    is_fake = _prediction_seed(seed)
    confidence = random.randint(70, 96)
    return AnalysisResponse(
        prediction="FAKE" if is_fake else "REAL",
        confidence=confidence,
        reasons=fake_reasons if is_fake else real_reasons,
    )


def _load_text_classifier():
    global TEXT_CLASSIFIER

    if pipeline is None:
        raise RuntimeError("transformers is not installed")

    if TEXT_CLASSIFIER is not None:
        return TEXT_CLASSIFIER

    with TEXT_CLASSIFIER_LOCK:
        if TEXT_CLASSIFIER is not None:
            return TEXT_CLASSIFIER

        logger.info("Loading Hugging Face text classifier for fake/real detection...")
        TEXT_CLASSIFIER = pipeline(
            "zero-shot-classification",
            model="typeform/distilbert-base-uncased-mnli",
        )
        logger.info("Text classifier loaded successfully.")

    return TEXT_CLASSIFIER


def _extract_key_points(text: str, max_points: int = 3) -> List[str]:
    normalized = " ".join(text.split())
    if not normalized:
        return []

    sentences = [segment.strip() for segment in SENTENCE_SPLIT_RE.split(normalized) if segment.strip()]
    if not sentences:
        sentences = [normalized]

    ranked = sorted(sentences, key=len, reverse=True)
    points: List[str] = []
    for sentence in ranked:
        shortened = sentence[:160].strip()
        if shortened and shortened not in points:
            points.append(shortened)
        if len(points) >= max_points:
            break

    return points


def _detect_cues(text: str, cue_set: set[str], max_matches: int = 3) -> List[str]:
    lower = text.lower()
    matches = [cue for cue in cue_set if cue in lower]
    return matches[:max_matches]


def _build_text_reasons(prediction: Prediction, confidence: int, text: str) -> List[str]:
    key_points = _extract_key_points(text)
    fake_cues = _detect_cues(text, FAKE_CUE_KEYWORDS)
    real_cues = _detect_cues(text, REAL_CUE_KEYWORDS)

    if prediction == "FAKE":
        reasons = [
            f"Model confidence for FAKE pattern is {confidence}% based on zero-shot BERT-style inference.",
            "Sensational or unverified framing appears stronger than evidence-backed framing.",
        ]
        if fake_cues:
            reasons.append(f"Potential misinformation cues detected: {', '.join(fake_cues)}.")
        if key_points:
            reasons.append(f"Key point flagged: {key_points[0]}")
        return reasons[:4]

    if prediction == "UNCERTAIN":
        reasons = [
            f"Model confidence is mixed at {confidence}%, with FAKE and REAL cues close to each other.",
            "The text includes both credibility markers and potentially manipulative framing.",
        ]
        if fake_cues and real_cues:
            reasons.append(
                f"Conflicting cues detected: misinformation-like ({', '.join(fake_cues)}) and credibility-like ({', '.join(real_cues)})."
            )
        elif fake_cues:
            reasons.append(f"Potential misinformation cues detected: {', '.join(fake_cues)}.")
        elif real_cues:
            reasons.append(f"Credibility cues detected: {', '.join(real_cues)}.")
        if key_points:
            reasons.append(f"Key point requiring manual review: {key_points[0]}")
        return reasons[:4]

    reasons = [
        f"Model confidence for REAL pattern is {confidence}% based on zero-shot BERT-style inference.",
        "The content structure is more consistent with factual and evidence-aligned reporting.",
    ]
    if real_cues:
        reasons.append(f"Credibility cues detected: {', '.join(real_cues)}.")
    if key_points:
        reasons.append(f"Key point extracted: {key_points[0]}")
    return reasons[:4]


def _require_video_dependencies() -> None:
    missing: List[str] = []
    if cv2 is None:
        missing.append("opencv-python")
    if np is None:
        missing.append("numpy")
    if torch is None or nn is None:
        missing.append("torch")
    if timm is None:
        missing.append("timm")
    if MTCNN is None:
        missing.append("facenet-pytorch")
    if Image is None:
        missing.append("Pillow")
    if transforms is None:
        missing.append("torchvision")

    if missing:
        raise RuntimeError(f"Missing video dependencies: {', '.join(missing)}")


def _load_face_detector() -> Any:
    global FACE_DETECTOR

    _require_video_dependencies()

    if FACE_DETECTOR is not None:
        return FACE_DETECTOR

    with FACE_DETECTOR_LOCK:
        if FACE_DETECTOR is not None:
            return FACE_DETECTOR

        FACE_DETECTOR = MTCNN(keep_all=True, device=VIDEO_DEVICE)
        return FACE_DETECTOR


def _load_video_model() -> tuple[Any, Any]:
    global VIDEO_MODEL

    _require_video_dependencies()

    if VIDEO_MODEL is not None:
        return VIDEO_MODEL

    checkpoint_path = _resolve_xception_weights_path()

    if not checkpoint_path:
        raise RuntimeError(
            "XCEPTION_WEIGHTS_PATH is not set. Provide Xception weights trained on FaceForensics++ "
            "or place weights at backend/models/faceforensics_xception.pth."
        )

    checkpoint_file = Path(checkpoint_path)
    if not checkpoint_file.exists():
        raise RuntimeError(f"XCEPTION_WEIGHTS_PATH not found: {checkpoint_file}")

    with VIDEO_MODEL_LOCK:
        if VIDEO_MODEL is not None:
            return VIDEO_MODEL

        model = XceptionBinaryClassifier().to(VIDEO_DEVICE)
        checkpoint = torch.load(checkpoint_file, map_location=VIDEO_DEVICE)

        if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
            state_dict = checkpoint["state_dict"]
        else:
            state_dict = checkpoint

        base_cleaned = {
            key.replace("module.", "", 1) if key.startswith("module.") else key: value
            for key, value in state_dict.items()
        }

        candidate_dicts: List[Dict[str, Any]] = [base_cleaned]
        candidate_dicts.append(
            {
                key.replace("model.", "", 1) if key.startswith("model.") else key: value
                for key, value in base_cleaned.items()
            }
        )
        candidate_dicts.append(
            {
                key.replace("model.model.", "", 1) if key.startswith("model.model.") else key: value
                for key, value in base_cleaned.items()
            }
        )
        candidate_dicts.append(
            {
                key if key.startswith("model.") else f"model.{key}": value
                for key, value in base_cleaned.items()
            }
        )

        best_candidate: Optional[Dict[str, Any]] = None
        best_match_count = -1
        model_keys = set(model.state_dict().keys())

        for candidate in candidate_dicts:
            matched = sum(1 for key in candidate.keys() if key in model_keys)
            if matched > best_match_count:
                best_match_count = matched
                best_candidate = candidate

        if best_candidate is None:
            raise RuntimeError("Unable to parse checkpoint state dict for Xception model")

        load_result = model.load_state_dict(best_candidate, strict=False)
        total_model_keys = max(len(model_keys), 1)
        coverage = (best_match_count / total_model_keys) * 100.0

        if coverage < 70.0:
            raise RuntimeError(
                f"Xception checkpoint mismatch: only {coverage:.1f}% keys matched model architecture"
            )

        logger.info(
            "Loaded video checkpoint with %.1f%% key coverage (%s missing, %s unexpected)",
            coverage,
            len(load_result.missing_keys),
            len(load_result.unexpected_keys),
        )

        model.eval()

        preprocess = transforms.Compose(
            [
                transforms.Resize((299, 299)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
            ]
        )
        VIDEO_MODEL = (model, preprocess)

    return VIDEO_MODEL


def _extract_frames_ffmpeg(video_path: str, output_dir: str) -> List[str]:
    ffmpeg_binary = shutil.which("ffmpeg")
    if ffmpeg_binary is None and get_ffmpeg_exe is not None:
        try:
            ffmpeg_binary = get_ffmpeg_exe()
        except Exception:
            ffmpeg_binary = None

    if ffmpeg_binary is None:
        raise RuntimeError("ffmpeg binary not found in PATH and imageio-ffmpeg fallback is unavailable")

    frame_pattern = str(Path(output_dir) / "frame_%05d.jpg")
    command = [
        ffmpeg_binary,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        video_path,
        "-vf",
        f"fps={VIDEO_FRAME_FPS}",
        "-frames:v",
        str(VIDEO_FRAME_LIMIT),
        frame_pattern,
    ]

    subprocess.run(command, check=True)
    return sorted(str(path) for path in Path(output_dir).glob("frame_*.jpg"))


def _resolve_xception_weights_path() -> Optional[str]:
    configured = os.getenv("XCEPTION_WEIGHTS_PATH")
    if configured:
        return configured

    if DEFAULT_XCEPTION_WEIGHTS.exists():
        return str(DEFAULT_XCEPTION_WEIGHTS)

    return None


def _video_readiness() -> VideoReadinessResponse:
    ffmpeg_on_path = shutil.which("ffmpeg") is not None
    ffmpeg_fallback = False
    if get_ffmpeg_exe is not None:
        try:
            ffmpeg_fallback = bool(get_ffmpeg_exe())
        except Exception:
            ffmpeg_fallback = False

    weights_path = _resolve_xception_weights_path()
    weights_configured = bool(weights_path and Path(weights_path).exists())

    missing: List[str] = []
    if cv2 is None:
        missing.append("opencv-python")
    if np is None:
        missing.append("numpy")
    if torch is None or nn is None:
        missing.append("torch")
    if timm is None:
        missing.append("timm")
    if MTCNN is None:
        missing.append("facenet-pytorch")
    if Image is None:
        missing.append("Pillow")
    if transforms is None:
        missing.append("torchvision")
    if not ffmpeg_on_path and not ffmpeg_fallback:
        missing.append("ffmpeg")
    if not weights_configured:
        missing.append("xception-faceforensics-weights")

    return VideoReadinessResponse(
        ready=len(missing) == 0,
        ffmpegAvailable=ffmpeg_on_path,
        fallbackFfmpegAvailable=ffmpeg_fallback,
        weightsConfigured=weights_configured,
        weightsPath=weights_path,
        missing=missing,
    )


def _extract_frames_opencv(video_path: str, output_dir: str) -> List[str]:
    _require_video_dependencies()

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise RuntimeError("Unable to open video for frame extraction")

    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, int(round(fps / max(VIDEO_FRAME_FPS, 0.1))))

    frame_paths: List[str] = []
    index = 0
    saved = 0
    try:
        while saved < VIDEO_FRAME_LIMIT:
            ok, frame = capture.read()
            if not ok:
                break

            if index % step == 0:
                frame_path = Path(output_dir) / f"frame_{saved:05d}.jpg"
                cv2.imwrite(str(frame_path), frame)
                frame_paths.append(str(frame_path))
                saved += 1
            index += 1
    finally:
        capture.release()

    return frame_paths


def _extract_video_frames(video_path: str, output_dir: str) -> List[str]:
    try:
        frames = _extract_frames_ffmpeg(video_path, output_dir)
        if frames:
            return frames
        logger.warning("FFmpeg extraction produced no frames; falling back to OpenCV.")
    except Exception as exc:
        logger.warning("FFmpeg extraction failed (%s); falling back to OpenCV.", exc)

    return _extract_frames_opencv(video_path, output_dir)


def _extract_face_crops(frame_paths: List[str]) -> List[Any]:
    detector = _load_face_detector()
    faces: List[Any] = []

    for frame_path in frame_paths:
        if len(faces) >= VIDEO_FACE_LIMIT:
            break

        frame_bgr = cv2.imread(frame_path)
        if frame_bgr is None:
            continue

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        boxes, probs = detector.detect(frame_rgb)
        if boxes is None or probs is None:
            continue

        height, width = frame_rgb.shape[:2]
        pil_frame = Image.fromarray(frame_rgb)

        for box, prob in zip(boxes, probs):
            if prob is None or float(prob) < 0.90:
                continue

            x1, y1, x2, y2 = [int(v) for v in box]
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(0, min(x2, width))
            y2 = max(0, min(y2, height))
            if x2 <= x1 or y2 <= y1:
                continue

            face = pil_frame.crop((x1, y1, x2, y2))
            faces.append(face)

            if len(faces) >= VIDEO_FACE_LIMIT:
                break

    return faces


def _score_deepfake_faces(face_images: List[Any]) -> float:
    model, preprocess = _load_video_model()

    tensors = [preprocess(face).unsqueeze(0) for face in face_images]
    batch = torch.cat(tensors, dim=0).to(VIDEO_DEVICE)

    with torch.no_grad():
        logits = model(batch)
        probabilities = torch.softmax(logits, dim=1)
        fake_probs = probabilities[:, 1].detach().cpu().numpy().tolist()

    if not fake_probs:
        raise RuntimeError("Model produced empty predictions")

    average_fake = float(sum(fake_probs) / len(fake_probs))
    spread = max(fake_probs) - min(fake_probs)

    # Guard against degenerate near-constant outputs from misconfigured checkpoints.
    if len(fake_probs) >= 8 and spread < 0.02 and abs(average_fake - 0.5) < 0.05:
        raise RuntimeError("Video model produced degenerate probabilities near 0.5")

    return average_fake


def _build_video_reasons(fake_probability: float, frame_count: int, face_count: int) -> List[str]:
    fake_percent = int(round(fake_probability * 100))
    if 45 <= fake_percent <= 55:
        verdict_line = "Deepfake likelihood sits in a borderline range and should be manually reviewed."
    elif fake_percent > 55:
        verdict_line = "Model cues lean toward manipulated/deepfake content."
    else:
        verdict_line = "Model cues lean toward authentic content."

    return [
        f"Processed {frame_count} frames using FFmpeg/OpenCV extraction pipeline.",
        f"Detected and analyzed {face_count} face crops with MTCNN.",
        f"Xception model (FaceForensics++ checkpoint) estimated deepfake probability at {fake_percent}%.",
        verdict_line,
        "Frame-level face predictions were aggregated into a final video authenticity score.",
    ]


def _require_image_dependencies() -> None:
    missing: List[str] = []
    if cv2 is None:
        missing.append("opencv-python")
    if np is None:
        missing.append("numpy")

    if missing:
        raise RuntimeError(f"Missing image dependencies: {', '.join(missing)}")


def _compute_ela_map(image_bgr: Any, quality: int = 90) -> Any:
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), int(max(10, min(quality, 100)))]
    ok, compressed = cv2.imencode(".jpg", image_bgr, encode_params)
    if not ok:
        raise RuntimeError("Failed to generate JPEG recompression for ELA")

    recompressed = cv2.imdecode(compressed, cv2.IMREAD_COLOR)
    if recompressed is None:
        raise RuntimeError("Failed to decode recompressed image for ELA")

    ela_diff = cv2.absdiff(image_bgr, recompressed)
    ela_gray = cv2.cvtColor(ela_diff, cv2.COLOR_BGR2GRAY)
    return cv2.normalize(ela_gray, None, 0, 255, cv2.NORM_MINMAX)


def _compute_edge_map(image_bgr: Any) -> Any:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 80, 180)
    return cv2.GaussianBlur(edges, (3, 3), 0)


def _build_image_visualization(image_bgr: Any, anomaly_map: Any) -> str:
    heatmap = cv2.applyColorMap(anomaly_map, cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(image_bgr, 0.68, heatmap, 0.32, 0)

    high_mask = cv2.threshold(anomaly_map, 210, 255, cv2.THRESH_BINARY)[1]
    contours, _ = cv2.findContours(high_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        if cv2.contourArea(contour) < 120:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (40, 40, 255), 2)

    ok, png = cv2.imencode(".png", overlay)
    if not ok:
        raise RuntimeError("Failed to encode ELA/edge visualization")

    encoded = base64.b64encode(png.tobytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _analyze_image_integrity(image_bgr: Any) -> Dict[str, Any]:
    ela_map = _compute_ela_map(image_bgr)
    edge_map = _compute_edge_map(image_bgr)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    combined = cv2.addWeighted(ela_map, 0.7, edge_map, 0.3, 0)
    combined_norm = cv2.normalize(combined, None, 0, 255, cv2.NORM_MINMAX).astype("uint8")

    ela_mean = float(np.mean(ela_map))
    ela_peak = float(np.percentile(ela_map, 95))
    edge_density = float(np.mean(edge_map > 0) * 100.0)

    ela_mean_score = float(np.clip((ela_mean - 8.0) / 32.0, 0.0, 1.0) * 100.0)
    ela_peak_score = float(np.clip((ela_peak - 26.0) / 90.0, 0.0, 1.0) * 100.0)
    edge_anomaly_score = float(np.clip(abs(edge_density - 11.0) / 11.0, 0.0, 1.0) * 100.0)

    # Cue 1: overly smooth skin texture (low high-frequency detail in skin-like regions).
    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    skin_mask = cv2.inRange(ycrcb, (0, 133, 77), (255, 173, 127))
    lap_map = cv2.Laplacian(gray, cv2.CV_64F)
    skin_pixels = int(np.count_nonzero(skin_mask))
    if skin_pixels > 500:
        skin_lap_var = float(np.var(lap_map[skin_mask > 0]))
    else:
        skin_lap_var = float(np.var(lap_map))
    # Original formula: higher smoothness = higher score (max 100)
    smooth_skin_score = float(np.clip((42.0 - skin_lap_var) / 42.0, 0.0, 1.0) * 100.0)

    # Cue 2: unnatural symmetry (very low difference between mirrored halves).
    height, width = gray.shape[:2]
    half_width = width // 2
    if half_width > 20:
        left_half = gray[:, :half_width]
        right_half = gray[:, width - half_width :]
        mirrored_right = cv2.flip(right_half, 1)
        symmetry_diff = float(np.mean(cv2.absdiff(left_half, mirrored_right)))
    else:
        symmetry_diff = 32.0
    # Original formula: higher symmetry = higher score
    symmetry_score = float(np.clip((22.0 - symmetry_diff) / 22.0, 0.0, 1.0) * 100.0)

    # Cue 3: lack of sensor/noise residuals.
    denoised = cv2.GaussianBlur(gray, (5, 5), 0)
    noise_residual = cv2.absdiff(gray, denoised)
    residual_energy = float(np.mean(noise_residual))
    # Original formula: lower noise = higher score (synthetic)
    low_noise_score = float(np.clip((16.0 - residual_energy) / 16.0, 0.0, 1.0) * 100.0)

    # Unified tamper signal for photoshopped/deepfake-like traits.
    # This avoids over-relying on any single cue and makes REAL verdicts stricter.
    moderate_threshold = 55
    high_threshold = 70

    moderate_smoothness = smooth_skin_score >= moderate_threshold
    moderate_symmetry = symmetry_score >= moderate_threshold
    moderate_low_noise = low_noise_score >= moderate_threshold

    very_high_smoothness = smooth_skin_score >= high_threshold
    very_high_symmetry = symmetry_score >= high_threshold
    very_high_low_noise = low_noise_score >= high_threshold

    moderate_count = sum([moderate_smoothness, moderate_symmetry, moderate_low_noise])
    high_count = sum([very_high_smoothness, very_high_symmetry, very_high_low_noise])

    ela_edge_score = (0.40 * ela_mean_score) + (0.25 * ela_peak_score) + (0.15 * edge_anomaly_score)
    forensic_avg = (smooth_skin_score + symmetry_score + low_noise_score) / 3.0

    ela_hotspot_ratio = float(np.mean(ela_map > np.percentile(ela_map, 90)) * 100.0)
    ela_hotspot_score = float(np.clip((ela_hotspot_ratio - 8.0) / 22.0, 0.0, 1.0) * 100.0)

    tamper_signal = float(
        (0.30 * ela_peak_score)
        + (0.20 * ela_mean_score)
        + (0.15 * edge_anomaly_score)
        + (0.15 * smooth_skin_score)
        + (0.10 * symmetry_score)
        + (0.10 * low_noise_score)
        + (0.10 * ela_hotspot_score)
    )

    fake_evidence = (
        (tamper_signal >= 62)
        or (high_count >= 2)
        or (moderate_count >= 2 and ela_peak_score >= 56)
        or (ela_peak_score >= 72 and moderate_count >= 1)
    )
    real_evidence = (
        (tamper_signal <= 34)
        and (moderate_count == 0)
        and (ela_peak_score < 52)
        and (ela_hotspot_score < 42)
    )

    if fake_evidence:
        prediction: Prediction = "FAKE"
        manipulation_score = int(round(max(tamper_signal, 62.0)))
        manipulation_score = max(62, min(99, manipulation_score))
    elif real_evidence:
        prediction = "REAL"
        manipulation_score = int(round(min(tamper_signal, 34.0)))
        manipulation_score = max(1, min(34, manipulation_score))
    else:
        prediction = "UNCERTAIN"
        manipulation_score = int(round(min(59.0, max(43.0, tamper_signal))))
        manipulation_score = max(43, min(59, manipulation_score))

    # DEBUG: Log scores for tuning and field validation.
    logger.info(
        "[IMG_DEBUG] smooth=%.0f sym=%.0f noise=%.0f ela=%.0f peak=%.0f hotspot=%.0f | moderate=%d high=%d tamper=%.0f => %s (%d)",
        smooth_skin_score,
        symmetry_score,
        low_noise_score,
        ela_edge_score,
        ela_peak_score,
        ela_hotspot_score,
        moderate_count,
        high_count,
        tamper_signal,
        prediction,
        manipulation_score,
    )

    # Confidence is prediction-specific to avoid inflated "REAL 99%" from weak evidence.
    if prediction == "FAKE":
        fake_signal = max(tamper_signal, (high_count * 24) + (moderate_count * 10))
        confidence = int(round(58 + (fake_signal * 0.34)))
        confidence = max(58, min(94, confidence))
    elif prediction == "REAL":
        clean_signal = max(0.0, 100.0 - tamper_signal)
        confidence = int(round(50 + (clean_signal * 0.22)))
        confidence = max(50, min(82, confidence))
    else:
        uncertainty_signal = abs(50 - manipulation_score)
        confidence = int(round(50 + (uncertainty_signal * 0.35)))
        confidence = max(45, min(69, confidence))

    reasons = [
        f"Forensic analysis combines texture, symmetry, noise, and ELA support (ELA baseline {ela_edge_score:.0f}%).",
        (
            f"Skin texture cue: {'suspected overly smooth skin patterns' if very_high_smoothness else 'texture variations appear normal'} "
            f"(score {smooth_skin_score:.0f}/100)."
        ),
        (
            f"Symmetry cue: {'suspected unnatural left-right symmetry' if very_high_symmetry else 'natural asymmetry present'} "
            f"(score {symmetry_score:.0f}/100)."
        ),
        (
            f"Noise cue: {'suspected lack of sensor-like noise residuals' if very_high_low_noise else 'natural noise present'} "
            f"(score {low_noise_score:.0f}/100)."
        ),
        f"ELA analysis: mean={ela_mean:.1f}/255 peak={ela_peak:.1f}/255 edge_density={edge_density:.1f}%.",
        f"Forensic cue summary: moderate={moderate_count}, high={high_count}, tamper={tamper_signal:.0f}/100. Final manipulation score: {manipulation_score}/100.",
    ]

    visualization = _build_image_visualization(image_bgr, combined_norm)
    return {
        "prediction": prediction,
        "confidence": confidence,
        "manipulationScore": manipulation_score,
        "reasons": reasons,
        "visualization": visualization,
    }


def _require_url_dependencies() -> None:
    missing: List[str] = []
    if requests is None:
        missing.append("requests")
    if BeautifulSoup is None:
        missing.append("beautifulsoup4")

    if missing:
        raise RuntimeError(f"Missing URL dependencies: {', '.join(missing)}")


def _normalize_url(raw_url: str) -> str:
    candidate = raw_url.strip()
    if not candidate:
        raise HTTPException(status_code=400, detail="URL is required")

    if not re.match(r"^https?://", candidate, re.IGNORECASE):
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    return candidate


def _extract_visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()

    body = soup.body or soup
    text = body.get_text(" ", strip=True)
    normalized = " ".join(text.split())
    return normalized[:12000]


def _fetch_page_content(url: str) -> Dict[str, Any]:
    response = requests.get(
        url,
        timeout=10,
        allow_redirects=True,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
            )
        },
    )
    response.raise_for_status()

    text = _extract_visible_text(response.text)
    if len(text) < 120:
        raise HTTPException(
            status_code=422,
            detail="Not enough readable text was found on this URL for reliable analysis.",
        )

    return {
        "final_url": response.url,
        "status_code": response.status_code,
        "text": text,
    }


def _get_domain_age_days(domain: str) -> Optional[int]:
    rdap_url = f"https://rdap.org/domain/{domain}"
    try:
        response = requests.get(rdap_url, timeout=8)
        if response.status_code >= 400:
            return None

        payload = response.json()
        for event in payload.get("events", []):
            action = str(event.get("eventAction", "")).lower()
            if action not in {"registration", "registered", "creation"}:
                continue

            event_date = event.get("eventDate")
            if not event_date:
                continue

            normalized = str(event_date).replace("Z", "+00:00")
            created_at = datetime.fromisoformat(normalized)
            now = datetime.now(timezone.utc)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            age_days = (now - created_at).days
            return max(0, age_days)
    except Exception:
        return None

    return None


def _score_domain_quality(domain: str, is_https: bool, age_days: Optional[int]) -> Dict[str, Any]:
    score = 100
    penalties: List[str] = []
    labels: List[str] = []

    if not is_https:
        score -= 20
        penalties.append("No HTTPS")

    domain_lower = domain.lower()
    parts = domain_lower.split(".")
    tld = parts[-1] if parts else ""
    second_level = parts[-2] if len(parts) > 1 else domain_lower

    if tld in SUSPICIOUS_TLDS:
        score -= 18
        penalties.append(f"Risky TLD .{tld}")

    hyphen_count = second_level.count("-")
    if hyphen_count >= 2:
        score -= 10
        penalties.append("Excessive hyphens")

    digits = sum(char.isdigit() for char in second_level)
    digit_ratio = digits / max(len(second_level), 1)
    if digit_ratio > 0.2:
        score -= 12
        penalties.append("High digit density in domain")

    if len(domain_lower) > 35:
        score -= 8
        penalties.append("Unusually long domain")

    subdomain_count = max(len(parts) - 2, 0)
    if subdomain_count >= 3:
        score -= 8
        penalties.append("Many nested subdomains")

    if "xn--" in domain_lower:
        score -= 15
        penalties.append("Punycode domain")

    if age_days is None:
        score -= 5
        labels.append("Domain age unavailable")
    elif age_days < 180:
        score -= 25
        penalties.append("Very new domain")
    elif age_days < 365:
        score -= 16
        penalties.append("Recently registered domain")
    elif age_days > 365 * 5:
        score += 8
        labels.append("Mature domain")
    elif age_days > 365 * 2:
        score += 4
        labels.append("Established domain")

    score = max(1, min(99, score))
    return {
        "score": score,
        "penalties": penalties,
        "labels": labels,
    }


def _clickbait_matches(text: str) -> List[str]:
    lower = text.lower()
    matches = [keyword for keyword in CLICKBAIT_KEYWORDS if keyword in lower]
    return matches[:6]


def _model_content_score(text: str) -> Dict[str, Any]:
    classifier = _load_text_classifier()
    model_output = classifier(
        text,
        candidate_labels=TEXT_LABELS,
        hypothesis_template="This article is {}.",
    )

    labels = model_output.get("labels", [])
    scores = model_output.get("scores", [])
    score_map = {label: float(score) for label, score in zip(labels, scores)}
    fake_score = score_map.get("fake news", 0.0)
    real_score = score_map.get("real news", 0.0)

    return {
        "fake_score": fake_score,
        "real_score": real_score,
    }


def _short_url_explanation(prediction: Prediction, trust_score: int, clickbait_count: int, domain_quality: int) -> str:
    if prediction == "REAL":
        return (
            f"Marked as SAFE with trust score {trust_score}/100 because domain quality is {domain_quality}/100 "
            f"and clickbait signals are {'low' if clickbait_count <= 1 else 'moderate'}."
        )

    if prediction == "UNCERTAIN":
        return (
            f"Marked as UNCERTAIN with trust score {trust_score}/100 because reliability signals are mixed "
            f"(domain quality {domain_quality}/100 and clickbait risk {'elevated' if clickbait_count > 2 else 'moderate'})."
        )

    return (
        f"Marked as NOT SAFE with trust score {trust_score}/100 due to weaker domain quality "
        f"({domain_quality}/100) and elevated clickbait/content risk."
    )


def _is_youtube_host(hostname: str) -> bool:
    host = hostname.lower()
    return (
        host.endswith("youtube.com")
        or host.endswith("youtu.be")
        or host.endswith("youtube-nocookie.com")
    )


def _download_video_from_youtube(url: str) -> tuple[str, bytes]:
    if yt_dlp is None:
        raise RuntimeError("yt-dlp is not installed")

    with tempfile.TemporaryDirectory(prefix="veritas_yt_") as temp_dir:
        output_template = str(Path(temp_dir) / "%(id)s.%(ext)s")

        ydl_opts = {
            "format": "best[ext=mp4][acodec!=none][vcodec!=none]/best[ext=mp4]/best",
            "outtmpl": output_template,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "retries": 2,
            "socket_timeout": 20,
            "merge_output_format": "mp4",
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise RuntimeError("Could not extract YouTube video metadata")

            if "entries" in info and info["entries"]:
                info = info["entries"][0]

            downloaded_path = Path(ydl.prepare_filename(info))
            if not downloaded_path.exists():
                matches = sorted(Path(temp_dir).glob("*"), key=lambda p: p.stat().st_size, reverse=True)
                if not matches:
                    raise RuntimeError("Unable to locate downloaded YouTube video")
                downloaded_path = matches[0]

        payload = downloaded_path.read_bytes()
        if len(payload) > VIDEO_URL_MAX_BYTES:
            max_mb = VIDEO_URL_MAX_BYTES / (1024 * 1024)
            raise HTTPException(status_code=413, detail=f"Video is too large. Maximum supported size is {max_mb:.0f} MB")

        filename = downloaded_path.name or "youtube-video.mp4"
        return filename, payload


def _download_video_from_url(url: str) -> tuple[str, bytes]:
    _require_url_dependencies()
    normalized_url = _normalize_url(url)

    parsed = urlparse(normalized_url)
    if _is_youtube_host(parsed.netloc):
        return _download_video_from_youtube(normalized_url)

    response = requests.get(
        normalized_url,
        timeout=20,
        allow_redirects=True,
        stream=True,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
            )
        },
    )
    response.raise_for_status()

    content_type = (response.headers.get("content-type") or "").lower()
    if content_type and "video" not in content_type:
        raise HTTPException(status_code=400, detail="Provided URL does not appear to be a direct video resource")

    payload = response.content
    if not payload:
        raise HTTPException(status_code=400, detail="Video URL returned empty content")

    if len(payload) > VIDEO_URL_MAX_BYTES:
        max_mb = VIDEO_URL_MAX_BYTES / (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Video is too large. Maximum supported size is {max_mb:.0f} MB")

    parsed = urlparse(response.url)
    filename = Path(parsed.path).name or "linked-video.mp4"
    return filename, payload


def _analyze_video_payload(payload: bytes, filename: str) -> AnalysisResponse:
    suffix = Path(filename or "uploaded-video.mp4").suffix or ".mp4"

    with tempfile.TemporaryDirectory(prefix="veritas_video_") as temp_dir:
        source_path = Path(temp_dir) / f"input{suffix}"
        frame_dir = Path(temp_dir) / "frames"
        frame_dir.mkdir(parents=True, exist_ok=True)

        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded video file is empty")

        source_path.write_bytes(payload)

        try:
            frame_paths = _extract_video_frames(str(source_path), str(frame_dir))
            if not frame_paths:
                raise HTTPException(
                    status_code=422,
                    detail="No frames could be extracted from this video. Try MP4/H.264 or a shorter clip.",
                )

            face_crops = _extract_face_crops(frame_paths)
            if not face_crops:
                raise HTTPException(
                    status_code=422,
                    detail="No faces were detected in sampled frames. Upload a clearer face-focused video.",
                )

            fake_probability = _score_deepfake_faces(face_crops)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Video analysis failed: %s", exc)

            readiness = _video_readiness()
            if not readiness.ready:
                missing = ", ".join(readiness.missing)
                raise HTTPException(
                    status_code=503,
                    detail=f"Video pipeline is not ready. Missing: {missing}",
                ) from exc

            exc_message = str(exc).lower()
            if "checkpoint mismatch" in exc_message or "degenerate probabilities" in exc_message:
                raise HTTPException(
                    status_code=503,
                    detail="Video model configuration issue detected. Please verify FaceForensics++ Xception weights.",
                ) from exc

            raise HTTPException(
                status_code=422,
                detail="Video could not be analyzed. Try a shorter, clearer video with visible faces.",
            ) from exc

    deepfake_score = int(round(fake_probability * 100))
    if 0.45 <= fake_probability <= 0.55:
        prediction: Prediction = "UNCERTAIN"
        confidence = int(round(50 + (abs(fake_probability - 0.5) * 120)))
        confidence = max(45, min(69, confidence))
    else:
        prediction = "FAKE" if fake_probability > 0.55 else "REAL"
        confidence = int(round(max(fake_probability, 1.0 - fake_probability) * 100))
        confidence = max(55, min(99, confidence))

    return AnalysisResponse(
        prediction=prediction,
        confidence=confidence,
        reasons=_build_video_reasons(fake_probability, len(frame_paths), len(face_crops)),
        deepfakeScore=deepfake_score,
    )


def _push_history(
    item_type: AnalysisType,
    content: str,
    result: AnalysisResponse,
    user_email: Optional[str] = None,
) -> None:
    history_id = str(uuid.uuid4())
    normalized_email = _normalize_user_email(user_email)
    history_item = {
        "id": history_id,
        "type": item_type,
        "content": content,
        "result": result.prediction,
        "confidence": result.confidence,
        "timestamp": _now_utc_iso(),
        "reasons": result.reasons,
        "manipulationScore": result.manipulationScore,
        "deepfakeScore": result.deepfakeScore,
        "trustScore": result.trustScore,
        "domainQualityScore": result.domainQualityScore,
        "keywordRiskScore": result.keywordRiskScore,
        "shortExplanation": result.shortExplanation,
        "badge": result.badge,
        "visualization": result.visualization,
        "userEmail": normalized_email,
    }

    ANALYSIS_HISTORY.insert(0, history_item)
    del ANALYSIS_HISTORY[200:]

    if FIRESTORE_DB is not None and firestore is not None:
        FIRESTORE_DB.collection("analysis_history").document(history_id).set(
            {
                **history_item,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )


def _load_history(user_email: Optional[str] = None) -> List[dict]:
    normalized_email = _normalize_user_email(user_email)

    if FIRESTORE_DB is None or firestore is None:
        if normalized_email is None:
            return ANALYSIS_HISTORY

        return [
            item
            for item in ANALYSIS_HISTORY
            if _normalize_user_email(item.get("userEmail")) == normalized_email
        ]

    query = FIRESTORE_DB.collection("analysis_history")
    if normalized_email is None:
        snapshots = query.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(200).stream()
    else:
        snapshots = query.where("userEmail", "==", normalized_email).limit(400).stream()

    items: List[dict] = []
    for snapshot in snapshots:
        data = snapshot.to_dict() or {}
        items.append(
            {
                "id": data.get("id", snapshot.id),
                "type": data.get("type", "text"),
                "content": data.get("content", ""),
                "result": data.get("result", "REAL"),
                "confidence": int(data.get("confidence", 0)),
                "timestamp": data.get("timestamp", _now_utc_iso()),
                "reasons": data.get("reasons", []),
                "manipulationScore": data.get("manipulationScore"),
                "deepfakeScore": data.get("deepfakeScore"),
                "trustScore": data.get("trustScore"),
                "domainQualityScore": data.get("domainQualityScore"),
                "keywordRiskScore": data.get("keywordRiskScore"),
                "shortExplanation": data.get("shortExplanation"),
                "badge": data.get("badge"),
                "visualization": data.get("visualization"),
                "userEmail": data.get("userEmail"),
            }
        )

    if normalized_email is not None:
        items.sort(key=lambda item: item.get("timestamp", ""), reverse=True)

    return items


_init_firestore()


def _verify_firebase_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a Firebase ID token and return user claims if valid."""
    if firebase_admin is None or firebase_auth is None:
        logger.warning("Firebase Admin SDK not initialized. Cannot verify tokens.")
        return None
    
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as exc:
        logger.debug("Firebase token verification failed: %s", exc)
        return None


def _is_firebase_token(password: str) -> bool:
    """Check if a password string looks like a Firebase token (very long, alphanumeric)."""
    return len(password) > 500 and all(c.isalnum() or c in ".-_" for c in password)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest) -> AuthResponse:
    if not payload.accept_terms:
        raise HTTPException(status_code=400, detail="Terms must be accepted")

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    email_key = payload.email.lower()
    if _get_user_record(email_key) is not None:
        raise HTTPException(status_code=409, detail="User already exists")

    # Check if this is a Firebase token (Google auth)
    is_firebase_auth = _is_firebase_token(payload.password)
    if is_firebase_auth:
        decoded = _verify_firebase_token(payload.password)
        if decoded is None:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")
        # For Firebase auth, we don't store the token; just mark as Google auth
        auth_method = "google"
        stored_password = f"firebase:{decoded.get('email', '')}"
    else:
        auth_method = "email"
        stored_password = payload.password

    new_user = {
        "name": payload.name,
        "email": payload.email,
        "password": stored_password,
        "auth_method": auth_method,
    }
    _save_user_record(email_key, new_user)

    return AuthResponse(
        token=str(uuid.uuid4()),
        user=UserResponse(name=payload.name, email=payload.email),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    email_key = payload.email.lower()
    user = _get_user_record(email_key)

    # Check if this is a Firebase token (Google auth)
    is_firebase_auth = _is_firebase_token(payload.password)
    
    if is_firebase_auth:
        # Verify the Firebase token
        decoded = _verify_firebase_token(payload.password)
        if decoded is None:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")
        
        # Auto-provision user if they don't exist (first Google login)
        if user is None:
            user = {
                "name": decoded.get("name", payload.email.split("@")[0]),
                "email": payload.email,
                "password": f"firebase:{decoded.get('email', '')}",
                "auth_method": "google",
            }
            _save_user_record(email_key, user)
        return AuthResponse(
            token=str(uuid.uuid4()),
            user=UserResponse(name=user["name"], email=user["email"]),
        )
    else:
        # Standard email/password auth
        if user is None:
            # Demo convenience: auto-provision the first login for unknown users.
            user = {
                "name": payload.email.split("@")[0],
                "email": payload.email,
                "password": payload.password,
                "auth_method": "email",
            }
            _save_user_record(email_key, user)
        
        if user["password"] != payload.password:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return AuthResponse(
            token=str(uuid.uuid4()),
            user=UserResponse(name=user["name"], email=user["email"]),
        )


@app.post("/api/analyze/text", response_model=AnalysisResponse)
def analyze_text(
    payload: TextAnalysisRequest,
    user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> AnalysisResponse:
    try:
        classifier = _load_text_classifier()
        model_output = classifier(
            payload.text,
            candidate_labels=TEXT_LABELS,
            hypothesis_template="This text is {}.",
        )
    except Exception as exc:
        logger.exception("Text model inference failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Text analysis model is unavailable. Please try again shortly.",
        ) from exc

    labels = model_output.get("labels", [])
    scores = model_output.get("scores", [])
    score_map = {label: float(score) for label, score in zip(labels, scores)}
    fake_score = score_map.get("fake news", 0.0)
    real_score = score_map.get("real news", 0.0)

    score_gap = abs(fake_score - real_score)
    if score_gap < 0.12:
        prediction: Prediction = "UNCERTAIN"
        confidence = int(round((0.5 + score_gap / 2.0) * 100))
        confidence = max(45, min(69, confidence))
    else:
        prediction = "FAKE" if fake_score >= real_score else "REAL"
        confidence = int(round(max(fake_score, real_score) * 100))
        confidence = max(55, min(99, confidence))

    result = AnalysisResponse(
        prediction=prediction,
        confidence=confidence,
        reasons=_build_text_reasons(prediction, confidence, payload.text),
    )
    _push_history("text", payload.text[:5000], result, user_email=user_email)
    return result


@app.post("/api/analyze/url", response_model=AnalysisResponse)
def analyze_url(
    payload: UrlAnalysisRequest,
    user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> AnalysisResponse:
    try:
        _require_url_dependencies()
        normalized_url = _normalize_url(payload.url)
        fetched = _fetch_page_content(normalized_url)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("URL fetch/extraction failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Unable to fetch or parse URL content right now. Please retry with another public page.",
        ) from exc

    final_url = fetched["final_url"]
    extracted_text = fetched["text"]
    parsed = urlparse(final_url)
    domain = parsed.netloc.lower()
    is_https = parsed.scheme.lower() == "https"

    age_days = _get_domain_age_days(domain)
    domain_meta = _score_domain_quality(domain, is_https, age_days)
    domain_quality_score = int(domain_meta["score"])

    clickbait = _clickbait_matches(extracted_text)
    keyword_risk_score = int(min(len(clickbait) * 14, 98))

    try:
        model_scores = _model_content_score(extracted_text)
    except Exception as exc:
        logger.exception("URL content model inference failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Text detection model is unavailable for URL content analysis.",
        ) from exc

    fake_score = float(model_scores["fake_score"])
    real_score = float(model_scores["real_score"])
    content_trust = int(round(real_score * 100))

    trust_score = int(
        round(
            (0.45 * content_trust)
            + (0.40 * domain_quality_score)
            + (0.15 * (100 - keyword_risk_score))
        )
    )
    trust_score = max(1, min(99, trust_score))

    if 45 <= trust_score <= 60:
        prediction: Prediction = "UNCERTAIN"
        confidence = int(round(52 + (abs(trust_score - 52) * 0.50)))
        confidence = max(45, min(69, confidence))
    else:
        prediction = "REAL" if trust_score > 60 else "FAKE"
        confidence = int(round(56 + (abs(trust_score - 50) * 0.88)))
        confidence = max(55, min(99, confidence))

    age_text = (
        f"{age_days} days" if age_days is not None else "unavailable"
    )
    clickbait_text = ", ".join(clickbait) if clickbait else "none detected"
    domain_notes = domain_meta["penalties"] + domain_meta["labels"]
    domain_note_text = "; ".join(domain_notes[:2]) if domain_notes else "No major domain red flags"

    reasons = [
        f"Fetched and extracted {len(extracted_text)} text characters from {final_url} for analysis.",
        f"Content model scores: fake={fake_score * 100:.1f}%, real={real_score * 100:.1f}%.",
        f"Domain checks: HTTPS={'yes' if is_https else 'no'}, age={age_text}, quality score={domain_quality_score}/100 ({domain_note_text}).",
        f"Clickbait keyword scan: {clickbait_text}; keyword risk score={keyword_risk_score}/100.",
        f"Final trust score={trust_score}/100 from weighted content, domain, and keyword checks.",
    ]

    result = AnalysisResponse(
        prediction=prediction,
        confidence=confidence,
        reasons=reasons,
        trustScore=trust_score,
        domainQualityScore=domain_quality_score,
        keywordRiskScore=keyword_risk_score,
        shortExplanation=_short_url_explanation(prediction, trust_score, len(clickbait), domain_quality_score),
        badge=("SAFE" if prediction == "REAL" else "NOT_SAFE" if prediction == "FAKE" else None),
    )
    _push_history("url", payload.url, result, user_email=user_email)
    return result


@app.post("/api/analyze/image", response_model=AnalysisResponse)
async def analyze_image(
    file: UploadFile = File(...),
    user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> AnalysisResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty")

    try:
        _require_image_dependencies()
        np_payload = np.frombuffer(payload, dtype=np.uint8)
        image_bgr = cv2.imdecode(np_payload, cv2.IMREAD_COLOR)
        if image_bgr is None:
            raise HTTPException(status_code=400, detail="Unable to decode image file. Please upload JPG or PNG.")

        insights = _analyze_image_integrity(image_bgr)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Image analysis failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Image analysis pipeline is unavailable. Ensure OpenCV and NumPy are installed.",
        ) from exc

    result = AnalysisResponse(**insights)
    _push_history("image", file.filename or "uploaded-image", result, user_email=user_email)
    return result


@app.post("/api/analyze/video", response_model=AnalysisResponse)
async def analyze_video(
    file: UploadFile = File(...),
    user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> AnalysisResponse:
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Please upload a valid video file")

    payload = await file.read()
    result = _analyze_video_payload(payload, file.filename or "uploaded-video.mp4")
    _push_history("video", file.filename or "uploaded-video", result, user_email=user_email)
    return result


@app.post("/api/analyze/video-url", response_model=AnalysisResponse)
def analyze_video_url(
    payload: VideoUrlAnalysisRequest,
    user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> AnalysisResponse:
    try:
        filename, video_payload = _download_video_from_url(payload.url)
        result = _analyze_video_payload(video_payload, filename)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Video URL analysis failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Unable to analyze video from this URL. Use a direct link to a downloadable video file.",
        ) from exc

    _push_history("video", payload.url, result, user_email=user_email)
    return result


@app.get("/api/analyze/video/readiness", response_model=VideoReadinessResponse)
def video_readiness() -> VideoReadinessResponse:
    return _video_readiness()


@app.get("/api/history", response_model=List[HistoryItem])
def get_history(user_email: Optional[str] = Header(default=None, alias="X-User-Email")) -> List[HistoryItem]:
    return [HistoryItem(**item) for item in _load_history(user_email=user_email)]


if __name__ == "__main__":
    import uvicorn
    
    _init_firestore()
    uvicorn.run(app, host="0.0.0.0", port=8000)

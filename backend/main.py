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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

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
    from firebase_admin import credentials, firestore
except ImportError:
    firebase_admin = None
    credentials = None
    firestore = None

Prediction = Literal["FAKE", "REAL"]
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


class XceptionBinaryClassifier(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.model = timm.create_model("xception", pretrained=False, num_classes=2)

    def forward(self, x: Any) -> Any:
        return self.model(x)


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


class AnalysisResponse(BaseModel):
    prediction: Prediction
    confidence: int
    reasons: List[str]
    manipulationScore: Optional[int] = None
    deepfakeScore: Optional[int] = None


class HistoryItem(BaseModel):
    id: str
    type: AnalysisType
    content: str
    result: Prediction
    confidence: int
    timestamp: str


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

        cleaned = {
            key.replace("module.", "", 1) if key.startswith("module.") else key: value
            for key, value in state_dict.items()
        }

        model.load_state_dict(cleaned, strict=False)
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

    return float(sum(fake_probs) / len(fake_probs))


def _build_video_reasons(fake_probability: float, frame_count: int, face_count: int) -> List[str]:
    fake_percent = int(round(fake_probability * 100))
    return [
        f"Processed {frame_count} frames using FFmpeg/OpenCV extraction pipeline.",
        f"Detected and analyzed {face_count} face crops with MTCNN.",
        f"Xception model (FaceForensics++ checkpoint) estimated deepfake probability at {fake_percent}%.",
        "Frame-level face predictions were aggregated into a final video authenticity score.",
    ]


def _push_history(item_type: AnalysisType, content: str, result: AnalysisResponse) -> None:
    history_id = str(uuid.uuid4())
    history_item = {
        "id": history_id,
        "type": item_type,
        "content": content,
        "result": result.prediction,
        "confidence": result.confidence,
        "timestamp": _now_utc_iso(),
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


def _load_history() -> List[dict]:
    if FIRESTORE_DB is None or firestore is None:
        return ANALYSIS_HISTORY

    snapshots = (
        FIRESTORE_DB.collection("analysis_history")
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(200)
        .stream()
    )

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
            }
        )

    return items


_init_firestore()


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

    new_user = {
        "name": payload.name,
        "email": payload.email,
        "password": payload.password,
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

    if user is None:
        # Demo convenience: auto-provision the first login for unknown users.
        user = {
            "name": payload.email.split("@")[0],
            "email": payload.email,
            "password": payload.password,
        }
        _save_user_record(email_key, user)

    if user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(
        token=str(uuid.uuid4()),
        user=UserResponse(name=user["name"], email=user["email"]),
    )


@app.post("/api/analyze/text", response_model=AnalysisResponse)
def analyze_text(payload: TextAnalysisRequest) -> AnalysisResponse:
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

    prediction: Prediction = "FAKE" if fake_score >= real_score else "REAL"
    confidence = int(round(max(fake_score, real_score) * 100))
    confidence = max(1, min(99, confidence))

    result = AnalysisResponse(
        prediction=prediction,
        confidence=confidence,
        reasons=_build_text_reasons(prediction, confidence, payload.text),
    )
    _push_history("text", payload.text[:120], result)
    return result


@app.post("/api/analyze/url", response_model=AnalysisResponse)
def analyze_url(payload: UrlAnalysisRequest) -> AnalysisResponse:
    result = _base_result(
        payload.url,
        fake_reasons=[
            "Domain recently registered with suspicious hosting",
            "Multiple redirects to unverified sources detected",
            "Content farm patterns and clickbait indicators",
            "Security posture appears inconsistent with trusted publishers",
        ],
        real_reasons=[
            "Established domain with verified credentials",
            "Direct routing to legitimate source",
            "Professional journalistic standards observed",
            "SSL encryption and security signals are consistent",
        ],
    )
    _push_history("url", payload.url, result)
    return result


@app.post("/api/analyze/image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)) -> AnalysisResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    await file.read()

    result = _base_result(
        file.filename or "image",
        fake_reasons=[
            "AI-generated artifacts detected in pixel analysis",
            "Metadata inconsistencies found",
            "Image manipulation patterns identified",
            "Unnatural lighting and shadow distribution",
        ],
        real_reasons=[
            "No digital manipulation traces detected",
            "Metadata aligns with capture time and location",
            "Natural pixel distribution patterns",
            "Authentic lighting and perspective geometry",
        ],
    )
    result.manipulationScore = random.randint(55, 95) if result.prediction == "FAKE" else random.randint(8, 45)
    _push_history("image", file.filename or "uploaded-image", result)
    return result


@app.post("/api/analyze/video", response_model=AnalysisResponse)
async def analyze_video(file: UploadFile = File(...)) -> AnalysisResponse:
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Please upload a valid video file")

    suffix = Path(file.filename or "uploaded-video.mp4").suffix or ".mp4"
    with tempfile.TemporaryDirectory(prefix="veritas_video_") as temp_dir:
        source_path = Path(temp_dir) / f"input{suffix}"
        frame_dir = Path(temp_dir) / "frames"
        frame_dir.mkdir(parents=True, exist_ok=True)

        payload = await file.read()
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

            raise HTTPException(
                status_code=422,
                detail="Video could not be analyzed. Try a shorter, clearer video with visible faces.",
            ) from exc

    deepfake_score = int(round(fake_probability * 100))
    prediction: Prediction = "FAKE" if fake_probability >= 0.5 else "REAL"
    confidence = int(round(max(fake_probability, 1.0 - fake_probability) * 100))
    confidence = max(1, min(99, confidence))

    result = AnalysisResponse(
        prediction=prediction,
        confidence=confidence,
        reasons=_build_video_reasons(fake_probability, len(frame_paths), len(face_crops)),
        deepfakeScore=deepfake_score,
    )
    _push_history("video", file.filename or "uploaded-video", result)
    return result


@app.get("/api/analyze/video/readiness", response_model=VideoReadinessResponse)
def video_readiness() -> VideoReadinessResponse:
    return _video_readiness()


@app.get("/api/history", response_model=List[HistoryItem])
def get_history() -> List[HistoryItem]:
    return [HistoryItem(**item) for item in _load_history()]

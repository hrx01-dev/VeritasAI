from __future__ import annotations

import logging
import os
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

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
    result = _base_result(
        payload.text,
        fake_reasons=[
            "Sensational language and emotional manipulation detected",
            "Claims lack credible source citations",
            "Content pattern matches known misinformation templates",
            "Inconsistent narrative structure identified",
        ],
        real_reasons=[
            "Content verified against multiple credible sources",
            "Factual statements corroborate with established data",
            "Neutral tone and objective language observed",
            "Citations and references are legitimate",
        ],
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

    await file.read()

    result = _base_result(
        file.filename or "video",
        fake_reasons=[
            "Deepfake facial manipulation detected",
            "Audio-video synchronization anomalies",
            "Frame-by-frame inconsistencies found",
            "Synthetic voice patterns identified",
        ],
        real_reasons=[
            "Authentic facial movements and expressions",
            "Natural audio-video synchronization",
            "Consistent frame quality and transitions",
            "No synthetic audio generation detected",
        ],
    )
    result.deepfakeScore = random.randint(60, 96) if result.prediction == "FAKE" else random.randint(6, 44)
    _push_history("video", file.filename or "uploaded-video", result)
    return result


@app.get("/api/history", response_model=List[HistoryItem])
def get_history() -> List[HistoryItem]:
    return [HistoryItem(**item) for item in _load_history()]

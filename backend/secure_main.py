from __future__ import annotations

"""Secure production entrypoint for VeritasAI.

This wrapper keeps the existing analysis implementation but hardens its runtime
boundary: Firebase-only authentication, verified-user scoping, SSRF-safe URL
fetching, strict CORS, persistent VeritasConnect data, and trained classifiers.
"""

import contextvars
import ipaddress
import math
import os
import socket
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from fastapi import Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

import main as legacy


# ---------------------------------------------------------------------------
# Runtime identity: never trust a client-supplied email for authorization.
# ---------------------------------------------------------------------------
_CURRENT_USER: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar(
    "veritas_current_user", default=None
)


_PUBLIC_PATHS = {
    "/health",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/analyze/video/readiness",
}


def _verified_user() -> Dict[str, Any]:
    user = _CURRENT_USER.get()
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def _auth_middleware_factory(app):
    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        if not request.url.path.startswith(("/api/analyze/", "/api/history", "/api/veritasconnect")):
            return await call_next(request)

        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            return _json_error(401, "Missing Firebase ID token")

        token = header.split(" ", 1)[1].strip()
        if not token:
            return _json_error(401, "Missing Firebase ID token")

        decoded = legacy._verify_firebase_token(token)
        if not decoded or not decoded.get("uid"):
            return _json_error(401, "Invalid or expired Firebase ID token")

        token_email = str(decoded.get("email") or "").strip().lower()
        supplied_email = str(request.headers.get("x-user-email") or "").strip().lower()
        if supplied_email and token_email and supplied_email != token_email:
            return _json_error(403, "User identity does not match Firebase token")

        identity = {
            "uid": decoded.get("uid"),
            "email": token_email,
            "name": decoded.get("name") or (token_email.split("@", 1)[0] if token_email else "User"),
        }
        token_handle = _CURRENT_USER.set(identity)
        try:
            return await call_next(request)
        finally:
            _CURRENT_USER.reset(token_handle)

    return auth_middleware


def _json_error(status: int, detail: str):
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=status, content={"detail": detail})


# ---------------------------------------------------------------------------
# Strict CORS. Configure CORS_ORIGINS as a comma-separated production list.
# ---------------------------------------------------------------------------
def _configure_cors() -> None:
    origins = [
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        ).split(",")
        if origin.strip()
    ]

    # Remove the wildcard CORS middleware configured by the legacy module.
    legacy.app.user_middleware = [
        m for m in legacy.app.user_middleware if m.cls is not CORSMiddleware
    ]
    legacy.app.middleware_stack = None
    legacy.app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-User-Email"],
    )


# ---------------------------------------------------------------------------
# SSRF protection for page/video URL analysis.
# ---------------------------------------------------------------------------
def _assert_public_destination(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Only public HTTP(S) URLs are supported")

    hostname = parsed.hostname.rstrip(".")
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)}
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Unable to resolve URL host") from exc

    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(status_code=400, detail="URL resolves to a restricted network address")


def _safe_http_get(url: str, *, max_bytes: int, timeout: tuple[int, int] = (5, 15)) -> requests.Response:
    current = legacy._normalize_url(url)
    session = requests.Session()
    session.headers.update({
        "User-Agent": "VeritasAI/1.0 (+https://veritasai.app)",
        "Accept": "text/html,video/*,*/*;q=0.8",
    })

    for _ in range(5):
        _assert_public_destination(current)
        response = session.get(current, timeout=timeout, allow_redirects=False, stream=True)
        if response.is_redirect or response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            response.close()
            if not location:
                raise HTTPException(status_code=400, detail="Redirect without destination")
            current = urljoin(current, location)
            continue

        response.url = current
        # Bound response bodies before consuming them.
        length = response.headers.get("content-length")
        if length and int(length) > max_bytes:
            response.close()
            raise HTTPException(status_code=413, detail="Remote resource is too large")

        chunks: List[bytes] = []
        total = 0
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > max_bytes:
                response.close()
                raise HTTPException(status_code=413, detail="Remote resource is too large")
            chunks.append(chunk)
        response._content = b"".join(chunks)
        response.close()
        return response

    raise HTTPException(status_code=400, detail="Too many redirects")


def _safe_fetch_page(url: str) -> Dict[str, Any]:
    response = _safe_http_get(url, max_bytes=5 * 1024 * 1024)
    response.raise_for_status()
    content_type = (response.headers.get("content-type") or "").lower()
    if content_type and "text/html" not in content_type and "application/xhtml" not in content_type:
        raise HTTPException(status_code=400, detail="URL does not return an HTML page")

    text = legacy._extract_visible_text(response.text)
    if len(text) < 120:
        raise HTTPException(status_code=422, detail="Not enough readable text was found on this URL")
    return {"final_url": response.url, "status_code": response.status_code, "text": text}


def _safe_download_video(url: str) -> tuple[str, bytes]:
    normalized = legacy._normalize_url(url)
    parsed = urlparse(normalized)
    if legacy._is_youtube_host(parsed.netloc):
        # yt-dlp stores only inside its TemporaryDirectory and returns bytes.
        return legacy._download_video_from_youtube(normalized)

    response = _safe_http_get(normalized, max_bytes=legacy.VIDEO_URL_MAX_BYTES, timeout=(5, 20))
    response.raise_for_status()
    content_type = (response.headers.get("content-type") or "").lower()
    if content_type and "video" not in content_type and "application/octet-stream" not in content_type:
        raise HTTPException(status_code=400, detail="Provided URL is not a direct video resource")

    final = urlparse(response.url)
    filename = os.path.basename(final.path) or "linked-video.mp4"
    return filename, response.content


# ---------------------------------------------------------------------------
# Trained classifiers + score calibration.
# ---------------------------------------------------------------------------
try:
    from transformers import pipeline
except Exception:  # pragma: no cover
    pipeline = None

_TEXT_MODEL_ID = os.getenv("TEXT_MODEL_ID", "hamzab/roberta-fake-news-classification")
_IMAGE_MODEL_ID = os.getenv("IMAGE_MODEL_ID", "dima806/deepfake_vs_real_image_detection")
_TEMPERATURE = max(0.25, float(os.getenv("DETECTION_TEMPERATURE", "1.0")))

_TEXT_MODEL = None
_IMAGE_MODEL = None


def _calibrate_binary(fake_score: float, real_score: float) -> tuple[float, float]:
    # Temperature scaling on log-odds. Keep semantics explicit: this is a
    # calibrated model score only after a validation-derived temperature is set.
    eps = 1e-6
    fake = min(max(fake_score, eps), 1 - eps)
    real = min(max(real_score, eps), 1 - eps)
    logit = math.log(fake / real) / _TEMPERATURE
    fake_cal = 1.0 / (1.0 + math.exp(-logit))
    return fake_cal, 1.0 - fake_cal


def _load_trained_text_adapter():
    global _TEXT_MODEL
    if _TEXT_MODEL is None:
        if pipeline is None:
            raise RuntimeError("transformers is not installed")
        _TEXT_MODEL = pipeline("text-classification", model=_TEXT_MODEL_ID, truncation=True, max_length=512)
    return _TEXT_MODEL


class _TextAdapter:
    def __call__(self, text: str, **_: Any) -> Dict[str, List[float]]:
        raw = _load_trained_text_adapter()(text)
        items = raw if isinstance(raw, list) else [raw]
        fake = 0.5
        real = 0.5
        for item in items:
            label = str(item.get("label", "")).lower()
            score = float(item.get("score", 0.5))
            if "fake" in label or label in {"label_0", "0"}:
                fake = score
            elif "real" in label or label in {"label_1", "1"}:
                real = score
        fake, real = _calibrate_binary(fake, real)
        return {"labels": ["fake news", "real news"], "scores": [fake, real]}


def _trained_text_classifier():
    return _TextAdapter()


def _trained_content_score(text: str) -> Dict[str, Any]:
    output = _trained_text_classifier()(text)
    scores = dict(zip(output["labels"], output["scores"]))
    return {"fake_score": float(scores.get("fake news", 0.5)), "real_score": float(scores.get("real news", 0.5))}


def _trained_image_integrity(image_bgr: Any) -> Dict[str, Any]:
    global _IMAGE_MODEL
    if pipeline is None:
        raise RuntimeError("transformers is not installed")
    if _IMAGE_MODEL is None:
        _IMAGE_MODEL = pipeline("image-classification", model=_IMAGE_MODEL_ID)

    rgb = legacy.cv2.cvtColor(image_bgr, legacy.cv2.COLOR_BGR2RGB)
    raw = _IMAGE_MODEL(rgb)
    fake = real = 0.5
    for item in raw:
        label = str(item.get("label", "")).lower()
        score = float(item.get("score", 0.5))
        if "fake" in label or "deepfake" in label or label in {"label_1", "1"}:
            fake = score
        elif "real" in label or label in {"label_0", "0"}:
            real = score

    fake, real = _calibrate_binary(fake, real)
    if abs(fake - real) < 0.12:
        prediction = "UNCERTAIN"
        confidence = int(round(50 + abs(fake - real) * 100))
    else:
        prediction = "FAKE" if fake > real else "REAL"
        confidence = int(round(max(fake, real) * 100))

    manipulation = int(round(fake * 100))
    return {
        "prediction": prediction,
        "confidence": max(45, min(99, confidence)),
        "manipulationScore": max(1, min(99, manipulation)),
        "reasons": [
            f"Trained image classifier: {_IMAGE_MODEL_ID}.",
            f"Calibrated fake score: {fake * 100:.1f}%.",
            f"Calibrated real score: {real * 100:.1f}%.",
            "Handcrafted forensic heuristics are no longer the primary verdict signal.",
        ],
    }


# ---------------------------------------------------------------------------
# User-scoped history and Firebase-only auth.
# ---------------------------------------------------------------------------
_ORIGINAL_PUSH_HISTORY = legacy._push_history
_ORIGINAL_LOAD_HISTORY = legacy._load_history


def _secure_push_history(item_type, content, result, user_email=None):
    user = _verified_user()
    return _ORIGINAL_PUSH_HISTORY(item_type, content, result, user_email=user.get("email"))


def _secure_load_history(user_email=None):
    user = _verified_user()
    return _ORIGINAL_LOAD_HISTORY(user_email=user.get("email"))


# ---------------------------------------------------------------------------
# Persistent VeritasConnect.
# ---------------------------------------------------------------------------
def _db():
    if legacy.FIRESTORE_DB is None:
        raise HTTPException(status_code=503, detail="Firestore is not configured")
    return legacy.FIRESTORE_DB


def _post_dict(snapshot) -> Dict[str, Any]:
    data = snapshot.to_dict() or {}
    data.setdefault("likes", [])
    data.setdefault("dislikes", [])
    data.setdefault("comments", [])
    return data


def _remove_legacy_routes() -> None:
    paths = {
        "/api/auth/login",
        "/api/auth/signup",
        "/api/veritasconnect/posts",
        "/api/veritasconnect/posts/{post_id}/reaction",
        "/api/veritasconnect/posts/{post_id}/comments",
        "/api/veritasconnect/upload",
    }
    legacy.app.router.routes[:] = [r for r in legacy.app.router.routes if getattr(r, "path", None) not in paths]


_remove_legacy_routes()


@legacy.app.post("/api/auth/login", response_model=legacy.AuthResponse)
def secure_login(payload: legacy.LoginRequest):
    decoded = legacy._verify_firebase_token(payload.password)
    if not decoded or not decoded.get("uid"):
        raise HTTPException(status_code=401, detail="Use Firebase Authentication and provide a valid ID token")
    email = str(decoded.get("email") or payload.email).lower()
    if email != str(payload.email).lower():
        raise HTTPException(status_code=403, detail="Firebase token email does not match request")
    return legacy.AuthResponse(
        token=payload.password,
        user=legacy.UserResponse(
            name=decoded.get("name") or email.split("@", 1)[0], email=email
        ),
    )


@legacy.app.post("/api/auth/signup", response_model=legacy.AuthResponse)
def secure_signup(payload: legacy.SignupRequest):
    if not payload.accept_terms:
        raise HTTPException(status_code=400, detail="Terms must be accepted")
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    decoded = legacy._verify_firebase_token(payload.password)
    if not decoded or not decoded.get("uid"):
        raise HTTPException(status_code=401, detail="Create the account with Firebase Authentication first")
    email = str(decoded.get("email") or "").lower()
    if email != str(payload.email).lower():
        raise HTTPException(status_code=403, detail="Firebase token email does not match request")

    db = legacy.FIRESTORE_DB
    if db is not None:
        db.collection("users").document(decoded["uid"]).set(
            {
                "uid": decoded["uid"],
                "name": payload.name.strip(),
                "email": email,
                "auth_method": "firebase",
                "updatedAt": legacy.firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

    return legacy.AuthResponse(
        token=payload.password,
        user=legacy.UserResponse(name=payload.name.strip(), email=email),
    )


@legacy.app.get("/api/veritasconnect/posts")
def get_posts():
    snapshots = _db().collection("veritasconnect_posts").order_by(
        "createdAt", direction=legacy.firestore.Query.DESCENDING
    ).limit(200).stream()
    return [_post_dict(snapshot) for snapshot in snapshots]


@legacy.app.post("/api/veritasconnect/posts")
def create_post(payload: legacy.VeritasConnectPostCreateRequest):
    user = _verified_user()
    text = payload.text.strip()
    if not text and not payload.mediaUrl:
        raise HTTPException(status_code=400, detail="Please add a description or upload a file.")

    if payload.authorEmail.lower() != user.get("email"):
        raise HTTPException(status_code=403, detail="Author identity must match Firebase account")

    post = {
        "id": __import__("uuid").uuid4().hex,
        "authorName": user.get("name") or payload.authorName.strip(),
        "authorEmail": user.get("email"),
        "text": text,
        "mediaUrl": payload.mediaUrl,
        "mediaType": payload.mediaType,
        "mediaName": payload.mediaName,
        "likes": [],
        "dislikes": [],
        "comments": [],
        "createdAt": legacy._now_utc_iso(),
    }
    _db().collection("veritasconnect_posts").document(post["id"]).set(
        {**post, "createdAtServer": legacy.firestore.SERVER_TIMESTAMP}
    )
    return post


@legacy.app.post("/api/veritasconnect/posts/{post_id}/reaction")
def react_post(post_id: str, payload: legacy.VeritasConnectReactionRequest):
    user = _verified_user()
    if payload.userEmail.lower() != user.get("email"):
        raise HTTPException(status_code=403, detail="Reaction identity must match Firebase account")

    ref = _db().collection("veritasconnect_posts").document(post_id)
    transaction = _db().transaction()

    @legacy.firestore.transactional
    def update(transaction):
        snapshot = ref.get(transaction=transaction)
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="Post not found")
        post = _post_dict(snapshot)
        likes = set(post.get("likes", []))
        dislikes = set(post.get("dislikes", []))
        email = user.get("email")
        target = likes if payload.reaction == "like" else dislikes
        other = dislikes if payload.reaction == "like" else likes
        if email in target:
            target.remove(email)
        else:
            target.add(email)
            other.discard(email)
        post["likes"] = sorted(likes)
        post["dislikes"] = sorted(dislikes)
        transaction.update(ref, {"likes": post["likes"], "dislikes": post["dislikes"]})
        return post

    return update(transaction)


@legacy.app.post("/api/veritasconnect/posts/{post_id}/comments")
def comment_post(post_id: str, payload: legacy.VeritasConnectCommentCreateRequest):
    user = _verified_user()
    if payload.authorEmail.lower() != user.get("email"):
        raise HTTPException(status_code=403, detail="Comment identity must match Firebase account")
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")

    ref = _db().collection("veritasconnect_posts").document(post_id)
    transaction = _db().transaction()

    @legacy.firestore.transactional
    def update(transaction):
        snapshot = ref.get(transaction=transaction)
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="Post not found")
        post = _post_dict(snapshot)
        post["comments"].append(
            {
                "id": __import__("uuid").uuid4().hex,
                "authorName": user.get("name") or payload.authorName.strip(),
                "authorEmail": user.get("email"),
                "text": text,
                "createdAt": legacy._now_utc_iso(),
            }
        )
        transaction.update(ref, {"comments": post["comments"]})
        return post

    return update(transaction)


# Install runtime patches after all legacy functions are loaded.
legacy._verify_firebase_token_with_rest = legacy._verify_firebase_token_with_rest
legacy._fetch_page_content = _safe_fetch_page
legacy._download_video_from_url = _safe_download_video
legacy._load_text_classifier = _trained_text_classifier
legacy._model_content_score = _trained_content_score
legacy._analyze_image_integrity = _trained_image_integrity
legacy._push_history = _secure_push_history
legacy._load_history = _secure_load_history

_configure_cors()
_auth_middleware_factory(legacy.app)

app = legacy.app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))

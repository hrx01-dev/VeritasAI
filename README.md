# VeritasAI Dashboard + FastAPI Backend

This project includes a Vite + React frontend and a FastAPI backend.

## Frontend Setup

```bash
npm i
npm run dev
```

The frontend reads `VITE_API_BASE_URL` and defaults to `http://127.0.0.1:8000`.

## Deploy Frontend To Firebase Hosting

The repository is preconfigured for Firebase Hosting. Set `VITE_API_BASE_URL` in `.env.production`, then run:

```bash
npm run deploy:hosting
```

For the GitHub Actions Firebase Hosting deployment, the following repository secrets must also be configured so Firebase Authentication is initialized in the production browser build:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

These are Firebase Web SDK configuration values; they are embedded in the frontend bundle by design. Keeping them in GitHub Actions secrets avoids coupling the repository to one deployment environment and ensures the production build receives the same configuration as local development.

## Backend Setup (local)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
cd ..
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The backend dependencies now use CPU-only PyTorch wheels and `opencv-python-headless`, avoiding CUDA packages and unnecessary GUI libraries in server deployments.

## Deploy Backend With Docker

The backend has a production Dockerfile at `backend/Dockerfile` and listens on the platform-provided `PORT` (default `8000`).

From the repository root:

```bash
docker build -t veritasai-backend ./backend
docker run --rm -p 8000:8000 --env-file backend/.env veritasai-backend
```

For Render, Railway, Fly.io, Google Cloud Run, or another Docker-compatible service, use `backend/` as the Docker build context and `backend/Dockerfile` as the Dockerfile. The service should expose HTTP on `$PORT`.

### Required production configuration

Configure Firebase credentials using either:

- `FIREBASE_SERVICE_ACCOUNT_PATH`, or
- `GOOGLE_APPLICATION_CREDENTIALS`

and configure the frontend's `VITE_API_BASE_URL` to the deployed backend URL.

### Video/deepfake model

The FaceForensics++ Xception checkpoint is approximately 84 MB and is kept outside the Python dependency installation. Put it at `backend/models/faceforensics_xception.pth` or configure the path using the backend's video model settings. If the checkpoint is not available, the backend can still start; video model readiness should be checked before enabling video analysis.

## Backend Firestore Persistence

FastAPI persists users and analysis history to Firestore when Firebase Admin credentials are available. If credentials are missing or invalid, the backend falls back to in-memory storage.

Collections used by the backend:

- `users`
- `analysis_history`

## Connected Input Flows

- Login: `/api/auth/login`
- Signup: `/api/auth/signup`
- Text analysis: `/api/analyze/text`
- URL checker: `/api/analyze/url`
- Image upload: `/api/analyze/image`
- Video upload: `/api/analyze/video`
- History: `/api/history`

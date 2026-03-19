
  # VeritasAI Dashboard + FastAPI Backend

  This project now includes:

  - A Vite + React frontend in the repository root
  - A FastAPI backend in `backend/`

  ## Frontend Setup

  1. Install dependencies:

    ```bash
    npm i
    ```

  2. Start the frontend:

    ```bash
    npm run dev
    ```

  The frontend reads `VITE_API_BASE_URL` and defaults to `http://127.0.0.1:8000`.

  ## Firebase Setup

  Firebase app + Cloud Firestore are initialized in `src/app/lib/firebase.ts`.

  Optional Vite environment variables:

  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID`

  If omitted, the app uses your provided Firebase config values.

  To use Google sign-in/sign-up, enable Google as a sign-in provider in Firebase Console:

  - Firebase Console -> Authentication -> Sign-in method -> Google -> Enable

  ## Backend Setup (FastAPI)

  1. Create and activate a Python virtual environment.
  2. Install backend dependencies:

    ```bash
    pip install -r backend/requirements.txt
    ```

  3. Run the API:

    ```bash
    uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    ```

  ## Backend Firestore Persistence

  FastAPI persists users and analysis history to Firestore when Firebase Admin credentials are available.

  Configure one of the following before starting backend:

  - `FIREBASE_SERVICE_ACCOUNT_PATH` (path to Firebase service account JSON), or
  - `GOOGLE_APPLICATION_CREDENTIALS` (Application Default Credentials).

  Firestore collections used by backend:

  - `users`
  - `analysis_history`

  If credentials are missing or invalid, backend falls back to in-memory storage.

  ## Connected Input Flows

  The following user inputs are connected to FastAPI endpoints:

  - Login form (`/api/auth/login`)
  - Signup form (`/api/auth/signup`)
  - Text analysis input (`/api/analyze/text`)
  - URL checker input (`/api/analyze/url`)
  - Image upload (`/api/analyze/image`)
  - Video upload (`/api/analyze/video`)
  - History view (`/api/history`)
  
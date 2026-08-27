FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt

RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY backend/ ./backend/

WORKDIR /app/backend
RUN mkdir -p uploads models \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Always start the secure production wrapper. It patches the legacy analysis
# implementation with the trained text/video paths and security middleware.
CMD ["sh", "-c", "uvicorn production_main:app --host 0.0.0.0 --port ${PORT:-8000}"]

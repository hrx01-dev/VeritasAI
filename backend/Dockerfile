FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

# Runtime libraries required by OpenCV/FFmpeg-backed media processing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

# Install CPU-only PyTorch wheels so the container does not pull CUDA runtimes.
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads /app/models \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# production_main keeps secure_main's auth/SSRF protections and patches the
# analysis runtime for CPU-friendly text and video inference.
CMD ["sh", "-c", "uvicorn production_main:app --host 0.0.0.0 --port ${PORT:-8000}"]

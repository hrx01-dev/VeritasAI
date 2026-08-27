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

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

# Import torch before transformers. Transformers' pipeline implementation
# expects its optional torch backend to be initialized when the pipeline is
# constructed. Keeping this import ahead of transformers avoids a runtime
# NameError inside transformers.pipelines on the deployed CPU image.
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
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory (or project root)
_ENV_FILE = Path(__file__).resolve().parents[2] / "backend" / ".env"
if not _ENV_FILE.exists():
    _ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ENV_FILE, override=False)  # override=False keeps real env vars first


ROOT_DIR = Path(__file__).resolve().parents[2]
DATASET_PATH = ROOT_DIR / "hmnist_28_28_RGB.csv"
METADATA_PATH = ROOT_DIR / "HAM10000_metadata.csv"
MODEL_DIR = ROOT_DIR / "backend" / "models"
ANN_MODEL_PATH = MODEL_DIR / "ann_model.keras"
CNN_MODEL_PATH = MODEL_DIR / "cnn_model.keras"

MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "skin_guru")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-access-secret")
JWT_REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", "change-this-refresh-secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# ── Prediction / Upload config ────────────────────────────────
MODEL_VERSION = os.getenv("MODEL_VERSION", "1.0.0")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10 MB default
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
PREDICTIONS_PAGE_SIZE = int(os.getenv("PREDICTIONS_PAGE_SIZE", "20"))
UPLOADS_DIR = ROOT_DIR / "backend" / "uploads"

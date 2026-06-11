from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def public_prediction(doc: dict[str, Any]) -> dict[str, Any]:
    """Serialize a MongoDB prediction document for API responses."""
    return {
        "report_id": doc["report_id"],
        "user_id": str(doc["user_id"]),
        "predicted_disease": doc["predicted_disease"],
        "predicted_code": doc["predicted_code"],
        "confidence": doc["confidence"],
        "top_predictions": doc["top_predictions"],
        "model_version": doc.get("model_version", "1.0"),
        "model_name": doc.get("model_name", "ensemble"),
        "processing_time_ms": doc.get("processing_time_ms", 0),
        "image_filename": doc.get("image_filename", ""),
        "capture_source": doc.get("capture_source", "upload"),
        "created_at": doc.get("created_at"),
    }

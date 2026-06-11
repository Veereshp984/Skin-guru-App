from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from pymongo.collection import Collection

from backend.app.config import (
    MAX_UPLOAD_BYTES,
    ALLOWED_CONTENT_TYPES,
    PREDICTIONS_PAGE_SIZE,
)
from backend.app.db.mongo import get_database, ensure_indexes
from backend.app.models.prediction import public_prediction
from backend.app.ml.service import model_service
from backend.app.schemas import (
    PredictionResponse,
    PredictionRecord,
    PredictionSummary,
)
from backend.app.auth.dependencies import get_current_user

# Router setup
router = APIRouter()

@router.post("/api/predict", response_model=PredictionResponse)
async def predict_image(
    file: Annotated[UploadFile, File(...)],
    model: str = "ensemble",
    current_user: dict = Depends(get_current_user),
):
    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed types: jpeg, jpg, png, webp.",
        )
    # Read file content (FastAPI stores in memory unless large)
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    report_id = str(uuid.uuid4())
    timestamp = datetime.utcnow()

    # Run prediction (includes OpenCV preprocessing and timing)
    prediction = model_service.predict(
        image_bytes=content,
        model_name=model,
        report_id=report_id,
        timestamp=timestamp,
    )

    # Persist result in MongoDB
    db = get_database()
    predictions: Collection = db.predictions
    record = {
        "report_id": report_id,
        "user_id": str(current_user["_id"]),
        "predicted_disease": prediction.top_prediction.name,
        "predicted_code": prediction.top_prediction.code,
        "confidence": prediction.top_prediction.probability,
        "top_predictions": [
            {
                "code": p.code,
                "name": p.name,
                "probability": p.probability,
                "description": p.description,
            }
            for p in prediction.predictions[:5]
        ],
        "model_version": prediction.model_version,
        "model_name": prediction.model,
        "processing_time_ms": prediction.processing_time_ms,
        "image_filename": file.filename,
        "created_at": timestamp,
    }
    predictions.insert_one(record)

    return prediction

@router.get("/api/predictions", response_model=list[PredictionSummary])
async def list_predictions(
    skip: int = 0,
    limit: int = PREDICTIONS_PAGE_SIZE,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions
    cursor = (
        coll.find({"user_id": str(current_user["_id"])})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return [
        PredictionSummary(
            report_id=doc["report_id"],
            predicted_disease=doc["predicted_disease"],
            predicted_code=doc["predicted_code"],
            confidence=doc["confidence"],
            model_name=doc["model_name"],
            created_at=doc["created_at"],
        )
        for doc in cursor
    ]

@router.get("/api/predictions/{report_id}", response_model=PredictionRecord)
async def get_prediction(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions
    doc = coll.find_one({"report_id": report_id, "user_id": str(current_user["_id"])})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction report not found.",
        )
    return public_prediction(doc)

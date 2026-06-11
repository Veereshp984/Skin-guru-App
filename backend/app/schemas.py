from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


ModelName = Literal["ann", "cnn", "ensemble"]
RoleName = Literal["patient", "doctor", "admin"]


class HealthResponse(BaseModel):
    status: str
    dataset_present: bool
    ann_model_present: bool
    cnn_model_present: bool


class LabelResponse(BaseModel):
    index: int
    code: str
    name: str
    description: str


class PredictionEntry(BaseModel):
    index: int
    code: str
    name: str
    description: str
    probability: float = Field(ge=0.0, le=1.0)


class PredictionResponse(BaseModel):
    model: ModelName
    report_id: str
    top_prediction: PredictionEntry
    predictions: list[PredictionEntry]
    model_version: str
    processing_time_ms: float
    timestamp: datetime


class TrainingMetrics(BaseModel):
    loss: float
    accuracy: float
    val_loss: float
    val_accuracy: float


class TrainingResponse(BaseModel):
    message: str
    ann: TrainingMetrics
    cnn: TrainingMetrics


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: RoleName
    avatar_url: str | None = None
    phone: str | None = None
    bio: str | None = None
    provider: str = "local"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=120)
    role: RoleName = "patient"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str
    role: RoleName = "patient"


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = Field(default=None, max_length=500)


# ── Prediction history schemas ─────────────────────────────────────────────────

class TopPredictionItem(BaseModel):
    code: str
    name: str
    probability: float
    description: str


class PredictionRecord(BaseModel):
    report_id: str
    user_id: str
    predicted_disease: str
    predicted_code: str
    confidence: float
    top_predictions: list[TopPredictionItem]
    model_version: str
    model_name: ModelName
    processing_time_ms: float
    image_filename: str
    created_at: datetime


class PredictionSummary(BaseModel):
    report_id: str
    predicted_disease: str
    predicted_code: str
    confidence: float
    model_name: ModelName
    created_at: datetime

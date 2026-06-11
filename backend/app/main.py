from contextlib import asynccontextmanager
import anyio
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import DATASET_PATH, FRONTEND_ORIGINS
from backend.app.constants import LABELS
from backend.app.ml.service import model_service
from backend.app.schemas import HealthResponse, LabelResponse, TrainingResponse
from backend.scripts.train_models import train_and_save_models
from backend.app.db.mongo import ensure_indexes

# Import routers
from backend.app.auth.routes import router as auth_router
from backend.app.prediction_routes import router as prediction_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize indexes asynchronously in a separate thread to prevent blocking the startup event loop
    try:
        await anyio.to_thread.run_sync(ensure_indexes)
    except Exception as e:
        print("Warning: MongoDB indexing failed on startup:", e)
    yield

app = FastAPI(
    title="Skin Guru API",
    version="1.0.0",
    description="Backend API for SkinGuru authentication, ML predictions, and dashboard management.",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "SkinGuru API is running.",
        "health": "/api/health",
        "docs": "/docs",
    }

# Health Check
@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    status_dict = model_service.model_status()
    return HealthResponse(
        status="ok",
        dataset_present=DATASET_PATH.exists(),
        ann_model_present=status_dict["ann_model_present"],
        cnn_model_present=status_dict["cnn_model_present"],
    )

# Label retrieval
@app.get("/api/labels", response_model=list[LabelResponse])
def get_labels() -> list[LabelResponse]:
    return [
        LabelResponse(
            index=index,
            code=label.code,
            name=label.name,
            description=label.description,
        )
        for index, label in LABELS.items()
    ]

# Model status
@app.get("/api/models/status")
def get_model_status() -> dict[str, bool]:
    return model_service.model_status()

# Model training
@app.post("/api/models/train", response_model=TrainingResponse)
def train_models() -> TrainingResponse:
    try:
        return train_and_save_models()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}") from exc

# Register prediction router
app.include_router(prediction_router)

# Register authentication router (includes login, register, me, profile, dashboards)
app.include_router(auth_router)

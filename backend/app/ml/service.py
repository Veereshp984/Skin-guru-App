from __future__ import annotations

import logging
import time
from io import BytesIO

import cv2
import numpy as np
from PIL import Image
from tensorflow import keras

from backend.app.config import ANN_MODEL_PATH, CNN_MODEL_PATH, MODEL_VERSION
from backend.app.constants import IMAGE_SIZE, LABELS
from backend.app.schemas import PredictionEntry, PredictionResponse

logger = logging.getLogger(__name__)


class ModelService:
    def __init__(self) -> None:
        self._ann_model: keras.Model | None = None
        self._cnn_model: keras.Model | None = None

    def model_status(self) -> dict[str, bool]:
        return {
            "ann_model_present": ANN_MODEL_PATH.exists(),
            "cnn_model_present": CNN_MODEL_PATH.exists(),
        }

    def _load_ann(self) -> keras.Model:
        if self._ann_model is None:
            if not ANN_MODEL_PATH.exists():
                raise FileNotFoundError(f"ANN model not found at {ANN_MODEL_PATH}")
            self._ann_model = keras.models.load_model(ANN_MODEL_PATH)
        return self._ann_model

    def _load_cnn(self) -> keras.Model:
        if self._cnn_model is None:
            if not CNN_MODEL_PATH.exists():
                raise FileNotFoundError(f"CNN model not found at {CNN_MODEL_PATH}")
            self._cnn_model = keras.models.load_model(CNN_MODEL_PATH)
        return self._cnn_model

    def preprocess_upload(self, image_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
        """
        OpenCV preprocessing pipeline:
        1. Decode bytes → BGR image
        2. Convert BGR → RGB
        3. Bilateral filter (noise reduction, edge-preserving)
        4. CLAHE contrast enhancement in LAB colour space
        5. Resize to 28×28 (model input size)
        6. Normalise to [0, 1]
        """
        # Decode image bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if bgr is None:
            # Fallback to PIL for uncommon formats (e.g. WebP on some platforms)
            try:
                pil_img = Image.open(BytesIO(image_bytes)).convert("RGB")
                bgr = cv2.cvtColor(np.asarray(pil_img), cv2.COLOR_RGB2BGR)
            except Exception as exc:
                raise ValueError("Image could not be decoded.") from exc

        # BGR → RGB
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        # Bilateral filter — smooth noise while keeping skin lesion edges sharp
        denoised = cv2.bilateralFilter(rgb, d=9, sigmaColor=75, sigmaSpace=75)

        # CLAHE contrast enhancement in LAB space (only L channel)
        lab = cv2.cvtColor(denoised, cv2.COLOR_RGB2LAB)
        l_ch, a_ch, b_ch = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_eq = clahe.apply(l_ch)
        lab_eq = cv2.merge([l_eq, a_ch, b_ch])
        enhanced = cv2.cvtColor(lab_eq, cv2.COLOR_LAB2RGB)

        # Resize to model input size (28×28)
        resized = cv2.resize(enhanced, IMAGE_SIZE, interpolation=cv2.INTER_AREA)

        # Normalise to [0, 1] float32
        array = resized.astype(np.float32) / 255.0
        cnn_ready = np.expand_dims(array, axis=0)          # (1, 28, 28, 3)
        ann_ready = cnn_ready.reshape((1, -1))              # (1, 2352)

        return ann_ready, cnn_ready

    def predict(
        self,
        image_bytes: bytes,
        model_name: str,
        report_id: str,
        timestamp,
    ) -> PredictionResponse:
        t_start = time.perf_counter()

        ann_input, cnn_input = self.preprocess_upload(image_bytes)

        if model_name == "ann":
            probabilities = self._load_ann().predict(ann_input, verbose=0)[0]
        elif model_name == "cnn":
            probabilities = self._load_cnn().predict(cnn_input, verbose=0)[0]
        else:  # ensemble
            ann_probs = self._load_ann().predict(ann_input, verbose=0)[0]
            cnn_probs = self._load_cnn().predict(cnn_input, verbose=0)[0]
            probabilities = (ann_probs + cnn_probs) / 2.0

        processing_time_ms = (time.perf_counter() - t_start) * 1000

        entries = [
            PredictionEntry(
                index=index,
                code=label.code,
                name=label.name,
                description=label.description,
                probability=float(probabilities[index]),
            )
            for index, label in LABELS.items()
        ]
        entries.sort(key=lambda item: item.probability, reverse=True)

        logger.info(
            "Prediction complete | model=%s report_id=%s top=%s confidence=%.2f%% time=%.1fms",
            model_name,
            report_id,
            entries[0].code,
            entries[0].probability * 100,
            processing_time_ms,
        )

        return PredictionResponse(
            model=model_name,
            report_id=report_id,
            top_prediction=entries[0],
            predictions=entries,
            model_version=MODEL_VERSION,
            processing_time_ms=round(processing_time_ms, 1),
            timestamp=timestamp,
        )


model_service = ModelService()

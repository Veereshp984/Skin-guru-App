from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException, status
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from backend.app.config import MONGODB_DB_NAME, MONGODB_URI


@lru_cache(maxsize=1)
def get_database() -> Database:
    if not MONGODB_URI:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not configured. Set MONGODB_URI for MongoDB Atlas.",
        )

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    database = client[MONGODB_DB_NAME]
    database.command("ping")
    return database


def ensure_indexes() -> None:
    database = get_database()

    # Users collection
    users = database.users
    users.create_index([("email", ASCENDING)], unique=True)
    users.create_index([("google_sub", ASCENDING)], unique=True, sparse=True)
    users.create_index([("role", ASCENDING)])

    # Predictions collection
    predictions = database.predictions
    predictions.create_index([("report_id", ASCENDING)], unique=True)
    predictions.create_index([("user_id", ASCENDING)])
    predictions.create_index([("created_at", DESCENDING)])
    predictions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

    # Reviews collection
    reviews = database.reviews
    reviews.create_index([("review_id", ASCENDING)], unique=True)
    reviews.create_index([("report_id", ASCENDING)])
    reviews.create_index([("patient_id", ASCENDING)])
    reviews.create_index([("doctor_id", ASCENDING)])
    reviews.create_index([("status", ASCENDING)])
    reviews.create_index([("created_at", DESCENDING)])

    # API logs collection
    api_logs = database.api_logs
    api_logs.create_index([("timestamp", DESCENDING)])
    api_logs.create_index([("path", ASCENDING)])
    api_logs.create_index([("user_id", ASCENDING)])


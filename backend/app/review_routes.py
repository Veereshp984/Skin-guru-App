from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING
from pymongo.collection import Collection

from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.db.mongo import get_database
from backend.app.models.user import UserRole
from backend.app.analytics_routes import clear_analytics_cache
from backend.app.schemas import (
    ReviewRequestSchema,
    ReviewResponseSchema,
    ReviewUpdateInputSchema,
    ReviewStatusInputSchema,
)

router = APIRouter(prefix="/api/reviews", tags=["Doctor Reviews"])


def serialize_review(doc: dict) -> dict:
    """Helper to serialize a MongoDB review document to match ReviewResponseSchema."""
    return {
        "review_id": doc["review_id"],
        "report_id": doc["report_id"],
        "patient_id": doc["patient_id"],
        "patient_name": doc.get("patient_name", ""),
        "patient_email": doc.get("patient_email", ""),
        "doctor_id": doc.get("doctor_id"),
        "doctor_name": doc.get("doctor_name"),
        "ai_prediction": doc["ai_prediction"],
        "doctor_diagnosis": doc.get("doctor_diagnosis"),
        "doctor_notes": doc.get("doctor_notes"),
        "recommendations": doc.get("recommendations"),
        "status": doc["status"],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.post("/request", response_model=ReviewResponseSchema, status_code=status.HTTP_201_CREATED)
def request_doctor_review(
    payload: ReviewRequestSchema,
    current_user: dict[str, Any] = Depends(require_roles(UserRole.PATIENT, UserRole.ADMIN)),
):
    db = get_database()
    predictions_coll: Collection = db.predictions
    reviews_coll: Collection = db.reviews

    # 1. Verify report exists
    report = predictions_coll.find_one({"report_id": payload.report_id})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scanned report not found.",
        )

    # 2. Privacy Check: Patients can only request reviews for their own reports
    if current_user["role"] == UserRole.PATIENT.value and report["user_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to request reviews for this report.",
        )

    # 3. Check for existing active review request (prevent duplicates)
    existing_review = reviews_coll.find_one(
        {"report_id": payload.report_id, "status": {"$ne": "rejected"}}
    )
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active doctor review request already exists for this case.",
        )

    # 4. Resolve doctor name if a doctor ID is selected
    doctor_name = None
    doctor_id = None
    if payload.doctor_id:
        from bson import ObjectId
        try:
            doc_user = db.users.find_one({"_id": ObjectId(payload.doctor_id), "role": UserRole.DOCTOR.value})
            if doc_user:
                doctor_id = payload.doctor_id
                doctor_name = doc_user["full_name"]
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected doctor was not found or is invalid.",
                )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid doctor ID format.",
            )

    now = datetime.utcnow()
    review_doc = {
        "review_id": str(uuid.uuid4()),
        "report_id": payload.report_id,
        "patient_id": report["user_id"],
        "patient_name": current_user["full_name"],
        "patient_email": current_user["email"],
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "ai_prediction": {
            "predicted_disease": report["predicted_disease"],
            "predicted_code": report["predicted_code"],
            "confidence": report["confidence"],
        },
        "doctor_diagnosis": None,
        "doctor_notes": None,
        "recommendations": None,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }

    reviews_coll.insert_one(review_doc)

    # 5. Sync state back to predictions collection
    predictions_coll.update_one(
        {"report_id": payload.report_id},
        {
            "$set": {
                "doctor_review_status": "pending",
                "updated_at": now,
            },
            "$push": {
                "audit_trail": {
                    "action": "review_requested",
                    "user_id": str(current_user["_id"]),
                    "user_email": current_user["email"],
                    "timestamp": now,
                    "details": f"Doctor review requested. Assigned: {doctor_name or 'Unassigned'}.",
                }
            },
        },
    )

    clear_analytics_cache()
    return serialize_review(review_doc)


@router.get("/patient", response_model=list[ReviewResponseSchema])
def get_patient_reviews(
    current_user: dict[str, Any] = Depends(require_roles(UserRole.PATIENT, UserRole.ADMIN)),
):
    db = get_database()
    query = {"patient_id": str(current_user["_id"])} if current_user["role"] == UserRole.PATIENT.value else {}
    reviews = db.reviews.find(query).sort("created_at", -1)
    return [serialize_review(r) for r in reviews]


@router.get("/doctor", response_model=list[ReviewResponseSchema])
def get_doctor_reviews(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    current_user: dict[str, Any] = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    db = get_database()
    doc_id = str(current_user["_id"])

    # Doctors can view cases explicitly assigned to them OR unassigned cases (doctor_id is None)
    query: dict[str, Any] = {
        "$or": [
            {"doctor_id": doc_id},
            {"doctor_id": None},
        ]
    }

    if status_filter:
        query["status"] = status_filter

    if q:
        query["$or"] = [
            {"report_id": q},
            {"patient_name": {"$regex": q, "$options": "i"}},
            {"ai_prediction.predicted_disease": {"$regex": q, "$options": "i"}},
        ]

    reviews = db.reviews.find(query).sort("created_at", -1)
    return [serialize_review(r) for r in reviews]


@router.get("/{reviewId}", response_model=ReviewResponseSchema)
def get_review_details(
    reviewId: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    db = get_database()
    review = db.reviews.find_one({"review_id": reviewId})
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation review request not found.",
        )

    # Privacy Check
    is_patient = current_user["role"] == UserRole.PATIENT.value
    is_doctor = current_user["role"] == UserRole.DOCTOR.value

    if is_patient and review["patient_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this review record.",
        )

    # Doctor can view only if assigned or if it is unassigned (so they can claim it)
    if is_doctor and review["doctor_id"] not in [None, str(current_user["_id"])]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This review request is assigned to another consultant.",
        )

    return serialize_review(review)


@router.patch("/{reviewId}", response_model=ReviewResponseSchema)
def submit_or_update_review(
    reviewId: str,
    payload: ReviewUpdateInputSchema,
    current_user: dict[str, Any] = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    db = get_database()
    reviews_coll: Collection = db.reviews
    predictions_coll: Collection = db.predictions

    review = reviews_coll.find_one({"review_id": reviewId})
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review request not found.",
        )

    # Verify doctor is assigned
    doc_id = str(current_user["_id"])
    if review["doctor_id"] != doc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot submit reviews for cases not assigned to you.",
        )

    # Prevent editing finalized reviews
    if review["status"] in ["reviewed"] and payload.status != "accepted":
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="This review has already been finalized and locked.",
         )

    now = datetime.utcnow()
    update_ops = {
        "doctor_diagnosis": payload.doctor_diagnosis,
        "doctor_notes": payload.doctor_notes,
        "recommendations": payload.recommendations,
        "status": payload.status,
        "updated_at": now,
    }

    reviews_coll.update_one({"review_id": reviewId}, {"$set": update_ops})

    # Sync finalized clinical outcome back to the predictions/reports collections
    if payload.status in ["reviewed", "requires_further_examination"]:
        comments = f"Diagnosis: {payload.doctor_diagnosis}\n\nClinical Notes:\n{payload.doctor_notes}\n\nRecommendations:\n{payload.recommendations}"
        
        doctor_review_subdoc = {
            "doctor_id": doc_id,
            "doctor_name": current_user["full_name"],
            "doctor_email": current_user["email"],
            "comments": comments,
            "status": "reviewed" if payload.status == "reviewed" else "requires_consultation",
            "reviewed_at": now,
        }

        predictions_coll.update_one(
            {"report_id": review["report_id"]},
            {
                "$set": {
                    "doctor_review": doctor_review_subdoc,
                    "doctor_review_status": "reviewed" if payload.status == "reviewed" else "requires_consultation",
                    "updated_at": now,
                },
                "$push": {
                    "audit_trail": {
                        "action": "doctor_reviewed",
                        "user_id": doc_id,
                        "user_email": current_user["email"],
                        "timestamp": now,
                        "details": f"Clinician diagnosis submitted: {payload.doctor_diagnosis}. Case marked: {payload.status}.",
                    }
                },
            },
        )

    updated_review = reviews_coll.find_one({"review_id": reviewId})
    clear_analytics_cache()
    return serialize_review(updated_review)


@router.patch("/{reviewId}/status", response_model=ReviewResponseSchema)
def update_review_status(
    reviewId: str,
    payload: ReviewStatusInputSchema,
    current_user: dict[str, Any] = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    db = get_database()
    reviews_coll: Collection = db.reviews
    predictions_coll: Collection = db.predictions

    review = reviews_coll.find_one({"review_id": reviewId})
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review request not found.",
        )

    doc_id = str(current_user["_id"])

    # If claiming/accepting: make sure it is unassigned or assigned to current user
    if payload.status == "accepted":
        if review["doctor_id"] not in [None, doc_id]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This case is already claimed by another consultant.",
            )
        
        now = datetime.utcnow()
        update_ops = {
            "doctor_id": doc_id,
            "doctor_name": current_user["full_name"],
            "status": "accepted",
            "updated_at": now,
        }
        reviews_coll.update_one({"review_id": reviewId}, {"$set": update_ops})

        # Sync prediction status
        predictions_coll.update_one(
            {"report_id": review["report_id"]},
            {
                "$set": {
                    "doctor_review_status": "accepted",
                    "updated_at": now,
                },
                "$push": {
                    "audit_trail": {
                        "action": "review_accepted",
                        "user_id": doc_id,
                        "user_email": current_user["email"],
                        "timestamp": now,
                        "details": f"Case claimed by Dr. {current_user['full_name']}.",
                    }
                },
            },
        )

    elif payload.status == "rejected":
        # Can only reject if assigned to current user
        if review["doctor_id"] != doc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot reject a case not assigned to you.",
            )

        now = datetime.utcnow()
        update_ops = {
            "doctor_id": None,
            "doctor_name": None,
            "status": "rejected",
            "updated_at": now,
        }
        reviews_coll.update_one({"review_id": reviewId}, {"$set": update_ops})

        # Sync prediction status
        predictions_coll.update_one(
            {"report_id": review["report_id"]},
            {
                "$set": {
                    "doctor_review_status": "pending",  # reset to pending for others to claim
                    "updated_at": now,
                },
                "$push": {
                    "audit_trail": {
                        "action": "review_rejected",
                        "user_id": doc_id,
                        "user_email": current_user["email"],
                        "timestamp": now,
                        "details": f"Dr. {current_user['full_name']} rejected/released the case review request.",
                    }
                },
            },
        )

    updated_review = reviews_coll.find_one({"review_id": reviewId})
    clear_analytics_cache()
    return serialize_review(updated_review)


@router.get("/admin/all", response_model=list[ReviewResponseSchema])
def get_all_reviews_admin(
    skip: int = 0,
    limit: int = 20,
    current_user: dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
):
    db = get_database()
    reviews = db.reviews.find().sort("created_at", -1).skip(skip).limit(limit)
    return [serialize_review(r) for r in reviews]


@router.get("/admin/stats")
def get_reviews_stats_admin(
    current_user: dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
):
    db = get_database()
    reviews_coll = db.reviews

    # General review counts
    pipeline_counts = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = list(reviews_coll.aggregate(pipeline_counts))
    stats_dict = {item["_id"]: item["count"] for item in status_counts}

    # Load stats per doctor
    pipeline_workload = [
        {"$match": {"doctor_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$doctor_id",
                "doctor_name": {"$first": "$doctor_name"},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "reviewed"]}, 1, 0]}},
                "pending": {"$sum": {"$cond": [{"$ne": ["$status", "reviewed"]}, 1, 0]}},
            }
        },
    ]
    doctor_workload = list(reviews_coll.aggregate(pipeline_workload))

    return {
        "total_requests": reviews_coll.count_documents({}),
        "pending": stats_dict.get("pending", 0) + stats_dict.get("accepted", 0),
        "completed": stats_dict.get("reviewed", 0) + stats_dict.get("requires_further_examination", 0),
        "rejected": stats_dict.get("rejected", 0),
        "workload": [
            {
                "doctor_id": item["_id"],
                "doctor_name": item["doctor_name"],
                "completed": item["completed"],
                "pending": item["pending"],
            }
            for item in doctor_workload
        ],
    }

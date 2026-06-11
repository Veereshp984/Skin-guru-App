from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.db.mongo import get_database
from backend.app.models.user import UserRole

router = APIRouter(prefix="/api/analytics", tags=["Analytics Dashboard"])


# ── In-Memory Analytics Cache ──────────────────────────────────────────────────
class AnalyticsCache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self.cache: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        if key in self.cache:
            val, expiry = self.cache[key]
            if time.time() < expiry:
                return val
            else:
                del self.cache[key]
        return None

    def set(self, key: str, val: Any) -> None:
        self.cache[key] = (val, time.time() + self.ttl)

    def clear(self) -> None:
        self.cache.clear()


analytics_cache = AnalyticsCache(ttl_seconds=300)


def clear_analytics_cache() -> None:
    """Helper to clear the cached analytics metrics when data changes."""
    analytics_cache.clear()


# ── Helper to Parse Date Filter ──────────────────────────────────────────────
def parse_date_range(start_date: str | None, end_date: str | None) -> dict[str, Any] | None:
    query: dict[str, Any] = {}
    if start_date:
        try:
            if len(start_date) == 10:
                dt_start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            else:
                dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query["$gte"] = dt_start
        except ValueError:
            pass
    if end_date:
        try:
            if len(end_date) == 10:
                dt_end = datetime.strptime(end_date + " 23:59:59.999", "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=timezone.utc)
            else:
                dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query["$lte"] = dt_end
        except ValueError:
            pass
    return query if query else None


# ── 1. Admin Analytics Endpoint ──────────────────────────────────────────────
@router.get("/admin")
def get_admin_analytics(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
):
    cache_key = f"admin:all:{start_date}:{end_date}"
    cached_val = analytics_cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    db = get_database()
    date_filter = parse_date_range(start_date, end_date)

    # Predictions query object
    pred_query: dict[str, Any] = {}
    if date_filter:
        pred_query["created_at"] = date_filter

    # User query object
    user_query: dict[str, Any] = {}
    if date_filter:
        user_query["created_at"] = date_filter

    # Review query object
    review_query: dict[str, Any] = {}
    if date_filter:
        review_query["created_at"] = date_filter

    # 1. Total Registered Users & Role breakdown
    total_users = db.users.count_documents({})
    user_breakdown_cursor = db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ])
    user_breakdown = {item["_id"]: item["count"] for item in user_breakdown_cursor}

    # 2. Total Scans and Reviews
    total_scans = db.predictions.count_documents(pred_query)
    
    # Review breakdown counts
    review_breakdown_cursor = db.reviews.aggregate([
        {"$match": review_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ])
    review_breakdown = {item["_id"]: item["count"] for item in review_breakdown_cursor}
    total_reviews = sum(review_breakdown.values())
    completed_reviews = review_breakdown.get("reviewed", 0) + review_breakdown.get("requires_further_examination", 0)

    # 3. Disease distribution
    disease_pipeline: list[dict[str, Any]] = []
    if date_filter:
        disease_pipeline.append({"$match": {"created_at": date_filter}})
    disease_pipeline.extend([
        {"$group": {"_id": "$predicted_disease", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ])
    disease_dist = [
        {"disease": item["_id"], "count": item["count"]}
        for item in db.predictions.aggregate(disease_pipeline)
    ]

    # 4. Daily Scan Trends
    scan_trends_pipeline: list[dict[str, Any]] = []
    if date_filter:
        scan_trends_pipeline.append({"$match": {"created_at": date_filter}})
    scan_trends_pipeline.extend([
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ])
    scan_trends = [
        {"date": item["_id"], "scans": item["count"]}
        for item in db.predictions.aggregate(scan_trends_pipeline)
    ]

    # 5. Average AI confidence score
    avg_conf_pipeline: list[dict[str, Any]] = []
    if date_filter:
        avg_conf_pipeline.append({"$match": {"created_at": date_filter}})
    avg_conf_pipeline.append({"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}}})
    avg_conf_res = list(db.predictions.aggregate(avg_conf_pipeline))
    avg_confidence = avg_conf_res[0]["avg_confidence"] if avg_conf_res else 0.0

    # 6. AI model stats and versions
    model_pipeline: list[dict[str, Any]] = []
    if date_filter:
        model_pipeline.append({"$match": {"created_at": date_filter}})
    model_pipeline.append({"$group": {"_id": "$model_name", "count": {"$sum": 1}}})
    model_stats = {item["_id"]: item["count"] for item in db.predictions.aggregate(model_pipeline)}

    version_pipeline: list[dict[str, Any]] = []
    if date_filter:
        version_pipeline.append({"$match": {"created_at": date_filter}})
    version_pipeline.append({"$group": {"_id": "$model_version", "count": {"$sum": 1}}})
    version_stats = {item["_id"]: item["count"] for item in db.predictions.aggregate(version_pipeline)}

    # 7. Active users over time
    active_users_pipeline: list[dict[str, Any]] = []
    if date_filter:
        active_users_pipeline.append({"$match": {"created_at": date_filter}})
    active_users_pipeline.extend([
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "user_id": "$user_id"
            }
        }},
        {"$group": {
            "_id": "$_id.date",
            "active_users": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ])
    active_users_trends = [
        {"date": item["_id"], "active_users": item["active_users"]}
        for item in db.predictions.aggregate(active_users_pipeline)
    ]

    # 8. New user registrations over time
    reg_pipeline: list[dict[str, Any]] = []
    if date_filter:
        reg_pipeline.append({"$match": {"created_at": date_filter}})
    reg_pipeline.extend([
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ])
    new_users_trends = [
        {"date": item["_id"], "new_users": item["count"]}
        for item in db.users.aggregate(reg_pipeline)
    ]

    # 9. Peak scanning hours and days (day of week: 1-7 where 1=Sunday)
    hour_pipeline: list[dict[str, Any]] = []
    if date_filter:
        hour_pipeline.append({"$match": {"created_at": date_filter}})
    hour_pipeline.extend([
        {"$project": {"hour": {"$hour": "$created_at"}}},
        {"$group": {"_id": "$hour", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ])
    peak_hours = [
        {"hour": item["_id"], "scans": item["count"]}
        for item in db.predictions.aggregate(hour_pipeline)
    ]

    day_pipeline: list[dict[str, Any]] = []
    if date_filter:
        day_pipeline.append({"$match": {"created_at": date_filter}})
    day_pipeline.extend([
        {"$project": {"day": {"$dayOfWeek": "$created_at"}}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ])
    # Mapping day number to day names
    day_names = {1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat"}
    peak_days = [
        {"day": day_names.get(item["_id"], str(item["_id"])), "scans": item["count"]}
        for item in db.predictions.aggregate(day_pipeline)
    ]

    # 10. Avg doctor response time (turnaround in hours)
    turnaround_pipeline: list[dict[str, Any]] = [
        {"$match": {
            "status": "reviewed",
            "doctor_id": {"$ne": None}
        }}
    ]
    if date_filter:
        turnaround_pipeline[0]["$match"]["created_at"] = date_filter
    
    turnaround_pipeline.extend([
        {"$project": {
            "duration_hours": {
                "$divide": [{"$subtract": ["$updated_at", "$created_at"]}, 1000 * 60 * 60]
            }
        }},
        {"$group": {
            "_id": None,
            "avg_turnaround_hours": {"$avg": "$duration_hours"}
        }}
    ])
    turnaround_res = list(db.reviews.aggregate(turnaround_pipeline))
    avg_turnaround_hours = turnaround_res[0]["avg_turnaround_hours"] if turnaround_res else 0.0

    # 11. System health and API success rates from log collection
    api_log_query: dict[str, Any] = {}
    if date_filter:
        api_log_query["timestamp"] = date_filter

    logs_pipeline: list[dict[str, Any]] = []
    if api_log_query:
        logs_pipeline.append({"$match": api_log_query})
    logs_pipeline.extend([
        {"$group": {
            "_id": None,
            "total_hits": {"$sum": 1},
            "success_hits": {"$sum": {"$cond": [{"$lt": ["$status_code", 400]}, 1, 0]}},
            "avg_latency_ms": {"$avg": "$duration_ms"}
        }}
    ])
    logs_res = list(db.api_logs.aggregate(logs_pipeline))
    if logs_res:
        api_success_rate = (logs_res[0]["success_hits"] / logs_res[0]["total_hits"] * 100) if logs_res[0]["total_hits"] > 0 else 100.0
        avg_latency = logs_res[0]["avg_latency_ms"]
        total_api_calls = logs_res[0]["total_hits"]
    else:
        api_success_rate = 100.0
        avg_latency = 0.0
        total_api_calls = 0

    # Success/failure of predictions
    predict_logs_query = {"path": {"$regex": "^/api/predict"}}
    if date_filter:
        predict_logs_query["timestamp"] = date_filter
    predict_logs_pipeline = [
        {"$match": predict_logs_query},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "success": {"$sum": {"$cond": [{"$lt": ["$status_code", 400]}, 1, 0]}}
        }}
    ]
    predict_res = list(db.api_logs.aggregate(predict_logs_pipeline))
    if predict_res:
        prediction_success_rate = (predict_res[0]["success"] / predict_res[0]["total"] * 100) if predict_res[0]["total"] > 0 else 100.0
        total_prediction_calls = predict_res[0]["total"]
    else:
        prediction_success_rate = 100.0
        total_prediction_calls = 0

    result = {
        "summary": {
            "total_users": total_users,
            "patients": user_breakdown.get(UserRole.PATIENT.value, 0),
            "doctors": user_breakdown.get(UserRole.DOCTOR.value, 0),
            "admins": user_breakdown.get(UserRole.ADMIN.value, 0),
            "total_scans": total_scans,
            "total_reviews": total_reviews,
            "completed_reviews": completed_reviews,
            "pending_reviews": total_reviews - completed_reviews,
            "average_confidence": avg_confidence,
            "review_completion_rate": (completed_reviews / total_reviews * 100) if total_reviews > 0 else 100.0,
            "average_doctor_response_time_hours": avg_turnaround_hours,
        },
        "disease_distribution": disease_dist,
        "scan_trends": scan_trends,
        "model_usage": [
            {"model": k, "count": v} for k, v in model_stats.items()
        ],
        "model_versions": [
            {"version": k, "count": v} for k, v in version_stats.items()
        ],
        "active_users_trends": active_users_trends,
        "new_users_trends": new_users_trends,
        "peak_hours": peak_hours,
        "peak_days": peak_days,
        "system_health": {
            "total_api_calls": total_api_calls,
            "api_success_rate": api_success_rate,
            "avg_latency_ms": avg_latency,
            "total_prediction_calls": total_prediction_calls,
            "prediction_success_rate": prediction_success_rate,
        }
    }

    analytics_cache.set(cache_key, result)
    return result


# ── 2. Doctor Analytics Endpoint ─────────────────────────────────────────────
@router.get("/doctor")
def get_doctor_analytics(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(require_roles(UserRole.DOCTOR)),
):
    doctor_id = str(current_user["_id"])
    cache_key = f"doctor:{doctor_id}:{start_date}:{end_date}"
    cached_val = analytics_cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    db = get_database()
    date_filter = parse_date_range(start_date, end_date)

    # Reviews base query
    base_query: dict[str, Any] = {"doctor_id": doctor_id}
    if date_filter:
        base_query["created_at"] = date_filter

    total_assigned = db.reviews.count_documents(base_query)
    
    pending_query = {**base_query, "status": "accepted"}
    pending_reviews = db.reviews.count_documents(pending_query)
    
    completed_query = {**base_query, "status": {"$in": ["reviewed", "requires_further_examination"]}}
    completed_reviews = db.reviews.count_documents(completed_query)

    # Average turnaround time
    turnaround_pipeline = [
        {"$match": completed_query},
        {"$project": {
            "duration_hours": {
                "$divide": [{"$subtract": ["$updated_at", "$created_at"]}, 1000 * 60 * 60]
            }
        }},
        {"$group": {
            "_id": None,
            "avg_turnaround_hours": {"$avg": "$duration_hours"}
        }}
    ]
    turnaround_res = list(db.reviews.aggregate(turnaround_pipeline))
    avg_turnaround_hours = turnaround_res[0]["avg_turnaround_hours"] if turnaround_res else 0.0

    # Frequently encountered conditions
    diseases_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$ai_prediction.predicted_disease", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    frequent_conditions = [
        {"disease": item["_id"], "count": item["count"]}
        for item in db.reviews.aggregate(diseases_pipeline)
    ]

    # Monthly review activity
    activity_pipeline = [
        {"$match": completed_query},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$updated_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    monthly_activity = [
        {"month": item["_id"], "completed": item["count"]}
        for item in db.reviews.aggregate(activity_pipeline)
    ]

    # Unique patients interacted with
    patients_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$patient_id"}},
        {"$group": {"_id": None, "count": {"$sum": 1}}}
    ]
    patients_res = list(db.reviews.aggregate(patients_pipeline))
    unique_patients = patients_res[0]["count"] if patients_res else 0

    result = {
        "summary": {
            "total_assigned": total_assigned,
            "pending_reviews": pending_reviews,
            "completed_reviews": completed_reviews,
            "average_turnaround_hours": avg_turnaround_hours,
            "unique_patients_assisted": unique_patients
        },
        "frequent_conditions": frequent_conditions,
        "monthly_activity": monthly_activity
    }

    analytics_cache.set(cache_key, result)
    return result


# ── 3. Patient Analytics Endpoint ─────────────────────────────────────────────
@router.get("/patient")
def get_patient_analytics(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(require_roles(UserRole.PATIENT)),
):
    patient_id = str(current_user["_id"])
    cache_key = f"patient:{patient_id}:{start_date}:{end_date}"
    cached_val = analytics_cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    db = get_database()
    date_filter = parse_date_range(start_date, end_date)

    base_query: dict[str, Any] = {"user_id": patient_id}
    if date_filter:
        base_query["created_at"] = date_filter

    total_scans = db.predictions.count_documents(base_query)

    # Scans timeline
    timeline_cursor = db.predictions.find(base_query).sort("created_at", 1)
    scan_timeline = [
        {
            "report_id": item["report_id"],
            "date": item["created_at"].strftime("%Y-%m-%d"),
            "disease": item["predicted_disease"],
            "confidence": item["confidence"],
            "review_status": item.get("doctor_review_status", "pending")
        }
        for item in timeline_cursor
    ]

    # Most common predictions
    diseases_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$predicted_disease", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    common_predictions = [
        {"disease": item["_id"], "count": item["count"]}
        for item in db.predictions.aggregate(diseases_pipeline)
    ]

    # Monthly scanning activity
    activity_pipeline = [
        {"$match": base_query},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    monthly_activity = [
        {"month": item["_id"], "scans": item["count"]}
        for item in db.predictions.aggregate(activity_pipeline)
    ]

    # Confidence score trends
    confidence_trends = [
        {"date": item["date"], "confidence": item["confidence"]}
        for item in scan_timeline
    ]

    # Generate patient dynamic insights
    avg_confidence = sum(item["confidence"] for item in scan_timeline) / len(scan_timeline) if scan_timeline else 0.0
    reviewed_scans = sum(1 for item in scan_timeline if item["review_status"] in ["reviewed", "requires_consultation"])
    
    insights = []
    if total_scans == 0:
        insights.append("You have not recorded any skin scans yet. Use the scanner to begin monitoring your skin health.")
    else:
        insights.append(f"You have recorded {total_scans} personal scans in total.")
        if avg_confidence > 0:
            insights.append(f"Your scans show an average AI prediction confidence score of {avg_confidence * 100:.1f}%.")
        
        if common_predictions:
            top_pred = common_predictions[0]["disease"]
            insights.append(f"The most common prediction returned for your scans is '{top_pred}'.")

        if reviewed_scans > 0:
            insights.append(f"A medical consultant has reviewed {reviewed_scans} of your scan reports, providing clinical oversight.")
        elif total_scans > 2:
            insights.append("You have several scans pending medical consultation. Consider requesting a doctor review for professional guidance.")

    result = {
        "summary": {
            "total_scans": total_scans,
            "average_confidence": avg_confidence,
            "reviewed_scans": reviewed_scans,
            "pending_reviews": total_scans - reviewed_scans
        },
        "scan_timeline": scan_timeline,
        "common_predictions": common_predictions,
        "confidence_trends": confidence_trends,
        "monthly_activity": monthly_activity,
        "insights": insights
    }

    analytics_cache.set(cache_key, result)
    return result


# ── 4. General Diseases Analytics Endpoint ──────────────────────────────────
@router.get("/diseases")
def get_diseases_analytics(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    # Available for all authenticated roles
    cache_key = f"diseases:general:{start_date}:{end_date}"
    cached_val = analytics_cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    db = get_database()
    date_filter = parse_date_range(start_date, end_date)

    match_stage = {}
    if date_filter:
        match_stage["created_at"] = date_filter

    # If the user is a patient, they can only view their own disease analytics
    if current_user["role"] == UserRole.PATIENT.value:
        match_stage["user_id"] = str(current_user["_id"])

    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})
    pipeline.extend([
        {"$group": {"_id": "$predicted_disease", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ])

    result = [
        {"disease": item["_id"], "count": item["count"]}
        for item in db.predictions.aggregate(pipeline)
    ]

    analytics_cache.set(cache_key, result)
    return result


# ── 5. General Trends Analytics Endpoint ─────────────────────────────────────
@router.get("/trends")
def get_trends_analytics(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    # Available for all authenticated roles
    cache_key = f"trends:general:{start_date}:{end_date}"
    cached_val = analytics_cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    db = get_database()
    date_filter = parse_date_range(start_date, end_date)

    match_predictions = {}
    match_reviews = {}

    if date_filter:
        match_predictions["created_at"] = date_filter
        match_reviews["created_at"] = date_filter

    # If patient, restrict to their own records
    if current_user["role"] == UserRole.PATIENT.value:
        match_predictions["user_id"] = str(current_user["_id"])
        match_reviews["patient_id"] = str(current_user["_id"])

    # Predictions (Scans) over time
    pred_pipeline = []
    if match_predictions:
        pred_pipeline.append({"$match": match_predictions})
    pred_pipeline.extend([
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "scans": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ])
    scans_data = {item["_id"]: item["scans"] for item in db.predictions.aggregate(pred_pipeline)}

    # Completed doctor reviews over time
    match_reviews["status"] = {"$in": ["reviewed", "requires_further_examination"]}
    rev_pipeline = []
    if match_reviews:
        rev_pipeline.append({"$match": match_reviews})
    rev_pipeline.extend([
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$updated_at"}},
            "reviews": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ])
    reviews_data = {item["_id"]: item["reviews"] for item in db.reviews.aggregate(rev_pipeline)}

    # Merge dates
    all_dates = sorted(list(set(scans_data.keys()) | set(reviews_data.keys())))
    merged_trends = [
        {
            "date": dt,
            "scans": scans_data.get(dt, 0),
            "reviews": reviews_data.get(dt, 0)
        }
        for dt in all_dates
    ]

    analytics_cache.set(cache_key, merged_trends)
    return merged_trends

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from bson import ObjectId


class UserRole(str, Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "role": user.get("role", UserRole.PATIENT.value),
        "avatar_url": user.get("avatar_url"),
        "phone": user.get("phone"),
        "bio": user.get("bio"),
        "provider": user.get("provider", "local"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


def object_id(user_id: str) -> ObjectId:
    if not ObjectId.is_valid(user_id):
        raise ValueError("Invalid user id.")
    return ObjectId(user_id)

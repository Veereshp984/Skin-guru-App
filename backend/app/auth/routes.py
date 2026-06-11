from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pymongo.errors import DuplicateKeyError

from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from backend.app.config import COOKIE_SECURE, GOOGLE_CLIENT_ID, REFRESH_TOKEN_EXPIRE_DAYS
from backend.app.db.mongo import get_database
from backend.app.models.user import UserRole, object_id, public_user, utc_now
from backend.app.schemas import (
    AuthResponse,
    GoogleLoginRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    UserProfile,
)

router = APIRouter(prefix="/api", tags=["Authentication"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key="refresh_token", path="/api/auth")


def _issue_tokens(response: Response, user: dict[str, Any]) -> AuthResponse:
    database = get_database()
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    database.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "refresh_token_hash": hash_refresh_token(refresh_token),
                "last_login_at": utc_now(),
                "updated_at": utc_now(),
            }
        },
    )
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=UserProfile(**public_user(user)))


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response) -> AuthResponse:
    if payload.role == UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin users cannot be created through public registration.",
        )

    now = utc_now()
    user = {
        "email": _normalize_email(payload.email),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name.strip(),
        "role": payload.role,
        "provider": "local",
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = get_database().users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    user["_id"] = result.inserted_id
    return _issue_tokens(response, user)


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response) -> AuthResponse:
    user = get_database().users.find_one({"email": _normalize_email(payload.email)})
    if not user or not verify_password(payload.password, user.get("password_hash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return _issue_tokens(response, user)


@router.post("/auth/google", response_model=AuthResponse)
def google_login(payload: GoogleLoginRequest, response: Response) -> AuthResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID.",
        )
    if payload.role == UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin users cannot be created through Google login.",
        )

    try:
        google_profile = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential.",
        ) from exc

    email = _normalize_email(google_profile["email"])
    database = get_database()
    user = database.users.find_one({"email": email})
    now = utc_now()

    if user:
        database.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "google_sub": google_profile["sub"],
                    "avatar_url": google_profile.get("picture"),
                    "updated_at": now,
                }
            },
        )
        user.update(
            {
                "google_sub": google_profile["sub"],
                "avatar_url": google_profile.get("picture"),
                "updated_at": now,
            }
        )
    else:
        user = {
            "email": email,
            "full_name": google_profile.get("name") or email.split("@")[0],
            "role": payload.role,
            "provider": "google",
            "google_sub": google_profile["sub"],
            "avatar_url": google_profile.get("picture"),
            "created_at": now,
            "updated_at": now,
        }
        result = database.users.insert_one(user)
        user["_id"] = result.inserted_id

    return _issue_tokens(response, user)


@router.post("/auth/refresh", response_model=AuthResponse)
def refresh_access_token(
    response: Response,
    payload: RefreshRequest | None = None,
    refresh_token: str | None = Cookie(default=None),
) -> AuthResponse:
    token = refresh_token or (payload.refresh_token if payload else None)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing.",
        )

    decoded = decode_token(token, expected_type="refresh")
    user = get_database().users.find_one({"_id": object_id(decoded["sub"])})
    if not user or user.get("refresh_token_hash") != hash_refresh_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked.",
        )
    return _issue_tokens(response, user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    get_database().users.update_one(
        {"_id": user["_id"]},
        {"$unset": {"refresh_token_hash": ""}, "$set": {"updated_at": utc_now()}},
    )
    _clear_refresh_cookie(response)
    return response


@router.get("/auth/me", response_model=UserProfile)
def read_me(user: dict[str, Any] = Depends(get_current_user)) -> UserProfile:
    return UserProfile(**public_user(user))


@router.patch("/profile", response_model=UserProfile)
def update_profile(
    payload: ProfileUpdateRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> UserProfile:
    updates = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in payload.model_dump(exclude_unset=True).items()
    }
    updates["updated_at"] = datetime.now(timezone.utc)

    get_database().users.update_one({"_id": user["_id"]}, {"$set": updates})
    user.update(updates)
    return UserProfile(**public_user(user))


@router.get("/patient/dashboard")
def patient_dashboard(
    user: dict[str, Any] = Depends(require_roles(UserRole.PATIENT, UserRole.ADMIN)),
) -> dict[str, str]:
    return {"message": f"Welcome {user['full_name']}. Patient resources are available."}


@router.get("/doctor/dashboard")
def doctor_dashboard(
    user: dict[str, Any] = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
) -> dict[str, str]:
    return {"message": f"Welcome Dr. {user['full_name']}. Doctor resources are available."}


@router.get("/admin/dashboard")
def admin_dashboard(
    user: dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return {"message": f"Welcome {user['full_name']}. Admin resources are available."}


@router.get("/admin/users", response_model=list[UserProfile])
def list_users(
    _: dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> list[UserProfile]:
    return [UserProfile(**public_user(user)) for user in get_database().users.find().sort("created_at", -1)]

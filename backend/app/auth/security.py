from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import bcrypt
import jwt
from fastapi import HTTPException, status

from backend.app.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_REFRESH_SECRET_KEY,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _encode_token(
    *,
    user_id: str,
    email: str,
    role: str,
    expires_delta: timedelta,
    token_type: str,
    secret: str,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if token_type == "refresh":
        payload["jti"] = str(uuid4())
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def create_access_token(user: dict[str, Any]) -> str:
    return _encode_token(
        user_id=str(user["_id"]),
        email=user["email"],
        role=user["role"],
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
        secret=JWT_SECRET_KEY,
    )


def create_refresh_token(user: dict[str, Any]) -> str:
    return _encode_token(
        user_id=str(user["_id"]),
        email=user["email"],
        role=user["role"],
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
        secret=JWT_REFRESH_SECRET_KEY,
    )


def decode_token(token: str, *, expected_type: str) -> dict[str, Any]:
    secret = JWT_SECRET_KEY if expected_type == "access" else JWT_REFRESH_SECRET_KEY
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )
    return payload

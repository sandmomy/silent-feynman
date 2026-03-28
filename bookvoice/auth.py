from __future__ import annotations

import base64
import hashlib
import hmac
import time

from fastapi import Request, Response

from .settings import AppSettings


SESSION_COOKIE_NAME = "bookvoice_session"


def build_session_token(*, username: str, role: str, secret: str, session_hours: int) -> str:
    expires_at = int(time.time() + max(1, session_hours) * 3600)
    payload = f"{username}:{role}:{expires_at}"
    signature = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(token.encode("utf-8")).decode("utf-8")


def get_session(request: Request, settings: AppSettings) -> dict | None:
    if not settings.auth_enabled:
        return {"authenticated": True, "username": settings.admin_username, "role": "admin"}

    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None

    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        username, role, expires_raw, signature = decoded.split(":", 3)
        expires_at = int(expires_raw)
    except Exception:
        return None

    payload = f"{username}:{role}:{expires_at}"
    expected_signature = hmac.new(
        settings.resolved_session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        return None
    if expires_at < int(time.time()):
        return None
    return {"authenticated": True, "username": username, "role": role}


def is_authenticated(request: Request, settings: AppSettings) -> bool:
    return get_session(request, settings) is not None


def has_role(request: Request, settings: AppSettings, role: str) -> bool:
    session = get_session(request, settings)
    if not session:
        return False
    return session.get("role") == role


def auth_status_payload(request: Request, settings: AppSettings) -> dict:
    session = get_session(request, settings)
    return {
        "login_enabled": settings.auth_enabled,
        "register_enabled": settings.self_signup_enabled,
        "google_enabled": settings.google_auth_enabled,
        "authenticated": bool(session),
        "username": session.get("username") if session else None,
        "role": session.get("role") if session else None,
    }


def set_auth_cookie(response: Response, settings: AppSettings, *, username: str, role: str) -> None:
    token = build_session_token(
        username=username,
        role=role,
        secret=settings.resolved_session_secret,
        session_hours=settings.session_hours,
    )
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=max(1, settings.session_hours) * 3600,
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, httponly=True, samesite="lax")

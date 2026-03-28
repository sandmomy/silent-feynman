from __future__ import annotations

from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth import auth_status_payload, clear_auth_cookie, get_session, set_auth_cookie
from .jobs import NarrationJobManager
from .settings import settings
from .storage import LibraryStore


store = LibraryStore(settings)
store.mark_incomplete_jobs_as_failed()
store.seed_local_documents()
store.ensure_demo_customer()
job_manager = NarrationJobManager(store, settings)
job_manager.start()

app = FastAPI(title="BookVoice Library", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def session_or_401(request: Request) -> dict:
    session = get_session(request, settings)
    if not session:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return session


def require_admin_access(request: Request) -> dict:
    session = session_or_401(request)
    if session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only Eugene can access this area.")
    return session


def require_customer_access(request: Request) -> dict:
    session = session_or_401(request)
    if session.get("role") not in {"customer", "admin"}:
        raise HTTPException(status_code=403, detail="A reader account is required.")
    return session


class CreateNarrationRequest(BaseModel):
    engine: str = Field(default="mock_preview")
    voice_profile_id: str | None = None
    sample_mode: str | None = Field(default=None, pattern="^(raw_single|clean_single|clean_multi)$")
    render_scope: str = Field(default="demo_excerpt", pattern="^(demo_excerpt|chapter_1|full_book)$")
    language: str = Field(default="en")
    chunk_size: int = Field(default=2200, ge=600, le=6000)
    demo_chars: int = Field(default=1200, ge=400, le=4000)
    speed: float = Field(default=1.0, ge=0.6, le=1.4)


class UpdatePublicProfileRequest(BaseModel):
    hook: str = Field(default="", max_length=120)
    summary: str = Field(default="", max_length=600)
    price_label: str = Field(default="", max_length=80)
    cta_label: str = Field(default="Escuchar y leer", max_length=60)
    cta_url: str = Field(default="", max_length=500)
    featured: bool = False


class LoginRequest(BaseModel):
    username: str = Field(default="", max_length=80)
    password: str = Field(default="", max_length=200)


class RegisterRequest(BaseModel):
    display_name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=160)
    password: str = Field(default="", max_length=200)


class CreateCustomerUserRequest(BaseModel):
    username: str = Field(..., max_length=80)
    password: str = Field(..., max_length=200)
    display_name: str = Field(default="", max_length=120)


class CompareVoiceRequest(BaseModel):
    book_id: str | None = None
    language: str = Field(default="en", max_length=10)


class PreferredPresetRequest(BaseModel):
    preset: str = Field(pattern="^(raw_single|clean_single|clean_multi)$")


def customer_user_payload(user: dict) -> dict:
    return {
        "username": user.get("username"),
        "display_name": user.get("display_name") or user.get("username"),
        "email": user.get("email", ""),
        "book_ids": user.get("book_ids", []),
        "created_at": user.get("created_at"),
        "role": "customer",
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/session/status")
@app.get("/api/auth/status")
def session_status(request: Request) -> dict:
    status = auth_status_payload(request, settings)
    if status.get("role") == "customer" and status.get("username"):
        try:
            user = store.get_customer_user(status["username"])
            status["display_name"] = user.get("display_name") or user.get("username")
        except KeyError:
            status["display_name"] = status["username"]
    return status


@app.post("/api/session/login")
@app.post("/api/auth/login")
def session_login(payload: LoginRequest, response: Response) -> dict:
    if payload.username == settings.admin_username and payload.password == settings.admin_password:
        set_auth_cookie(response, settings, username=settings.admin_username, role="admin")
        return {
            "login_enabled": True,
            "register_enabled": settings.self_signup_enabled,
            "google_enabled": settings.google_auth_enabled,
            "authenticated": True,
            "username": settings.admin_username,
            "display_name": settings.admin_username,
            "role": "admin",
        }

    # Keep demo storefront accounts deterministic even if a prior local demo
    # purchase changed their state during the session.
    if payload.username in {
        settings.demo_customer_username,
        settings.demo_owned_customer_username,
    }:
        store.ensure_demo_customer()

    user = store.authenticate_customer_user(payload.username, payload.password)
    if user:
        set_auth_cookie(response, settings, username=user["username"], role="customer")
        return {
            "login_enabled": True,
            "register_enabled": settings.self_signup_enabled,
            "google_enabled": settings.google_auth_enabled,
            "authenticated": True,
            "username": user["username"],
            "display_name": user.get("display_name") or user["username"],
            "role": "customer",
        }

    raise HTTPException(status_code=401, detail="Incorrect credentials.")


@app.post("/api/session/register")
@app.post("/api/auth/register")
def session_register(payload: RegisterRequest, response: Response) -> dict:
    if not settings.self_signup_enabled:
        raise HTTPException(status_code=403, detail="Registration is not enabled right now.")
    try:
        user = store.register_customer_user(
            display_name=payload.display_name,
            email=payload.email,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    set_auth_cookie(response, settings, username=user["username"], role="customer")
    return {
        "login_enabled": True,
        "register_enabled": settings.self_signup_enabled,
        "google_enabled": settings.google_auth_enabled,
        "authenticated": True,
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "role": "customer",
        "hint_username": settings.admin_username,
    }


@app.post("/api/session/logout")
@app.post("/api/auth/logout")
def session_logout(response: Response) -> dict:
    clear_auth_cookie(response)
    return {
        "login_enabled": settings.auth_enabled,
        "register_enabled": settings.self_signup_enabled,
        "google_enabled": settings.google_auth_enabled,
        "authenticated": False,
        "username": None,
        "display_name": None,
        "role": None,
        "hint_username": settings.admin_username,
    }


@app.get("/api/meta")
def meta() -> dict:
    return {
        "app_name": "BookVoice Library",
        "data_dir": str(settings.data_dir),
        "books_count": len(store.list_books()),
        "published_books_count": len(store.list_books(published_only=True)),
        "voice_profiles_count": len(store.list_voice_profiles()),
        "jobs_count": len(store.list_jobs()),
        "customer_users_count": len(store.list_customer_users()),
    }


@app.get("/api/customer/catalog")
def customer_catalog(request: Request) -> list[dict]:
    session = get_session(request, settings)
    username = session.get("username") if session and session.get("role") == "customer" else None
    return store.list_customer_catalog(username=username)


@app.get("/api/customer/library")
def customer_library(session: dict = Depends(require_customer_access)) -> list[dict]:
    if session.get("role") == "admin":
        return []
    return [book for book in store.list_customer_catalog(username=session["username"]) if book.get("has_access")]


@app.get("/api/customer/books/{slug}")
def customer_book_detail(slug: str, request: Request) -> dict:
    session = get_session(request, settings)
    username = session.get("username") if session and session.get("role") == "customer" else None
    try:
        return store.get_customer_book_by_slug(slug, username=username)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/customer/books/{slug}/purchase")
def customer_book_purchase(slug: str, session: dict = Depends(require_customer_access)) -> dict:
    if session.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Only reader accounts can buy books from this shelf.")
    try:
        book = store.get_published_book_by_slug(slug)
        store.grant_book_access(session["username"], book["book_id"])
        return store.get_customer_book_by_slug(slug, username=session["username"])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/customer/books/{slug}/text", response_class=PlainTextResponse)
def customer_book_text(slug: str, session: dict = Depends(require_customer_access)) -> str:
    if session.get("role") == "admin":
        return store.get_published_book_text_by_slug(slug)
    try:
        return store.get_customer_book_text_by_slug(slug, session["username"])
    except KeyError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@app.get("/api/customer/books/{slug}/audio")
def customer_book_audio(slug: str, session: dict = Depends(require_customer_access)) -> FileResponse:
    try:
        if session.get("role") == "admin":
            audio_path = store.get_published_audio_path_by_slug(slug)
        else:
            audio_path = store.get_customer_audio_path_by_slug(slug, session["username"])
    except KeyError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return FileResponse(audio_path)


@app.get("/api/customer/books/{slug}/pdf")
def customer_book_pdf(slug: str, session: dict = Depends(require_customer_access)) -> FileResponse:
    try:
        if session.get("role") == "admin":
            pdf_path = store.get_published_pdf_path_by_slug(slug)
        else:
            pdf_path = store.get_customer_pdf_path_by_slug(slug, session["username"])
    except KeyError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return FileResponse(pdf_path, media_type="application/pdf")


@app.get("/api/customer/books/{slug}/slides")
def customer_book_slides(slug: str, session: dict = Depends(require_customer_access)) -> FileResponse:
    """Serve the visual slides PDF (NotebookLM) if it exists."""
    try:
        if session.get("role") == "admin":
            book = store.get_published_book_by_slug(slug)
        else:
            book_obj = store.get_published_book_by_slug(slug)
            if not store.customer_has_book_access(session["username"], book_obj["book_id"]):
                raise KeyError("Not unlocked")
            book = book_obj
    except KeyError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    slides_path = store.settings.books_dir / book["book_id"] / "source" / "slides.pdf"
    if not slides_path.exists():
        raise HTTPException(status_code=404, detail="No slides available")
    return FileResponse(slides_path, media_type="application/pdf")


@app.get("/api/admin/books")
def admin_books(_: dict = Depends(require_admin_access)) -> list[dict]:
    return store.list_books()


@app.get("/api/admin/users")
def admin_users(_: dict = Depends(require_admin_access)) -> list[dict]:
    return [customer_user_payload(user) for user in store.list_customer_users()]


@app.post("/api/admin/users")
def admin_create_user(payload: CreateCustomerUserRequest, _: dict = Depends(require_admin_access)) -> dict:
    try:
        user = store.create_customer_user(
            username=payload.username,
            password=payload.password,
            display_name=payload.display_name,
        )
        return customer_user_payload(user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin/users/{username}/grants/{book_id}")
def admin_grant_access(username: str, book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return customer_user_payload(store.grant_book_access(username, book_id))
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/admin/users/{username}/grants/{book_id}")
def admin_revoke_access(username: str, book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return customer_user_payload(store.revoke_book_access(username, book_id))
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin/books/{book_id}/publish")
def admin_publish_book(book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return store.publish_book(book_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin/books/{book_id}/unpublish")
def admin_unpublish_book(book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return store.unpublish_book(book_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.patch("/api/admin/books/{book_id}/public-profile")
def admin_update_public_profile(
    book_id: str,
    request: UpdatePublicProfileRequest,
    _: dict = Depends(require_admin_access),
) -> dict:
    try:
        return store.update_public_profile(book_id, request.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/public/books/{slug}")
def get_published_book_by_slug(slug: str) -> dict:
    try:
        return store.get_published_book_by_slug(slug)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/public/books/{slug}/text", response_class=PlainTextResponse)
def get_published_book_text_by_slug(slug: str) -> str:
    try:
        return store.get_published_book_text_by_slug(slug)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# Legacy and machine endpoints
@app.get("/api/engines")
def list_engines(_: dict = Depends(require_admin_access)) -> list[dict]:
    return job_manager.list_engine_descriptors()


@app.get("/api/books")
def list_books(_: dict = Depends(require_admin_access)) -> list[dict]:
    return store.list_books()


@app.get("/api/published-books")
def list_published_books() -> list[dict]:
    return store.list_books(published_only=True)


@app.post("/api/books/import-local")
def import_local_books(_: dict = Depends(require_admin_access)) -> dict:
    try:
        imported = store.seed_local_documents()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"imported_count": len(imported), "books": imported}


@app.post("/api/books/upload")
async def upload_book(file: UploadFile = File(...), _: dict = Depends(require_admin_access)) -> dict:
    try:
        content = await file.read()
        return store.import_uploaded_book(file.filename or "uploaded.txt", content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/books/{book_id}")
def get_book(book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return store.get_book(book_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/books/{book_id}/publish")
def publish_book(book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    return admin_publish_book(book_id, _)


@app.post("/api/books/{book_id}/unpublish")
def unpublish_book(book_id: str, _: dict = Depends(require_admin_access)) -> dict:
    return admin_unpublish_book(book_id, _)


@app.patch("/api/books/{book_id}/public-profile")
def update_public_profile(
    book_id: str,
    request: UpdatePublicProfileRequest,
    _: dict = Depends(require_admin_access),
) -> dict:
    return admin_update_public_profile(book_id, request, _)


@app.get("/api/books/{book_id}/text", response_class=PlainTextResponse)
def get_book_text(book_id: str, _: dict = Depends(require_admin_access)) -> str:
    try:
        return store.get_book_text(book_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/voice-profiles")
def list_voice_profiles(_: dict = Depends(require_admin_access)) -> list[dict]:
    return store.list_voice_profiles()


@app.post("/api/voice-profiles")
async def create_voice_profile(
    label: str = Form(...),
    notes: str = Form(""),
    language: str = Form("en"),
    sample: UploadFile | None = File(default=None),
    samples: list[UploadFile] | None = File(default=None),
    _: dict = Depends(require_admin_access),
) -> dict:
    try:
        uploads: list[UploadFile] = []
        if sample is not None:
            uploads.append(sample)
        uploads.extend(samples or [])
        if not uploads:
            raise ValueError("Upload at least one voice sample.")
        prepared_samples = []
        for uploaded in uploads:
            prepared_samples.append(
                {
                    "name": uploaded.filename or "sample.wav",
                    "content": await uploaded.read(),
                }
            )
        return store.create_voice_profile(
            label=label,
            notes=notes,
            language=language,
            samples=prepared_samples,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/voice-profiles/{voice_profile_id}/compare")
def compare_voice_profile(
    voice_profile_id: str,
    request: CompareVoiceRequest,
    _: dict = Depends(require_admin_access),
) -> dict:
    try:
        return job_manager.render_voice_comparison(
            voice_profile_id=voice_profile_id,
            book_id=request.book_id,
            language=request.language,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/voice-profiles/{voice_profile_id}/preferred-preset")
def set_voice_profile_preferred_preset(
    voice_profile_id: str,
    request: PreferredPresetRequest,
    _: dict = Depends(require_admin_access),
) -> dict:
    try:
        return store.set_voice_profile_preferred_preset(voice_profile_id, request.preset)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/jobs")
def list_jobs(_: dict = Depends(require_admin_access)) -> list[dict]:
    return store.list_jobs()


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return store.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/books/{book_id}/narrations")
def create_narration(
    book_id: str,
    request: CreateNarrationRequest,
    _: dict = Depends(require_admin_access),
) -> dict:
    try:
        store.get_book(book_id)
        options = request.model_dump()
        resolved_sample_mode = request.sample_mode
        if request.voice_profile_id:
            voice_profile = store.get_voice_profile(request.voice_profile_id)
            render_config = store.resolve_voice_render_config(voice_profile, request.sample_mode)
            resolved_sample_mode = render_config["sample_mode"]
            options["sample_mode"] = resolved_sample_mode

        if request.render_scope == "full_book" and not store.has_approved_preview(
            book_id,
            engine_key=request.engine,
            voice_profile_id=request.voice_profile_id,
            sample_mode=resolved_sample_mode,
        ):
            raise ValueError("Before rendering the full book, approve a short demo or chapter 1 with the same voice.")
        return job_manager.enqueue(
            book_id=book_id,
            engine_key=request.engine,
            voice_profile_id=request.voice_profile_id,
            options=options,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/books/{book_id}/narrations/{narration_id}/approve")
def approve_narration(book_id: str, narration_id: str, _: dict = Depends(require_admin_access)) -> dict:
    try:
        return store.approve_narration(book_id, narration_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/books/{book_id}/narrations/{narration_id}/chapters/{chapter_index}/approve")
def approve_narration_chapter(
    book_id: str,
    narration_id: str,
    chapter_index: int,
    _: dict = Depends(require_admin_access),
) -> dict:
    try:
        return store.approve_chapter(book_id, narration_id, chapter_index)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/", response_class=FileResponse)
def customer_home_page() -> FileResponse:
    return FileResponse(Path(settings.web_dir) / "customer.html")


@app.get("/library/{slug}", response_class=FileResponse)
@app.get("/b/{slug}", response_class=FileResponse)
def customer_book_page(slug: str) -> FileResponse:
    return FileResponse(Path(settings.web_dir) / "customer.html")


@app.get("/admin", response_class=FileResponse)
def admin_page() -> FileResponse:
    return FileResponse(Path(settings.web_dir) / "admin.html")


@app.get("/machine", response_class=FileResponse)
@app.get("/studio", response_class=FileResponse)
def machine_page() -> FileResponse:
    return FileResponse(Path(settings.web_dir) / "machine.html")


app.mount("/media", StaticFiles(directory=settings.data_dir), name="media")
app.mount("/", StaticFiles(directory=settings.web_dir, html=True), name="web")

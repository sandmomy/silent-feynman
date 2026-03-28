from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


# Prioritize the local .env file over any stale inherited environment values.
load_dotenv(override=True)


@dataclass(frozen=True)
class AppSettings:
    app_dir: Path = Path(__file__).resolve().parents[1]
    data_dir_name: str = os.getenv("BOOKVOICE_DATA_DIR", "library_data")
    host: str = os.getenv("BOOKVOICE_HOST", "127.0.0.1")
    port: int = int(os.getenv("BOOKVOICE_PORT", "8000"))
    login_enabled: bool = os.getenv("BOOKVOICE_LOGIN_ENABLED", "true").lower() == "true"
    admin_username: str = os.getenv("BOOKVOICE_ADMIN_USERNAME", "eugene")
    admin_password: str = os.getenv("BOOKVOICE_ADMIN_PASSWORD", "")
    session_secret: str = os.getenv("BOOKVOICE_SESSION_SECRET", "")
    session_hours: int = int(os.getenv("BOOKVOICE_SESSION_HOURS", "24"))
    self_signup_enabled: bool = os.getenv("BOOKVOICE_SELF_SIGNUP_ENABLED", "true").lower() == "true"
    google_client_id: str = os.getenv("BOOKVOICE_GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("BOOKVOICE_GOOGLE_CLIENT_SECRET", "")
    demo_customer_username: str = os.getenv("BOOKVOICE_DEMO_CUSTOMER_USERNAME", "lector")
    demo_customer_password: str = os.getenv("BOOKVOICE_DEMO_CUSTOMER_PASSWORD", "000")
    demo_customer_display_name: str = os.getenv("BOOKVOICE_DEMO_CUSTOMER_DISPLAY_NAME", "Store Reader")
    demo_owned_customer_username: str = os.getenv("BOOKVOICE_DEMO_OWNED_CUSTOMER_USERNAME", "lector_owned")
    demo_owned_customer_password: str = os.getenv("BOOKVOICE_DEMO_OWNED_CUSTOMER_PASSWORD", "000")
    demo_owned_customer_display_name: str = os.getenv("BOOKVOICE_DEMO_OWNED_CUSTOMER_DISPLAY_NAME", "Library Reader")
    openvoice_enabled: bool = os.getenv("OPENVOICE_WSL_ENABLED", "false").lower() == "true"
    openvoice_wsl_distro: str = os.getenv("OPENVOICE_WSL_DISTRO", "Ubuntu")
    openvoice_python_bin: str = os.getenv("OPENVOICE_WSL_PYTHON_BIN", "")
    openvoice_base_speaker_es: str = os.getenv("OPENVOICE_BASE_SPEAKER_ES", "ES")
    openvoice_base_speaker_en: str = os.getenv("OPENVOICE_BASE_SPEAKER_EN", "EN-US")

    @property
    def auth_enabled(self) -> bool:
        return self.login_enabled and bool(self.admin_password.strip())

    @property
    def google_auth_enabled(self) -> bool:
        return bool(self.google_client_id.strip() and self.google_client_secret.strip())

    @property
    def resolved_session_secret(self) -> str:
        if self.session_secret.strip():
            return self.session_secret
        seed = f"{self.admin_username}:{self.admin_password}:{self.app_dir}"
        return seed

    @property
    def data_dir(self) -> Path:
        return self.app_dir / self.data_dir_name

    @property
    def books_dir(self) -> Path:
        return self.data_dir / "books"

    @property
    def jobs_dir(self) -> Path:
        return self.data_dir / "jobs"

    @property
    def voices_dir(self) -> Path:
        return self.data_dir / "voices"

    @property
    def users_dir(self) -> Path:
        return self.data_dir / "users"

    @property
    def web_dir(self) -> Path:
        return self.app_dir / "web"

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.books_dir.mkdir(parents=True, exist_ok=True)
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self.users_dir.mkdir(parents=True, exist_ok=True)


settings = AppSettings()

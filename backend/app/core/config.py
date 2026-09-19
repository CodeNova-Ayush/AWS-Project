from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

_ROOT_DIR = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    # MongoDB
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "codetok"

    # AI keys
    emergent_llm_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    fernet_secret_key: str = ""

    # GitHub OAuth & User
    github_username: str = "iamksr05"
    github_token: str = ""
    github_oauth_client_id: str = ""
    github_oauth_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/auth-callback"

    # GitHub App (org repo access)
    github_app_id: str = ""
    github_app_private_key_path: str = "github-app-private-key.pem"
    github_app_installation_id: str = ""

    model_config = SettingsConfigDict(
        env_file=str(_ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()

import os
from dataclasses import dataclass
from dotenv import load_dotenv, find_dotenv

# Load environment variables (auto-discover .env in backend/ or project root)
load_dotenv(find_dotenv(), override=False)

@dataclass
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")


settings = Settings()



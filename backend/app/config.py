import os
from dataclasses import dataclass
from dotenv import load_dotenv, find_dotenv

# Load environment variables (auto-discover .env in backend/ or project root)
load_dotenv(find_dotenv(), override=False)

@dataclass
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    api_base_url: str = os.getenv("API_BASE_URL", "")


settings = Settings()



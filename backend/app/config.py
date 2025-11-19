import os
from dataclasses import dataclass
from dotenv import load_dotenv, find_dotenv

# Load environment variables - try backend/.env first, then auto-discover
backend_env = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env, override=True)
else:
    # Fallback to auto-discovery
    load_dotenv(find_dotenv(), override=False)

@dataclass
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    api_base_url: str = os.getenv("API_BASE_URL", "")


settings = Settings()



import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .login import router as auth_router, super_router, get_current_user
from .routes.demand_sheet import router as demand_router
from .clientsettings import router as clientsettings_router

# -----------------------------
# Load .env from backend folder
# -----------------------------
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")  # backend/.env
load_dotenv(dotenv_path=dotenv_path, override=True)
# Debug: print to check if .env loaded


# -----------------------------
# FastAPI App Factory
# -----------------------------
def create_app() -> FastAPI:
    app = FastAPI(title="Kudzu Recruitment Platform", version="0.1.0")

    allowed_origins = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include authentication, superadmin, demand, and client settings routes
    app.include_router(auth_router)
    app.include_router(super_router)
    app.include_router(demand_router)
    app.include_router(clientsettings_router)

    # Health check
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    # Dashboard route
    @app.get("/dashboard")
    async def dashboard(user=Depends(get_current_user)) -> dict:
        return {
            "message": "Dashboard data",
            "user": {"email": user.get("sub"), "uid": user.get("uid")},
            "widgets": ["summary", "charts", "activity"],
        }

    return app


# -----------------------------
# Create app instance
# -----------------------------
app = create_app()

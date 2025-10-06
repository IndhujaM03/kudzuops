from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import uvicorn
from app.config import Config
from app.login import router as login_router

# Create FastAPI app
app = FastAPI(
    title="Kudzu Operations API",
    description="Backend API for Kudzu Operations Dashboard",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Include routers
app.include_router(login_router, prefix="/api/auth", tags=["authentication"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Kudzu Operations API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "kudzu-operations-api"}

if __name__ == "__main__":
    config = Config()
    uvicorn.run(
        "app.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=config.DEBUG
    )
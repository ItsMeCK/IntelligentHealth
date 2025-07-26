# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.db.base import Base
from app.db.session import engine
# --- Updated for Phase 2 ---
from app.apis.v1 import router_users, router_consultations, router_ai_features, router_patients
import os

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Intelligent Health Platform API",
    description="API for managing doctor-patient consultations.",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing) Configuration
origins = [
    "*"  # Allow requests from same host
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(router_users.router, prefix="/api/v1", tags=["Users"])
app.include_router(router_consultations.router, prefix="/api/v1", tags=["Consultations"])
# --- New for Phase 2 ---
app.include_router(router_ai_features.router, prefix="/api/v1", tags=["AI Features"])
app.include_router(router_patients.router, prefix="/api/v1", tags=["Patients"])

# Mount static files (frontend)
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/", tags=["Root"])
async def read_root():
    """Serve the main index.html file."""
    return FileResponse("frontend/index.html")

@app.get("/dashboard", tags=["Dashboard"])
async def read_dashboard():
    return FileResponse("frontend/dashboard.html")

@app.get("/consultation", tags=["Consultation"])
async def read_consultation():
    return FileResponse("frontend/consultation.html")

# Catch-all route for SPA routing
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    if full_path.startswith("api/"):
        return {"error": "API endpoint not found"}
    file_path = f"frontend/{full_path}"
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse("frontend/index.html")

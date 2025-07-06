# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.base import Base
from app.db.session import engine
# --- Updated for Phase 2 ---
from app.apis.v1 import router_users, router_consultations, router_ai_features, router_patients

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Intelligent Health Platform API",
    description="API for managing doctor-patient consultations.",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing) Configuration
origins = [
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://localhost:8000", 
    "http://127.0.0.1:8000",
    "*"  # Allow all origins for development
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


@app.get("/", tags=["Root"])
def read_root():
    """A simple root endpoint to confirm the API is running."""
    return {"message": "Welcome to the Intelligent Health Platform API"}

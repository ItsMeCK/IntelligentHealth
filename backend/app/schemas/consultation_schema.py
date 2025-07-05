# backend/app/schemas/consultation_schema.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from .user_schema import UserOut
from app.models.consultation import ConsultationStatus

# --- New Schema ---
class MedicalReportOut(BaseModel):
    id: int
    file_path: str
    uploaded_at: datetime
    summary: Optional[str] = None

    class Config:
        orm_mode = True

class ConsultationCreate(BaseModel):
    patient_id: int
    doctor_id: int
    scheduled_time: datetime
    notes: Optional[str] = None

class ConsultationOut(BaseModel):
    id: int
    patient: UserOut
    doctor: UserOut
    scheduled_time: datetime
    status: ConsultationStatus
    notes: Optional[str] = None
    # --- New Field ---
    reports: List[MedicalReportOut] = []

    class Config:
        orm_mode = True

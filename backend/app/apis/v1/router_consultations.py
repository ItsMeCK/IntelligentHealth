# backend/app/apis/v1/router_consultations.py

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
# --- Updated Schema import ---
from app.schemas.consultation_schema import ConsultationCreate, ConsultationOut, MedicalReportOut
from app.services.consultation_service import ConsultationService
from app.apis.v1.router_users import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/consultations", response_model=ConsultationOut, status_code=status.HTTP_201_CREATED)
def create_consultation(
    consultation_in: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultation_service = ConsultationService(db)
    new_consultation = consultation_service.create_consultation(consultation=consultation_in)
    return new_consultation

@router.get("/consultations", response_model=List[ConsultationOut])
def get_user_consultations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultation_service = ConsultationService(db)
    consultations = consultation_service.get_consultations_by_user(user_id=current_user.id)
    return consultations

# --- New Endpoint ---
@router.get("/consultations/{consultation_id}/reports", response_model=List[MedicalReportOut])
def get_consultation_reports(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all medical reports for a specific consultation.
    """
    consultation_service = ConsultationService(db)
    # Optional: Add logic to ensure the current_user is part of this consultation
    reports = consultation_service.get_reports_for_consultation(consultation_id=consultation_id)
    return reports


@router.post("/consultations/{consultation_id}/upload-report", response_model=MedicalReportOut)
def upload_medical_report(
    consultation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultation_service = ConsultationService(db)
    consultation = consultation_service.get_consultation_by_id(consultation_id)
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consultation with id {consultation_id} not found."
        )

    report = consultation_service.save_report_file(
        consultation_id=consultation_id,
        file=file
    )
    return report

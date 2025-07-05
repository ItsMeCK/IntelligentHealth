# backend/app/apis/v1/router_patients.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.services.consultation_service import ConsultationService
from app.schemas.consultation_schema import ConsultationHistoryOut
from app.apis.v1.router_users import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/patients/{patient_id}/history", response_model=List[ConsultationHistoryOut])
def get_patient_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Gets a specific patient's consultation history with the currently logged-in doctor.
    """
    consultation_service = ConsultationService(db)
    history = consultation_service.get_patient_history_with_doctor(
        patient_id=patient_id,
        doctor_id=current_user.id
    )
    return history

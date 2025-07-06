# backend/app/apis/v1/router_consultations.py

import os
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Body, Response
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

@router.patch("/consultations/{consultation_id}/status", response_model=ConsultationOut)
def update_consultation_status(
    consultation_id: int,
    status_body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_status = status_body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status value.")
    consultation_service = ConsultationService(db)
    updated = consultation_service.update_consultation_status(consultation_id, new_status, current_user.id)
    if updated is None:
        # Not found or not allowed
        consultation = consultation_service.get_consultation_by_id(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found.")
        raise HTTPException(status_code=403, detail="Not allowed to update status.")
    return updated

# --- Report Management Endpoints ---
@router.get("/reports/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download a specific medical report file.
    """
    consultation_service = ConsultationService(db)
    report = consultation_service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    
    # Check if user has access to this report
    consultation = consultation_service.get_consultation_by_id(report.consultation_id)
    if not consultation or (current_user.id != consultation.patient_id and current_user.id != consultation.doctor_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this report.")
    
    try:
        with open(report.file_path, 'rb') as file:
            content = file.read()
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={report.file_path.split('/')[-1]}"}
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report file not found on server.")

@router.delete("/reports/{report_id}")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific medical report.
    """
    consultation_service = ConsultationService(db)
    report = consultation_service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    
    # Check if user has access to this report
    consultation = consultation_service.get_consultation_by_id(report.consultation_id)
    if not consultation or (current_user.id != consultation.patient_id and current_user.id != consultation.doctor_id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this report.")
    
    try:
        # Delete the file
        if os.path.exists(report.file_path):
            os.remove(report.file_path)
        
        # Delete from database
        db.delete(report)
        db.commit()
        
        return {"message": "Report deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

# --- Patient Summary Endpoints ---
@router.post("/consultations/{consultation_id}/generate-summary")
async def generate_patient_summary(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a comprehensive patient summary for a consultation.
    """
    consultation_service = ConsultationService(db)
    consultation = consultation_service.get_consultation_by_id(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    
    # Check if user is authorized (doctor or patient)
    if current_user.id not in [consultation.doctor_id, consultation.patient_id]:
        raise HTTPException(status_code=403, detail="Not authorized to access this consultation.")
    
    try:
        summary = await consultation_service.generate_patient_summary(consultation_id)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

@router.put("/consultations/{consultation_id}/update-summary")
async def update_patient_summary(
    consultation_id: int,
    summary_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the patient summary (only doctors can edit).
    """
    consultation_service = ConsultationService(db)
    consultation = consultation_service.get_consultation_by_id(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    
    # Only doctors can edit summaries
    if current_user.id != consultation.doctor_id:
        raise HTTPException(status_code=403, detail="Only doctors can edit patient summaries.")
    
    try:
        updated_summary = consultation_service.update_patient_summary(
            consultation_id, 
            summary_data.get("ai_summary", ""),
            summary_data.get("summary", ""),
            summary_data.get("medications", []),
            summary_data.get("recommendations", []),
            summary_data.get("follow_up", "")
        )
        return {"summary": updated_summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update summary: {str(e)}")

@router.get("/consultations/{consultation_id}/summary-pdf")
async def get_summary_pdf(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate and return a PDF of the patient summary.
    """
    consultation_service = ConsultationService(db)
    consultation = consultation_service.get_consultation_by_id(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    
    # Check if user is authorized (doctor or patient)
    if current_user.id not in [consultation.doctor_id, consultation.patient_id]:
        raise HTTPException(status_code=403, detail="Not authorized to access this consultation.")
    
    try:
        pdf_content = consultation_service.generate_summary_pdf(consultation_id)
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=patient_summary_{consultation_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@router.get("/consultations/{consultation_id}/saved-summary")
async def get_saved_summary(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the saved patient summary for a consultation.
    """
    consultation_service = ConsultationService(db)
    consultation = consultation_service.get_consultation_by_id(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    
    # Check if user is authorized (doctor or patient)
    if current_user.id not in [consultation.doctor_id, consultation.patient_id]:
        raise HTTPException(status_code=403, detail="Not authorized to access this consultation.")
    
    try:
        saved_summary = consultation_service.get_saved_summary(consultation_id)
        return saved_summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get saved summary: {str(e)}")

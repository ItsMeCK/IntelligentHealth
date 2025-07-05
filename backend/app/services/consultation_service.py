# backend/app/services/consultation_service.py

import os
import shutil
from fastapi import UploadFile
from sqlalchemy.orm import Session
from typing import List

from app.models.consultation import Consultation, MedicalReport
from app.schemas.consultation_schema import ConsultationCreate
from app.services.document_service import DocumentService
from app.db.vector_db import get_qdrant_client

UPLOAD_DIRECTORY = "uploads"


class ConsultationService:
    def __init__(self, db: Session):
        self.db = db
        self.document_service = DocumentService(get_qdrant_client())
        if not os.path.exists(UPLOAD_DIRECTORY):
            os.makedirs(UPLOAD_DIRECTORY)

    # ... (create_consultation, get_consultations_by_user, get_consultation_by_id are unchanged)
    def create_consultation(self, consultation: ConsultationCreate) -> Consultation:
        db_consultation = Consultation(**consultation.dict())
        self.db.add(db_consultation)
        self.db.commit()
        self.db.refresh(db_consultation)
        return db_consultation

    def get_consultations_by_user(self, user_id: int) -> List[Consultation]:
        return self.db.query(Consultation).filter(
            (Consultation.patient_id == user_id) | (Consultation.doctor_id == user_id)
        ).all()

    def get_consultation_by_id(self, consultation_id: int) -> Consultation | None:
        return self.db.query(Consultation).filter(Consultation.id == consultation_id).first()

    def save_report_file(self, consultation_id: int, file: UploadFile) -> MedicalReport:
        """
        Saves an uploaded report file, triggers AI processing to get a summary,
        and saves the report details (including summary) to the database.
        """
        file_location = os.path.join(UPLOAD_DIRECTORY, f"consult_{consultation_id}_{file.filename}")

        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)

        # Trigger AI processing to get summary
        summary_text = ""
        try:
            summary_text = self.document_service.process_and_store_report(
                file_path=file_location,
                consultation_id=consultation_id
            )
        except Exception as e:
            print(f"ERROR: AI processing failed for file {file.filename}. Error: {e}")
            summary_text = "AI summary could not be generated for this document."

        # Create a database record for the report with the summary
        db_report = MedicalReport(
            consultation_id=consultation_id,
            file_path=file_location,
            summary=summary_text
        )
        self.db.add(db_report)
        self.db.commit()
        self.db.refresh(db_report)
        return db_report

    def get_reports_for_consultation(self, consultation_id: int) -> List[MedicalReport]:
        """
        Retrieves all medical reports for a given consultation.
        """
        return self.db.query(MedicalReport).filter(MedicalReport.consultation_id == consultation_id).all()


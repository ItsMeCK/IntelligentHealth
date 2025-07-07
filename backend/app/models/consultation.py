# backend/app/models/consultation.py

import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ConsultationStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(ConsultationStatus), default=ConsultationStatus.SCHEDULED)
    notes = Column(Text, nullable=True)
    soap_note = Column(Text, nullable=True)
    # --- New Field for Phase 5 ---
    ddx_result = Column(Text, nullable=True)  # To store the AI-generated Differential Diagnosis
    # --- New Field for Patient Summary ---
    patient_summary = Column(Text, nullable=True)  # To store the patient summary
    medications = Column(Text, nullable=True)  # To store prescribed medications
    recommendations = Column(Text, nullable=True)  # To store doctor recommendations
    follow_up_notes = Column(Text, nullable=True)  # To store follow-up instructions

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    reports = relationship("MedicalReport", back_populates="consultation")


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    file_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    summary = Column(Text, nullable=True)

    consultation = relationship("Consultation", back_populates="reports")


class RadiologyAnalysis(Base):
    __tablename__ = "radiology_analyses"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True)
    report_id = Column(Integer, ForeignKey("medical_reports.id"), nullable=True)
    image_path = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    intermediate_outputs = Column(JSON, nullable=True)
    final_report = Column(Text, nullable=True)

    consultation = relationship("Consultation")
    report = relationship("MedicalReport")

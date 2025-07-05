# backend/app/models/consultation.py

import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ConsultationStatus(str, enum.Enum):
    """Enumeration for consultation status."""
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Consultation(Base):
    """SQLAlchemy model for a Consultation."""
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(ConsultationStatus), default=ConsultationStatus.SCHEDULED)
    notes = Column(Text, nullable=True)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    reports = relationship("MedicalReport", back_populates="consultation")


class MedicalReport(Base):
    """SQLAlchemy model for a Medical Report file."""
    __tablename__ = "medical_reports"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    file_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    # --- New Field ---
    summary = Column(Text, nullable=True)  # To store the AI-generated summary

    consultation = relationship("Consultation", back_populates="reports")

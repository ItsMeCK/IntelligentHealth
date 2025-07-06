# backend/app/services/consultation_service.py

import os
import shutil
from fastapi import UploadFile
from sqlalchemy.orm import Session, joinedload # <--- This is the missing import
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

    def get_report_by_id(self, report_id: int) -> MedicalReport | None:
        """
        Retrieves a specific medical report by its ID.
        """
        return self.db.query(MedicalReport).filter(MedicalReport.id == report_id).first()

    def update_consultation_status(self, consultation_id: int, new_status: str, user_id: int) -> Consultation | None:
        """
        Updates the status of a consultation. Only the doctor or patient involved can update the status.
        """
        consultation = self.get_consultation_by_id(consultation_id)
        if not consultation:
            return None
        
        # Check if the user is authorized to update this consultation
        if consultation.doctor_id != user_id and consultation.patient_id != user_id:
            return None
        
        consultation.status = new_status
        self.db.commit()
        self.db.refresh(consultation)
        return consultation

    # --- Patient Summary Methods ---
    async def generate_patient_summary(self, consultation_id: int) -> dict:
        """
        Generate a comprehensive patient summary for a consultation using AI.
        """
        consultation = self.get_consultation_by_id(consultation_id)
        if not consultation:
            raise ValueError("Consultation not found")
        
        reports = self.get_reports_for_consultation(consultation_id)
        
        # Check if we have enough data to generate a meaningful summary
        has_soap = consultation.soap_note and consultation.soap_note != "No SOAP note available"
        has_ddx = consultation.ddx_result and consultation.ddx_result != "No differential diagnosis available"
        has_notes = consultation.notes and consultation.notes != "No notes provided"
        
        if not (has_soap or has_ddx or has_notes):
            return {
                "consultation_date": consultation.scheduled_time.strftime("%B %d, %Y"),
                "patient_name": consultation.patient.full_name,
                "doctor_name": consultation.doctor.full_name,
                "ai_generated_summary": "Please generate SOAP notes and differential diagnosis first to create a patient summary.",
                "consultation_notes": consultation.notes or "No notes provided",
                "soap_note": consultation.soap_note or "No SOAP note available",
                "ddx_result": consultation.ddx_result or "No differential diagnosis available",
                "reports": []
            }
        
        # Generate AI summary using OpenAI
        ai_summary = await self._generate_ai_patient_summary(
            consultation.notes,
            consultation.soap_note,
            consultation.ddx_result,
            reports
        )
        
        # Store the AI-generated summary in the database
        consultation.patient_summary = ai_summary
        self.db.commit()
        self.db.refresh(consultation)
        
        # Compile all available data
        summary_data = {
            "consultation_date": consultation.scheduled_time.strftime("%B %d, %Y"),
            "patient_name": consultation.patient.full_name,
            "doctor_name": consultation.doctor.full_name,
            "ai_generated_summary": ai_summary,
            "consultation_notes": consultation.notes or "No notes provided",
            "soap_note": consultation.soap_note or "No SOAP note available",
            "ddx_result": consultation.ddx_result or "No differential diagnosis available",
            "reports": []
        }
        
        # Add report summaries
        for report in reports:
            summary_data["reports"].append({
                "filename": report.file_path.split('/')[-1],
                "summary": report.summary or "No summary available",
                "uploaded_at": report.uploaded_at.strftime("%B %d, %Y")
            })
        
        return summary_data
    
    def _create_patient_friendly_summary(self, notes: str, soap_note: str, ddx_result: str, reports: list) -> str:
        """
        Create a patient-friendly summary from medical data using intelligent processing.
        """
        # Collect all available medical data
        medical_data = []
        
        # Process SOAP note intelligently
        if soap_note and soap_note != "No SOAP note available":
            # Extract key sections from SOAP
            soap_sections = self._extract_soap_sections(soap_note)
            if soap_sections:
                medical_data.extend(soap_sections)
        
        # Process DDx result intelligently
        if ddx_result and ddx_result != "No differential diagnosis available":
            ddx_summary = self._extract_ddx_summary(ddx_result)
            if ddx_summary:
                medical_data.append(ddx_summary)
        
        # Process consultation notes
        if notes and notes != "No notes provided":
            medical_data.append(f"Consultation: {notes}")
        
        # Process medical reports
        if reports:
            report_summary = self._extract_report_summary(reports)
            if report_summary:
                medical_data.append(report_summary)
        
        # Create intelligent summary
        if medical_data:
            return self._create_intelligent_summary(medical_data)
        
        return "Please generate SOAP notes and differential diagnosis first to create a patient summary."
    
    def _extract_soap_sections(self, soap_note: str) -> list:
        """Extract key sections from SOAP note for patient understanding."""
        sections = []
        
        # Extract Subjective (patient's symptoms)
        if "Subjective:" in soap_note:
            subjective = soap_note.split("Subjective:")[1].split("Objective:")[0] if "Objective:" in soap_note else soap_note.split("Subjective:")[1]
            if subjective.strip():
                sections.append(f"Patient reported: {subjective.strip()}")
        
        # Extract Assessment (diagnosis)
        if "Assessment:" in soap_note:
            assessment = soap_note.split("Assessment:")[1].split("Plan:")[0] if "Plan:" in soap_note else soap_note.split("Assessment:")[1]
            if assessment.strip():
                sections.append(f"Diagnosis: {assessment.strip()}")
        
        # Extract Plan (treatment)
        if "Plan:" in soap_note:
            plan = soap_note.split("Plan:")[1]
            if plan.strip():
                sections.append(f"Treatment plan: {plan.strip()}")
        
        return sections
    
    def _extract_ddx_summary(self, ddx_result: str) -> str:
        """Extract key findings from DDx for patient understanding."""
        if "Key Findings:" in ddx_result:
            findings = ddx_result.split("Key Findings:")[1].split("\n\n")[0]
            if findings.strip():
                return f"Key findings: {findings.strip()}"
        elif "Differential Diagnosis:" in ddx_result:
            diagnosis = ddx_result.split("Differential Diagnosis:")[1].split("\n\n")[0]
            if diagnosis.strip():
                return f"Diagnosis: {diagnosis.strip()}"
        return ""
    
    def _extract_report_summary(self, reports: list) -> str:
        """Extract summary from medical reports."""
        summaries = []
        for report in reports:
            if report.summary and report.summary != "No summary available":
                summaries.append(report.summary)
        
        if summaries:
            return f"Medical reports: {' '.join(summaries)}"
        return ""
    
    def _create_intelligent_summary(self, medical_data: list) -> str:
        """Create an intelligent, patient-friendly summary from medical data."""
        # Combine all medical data
        combined_text = " ".join(medical_data)
        
        # Clean up the text
        combined_text = combined_text.replace("  ", " ").strip()
        
        # Split into sentences and filter meaningful ones
        sentences = [s.strip() for s in combined_text.split('.') if len(s.strip()) > 15]
        
        if not sentences:
            return "Medical information is being processed. Please check back later."
        
        # Take the most relevant sentences (max 3)
        relevant_sentences = sentences[:3]
        
        # Create a coherent summary
        summary = '. '.join(relevant_sentences) + '.'
        
        # Ensure it's patient-friendly
        summary = summary.replace("Assessment:", "Based on the examination,")
        summary = summary.replace("Diagnosis:", "The diagnosis is")
        summary = summary.replace("Treatment plan:", "The recommended treatment is")
        summary = summary.replace("Patient reported:", "You reported")
        summary = summary.replace("Key findings:", "The key findings are")
        
        return summary
    
    async def _generate_ai_patient_summary(self, notes: str, soap_note: str, ddx_result: str, reports: list) -> str:
        """
        Generate a patient-friendly summary using OpenAI AI.
        """
        try:
            from langchain_openai import ChatOpenAI
            from app.core.config import settings
            
            # Initialize OpenAI
            llm = ChatOpenAI(model="gpt-4o", temperature=0.3, api_key=settings.OPENAI_API_KEY)
            
            # Prepare medical data - include SOAP notes and reports
            medical_data = []
            
            if soap_note and soap_note != "No SOAP note available":
                medical_data.append(f"SOAP Note: {soap_note}")
            else:
                return "Please generate SOAP notes first to create a patient summary."
            
            # Include report information if available
            if reports:
                report_summaries = []
                for report in reports:
                    if report.summary and report.summary != "No summary available":
                        report_summaries.append(f"Report ({report.file_path.split('/')[-1]}): {report.summary}")
                
                if report_summaries:
                    medical_data.append(f"Medical Reports:\n" + "\n".join(report_summaries))
            
            # Create the prompt for AI
            prompt = f"""
            As a medical AI assistant, create a concise, patient-friendly summary (maximum 5 sentences) based on the following medical data:

            {'\n\n'.join(medical_data)}

            Instructions:
            1. Create a clear, compassionate summary that a patient can understand
            2. Focus on key findings, diagnosis, and treatment plan
            3. Use simple, non-technical language
            4. Maximum 5 sentences
            5. Do NOT include phrases like "specific details are not provided" or "given information"
            6. If information is missing, focus on what IS available
            7. Make it actionable and informative for the patient
            8. Use "you" instead of "patient" to make it personal
            9. Be encouraging and supportive in tone
            10. If medical reports are mentioned, briefly reference key findings from them
            11. Mention any important test results or imaging findings in simple terms

            Patient Summary:
            """
            
            # Generate summary using AI
            response = await llm.ainvoke(prompt)
            return response.content.strip()
            
        except Exception as e:
            print(f"Error generating AI summary: {e}")
            # Fallback to basic summary if AI fails
            return self._create_patient_friendly_summary(notes, soap_note, ddx_result, reports)
    
    def update_patient_summary(self, consultation_id: int, ai_summary: str, summary: str, medications: list, recommendations: list, follow_up: str) -> dict:
        """
        Update the patient summary with doctor's edits including AI summary.
        """
        consultation = self.get_consultation_by_id(consultation_id)
        if not consultation:
            raise ValueError("Consultation not found")
        
        # Update the consultation with new summary data
        # Store AI summary in patient_summary field (this is where we store the AI-generated content)
        if ai_summary:
            consultation.patient_summary = ai_summary
        elif summary:
            # If no AI summary but doctor notes, store doctor notes
            consultation.patient_summary = summary
        
        consultation.medications = ", ".join(medications) if medications else None
        consultation.recommendations = ", ".join(recommendations) if recommendations else None
        consultation.follow_up_notes = follow_up
        
        self.db.commit()
        self.db.refresh(consultation)
        
        return {
            "ai_summary": ai_summary,
            "summary": summary,
            "medications": medications,
            "recommendations": recommendations,
            "follow_up": follow_up
        }

    def get_saved_summary(self, consultation_id: int) -> dict:
        """
        Get the saved patient summary for a consultation.
        """
        consultation = self.get_consultation_by_id(consultation_id)
        if not consultation:
            raise ValueError("Consultation not found")
        
        # Check if there's any summary data (AI generated or doctor edited)
        has_ai_data = (consultation.notes and consultation.notes != 'No notes provided') or \
                      (consultation.soap_note and consultation.soap_note != 'No SOAP note available') or \
                      (consultation.ddx_result and consultation.ddx_result != 'No differential diagnosis available')
        
        has_doctor_data = consultation.patient_summary or consultation.medications or consultation.recommendations or consultation.follow_up_notes
        
        if not has_ai_data and not has_doctor_data:
            return {"has_saved_summary": False}
        
        # Get reports for this consultation
        reports = self.get_reports_for_consultation(consultation_id)
        report_data = []
        for report in reports:
            report_data.append({
                "filename": report.file_path.split('/')[-1],
                "summary": report.summary or "No summary available",
                "uploaded_at": report.uploaded_at.strftime("%B %d, %Y")
            })
        
        return {
            "has_saved_summary": True,
            "ai_generated_summary": consultation.patient_summary or "",
            "soap_note": consultation.soap_note or "",
            "ddx_result": consultation.ddx_result or "",
            "patient_summary": consultation.patient_summary or "",
            "medications": consultation.medications.split(", ") if consultation.medications else [],
            "recommendations": consultation.recommendations.split(", ") if consultation.recommendations else [],
            "follow_up_notes": consultation.follow_up_notes or "",
            "reports": report_data,
            "last_updated": consultation.updated_at.isoformat() if hasattr(consultation, 'updated_at') else None
        }

    def generate_summary_pdf(self, consultation_id: int) -> bytes:
        """
        Generate a PDF of the patient summary.
        """
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.lib import colors
            from io import BytesIO
            
            consultation = self.get_consultation_by_id(consultation_id)
            if not consultation:
                raise ValueError("Consultation not found")
            
            # Create PDF buffer
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []
            
            # Title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=1  # Center alignment
            )
            story.append(Paragraph("Patient Summary Report", title_style))
            story.append(Spacer(1, 12))
            
            # Patient Information
            story.append(Paragraph("Patient Information", styles['Heading2']))
            story.append(Spacer(1, 6))
            
            patient_data = [
                ["Patient Name:", consultation.patient.full_name],
                ["Doctor:", consultation.doctor.full_name],
                ["Consultation Date:", consultation.scheduled_time.strftime("%B %d, %Y")],
                ["Status:", consultation.status.value.title()]
            ]
            
            patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
            patient_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.grey),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('BACKGROUND', (1, 0), (1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(patient_table)
            story.append(Spacer(1, 12))
            
            # Consultation Notes
            if consultation.notes:
                story.append(Paragraph("Consultation Notes", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.notes, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # SOAP Note
            if consultation.soap_note:
                story.append(Paragraph("SOAP Note", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.soap_note, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # Differential Diagnosis
            if consultation.ddx_result:
                story.append(Paragraph("Differential Diagnosis", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.ddx_result, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # Patient Summary
            if consultation.patient_summary:
                story.append(Paragraph("Patient Summary", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.patient_summary, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # Medications
            if consultation.medications:
                story.append(Paragraph("Prescribed Medications", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.medications, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # Recommendations
            if consultation.recommendations:
                story.append(Paragraph("Recommendations", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.recommendations, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # Follow-up Notes
            if consultation.follow_up_notes:
                story.append(Paragraph("Follow-up Instructions", styles['Heading2']))
                story.append(Spacer(1, 6))
                story.append(Paragraph(consultation.follow_up_notes, styles['Normal']))
                story.append(Spacer(1, 12))
            
            # Build PDF
            doc.build(story)
            buffer.seek(0)
            return buffer.getvalue()
            
        except ImportError:
            # Fallback if reportlab is not available
            return f"PDF generation requires reportlab library. Summary data: {consultation.patient_summary}".encode()

    # --- New Method for Patient History ---
    def get_patient_history_with_doctor(self, *, patient_id: int, doctor_id: int) -> List[Consultation]:
        """
        Retrieves all past consultations for a specific patient with a specific doctor.
        It eagerly loads the doctor's information to avoid extra queries.
        """
        return (
            self.db.query(Consultation)
            .options(joinedload(Consultation.doctor))
            .filter(
                Consultation.patient_id == patient_id,
                Consultation.doctor_id == doctor_id
            )
            .order_by(Consultation.scheduled_time.desc())
            .all()
        )

    def update_consultation_status(self, consultation_id: int, new_status: str, user_id: int) -> Consultation:
        consultation = self.get_consultation_by_id(consultation_id)
        if not consultation:
            return None
        # Only allow doctor or patient to update
        if user_id not in [consultation.doctor_id, consultation.patient_id]:
            return None
        consultation.status = new_status
        self.db.commit()
        self.db.refresh(consultation)
        return consultation

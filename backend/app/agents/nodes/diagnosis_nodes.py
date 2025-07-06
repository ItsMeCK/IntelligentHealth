# backend/app/agents/nodes/diagnosis_nodes.py

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.consultation_service import ConsultationService
from app.models.consultation import Consultation  # <--- This is the missing import

llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=settings.OPENAI_API_KEY)


class DiagnosisNodes:
    """
    Contains the functions (nodes) for the Differential Diagnosis LangGraph agent.
    """

    def gather_patient_data(self, state):
        """Gathers all available data for a given consultation."""
        print("--- Node: Gathering Patient Data ---")
        consultation_id = state['consultation_id']
        db = SessionLocal()
        try:
            consultation_service = ConsultationService(db)
            consultation = consultation_service.get_consultation_by_id(consultation_id)
            if not consultation:
                return {"error": "Consultation not found."}

            reports = consultation_service.get_reports_for_consultation(consultation_id)

            context = f"Patient Notes: {consultation.notes}\n\n"
            context += f"SOAP Note from Consultation Audio:\n{consultation.soap_note}\n\n"
            context += "--- Uploaded Reports Summaries ---\n"
            for report in reports:
                context += f"Report: {report.file_path.split('/')[-1]}\nSummary: {report.summary}\n\n"

            return {"patient_data_context": context}
        finally:
            db.close()

    def generate_ddx_report(self, state):
        """Takes the compiled patient data and generates a DDx report."""
        print("--- Node: Generating DDx Report ---")
        context = state['patient_data_context']

        prompt_template = """
        You are an expert clinical diagnostician AI. Your task is to provide a Differential Diagnosis (DDx) based on the comprehensive patient data provided.

        Analyze all the information, including patient notes, SOAP notes from audio, and summaries of all uploaded reports (text and images).

        CRITICAL: Your response must be EXACTLY 10 lines or fewer. Be concise and focused.

        Structure your response as follows:
        1.  **Primary Diagnosis:** State the most likely diagnosis.
        2.  **Differential Diagnoses:** List at least two other possible diagnoses, ranked from most to least likely.
        3.  **Reasoning:** For each diagnosis (primary and differential), provide a brief but clear justification based on specific evidence from the provided context.
        4.  **Recommended Next Steps:** Suggest potential tests, scans, or referrals to confirm the diagnosis.

        Patient Data Context:
        {context}
        """
        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm

        ddx_report = chain.invoke({"context": context})
        
        # Limit to 10 lines maximum
        content = ddx_report.content
        lines = content.split('\n')
        limited_content = '\n'.join(lines[:10])
        
        return {"ddx_result": limited_content}

    def save_ddx_result(self, state):
        """Saves the final DDx report to the database."""
        print("--- Node: Saving DDx Result ---")
        db = SessionLocal()
        try:
            consultation = db.query(Consultation).filter(Consultation.id == state['consultation_id']).first()
            if consultation:
                consultation.ddx_result = state['ddx_result']
                db.commit()
                print(f"Successfully saved DDx for consultation {state['consultation_id']}")
            else:
                return {"error": "Consultation not found during save."}
        except Exception as e:
            db.rollback()
            return {"error": f"Failed to save DDx to database: {e}"}
        finally:
            db.close()
        return {}

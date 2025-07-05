# backend/app/agents/tools/medical_report_tools.py

from langchain.tools import tool
from app.db.session import SessionLocal
from app.services.consultation_service import ConsultationService
from app.agents.rag_agent import RAGAgent


@tool
def get_report_summaries(consultation_id: int) -> str:
    """
    Use this tool to get a list of AI-generated summaries for ALL reports
    (both text and images like X-rays or MRIs) associated with a specific consultation.
    This is the best tool for broad questions about overall findings or for information
    from image-based reports.
    """
    print(f"--- Tool Used: get_report_summaries for consultation {consultation_id} ---")
    db = SessionLocal()
    try:
        consultation_service = ConsultationService(db)
        reports = consultation_service.get_reports_for_consultation(consultation_id)
        if not reports:
            return "No reports have been uploaded for this consultation yet."

        formatted_summaries = []
        for report in reports:
            file_name = report.file_path.split('/')[-1]
            summary = report.summary or "No summary available."
            formatted_summaries.append(f"Report: {file_name}\nSummary: {summary}")

        return "\n\n".join(formatted_summaries)
    finally:
        db.close()


@tool
async def query_detailed_text_reports(consultation_id: int, question: str) -> str:
    """
    Use this tool ONLY when you need to find specific, detailed information or direct quotes
    from within text-based documents (like PDFs or DOCX files).
    Do not use this for general summaries or for questions about images.
    """
    print(f"--- Tool Used: query_detailed_text_reports for consultation {consultation_id} ---")
    try:
        rag_agent = RAGAgent(consultation_id=consultation_id)
        # Use await for the async function
        answer = await rag_agent.answer_question(question)
        return answer
    except Exception as e:
        print(f"Error in detailed query tool: {e}")
        return "Could not query the detailed text reports. The vector store may not exist for this consultation."


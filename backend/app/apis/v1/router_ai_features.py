# backend/app/apis/v1/router_ai_features.py

import shutil
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from app.agents.consultation_agent import ConsultationAgent
from app.schemas.ai_schema import QuestionRequest, AnswerResponse
from app.services.consultation_service import ConsultationService
from app.db.session import get_db
from sqlalchemy.orm import Session
from app.apis.v1.router_users import get_current_user
from app.models.user import User
from app.agents.graph_builder import scribe_agent_runnable, ddx_agent_runnable

router = APIRouter()


@router.post("/consultations/{consultation_id}/ask", response_model=AnswerResponse)
async def ask_question_about_report(
        consultation_id: int,
        request: QuestionRequest,
        db: Session = Depends(get_db)
):
    """
    Ask a question about the documents uploaded for a specific consultation.
    This now uses an advanced agent that can query both summaries and details.
    """
    consultation_service = ConsultationService(db)
    consultation = consultation_service.get_consultation_by_id(consultation_id)
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consultation with id {consultation_id} not found."
        )

    try:
        consultation_agent = ConsultationAgent(consultation_id=consultation_id)
        answer = await consultation_agent.answer_question(question=request.question)
        return AnswerResponse(answer=answer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not process question. Error: {e}"
        )


@router.post("/consultations/{consultation_id}/create-note-from-audio")
async def create_soap_note_from_audio(
        consultation_id: int,
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_user)
):
    """
    Accepts an audio file, processes it through the Scribe agent,
    and returns the generated SOAP note.
    """
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    initial_state = {
        "consultation_id": consultation_id,
        "audio_file_path": temp_file_path,
    }
    final_state = scribe_agent_runnable.invoke(initial_state)
    if final_state.get("error"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Scribe failed: {final_state['error']}"
        )
    return {"soap_note": final_state.get("final_note", "No note was generated.")}


@router.post("/consultations/{consultation_id}/generate-ddx")
async def generate_differential_diagnosis(
        consultation_id: int,
        current_user: User = Depends(get_current_user)
):
    """
    Triggers the Differential Diagnosis agent for a given consultation.
    """
    if current_user.role != 'doctor':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can generate a DDx.")

    initial_state = {"consultation_id": consultation_id}

    final_state = await ddx_agent_runnable.ainvoke(initial_state)

    if final_state.get("error"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DDx generation failed: {final_state['error']}"
        )

    return {"ddx_result": final_state.get("ddx_result", "No DDx report was generated.")}

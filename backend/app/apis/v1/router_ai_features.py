# backend/app/apis/v1/router_ai_features.py

import shutil
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from app.agents.consultation_agent import ConsultationAgent
from app.schemas.ai_schema import QuestionRequest, AnswerResponse
from app.services.consultation_service import ConsultationService, RadiologyAnalysisService
from app.db.session import get_db
from sqlalchemy.orm import Session, joinedload
from app.apis.v1.router_users import get_current_user
from app.models.user import User
from app.agents.graph_builder import scribe_agent_runnable, ddx_agent_runnable
from app.agents.radiology_image_agent import RadiologyImageAgent
from app.models.consultation import Consultation, RadiologyAnalysis

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


@router.post("/radiology/analyze-image")
async def analyze_radiology_image(
    consultation_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts a radiology image and consultation_id, runs the advanced analysis workflow, and returns the structured report and progress.
    Persists the analysis and returns its ID.
    """
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        agent = RadiologyImageAgent(image_path=temp_file_path)
        result = agent.run_workflow()
        # Save analysis to DB, always with consultation_id
        analysis_service = RadiologyAnalysisService(db)
        analysis = analysis_service.save_analysis(
            image_path=temp_file_path,
            intermediate_outputs=result.get("intermediate_outputs"),
            final_report=result.get("final_report"),
            consultation_id=consultation_id
        )
        return {
            "analysis_id": analysis.id,
            "progress": result["progress"],
            "modality": result["modality"],
            "body_part": result["body_part"],
            "diagnostic_quality": result["diagnostic_quality"],
            "triage_comments": result["triage_comments"],
            "anomalies": result["anomalies"],
            "characterizations": result["characterizations"],
            "differential_diagnosis": result["differential_diagnosis"],
            "final_report": result["final_report"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Radiology analysis failed: {e}"
        )


@router.get("/radiology/analysis/{analysis_id}")
async def get_radiology_analysis(
    analysis_id: int,
    db: Session = Depends(get_db)
):
    """
    Fetch a radiology analysis by its ID, including all details and outputs.
    """
    analysis_service = RadiologyAnalysisService(db)
    analysis = analysis_service.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {
        "analysis_id": analysis.id,
        "image_path": analysis.image_path,
        "created_at": analysis.created_at,
        "intermediate_outputs": analysis.intermediate_outputs,
        "final_report": analysis.final_report,
        "consultation_id": analysis.consultation_id,
        "report_id": analysis.report_id
    }


@router.get("/radiology/analyses")
async def list_radiology_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all radiology analyses for the current doctor, with consultation and patient info.
    """
    # Only allow doctors
    if current_user.role != 'doctor':
        raise HTTPException(status_code=403, detail="Only doctors can view their analyses.")
    # Find all consultations for this doctor
    consultations = db.query(Consultation).filter(Consultation.doctor_id == current_user.id).all()
    consultation_ids = [c.id for c in consultations]
    # Get all analyses for these consultations
    analyses = db.query(RadiologyAnalysis).options(
        joinedload(RadiologyAnalysis.consultation).joinedload(Consultation.patient)
    ).filter(RadiologyAnalysis.consultation_id.in_(consultation_ids)).order_by(RadiologyAnalysis.created_at.desc()).all()
    # Build response
    result = []
    for analysis in analyses:
        consultation = analysis.consultation
        patient = consultation.patient if consultation else None
        result.append({
            "analysis_id": analysis.id,
            "consultation_id": analysis.consultation_id,
            "patient_name": f"{patient.full_name if patient else ''}",
            "created_at": analysis.created_at,
            "summary": analysis.final_report[:200] if analysis.final_report else '',
        })
    return result

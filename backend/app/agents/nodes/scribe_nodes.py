# backend/app/agents/nodes/scribe_nodes.py

from openai import OpenAI
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.consultation import Consultation
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import List  # <--- This is the missing import

# Initialize clients
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=settings.OPENAI_API_KEY)


# Pydantic model for structured data extraction
class TranscriptSummary(BaseModel):
    """Structured representation of a medical transcript."""
    patient_symptoms: List[str] = Field(description="List of all symptoms mentioned by the patient.")
    doctor_observations: List[str] = Field(description="List of key observations made by the doctor.")
    prescribed_medications: List[str] = Field(description="List of all medications prescribed or mentioned.")
    follow_up_instructions: List[str] = Field(description="List of follow-up actions or appointments suggested.")


class ScribeNodes:
    """
    Contains all the functions (nodes) for the Scribe LangGraph agent.
    """

    def transcribe_audio(self, state):
        print("--- Node: Transcribing Audio ---")
        try:
            audio_file = open(state['audio_file_path'], "rb")
            transcription = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
            print(f"Transcription successful: {transcription.text[:100]}...")
            return {"transcription": transcription.text}
        except Exception as e:
            print(f"Error in transcription: {e}")
            return {"error": "Failed to transcribe audio."}

    def structure_transcript(self, state):
        print("--- Node: Structuring Transcript ---")
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system",
                 "You are an expert medical assistant. Extract key information from the following medical consultation transcript. Respond with a JSON object matching the specified schema."),
                ("human", "Transcript:\n\n{transcript}")
            ])
            structured_llm = llm.with_structured_output(TranscriptSummary)
            chain = prompt | structured_llm
            summary = chain.invoke({"transcript": state['transcription']})
            print(f"Structuring successful: {summary}")
            return {"structured_summary": summary.dict()}
        except Exception as e:
            print(f"Error structuring transcript: {e}")
            return {"error": "Failed to structure transcript."}

    def generate_soap_note(self, state):
        print("--- Node: Generating SOAP Note ---")
        try:
            summary = state['structured_summary']
            prompt_template = prompt_template = """
            You are an expert clinical note writer. Your task is to generate a SOAP note from the provided structured information.
            The note should be based ONLY on the information given.
            If a section has no information, explicitly state that (e.g., "No specific symptoms were mentioned by the patient.").
            Do not make up information or add details not present in the provided context.

            CRITICAL: Your response must be EXACTLY 10 lines or fewer. Be concise and focused.

            Provided Information:
            - Patient Symptoms: {symptoms}
            - Doctor's Observations: {observations}
            - Prescribed Medications: {medications}
            - Follow-up Instructions: {follow_up}

            Generate the SOAP note now with clear headings for Subjective, Objective, Assessment, and Plan.
            """
            prompt = ChatPromptTemplate.from_template(prompt_template)
            chain = prompt | llm

            note = chain.invoke({
                "symptoms": ", ".join(summary.get('patient_symptoms', [])),
                "observations": ", ".join(summary.get('doctor_observations', [])),
                "medications": ", ".join(summary.get('prescribed_medications', [])),
                "follow_up": ", ".join(summary.get('follow_up_instructions', []))
            })
            
            # Limit to 10 lines maximum
            content = note.content
            lines = content.split('\n')
            limited_content = '\n'.join(lines[:10])
            
            print(f"SOAP note generated successfully.")
            return {"final_note": limited_content}
        except Exception as e:
            print(f"Error generating SOAP note: {e}")
            return {"error": "Failed to generate SOAP note."}

    def save_note(self, state):
        print("--- Node: Saving Note to DB ---")
        db = SessionLocal()
        try:
            consultation = db.query(Consultation).filter(Consultation.id == state['consultation_id']).first()
            if consultation:
                consultation.soap_note = state['final_note']
                db.commit()
                print(f"Successfully saved note for consultation {state['consultation_id']}")
            else:
                print(f"Error: Consultation {state['consultation_id']} not found in DB.")
                return {"error": "Consultation not found."}
        except Exception as e:
            print(f"Error saving note to DB: {e}")
            db.rollback()
            return {"error": "Failed to save note to database."}
        finally:
            db.close()
        return {}

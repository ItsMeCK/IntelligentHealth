# backend/app/agents/nodes/scribe_nodes.py

from openai import OpenAI
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.consultation import Consultation
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import List

# Initialize clients
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=settings.OPENAI_API_KEY)


class ScribeNodes:
    """
    Contains all the functions (nodes) for the Scribe LangGraph agent.
    This has been simplified to a direct generation approach for improved reliability.
    """

    def transcribe_audio(self, state):
        """Transcribes the audio file to text."""
        print("--- Node: Transcribing Audio ---")
        try:
            with open(state['audio_file_path'], "rb") as audio_file:
                transcription = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
            print(f"Transcription successful: {transcription.text[:100]}...")
            return {"transcription": transcription.text}
        except Exception as e:
            print(f"Error in transcription: {e}")
            return {"error": "Failed to transcribe audio."}

    def generate_soap_note(self, state):
        """
        Generates a complete SOAP note directly from the transcript in a single step.
        This is more reliable than multi-step extraction and generation.
        """
        print("--- Node: Generating SOAP Note Directly ---")
        try:
            transcript = state['transcription']

            # This prompt instructs the AI to perform the entire task in one go.
            prompt_template = """
            You are an expert medical scribe. Your task is to analyze the following medical consultation transcript and generate a concise SOAP note.

            **Instructions:**
            1.  Read the entire transcript carefully.
            2.  The conversation may be in Marathi, Hindi, English, or a mix. The SOAP note **MUST** be in the same language as the conversation.
            3.  Create four distinct sections: Subjective (S), Objective (O), Assessment (A), and Plan (P).
            4.  **Subjective (S):** What the patient says about their problem (e.g., "डोक दुखत आहे").
            5.  **Objective (O):** The doctor's direct observations and findings.
            6.  **Assessment (A):** The doctor's diagnosis or assessment of the condition.
            7.  **Plan (P):** This is the most critical part. Listen for **any** instructions from the doctor, including:
                - Prescribed medications.
                - Recommended exercises or therapies.
                - Lifestyle advice (e.g., "take rest," "apply hot pack").
                - Follow-up appointment details.
                - Any other actions the patient should take.
            8.  If any section has no information, write "Not specified" or "माहिती नाही".
            9.  The final note should be clear, conversational, and concise. Aim for a maximum of 10-12 lines, but ensure the full plan is included.

            --- MEDICAL TRANSCRIPT ---
            {transcript}
            ---

            Generate the SOAP note now:
            """
            prompt = ChatPromptTemplate.from_template(prompt_template)
            chain = prompt | llm

            note = chain.invoke({"transcript": transcript})

            # FIX: Removed the hard 10-line limit to prevent truncating the plan.
            # The prompt now guides the AI to be concise, which is a more flexible approach.
            content = note.content

            print("SOAP note generated successfully.")
            return {"final_note": content}
        except Exception as e:
            print(f"Error generating SOAP note: {e}")
            return {"error": "Failed to generate SOAP note."}

    def save_note(self, state):
        """Saves the final generated note to the database."""
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

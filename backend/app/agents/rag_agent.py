# backend/app/agents/rag_agent.py

from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings
from langchain.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

from app.core.config import settings
from app.db.vector_db import get_qdrant_client
from app.services.consultation_service import ConsultationService
from app.db.session import SessionLocal
import os


class RAGAgent:
    """
    A Retrieval-Augmented Generation agent for answering questions
    based on documents stored in a Qdrant collection.
    Now bypasses Qdrant: passes all text to LLM directly.
    """

    def __init__(self, consultation_id: int):
        self.consultation_id = consultation_id
        self.llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY)

    async def answer_question(self, question: str) -> str:
        """
        Loads all reports for this consultation. For each report, includes the summary (if available) and, for text-based reports, also includes the full text. Passes all to the LLM for answer.
        """
        db = SessionLocal()
        try:
            consultation_service = ConsultationService(db)
            reports = consultation_service.get_reports_for_consultation(self.consultation_id)
            report_contexts = []
            for report in reports:
                file_path = report.file_path
                _, ext = os.path.splitext(file_path)
                summary = report.summary or "No summary available."
                context = f"Report: {os.path.basename(file_path)}\nSummary: {summary}"
                if ext.lower() == ".pdf":
                    from langchain_community.document_loaders import PyPDFLoader
                    loader = PyPDFLoader(file_path)
                    docs = loader.load()
                    full_text = "\n".join([doc.page_content if hasattr(doc, 'page_content') else str(doc) for doc in docs])
                    context += f"\nFull Text: {full_text}"
                elif ext.lower() == ".docx":
                    from langchain_community.document_loaders import Docx2txtLoader
                    loader = Docx2txtLoader(file_path)
                    docs = loader.load()
                    full_text = "\n".join([doc.page_content if hasattr(doc, 'page_content') else str(doc) for doc in docs])
                    context += f"\nFull Text: {full_text}"
                # For images and other files, only summary is included
                report_contexts.append(context)
            if not report_contexts:
                return "No reports available to answer the question."
            full_context = "\n\n".join(report_contexts)
            prompt = f"You are an expert medical assistant. Use the following medical report content to answer the user's question.\n\n{full_context}\n\nQuestion: {question}"
            response = await self.llm.ainvoke(prompt)
            return response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            print(f"Error in RAGAgent.answer_question (Qdrant bypassed): {e}")
            return f"Could not answer the question due to an error: {e}"
        finally:
            db.close()


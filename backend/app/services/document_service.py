# backend/app/services/document_service.py

import os
import base64
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Qdrant
from langchain.chains.summarize import load_summarize_chain
from qdrant_client import QdrantClient
from langchain_core.messages import HumanMessage

from app.core.config import settings

# Define supported file types
TEXT_EXTENSIONS = ['.pdf', '.docx']
IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']


class DocumentService:
    """
    Service for processing documents: loading, splitting, embedding, summarizing, and storing.
    Now supports both text and image files.
    """

    def __init__(self, qdrant_client: QdrantClient):
        self.qdrant_client = qdrant_client
        self.embeddings = OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o", api_key=settings.OPENAI_API_KEY)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200, length_function=len
        )

    def _generate_summary_for_text(self, file_path: str) -> str:
        """Generates a summary for text-based documents (PDF, DOCX)."""
        print(f"--- Generating summary for TEXT document: {file_path} ---")
        _, file_extension = os.path.splitext(file_path)
        if file_extension.lower() == '.pdf':
            loader = PyPDFLoader(file_path)
        elif file_extension.lower() == '.docx':
            loader = Docx2txtLoader(file_path)
        else:
            # This should not be reached due to the router logic
            raise ValueError(f"Unsupported text file type: {file_extension}")

        documents = loader.load()
        summarize_chain = load_summarize_chain(self.llm, chain_type="map_reduce")
        # Using the modern .invoke() method
        result_dict = summarize_chain.invoke({"input_documents": documents})
        return result_dict.get('output_text', '')

    def _generate_summary_for_image(self, file_path: str) -> str:
        """Generates a descriptive summary for an image file."""
        print(f"--- Generating summary for IMAGE document: {file_path} ---")
        # 1. Encode the image to base64
        with open(file_path, "rb") as image_file:
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')

        # 2. Call the multimodal LLM
        prompt = [
            HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": "You are an expert radiologist. Analyze this medical image (e.g., X-ray, MRI) and provide a concise, descriptive summary of your findings. Describe any anomalies, their locations, and potential implications. If the image is not a medical image, state that clearly.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                            "detail": "high"
                        },
                    },
                ]
            )
        ]
        response = self.llm.invoke(prompt)
        return response.content

    def process_and_store_report(self, file_path: str, consultation_id: int) -> str:
        """
        Processes an uploaded report file based on its type, and returns an AI-generated summary.
        Qdrant is bypassed: no embeddings or vector DB storage.
        """
        _, file_extension = os.path.splitext(file_path)
        file_ext_lower = file_extension.lower()

        if file_ext_lower in TEXT_EXTENSIONS:
            print(f"Processing TEXT document for consultation {consultation_id} (Qdrant bypassed)")
            # Load the document based on its extension
            if file_ext_lower == '.pdf':
                loader = PyPDFLoader(file_path)
            else:  # .docx
                loader = Docx2txtLoader(file_path)

            docs = loader.load()

            # Summarize using the loaded list of Document objects
            summarize_chain = load_summarize_chain(self.llm, chain_type="map_reduce")

            # FIX: Pass the list of Document objects directly to the chain.
            # FIX: Use the modern .invoke() method instead of the deprecated .run().
            # The .invoke() method for this chain expects a dictionary with the key "input_documents".
            result_dict = summarize_chain.invoke({"input_documents": docs})

            # The summary is in the 'output_text' key of the result dictionary.
            summary_result = result_dict.get('output_text', '')

            return summary_result

        elif file_ext_lower in IMAGE_EXTENSIONS:
            # For image files, we only generate a summary
            print(f"Processing IMAGE document for consultation {consultation_id}")
            return self._generate_summary_for_image(file_path)

        else:
            raise ValueError(f"Unsupported file type for processing: {file_extension}")

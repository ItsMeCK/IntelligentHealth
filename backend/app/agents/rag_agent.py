# backend/app/agents/rag_agent.py

from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings
from langchain.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

from app.core.config import settings
from app.db.vector_db import get_qdrant_client


class RAGAgent:
    """
    A Retrieval-Augmented Generation agent for answering questions
    based on documents stored in a Qdrant collection.
    """

    def __init__(self, consultation_id: int):
        self.llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY)
        self.embeddings = OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)
        self.collection_name = f"consultation_{consultation_id}"

        # Initialize the vector store retriever
        vector_store = Qdrant(
            client=get_qdrant_client(),
            collection_name=self.collection_name,
            embeddings=self.embeddings,
        )
        self.retriever = vector_store.as_retriever()

        # Create the RAG chain
        self._create_chain()

    def _create_chain(self):
        """
        Builds the LangChain retrieval chain.
        """
        system_prompt = (
            "You are an expert medical assistant. Answer the user's questions "
            "based on the provided context from their medical reports. "
            "If the information is not in the context, say so. "
            "Be concise and clear.\n\n"
            "<context>{context}</context>"
        )
        prompt = ChatPromptTemplate.from_messages(
            [("system", system_prompt), ("human", "{input}")]
        )

        question_answer_chain = create_stuff_documents_chain(self.llm, prompt)
        self.rag_chain = create_retrieval_chain(self.retriever, question_answer_chain)

    async def answer_question(self, question: str) -> str:
        """
        Invokes the RAG chain to answer a question.
        """
        response = await self.rag_chain.ainvoke({"input": question})
        return response.get("answer", "I could not find an answer.")


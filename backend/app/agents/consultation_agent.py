# backend/app/agents/consultation_agent.py

from langchain import hub
from langchain.agents import AgentExecutor, create_react_agent
from langchain_openai import ChatOpenAI
from langchain.tools import Tool
from pydantic.v1 import BaseModel, Field
import asyncio

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.consultation_service import ConsultationService


class DetailedQueryInput(BaseModel):
    """Input schema for the detailed query tool."""
    question: str = Field(description="The specific question to ask the text reports.")


class ConsultationAgent:
    """
    An advanced agent that uses multiple tools to answer questions about a consultation.
    """

    def __init__(self, consultation_id: int):
        self.consultation_id = consultation_id
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=settings.OPENAI_API_KEY)

        async def aquery_detailed_reports(question: str) -> str:
            """Asynchronous wrapper for the detailed query tool."""
            try:
                from app.agents.rag_agent import RAGAgent
                rag_agent = RAGAgent(consultation_id=self.consultation_id)
                answer = await rag_agent.answer_question(question)
                return answer
            except Exception as e:
                print(f"Error in detailed query tool: {e}")
                return "Could not query the detailed text reports. The vector store may not exist for this consultation."

        def sync_detailed_query(question: str) -> str:
            """Synchronous wrapper for running the async tool."""
            # This is necessary for the 'func' argument of the Tool.
            return asyncio.run(aquery_detailed_reports(question))

        # Create a wrapper function that accepts an optional argument (for LangChain compatibility)
        def get_summaries_wrapper(input_str: str = "") -> str:
            # Call the function directly without using it as a tool
            db = SessionLocal()
            try:
                consultation_service = ConsultationService(db)
                reports = consultation_service.get_reports_for_consultation(self.consultation_id)
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

        self.tools = [
            Tool(
                name="get_all_report_summaries",
                func=get_summaries_wrapper,
                description="Use this tool to get a list of AI-generated summaries for ALL reports (both text and images) associated with the consultation. Best for broad questions like 'summarize the findings' or for questions about images."
            ),
            # --- This is the key change ---
            # The Tool constructor requires a 'func' argument, even if a 'coroutine' is provided.
            # We provide both the synchronous and asynchronous versions.
            Tool(
                name="query_detailed_text_reports",
                func=sync_detailed_query,
                coroutine=aquery_detailed_reports,
                description="Use this tool ONLY when you need to find specific, detailed information or direct quotes from within text-based documents (like PDFs). Do not use this for general summaries or for questions about images.",
                args_schema=DetailedQueryInput
            )
        ]

        prompt = hub.pull("hwchase17/react")
        agent = create_react_agent(self.llm, self.tools, prompt)

        self.agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors="Check your output and make sure it conforms to the Action/Action Input format."
        )

    async def answer_question(self, question: str) -> str:
        """
        Invokes the agent asynchronously to answer a question.
        """
        contextual_question = (
            f"You are working on the case for consultation ID {self.consultation_id}. "
            f"The user's question is: {question}"
        )

        response = await self.agent_executor.ainvoke({"input": contextual_question})
        return response.get("output", "I could not find an answer.")


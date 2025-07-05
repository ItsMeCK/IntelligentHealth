# backend/app/schemas/ai_schema.py

from pydantic import BaseModel

class QuestionRequest(BaseModel):
    """Schema for the question request body."""
    question: str

class AnswerResponse(BaseModel):
    """Schema for the answer response body."""
    answer: str

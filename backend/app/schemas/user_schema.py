# backend/app/schemas/user_schema.py

from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import UserRole

# Schema for creating a user
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole

# Schema for reading user data (without password)
class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole

    class Config:
        orm_mode = True

# Schema for JWT token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

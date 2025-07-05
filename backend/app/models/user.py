# backend/app/models/user.py

import enum
from sqlalchemy import Column, Integer, String, Enum, Boolean
from app.db.base import Base

class UserRole(str, enum.Enum):
    """Enumeration for user roles."""
    PATIENT = "patient"
    DOCTOR = "doctor"

class User(Base):
    """SQLAlchemy model for a User."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), index=True)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)

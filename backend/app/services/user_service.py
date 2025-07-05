# backend/app/services/user_service.py

from sqlalchemy.orm import Session
from typing import List
from app.models.user import User, UserRole
from app.schemas.user_schema import UserCreate
from app.core.security import get_password_hash


class UserService:
    """
    Service class for user-related business logic.
    """

    def __init__(self, db: Session):
        """
        Initializes the service with a database session.

        :param db: SQLAlchemy session object.
        """
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        """
        Retrieves a user by their email address.
        """
        return self.db.query(User).filter(User.email == email).first()

    def create_user(self, user: UserCreate) -> User:
        """
        Creates a new user in the database.
        """
        hashed_password = get_password_hash(user.password)
        db_user = User(
            email=user.email,
            full_name=user.full_name,
            hashed_password=hashed_password,
            role=user.role
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def get_all_doctors(self) -> List[User]:
        """
        Retrieves a list of all users with the 'doctor' role.
        """
        return self.db.query(User).filter(User.role == UserRole.DOCTOR).all()


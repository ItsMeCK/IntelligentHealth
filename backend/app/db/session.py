# backend/app/db/session.py

import os
# Do NOT import mysql.connector directly; SQLAlchemy will handle the driver import as long as the correct driver is installed and DATABASE_URL is set properly.
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# --- Start: Database URL Validation ---
db_url = settings.DATABASE_URL
if not db_url:
    raise ValueError("DATABASE_URL is not set in the .env file. Please configure it.")

print(f"INFO: Attempting to connect with DATABASE_URL: {db_url}")

if not db_url.startswith("mysql+mysqlconnector://"):
    raise ValueError(
        "Invalid DATABASE_URL format. The URL must start with 'mysql+mysqlconnector://' "
        "to use the 'mysql-connector-python' driver. Please check your .env file."
    )
# --- End: Database URL Validation ---


# Create a SQLAlchemy engine using the validated URL.
engine = create_engine(
    db_url,
    pool_pre_ping=True
)

# Create a session factory. This is what the application uses to talk to the DB.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    Dependency that provides a database session for each API request.
    This pattern ensures that the database session is correctly opened
    and closed for every transaction.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

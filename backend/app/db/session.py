# backend/app/db/session.py

import os
from google.cloud.sql.connector import Connector, IPTypes
import pymysql
import sqlalchemy
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Read env vars
INSTANCE_CONNECTION_NAME = os.environ["INSTANCE_CONNECTION_NAME"]
DB_USER = os.environ["DB_USER"]
DB_PASS = os.environ["DB_PASS"]
DB_NAME = os.environ["DB_NAME"]

ip_type = IPTypes.PRIVATE if os.environ.get("PRIVATE_IP") else IPTypes.PUBLIC

# initialize Cloud SQL Python Connector object
connector = Connector(ip_type=ip_type, refresh_strategy="LAZY")

def getconn() -> pymysql.connections.Connection:
    conn: pymysql.connections.Connection = connector.connect(
        INSTANCE_CONNECTION_NAME,
        "pymysql",
        user=DB_USER,
        password=DB_PASS,
        db=DB_NAME,
    )
    return conn

# Create a SQLAlchemy engine using the validated URL.
engine = sqlalchemy.create_engine(
    "mysql+pymysql://",
    creator=getconn,
    pool_pre_ping=True,
)

# Create a session factory. This is what the application uses to talk to the DB.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

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

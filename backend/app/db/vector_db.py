# backend/app/db/vector_db.py

from qdrant_client import QdrantClient
from app.core.config import settings

# Initialize the Qdrant client
# This client will be used to interact with the Qdrant vector database.
qdrant_client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)

def get_qdrant_client():
    """
    Dependency to get the Qdrant client.
    In a more complex app, this could handle connection pooling.
    """
    return qdrant_client

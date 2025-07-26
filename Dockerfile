FROM python:3.10-slim

# Set workdir
WORKDIR /app

# Copy backend code
COPY backend/app ./app
COPY backend/requirements.txt .

# Copy frontend static files
COPY frontend ./frontend

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8080

# Start FastAPI app (serves both API and static frontend)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

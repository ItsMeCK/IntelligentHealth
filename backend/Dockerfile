FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for MySQL and Cloud SQL Python Connector
RUN apt-get update && apt-get install -y gcc default-libmysqlclient-dev && rm -rf /var/lib/apt/lists/*

# Install pip dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app/ ./app/

# .env is NOT copied; Cloud Run injects env vars at runtime

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"] 
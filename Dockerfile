# Use an official Python base image
FROM python:3.12-slim

# Set environment variables to reduce buffer issues and improve logging
ENV PYTHONUNBUFFERED=1

# Set working directory inside the container
WORKDIR /app

# Install system dependencies (if needed)
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code into the container
COPY main.py /app/main.py
RUN chmod +x /app/main.py

# Set working directory where Nextflow will operate
WORKDIR /data

# Define the entrypoint (optional — useful for debugging)
ENTRYPOINT ["python", "/app/main.py"]

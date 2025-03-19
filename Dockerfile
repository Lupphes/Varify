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

# Copy the source code into the container (updated path)
COPY bin/varify.py /usr/local/bin/varify
RUN chmod +x /usr/local/bin/varify

# Set working directory where Nextflow will operate
WORKDIR /data

# Define the entrypoint (direct reference to the binary)
ENTRYPOINT ["varify"]

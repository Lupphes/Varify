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

# Copy the entire source code into the container
COPY . /app

# Install the package using setup.py
RUN pip install --no-cache-dir .

# Set working directory where Nextflow will operate
WORKDIR /data

# Define the entrypoint (direct reference to the console script defined in setup.py)
ENTRYPOINT ["varify"]

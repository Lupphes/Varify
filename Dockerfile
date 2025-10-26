# Use an official Python base image
FROM python:3.12-slim

# Set environment variables to reduce buffer issues and improve logging
ENV PYTHONUNBUFFERED=1

# Install bash and curl (and clean up after to keep the image small)
RUN apt-get update && \
    apt-get install -y procps bash curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy the entire source code into the container
COPY . /app

# Install the package using setup.py
RUN pip install --no-cache-dir .

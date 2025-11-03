# Build JavaScript assets
FROM node:18-slim AS builder

WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm install

COPY src/ ./src/
COPY build-report.js postcss.config.cjs ./

RUN npm run build:package

# Python runtime
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y procps bash curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY src/ ./src/
COPY setup.py pyproject.toml MANIFEST.in README.md LICENSE ./

COPY --from=builder /build/src/varify/dist ./src/varify/dist

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir . && \
    pip list

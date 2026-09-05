# InvoiceOps backend image.
#
# Build from the InvoiceOps repo root so the JSON Schema contracts (read-only
# inputs) can be baked in next to the code:
#   docker build -t invoiceops-backend -f backend/Dockerfile .
# Or via docker compose (see docker-compose.yml in the repo root).

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# poppler-utils provides pdftotext/pdftoppm (deterministic PDF intake).
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY backend/.env.example ./.env.example
COPY contracts ./contracts

# Runtime data lives under /data (mount a volume here in production).
# uploads/, logs/ and the sqlite file (sqlite:////data/invoiceops.db).
ENV DATABASE_URL=sqlite:////data/invoiceops.db \
    UPLOAD_DIR=/data/uploads \
    MASTER_DATA_DIR=/data/master_data \
    CONTRACTS_DIR=/app/contracts

RUN mkdir -p /data/uploads /data/contracts && \
    addgroup --system invoiceops && \
    adduser --system --ingroup invoiceops --home /app invoiceops && \
    chown -R invoiceops:invoiceops /app /data

USER invoiceops
EXPOSE 8000

# Migrations run on every start; user seeding and the optional master-data
# import (from the mounted MASTER_DATA_DIR) are idempotent. The entrypoint can
# be overridden (e.g. "uvicorn app.main:app --reload") for local development.
CMD ["sh", "-c", \
     "alembic upgrade head && \
      python -m app.initial_data && \
      python -m app.import_master_data; \
      exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

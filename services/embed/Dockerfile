FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# ⚠️ كان bge-small-en-v1.5 (إنجليزي فقط) → الذاكرة مش بتفهم العربي.
# الافتراضي بقى متعدد اللغات، ويقدر يتغيّر من وقت البناء:
#   docker compose build --build-arg EMBEDDING_MODEL_NAME=BAAI/bge-m3
ARG EMBEDDING_MODEL_NAME=intfloat/multilingual-e5-small
ENV EMBEDDING_MODEL_NAME=${EMBEDDING_MODEL_NAME}

# Pre-download model at build time (not runtime)
RUN python -c "import os; from fastembed import TextEmbedding; list(TextEmbedding(os.environ['EMBEDDING_MODEL_NAME']).embed(['test']))"

COPY main.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=120s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

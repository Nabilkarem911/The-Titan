FROM python:3.11-slim

WORKDIR /app

# Install torch WITHOUT deps to skip 2GB+ of nvidia/cuda packages on aarch64
# Then install only the minimal CPU runtime deps torch actually needs
COPY requirements.txt .
RUN pip install --no-cache-dir --no-deps torch && \
    pip install --no-cache-dir \
      sympy networkx jinja2 filelock fsspec typing-extensions typing-inspection && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Pre-download model at build time (not runtime)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"

COPY main.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

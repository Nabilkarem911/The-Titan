FROM python:3.11-slim

WORKDIR /app

# Install torch AND sentence-transformers WITHOUT deps to skip 2GB+ of
# nvidia/cuda packages that torch 2.x pulls in on Linux aarch64.
# Then manually install only the CPU runtime deps both packages need.
COPY requirements.txt .
RUN pip install --no-cache-dir --no-deps torch && \
    pip install --no-cache-dir --no-deps sentence-transformers==3.0.1 && \
    pip install --no-cache-dir \
      sympy networkx jinja2 filelock fsspec typing-extensions typing-inspection && \
    pip install --no-cache-dir --prefer-binary \
      fastapi==0.115.0 "uvicorn[standard]==0.30.6" "numpy>=1.26.0,<2.0" \
      "transformers>=4.34.0,<5.0.0" scikit-learn scipy \
      "huggingface-hub>=0.15.1" Pillow tqdm

# Pre-download model at build time (not runtime)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"

COPY main.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

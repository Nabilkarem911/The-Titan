"""
Titan Embedding Service — local BGE-small-en-v1.5 (384-dim).
Exposes an OpenAI-compatible /v1/embeddings endpoint + a convenience /embed endpoint.
"""

import os
from typing import Union

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.environ.get("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")

app = FastAPI(title="Titan Embedding Service", version="1.0.0")

# Load model at startup (already cached in Docker image)
model: SentenceTransformer | None = None


@app.on_event("startup")
def load_model():
    global model
    model = SentenceTransformer(MODEL_NAME)


# ─── Health ───────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dimensions": model.get_sentence_embedding_dimension() if model else 0}


# ─── Simple /embed endpoint ──────────────────────────────────────────────────


class EmbedRequest(BaseModel):
    text: str | None = None
    texts: list[str] | None = None


class EmbedResponse(BaseModel):
    embedding: list[float] | None = None
    embeddings: list[list[float]] | None = None


@app.post("/embed")
def embed(req: EmbedRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if req.text:
        vec = model.encode([req.text], normalize_embeddings=True)
        return EmbedResponse(embedding=vec[0].tolist())
    elif req.texts:
        vecs = model.encode(req.texts, normalize_embeddings=True)
        return EmbedResponse(embeddings=[v.tolist() for v in vecs])
    else:
        raise HTTPException(status_code=400, detail="Provide 'text' or 'texts'")


# ─── OpenAI-compatible /v1/embeddings endpoint ───────────────────────────────


class OpenAIEmbeddingRequest(BaseModel):
    model: str = "bge-small-en-v1.5"
    input: Union[str, list[str]] = Field(...)
    dimensions: int | None = None


class EmbeddingData(BaseModel):
    object: str = "embedding"
    embedding: list[float]
    index: int


class OpenAIEmbeddingResponse(BaseModel):
    object: str = "list"
    data: list[EmbeddingData]
    model: str
    usage: dict


@app.post("/v1/embeddings")
def openai_embeddings(req: OpenAIEmbeddingRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    texts = [req.input] if isinstance(req.input, str) else req.input
    if not texts:
        raise HTTPException(status_code=400, detail="Empty input")

    vecs = model.encode(texts, normalize_embeddings=True)

    data = []
    for i, vec in enumerate(vecs):
        embedding = vec.tolist()
        # If dimensions requested and smaller than model output, truncate
        if req.dimensions and req.dimensions < len(embedding):
            embedding = embedding[: req.dimensions]
            # Re-normalize after truncation
            norm = float(np.linalg.norm(embedding))
            if norm > 0:
                embedding = [x / norm for x in embedding]
        data.append(EmbeddingData(embedding=embedding, index=i))

    total_tokens = sum(len(t.split()) for t in texts)  # approximate

    return OpenAIEmbeddingResponse(
        data=data,
        model=MODEL_NAME,
        usage={"prompt_tokens": total_tokens, "total_tokens": total_tokens},
    )

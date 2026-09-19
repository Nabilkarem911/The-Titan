"""
Titan Embedding Service — multilingual by default (sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2, 384-dim).
Supports Arabic + 100 languages. Set EMBEDDING_MODEL_NAME to change the model.
Exposes an OpenAI-compatible /v1/embeddings endpoint + a convenience /embed endpoint.
"""

import os
from typing import Union

import numpy as np
from fastapi import FastAPI, HTTPException
from fastembed import TextEmbedding
from pydantic import BaseModel, Field

# ⚠️ كان bge-small-en-v1.5 (إنجليزي فقط) — بيخلي البحث في الذاكرة ضعيف جدًا بالعربي.
MODEL_NAME = os.environ.get("EMBEDDING_MODEL_NAME", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

app = FastAPI(title="Titan Embedding Service", version="1.1.0")

# Load model at startup (already cached in Docker image)
model: TextEmbedding | None = None
DIMENSIONS: int = 0  # بتتحسب فعلًا عند التحميل — ممنوع نفترضها


@app.on_event("startup")
def load_model():
    global model, DIMENSIONS
    model = TextEmbedding(model_name=MODEL_NAME)
    # نقيس الأبعاد الحقيقية من الموديل نفسه (بدل ما نفترض 384/1536)
    probe = next(iter(model.embed(["probe"])))
    DIMENSIONS = int(len(probe))


# ─── Health ───────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dimensions": DIMENSIONS}


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
        vec = list(model.embed([req.text]))[0]
        vec = vec / np.linalg.norm(vec)
        return EmbedResponse(embedding=vec.tolist())
    elif req.texts:
        vecs = list(model.embed(req.texts))
        vecs = [v / np.linalg.norm(v) for v in vecs]
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

    vecs = list(model.embed(texts))
    vecs = [v / np.linalg.norm(v) for v in vecs]

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

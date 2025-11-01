# build_index.py
import os
import glob
import pickle
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss
from tqdm import tqdm

DOCS_DIR = "docs"
OUT_DIR = "data/faiss_index"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

os.makedirs(OUT_DIR, exist_ok=True)

print("Loading embedding model:", EMBED_MODEL_NAME)
model = SentenceTransformer(EMBED_MODEL_NAME)

# Read docs
texts = []
metas = []
for fp in glob.glob(os.path.join(DOCS_DIR, "*.txt")):
    name = os.path.basename(fp)
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read().strip()
    # split into paragraphs for better granularity
    parts = [p.strip() for p in content.split("\n\n") if p.strip()]
    for i, p in enumerate(parts):
        texts.append(p)
        metas.append({"source": name, "part": i})

print(f"Encoding {len(texts)} text chunks...")
embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)

d = embeddings.shape[1]
index = faiss.IndexFlatIP(d)  # inner product (we'll normalize)
faiss.normalize_L2(embeddings)
index.add(embeddings)

# Save index and data
faiss.write_index(index, os.path.join(OUT_DIR, "faiss.index"))
with open(os.path.join(OUT_DIR, "texts.pkl"), "wb") as f:
    pickle.dump(texts, f)
with open(os.path.join(OUT_DIR, "metas.pkl"), "wb") as f:
    pickle.dump(metas, f)

print("Index saved to", OUT_DIR)
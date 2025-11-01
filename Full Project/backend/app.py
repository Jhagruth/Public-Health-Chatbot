# app.py
import os
import json
import pickle
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from deep_translator import GoogleTranslator
import requests
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference

# -------------------- Setup --------------------
load_dotenv()
app = Flask(__name__)
CORS(app)   # ✅ Allow requests from frontend

FAISS_DIR = "data/faiss_index"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TOP_K = 3

# WatsonX configuration
WATSONX_API_KEY = os.getenv("WATSONX_API_KEY")
WATSONX_URL = os.getenv("WATSONX_URL")      # e.g. https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")

# Translator
translator = GoogleTranslator()

# -------------------- Embedding Model & FAISS --------------------
print("Loading embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

# Load FAISS index and data (with error handling)
index = None
texts = []
metas = []

try:
    faiss_index_path = os.path.join(FAISS_DIR, "faiss.index")
    texts_path = os.path.join(FAISS_DIR, "texts.pkl")
    metas_path = os.path.join(FAISS_DIR, "metas.pkl")
    
    if os.path.exists(faiss_index_path):
        print("Loading FAISS index and texts...")
        index = faiss.read_index(faiss_index_path)
        with open(texts_path, "rb") as f:
            texts = pickle.load(f)
        with open(metas_path, "rb") as f:
            metas = pickle.load(f)
        print("✅ FAISS index loaded successfully.")
    else:
        print("⚠️ FAISS index not found. Context retrieval will be disabled.")
        print(f"   Expected location: {faiss_index_path}")
        print("   Place your FAISS index files in: backend/data/faiss_index/")
except Exception as e:
    print(f"⚠️ Error loading FAISS index: {e}")
    print("   Context retrieval will be disabled.")

# -------------------- Utilities --------------------
def detect_language(text):
    try:
        return translator.detect(text).lang
    except Exception:
        return "en"

def translate(text, dest):
    try:
        return GoogleTranslator(source="auto", target=dest).translate(text)
    except Exception:
        return text

# -------------------- Retrieval --------------------
def retrieve_context(query, k=TOP_K):
    if index is None or len(texts) == 0:
        return []
    try:
        q_emb = embed_model.encode([query], convert_to_numpy=True)
        faiss.normalize_L2(q_emb)
        D, I = index.search(q_emb, k)
        results = []
        for idx in I[0]:
            if idx < len(texts):
                results.append({"text": texts[idx], "meta": metas[idx]})
        return results
    except Exception as e:
        print(f"Error in retrieve_context: {e}")
        return []

# -------------------- WatsonX Model --------------------
watsonx_model = None
if WATSONX_API_KEY and WATSONX_URL and WATSONX_PROJECT_ID:
    try:
        creds = Credentials(
            url=WATSONX_URL,
            api_key=WATSONX_API_KEY
        )
        watsonx_model = ModelInference(
            model_id="ibm/granite-3-8b-instruct",
            credentials=creds,
            project_id=WATSONX_PROJECT_ID
        )
        print("✅ WatsonX Granite model loaded successfully.")
    except Exception as e:
        print("⚠️ WatsonX initialization failed:", e)
else:
    print("⚠️ WatsonX credentials missing — using fallback generator.")

# -------------------- Generation --------------------
def watsonx_generate(prompt):
    """Use WatsonX Granite model if available; else fallback."""
    if watsonx_model:
        try:
            # ✅ Pass generation parameters properly
            response = watsonx_model.generate_text(
                prompt=prompt,
                params={
                    "max_new_tokens": 500,      # extend output length
                    "temperature": 0.7,
                    "repetition_penalty": 1.0,
                }
            )

            # ✅ Extract result depending on SDK object type
            if isinstance(response, dict) and "results" in response:
                text = response["results"][0].get("generated_text", "").strip()
            elif hasattr(response, "get_result"):
                result = response.get_result()
                text = result["results"][0].get("generated_text", "").strip()
            else:
                text = str(response)

            # Cleanup for truncated artifacts
            text = text.replace("\n\n", " ").replace("  ", " ")
            if not text.endswith(('.', '!', '?')):
                text += "."

            return text or "Sorry, I couldn't generate a complete answer."

        except Exception as e:
            print("WatsonX generation error:", e)
            return "Sorry, there was an issue generating the answer."

    return fallback_generate(prompt)

# -------------------- Fallback Generator --------------------
def fallback_generate(prompt):
    try:
        q = ""
        if "Question:" in prompt:
            q = prompt.split("Question:")[-1].strip()
        ctx = ""
        if "Context:" in prompt:
            ctx = prompt.split("Context:")[-1].split("Question:")[0].strip()
        if ctx:
            sents = ctx.split(".")
            summary = ". ".join([s.strip() for s in sents[:2] if s.strip()])
            if summary:
                return f"{summary}. If symptoms are severe (e.g., difficulty breathing, very high fever), please go to the nearest PHC immediately."
        return "Sorry, I couldn't find a specific answer in the knowledge base."
    except Exception:
        return "Sorry, an error occurred while generating an answer."

# -------------------- Flask Endpoint --------------------
@app.route("/chat", methods=["POST"])
def chat():
    data = request.json or {}
    user_text = data.get("query", "")
    user_lang = data.get("lang", "auto")

    if not user_text:
        return jsonify({"error": "query required"}), 400

    detected = detect_language(user_text) if user_lang == "auto" else user_lang
    target_code = detected if detected in ["en", "hi", "te", "kn"] else "en"

    q_en = translate(user_text, "en") if target_code != "en" else user_text
    docs = retrieve_context(q_en, k=TOP_K)
    context = "\n\n".join([d["text"] for d in docs]) if docs else ""

    prompt = (
        f"Context: {context}\n\n"
        f"Question: {q_en}\n"
        "Answer briefly and clearly for a rural audience in simple language. "
        "If emergency, say 'If severe symptoms, go to nearest PHC immediately.'"
    )

    answer_en = watsonx_generate(prompt)

    # Optional outbreak info
    try:
        if any(word in q_en.lower() for word in ["covid", "outbreak", "dengue"]):
            j = requests.get("https://disease.sh/v3/covid-19/all", timeout=10).json()
            answer_en += f"\n\nNote: Global active COVID cases (approx): {j.get('active', 'N/A')}"
    except Exception:
        pass

    answer_local = translate(answer_en, target_code) if target_code != "en" else answer_en
    return jsonify({"reply": answer_local, "lang": target_code})

# -------------------- Health Check Endpoint --------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "watsonx_configured": watsonx_model is not None,
        "faiss_loaded": index is not None,
        "faiss_texts_count": len(texts)
    })

# -------------------- Run --------------------
if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=True)



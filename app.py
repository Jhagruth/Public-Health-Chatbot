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
CORS(app)   # ✅ Allow requests from Streamlit frontend

FAISS_DIR = "data/faiss_index"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TOP_K = 3

# WatsonX configuration
WATSONX_API_KEY = os.getenv("WATSONX_API_KEY")
WATSONX_URL = os.getenv("WATSONX_URL")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")

# Translator
translator = GoogleTranslator()

# -------------------- Embedding Model & FAISS --------------------
print("Loading embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

print("Loading FAISS index and texts...")
index = faiss.read_index(os.path.join(FAISS_DIR, "faiss.index"))
with open(os.path.join(FAISS_DIR, "texts.pkl"), "rb") as f:
    texts = pickle.load(f)
with open(os.path.join(FAISS_DIR, "metas.pkl"), "rb") as f:
    metas = pickle.load(f)

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

# -------------------- Healthcare Filter --------------------
HEALTH_KEYWORDS = [
    "disease", "fever", "infection", "virus", "bacteria", "medicine", "treatment",
    "symptom", "injury", "pain", "poison", "gas leak", "toxic", "prevention",
    "vaccine", "malaria", "diabetes", "hospital", "doctor", "nurse", "health",
    "first aid", "phc", "clinic", "epidemic", "nuclear fallout", "contamination",
    "pollution", "gas tragedy", "mask", "radiation", "emergency", "therapy",
    "wound", "fracture", "sanitation", "hygiene", "cholera", "typhoid", "asthma"
]

def is_health_related(text):
    text_low = text.lower()
    for kw in HEALTH_KEYWORDS:
        if kw in text_low:
            return True
    return False

# -------------------- Retrieval --------------------
def retrieve_context(query, k=TOP_K):
    q_emb = embed_model.encode([query], convert_to_numpy=True)
    faiss.normalize_L2(q_emb)
    D, I = index.search(q_emb, k)
    results = []
    for idx in I[0]:
        if idx < len(texts):
            results.append({"text": texts[idx], "meta": metas[idx]})
    return results

# -------------------- WatsonX Model --------------------
watsonx_model = None
if WATSONX_API_KEY and WATSONX_URL and WATSONX_PROJECT_ID:
    try:
        creds = Credentials(url=WATSONX_URL, api_key=WATSONX_API_KEY)
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
            response = watsonx_model.generate_text(
                prompt=prompt,
                params={
                    "max_new_tokens": 200,       # limit to short answers
                    "temperature": 0.5,          # focused, factual answers
                    "repetition_penalty": 1.05,
                }
            )

            if isinstance(response, dict) and "results" in response:
                text = response["results"][0].get("generated_text", "").strip()
            elif hasattr(response, "get_result"):
                result = response.get_result()
                text = result["results"][0].get("generated_text", "").strip()
            else:
                text = str(response)

            text = text.replace("\n\n", " ").replace("  ", " ")
            if len(text.split()) > 150:
                text = " ".join(text.split()[:150]) + "..."
            if not text.endswith(('.', '!', '?')):
                text += "."

            return text or "Sorry, I couldn’t generate a complete answer."

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
            ctx = prompt.split("Context:")[1].split("Question:")[0].strip()
        if ctx:
            sents = ctx.split(".")
            summary = ". ".join([s.strip() for s in sents[:3] if s.strip()])
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

    # ✅ Reject non-health queries
    if not is_health_related(user_text):
        return jsonify({
            "reply": "Sorry, I can only answer questions related to healthcare, diseases, first aid, pollution, or safety.",
            "lang": "en"
        })

    detected = detect_language(user_text) if user_lang == "auto" else user_lang
    target_code = detected if detected in ["en", "hi", "kn"] else "en"

    q_en = translate(user_text, "en") if target_code != "en" else user_text
    docs = retrieve_context(q_en, k=TOP_K)
    context = "\n\n".join([d["text"] for d in docs]) if docs else ""

    # ✅ Enforce brevity + domain-specific focus
    prompt = (
        "You are a medical and public health assistant chatbot. "
        "Only answer healthcare, disease, treatment, hygiene, radiation safety, or emergency related questions. "
        "If the question is unrelated, respond with: 'I can only answer healthcare-related questions.' "
        "Your answer must be accurate, in simple language, and between 100–150 words maximum.\n\n"
        f"Context: {context}\n\n"
        f"Question: {q_en}\n"
        "Answer clearly for a rural audience. If emergency, say 'If severe symptoms, go to nearest PHC immediately.'"
    )

    answer_en = watsonx_generate(prompt)

    try:
        if any(word in q_en.lower() for word in ["covid", "outbreak", "dengue"]):
            j = requests.get("https://disease.sh/v3/covid-19/all", timeout=10).json()
            answer_en += f"\n\nNote: Global active COVID cases (approx): {j.get('active', 'N/A')}"
    except Exception:
        pass

    answer_local = translate(answer_en, target_code) if target_code != "en" else answer_en
    return jsonify({"reply": answer_local, "lang": target_code})

# -------------------- Run --------------------
if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5060))
    app.run(host="0.0.0.0", port=port, debug=True)

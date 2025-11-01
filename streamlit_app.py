# streamlit_app.py
import streamlit as st
import requests

st.set_page_config(page_title="WatsonHealth RAG Bot", layout="centered")
st.title("🩺 WatsonHealth RAG Chatbot (Demo)")

st.markdown("Ask health questions in **English**, **Hindi**, or **Kannada**. The bot uses local health docs and returns grounded answers.")

lang_choice = st.selectbox("Language (choose 'auto' to autodetect):", ["Auto", "English", "Hindi", "Kannada"])
query = st.text_area("Ask about symptoms, prevention, vaccines, or outbreaks", height=120)

if st.button("Send"):
    payload = {"query": query, "lang": lang_choice}
    try:
        resp = requests.post("http://localhost:5060/chat", json=payload, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            st.markdown("**Bot reply:**")
            st.write(data.get("reply", "No reply"))
        else:
            st.error(f"Backend error: {resp.status_code} {resp.text}")
    except Exception as e:
        st.error("Error contacting backend: " + str(e))

st.markdown("---")
st.markdown("**Sample queries:**\n- What are dengue symptoms?\n- डेंगू के लक्षण क्या हैं?\n- ಡೇಂಗ್ಯೂ ಲಕ್ಷಣಗಳು ಯಾವುವು?\n- What vaccines does a 9-month old need?")
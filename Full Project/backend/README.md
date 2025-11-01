# SwasthAI Backend

Flask backend API for SwasthAI chatbot using IBM WatsonX and FAISS for health-related queries.

## Features

- 🤖 IBM WatsonX Granite model for AI responses
- 🔍 FAISS vector search for context retrieval
- 🌍 Multi-language support (English, Hindi, Kannada)
- 🏥 Health-focused knowledge base
- 🔄 Automatic language detection and translation

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Up FAISS Index

You need to have FAISS index files in the `data/faiss_index` directory:
- `faiss.index` - FAISS vector index
- `texts.pkl` - Text corpus
- `metas.pkl` - Metadata

If you don't have these files, you'll need to create them from your knowledge base.

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add your WatsonX credentials:

```env
WATSONX_API_KEY=your_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_project_id_here
FLASK_PORT=5050
```

### 4. Get WatsonX Credentials

1. Go to [IBM Cloud](https://cloud.ibm.com/)
2. Create a WatsonX AI service
3. Get your API key, URL, and Project ID
4. Add them to your `.env` file

### 5. Run the Server

```bash
python app.py
```

The server will run on `http://localhost:5050` by default.

## API Endpoints

### POST /chat

Send a message to the chatbot.

**Request:**
```json
{
  "query": "What are the symptoms of fever?",
  "lang": "auto"
}
```

**Response:**
```json
{
  "reply": "Fever symptoms include elevated body temperature, chills, sweating...",
  "lang": "en"
}
```

### GET /health

Check server health status.

**Response:**
```json
{
  "status": "healthy",
  "watsonx_configured": true,
  "faiss_loaded": true
}
```

## Project Structure

```
backend/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── .env.example        # Example environment variables
├── .env                # Your environment variables (create this)
├── data/
│   └── faiss_index/   # FAISS index files
│       ├── faiss.index
│       ├── texts.pkl
│       └── metas.pkl
└── README.md
```

## Notes

- The backend uses a fallback generator if WatsonX is not configured
- Make sure CORS is enabled for frontend communication
- The embedding model is downloaded automatically on first run



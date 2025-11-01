# SwasthAI - Chatbot Frontend

A beautiful, modern chatbot interface built with React and TypeScript.

## Features

- 🎨 Light-themed, aesthetically pleasing UI
- 💬 Chat history sidebar
- 📱 Responsive design
- ⚡ Fast and lightweight
- 🔧 Ready for backend integration

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

## Project Structure

```
src/
  ├── components/
  │   ├── Sidebar.tsx       # Left sidebar with chat history
  │   ├── Sidebar.css
  │   ├── ChatArea.tsx      # Main chat interface
  │   └── ChatArea.css
  ├── services/
  │   └── api.ts           # API service for backend communication
  ├── App.tsx               # Main application component
  ├── App.css
  ├── main.tsx             # Entry point
  └── index.css            # Global styles
```

## Backend Setup

The backend is located in the `backend/` directory. See [backend/README.md](backend/README.md) for detailed setup instructions.

### Quick Start

1. **Install Backend Dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables:**
   
   Copy `.env.example` to `.env` in the `backend/` directory:
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Then edit `backend/.env` and add your WatsonX credentials:
   ```env
   WATSONX_API_KEY=your_api_key_here
   WATSONX_URL=https://us-south.ml.cloud.ibm.com
   WATSONX_PROJECT_ID=your_project_id_here
   FLASK_PORT=5050
   ```

3. **Set Up FAISS Index:**
   
   Make sure you have FAISS index files in `backend/data/faiss_index/`:
   - `faiss.index`
   - `texts.pkl`
   - `metas.pkl`

4. **Run the Backend:**
   ```bash
   cd backend
   python app.py
   ```
   
   The backend will run on `http://localhost:5050`

### Frontend Environment Variables

Optionally, create a `.env` file in the project root to customize the API URL:

```
VITE_API_URL=http://localhost:5050
```

If not set, it defaults to `http://localhost:5050`.

## Technologies Used

- React 18
- TypeScript
- Vite
- CSS3 (Modern styling with gradients and animations)

---

### **For more information, the presentation can be viewed [here](Public-Health-Chatbot/AI%20in%20Public%20Health.pdf).**

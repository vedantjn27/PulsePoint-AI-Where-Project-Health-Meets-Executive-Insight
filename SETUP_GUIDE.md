# 🛠️ PulsePoint AI — Setup Guide

> Complete step-by-step instructions to get PulsePoint AI running locally.

---

## 📋 Prerequisites

| Requirement | Version | Purpose |
|:---|:---|:---|
| **Python** | 3.11+ | Backend runtime |
| **Node.js** | 18+ | Frontend runtime |
| **npm** | 9+ | Package management |
| **Git** | Latest | Version control |
| **Mistral API Key** | — | Primary LLM provider ([console.mistral.ai](https://console.mistral.ai)) |

### Optional API Keys
| Provider | Purpose | Get Key At |
|:---|:---|:---|
| Groq | Fallback LLM | [console.groq.com](https://console.groq.com) |
| Google Gemini | Secondary fallback | [aistudio.google.com](https://aistudio.google.com) |

---

## 📥 Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/pulsepoint-ai.git
cd "PulsePoint AI - Where project health meets executive insight"
```

---

## 🐍 Step 2: Backend Setup

### 2.1 Create Virtual Environment

```bash
cd backend
python -m venv .venv
```

**Activate it:**

| OS | Command |
|:---|:---|
| Windows (PowerShell) | `.venv\Scripts\Activate.ps1` |
| Windows (CMD) | `.venv\Scripts\activate.bat` |
| macOS / Linux | `source .venv/bin/activate` |

### 2.2 Install Dependencies

```bash
pip install -r requirements.txt
```

**Core dependencies installed:**
| Package | Purpose |
|:---|:---|
| `fastapi` | REST API framework |
| `uvicorn` | ASGI server |
| `sqlalchemy` | ORM for SQLite |
| `pydantic` | Data validation |
| `apscheduler` | Weekly job scheduling |
| `python-pptx` | PowerPoint generation |
| `matplotlib` | Chart rendering |
| `pandas` | Data manipulation |
| `openpyxl` | XLSX parsing |
| `python-multipart` | File upload support |
| `httpx` | Async HTTP client |
| `pyyaml` | Config file parsing |
| `mistralai` | Mistral LLM SDK |
| `groq` | Groq LLM SDK |
| `google-generativeai` | Gemini LLM SDK |

### 2.3 Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
LLM_PROVIDER=mistral
MISTRAL_API_KEY=your_mistral_api_key_here
GROQ_API_KEY=your_groq_key_here          # Optional fallback
GEMINI_API_KEY=your_gemini_key_here      # Optional fallback
DATABASE_URL=sqlite:///./pulsepoint.db
SCHEDULER_CRON=0 8 * * MON
```

> **Note:** Only `MISTRAL_API_KEY` is required. Groq and Gemini are optional fallbacks.

### 2.4 Start the Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify it's running:**
- Open http://127.0.0.1:8000/health — should return `{"status": "ok"}`
- Open http://127.0.0.1:8000/docs — Swagger UI should load

> The database (`pulsepoint.db`) is created automatically on first startup. Sample data is auto-seeded when the dashboard is first accessed.

---

## 🖥️ Step 3: Frontend Setup

### 3.1 Install Dependencies

```bash
cd ../frontend
npm install
```

### 3.2 Configure API URL

The frontend is pre-configured via `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> Only change this if your backend runs on a different port.

### 3.3 Start the Frontend Dev Server

```bash
npm run dev
```

**Verify it's running:**
- Open http://127.0.0.1:5173 — the landing page should load

---

## ✅ Step 4: First-Time Verification

1. Open http://127.0.0.1:5173
2. Click **Get Started** on the landing page
3. Create a demo account:
   | Field | Value |
   |:---|:---|
   | Name | `Demo User` |
   | Email | `demo@pulsepoint.ai` |
   | Password | `demo123` |
4. Navigate to **System Health** (`/app/health`)
5. Confirm:
   - Service: `PulsePoint AI`
   - Status: `ok`
   - Database: Connected
6. Navigate to **Dashboard** (`/app/dashboard`)
7. Sample projects should auto-seed from the provided workbooks

> **Note:** Frontend auth is local browser storage only — it's for demo access control, not backend authentication.

---

## 🧪 Step 5: Run the Demo Flow

See [`MANUAL_TESTING_AND_DEMO_WORKFLOW.md`](MANUAL_TESTING_AND_DEMO_WORKFLOW.md) for the complete 20-step demo workflow. Quick highlights:

```
1. Dashboard      → Portfolio health overview
2. Projects       → View/create projects
3. Upload         → Upload XLSX/CSV/JSON → Validate → Analyze
4. Score Breakdown → Transparent scoring math
5. Ask Agent      → "Which project is most at risk?"
6. Synthesis      → Generate VP-ready PPTX deck
7. Alerts         → Review and acknowledge alerts
```

---

## 🐳 Docker Setup (Optional)

```bash
cd backend
docker-compose up --build
```

This starts the backend API at http://localhost:8000.

---

## 🔧 Troubleshooting

| Issue | Solution |
|:---|:---|
| Frontend can't connect to backend | Check `frontend/.env.local` has `VITE_API_BASE_URL=http://127.0.0.1:8000` |
| `ModuleNotFoundError` on backend | Ensure virtual environment is activated and `pip install -r requirements.txt` completed |
| LLM calls fail | Verify `MISTRAL_API_KEY` is set correctly in `backend/.env` |
| PDF export fails | Ensure the project has at least one scored snapshot — run Analyze first |
| Empty dashboard | Navigate to Demo Data (`/app/demo`) → Click "Reload sample workbook data" |
| Port 8000 already in use | Kill the existing process or use `--port 8001` |
| CORS errors | Ensure backend is running with the FastAPI CORS middleware configured |

---

## 📁 File Reference

| File | Purpose |
|:---|:---|
| `backend/.env.example` | Template for environment variables |
| `backend/requirements.txt` | Python dependencies |
| `frontend/package.json` | Node.js dependencies |
| `frontend/.env.local` | Frontend API URL config |
| `backend/app/scoring/scoring_config.yaml` | Scoring weights & thresholds |

---

<p align="center"><sub>📖 For the full feature set, see <a href="README.md">README.md</a> · For testing, see <a href="MANUAL_TESTING_AND_DEMO_WORKFLOW.md">Testing Guide</a></sub></p>

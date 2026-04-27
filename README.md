# LabGenius AI — Experiment & PPT Generator

AI-powered lab experiment file and presentation generator for Indian university students. Generate exam-ready content, modify specific sections, and download as PDF, Word, or PPT.

---

## Features

- **Course → Semester → Subject** cascading selection (B.Tech CSE, B.Tech IT, BCA, MCA)
- **Experiment Generator** — structured output: AIM, Theory, Source Code, Viva Voce, Output
- **PPT Generator** — slide-based presentation content
- **Section-wise Modification** — edit only theory, code, or viva without regenerating everything
- **Multi-format Download** — PDF (ReportLab), Word (python-docx), PPT (python-pptx)
- **Strict JSON Validation** — Pydantic schemas with retry on format failure

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Python 3.9+ / Flask |
| AI | Google Gemini 2.5 Flash (free tier) |
| PDF | ReportLab |
| Word | python-docx |
| PPT | python-pptx |

---

## Setup Instructions

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API Key** → **Create API Key**
3. Copy the key

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key
export GEMINI_API_KEY="your-api-key-here"

# Start the server (runs on port 5000)
python app.py
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (runs on port 5173)
npm run dev
```

### 4. Open the App

Go to **http://localhost:5173** in your browser.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/courses` | GET | Returns course/semester/subject tree |
| `/api/generate-experiment` | POST | Generates a full lab experiment |
| `/api/modify-section` | POST | Modifies a single section only |
| `/api/generate-ppt` | POST | Generates PPT slide content |
| `/api/download-experiment` | POST | Returns PDF or DOCX file |
| `/api/download-ppt` | POST | Returns PPTX file |

---

## Project Structure

```
backend/
├── app.py                  # Flask app factory
├── config.py               # Configuration
├── requirements.txt        # Python dependencies
├── data/courses.json       # Course/subject data
├── routes/
│   ├── experiment.py       # Experiment routes
│   ├── ppt.py              # PPT routes
│   └── download.py         # File download routes
├── services/
│   └── ai_service.py       # Gemini AI integration
└── utils/
    ├── pdf_generator.py    # ReportLab PDF
    ├── docx_generator.py   # python-docx Word
    └── pptx_generator.py   # python-pptx PPT

frontend/
├── src/
│   ├── App.jsx             # Main app component
│   ├── App.css             # All component styles
│   ├── index.css           # Design system tokens
│   ├── components/
│   │   └── Navbar.jsx      # Navigation bar
│   ├── pages/
│   │   ├── HomePage.jsx    # Course selection + mode select
│   │   └── ResultPage.jsx  # Experiment/PPT viewer + editing
│   └── services/
│       └── api.js          # Axios API client
```

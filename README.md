# EnglishBuddy

AI English Speaking Practice App — IELTS, Daily English, Job Interview

## Project Structure

```
EnglishBuddy/
├── backend/          # FastAPI Python backend
│   ├── main.py       # Entry point
│   ├── app/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── auth.py
│   │   ├── models.py
│   │   └── routes/   # transcribe, chat, tts, report, sessions, auth
│   ├── schema.sql    # Supabase DB schema
│   └── requirements.txt
│
├── frontend/         # Next.js 14 web app
│   └── src/app/
│       ├── page.tsx       # Landing page
│       ├── login/         # Login + Register
│       └── chat/          # Main practice UI
│
└── demo-v2.py        # Original Streamlit prototype (deprecated)
```

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Fill in your API keys
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
# .env.local already configured for local dev
npm run dev
```

Open http://localhost:3000

## Tech Stack

- **Backend**: FastAPI + Groq Whisper + DeepSeek + edge-tts + Supabase
- **Frontend**: Next.js 14 + TypeScript + Zustand
- **Database**: Supabase (PostgreSQL)

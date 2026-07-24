# 🧠 AI Resume Builder

A production-ready, AI-powered resume builder with live preview, PDF export, dark mode, and multiple templates — powered by Ollama (local AI, 100% free).

---

## 📸 Screenshots

| Home | AI Generation | PDF Export |
|------|---------------|------------|
| ![Home](images/home.png) | ![AI](images/ai.png) | ![PDF](images/pdf.png) |

---

## ✨ Features

- **Multi-step form** — Personal Info, Education, Skills, Experience, Projects
- **Live preview** — Resume updates in real-time as you type
- **AI-powered** — Generate professional summaries, improve bullet points & descriptions
- **PDF export** — Download ATS-friendly resume as PDF
- **2 Templates** — Classic (serif) and Modern (purple gradient header)
- **Dark / Light mode** — Persists across sessions
- **LocalStorage** — Auto-saves all form data
- **Security** — CSRF protection, XSS sanitization, CORS restriction, SSRF prevention

---

## 🛠 Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | HTML, CSS, Vanilla JavaScript     |
| Backend   | Node.js + Express                 |
| AI        | Ollama (llama3.1:8b) — local, free |
| PDF       | html2pdf.js (self-hosted)         |
| Security  | csrf-csrf, cookie-parser, dotenv  |

---

## 🚀 Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org) v18+
- [Ollama](https://ollama.com) installed and running

### 2. Install Ollama model

```bash
ollama pull llama3.1:8b
```

### 3. Clone and install

```bash
git clone <your-repo-url>
cd ai-resume-builder
npm install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
CLIENT_ORIGIN=http://localhost:3000
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b
OLLAMA_API_KEY=ollama
CSRF_SECRET=your-long-random-secret-here
```

### 5. Start the server

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
ai-resume-builder/
├── client/
│   ├── index.html          # Main UI
│   ├── style.css           # All styles + dark mode + templates
│   ├── app.js              # Frontend logic
│   └── html2pdf.min.js     # PDF export (self-hosted)
├── server/
│   ├── server.js           # Express entry point
│   ├── routes/
│   │   └── resume.js       # API route definitions
│   ├── controllers/
│   │   └── resumeController.js  # AI request handlers
│   └── utils/
│       └── openai.js       # Ollama client setup
├── .env                    # Environment variables (not committed)
├── .gitignore
└── package.json
```

---

## 🔌 API Endpoints

| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| GET    | `/api/csrf-token`         | Get CSRF token                     |
| POST   | `/api/generate-summary`   | Generate professional summary      |
| POST   | `/api/improve-content`    | Improve bullets or description     |

### POST `/api/generate-summary`
```json
{
  "personal":   { "fullName": "John Doe" },
  "skills":     { "technical": "JavaScript, Node.js" },
  "experience": [{ "title": "Engineer", "company": "Google", "duration": "2022-Present" }]
}
```

### POST `/api/improve-content`
```json
{
  "type":    "bullets",
  "content": "• Built APIs\n• Led team"
}
```

---

## 🌐 Deployment

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Set environment variables in Railway dashboard.

### Deploy to Render

1. Push code to GitHub
2. Create new Web Service on [render.com](https://render.com)
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables from `.env`

> **Note:** For cloud deployment, replace Ollama with [Groq](https://console.groq.com) (free) by changing `OLLAMA_BASE_URL` to `https://api.groq.com/openai/v1` and setting `OLLAMA_API_KEY` to your Groq key.

---

## 🔒 Security

- **CSRF** — Double-submit cookie pattern via `csrf-csrf`
- **XSS** — All user input sanitized before DOM injection
- **CORS** — Restricted to `CLIENT_ORIGIN`
- **SSRF** — API endpoints whitelisted, URLs anchored to `window.location.origin`
- **Payload guard** — 10kb request body limit

---

## 📜 License

MIT

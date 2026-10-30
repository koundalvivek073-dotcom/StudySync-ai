<div align="center">

# StudySync AI 🧠📅

### A healthier way to plan your study time.

Turn your syllabus into a personalized, difficulty-aware timetable—built around your energy, commitments, meals, and sleep.

[🚀 **Open the live app**](https://study-sync-ai-plum.vercel.app/upload) · [✨ Features](#features) · [🛠️ Run locally](#run-locally) · [▲ Deploy to Vercel](#deploy-to-vercel)

</div>

---

## How it works

**Upload a syllabus** → **Review its chapters and study topics** → **Set your routine** → **Generate your timetable** → **Export it as a PDF**

## Features

| | Feature | What it does |
|---|---|---|
| 📚 | **AI syllabus analysis** | Reads uploaded syllabi and separates chapters into specific topics, difficulty levels, and estimated study hours. |
| 🧠 | **Energy-aware planning** | Prioritizes harder topics during your peak-energy hours. |
| 🌿 | **Health-first schedule** | Respects sleep, meals, hygiene, breaks, and fixed commitments. |
| 📅 | **Flexible calendar** | Review your plan by day, week, or month. |
| ✅ | **Progress tracking** | Mark study sessions complete or pending. |
| 🔄 | **Smart reshuffling** | Find new slots for unfinished study sessions. |
| 📄 | **PDF export** | Save or print a polished copy of your timetable. |

## Run locally

**Requirements:** Node.js and npm.

```bash
git clone https://github.com/koundalvivek073-dotcom/StudySync-ai.git
cd StudySync-ai
npm ci
```

Create a `.env.local` file in the project root:

```env
META_MODEL_API_KEY=your-meta-model-api-key
NEXT_PUBLIC_USE_MOCK_AI=false
```

Create a key in the [Meta Model API dashboard](https://dev.meta.ai/). Keep it private: configure it only in the server environment, and never add a `NEXT_PUBLIC_` prefix.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. [Import the GitHub repository into Vercel](https://vercel.com/new).
2. Keep the project root at the repository root; Vercel detects Next.js automatically.
3. Add `META_MODEL_API_KEY` and `NEXT_PUBLIC_USE_MOCK_AI=false` under **Project Settings → Environment Variables**.
4. Deploy or redeploy the project.

The syllabus analysis route allows up to 60 seconds for AI document processing. In serverless deployments, SQLite is disabled because function storage is temporary. Syllabi and schedules are kept in the browser and do not sync between devices.

## Tech stack

- **Next.js 16** · **React 19** · **TypeScript**
- **Tailwind CSS v4** · **Zustand**
- **Meta Model API (Muse Spark 1.3)** for syllabus analysis
- **better-sqlite3** for local development
- **jsPDF** and **html2canvas** for PDF export

## Project structure

```text
app/
├── api/                  # Syllabus analysis and local database routes
├── dashboard/            # Timetable calendar and PDF export
├── questionnaire/        # Study routine setup
└── upload/               # Syllabus upload and review
lib/                      # Parsing, scheduling, persistence, and utilities
store/                    # Persisted application state
```

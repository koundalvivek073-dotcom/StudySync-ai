# StudySync AI 🧠📅

**Health-First, AI-Powered Study Timetable Maker**

Upload your syllabus → Answer 5 lifestyle questions → Get a personalized timetable → Export as PDF.

## 🌐 Live Demo

👉 **[https://study-sync-ai.netlify.app/](https://study-sync-ai.netlify.app/)**

| Page | URL |
|------|-----|
| 🏠 Home | https://study-sync-ai.netlify.app/ |
| 📄 Upload Syllabus | https://study-sync-ai.netlify.app//upload |
| 🧘 Questionnaire | https://study-sync-ai.netlify.app//questionnaire |
| 📅 Dashboard | https://study-sync-ai.netlify.app//dashboard |

## Quick Start (Local)

```bash
cd "d:\Timetable maker\studysync"
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- 📄 **Syllabus Parsing** — Upload PDF/PNG/JPG or use a built-in demo
- 🧘 **Health-First Scheduling** — Sleep, meals, hygiene are never overridden
- 🧠 **Peak-Energy Matching** — Hard topics during your best hours
- 📅 **Calendar Dashboard** — Day / Week / Month views
- ✅ **Task Status Rings** — Mark blocks completed or pending
- 🔄 **Auto Reshuffle** — Pending tasks moved to future free slots
- 📥 **PDF Export** — Styled, print-ready document
- 💾 **SQLite Database** — Data persists locally (no account needed)

## Architecture

```
app/
├── page.tsx               ← Landing page
├── upload/page.tsx        ← Step 1: Syllabus upload & AI parsing
├── questionnaire/page.tsx ← Step 2: 5-step lifestyle wizard
├── dashboard/page.tsx     ← Timetable calendar + PDF export
└── api/db/                ← SQLite API routes (local only)

lib/
├── types.ts              ← All TypeScript interfaces
├── scheduler.ts          ← Health-first scheduling engine
├── syllabusParser.ts     ← Mock/real AI parser
├── pdfExport.ts          ← jsPDF + html2canvas export
├── db.ts                 ← SQLite database layer
└── dbSync.ts             ← Client-side DB sync helpers

store/
└── appStore.ts           ← Zustand global state (localStorage persisted)
```

## Adding Real AI (Optional)

1. Set `NEXT_PUBLIC_USE_MOCK_AI=false` in `.env.local`
2. Add `OPENAI_API_KEY=sk-...` to `.env.local`
3. Implement `/app/api/parse-syllabus/route.ts` using OpenAI Vision

## Tech Stack

- **Next.js 16** + TypeScript + Tailwind CSS v4
- **Zustand** — state management with localStorage persistence
- **better-sqlite3** — local SQLite database (no account needed)
- **jsPDF + html2canvas** — client-side PDF generation
- **react-dropzone** — file drag & drop
- **date-fns** — date manipulation
- **lucide-react** — icons
- **Netlify** — hosting with `@netlify/plugin-nextjs`

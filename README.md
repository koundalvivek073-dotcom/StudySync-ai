# StudySync AI 🧠📅

**Health-First, AI-Powered Study Timetable Maker**

Upload your syllabus → Answer 5 lifestyle questions → Get a personalized timetable → Export as PDF.

## Quick Start (Local)

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push this repository to GitHub and [import it into Vercel](https://vercel.com/new).
2. Keep the project root directory set to the repository root. Vercel detects Next.js automatically; use `npm run build` as the build command.
3. In **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` — your key from [Google AI Studio](https://aistudio.google.com/app/apikey). Keep this server-only; do not prefix it with `NEXT_PUBLIC_`.
   - `NEXT_PUBLIC_USE_MOCK_AI` — set to `false` to use Gemini.
4. Redeploy after adding the environment variables.

The syllabus AI route allows up to 60 seconds for PDF analysis. SQLite persistence is disabled on Vercel because function storage is ephemeral; the timetable and syllabus are kept in the visitor's browser using local storage. They do not sync between devices or browsers.

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

## Tech Stack

- **Next.js 16** + TypeScript + Tailwind CSS v4
- **Zustand** — state management with localStorage persistence
- **better-sqlite3** — local SQLite database (no account needed)
- **jsPDF + html2canvas** — client-side PDF generation
- **react-dropzone** — file drag & drop
- **date-fns** — date manipulation
- **lucide-react** — icons
- **Vercel** — hosting and Next.js deployment

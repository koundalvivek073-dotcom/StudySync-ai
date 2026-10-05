# High-Level Design (HLD)

## 1. Overview

StudySync AI is a single-page web application built with Next.js. It enables users to upload a syllabus, parse it into academic topics, configure a study profile, generate a health-aware timetable, track study completion, and export the final schedule.

The system is intentionally designed around a local-first workflow: parsed syllabi, user profiles, generated schedules, and saved timetables are primarily managed on-device so the user can work without a central account or backend sync layer.

## 2. Goals and constraints

### Goals
- Convert raw syllabus documents into structured study data
- Schedule study blocks around real-life commitments and wellbeing
- Use user energy patterns to place harder work in higher-focus windows
- Keep the workflow fast, understandable, and exportable

### Constraints
- Browser-based app must work within client-side resource limits
- Inputs may be messy or partially structured
- AI parsing can be non-deterministic, so validation is required
- Local-first storage cannot assume permanent server persistence

## 3. System context

The application combines three main domains:

1. Input and parsing domain
   - Syllabus document upload
   - AI-based extraction and normalization
   - Validation against expected schema

2. Scheduling domain
   - User profile and daily constraints
   - Availability map with sleep, meals, hygiene, and commitments
   - Energy-based slot scoring and study allocation

3. Presentation and persistence domain
   - Dashboard views
   - Progress tracking
   - Local timetable history
   - PDF export and saved PDFs

## 4. High-level architecture

### 4.1 Frontend

The frontend is a set of Next.js pages and client components:

- app/upload/page.tsx — syllabus upload flow
- app/questionnaire/page.tsx — availability and health questionnaire
- app/dashboard/page.tsx — timetable review and schedule interactions
- app/page.tsx — landing and entry point

The user interface uses a Zustand store to manage global state:

- syllabus
- profile
- schedule
- current step
- warning state

### 4.2 Server-side parsing API

The AI parsing route lives at:

- app/api/parse-syllabus/route.ts

This route validates user inputs, calls Gemini-backed parsing logic, and normalizes the result into the domain model used across the app.

### 4.3 Core domain and scheduling logic

The core logic is split into modular libraries:

- lib/types.ts — shared domain types
- lib/syllabusParser.ts — normalization and validation of syllabus data
- lib/curriculumGenerator.ts — syllabus enrichment and topic generation
- lib/scheduler.ts — schedule generation and reshuffling logic
- lib/pdfExport.ts — PDF generation for print/export
- lib/localTimetableStorage.ts — device-local persistence
- lib/db.ts and lib/dbSync.ts — local SQLite or persisted schedule support when available

### 4.4 Persistence model

The architecture uses a hybrid local-first storage strategy:

- IndexedDB for timetable objects and PDF preview data
- localStorage metadata index for lightweight retrieval
- optional SQLite support for local development environments and direct DB-backed stores

This keeps the app useful even in serverless or browser-only deployments.

## 5. Major flows

### 5.1 Upload and parse flow

1. User uploads syllabus PDF or image.
2. Client sends request to parse API.
3. Server validates input and passes to Gemini or local parsing logic.
4. Parser returns structured subject/chapter/topic data.
5. Application normalizes output into ParsedSyllabus.
6. User reviews parsed syllabus and continues.

### 5.2 Questionnaire to schedule flow

1. User answers profile questions.
2. App saves AvailabilityProfile into global state.
3. Scheduler calculates blocked time windows from sleep, meals, hygiene, commitments, and buffers.
4. Scheduler finds free slots and assigns study sessions using difficulty-to-energy mapping.
5. App renders schedule and warns user of impossible constraints or underscheduled workloads.

### 5.3 Dashboard management flow

1. User inspects calendar views and block details.
2. User marks blocks completed or pending.
3. Scheduler or client logic reshuffles pending tasks into future available slots.
4. Saved state is updated locally and reflected in UI.

## 6. Core functional decomposition

### 6.1 Syllabus parsing

The parser must:
- interpret uploaded file or text
- identify subject, chapter, and topic hierarchy
- assign difficulty values
- estimate hours per topic
- add prerequisites where they exist
- validate the output before saving

This prevents downstream scheduling logic from consuming malformed or low-quality topic data.

### 6.2 Scheduling engine

The scheduling engine is the most important domain service. It operates in these stages:

1. Convert profile into a minute-level blocked map
2. Identify contiguous free windows
3. Partition free windows into candidate study sessions
4. Score each candidate based on energy level and user peak schedule
5. Match appropriate difficulty to the proper time-of-day tier
6. Allocate tasks across the horizon
7. Produce warnings when coverage is insufficient or unrealistic

### 6.3 Health-first design rules

The design intentionally prioritizes wellbeing constraints over pure academic utilization:

- sleep is non-negotiable
- meals and hygiene are fixed blocks
- commitments take precedence over study time
- transition buffer prevents unrealistic transitions
- low-energy periods are deprioritized for hard topics

## 7. Data model overview

Core domain objects are defined in lib/types.ts:

- TimeWindow
- AvailabilityProfile
- ParsedSyllabus
- SyllabusItem
- ScheduleBlock
- ReshuffleResult
- ScheduleResult

### Main relationships
- ParsedSyllabus contains a collection of SyllabusItem records
- AvailabilityProfile governs daily blocked windows and user routine
- ScheduleBlock represents scheduled time slots and can map back to a syllabus item
- ScheduleResult aggregates generated schedule content and warnings

## 8. Persistence architecture

### Local persistence goals
- Function in offline or low-connectivity environments
- Avoid depending on backend services for critical app actions
- Allow users to revisit and export prior plans

### Storage choices

- IndexedDB: stores full timetable objects and PDF data URI
- localStorage: stores lightweight metadata index for quick list display
- SQLite: optional local DB for development or edge deployments

## 9. Non-functional design

### Reliability
The app should have graceful degradation:
- invalid AI output results in a clear user-facing error
- missing database support falls back to browser local persistence
- generation warnings inform the user when the schedule is too compressed

### Performance
- The scheduler works with minute-resolution maps for realistic daily windows, which is efficient for a single-user plan.
- PDF export is deferred to user-triggered action and not required during initial scheduling.

### Privacy
- No requirement for persistent cloud accounts in the first phase
- Sensitive documents remain on-device unless the user chooses to export them
- Authentication is not a required system component in the initial design

## 10. Security and privacy considerations

- API keys remain server-side and are never exposed to the browser
- User-generated timetable data remains local first
- No need for broad user authorization or complex backend roles in the initial release

## 11. Observability and debugging

Use app logging and browser console diagnostics for:
- AI parsing validation failures
- schedule generation warnings
- persistence failures
- export issues

This is sufficient for a personal productivity tool at this phase.

## 12. Future extensions

Planned next iterations may include:
- improved academic subject ontology and curriculum matching
- user accounts and cloud sync
- collaborative scheduling or sharing
- adaptive scheduler learning based on completed sessions
- deeper analytics and streak tracking

## 13. Summary

StudySync AI follows a local-first, health-centric architecture that balances AI parsing, schedule optimization, and personal wellbeing. Its modular design keeps the product easy to evolve while preserving a simple user journey: upload syllabus → set routine → generate plan → track progress → export timetable.

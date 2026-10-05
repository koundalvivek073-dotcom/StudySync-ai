# Product Requirements Document (PRD)

## 1. Product summary

StudySync AI is a health-first study planner that converts a syllabus into a personalized timetable. The product accepts uploaded syllabus documents (PDF/images), uses AI to decompose them into subjects/chapters/topics, asks a short lifestyle questionnaire, and generates a schedule that respects sleep, meals, hygiene, fixed commitments, and user energy peaks.

The product is built as a Next.js web app and is optimized for single-device personal use, with local persistence for saved timetables and offline-friendly scheduling behavior.

## 2. Problem statement

Students and self-learners struggle to convert large academic workloads into realistic plans. Common pain points include:

- Syllabi are unstructured and hard to break into actionable study blocks.
- Students often ignore personal energy cycles, meals, sleep, and break needs.
- Random or generic schedules lead to burnout and inconsistent progress.
- Manually building a timetable is time-consuming and difficult to revise.

StudySync AI addresses this by combining AI parsing, health-aware scheduling, and adaptive timetable management in one workflow.

## 3. Product goals

### Primary goals
- Turn uploaded syllabus content into an actionable study plan.
- Optimize study sessions around user energy and daily routine.
- Protect user wellbeing by budgeting sleep, meals, hygiene, and rest.
- Let users review, adjust, and export study plans with minimal friction.

### Secondary goals
- Make the app useful for school, college, and self-study use cases.
- Keep all personal study data local to the user.
- Support iterative schedule reshuffling when tasks remain pending.

## 4. Target users

### Primary user personas
- Student with a large syllabus and fixed class schedule
- Working professional returning to study
- Self-studier preparing for exams or certifications
- Learner seeking a healthy, sustainable study rhythm

### User needs
- Need a study plan that respects real life and not just ideal academic time
- Need confidence that generated topics are meaningful and grouped accurately
- Need the ability to track sessions and reschedule unfinished work
- Need exportable output for printing and offline use

## 5. Scope

### In scope
- Syllabus upload via PDF or image
- Parsing and normalization of syllabus into subject > chapter > topic information
- User questionnaire for availability, commitments, meals, hygiene, sleep, and session length
- Health-first schedule generation with free-slot analysis
- Visualization by day/week/month
- Study block status tracking (upcoming, pending, completed)
- PDF export of the timetable
- Local storage of saved timetables

### Out of scope
- Multi-user collaboration
- Team-based timetable sharing
- Cloud sync across devices
- Full LMS integrations
- Social features or gamification

## 6. User flows

### Flow 1: New timetable creation
1. User uploads a syllabus file or enters a syllabus summary.
2. AI parses subject/chapter/topic structure.
3. User answers questionnaire about occupation, fixed commitments, sleep, meals, hygiene, session length, and peak energy period.
4. Product generates a personalized schedule.
5. User reviews timetable in dashboard and exports PDF if needed.

### Flow 2: Study progress management
1. User marks study blocks as completed or pending.
2. Pending blocks are rescheduled to future free time.
3. Dashboard updates to reflect new plan and progress state.

### Flow 3: Saved plan history
1. User saves a timetable locally.
2. The app stores metadata and optionally the PDF data URI.
3. User can reopen earlier plans from local history.

## 7. Functional requirements

### FR-1: Syllabus parsing
The product shall accept syllabus input in text, PDF, or image formats and output a structured syllabus model with:
- title
- subjects
- chapters
- topics
- difficulty labels
- estimated study hours
- prerequisite information

### FR-2: Profile configuration
The product shall collect or allow editing of:
- occupation type
- fixed commitments
- transition buffer
- meal windows and durations
- hygiene windows
- sleep hours and wake/bed times
- session length
- peak energy window
- schedule horizon

### FR-3: Schedule generation
The app shall generate a timetable that avoids collisions with:
- sleep blocks
- meal slots
- hygiene windows
- fixed commitments
- transition buffers

The algorithm shall allocate sessions based on topic difficulty and user peak-energy profile.

### FR-4: Progress tracking
The user shall be able to mark study blocks as:
- upcoming
- pending
- completed

Pending tasks must be eligible for reshuffle into later free slots.

### FR-5: Dashboard experience
The dashboard shall provide:
- daily, weekly, and monthly views
- subject color coding
- block metadata for each study session
- warnings for unrealistic or compressed schedules

### FR-6: Export
The product shall allow export or viewing of a PDF timetable.

### FR-7: Local persistence
The app shall persist generated timetables locally on the user device, including timetable metadata and if possible PDF preview data.

## 8. Non-functional requirements

### Performance
- File parsing should complete within a reasonable user timeout and show loading states.
- Scheduler should respond quickly for typical syllabus sizes (dozens to hundreds of topics).

### Reliability
- Generation must degrade gracefully if AI parsing fails or returns invalid output.
- Store operations must not block the user experience when history is unavailable.

### Privacy and security
- Sensitive academic data should remain local by default.
- API keys must be kept server-side and never exposed to the browser as public variables.
- Local data must be protected from accidental leakage via browser storage limitations and safe fallback handling.

### Accessibility and UX
- The UI should support keyboard focus and readable color contrast.
- Core flows should be understandable to non-technical users.

## 9. Business and product metrics

Success metrics for the product include:
- Users complete full upload-to-schedule flow
- Users save timetables and return to them later
- Users mark tasks complete and revise plans
- Users export or print the final timetable

## 10. Risks and assumptions

### Risks
- AI parsing accuracy may vary for messy or highly unstructured syllabus files.
- Some schedules may be unrealistic if the user sets a very short horizon or overloaded commitments.
- Browser-only persistence may be limited by local storage constraints or device-specific restrictions.

### Assumptions
- Users prefer health-first planning over maximum schedule density.
- Most study plans are personal and not shared across accounts.
- The app is primarily a personal productivity tool rather than enterprise software.

## 11. Acceptance criteria

### AC-1: Upload and parse
Given a valid syllabus PDF or text input, the user can upload it and see a structured syllabus summary with subject and chapter breakdowns.

### AC-2: Questionnaire completion
Given the user completes the lifestyle profile, the app stores the profile and generates a schedule consistent with the entered constraints.

### AC-3: Health guardrails
Given meal, sleep, or commitment windows overlap with study placement, the scheduler avoids creating invalid overlaps.

### AC-4: Rescheduling
Given a study task remains pending, the user can mark it and the system reshuffles it into future feasible slots.

### AC-5: Export
Given a valid generated schedule, the user can export or preview a PDF version.

### AC-6: Local persistence
Given a timetable is generated, the user can reopen or restore it from local history.

## 12. Release recommendation

The initial release should focus on single-user, local-first experience with high confidence in parsing and scheduling quality. The product is a strong fit for personal productivity, education, and self-improvement workflows.

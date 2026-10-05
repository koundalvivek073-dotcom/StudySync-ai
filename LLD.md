# Low-Level Design (LLD)

## 1. Scope

This document describes the concrete module-level implementation of StudySync AI, focusing on the actual code paths responsible for syllabus parsing, scheduling, local persistence, dashboard interaction, and PDF export.

## 2. File-level design

### Frontend pages

#### app/page.tsx
Responsibilities:
- landing page entry point
- shows product value proposition and CTA buttons
- loads saved timetable count from local storage
- opens saved timetable history modal
- allows quick access to dashboard and upload flow

Key logic:
- getStoredTimetablesList()
- handleSelectTimetable() restores a previously saved timetable into global state

#### app/upload/page.tsx
Responsibilities:
- upload syllabus PDF/image or text input
- submit to the parse API
- display parsing progress and validation feedback
- allow user to continue to questionnaire after parsing succeeds

#### app/questionnaire/page.tsx
Responsibilities:
- gather profile data in five steps
- capture occupation, commitments, health inputs, productivity profile, and timeline horizon
- compute schedule result and navigate to dashboard when ready

Implementation note:
- Uses defaultProfile with user-editable components and local state
- Calls generateSchedule() with the current syllabus and profile
- Saves a timetable after generation and before navigation

#### app/dashboard/page.tsx
Responsibilities:
- render the generated timetable in day/week/month views
- show block metadata, study status, and warnings
- allow toggling status for study blocks
- allow reshuffle actions and PDF export

## 3. Core domain model

Defined in lib/types.ts.

### Representative types

#### ParsedSyllabus
```ts
interface ParsedSyllabus {
  id: string;
  title: string;
  source?: string;
  subjects?: SubjectItem[];
  items: SyllabusItem[];
  totalHours: number;
  parseConfidence: number;
}
```

#### SyllabusItem
```ts
interface SyllabusItem {
  id: string;
  subject: string;
  chapter: string;
  topicName: string;
  difficulty: Difficulty;
  complexity: Difficulty;
  estimatedHours: number;
  prerequisites?: string[];
  color: string;
  completed?: number;
}
```

#### AvailabilityProfile
```ts
interface AvailabilityProfile {
  occupation: Occupation;
  fixedCommitments: TimeWindow[];
  transitionBuffer: number;
  meals: MealTimes;
  hygieneSlots: TimeWindow[];
  sleepHours: number;
  bedtime: string;
  wakeTime: string;
  sessionLength: SessionLength;
  peakEnergy: PeakEnergy;
  horizonDays: number;
  breakBetweenSessions: number;
}
```

#### ScheduleBlock
```ts
interface ScheduleBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: BlockType;
  syllabusItemId?: string;
  label: string;
  color: string;
  status?: BlockStatus;
  originalDate?: string;
  difficulty?: Difficulty;
  topicName?: string;
  chapterName?: string;
  subjectName?: string;
}
```

## 4. Parsing subsystem

### 4.1 File: app/api/parse-syllabus/route.ts

Main responsibilities:
- accept uploaded file or text input
- determine if the input is document-based or bare chapter text
- call Gemini parser or local parser fallback
- validate output structure
- normalize into ParsedSyllabus

### 4.2 Validation rules

The parser validates that:
- top-level subjects array exists and is non-empty
- each subject contains chapters
- each chapter contains at least three topic entries
- topic names are specific, not generic chapter titles
- difficulty values are within the allowed set
- estimated hours are valid positive numbers

### 4.3 Normalization

The parser calls normalizeToParsedSyllabus() from lib/syllabusParser to flatten the nested subject/chapter/topic structure into one consistent list of SyllabusItem objects.

This ensures downstream scheduling logic only works with a single normalized representation.

## 5. Scheduling subsystem

### 5.1 File: lib/scheduler.ts

This file is the scheduling engine. It contains the following main stages:

1. buildBlockedMap(profile)
   - creates a 1440-minute time map for the day
   - fills sleep, meal, hygiene, commitments, and transition blocks

2. findContiguousFreeWindows(map)
   - identifies free windows longer than 15 minutes

3. computeEnergyScore(startMin, profile)
   - calculates focus score based on peak-energy window
   - returns a value used to sort study sessions by quality

4. generateSchedule(syllabus, profile)
   - initializes topic progress objects
   - iterates through available days and free windows
   - assigns study blocks to items based on difficulty and urgency
   - respects session length and break between sessions
   - produces a ScheduleResult with coverage and warnings

### 5.2 Scheduling heuristic

The engine prioritizes:
- hard topics during the user’s peak focus window
- moderate tasks during secondary productive blocks
- easy tasks during low-energy periods

It also ensures that each topic’s total scheduled time is tracked and that tasks are distributed across the schedule horizon without violating fixed blocks.

### 5.3 Pseudocode

```ts
function generateSchedule(syllabus, profile) {
  const freeWindows = findContiguousFreeWindows(buildBlockedMap(profile));
  const topics = initializeTopicProgress(syllabus.items);
  const blocks = [];

  for (const window of freeWindows) {
    const session = createCandidateSession(window, profile.sessionLength);
    const item = selectBestTopic(topics, session, profile.peakEnergy);

    if (!item) continue;

    blocks.push(buildStudyBlock(item, session));
    reduceRemainingHours(item, session.durationMin);
  }

  return {
    blocks,
    warning: deriveScheduleWarning(topics, profile),
    netStudyHoursPerDay: calculateDailyStudyHours(blocks),
    totalScheduledHours: sum(blocks)
  };
}
```

## 6. Persistence subsystem

### 6.1 File: lib/localTimetableStorage.ts

Responsibilities:
- create and update timetable records
- store timetable metadata and full data in IndexedDB
- keep a lightweight localStorage metadata index for fast listing
- expose API methods like saveTimetableLocally(), getStoredTimetablesList(), getStoredTimetable()

### 6.2 Stored object shape

```ts
interface StoredTimetable {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  syllabus: ParsedSyllabus;
  profile: AvailabilityProfile;
  blocks: ScheduleBlock[];
  stats: {
    totalHours: number;
    horizonDays: number;
    totalSubjects: number;
    totalTopics: number;
    studyBlocksCount: number;
    completedBlocksCount: number;
  };
  pdfDataUri?: string;
}
```

### 6.3 Local behavior

When IndexedDB is unavailable, the app falls back to localStorage backups. Metadata is always cached in localStorage so the app can show saved history even if the database fails.

## 7. PDF export subsystem

### 7.1 File: lib/pdfExport.ts

Responsibilities:
- convert the current schedule into a print-friendly document
- generate a visual PDF using jsPDF / html2canvas-based techniques
- provide export and preview support for the dashboard

### 7.2 PDF flow

1. User clicks export button in dashboard.
2. App generates PDF data from current schedule and syllabus metadata.
3. PDF is displayed in-app or downloaded as a file.
4. The generated PDF data is optionally stored in local timetable history.

## 8. Dashboard interaction model

### 8.1 Client-side status tracking

The dashboard supports per-block state transitions:
- upcoming
- pending
- completed

The UI uses a modal that binds to each schedule block and renders:
- subject name
- chapter and topic data
- difficulty badge
- status controls

### 8.2 Reshuffle behavior

Pending study blocks are treated as flexible. The user can mark a session as pending, then future free slots are considered candidates for reallocation. This is the low-level mechanism that allows the timetable to adapt as study progress changes.

## 9. State management

The app uses a Zustand store with persisted application state.

### Store responsibilities
- hold syllabus model
- hold user profile
- hold generated schedule
- hold current workflow step
- hold formatting or warning states

This keeps key app data shared between upload, questionnaire, and dashboard pages without requiring a heavy backend state service.

## 10. Error-handling design

### Input validation errors
- uploaded file fails parse validation
- syllabus structure is empty or malformed
- Gemini returns insufficient topics

Handling:
- raise clear user-facing error messages
- stop progression to schedule stage
- ask user for corrected input or alternative source

### Persistence errors
- IndexedDB unavailable
- localStorage quota exceeded
- PDF generation failure

Handling:
- continue app operation
- show a warning but keep the schedule in memory
- fallback to in-memory or metadata-only storage

## 11. Testing strategy

### Unit tests recommended
- syllabus normalization and validation
- energy score calculations for different peak-energy profiles
- meal/commitment blocking logic
- schedule coverage and warning generation
- local storage round-trips

### Integration tests recommended
- upload → parse → questionnaire → schedule flow
- dashboard block status update and save flow
- export to PDF from a generated timetable

### Manual validation checks
- schedule never overlaps sleep, meals, hygiene, or fixed commitments
- hard topics are placed in peak-energy windows when possible
- user can reopen previously saved plans
- scheduling warnings appear when the horizon is unrealistic

## 12. Implementation constraints and assumptions

- The system assumes a single-user, local-first environment.
- AI parsing is a best-effort layer and must be validated before trust.
- PDF export is not a blocking step; it is mostly a user-initiated output action.
- The scheduler is heuristic-driven and optimized for realistic daily life, not perfect theoretical optimization.

## 13. Summary

The low-level design of StudySync AI is centered on a small set of well-defined modules: upload/parse, questionnaire profile collection, health-aware scheduling, blocked-time calculation, local storage, dashboard state updates, and PDF export. These components are intentionally decoupled enough to stay maintainable while remaining simple and fast for a personal productivity product.

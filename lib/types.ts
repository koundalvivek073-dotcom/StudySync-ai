// ─── Time Primitives ─────────────────────────────────────────────────────────

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface TimeWindow {
  start: string; // 'HH:MM' 24-hour
  end: string;   // 'HH:MM' 24-hour
  days?: DayOfWeek[]; // if undefined, applies every day
  label?: string;
}

// ─── Syllabus ────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Complexity = Difficulty; // backwards compatibility alias

export interface GranularTopic {
  id?: string;
  topicName: string;
  difficulty: Difficulty;
  estimatedHours: number;
  prerequisites?: string[];
  completed?: number;
}

export interface ChapterItem {
  id?: string;
  chapterName: string;
  topics: GranularTopic[];
}

export interface SubjectItem {
  id?: string;
  subjectName: string;
  color?: string;
  chapters: ChapterItem[];
}

export interface RawParsedSyllabusResponse {
  title?: string;
  parseConfidence?: number;
  subjects: {
    subjectName: string;
    chapters: {
      chapterName: string;
      topics: {
        topicName: string;
        difficulty: Difficulty;
        estimatedHours: number;
        prerequisites?: string[];
      }[];
    }[];
  }[];
}

export interface SyllabusItem {
  id: string;
  subject: string;
  chapter: string;
  topicName: string;
  difficulty: Difficulty;
  complexity: Difficulty; // backwards compatibility alias
  estimatedHours: number;
  prerequisites?: string[];
  color: string; // hex color auto-assigned
  completed?: number; // 0–100 percent
  subTopics?: string[]; // backwards compatibility
}

export interface ParsedSyllabus {
  id: string;           // unique ID for DB storage
  title: string;
  source?: string;      // 'upload' | 'demo' | filename
  subjects?: SubjectItem[];
  items: SyllabusItem[];
  totalHours: number;
  parseConfidence: number; // 0–1
}

// ─── Availability Profile ────────────────────────────────────────────────────

export type Occupation = 'self-study' | 'student' | 'working' | 'hybrid';
export type PeakEnergy = 'morning' | 'afternoon' | 'evening' | 'night';
export type SessionLength = 25 | 45 | 60 | 90;

export interface MealTimes {
  breakfast: string; // 'HH:MM'
  breakfastDuration: number; // minutes
  lunch: string;
  lunchDuration: number;
  dinner: string;
  dinnerDuration: number;
}

export interface AvailabilityProfile {
  occupation: Occupation;
  fixedCommitments: TimeWindow[];
  transitionBuffer: number; // minutes after each commitment
  meals: MealTimes;
  hygieneSlots: TimeWindow[];
  sleepHours: number; // e.g. 7.5
  bedtime: string; // 'HH:MM'
  wakeTime: string; // 'HH:MM'
  sessionLength: SessionLength;
  peakEnergy: PeakEnergy;
  horizonDays: number; // 1–730
  breakBetweenSessions: number; // minutes (10–15)
}

// ─── Schedule Blocks ─────────────────────────────────────────────────────────

export type BlockType =
  | 'study'
  | 'meal'
  | 'sleep'
  | 'hygiene'
  | 'break'
  | 'commitment'
  | 'buffer'
  | 'free';

export type BlockStatus = 'upcoming' | 'completed' | 'pending';

export interface ScheduleBlock {
  id: string;
  date: string; // ISO date 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  endTime: string;
  type: BlockType;
  syllabusItemId?: string;
  label: string;
  color: string;
  icon?: string;
  notes?: string;
  status?: BlockStatus; // only for study blocks
  originalDate?: string; // tracks if this block was reshuffled
  difficulty?: Difficulty;
  topicName?: string;
  chapterName?: string;
  subjectName?: string;
}

export interface ReshuffleResult {
  updatedBlocks: ScheduleBlock[];
  reshuffledCount: number;
  couldNotFitCount: number;
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  syllabus: ParsedSyllabus | null;
  profile: AvailabilityProfile | null;
  schedule: ScheduleBlock[];
  currentStep: number; // 0=landing, 1=upload, 2=questionnaire, 3=dashboard
  warning: string | null;
}

// ─── Schedule Generation Result ───────────────────────────────────────────────

export interface ScheduleResult {
  blocks: ScheduleBlock[];
  warning: string | null;
  netStudyHoursPerDay: number;
  totalScheduledHours: number;
  coveragePercent: number; // how much of syllabus is covered
}

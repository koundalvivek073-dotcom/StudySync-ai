// ─── Time Primitives ─────────────────────────────────────────────────────────

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface TimeWindow {
  start: string; // 'HH:MM' 24-hour
  end: string;   // 'HH:MM' 24-hour
  days?: DayOfWeek[]; // if undefined, applies every day
  label?: string;
}

// ─── Syllabus ────────────────────────────────────────────────────────────────

export type Complexity = 'easy' | 'medium' | 'hard';

export interface SyllabusItem {
  id: string;
  subject: string;
  chapter: string;
  subTopics: string[];
  complexity: Complexity;
  estimatedHours: number;
  color: string; // hex color auto-assigned
  completed?: number; // 0–100 percent
}

export interface ParsedSyllabus {
  title: string;
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

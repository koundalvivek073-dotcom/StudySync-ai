import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ParsedSyllabus, AvailabilityProfile, ScheduleBlock } from '@/lib/types';

interface AppStore {
  // Data
  syllabus: ParsedSyllabus | null;
  profile: AvailabilityProfile | null;
  schedule: ScheduleBlock[];
  warning: string | null;

  // UI state
  currentStep: number; // 0=landing 1=upload 2=questionnaire 3=dashboard
  isGenerating: boolean;

  // Actions
  setSyllabus: (s: ParsedSyllabus) => void;
  setProfile: (p: AvailabilityProfile) => void;
  setSchedule: (blocks: ScheduleBlock[], warning: string | null) => void;
  setStep: (n: number) => void;
  setGenerating: (b: boolean) => void;
  reset: () => void;
}

const defaultProfile: AvailabilityProfile = {
  occupation: 'student',
  fixedCommitments: [],
  transitionBuffer: 30,
  meals: {
    breakfast: '07:30', breakfastDuration: 20,
    lunch: '13:00', lunchDuration: 30,
    dinner: '19:30', dinnerDuration: 30,
  },
  hygieneSlots: [{ start: '07:00', end: '07:30', label: '🚿 Morning Routine' }],
  sleepHours: 7.5,
  bedtime: '23:00',
  wakeTime: '07:00',
  sessionLength: 45,
  peakEnergy: 'morning',
  horizonDays: 30,
  breakBetweenSessions: 10,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      syllabus: null,
      profile: null,
      schedule: [],
      warning: null,
      currentStep: 0,
      isGenerating: false,

      setSyllabus: (syllabus) => set({ syllabus }),
      setProfile: (profile) => set({ profile }),
      setSchedule: (schedule, warning) => set({ schedule, warning }),
      setStep: (currentStep) => set({ currentStep }),
      setGenerating: (isGenerating) => set({ isGenerating }),
      reset: () =>
        set({
          syllabus: null,
          profile: null,
          schedule: [],
          warning: null,
          currentStep: 0,
          isGenerating: false,
        }),
    }),
    {
      name: 'studysync-store',
      partialize: (state) => ({
        syllabus: state.syllabus,
        profile: state.profile,
        schedule: state.schedule,
        warning: state.warning,
      }),
    },
  ),
);

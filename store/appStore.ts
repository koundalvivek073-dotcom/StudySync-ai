import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ParsedSyllabus, AvailabilityProfile, ScheduleBlock, BlockStatus } from '@/lib/types';

// ─── Store Interface ──────────────────────────────────────────────────────────

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

  /** Mark a study block as 'completed' or 'pending' */
  markBlock: (id: string, status: BlockStatus) => void;

  /** Reshuffle all 'pending' study blocks into future free slots */
  reshufflePending: () => { reshuffledCount: number; couldNotFitCount: number };

  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
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

      // ── Mark block status ──────────────────────────────────────────────────
      markBlock: (id, status) => {
        set((state) => ({
          schedule: state.schedule.map((b) =>
            b.id === id && b.type === 'study' ? { ...b, status } : b,
          ),
        }));
      },

      // ── Reshuffle pending blocks into future free slots ────────────────────
      reshufflePending: () => {
        const { schedule, profile } = get();
        if (!profile) return { reshuffledCount: 0, couldNotFitCount: 0 };

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const currentMin = now.getHours() * 60 + now.getMinutes();

        // Collect blocks marked pending
        const pendingBlocks = schedule.filter(
          (b) => b.type === 'study' && b.status === 'pending',
        );

        // Keep all non-pending blocks
        let remaining = schedule.filter(
          (b) => !(b.type === 'study' && b.status === 'pending'),
        );

        if (pendingBlocks.length === 0) return { reshuffledCount: 0, couldNotFitCount: 0 };

        // Build minute-level occupancy map per day
        const occupied = new Map<string, Set<number>>();
        for (const b of remaining) {
          if (!occupied.has(b.date)) occupied.set(b.date, new Set());
          const s = toMin(b.startTime);
          const e = toMin(b.endTime);
          for (let m = s; m < e; m++) occupied.get(b.date)!.add(m);
        }

        const sessionLen = profile.sessionLength;
        const breakLen = profile.breakBetweenSessions;
        let reshuffledCount = 0;
        let couldNotFitCount = 0;

        for (const pending of pendingBlocks) {
          let placed = false;

          for (let dayOff = 0; dayOff < profile.horizonDays && !placed; dayOff++) {
            const d = new Date(now);
            d.setDate(d.getDate() + dayOff);
            const dateStr = d.toISOString().slice(0, 10);

            if (dateStr < todayStr) continue;

            if (!occupied.has(dateStr)) occupied.set(dateStr, new Set());
            const occ = occupied.get(dateStr)!;

            const needed = sessionLen + breakLen;
            let runStart = dateStr === todayStr ? currentMin + 5 : 0;

            while (runStart + sessionLen <= 1440) {
              let free = true;
              for (let m = runStart; m < runStart + needed && m < 1440; m++) {
                if (occ.has(m)) { free = false; break; }
              }

              if (free) {
                const newBlock: ScheduleBlock = {
                  ...pending,
                  id: Math.random().toString(36).slice(2, 10),
                  date: dateStr,
                  startTime: fromMin(runStart),
                  endTime: fromMin(runStart + sessionLen),
                  status: 'upcoming',
                  originalDate: pending.date,
                };

                for (let m = runStart; m < runStart + needed && m < 1440; m++) {
                  occ.add(m);
                }

                const breakBlock: ScheduleBlock = {
                  id: Math.random().toString(36).slice(2, 10),
                  date: dateStr,
                  startTime: fromMin(runStart + sessionLen),
                  endTime: fromMin(runStart + sessionLen + breakLen),
                  type: 'break',
                  label: '💧 Break',
                  color: '#1c1c2e',
                };

                remaining = [...remaining, newBlock, breakBlock];
                reshuffledCount++;
                placed = true;
                break;
              }
              runStart++;
            }
          }

          if (!placed) couldNotFitCount++;
        }

        set({ schedule: remaining });
        return { reshuffledCount, couldNotFitCount };
      },

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fromMin(m: number) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

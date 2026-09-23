/**
 * Health-First Scheduling Engine
 *
 * Algorithm:
 * 1. Build a minute-resolution blocked map for each day (Sleep, Meals, Hygiene, Commitments, Buffers)
 * 2. Find contiguous free slots >= 15 minutes
 * 3. Segment free slots into session blocks (based on profile.sessionLength) + breaks (profile.breakBetweenSessions)
 * 4. Score each session slot with its cognitive energy level (peak, moderate, low) based on user's peakEnergy profile
 * 5. Match granular syllabus topics:
 *    - HARD topics -> Peak energy slots (when cognitive capacity is highest)
 *    - MEDIUM topics -> Moderate energy slots
 *    - EASY topics & Revision -> Off-peak / low energy slots (preventing cognitive fatigue)
 * 6. Track topic progress across sessions with clean part numbering
 * 7. Provide full diagnostic coverage metrics and friendly warnings
 */

import { addDays, format } from 'date-fns';
import {
  AvailabilityProfile,
  BlockType,
  Difficulty,
  ParsedSyllabus,
  ScheduleBlock,
  ScheduleResult,
  SyllabusItem,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert 'HH:MM' → minutes since midnight */
const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Convert minutes since midnight → 'HH:MM' */
const fromMin = (m: number): string => {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ─── Block Builder ────────────────────────────────────────────────────────────

function makeBlock(
  date: string,
  startMin: number,
  durationMin: number,
  type: BlockType,
  label: string,
  color: string,
  syllabusItemId?: string,
  extra?: Partial<ScheduleBlock>,
): ScheduleBlock {
  return {
    id: uid(),
    date,
    startTime: fromMin(startMin),
    endTime: fromMin(startMin + durationMin),
    type,
    label,
    color,
    syllabusItemId,
    ...extra,
  };
}

// ─── Blocked-time Map ─────────────────────────────────────────────────────────

interface MinuteEntry {
  type: BlockType;
  label: string;
  color: string;
}

const BLOCK_COLORS: Record<BlockType, string> = {
  sleep: '#1e3a5f',
  meal: '#065f46',
  hygiene: '#4a1d96',
  commitment: '#7c2d12',
  buffer: '#374151',
  break: '#1f2937',
  study: '#1e40af',
  free: 'transparent',
};

function buildBlockedMap(profile: AvailabilityProfile): MinuteEntry[] {
  const map: MinuteEntry[] = Array.from({ length: 1440 }, () => ({
    type: 'free' as BlockType,
    label: '',
    color: 'transparent',
  }));

  const block = (start: number, end: number, type: BlockType, label: string) => {
    const color = BLOCK_COLORS[type];
    const s = Math.max(0, start);
    const e = Math.min(1440, end);
    for (let i = s; i < e; i++) map[i] = { type, label, color };
  };

  // Sleep — wraps midnight
  const bed = toMin(profile.bedtime);
  const wake = toMin(profile.wakeTime);
  const sleepMins = profile.sleepHours * 60;

  if (bed > wake) {
    // e.g. 23:00 → 06:30 (crosses midnight)
    block(bed, 1440, 'sleep', 'Sleep');
    block(0, wake, 'sleep', 'Sleep');
  } else {
    // nap-style same-day sleep
    block(bed, bed + sleepMins, 'sleep', 'Sleep');
  }

  // Meals
  const { meals } = profile;
  block(toMin(meals.breakfast), toMin(meals.breakfast) + meals.breakfastDuration, 'meal', '🍳 Breakfast');
  block(toMin(meals.lunch), toMin(meals.lunch) + meals.lunchDuration, 'meal', '🥗 Lunch');
  block(toMin(meals.dinner), toMin(meals.dinner) + meals.dinnerDuration, 'meal', '🍽️ Dinner');

  // Hygiene slots
  profile.hygieneSlots.forEach((slot) => {
    block(toMin(slot.start), toMin(slot.end), 'hygiene', slot.label ?? '🚿 Hygiene');
  });

  // Fixed commitments + transition buffer
  profile.fixedCommitments.forEach((slot) => {
    const s = toMin(slot.start);
    const e = toMin(slot.end);
    block(s, e, 'commitment', slot.label ?? '📌 Commitment');
    if (profile.transitionBuffer > 0) {
      block(e, e + profile.transitionBuffer, 'buffer', '☕ Transition buffer');
    }
  });

  return map;
}

// ─── Free Slot & Cognitive Energy Engine ──────────────────────────────────────

export type EnergyTier = 'peak' | 'moderate' | 'low';

export interface DailySessionSlot {
  startMin: number;
  durationMin: number;
  energyScore: number;
  tier: EnergyTier;
}

export function computeEnergyScore(startMin: number, profile: AvailabilityProfile): number {
  const h = (startMin / 60) % 24;
  switch (profile.peakEnergy) {
    case 'morning': {
      // 06:00 - 12:00 is peak morning focus (peak ~8:30-9:00 AM)
      if (h >= 6 && h <= 12) return Math.max(72, 100 - Math.abs(h - 9) * 5);
      if (h >= 16 && h <= 20) return 55; // secondary moderate evening bump
      if (h > 12 && h < 16) return 38;  // post-lunch dip
      return 25; // late night / early dawn
    }
    case 'afternoon': {
      // 12:00 - 17:00 is peak afternoon focus
      if (h >= 12 && h <= 17) return Math.max(72, 100 - Math.abs(h - 14.5) * 5);
      if (h >= 8 && h < 12) return 60; // moderate morning
      if (h >= 18 && h <= 21) return 45;
      return 25;
    }
    case 'evening': {
      // 16:30 - 22:00 is peak evening focus
      if (h >= 16.5 && h <= 22) return Math.max(72, 100 - Math.abs(h - 19) * 5);
      if (h >= 10 && h < 16.5) return 55; // moderate daytime
      return 25;
    }
    case 'night': {
      // 20:30 - 02:30 is peak night focus
      if (h >= 20.5 || h <= 2.5) {
        const dist = h >= 20.5 ? Math.abs(h - 23.5) : Math.abs(h + 24 - 23.5);
        return Math.max(72, 100 - dist * 6);
      }
      if (h >= 15 && h < 20.5) return 55; // moderate afternoon
      return 25;
    }
    default:
      return 50;
  }
}

export function getEnergyTier(score: number): EnergyTier {
  if (score >= 70) return 'peak';
  if (score >= 45) return 'moderate';
  return 'low';
}

interface FreeWindow {
  startMin: number;
  durationMin: number;
}

function findContiguousFreeWindows(map: MinuteEntry[]): FreeWindow[] {
  const windows: FreeWindow[] = [];
  let winStart: number | null = null;

  for (let i = 0; i <= 1440; i++) {
    const isFree = i < 1440 && map[i].type === 'free';
    if (isFree && winStart === null) winStart = i;
    if (!isFree && winStart !== null) {
      const dur = i - winStart;
      if (dur >= 15) {
        windows.push({ startMin: winStart, durationMin: dur });
      }
      winStart = null;
    }
  }

  return windows;
}

// ─── Main Scheduler ───────────────────────────────────────────────────────────

interface TopicProgress {
  item: SyllabusItem;
  totalMin: number;
  remainingMin: number;
  sessionsScheduled: number;
  totalSessionsNeeded: number;
  isCompleted: boolean;
}

export function generateSchedule(
  syllabus: ParsedSyllabus,
  profile: AvailabilityProfile,
): ScheduleResult {
  const blocks: ScheduleBlock[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Initialize progress trackers for every granular topic
  const topics: TopicProgress[] = syllabus.items.map((item) => {
    const totalMin = Math.round((item.estimatedHours || 1.5) * 60);
    const totalSessionsNeeded = Math.max(1, Math.ceil(totalMin / profile.sessionLength));
    return {
      item,
      totalMin,
      remainingMin: totalMin,
      sessionsScheduled: 0,
      totalSessionsNeeded,
      isCompleted: false,
    };
  });

  let totalScheduledMin = 0;
  const breakCost = profile.breakBetweenSessions;

  // Calculate canonical net study time per day for analytics
  const canonicalMap = buildBlockedMap(profile);
  const canonicalWindows = findContiguousFreeWindows(canonicalMap);
  let netMinPerDay = 0;
  for (const w of canonicalWindows) {
    netMinPerDay += w.durationMin;
  }

  for (let dayOffset = 0; dayOffset < profile.horizonDays; dayOffset++) {
    const date = format(addDays(today, dayOffset), 'yyyy-MM-dd');

    // 1. Add fixed blocks for this day
    const dayMap = buildBlockedMap(profile);

    // Sleep
    const bedMin = toMin(profile.bedtime);
    const wakeMin = toMin(profile.wakeTime);
    if (bedMin > wakeMin) {
      blocks.push(makeBlock(date, bedMin, 1440 - bedMin, 'sleep', '😴 Sleep', BLOCK_COLORS.sleep));
      blocks.push(makeBlock(date, 0, wakeMin, 'sleep', '😴 Sleep', BLOCK_COLORS.sleep));
    } else {
      blocks.push(makeBlock(date, bedMin, profile.sleepHours * 60, 'sleep', '😴 Sleep', BLOCK_COLORS.sleep));
    }

    // Meals
    const { meals } = profile;
    blocks.push(makeBlock(date, toMin(meals.breakfast), meals.breakfastDuration, 'meal', '🍳 Breakfast', BLOCK_COLORS.meal));
    blocks.push(makeBlock(date, toMin(meals.lunch), meals.lunchDuration, 'meal', '🥗 Lunch', BLOCK_COLORS.meal));
    blocks.push(makeBlock(date, toMin(meals.dinner), meals.dinnerDuration, 'meal', '🍽️ Dinner', BLOCK_COLORS.meal));

    // Hygiene
    profile.hygieneSlots.forEach((slot) => {
      const dur = toMin(slot.end) - toMin(slot.start);
      blocks.push(makeBlock(date, toMin(slot.start), dur, 'hygiene', slot.label ?? '🚿 Hygiene', BLOCK_COLORS.hygiene));
    });

    // Commitments + buffer
    profile.fixedCommitments.forEach((slot) => {
      const dur = toMin(slot.end) - toMin(slot.start);
      blocks.push(makeBlock(date, toMin(slot.start), dur, 'commitment', slot.label ?? '📌 Commitment', BLOCK_COLORS.commitment));
      if (profile.transitionBuffer > 0) {
        blocks.push(makeBlock(date, toMin(slot.end), profile.transitionBuffer, 'buffer', '☕ Buffer', BLOCK_COLORS.buffer));
      }
    });

    // 2. Extract free windows and partition into study sessions + breaks
    const freeWindows = findContiguousFreeWindows(dayMap).sort((a, b) => a.startMin - b.startMin);

    for (const win of freeWindows) {
      let cursor = win.startMin;
      const winEnd = win.startMin + win.durationMin;
      let isFirstInWindow = true;

      while (cursor < winEnd) {
        const remainingWin = winEnd - cursor;
        if (remainingWin < 15) break;

        // Check if all topics are already finished
        const hasUnfinished = topics.some((t) => !t.isCompleted);
        if (!hasUnfinished) break;

        // Insert break if consecutive session in the same window
        if (!isFirstInWindow) {
          if (cursor + breakCost > winEnd) break;
          blocks.push(makeBlock(date, cursor, breakCost, 'break', '💧 Break', BLOCK_COLORS.break));
          cursor += breakCost;
        }
        isFirstInWindow = false;

        const availableSessionTime = winEnd - cursor;
        if (availableSessionTime < 15) break;

        // Calculate slot cognitive energy
        const energyScore = computeEnergyScore(cursor, profile);
        const slotTier = getEnergyTier(energyScore);

        // 3. INTELLIGENT TOPIC-ENERGY MATCHING
        // Find the active candidate window of next eligible topics (respecting curriculum progression)
        const candidateWindow: TopicProgress[] = [];
        for (const t of topics) {
          if (!t.isCompleted) {
            candidateWindow.push(t);
            if (candidateWindow.length >= 4) break; // Look ahead up to 4 sequential topics
          }
        }

        if (candidateWindow.length === 0) break;

        // Match difficulty with slot energy tier:
        // Peak energy -> prioritize HARD topics
        // Low energy -> prioritize EASY topics or Revision
        // Moderate energy -> prioritize MEDIUM topics
        let selectedTopic: TopicProgress;

        if (slotTier === 'peak') {
          // Find hardest candidate
          const hardCandidate = candidateWindow.find((t) => t.item.difficulty === 'hard');
          const medCandidate = candidateWindow.find((t) => t.item.difficulty === 'medium');
          selectedTopic = hardCandidate || medCandidate || candidateWindow[0];
        } else if (slotTier === 'low') {
          // Find easiest candidate
          const easyCandidate = candidateWindow.find((t) => t.item.difficulty === 'easy');
          const medCandidate = candidateWindow.find((t) => t.item.difficulty === 'medium');
          selectedTopic = easyCandidate || medCandidate || candidateWindow[0];
        } else {
          // Moderate tier: prefer in-progress topic or medium
          const inProgress = candidateWindow.find((t) => t.sessionsScheduled > 0);
          const medCandidate = candidateWindow.find((t) => t.item.difficulty === 'medium');
          selectedTopic = inProgress || medCandidate || candidateWindow[0];
        }

        // Calculate session length
        const sessionMins = Math.min(
          profile.sessionLength,
          selectedTopic.remainingMin,
          availableSessionTime,
        );

        if (sessionMins < 15) break;

        selectedTopic.sessionsScheduled++;
        selectedTopic.remainingMin -= sessionMins;
        if (selectedTopic.remainingMin <= 0) {
          selectedTopic.isCompleted = true;
        }

        // Format informative label with topic name, part count, and energy indicator
        const topicName = selectedTopic.item.topicName || selectedTopic.item.chapter;
        const partInfo = selectedTopic.totalSessionsNeeded > 1
          ? ` (Part ${selectedTopic.sessionsScheduled}/${selectedTopic.totalSessionsNeeded})`
          : '';
        const energyBadge = slotTier === 'peak'
          ? ' · ⚡ Peak Focus'
          : slotTier === 'low'
          ? ' · 🌿 Light Review'
          : '';

        const sessionLabel = `📚 ${selectedTopic.item.subject}: ${topicName}${partInfo}${energyBadge}`;

        blocks.push(
          makeBlock(
            date,
            cursor,
            sessionMins,
            'study',
            sessionLabel,
            selectedTopic.item.color,
            selectedTopic.item.id,
            {
              difficulty: selectedTopic.item.difficulty,
              topicName: selectedTopic.item.topicName,
              chapterName: selectedTopic.item.chapter,
              subjectName: selectedTopic.item.subject,
              status: 'upcoming',
            },
          ),
        );

        cursor += sessionMins;
        totalScheduledMin += sessionMins;
      }
    }
  }

  const totalSyllabusMin = syllabus.totalHours * 60;
  const coveragePercent = Math.min(100, (totalScheduledMin / Math.max(1, totalSyllabusMin)) * 100);

  let warning: string | null = null;
  if (totalScheduledMin < totalSyllabusMin) {
    const shortfall = ((totalSyllabusMin - totalScheduledMin) / 60).toFixed(1);
    warning = `⚠️ Your available time covers only ${coveragePercent.toFixed(0)}% of your syllabus. You're ${shortfall} hours short. Consider extending your horizon or reducing fixed commitments.`;
  }

  return {
    blocks,
    warning,
    netStudyHoursPerDay: netMinPerDay / 60,
    totalScheduledHours: Math.round((totalScheduledMin / 60) * 10) / 10,
    coveragePercent: Math.round(coveragePercent),
  };
}

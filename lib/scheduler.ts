/**
 * Health-First Scheduling Engine
 *
 * Algorithm:
 * 1. Build a minute-resolution blocked map for a single canonical day
 * 2. Find all contiguous free slots ≥ sessionLength
 * 3. Score and sort slots by peak-energy preference
 * 4. Distribute SyllabusItems (harder → peak slots) across horizon days
 * 5. Insert mandatory break blocks between consecutive study blocks
 * 6. Emit a warning if total available time < required syllabus hours
 */

import { addDays, format } from 'date-fns';
import {
  AvailabilityProfile,
  BlockType,
  ParsedSyllabus,
  ScheduleBlock,
  ScheduleResult,
  SyllabusItem,
  TimeWindow,
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
    // Add transition buffer after
    if (profile.transitionBuffer > 0) {
      block(e, e + profile.transitionBuffer, 'buffer', '☕ Transition buffer');
    }
  });

  return map;
}

// ─── Free Slot Finder ─────────────────────────────────────────────────────────

interface FreeSlot {
  startMin: number;
  durationMin: number;
  energyScore: number; // higher = better for peak energy
}

function findFreeSlots(map: MinuteEntry[], profile: AvailabilityProfile): FreeSlot[] {
  const slots: FreeSlot[] = [];
  let slotStart: number | null = null;

  for (let i = 0; i <= 1440; i++) {
    const isFree = i < 1440 && map[i].type === 'free';
    if (isFree && slotStart === null) slotStart = i;
    if (!isFree && slotStart !== null) {
      const dur = i - slotStart;
      if (dur >= profile.sessionLength) {
        slots.push({
          startMin: slotStart,
          durationMin: dur,
          energyScore: computeEnergyScore(slotStart, profile),
        });
      }
      slotStart = null;
    }
  }

  return slots.sort((a, b) => b.energyScore - a.energyScore);
}

function computeEnergyScore(startMin: number, profile: AvailabilityProfile): number {
  const h = startMin / 60;
  switch (profile.peakEnergy) {
    case 'morning':    return h >= 5 && h <= 11 ? 100 - Math.abs(h - 8) * 5 : 20;
    case 'afternoon':  return h >= 12 && h <= 16 ? 100 - Math.abs(h - 14) * 5 : 20;
    case 'evening':    return h >= 17 && h <= 21 ? 100 - Math.abs(h - 19) * 5 : 20;
    case 'night':      return (h >= 21 || h <= 2) ? 80 : 20;
    default:           return 50;
  }
}

// ─── Main Scheduler ───────────────────────────────────────────────────────────

export function generateSchedule(
  syllabus: ParsedSyllabus,
  profile: AvailabilityProfile,
): ScheduleResult {
  const blocks: ScheduleBlock[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort items: hard first (gets best peak slots), then medium, then easy
  const complexityOrder = { hard: 0, medium: 1, easy: 2 };
  const sortedItems = [...syllabus.items].sort(
    (a, b) => complexityOrder[a.complexity] - complexityOrder[b.complexity],
  );

  // Queue: each item broken into sessionLength-sized chunks
  interface StudyChunk {
    item: SyllabusItem;
    remainingMin: number;
  }

  const queue: StudyChunk[] = sortedItems.map((item) => ({
    item,
    remainingMin: Math.round(item.estimatedHours * 60),
  }));

  let queueIdx = 0;
  let totalScheduledMin = 0;

  const blockedMap = buildBlockedMap(profile);
  const freeSlots = findFreeSlots(blockedMap, profile);

  // Net study time per day (minutes)
  let netMinPerDay = 0;
  for (const s of freeSlots) netMinPerDay += s.durationMin;
  // Subtract break time: every sessionLength block needs a break after
  const breakCost = profile.breakBetweenSessions;

  for (let dayOffset = 0; dayOffset < profile.horizonDays; dayOffset++) {
    const date = format(addDays(today, dayOffset), 'yyyy-MM-dd');

    // Add fixed blocks for this day
    const dayMap = buildBlockedMap(profile);

    // Add sleep block
    const bedMin = toMin(profile.bedtime);
    const wakeMin = toMin(profile.wakeTime);
    if (bedMin > wakeMin) {
      blocks.push(makeBlock(date, bedMin, 1440 - bedMin, 'sleep', '😴 Sleep', BLOCK_COLORS.sleep));
      // next day's sleep handled when dayOffset+1 comes
    } else {
      blocks.push(makeBlock(date, bedMin, profile.sleepHours * 60, 'sleep', '😴 Sleep', BLOCK_COLORS.sleep));
    }

    // Add meal blocks
    const { meals } = profile;
    blocks.push(makeBlock(date, toMin(meals.breakfast), meals.breakfastDuration, 'meal', '🍳 Breakfast', BLOCK_COLORS.meal));
    blocks.push(makeBlock(date, toMin(meals.lunch), meals.lunchDuration, 'meal', '🥗 Lunch', BLOCK_COLORS.meal));
    blocks.push(makeBlock(date, toMin(meals.dinner), meals.dinnerDuration, 'meal', '🍽️ Dinner', BLOCK_COLORS.meal));

    // Add hygiene blocks
    profile.hygieneSlots.forEach((slot) => {
      const dur = toMin(slot.end) - toMin(slot.start);
      blocks.push(makeBlock(date, toMin(slot.start), dur, 'hygiene', slot.label ?? '🚿 Hygiene', BLOCK_COLORS.hygiene));
    });

    // Add commitment blocks
    profile.fixedCommitments.forEach((slot) => {
      const dur = toMin(slot.end) - toMin(slot.start);
      blocks.push(makeBlock(date, toMin(slot.start), dur, 'commitment', slot.label ?? '📌 Commitment', BLOCK_COLORS.commitment));
      if (profile.transitionBuffer > 0) {
        blocks.push(makeBlock(date, toMin(slot.end), profile.transitionBuffer, 'buffer', '☕ Buffer', BLOCK_COLORS.buffer));
      }
    });

    // Fill free slots with study chunks
    const dayFreeSlots = findFreeSlots(dayMap, profile);
    for (const slot of dayFreeSlots) {
      let cursor = slot.startMin;
      const slotEnd = slot.startMin + slot.durationMin;
      let firstBlock = true;

      while (cursor < slotEnd && queueIdx < queue.length) {
        const chunk = queue[queueIdx];
        if (!firstBlock) {
          // Insert break
          if (cursor + breakCost > slotEnd) break;
          blocks.push(makeBlock(date, cursor, breakCost, 'break', '💧 Break', BLOCK_COLORS.break));
          cursor += breakCost;
        }
        firstBlock = false;

        const available = slotEnd - cursor;
        const sessionMins = Math.min(profile.sessionLength, chunk.remainingMin, available);
        if (sessionMins < 15) break; // too short to be useful

        blocks.push(
          makeBlock(
            date,
            cursor,
            sessionMins,
            'study',
            `📚 ${chunk.item.subject}: ${chunk.item.chapter}`,
            chunk.item.color,
            chunk.item.id,
          ),
        );
        cursor += sessionMins;
        totalScheduledMin += sessionMins;
        chunk.remainingMin -= sessionMins;

        if (chunk.remainingMin <= 0) queueIdx++;
      }
    }
  }

  const totalSyllabusMin = syllabus.totalHours * 60;
  const coveragePercent = Math.min(100, (totalScheduledMin / totalSyllabusMin) * 100);

  let warning: string | null = null;
  if (totalScheduledMin < totalSyllabusMin) {
    const shortfall = ((totalSyllabusMin - totalScheduledMin) / 60).toFixed(1);
    warning = `⚠️ Your available time covers only ${coveragePercent.toFixed(0)}% of your syllabus. You're ${shortfall} hours short. Consider extending your horizon or reducing fixed commitments.`;
  }

  return {
    blocks,
    warning,
    netStudyHoursPerDay: netMinPerDay / 60,
    totalScheduledHours: totalScheduledMin / 60,
    coveragePercent,
  };
}

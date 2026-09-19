'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  format, addDays, startOfWeek, addWeeks, addMonths,
  startOfMonth, getDaysInMonth, isSameDay,
} from 'date-fns';
import { useAppStore } from '@/store/appStore';
import { generateSchedule } from '@/lib/scheduler';
import { exportToPDF } from '@/lib/pdfExport';
import { ScheduleBlock, BlockStatus } from '@/lib/types';
import {
  Sparkles, Calendar, ChevronLeft, ChevronRight, Download,
  AlertTriangle, Clock, BookOpen, Heart, RotateCcw, Sun, Moon,
  Coffee, CheckCircle2, XCircle, HelpCircle, RefreshCw, X,
} from 'lucide-react';

type ViewMode = 'day' | 'week' | 'month';

// ─── Block Colors by type ─────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  sleep: '#1e3a5f',
  meal: '#064e3b',
  hygiene: '#3b0764',
  commitment: '#450a0a',
  buffer: '#1f2937',
  break: '#1c1c2e',
  study: '#1e40af',
  free: 'transparent',
};

const TYPE_TEXT: Record<string, string> = {
  sleep: '#60a5fa',
  meal: '#4ade80',
  hygiene: '#c084fc',
  commitment: '#f87171',
  buffer: '#9ca3af',
  break: '#6b7280',
  study: '#e0e7ff',
  free: '#374151',
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_RING: Record<string, string> = {
  completed: '0 0 0 2px #22c55e',   // green ring
  pending:   '0 0 0 2px #f59e0b',   // amber ring
  upcoming:  '0 0 0 2px #6366f144', // faint indigo ring
};

const STATUS_BADGE: Record<string, { icon: typeof CheckCircle2; label: string; color: string }> = {
  completed: { icon: CheckCircle2, label: 'Completed', color: '#22c55e' },
  pending:   { icon: XCircle,      label: 'Pending',   color: '#f59e0b' },
  upcoming:  { icon: HelpCircle,   label: 'Upcoming',  color: '#6366f1' },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// ─── Block Status Modal ───────────────────────────────────────────────────────

function BlockModal({
  block,
  syllabus,
  onClose,
  onMark,
}: {
  block: ScheduleBlock;
  syllabus: any;
  onClose: () => void;
  onMark: (id: string, status: BlockStatus) => void;
}) {
  const item = syllabus?.items.find((i: any) => i.id === block.syllabusItemId);
  const currentStatus: BlockStatus = block.status ?? 'upcoming';
  const { icon: StatusIcon, label: statusLabel, color: statusColor } = STATUS_BADGE[currentStatus];

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-80 rounded-2xl p-5 shadow-2xl"
        style={{ background: '#151522', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button className="absolute top-3 right-3 text-[#555] hover:text-white transition-colors" onClick={onClose}>
          <X size={16} />
        </button>

        {/* Block header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `${block.color}22`, border: `1px solid ${block.color}55` }}>
            📚
          </div>
          <div>
            <div className="font-bold text-sm text-white">{block.label}</div>
            <div className="text-xs text-[#666]">{block.startTime} – {block.endTime} · {block.date}</div>
          </div>
        </div>

        {/* Syllabus info */}
        {item && (
          <div className="rounded-xl p-3 mb-4 text-xs space-y-1"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="text-[#888]">Subject: <span className="text-white">{item.subject}</span></div>
            <div className="text-[#888]">Chapter: <span className="text-white">{item.chapter}</span></div>
            {item.subtopic && <div className="text-[#888]">Topic: <span className="text-white">{item.subtopic}</span></div>}
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold`}
              style={{ background: `${block.color}33`, color: block.color }}>
              {item.complexity} complexity
            </span>
          </div>
        )}

        {/* Reshuffled badge */}
        {block.originalDate && (
          <div className="text-[10px] text-amber-400 mb-3 flex items-center gap-1">
            <RefreshCw size={10} /> Reshuffled from {block.originalDate}
          </div>
        )}

        {/* Current status */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
          style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
          <StatusIcon size={14} style={{ color: statusColor }} />
          <span className="text-xs font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { onMark(block.id, 'completed'); onClose(); }}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
            style={{
              background: currentStatus === 'completed' ? '#22c55e33' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${currentStatus === 'completed' ? '#22c55e' : '#22c55e44'}`,
              color: '#22c55e',
            }}
          >
            <CheckCircle2 size={13} /> Mark Done
          </button>
          <button
            onClick={() => { onMark(block.id, 'pending'); onClose(); }}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
            style={{
              background: currentStatus === 'pending' ? '#f59e0b33' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${currentStatus === 'pending' ? '#f59e0b' : '#f59e0b44'}`,
              color: '#f59e0b',
            }}
          >
            <XCircle size={13} /> Mark Pending
          </button>
        </div>

        <p className="text-[10px] text-[#444] mt-3 text-center">
          Pending tasks will be reshuffled to future free slots
        </p>
      </div>
    </div>
  );
}

// ─── Status Ring Badge (small icon in corner of block) ───────────────────────

function StatusRing({ status }: { status?: BlockStatus }) {
  if (!status || status === 'upcoming') return null;
  const isCompleted = status === 'completed';
  return (
    <div
      className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center z-10"
      style={{
        background: isCompleted ? '#22c55e' : '#f59e0b',
        boxShadow: isCompleted ? '0 0 6px #22c55e99' : '0 0 6px #f59e0b99',
      }}
      title={isCompleted ? 'Completed' : 'Pending – will be reshuffled'}
    >
      {isCompleted
        ? <CheckCircle2 size={9} color="white" />
        : <XCircle size={9} color="white" />}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  date, blocks, syllabus, onBlockClick,
}: {
  date: Date; blocks: ScheduleBlock[]; syllabus: any;
  onBlockClick: (b: ScheduleBlock) => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayBlocks = blocks.filter((b) => b.date === dateStr);
  const HOUR_HEIGHT = 60;

  return (
    <div className="relative flex gap-0">
      {/* Time labels */}
      <div className="w-14 flex-shrink-0">
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="time-label flex items-start justify-end pr-2"
            style={{ height: HOUR_HEIGHT }}
          >
            {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 relative" style={{ height: 24 * HOUR_HEIGHT }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute w-full border-t border-[rgba(255,255,255,0.04)]"
            style={{ top: h * HOUR_HEIGHT }}
          />
        ))}

        {dayBlocks.map((block) => {
          const startMin = toMin(block.startTime);
          const endMin = toMin(block.endTime);
          const top = (startMin / 60) * HOUR_HEIGHT;
          const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 18);
          const bg = block.type === 'study' ? block.color : TYPE_COLORS[block.type] ?? '#1f2937';
          const textColor = block.type === 'study' ? '#fff' : TYPE_TEXT[block.type] ?? '#aaa';
          const ringStyle = block.type === 'study' && block.status
            ? STATUS_RING[block.status] : undefined;

          return (
            <div
              key={block.id}
              className="absolute left-0 right-0 mx-1 rounded schedule-block group cursor-pointer relative"
              style={{
                top, height, background: bg, color: textColor,
                border: `1px solid ${bg}88`,
                boxShadow: ringStyle,
                opacity: block.status === 'completed' ? 0.55 : 1,
                transition: 'opacity 0.2s, box-shadow 0.2s',
              }}
              onClick={() => block.type === 'study' && onBlockClick(block)}
            >
              <StatusRing status={block.status} />
              <span className="block truncate px-1 py-0.5 text-[10px] font-semibold pr-4">{block.label}</span>
              <span className="block truncate px-1 text-[9px] opacity-70">{block.startTime} – {block.endTime}</span>
            </div>
          );
        })}

        {/* Now indicator */}
        {format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
          <div
            className="absolute w-full h-0.5 bg-red-500 z-10 flex items-center"
            style={{ top: ((new Date().getHours() * 60 + new Date().getMinutes()) / 60) * HOUR_HEIGHT }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  weekStart, blocks, syllabus, onBlockClick,
}: {
  weekStart: Date; blocks: ScheduleBlock[]; syllabus: any;
  onBlockClick: (b: ScheduleBlock) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const HOUR_HEIGHT = 48;

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="flex">
        <div className="w-12 flex-shrink-0" />
        {days.map((d) => (
          <div key={d.toISOString()} className="flex-1 text-center py-2 text-xs font-semibold border-b border-[rgba(255,255,255,0.06)]">
            <div className={`${isSameDay(d, new Date()) ? 'text-primary-400' : 'text-[#888baa]'}`}>
              {format(d, 'EEE')}
            </div>
            <div className={`text-base font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto ${
              isSameDay(d, new Date()) ? 'bg-primary-500 text-white' : ''
            }`}>
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
        {/* Time labels */}
        <div className="w-12 flex-shrink-0">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="time-label flex items-start justify-end pr-2" style={{ height: HOUR_HEIGHT }}>
              {h % 3 === 0 ? (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`) : ''}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayBlocks = blocks.filter((b) => b.date === dateStr);

          return (
            <div key={dateStr} className="flex-1 relative border-l border-[rgba(255,255,255,0.04)]">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute w-full border-t border-[rgba(255,255,255,0.04)]" style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
              ))}

              {dayBlocks.map((block) => {
                const startMin = toMin(block.startTime);
                const endMin = toMin(block.endTime);
                const top = (startMin / 60) * HOUR_HEIGHT;
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 14);
                const bg = block.type === 'study' ? block.color : TYPE_COLORS[block.type] ?? '#1f2937';
                const ringStyle = block.type === 'study' && block.status
                  ? STATUS_RING[block.status] : undefined;

                return (
                  <div
                    key={block.id}
                    className="absolute inset-x-0.5 rounded schedule-block group cursor-pointer relative"
                    style={{
                      top, height,
                      background: `${bg}dd`,
                      borderLeft: `2px solid ${bg}`,
                      boxShadow: ringStyle,
                      opacity: block.status === 'completed' ? 0.5 : 1,
                      transition: 'opacity 0.2s, box-shadow 0.2s',
                    }}
                    onClick={() => block.type === 'study' && onBlockClick(block)}
                  >
                    <StatusRing status={block.status} />
                    <span className="block truncate px-1 text-[9px] font-semibold text-white/90 pt-0.5 pr-3">
                      {block.label.slice(0, 16)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  monthStart, blocks, onBlockClick,
}: {
  monthStart: Date; blocks: ScheduleBlock[];
  onBlockClick: (b: ScheduleBlock) => void;
}) {
  const daysInMonth = getDaysInMonth(monthStart);
  const firstDayOfWeek = (startOfMonth(monthStart).getDay() + 6) % 7;

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(startOfMonth(monthStart), i)),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs text-[#888baa] mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} className="h-20" />;
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayBlocks = blocks.filter((b) => b.date === dateStr && b.type === 'study');
          const isToday = isSameDay(day, new Date());
          const completedCount = dayBlocks.filter(b => b.status === 'completed').length;
          const pendingCount = dayBlocks.filter(b => b.status === 'pending').length;

          return (
            <div
              key={dateStr}
              className={`h-20 card p-1 overflow-hidden ${isToday ? 'border-primary-500' : ''}`}
            >
              <div className={`text-xs font-bold mb-1 w-5 h-5 rounded-full flex items-center justify-center ${
                isToday ? 'bg-primary-500 text-white' : 'text-[#888baa]'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayBlocks.slice(0, 3).map((block) => (
                  <div
                    key={block.id}
                    className="text-[8px] rounded px-1 truncate font-semibold flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                    style={{
                      background: `${block.color}33`,
                      color: block.color,
                      borderLeft: `2px solid ${block.status === 'completed' ? '#22c55e' : block.status === 'pending' ? '#f59e0b' : block.color}`,
                      opacity: block.status === 'completed' ? 0.6 : 1,
                    }}
                    onClick={() => onBlockClick(block)}
                  >
                    {block.status === 'completed' && '✅ '}
                    {block.status === 'pending' && '⏳ '}
                    {block.label.replace('📚 ', '').slice(0, 12)}
                  </div>
                ))}
                {dayBlocks.length > 3 && (
                  <div className="text-[8px] text-[#666]">+{dayBlocks.length - 3} more</div>
                )}
              </div>
              {/* Mini status counts */}
              {(completedCount > 0 || pendingCount > 0) && (
                <div className="flex gap-1 mt-0.5">
                  {completedCount > 0 && <span className="text-[7px] text-green-500">✅{completedCount}</span>}
                  {pendingCount > 0 && <span className="text-[7px] text-amber-500">⏳{pendingCount}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Health Summary Sidebar ───────────────────────────────────────────────────

function HealthSidebar({ profile, result, schedule }: { profile: any; result: any; schedule: ScheduleBlock[] }) {
  if (!profile) return null;

  const studyBlocks = schedule.filter(b => b.type === 'study');
  const completedCount = studyBlocks.filter(b => b.status === 'completed').length;
  const pendingCount = studyBlocks.filter(b => b.status === 'pending').length;
  const upcomingCount = studyBlocks.filter(b => !b.status || b.status === 'upcoming').length;

  const items = [
    { icon: Moon, label: 'Sleep', value: `${profile.sleepHours}h`, color: '#8b5cf6' },
    { icon: Sun, label: 'Wake Up', value: profile.wakeTime, color: '#f59e0b' },
    { icon: Coffee, label: 'Breakfast', value: profile.meals.breakfast, color: '#22c55e' },
    { icon: Clock, label: 'Study/day', value: result ? `${result.netStudyHoursPerDay.toFixed(1)}h` : '—', color: '#6366f1' },
    { icon: Heart, label: 'Coverage', value: result ? `${result.coveragePercent.toFixed(0)}%` : '—', color: '#ec4899' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-[#888baa] uppercase tracking-wide">Health Summary</h3>
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="card-inner flex items-center gap-3 p-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <div className="text-xs text-[#666]">{label}</div>
            <div className="text-sm font-bold">{value}</div>
          </div>
        </div>
      ))}

      {/* Task Progress */}
      <h3 className="font-bold text-sm text-[#888baa] uppercase tracking-wide mt-4">Task Progress</h3>
      <div className="card-inner p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={11} /> Done</span>
          <span className="font-bold text-green-400">{completedCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-amber-400"><XCircle size={11} /> Pending</span>
          <span className="font-bold text-amber-400">{pendingCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[#888]"><HelpCircle size={11} /> Upcoming</span>
          <span className="font-bold text-[#888]">{upcomingCount}</span>
        </div>
        {/* Progress bar */}
        {studyBlocks.length > 0 && (
          <div className="h-1.5 rounded-full bg-[#1a1a2e] overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
              style={{ width: `${(completedCount / studyBlocks.length) * 100}%` }}
            />
          </div>
        )}
        <div className="text-[10px] text-[#555] text-right">
          {studyBlocks.length > 0 ? Math.round((completedCount / studyBlocks.length) * 100) : 0}% complete
        </div>
      </div>

      {/* Subject Legend */}
      <h3 className="font-bold text-sm text-[#888baa] uppercase tracking-wide mt-4">Subjects</h3>
      {result?.syllabus?.items && (
        <div className="space-y-1">
          {[...new Set<string>(result.syllabus.items.map((i: any) => i.subject))].map((subject) => {
            const item = result.syllabus.items.find((i: any) => i.subject === subject);
            return (
              <div key={subject} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item?.color }} />
                <span className="text-xs text-[#aaa] truncate">{subject}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { syllabus, profile, schedule, warning, setSyllabus, setSchedule, markBlock, reshufflePending } = useAppStore();
  const [view, setView] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [reshuffleMsg, setReshuffleMsg] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Demo mode: if no data, load a demo
  useEffect(() => {
    if (!syllabus || schedule.length === 0) {
      (async () => {
        const { parseWithMock } = await import('@/lib/syllabusParser');
        const demoSyllabus = await parseWithMock(0);
        const demoProfile = {
          occupation: 'student' as const,
          fixedCommitments: [{ start: '09:00', end: '13:00', days: ['Mon','Tue','Wed','Thu','Fri'] as any, label: 'College' }],
          transitionBuffer: 30,
          meals: { breakfast: '07:30', breakfastDuration: 20, lunch: '13:30', lunchDuration: 30, dinner: '19:30', dinnerDuration: 30 },
          hygieneSlots: [{ start: '07:00', end: '07:30', label: '🚿 Morning Routine' }],
          sleepHours: 7.5,
          bedtime: '23:00',
          wakeTime: '07:00',
          sessionLength: 45 as const,
          peakEnergy: 'morning' as const,
          horizonDays: 14,
          breakBetweenSessions: 10,
        };
        const result = generateSchedule(demoSyllabus, demoProfile);
        setSyllabus(demoSyllabus);
        setSchedule(result.blocks, result.warning);
      })();
    }
  }, []);

  const navigate = (dir: 1 | -1) => {
    if (view === 'day') setCurrentDate((d) => addDays(d, dir));
    else if (view === 'week') setCurrentDate((d) => addWeeks(d, dir));
    else setCurrentDate((d) => addMonths(d, dir));
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);

  const headerLabel =
    view === 'day' ? format(currentDate, 'EEEE, MMMM d, yyyy') :
    view === 'week' ? `Week of ${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}` :
    format(monthStart, 'MMMM yyyy');

  const handleExport = async () => {
    if (!syllabus || !profile) return;
    setExporting(true);
    try {
      await exportToPDF({ syllabus, profile, blocks: schedule, elementId: 'schedule-capture' });
    } finally {
      setExporting(false);
    }
  };

  const handleReshuffle = () => {
    const result = reshufflePending();
    if (result.reshuffledCount === 0 && result.couldNotFitCount === 0) {
      setReshuffleMsg('No pending tasks to reshuffle.');
    } else {
      setReshuffleMsg(
        `✅ Reshuffled ${result.reshuffledCount} task${result.reshuffledCount !== 1 ? 's' : ''} to future slots.` +
        (result.couldNotFitCount > 0 ? ` ⚠️ ${result.couldNotFitCount} couldn't fit — extend your horizon.` : ''),
      );
    }
    setTimeout(() => setReshuffleMsg(null), 4000);
  };

  const handleMark = useCallback((id: string, status: BlockStatus) => {
    markBlock(id, status);
    // Update selectedBlock so the modal reflects the new status immediately
    setSelectedBlock(prev => prev?.id === id ? { ...prev, status } : prev);
  }, [markBlock]);

  // Stats
  const studyBlocks = schedule.filter((b) => b.type === 'study');
  const totalStudyMin = studyBlocks.reduce((acc, b) => acc + toMin(b.endTime) - toMin(b.startTime), 0);
  const pendingCount = studyBlocks.filter(b => b.status === 'pending').length;
  const completedCount = studyBlocks.filter(b => b.status === 'completed').length;

  return (
    <main className="min-h-screen bg-[#09090f] overflow-hidden">
      {/* Block Status Modal */}
      {selectedBlock && (
        <BlockModal
          block={selectedBlock}
          syllabus={syllabus}
          onClose={() => setSelectedBlock(null)}
          onMark={handleMark}
        />
      )}

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[#0d0d1a]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">StudySync <span className="gradient-text">AI</span></span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Reshuffle pending button */}
          {pendingCount > 0 && (
            <button
              onClick={handleReshuffle}
              className="btn btn-secondary flex items-center gap-1.5"
              style={{ borderColor: '#f59e0b55', color: '#f59e0b' }}
            >
              <RefreshCw className="w-4 h-4" />
              Reshuffle {pendingCount} Pending
            </button>
          )}

          {/* View Toggle */}
          <div className="glass flex rounded-lg overflow-hidden p-0.5 gap-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all capitalize ${
                  view === v ? 'bg-primary-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]' : 'text-[#888baa] hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button onClick={handleExport} disabled={exporting} className="btn btn-primary">
            {exporting ? <><Clock className="w-4 h-4 animate-spin" /> Exporting…</> : <><Download className="w-4 h-4" /> Export PDF</>}
          </button>

          <Link href="/questionnaire">
            <button className="btn btn-secondary">
              <RotateCcw className="w-4 h-4" /> Regenerate
            </button>
          </Link>
        </div>
      </nav>

      {/* Reshuffle feedback toast */}
      {reshuffleMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ background: '#151522', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
          {reshuffleMsg}
        </div>
      )}

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-[rgba(255,255,255,0.06)] p-4 overflow-y-auto bg-[#0d0d1a] hidden lg:block">
          <HealthSidebar
            profile={profile}
            schedule={schedule}
            result={syllabus ? {
              syllabus,
              netStudyHoursPerDay: (totalStudyMin / 60) / Math.max(1, [...new Set(schedule.map(b => b.date))].length),
              coveragePercent: syllabus ? Math.min(100, (totalStudyMin / 60 / syllabus.totalHours) * 100) : 0,
            } : null}
          />
        </aside>

        {/* Main calendar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Warning banner */}
          {warning && (
            <div className="warning-banner mx-4 mt-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 px-6 pt-2 text-[10px] text-[#555]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Completed (faded)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Pending → Reshuffle</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500/40 inline-block" /> Upcoming</span>
            <span className="ml-2 text-[#444]">Click any 📚 study block to mark it</span>
          </div>

          {/* Calendar header */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <button onClick={() => navigate(-1)} className="btn btn-ghost p-2">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary text-xs px-3 py-1.5">
              Today
            </button>
            <button onClick={() => navigate(1)} className="btn btn-ghost p-2">
              <ChevronRight className="w-4 h-4" />
            </button>
            <h2 className="font-bold text-base">{headerLabel}</h2>

            <div className="ml-auto flex items-center gap-3 text-xs text-[#666]">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-primary-400" /> {studyBlocks.length} blocks</span>
              <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" /> {completedCount} done</span>
              {pendingCount > 0 && <span className="flex items-center gap-1 text-amber-400"><XCircle className="w-3 h-3" /> {pendingCount} pending</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-green-400" /> {(totalStudyMin / 60).toFixed(1)}h</span>
            </div>
          </div>

          {/* Calendar body */}
          <div id="schedule-capture" ref={dashboardRef} className="flex-1 overflow-auto px-4 py-2">
            {view === 'day' && (
              <DayView date={currentDate} blocks={schedule} syllabus={syllabus} onBlockClick={setSelectedBlock} />
            )}
            {view === 'week' && (
              <WeekView weekStart={weekStart} blocks={schedule} syllabus={syllabus} onBlockClick={setSelectedBlock} />
            )}
            {view === 'month' && (
              <MonthView monthStart={monthStart} blocks={schedule} onBlockClick={setSelectedBlock} />
            )}
          </div>

          {/* Stats footer */}
          <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-2 bg-[#0d0d1a] flex flex-wrap gap-4 text-xs text-[#666]">
            {syllabus && (
              <>
                <span>📚 <strong className="text-white">{syllabus.title.slice(0, 40)}…</strong></span>
                <span>🎯 <strong className="text-white">{syllabus.totalHours}h</strong> syllabus</span>
                <span>✅ <strong className="text-white">{(totalStudyMin / 60).toFixed(1)}h</strong> scheduled</span>
                <span>📅 <strong className="text-white">{[...new Set(schedule.map(b => b.date))].length}</strong> days</span>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

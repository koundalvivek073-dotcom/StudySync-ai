'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, startOfWeek, addWeeks, addMonths, startOfMonth, getDaysInMonth, isSameDay, parseISO } from 'date-fns';
import { useAppStore } from '@/store/appStore';
import { generateSchedule } from '@/lib/scheduler';
import { exportToPDF } from '@/lib/pdfExport';
import { ScheduleBlock } from '@/lib/types';
import {
  Sparkles, Calendar, ChevronLeft, ChevronRight, Download,
  AlertTriangle, Clock, BookOpen, Heart, RotateCcw, Sun, Moon, Coffee
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

// ─── Utilities ────────────────────────────────────────────────────────────────

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// ─── Block Tooltip ────────────────────────────────────────────────────────────

function BlockTooltip({ block, syllabus }: { block: ScheduleBlock; syllabus: any }) {
  const item = syllabus?.items.find((i: any) => i.id === block.syllabusItemId);
  return (
    <div className="glass-strong rounded-lg p-3 text-xs min-w-[160px] shadow-xl z-50">
      <div className="font-semibold mb-1" style={{ color: block.color }}>{block.label}</div>
      <div className="text-[#888baa]">{block.startTime} – {block.endTime}</div>
      {item && (
        <div className="mt-2 space-y-1 text-[#aaa]">
          <div>📚 {item.subject}</div>
          <div>Chapter: {item.chapter}</div>
          <div className={`badge badge-${item.complexity} mt-1`}>{item.complexity}</div>
        </div>
      )}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, blocks, syllabus }: { date: Date; blocks: ScheduleBlock[]; syllabus: any }) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayBlocks = blocks.filter((b) => b.date === dateStr);
  const [hoveredBlock, setHoveredBlock] = useState<ScheduleBlock | null>(null);
  const HOUR_HEIGHT = 60; // px per hour

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
        {/* Hour lines */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute w-full border-t border-[rgba(255,255,255,0.04)]"
            style={{ top: h * HOUR_HEIGHT }}
          />
        ))}

        {/* Blocks */}
        {dayBlocks.map((block) => {
          const startMin = toMin(block.startTime);
          const endMin = toMin(block.endTime);
          const top = (startMin / 60) * HOUR_HEIGHT;
          const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 18);
          const bg = block.type === 'study' ? block.color : TYPE_COLORS[block.type] ?? '#1f2937';
          const textColor = block.type === 'study' ? '#fff' : TYPE_TEXT[block.type] ?? '#aaa';

          return (
            <div
              key={block.id}
              className="absolute left-0 right-0 mx-1 rounded schedule-block group"
              style={{ top, height, background: bg, color: textColor, border: `1px solid ${bg}88` }}
              onMouseEnter={() => setHoveredBlock(block)}
              onMouseLeave={() => setHoveredBlock(null)}
            >
              <span className="block truncate px-1 py-0.5 text-[10px] font-semibold">{block.label}</span>
              <span className="block truncate px-1 text-[9px] opacity-70">{block.startTime} – {block.endTime}</span>

              {/* Tooltip */}
              {hoveredBlock?.id === block.id && (
                <div className="absolute left-full ml-2 top-0 z-50 w-48">
                  <BlockTooltip block={block} syllabus={syllabus} />
                </div>
              )}
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

function WeekView({ weekStart, blocks, syllabus }: { weekStart: Date; blocks: ScheduleBlock[]; syllabus: any }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const HOUR_HEIGHT = 48;
  const [hoveredBlock, setHoveredBlock] = useState<ScheduleBlock | null>(null);

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

                return (
                  <div
                    key={block.id}
                    className="absolute inset-x-0.5 rounded schedule-block group"
                    style={{ top, height, background: `${bg}dd`, borderLeft: `2px solid ${bg}` }}
                    onMouseEnter={() => setHoveredBlock(block)}
                    onMouseLeave={() => setHoveredBlock(null)}
                  >
                    <span className="block truncate px-1 text-[9px] font-semibold text-white/90 pt-0.5">
                      {block.label.slice(0, 16)}
                    </span>
                    {hoveredBlock?.id === block.id && (
                      <div className="absolute left-full ml-1 top-0 z-50 w-44">
                        <BlockTooltip block={block} syllabus={syllabus} />
                      </div>
                    )}
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

function MonthView({ monthStart, blocks, syllabus }: { monthStart: Date; blocks: ScheduleBlock[]; syllabus: any }) {
  const daysInMonth = getDaysInMonth(monthStart);
  const firstDayOfWeek = (startOfMonth(monthStart).getDay() + 6) % 7; // 0=Mon

  const cells = Array.from({ length: firstDayOfWeek }, () => null).concat(
    Array.from({ length: daysInMonth }, (_, i) => addDays(startOfMonth(monthStart), i))
  );

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
                    className="text-[8px] rounded px-1 truncate font-semibold"
                    style={{ background: `${block.color}33`, color: block.color, borderLeft: `2px solid ${block.color}` }}
                  >
                    {block.label.replace('📚 ', '').slice(0, 14)}
                  </div>
                ))}
                {dayBlocks.length > 3 && (
                  <div className="text-[8px] text-[#666]">+{dayBlocks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Health Summary Sidebar ───────────────────────────────────────────────────

function HealthSidebar({ profile, result }: { profile: any; result: any }) {
  if (!profile) return null;

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
  const router = useRouter();
  const { syllabus, profile, schedule, warning, setSyllabus, setSchedule } = useAppStore();
  const [view, setView] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Demo mode: if no data, load a demo
  useEffect(() => {
    if (!syllabus || schedule.length === 0) {
      (async () => {
        const { parseWithMock } = await import('@/lib/syllabusParser');
        const { AvailabilityProfile } = await import('@/lib/types');
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
      await exportToPDF({
        syllabus,
        profile,
        blocks: schedule,
        elementId: 'schedule-capture',
      });
    } finally {
      setExporting(false);
    }
  };

  // Calculate stats
  const studyBlocks = schedule.filter((b) => b.type === 'study');
  const totalStudyMin = studyBlocks.reduce((acc, b) => {
    const s = toMin(b.startTime);
    const e = toMin(b.endTime);
    return acc + (e - s);
  }, 0);

  return (
    <main className="min-h-screen bg-[#09090f] overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[#0d0d1a]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">StudySync <span className="gradient-text">AI</span></span>
        </Link>

        <div className="flex items-center gap-2">
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

          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-primary"
          >
            {exporting ? <><Clock className="w-4 h-4 animate-spin" /> Exporting…</> : <><Download className="w-4 h-4" /> Export PDF</>}
          </button>

          <Link href="/questionnaire">
            <button className="btn btn-secondary">
              <RotateCcw className="w-4 h-4" /> Regenerate
            </button>
          </Link>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-[rgba(255,255,255,0.06)] p-4 overflow-y-auto bg-[#0d0d1a] hidden lg:block">
          <HealthSidebar
            profile={profile}
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
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-primary-400" /> {studyBlocks.length} study blocks</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-green-400" /> {(totalStudyMin / 60).toFixed(1)}h total</span>
            </div>
          </div>

          {/* Calendar body */}
          <div id="schedule-capture" ref={dashboardRef} className="flex-1 overflow-auto px-4 py-2">
            {view === 'day' && (
              <DayView date={currentDate} blocks={schedule} syllabus={syllabus} />
            )}
            {view === 'week' && (
              <WeekView weekStart={weekStart} blocks={schedule} syllabus={syllabus} />
            )}
            {view === 'month' && (
              <MonthView monthStart={monthStart} blocks={schedule} syllabus={syllabus} />
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

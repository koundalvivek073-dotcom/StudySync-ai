// components/ui/studysync-bento.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SubjectAllocation {
  subject: string;
  hours: number;
}

export interface ActivityFeedItem {
  id: string;
  kind: "plan" | "session" | "syllabus" | "streak";
  title: string;
  detail: string;
  status: "completed" | "in-progress" | "scheduled";
  time: string;
}

export interface PlanCard {
  id: string;
  label: string;
  code: string;
  author?: string;
  totalSessions: number;
  completedSessions: number;
  color: string;
  color2: string;
  ink: string;
}

export interface TodaySession {
  id: string;
  title: string;
  subject: string;
  startTime: string;
  endTime: string;
  status: "completed" | "pending" | "upcoming";
}

export interface StudySyncBentoProps {
  user?: string;
  history?: number[];
  historyLabels?: string[];
  benchmark?: number[];
  allocation?: SubjectAllocation[];
  activity?: ActivityFeedItem[];
  plans?: PlanCard[];
  todaySessions?: TodaySession[];
  accent?: string;
  accent2?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Demo Data                                                          */
/* ------------------------------------------------------------------ */

export const DEMO = {
  user: "Vivek",
  history: [1.5, 2.0, 3.5, 4.0, 2.5, 5.0, 4.5, 6.0, 3.0, 4.0, 5.5, 6.5, 7.0, 5.0, 6.0],
  benchmark: [2.0, 2.5, 3.0, 3.5, 3.0, 4.0, 4.0, 4.5, 4.0, 4.5, 5.0, 5.5, 5.0, 5.5, 5.5],
  allocation: [
    { subject: "Data Structures", hours: 18.5 },
    { subject: "System Design", hours: 12.0 },
    { subject: "Mathematics", hours: 8.5 },
    { subject: "Generative AI", hours: 6.0 },
    { subject: "Other", hours: 4.0 },
  ],
  plans: [
    { id: "p1", label: "End-Sem Prep", code: "SQUAD-176", author: "Core Syllabus", totalSessions: 42, completedSessions: 28, color: "oklch(0.89 0.2 128)", color2: "oklch(0.74 0.17 165)", ink: "oklch(0.22 0.06 140)" },
    { id: "p2", label: "LeetCode Grind", code: "DSA-JAVA", author: "Daily Practice", totalSessions: 30, completedSessions: 15, color: "oklch(0.8 0.1 300)", color2: "oklch(0.64 0.15 285)", ink: "oklch(0.2 0.06 290)" },
    { id: "p3", label: "Web3 & AI Project", code: "HACKATHON", author: "Side Build", totalSessions: 20, completedSessions: 18, color: "oklch(0.82 0.11 55)", color2: "oklch(0.7 0.15 30)", ink: "oklch(0.25 0.05 40)" },
  ],
  activity: [
    { id: "a1", kind: "session", title: "Array Transformations Sprint", detail: "25 min Focus • DSA Java", status: "completed", time: "10m ago" },
    { id: "a2", kind: "syllabus", title: "System Design Notes Parsed", detail: "AI extracted 6 modules", status: "completed", time: "1h ago" },
    { id: "a3", kind: "plan", title: "Weekly Timetable Regenerated", detail: "Adjusted for Friday lab", status: "in-progress", time: "3h ago" },
    { id: "a4", kind: "streak", title: "5-Day Focus Streak!", detail: "Target +2.5 hrs achieved", status: "completed", time: "1d ago" },
  ] as ActivityFeedItem[],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function useReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setR(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  return r;
}

function useMounted() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function smooth(pts: ReadonlyArray<readonly [number, number]>) {
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const [px, py] = pts[i - 1];
      const m = (px + x) / 2;
      return `C ${m.toFixed(1)} ${py.toFixed(1)}, ${m.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ------------------------------------------------------------------ */
/*  Shell & Reusable Components                                         */
/* ------------------------------------------------------------------ */

export function Tile({
  title,
  action,
  className,
  style,
  ariaLabelledBy,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ariaLabelledBy?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cx("relative flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-border bg-card p-5 text-card-foreground", className)}
      style={style}
      aria-labelledby={ariaLabelledBy}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-[13px] font-medium text-muted-foreground">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cx(
            "rounded-full px-2.5 py-1 font-mono text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            o === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero Tile: Welcome & Weekly Session Bar Chart                      */
/* ------------------------------------------------------------------ */

function HeroTile({ user, history, historyLabels, accent }: { user: string; history: number[]; historyLabels?: string[]; accent: string }) {
  const mounted = useMounted();
  const week = history.slice(-7);
  const maxVal = Math.max(...week, 8);
  const totalHours = week.reduce((s, x) => s + x, 0);
  const days = historyLabels?.slice(-week.length) ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [hover, setHover] = React.useState<number | null>(null);

  return (
    <Tile className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-1">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">
            Welcome back, <span style={{ color: accent }}>{user}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Build a study plan that fits around your classes & rest.</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-muted-foreground">This Week Focus</p>
          <p className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]">{totalHours.toFixed(1)}h</p>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums">
            <span style={{ color: accent }}>Completed focus</span>
            <span className="text-muted-foreground"> · last 7 days</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-2" style={{ minHeight: 64 }} onPointerLeave={() => setHover(null)}>
          {week.map((h, i) => {
            const heightPct = (h / maxVal) * 100;
            return (
              <button
                key={i}
                type="button"
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${days[i]}: ${h} hours`}
                className="relative flex-1 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  height: mounted ? `${heightPct}%` : "10%",
                  background: i === 6 ? accent : "var(--color-muted-foreground)",
                  opacity: hover === null ? (i === 6 ? 1 : 0.4) : hover === i ? 1 : 0.2,
                  transition: `height 900ms ${EASE} ${i * 30}ms, opacity 200ms ease`,
                }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          {days.map((d, i) => (
            <span key={d} className={hover === i ? "text-foreground font-bold" : ""}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Plans Tile: Fanned Stack of Active Study Plans                    */
/* ------------------------------------------------------------------ */

function PlansTile({ plans, reduced }: { plans: PlanCard[]; reduced: boolean }) {
  const [order, setOrder] = React.useState(() => plans.map((p) => p.id));
  const mounted = useMounted();
  const PEEK = 44;
  const visibleOrder = [
    ...order.filter((id) => plans.some((plan) => plan.id === id)),
    ...plans.map((plan) => plan.id).filter((id) => !order.includes(id)),
  ];
  const depth = visibleOrder.length - 1;
  const front = plans.find((p) => p.id === visibleOrder[visibleOrder.length - 1]);

  if (!front) {
    return (
      <Tile title="Saved Plans 0" className="lg:col-start-3 lg:row-start-1">
        <p className="text-sm text-muted-foreground">No saved plans yet.</p>
      </Tile>
    );
  }

  return (
    <Tile
      title={
        <span>
          Saved Plans <sup className="font-mono text-[10px]">{plans.length}</sup>
        </span>
      }
      className="lg:col-start-3 lg:row-start-1"
    >
      <div className="relative -mx-5 -mb-5 flex flex-1 flex-col justify-end overflow-hidden pt-1">
        <div className="relative">
          {visibleOrder.map((id, pos) => {
            const p = plans.find((x) => x.id === id)!;
            const fromFront = order.length - 1 - pos;
            const isFront = fromFront === 0;
            const progress = Math.round((p.completedSessions / p.totalSessions) * 100);

            return (
              <button
                key={id}
                type="button"
                onClick={() => !isFront && setOrder((current) => [...current.filter((x) => x !== id), id])}
                aria-label={`${p.label} plan, ${progress}% complete`}
                className="group absolute left-1/2 block w-[calc(100%-32px)] max-w-[300px] rounded-[14px] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  top: (depth - fromFront) * PEEK,
                  zIndex: pos + 1,
                  transform: `translateX(-50%) scale(${1 - fromFront * 0.055}) translateY(${mounted ? 0 : 20}px)`,
                  transformOrigin: "top center",
                  opacity: mounted ? 1 : 0,
                  color: p.ink,
                  background: `linear-gradient(135deg, ${p.color} 0%, ${p.color2} 100%)`,
                  boxShadow: "0 -8px 24px -10px oklch(0 0 0 / 0.6)",
                  transition: reduced
                    ? "none"
                    : `top 650ms ${EASE}, transform 650ms ${EASE}, opacity 500ms ease ${pos * 90}ms`,
                  cursor: isFront ? "default" : "pointer",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold tracking-wider opacity-80">{p.code}</span>
                  <span className="font-mono text-[12px] font-bold">{progress}%</span>
                </div>
                <p className="mt-2 truncate text-[15px] font-bold">{p.label}</p>
                <p className="text-[11px] opacity-75">{p.completedSessions}/{p.totalSessions} Sessions Completed</p>
              </button>
            );
          })}

          <div aria-hidden className="invisible mx-auto w-[calc(100%-32px)] max-w-[300px] shrink-0" style={{ marginTop: depth * PEEK }}>
            <div style={{ paddingTop: "35%" }} />
          </div>
        </div>

        <div
          className="relative z-10 flex shrink-0 items-end justify-between gap-3 px-5 pb-4"
          style={{
            height: 70,
            background: "color-mix(in oklch, var(--color-card) 75%, transparent)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid color-mix(in oklch, var(--color-foreground) 10%, transparent)",
          }}
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-[13px]">{front.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{front.author}</p>
          </div>
          <span className="shrink-0 font-mono text-[12px] font-bold" style={{ color: front.color }}>
            {front.completedSessions}/{front.totalSessions} Done
          </span>
        </div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Focus Tool Tile: Pomodoro Sprint Timer                             */
/* ------------------------------------------------------------------ */

function FocusToolTile({ accent }: { accent: string }) {
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
  const [isRunning, setIsRunning] = React.useState(false);

  React.useEffect(() => {
    if (!isRunning || secondsLeft === 0) return;
    const timeout = setTimeout(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      if (secondsLeft === 1) setIsRunning(false);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [isRunning, secondsLeft]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(25 * 60);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = ((25 * 60 - secondsLeft) / (25 * 60)) * 100;
  const strokeDasharray = 2 * Math.PI * 42;
  const strokeDashoffset = strokeDasharray * (1 - progress / 100);

  return (
    <Tile
      title="Focus Tool"
      className="lg:col-start-4 lg:row-start-1"
      action={
        <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          <span className={cx("size-1.5 rounded-full", isRunning ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground")} />
          {isRunning ? "In Sprint" : "Ready"}
        </span>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
          <svg width="110" height="110" className="-rotate-90">
            <circle cx="55" cy="55" r="42" fill="none" stroke="var(--color-muted)" strokeWidth="6" />
            <circle
              cx="55"
              cy="55"
              r="42"
              fill="none"
              stroke={accent}
              strokeWidth="6"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-mono text-[22px] font-bold tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-[9px] font-medium text-muted-foreground">MIN SPRINT</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={toggleTimer}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-mono text-[12px] font-semibold transition-all"
          style={{ background: accent, color: "oklch(0.2 0.05 130)" }}
        >
          <Play className="size-3.5 fill-current" />
          {isRunning ? "Pause" : "Start Focus"}
        </button>
        <button
          type="button"
          onClick={resetTimer}
          aria-label="Reset focus timer"
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart Tile: Focus Trend Analytics                                  */
/* ------------------------------------------------------------------ */

type Range = "1W" | "1M" | "All";

function ChartTile({ history, benchmark, accent }: { history: number[]; benchmark: number[]; accent: string }) {
  const uid = React.useId().replace(/:/g, "");
  const [range, setRange] = React.useState<Range>("1M");
  const mounted = useMounted();
  const W = 640;
  const H = 200;

  const rangeLength = range === "1W" ? 7 : range === "1M" ? 30 : history.length;
  const a = history.slice(-rangeLength);
  const b = benchmark.slice(-rangeLength);
  const lo = Math.min(...a, ...b, 0);
  const hi = Math.max(...a, ...b, 8);
  const y = (v: number) => H - 16 - ((v - lo) / (hi - lo || 1)) * (H - 40);

  const pa = a.map((v, i) => [(i / Math.max(a.length - 1, 1)) * W, y(v)] as const);
  const pb = b.map((v, i) => [(i / Math.max(b.length - 1, 1)) * W, y(v)] as const);
  const actualHours = a.reduce((sum, hours) => sum + hours, 0);
  const targetHours = b.reduce((sum, hours) => sum + hours, 0);
  const hasData = a.some((hours) => hours > 0) || b.some((hours) => hours > 0);

  return (
    <Tile
      title="Study Time vs Goal"
      className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2"
      action={<Pills label="Range" value={range} options={["1W", "1M", "All"]} onChange={setRange} />}
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="h-[3px] w-4 rounded-full" style={{ background: accent }} />
            Actual Focus Hours
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{actualHours.toFixed(1)} hrs</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
            Target Hours
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-muted-foreground">{targetHours.toFixed(1)} hrs</p>
        </div>
      </div>

      {hasData ? (
        <div className="relative mt-4 flex-1" style={{ minHeight: 180 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id={`${uid}-f`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" style={{ stopColor: accent, stopOpacity: 0.28 }} />
                <stop offset="1" style={{ stopColor: accent, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path d={`${smooth(pa)} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${uid}-f)`} style={{ opacity: mounted ? 1 : 0 }} />
            <path d={smooth(pb)} fill="none" strokeWidth={1.5} strokeDasharray="4 5" style={{ stroke: "var(--color-muted-foreground)" }} />
            <path d={smooth(pa)} fill="none" strokeWidth={2.5} strokeLinecap="round" style={{ stroke: accent }} />
          </svg>
        </div>
      ) : (
        <div className="mt-4 flex min-h-36 flex-1 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
          Your focus trend will appear after you create a study plan.
        </div>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Allocation Tile: Subject Time Breakdown                          */
/* ------------------------------------------------------------------ */

function AllocationTile({ allocation, accent, accent2 }: { allocation: SubjectAllocation[]; accent: string; accent2: string }) {
  const mounted = useMounted();
  const total = allocation.reduce((s, a) => s + a.hours, 0);
  const colors = [accent, accent2, "oklch(0.78 0.04 280)", "oklch(0.6 0.03 280)", "oklch(0.42 0.02 280)"];

  return (
    <Tile title="Subject Time Breakdown" className="lg:col-start-3 lg:row-start-2">
      <p className="font-mono text-[22px] font-semibold tabular-nums">{total.toFixed(1)} hrs planned</p>
      {allocation.length > 0 ? <>
      <div className="mt-4 flex h-8 gap-1">
        {allocation.map((a, i) => (
          <span
            key={a.subject}
            className="rounded-[6px]"
            style={{
              flexBasis: mounted
                ? `${total > 0 ? (a.hours / total) * 100 : 0}%`
                : `${allocation.length > 0 ? 100 / allocation.length : 0}%`,
              background: colors[i % colors.length],
              transition: `flex-basis 1000ms ${EASE} ${200 + i * 60}ms`,
            }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {allocation.map((a, i) => (
          <li key={a.subject} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 truncate">
              <span className="size-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
              <span className="truncate">{a.subject}</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{(total > 0 ? (a.hours / total) * 100 : 0).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
      </> : (
        <p className="mt-4 text-sm text-muted-foreground">Subject time will appear when a study plan is available.</p>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Coach Tile: Bright Accent Card for AI Syllabus Helper            */
/* ------------------------------------------------------------------ */

function AICoachTile() {
  return (
    <section
      className="relative flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-white/15 bg-white/[0.045] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl lg:col-start-4 lg:row-start-1"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white/75">AI Study Sync</h3>
        <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] font-semibold text-white/80">
          <Sparkles className="size-3 text-[#A3E635]" aria-hidden="true" /> Auto-Scheduler
        </span>
      </header>

      <p className="mt-5 font-mono text-[38px] font-semibold leading-none tracking-[-0.04em] text-[#D8F7A6]">
        Health-First
      </p>
      <p className="mt-1 text-[12px] font-medium text-white/65">A smarter schedule that respects your classes, focus, and rest.</p>

      <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-black/15 p-3 text-[12px] text-white/75">
        <p className="font-semibold text-white">Made for real life</p>
        <p>Upload your syllabus and build a balanced plan around your commitments.</p>
      </div>

      <div className="mt-auto pt-6">
        <LiquidButton
          asChild
          size="lg"
          className="isolate w-full overflow-hidden rounded-full border border-white/20 bg-white/[0.06] text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:border-white/30 hover:bg-white/[0.12] focus-visible:ring-[#A3E635]"
        >
          <Link href="/upload">
            <Upload aria-hidden="true" />
            Create a study plan
            <ArrowRight aria-hidden="true" />
          </Link>
        </LiquidButton>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Daily Sessions Tile: Active Timetable Sessions                    */
/* ------------------------------------------------------------------ */

function TodaySessionsTile({ accent, sessions }: { accent: string; sessions: TodaySession[] }) {
  return (
    <Tile title="Today’s Sessions" className="lg:col-start-3 lg:row-start-3">
      {sessions.length > 0 ? (
        <ul className="space-y-3">
          {sessions.slice(0, 3).map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="size-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{session.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {session.subject} · {session.startTime}–{session.endTime}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-semibold capitalize text-muted-foreground">{session.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No study sessions scheduled for today.</p>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Feed Tile                                                */
/* ------------------------------------------------------------------ */

function ActivityTile({ activity }: { activity: ActivityFeedItem[] }) {
  return (
    <Tile title="Schedule Feed & Logs" className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-4">
      <ul className="-mx-2 -my-1 space-y-1">
        {activity.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/50">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
              {a.kind === "session" ? <Clock className="size-4" /> : a.kind === "syllabus" ? <FileText className="size-4" /> : a.kind === "streak" ? <Flame className="size-4" /> : <CheckCircle2 className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{a.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{a.detail} • {a.time}</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400">{a.status}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component Export                                              */
/* ------------------------------------------------------------------ */

export function StudySyncBento({
  user = DEMO.user,
  history = DEMO.history,
  historyLabels,
  benchmark = DEMO.benchmark,
  allocation = DEMO.allocation,
  activity = DEMO.activity,
  plans = DEMO.plans,
  todaySessions = [],
  accent = "oklch(0.89 0.2 128)",
  accent2 = "oklch(0.74 0.12 300)",
  className,
}: StudySyncBentoProps) {
  const reduced = useReducedMotion();

  return (
    <div className={cx("w-full max-w-[1120px]", className)}>
      <nav className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">STUDYSYNC • OVERVIEW</span>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="rounded-full border border-border px-3 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Schedule
          </Link>
          <LiquidButton
            asChild
            size="sm"
            className="isolate overflow-hidden rounded-full border border-white/20 bg-white/[0.06] px-4 text-white backdrop-blur-xl hover:bg-white/[0.12] focus-visible:ring-[#A3E635]"
          >
            <Link href="/upload">
              <Upload aria-hidden="true" />
              Upload
              <ArrowRight aria-hidden="true" />
            </Link>
          </LiquidButton>
        </div>
      </nav>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroTile user={user} history={history} historyLabels={historyLabels} accent={accent} />
        <PlansTile plans={plans} reduced={reduced} />
        <AICoachTile />
        <FocusToolTile accent={accent} />
        <ChartTile history={history} benchmark={benchmark} accent={accent} />
        <AllocationTile allocation={allocation} accent={accent} accent2={accent2} />
        <TodaySessionsTile accent={accent} sessions={todaySessions} />
        <ActivityTile activity={activity} />
      </div>
    </div>
  );
}

export default StudySyncBento;

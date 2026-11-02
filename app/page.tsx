"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { useRouter } from "next/navigation";
import StudySyncBento, {
  type ActivityFeedItem,
  type PlanCard,
  type SubjectAllocation,
  type TodaySession,
} from "@/components/ui/studysync-bento";
import {
  getStoredTimetable,
  getStoredTimetablesList,
  type StoredTimetable,
  type StoredTimetableMeta,
} from "@/lib/localTimetableStorage";
import type { ScheduleBlock } from "@/lib/types";
import DataRain from "@/components/ui/data-rain";

const PLAN_COLORS = [
  ["oklch(0.89 0.2 128)", "oklch(0.74 0.17 165)", "oklch(0.22 0.06 140)"],
  ["oklch(0.8 0.1 300)", "oklch(0.64 0.15 285)", "oklch(0.2 0.06 290)"],
  ["oklch(0.82 0.11 55)", "oklch(0.7 0.15 30)", "oklch(0.25 0.05 40)"],
];

function durationHours(block: ScheduleBlock) {
  const [startHour, startMinute] = block.startTime.split(":").map(Number);
  const [endHour, endMinute] = block.endTime.split(":").map(Number);
  return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
}

function buildDashboardData(timetable: StoredTimetable | null, metadata: StoredTimetableMeta[]) {
  const blocks = timetable?.blocks.filter((block) => block.type === "study") ?? [];
  const today = new Date();
  const dates = Array.from({ length: 30 }, (_, index) => format(subDays(today, 29 - index), "yyyy-MM-dd"));
  const historyLabels = Array.from({ length: 30 }, (_, index) => format(subDays(today, 29 - index), "EEE"));
  const completedByDate = new Map<string, number>();
  const plannedByDate = new Map<string, number>();
  const subjectHours = new Map<string, number>();

  for (const block of blocks) {
    const hours = durationHours(block);
    plannedByDate.set(block.date, (plannedByDate.get(block.date) ?? 0) + hours);
    if (block.status === "completed") {
      completedByDate.set(block.date, (completedByDate.get(block.date) ?? 0) + hours);
    }

    const subject = block.subjectName || "Other";
    subjectHours.set(subject, (subjectHours.get(subject) ?? 0) + hours);
  }

  const plans: PlanCard[] = metadata.map((plan, index) => {
    const [color, color2, ink] = PLAN_COLORS[index % PLAN_COLORS.length];
    return {
      id: plan.id,
      label: plan.title,
      code: `PLAN-${String(index + 1).padStart(2, "0")}`,
      author: `${plan.totalSubjects} ${plan.totalSubjects === 1 ? "subject" : "subjects"}`,
      totalSessions: plan.studyBlocksCount,
      completedSessions: plan.completedBlocksCount,
      color,
      color2,
      ink,
    };
  });

  const activity: ActivityFeedItem[] = [...blocks]
    .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))
    .slice(0, 4)
    .map((block) => ({
      id: block.id,
      kind: "session",
      title: block.topicName || block.label,
      detail: `${block.subjectName || "Study session"} · ${block.status || "upcoming"}`,
      status: block.status === "completed" ? "completed" : block.status === "pending" ? "in-progress" : "scheduled",
      time: `${block.date} ${block.startTime}`,
    }));

  const todayKey = format(today, "yyyy-MM-dd");
  const todaySessions: TodaySession[] = blocks
    .filter((block) => block.date === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((block) => ({
      id: block.id,
      title: block.topicName || block.label,
      subject: block.subjectName || "Study session",
      startTime: block.startTime,
      endTime: block.endTime,
      status: block.status || "upcoming",
    }));

  const allocation: SubjectAllocation[] = [...subjectHours]
    .map(([subject, hours]) => ({ subject, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

  return {
    plans,
    activity,
    todaySessions,
    allocation,
    history: dates.map((date) => completedByDate.get(date) ?? 0),
    historyLabels,
    benchmark: dates.map((date) => plannedByDate.get(date) ?? 0),
  };
}

export default function HomePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<StoredTimetableMeta[]>([]);
  const [latestPlan, setLatestPlan] = useState<StoredTimetable | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReverseNavigating, setIsReverseNavigating] = useState(false);

  useEffect(() => {
    let scrollAccumulator = 0;
    let navigationTimeout: number | undefined;
    let navigating = false;

    const handleWheel = (event: WheelEvent) => {
      if (window.scrollY <= 0 && event.deltaY < 0) {
        scrollAccumulator += Math.abs(event.deltaY);
        if (scrollAccumulator > 120 && !navigating) {
          navigating = true;
          setIsReverseNavigating(true);
          navigationTimeout = window.setTimeout(() => {
            router.push("/hero?reverse=1");
          }, 180);
        }
      } else {
        scrollAccumulator = 0;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (navigationTimeout !== undefined) window.clearTimeout(navigationTimeout);
    };
  }, [router]);

  useEffect(() => {
    let active = true;
    const refreshPlans = async () => {
      try {
        const savedPlans = await getStoredTimetablesList();
        const latest = savedPlans.length > 0 ? await getStoredTimetable(savedPlans[0].id) : null;
        if (!active) return;
        setPlans(savedPlans);
        setLatestPlan(latest);
        setLoadError(null);
      } catch (error) {
        console.error("[Overview] Failed to load saved study plans:", error);
        if (active) setLoadError("Saved study plans could not be loaded. Please refresh and try again.");
      }
    };
    const handlePlansChanged = () => void refreshPlans();
    void refreshPlans();
    window.addEventListener("studysync_timetables_changed", handlePlansChanged);
    return () => {
      active = false;
      window.removeEventListener("studysync_timetables_changed", handlePlansChanged);
    };
  }, []);

  const dashboard = useMemo(() => buildDashboardData(latestPlan, plans), [latestPlan, plans]);

  return (
    <main className="relative isolate min-h-screen bg-transparent px-4 py-6 text-white sm:px-8 sm:py-10">
      <DataRain
        fullscreen
        className="pointer-events-none opacity-40"
        count={1500}
        flowSpeed={0.9}
        palette={{ calm: "#a3e635", mid: "#22e6ff", hot: "#ff3d9a" }}
      />
      <div className="relative z-10 mx-auto w-full max-w-[1160px]">
        {loadError && (
          <p role="alert" className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </p>
        )}
        <StudySyncBento
          user="Student"
          history={dashboard.history}
          historyLabels={dashboard.historyLabels}
          benchmark={dashboard.benchmark}
          allocation={dashboard.allocation}
          activity={dashboard.activity}
          plans={dashboard.plans}
          todaySessions={dashboard.todaySessions}
          className="max-w-none"
        />
      </div>
      {isReverseNavigating && (
        <div
          role="status"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F17]/90"
        >
          <span className="animate-pulse font-mono text-xs uppercase tracking-widest text-[#A3E635]">
            Reversing to Hero...
          </span>
        </div>
      )}
    </main>
  );
}

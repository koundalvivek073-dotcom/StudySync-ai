'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  Pause,
  Plus,
  RotateCcw,
  Sparkles,
  Play,
  Upload,
} from 'lucide-react';
import { addDays, format, isValid, startOfWeek } from 'date-fns';
import { useAppStore } from '@/store/appStore';
import SavedTimetablesModal from '@/components/SavedTimetablesModal';
import InAppPdfModal from '@/components/InAppPdfModal';
import DataRain from '@/components/ui/data-rain';
import {
  getStoredTimetablesList,
  getStoredTimetable,
  StoredTimetable,
  StoredTimetableMeta,
} from '@/lib/localTimetableStorage';

function formatPlanDate(value: string) {
  const date = new Date(value);
  return isValid(date) ? format(date, 'MMM d, yyyy') : 'Date unavailable';
}

export default function HomePage() {
  const router = useRouter();
  const { setSyllabus, setProfile, setSchedule, setActiveTimetableId } = useAppStore();
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState<StoredTimetableMeta[]>([]);
  const [activePlan, setActivePlan] = useState<StoredTimetable | null>(null);
  const [dashboardDate, setDashboardDate] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('Personalized Timetable');
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const focusSecondsRef = useRef(25 * 60);
  const greeting = 'Welcome back';

  const refreshSavedPlans = useCallback(() => {
    void getStoredTimetablesList()
      .then((plans) => Promise.resolve(plans.length > 0 ? getStoredTimetable(plans[0].id) : null)
        .then((latestPlan) => {
          const today = new Date();
          setPlansError(null);
          setSavedPlans(plans);
          setActivePlan(latestPlan);
          setDashboardDate(today);
          setSelectedDay((current) => current ?? format(today, 'yyyy-MM-dd'));
        }))
      .catch((error: unknown) => {
        console.error('[Home] Failed to load saved study plans:', error);
        setPlansError('Your saved plans could not be loaded. Please refresh and try again.');
      })
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    void refreshSavedPlans();
    window.addEventListener('studysync_timetables_changed', refreshSavedPlans);
    return () => window.removeEventListener('studysync_timetables_changed', refreshSavedPlans);
  }, [refreshSavedPlans]);

  const [isReverseNavigating, setIsReverseNavigating] = useState(false);

  useEffect(() => {
    let scrollAccumulator = 0;

    const handleWheel = (e: WheelEvent) => {
      // Trigger return to /hero when scrolling UP at top of page
      if (window.scrollY === 0 && e.deltaY < 0) {
        scrollAccumulator += Math.abs(e.deltaY);
        if (scrollAccumulator > 120 && !isReverseNavigating) {
          setIsReverseNavigating(true);
          setTimeout(() => {
            router.push("/hero?reverse=1");
          }, 180);
        }
      } else {
        scrollAccumulator = 0;
      }
    };

    window.addEventListener("wheel", handleWheel);
    return () => window.removeEventListener("wheel", handleWheel);
  }, [router, isReverseNavigating]);

useEffect(() => {
    if (!timerRunning) return;

    const interval = window.setInterval(() => {
      const next = Math.max(0, focusSecondsRef.current - 1);
      focusSecondsRef.current = next;
      setFocusSeconds(next);
      if (next === 0) setTimerRunning(false);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const handleSelectTimetable = async (id: string) => {
    const item = await getStoredTimetable(id);
    if (!item) {
      setPlansError('That saved plan is no longer available on this device.');
      return;
    }

    setSyllabus(item.syllabus);
    setProfile(item.profile);
    setActiveTimetableId(item.id);
    setSchedule(item.blocks, null);
    router.push('/dashboard');
  };

  const totalSessions = savedPlans.reduce((total, plan) => total + plan.studyBlocksCount, 0);
  const completedSessions = savedPlans.reduce((total, plan) => total + plan.completedBlocksCount, 0);
  const todayKey = dashboardDate ? format(dashboardDate, 'yyyy-MM-dd') : '';
  const currentWeekStart = dashboardDate ? startOfWeek(dashboardDate, { weekStartsOn: 1 }) : null;
  const weekDays = currentWeekStart
    ? Array.from({ length: 7 }, (_, index) => {
        const date = addDays(currentWeekStart, index);
        const dateKey = format(date, 'yyyy-MM-dd');
        const count = activePlan?.blocks.filter((block) => block.type === 'study' && block.date === dateKey).length ?? 0;
        return { date, dateKey, count };
      })
    : [];
  const selectedDayKey = selectedDay ?? todayKey;
  const dayBlocks = activePlan?.blocks
    .filter((block) => block.type === 'study' && block.date === selectedDayKey)
    .sort((first, second) => first.startTime.localeCompare(second.startTime)) ?? [];
  const selectedDayDate = weekDays.find((day) => day.dateKey === selectedDayKey)?.date;

  const subjectNamesById = new Map(
    (activePlan?.syllabus.items ?? []).map((item) => [item.id, item.subject]),
  );
  const subjectColors = new Map(
    (activePlan?.syllabus.items ?? []).map((item) => [item.subject, item.color]),
  );
  const subjectStats = new Map<string, { sessions: number; completed: number }>();
  for (const item of activePlan?.syllabus.items ?? []) {
    if (!subjectStats.has(item.subject)) subjectStats.set(item.subject, { sessions: 0, completed: 0 });
  }
  for (const block of activePlan?.blocks ?? []) {
    if (block.type !== 'study') continue;
    const subject = block.subjectName ?? subjectNamesById.get(block.syllabusItemId ?? '') ?? 'Other';
    const stats = subjectStats.get(subject) ?? { sessions: 0, completed: 0 };
    stats.sessions += 1;
    if (block.status === 'completed') stats.completed += 1;
    subjectStats.set(subject, stats);
  }
  const subjects = Array.from(subjectStats, ([name, stats]) => ({
    name,
    ...stats,
    color: subjectColors.get(name) || '#c5ee83',
  }))
    .sort((first, second) => second.sessions - first.sessions || first.name.localeCompare(second.name))
    .slice(0, 5);
  const focusTimeLabel = `${String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:${String(focusSeconds % 60).padStart(2, '0')}`;
  const focusProgress = (25 * 60 - focusSeconds) / (25 * 60);
  const weekSessionCount = weekDays.reduce((total, day) => total + day.count, 0);

  const toggleFocusTimer = () => {
    if (focusSeconds === 0) {
      focusSecondsRef.current = 25 * 60;
      setFocusSeconds(25 * 60);
    }
    setTimerRunning((running) => !running);
  };

  const resetFocusTimer = () => {
    focusSecondsRef.current = 25 * 60;
    setFocusSeconds(25 * 60);
    setTimerRunning(false);
  };

  return (
    <main className="workspace-app relative isolate">
      <DataRain
        fullscreen={true}
        className="-z-10 pointer-events-none opacity-40"
        count={1500}
        flowSpeed={0.9}
        palette={{ calm: "#a3e635", mid: "#22e6ff", hot: "#ff3d9a" }}
      />
      <aside className="workspace-sidebar relative z-20">
        <Link href="/" className="workspace-brand" aria-label="StudySync overview">
          <span className="workspace-brand-mark"><Sparkles size={17} aria-hidden="true" /></span>
          <span>StudySync</span>
        </Link>

        <p className="workspace-nav-label">WORKSPACE</p>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          <Link href="/" className="workspace-nav-item workspace-nav-item-active" aria-current="page">
            <LayoutDashboard size={18} aria-hidden="true" />
            <span>Overview</span>
          </Link>
          <Link href="/dashboard" className="workspace-nav-item">
            <CalendarDays size={18} aria-hidden="true" />
            <span>My schedule</span>
          </Link>
          <button type="button" className="workspace-nav-item" onClick={() => setSavedModalOpen(true)}>
            <History size={18} aria-hidden="true" />
            <span>Saved plans</span>
            <span className="workspace-nav-count">{savedPlans.length}</span>
          </button>
        </nav>

        <div className="workspace-sidebar-bottom">
          <div className="workspace-sidebar-note">
            <span className="workspace-sidebar-note-icon"><CheckCircle2 size={16} aria-hidden="true" /></span>
            <span><strong>Made for real life</strong><small>Rest belongs in the plan.</small></span>
          </div>
          <span className="workspace-version">STUDYSYNC · PERSONAL WORKSPACE</span>
        </div>
      </aside>

      <div className="workspace-main relative z-10">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>Overview</strong>
          </div>
          <div className="workspace-topbar-actions">
            <button type="button" className="workspace-history-button" onClick={() => setSavedModalOpen(true)}>
              <History size={16} aria-hidden="true" />
              <span>Saved plans</span>
              <span className="workspace-nav-count">{savedPlans.length}</span>
            </button>
            <Link href="/upload" className="workspace-create-button">
              <Plus size={17} aria-hidden="true" />
              <span>New plan</span>
            </Link>
          </div>
        </header>

        <div className="workspace-content">
          <section className="workspace-welcome">
            <div>
              <p className="workspace-overline">YOUR STUDY WORKSPACE</p>
              <h1>{greeting}</h1>
              <p>
                {savedPlans.length > 0
                  ? 'Pick up where you left off, or shape a new plan around your week.'
                  : 'Build a study plan that fits around your classes, commitments, and rest.'}
              </p>
            </div>
            <Link href="/upload" className="workspace-welcome-cta">
              <Plus size={18} aria-hidden="true" />
              Create a study plan
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>

          <section className="workspace-stat-grid" aria-label="Study plan summary">
            <article className="workspace-stat">
              <span className="workspace-stat-icon workspace-stat-icon-plans"><BookOpen size={17} aria-hidden="true" /></span>
              <span className="workspace-stat-label">Saved plans</span>
              <strong>{plansLoading ? '—' : savedPlans.length}</strong>
              <small>On this device</small>
            </article>
            <article className="workspace-stat">
              <span className="workspace-stat-icon workspace-stat-icon-sessions"><Clock3 size={17} aria-hidden="true" /></span>
              <span className="workspace-stat-label">Study sessions</span>
              <strong>{plansLoading ? '—' : totalSessions}</strong>
              <small>Across your plans</small>
            </article>
            <article className="workspace-stat">
              <span className="workspace-stat-icon workspace-stat-icon-done"><CheckCircle2 size={17} aria-hidden="true" /></span>
              <span className="workspace-stat-label">Sessions completed</span>
              <strong>{plansLoading ? '—' : completedSessions}</strong>
              <small>Your progress so far</small>
            </article>
          </section>

          {plansError && <p className="workspace-error" role="alert">{plansError}</p>}

          <div className="workspace-tools-grid">
            <section className="workspace-week-panel" aria-labelledby="workspace-week-title">
              <div className="workspace-section-heading">
                <div>
                  <p className="workspace-overline">YOUR PLAN, AT A GLANCE</p>
                  <h2 id="workspace-week-title">This week</h2>
                </div>
                <span className="workspace-week-total">
                  <strong>{plansLoading ? '—' : weekSessionCount}</strong> sessions
                </span>
              </div>
              {weekDays.length > 0 ? (
                <div className="workspace-week-chart" role="group" aria-label="Select a day to view its sessions">
                  {weekDays.map((day) => {
                    const maxCount = Math.max(...weekDays.map((item) => item.count), 1);
                    const barHeight = day.count > 0 ? Math.max((day.count / maxCount) * 100, 12) : 4;
                    const isSelected = selectedDayKey === day.dateKey;

                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        className={`workspace-week-day ${isSelected ? 'workspace-week-day-selected' : ''}`}
                        aria-label={`${format(day.date, 'EEEE, MMMM d')}, ${day.count} study sessions`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedDay(day.dateKey)}
                      >
                        <span className="workspace-week-day-name">{format(day.date, 'EEE')}</span>
                        <span className="workspace-week-bar">
                          <span style={{ height: `${barHeight}%` }} />
                        </span>
                        <strong>{format(day.date, 'd')}</strong>
                        <small>{day.count}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="workspace-week-empty">
                  {plansLoading ? 'Loading your schedule…' : 'Create or open a plan to see your week here.'}
                </div>
              )}
              <div className="workspace-week-footer">
                <span><i /> Sessions in your selected plan</span>
                <Link href="/dashboard">Open full schedule <ChevronRight size={14} aria-hidden="true" /></Link>
              </div>
            </section>

            <section className="workspace-focus-card" aria-labelledby="workspace-focus-title">
              <div className="workspace-focus-heading">
                <span className="workspace-focus-icon"><Brain size={17} aria-hidden="true" /></span>
                <span className="workspace-overline">FOCUS TOOL</span>
              </div>
              <h2 id="workspace-focus-title">One thing at a time.</h2>
              <p>A 25-minute focus sprint, then take a proper break.</p>
              <div
                className="workspace-focus-dial"
                role="timer"
                aria-label={`${Math.floor(focusSeconds / 60)} minutes ${focusSeconds % 60} seconds remaining`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="workspace-focus-track" cx="50" cy="50" r="44" />
                  <circle
                    className="workspace-focus-progress"
                    cx="50"
                    cy="50"
                    r="44"
                    style={{ strokeDashoffset: `${276.46 * focusProgress}` }}
                  />
                </svg>
                <span><strong>{focusTimeLabel}</strong><small>MIN</small></span>
              </div>
              <div className="workspace-focus-actions">
                <button type="button" className="workspace-focus-toggle" onClick={toggleFocusTimer}>
                  {timerRunning ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                  {timerRunning ? 'Pause sprint' : focusSeconds === 0 ? 'Start again' : 'Start focus'}
                </button>
                <button type="button" className="workspace-focus-reset" onClick={resetFocusTimer} aria-label="Reset focus timer">
                  <RotateCcw size={15} aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>

          <div className="workspace-study-grid">
            <section className="workspace-day-panel" aria-labelledby="workspace-day-title">
              <div className="workspace-section-heading">
                <div>
                  <p className="workspace-overline">YOUR SELECTED DAY</p>
                  <h2 id="workspace-day-title">
                    {selectedDayKey === todayKey
                      ? 'Today’s sessions'
                      : selectedDayDate
                      ? `${format(selectedDayDate, 'EEEE')}'s sessions`
                      : 'Study sessions'}
                  </h2>
                </div>
                <Link href="/dashboard" className="workspace-view-all">
                  Schedule <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {dayBlocks.length > 0 ? (
                <div className="workspace-agenda">
                  {dayBlocks.slice(0, 5).map((block) => (
                    <article className={`workspace-agenda-row workspace-agenda-${block.status ?? 'upcoming'}`} key={block.id}>
                      <span className="workspace-agenda-time">{block.startTime}</span>
                      <span className="workspace-agenda-rail" aria-hidden="true" />
                      <span className="workspace-agenda-icon"><BookOpen size={15} aria-hidden="true" /></span>
                      <span className="workspace-agenda-details">
                        <strong>{block.topicName || block.label}</strong>
                        <small>{block.subjectName || 'Study session'}{block.chapterName ? ` · ${block.chapterName}` : ''}</small>
                      </span>
                      <span className="workspace-agenda-status">{block.status === 'completed' ? 'Done' : block.status === 'pending' ? 'To do' : block.endTime}</span>
                    </article>
                  ))}
                  {dayBlocks.length > 5 && (
                    <Link href="/dashboard" className="workspace-agenda-more">
                      View {dayBlocks.length - 5} more sessions <ChevronRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="workspace-day-empty">
                  <CalendarDays size={21} aria-hidden="true" />
                  <p>
                    {activePlan
                      ? `No study sessions planned for ${selectedDayKey === todayKey ? 'today' : selectedDayDate ? format(selectedDayDate, 'EEEE') : 'this day'}.`
                      : 'Open a saved plan or add your syllabus to see your daily sessions here.'}
                  </p>
                  {!activePlan && (
                    <Link href={savedPlans.length > 0 ? '/dashboard' : '/upload'}>
                      {savedPlans.length > 0 ? 'Open your schedule' : 'Create a plan'} <ChevronRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
            </section>

            <section className="workspace-subject-panel" aria-labelledby="workspace-subject-title">
              <div className="workspace-section-heading">
                <div>
                  <p className="workspace-overline">LATEST PLAN</p>
                  <h2 id="workspace-subject-title">Subject progress</h2>
                </div>
                {activePlan && <span className="workspace-subject-count">{subjects.length}</span>}
              </div>
              {subjects.length > 0 ? (
                <div className="workspace-subject-list">
                  {subjects.map((subject) => {
                    const progress = subject.sessions > 0 ? Math.round((subject.completed / subject.sessions) * 100) : 0;

                    return (
                      <div className="workspace-subject" key={subject.name}>
                        <div className="workspace-subject-label">
                          <span><i style={{ backgroundColor: subject.color }} />{subject.name}</span>
                          <small>{subject.completed}/{subject.sessions}</small>
                        </div>
                        <div className="workspace-subject-track" aria-label={`${subject.name}: ${progress}% complete`}>
                          <span style={{ width: `${progress}%`, backgroundColor: subject.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="workspace-subject-empty">
                  <p>{activePlan ? 'No subject breakdown is available for this plan.' : 'Subject progress will appear after you open a study plan.'}</p>
                </div>
              )}
              {activePlan && (
                <Link href="/dashboard" className="workspace-subject-link">
                  Open progress tracker <ChevronRight size={14} aria-hidden="true" />
                </Link>
              )}
            </section>
          </div>

          <section className="workspace-plans-panel" aria-labelledby="workspace-plans-title">
            <div className="workspace-section-heading">
              <div>
                <p className="workspace-overline">YOUR LIBRARY</p>
                <h2 id="workspace-plans-title">Study plans</h2>
              </div>
              <button type="button" className="workspace-view-all" onClick={() => setSavedModalOpen(true)}>
                View all <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            {plansLoading ? (
              <div className="workspace-plans-loading" role="status">Loading your saved plans…</div>
            ) : savedPlans.length === 0 ? (
              <div className="workspace-empty-state">
                <span className="workspace-empty-icon"><FileText size={23} aria-hidden="true" /></span>
                <h3>Your plans will live here</h3>
                <p>Start with a syllabus, class notes, or a list of chapters. We&apos;ll help you shape the week around them.</p>
                <Link href="/upload" className="workspace-empty-cta">
                  <Upload size={16} aria-hidden="true" />
                  Add your first syllabus
                </Link>
              </div>
            ) : (
              <div className="workspace-plan-list">
                {savedPlans.map((plan) => {
                  const progress = plan.studyBlocksCount > 0
                    ? Math.round((plan.completedBlocksCount / plan.studyBlocksCount) * 100)
                    : 0;

                  return (
                    <article key={plan.id} className="workspace-plan-card">
                      <div className="workspace-plan-icon"><CalendarDays size={19} aria-hidden="true" /></div>
                      <div className="workspace-plan-info">
                        <h3>{plan.title}</h3>
                        <p>
                          Updated {formatPlanDate(plan.updatedAt)}
                          <span aria-hidden="true">·</span>
                          {plan.horizonDays}-day plan
                          <span aria-hidden="true">·</span>
                          {plan.totalSubjects} {plan.totalSubjects === 1 ? 'subject' : 'subjects'}
                        </p>
                        <div className="workspace-plan-progress" aria-label={`${progress}% complete`}>
                          <span><span style={{ width: `${progress}%` }} /></span>
                          <small>{plan.completedBlocksCount} of {plan.studyBlocksCount} sessions</small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="workspace-open-plan"
                        onClick={() => void handleSelectTimetable(plan.id)}
                      >
                        Open <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <nav className="workspace-mobile-nav" aria-label="App navigation">
          <Link href="/" className="workspace-mobile-nav-item workspace-mobile-nav-active" aria-current="page">
            <LayoutDashboard size={19} aria-hidden="true" />
            <span>Home</span>
          </Link>
          <Link href="/dashboard" className="workspace-mobile-nav-item">
            <CalendarDays size={19} aria-hidden="true" />
            <span>Schedule</span>
          </Link>
          <Link href="/upload" className="workspace-mobile-nav-item">
            <Plus size={20} aria-hidden="true" />
            <span>Create</span>
          </Link>
          <button type="button" className="workspace-mobile-nav-item" onClick={() => setSavedModalOpen(true)}>
            <History size={19} aria-hidden="true" />
            <span>Saved</span>
          </button>
        </nav>
      </div>

      <SavedTimetablesModal
        isOpen={savedModalOpen}
        onClose={() => setSavedModalOpen(false)}
        onSelectTimetable={handleSelectTimetable}
        onViewPdf={(dataUri, title) => {
          setPdfDataUri(dataUri);
          setPdfTitle(title);
          setPdfModalOpen(true);
        }}
      />
      <InAppPdfModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfDataUri={pdfDataUri}
        title={pdfTitle}
      />
      {isReverseNavigating && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-[#0B0F17] transition-opacity duration-200 opacity-90 flex items-center justify-center">
          <div className="text-center animate-pulse">
            <span className="text-xs font-mono tracking-widest uppercase text-[#A3E635]">
              Reversing to Hero...
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

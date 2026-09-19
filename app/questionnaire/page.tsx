'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { AvailabilityProfile, TimeWindow, DayOfWeek, SessionLength, PeakEnergy, Occupation } from '@/lib/types';
import { generateSchedule } from '@/lib/scheduler';
import Link from 'next/link';
import {
  Sparkles, ChevronRight, ChevronLeft, Briefcase, Clock, UtensilsCrossed,
  Moon, Zap, Calendar, Plus, Trash2, Loader2, Check, AlertTriangle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Occupation', 'Commitments', 'Health', 'Productivity', 'Horizon'];

const OCCUPATIONS: { value: Occupation; label: string; icon: string; desc: string }[] = [
  { value: 'self-study', label: 'Self Study / Home', icon: '🏠', desc: 'Full day available, flexible schedule' },
  { value: 'student', label: 'Student', icon: '🎓', desc: 'College/school with fixed class times' },
  { value: 'working', label: 'Working Professional', icon: '💼', desc: 'Office job with fixed work hours' },
  { value: 'hybrid', label: 'Hybrid', icon: '🔄', desc: 'Mix of online and in-person commitments' },
];

const SESSION_LENGTHS: { value: SessionLength; label: string; desc: string }[] = [
  { value: 25, label: '25 min', desc: 'Pomodoro — intense & focused' },
  { value: 45, label: '45 min', desc: 'Deep work — recommended' },
  { value: 60, label: '60 min', desc: 'Long form — complex topics' },
  { value: 90, label: '90 min', desc: 'Marathon — maximum depth' },
];

const PEAK_ENERGY_OPTIONS: { value: PeakEnergy; label: string; icon: string; desc: string }[] = [
  { value: 'morning', label: 'Early Bird', icon: '🌅', desc: '5 AM – 11 AM peak focus' },
  { value: 'afternoon', label: 'Afternoon Peak', icon: '☀️', desc: '12 PM – 4 PM most productive' },
  { value: 'evening', label: 'Evening Person', icon: '🌆', desc: '5 PM – 9 PM best focus' },
  { value: 'night', label: 'Night Owl', icon: '🦉', desc: '9 PM – 2 AM deep work' },
];

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Default Profile ──────────────────────────────────────────────────────────

const defaultProfile: AvailabilityProfile = {
  occupation: 'student',
  fixedCommitments: [{ start: '09:00', end: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], label: 'College' }],
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

// ─── Sub-Components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-[#ccc] mb-2">{children}</label>;
}

function HintText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[#666] mt-1">{children}</p>;
}

// ─── Step 1: Occupation ───────────────────────────────────────────────────────

function OccupationStep({ profile, onChange }: { profile: AvailabilityProfile; onChange: (p: Partial<AvailabilityProfile>) => void }) {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold mb-1">What's your current status?</h2>
        <p className="text-[#888baa] text-sm">This helps us understand your daily structure.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OCCUPATIONS.map((o) => (
          <label
            key={o.value}
            className={`radio-card cursor-pointer ${profile.occupation === o.value ? 'selected' : ''}`}
          >
            <input
              type="radio"
              className="hidden"
              value={o.value}
              checked={profile.occupation === o.value}
              onChange={() => onChange({ occupation: o.value })}
            />
            <span className="text-3xl">{o.icon}</span>
            <div>
              <p className="font-semibold text-sm">{o.label}</p>
              <p className="text-xs text-[#888baa]">{o.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Commitments ──────────────────────────────────────────────────────

function CommitmentsStep({ profile, onChange }: { profile: AvailabilityProfile; onChange: (p: Partial<AvailabilityProfile>) => void }) {
  const addCommitment = () => {
    onChange({
      fixedCommitments: [...profile.fixedCommitments, { start: '09:00', end: '17:00', days: DAYS, label: 'Commitment' }],
    });
  };

  const removeCommitment = (i: number) => {
    onChange({ fixedCommitments: profile.fixedCommitments.filter((_, idx) => idx !== i) });
  };

  const updateCommitment = (i: number, patch: Partial<TimeWindow>) => {
    onChange({
      fixedCommitments: profile.fixedCommitments.map((c, idx) => idx === i ? { ...c, ...patch } : c),
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold mb-1">Fixed Commitments</h2>
        <p className="text-[#888baa] text-sm">Blocks of time you can't study (classes, work, etc.)</p>
      </div>

      {profile.fixedCommitments.length === 0 && (
        <div className="card p-6 text-center text-[#666] text-sm">
          No commitments added. Perfect for self-study! Add one if needed.
        </div>
      )}

      {profile.fixedCommitments.map((c, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder="Label (e.g., College, Office)"
              value={c.label ?? ''}
              onChange={(e) => updateCommitment(i, { label: e.target.value })}
            />
            <button onClick={() => removeCommitment(i)} className="btn btn-ghost text-red-400 px-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time</Label>
              <input type="time" className="input" value={c.start} onChange={(e) => updateCommitment(i, { start: e.target.value })} />
            </div>
            <div>
              <Label>End Time</Label>
              <input type="time" className="input" value={c.end} onChange={(e) => updateCommitment(i, { end: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const selected = (c.days ?? DAYS).includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      const days = (c.days ?? DAYS).includes(d)
                        ? (c.days ?? DAYS).filter((x) => x !== d)
                        : [...(c.days ?? DAYS), d];
                      updateCommitment(i, { days });
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                      selected ? 'bg-primary-500 border-primary-500 text-white' : 'border-[rgba(99,102,241,0.18)] text-[#888baa]'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <button onClick={addCommitment} className="btn btn-secondary w-full">
        <Plus className="w-4 h-4" /> Add Commitment
      </button>

      <div>
        <Label>Transition Buffer After Each Commitment</Label>
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={60} step={5}
            value={profile.transitionBuffer}
            onChange={(e) => onChange({ transitionBuffer: +e.target.value })}
            className="flex-1 accent-primary-500"
          />
          <span className="badge badge-primary w-16 text-center">{profile.transitionBuffer} min</span>
        </div>
        <HintText>Unwind time after work/college before studying</HintText>
      </div>
    </div>
  );
}

// ─── Step 3: Health ───────────────────────────────────────────────────────────

function HealthStep({ profile, onChange }: { profile: AvailabilityProfile; onChange: (p: Partial<AvailabilityProfile>) => void }) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold mb-1">Health & Routine</h2>
        <p className="text-[#888baa] text-sm">Your timetable will never overlap these — they're sacred.</p>
      </div>

      {/* Sleep */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm mb-1">
          <Moon className="w-4 h-4" /> Sleep Schedule
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Wake Up Time</Label>
            <input type="time" className="input" value={profile.wakeTime} onChange={(e) => onChange({ wakeTime: e.target.value })} />
          </div>
          <div>
            <Label>Bedtime</Label>
            <input type="time" className="input" value={profile.bedtime} onChange={(e) => onChange({ bedtime: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Target Sleep Hours</Label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={10} step={0.5}
              value={profile.sleepHours}
              onChange={(e) => onChange({ sleepHours: +e.target.value })}
              className="flex-1 accent-purple-500"
            />
            <span className="badge badge-primary w-16 text-center">{profile.sleepHours}h</span>
          </div>
          <HintText>Recommended: 7–9 hours for adults</HintText>
        </div>
      </div>

      {/* Meals */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-1">
          <UtensilsCrossed className="w-4 h-4" /> Meal Times
        </div>
        {[
          { label: '🍳 Breakfast', key: 'breakfast' as const, durKey: 'breakfastDuration' as const },
          { label: '🥗 Lunch', key: 'lunch' as const, durKey: 'lunchDuration' as const },
          { label: '🍽️ Dinner', key: 'dinner' as const, durKey: 'dinnerDuration' as const },
        ].map((m) => (
          <div key={m.key} className="grid grid-cols-3 gap-2 items-end">
            <div>
              <Label>{m.label}</Label>
              <input
                type="time" className="input"
                value={profile.meals[m.key]}
                onChange={(e) => onChange({ meals: { ...profile.meals, [m.key]: e.target.value } })}
              />
            </div>
            <div className="col-span-2">
              <Label>Duration (min)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={10} max={60} step={5}
                  value={profile.meals[m.durKey]}
                  onChange={(e) => onChange({ meals: { ...profile.meals, [m.durKey]: +e.target.value } })}
                  className="flex-1 accent-green-500"
                />
                <span className="text-xs text-[#888baa] w-10">{profile.meals[m.durKey]}m</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hygiene */}
      <div className="card p-4 space-y-2">
        <Label>🚿 Hygiene / Routine Slots</Label>
        {profile.hygieneSlots.map((slot, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input w-28" type="time" value={slot.start}
              onChange={(e) => {
                const h = [...profile.hygieneSlots];
                h[i] = { ...h[i], start: e.target.value };
                onChange({ hygieneSlots: h });
              }}
            />
            <span className="text-[#666]">→</span>
            <input
              className="input w-28" type="time" value={slot.end}
              onChange={(e) => {
                const h = [...profile.hygieneSlots];
                h[i] = { ...h[i], end: e.target.value };
                onChange({ hygieneSlots: h });
              }}
            />
            <input
              className="input flex-1" placeholder="Label"
              value={slot.label ?? ''}
              onChange={(e) => {
                const h = [...profile.hygieneSlots];
                h[i] = { ...h[i], label: e.target.value };
                onChange({ hygieneSlots: h });
              }}
            />
            <button
              onClick={() => onChange({ hygieneSlots: profile.hygieneSlots.filter((_, j) => j !== i) })}
              className="btn btn-ghost text-red-400 px-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange({ hygieneSlots: [...profile.hygieneSlots, { start: '06:30', end: '07:00', label: '🚿 Shower' }] })}
          className="btn btn-secondary text-sm w-full"
        >
          <Plus className="w-4 h-4" /> Add Hygiene Slot
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Productivity ─────────────────────────────────────────────────────

function ProductivityStep({ profile, onChange }: { profile: AvailabilityProfile; onChange: (p: Partial<AvailabilityProfile>) => void }) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold mb-1">Productivity Profile</h2>
        <p className="text-[#888baa] text-sm">We'll match your hardest topics to your best hours.</p>
      </div>

      <div>
        <Label>Preferred Study Session Length</Label>
        <div className="grid grid-cols-2 gap-3">
          {SESSION_LENGTHS.map((s) => (
            <label
              key={s.value}
              className={`radio-card cursor-pointer ${profile.sessionLength === s.value ? 'selected' : ''}`}
            >
              <input
                type="radio" className="hidden"
                checked={profile.sessionLength === s.value}
                onChange={() => onChange({ sessionLength: s.value })}
              />
              <div>
                <p className="font-bold">{s.label}</p>
                <p className="text-xs text-[#888baa]">{s.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>🔋 Peak Energy Hours</Label>
        <div className="grid grid-cols-2 gap-3">
          {PEAK_ENERGY_OPTIONS.map((p) => (
            <label
              key={p.value}
              className={`radio-card cursor-pointer ${profile.peakEnergy === p.value ? 'selected' : ''}`}
            >
              <input
                type="radio" className="hidden"
                checked={profile.peakEnergy === p.value}
                onChange={() => onChange({ peakEnergy: p.value })}
              />
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="font-semibold text-sm">{p.label}</p>
                <p className="text-xs text-[#888baa]">{p.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>💧 Break Between Sessions</Label>
        <div className="flex items-center gap-3">
          <input
            type="range" min={5} max={20} step={5}
            value={profile.breakBetweenSessions}
            onChange={(e) => onChange({ breakBetweenSessions: +e.target.value })}
            className="flex-1 accent-primary-500"
          />
          <span className="badge badge-primary w-16 text-center">{profile.breakBetweenSessions} min</span>
        </div>
        <HintText>Mandatory hydration/rest break between consecutive study blocks</HintText>
      </div>
    </div>
  );
}

// ─── Step 5: Horizon ──────────────────────────────────────────────────────────

function HorizonStep({ profile, onChange }: { profile: AvailabilityProfile; onChange: (p: Partial<AvailabilityProfile>) => void }) {
  const presets = [
    { label: '1 Day', days: 1 }, { label: '1 Week', days: 7 },
    { label: '2 Weeks', days: 14 }, { label: '1 Month', days: 30 },
    { label: '2 Months', days: 60 }, { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180 }, { label: '1 Year', days: 365 },
    { label: '2 Years', days: 730 },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold mb-1">Schedule Horizon</h2>
        <p className="text-[#888baa] text-sm">How far should your timetable extend?</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => onChange({ horizonDays: p.days })}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              profile.horizonDays === p.days
                ? 'bg-primary-500 border-primary-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.5)]'
                : 'border-[rgba(99,102,241,0.18)] text-[#888baa] hover:border-primary-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <Label>Or enter custom days: {profile.horizonDays} days</Label>
        <input
          type="range" min={1} max={730} step={1}
          value={profile.horizonDays}
          onChange={(e) => onChange({ horizonDays: +e.target.value })}
          className="w-full accent-primary-500"
        />
        <div className="flex justify-between text-xs text-[#666] mt-1">
          <span>1 day</span><span>1 year</span><span>2 years</span>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm text-[#888baa]">
          📅 Your timetable will cover <strong className="text-white">{profile.horizonDays} days</strong> starting today.
        </p>
      </div>
    </div>
  );
}

// ─── Main Questionnaire Page ──────────────────────────────────────────────────

export default function QuestionnairePage() {
  const router = useRouter();
  const { syllabus, setProfile, setSchedule, setStep, setGenerating } = useAppStore();

  const [step, setLocalStep] = useState(0);
  const [profile, setLocalProfile] = useState<AvailabilityProfile>(defaultProfile);
  const [generating, setLocalGenerating] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Redirect if no syllabus
  useEffect(() => {
    if (!syllabus) router.replace('/upload');
  }, [syllabus, router]);

  const update = (patch: Partial<AvailabilityProfile>) =>
    setLocalProfile((p) => ({ ...p, ...patch }));

  const handleGenerate = async () => {
    if (!syllabus) return;
    setLocalGenerating(true);
    setGenerating(true);

    try {
      // Run scheduler (client-side)
      await new Promise((r) => setTimeout(r, 800)); // simulate slight delay
      const result = generateSchedule(syllabus, profile);
      setProfile(profile);
      setSchedule(result.blocks, result.warning);
      setWarning(result.warning);
      setStep(3);
      router.push('/dashboard');
    } finally {
      setLocalGenerating(false);
      setGenerating(false);
    }
  };

  const stepComponents = [
    <OccupationStep key={0} profile={profile} onChange={update} />,
    <CommitmentsStep key={1} profile={profile} onChange={update} />,
    <HealthStep key={2} profile={profile} onChange={update} />,
    <ProductivityStep key={3} profile={profile} onChange={update} />,
    <HorizonStep key={4} profile={profile} onChange={update} />,
  ];

  return (
    <main className="animated-bg min-h-screen">
      <div className="orb orb-accent w-[400px] h-[400px] top-[-80px] left-[-80px]" />
      <div className="orb orb-pink w-[300px] h-[300px] bottom-[80px] right-[-60px]" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-3xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">StudySync <span className="gradient-text">AI</span></span>
        </Link>
        <span className="badge badge-primary">Step 2 of 2</span>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        {/* Step Indicator */}
        <div className="flex items-center mb-10">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`step-dot ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-primary-400 font-semibold' : 'text-[#555]'}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`step-line mx-1 ${i < step ? 'done' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card p-6 mb-6 min-h-[400px]">
          {stepComponents[step]}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => step > 0 ? setLocalStep(step - 1) : router.push('/upload')}
            className="btn btn-secondary"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex-1" />

          {step < STEP_LABELS.length - 1 ? (
            <button onClick={() => setLocalStep(step + 1)} className="btn btn-primary">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary btn-lg glow-primary disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating…</>
              ) : (
                <><Calendar className="w-5 h-5" /> Generate Timetable</>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

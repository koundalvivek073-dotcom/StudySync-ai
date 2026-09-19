'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { Brain, Calendar, FileText, Heart, Sparkles, ChevronRight, Clock, Shield, Zap, Upload, History } from 'lucide-react';
import SavedTimetablesModal from '@/components/SavedTimetablesModal';
import InAppPdfModal from '@/components/InAppPdfModal';
import { getStoredTimetablesList, getStoredTimetable } from '@/lib/localTimetableStorage';

const features = [
  {
    icon: Upload,
    title: 'Smart Syllabus Parsing',
    desc: 'Upload PDF or images. Our AI extracts subjects, chapters, complexity, and estimated hours instantly.',
    color: '#6366f1',
  },
  {
    icon: Heart,
    title: 'Health-First Scheduling',
    desc: 'Sleep, meals, hygiene, and breaks are sacred. Your timetable respects your body first.',
    color: '#ec4899',
  },
  {
    icon: Brain,
    title: 'Peak-Energy Alignment',
    desc: 'Hard topics land in your peak focus hours. We match complexity to your energy profile.',
    color: '#8b5cf6',
  },
  {
    icon: Calendar,
    title: 'Visual Dashboard',
    desc: 'Color-coded daily, weekly, and monthly calendar views with subject legend.',
    color: '#22c55e',
  },
  {
    icon: FileText,
    title: 'PDF Export',
    desc: 'Download a beautifully styled, print-ready PDF timetable with full schedule breakdown.',
    color: '#f59e0b',
  },
  {
    icon: Shield,
    title: 'Smart Guardrails',
    desc: 'Warns you if your horizon is too short. Auto-inserts hydration breaks every session.',
    color: '#06b6d4',
  },
];

const steps = [
  { n: '01', title: 'Upload Syllabus', desc: 'PDF, PNG, JPG — any format works.' },
  { n: '02', title: 'Answer 5 Questions', desc: 'Tell us your lifestyle, sleep, and energy.' },
  { n: '03', title: 'Get Your Timetable', desc: 'Personalized, health-safe, exportable.' },
];

export default function HomePage() {
  const router = useRouter();
  const { setSyllabus, setProfile, setSchedule } = useAppStore();
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('Personalized Timetable');

  useEffect(() => {
    const checkSaved = async () => {
      const list = await getStoredTimetablesList();
      setSavedCount(list.length);
    };
    checkSaved();
    window.addEventListener('studysync_timetables_changed', checkSaved);
    return () => window.removeEventListener('studysync_timetables_changed', checkSaved);
  }, []);

  const handleSelectTimetable = async (id: string) => {
    const item = await getStoredTimetable(id);
    if (item) {
      setSyllabus(item.syllabus);
      setProfile(item.profile);
      setSchedule(item.blocks, null);
      router.push('/dashboard');
    }
  };

  return (
    <main className="animated-bg min-h-screen overflow-x-hidden">
      {/* Orbs — smaller on mobile to prevent overflow */}
      <div className="orb orb-primary w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] top-[-100px] left-[-80px]" />
      <div className="orb orb-accent w-[200px] h-[200px] sm:w-[400px] sm:h-[400px] top-[300px] right-[-60px]" />
      <div className="orb orb-pink w-[150px] h-[150px] sm:w-[300px] sm:h-[300px] bottom-[100px] left-[40%]" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base sm:text-lg">
            StudySync <span className="gradient-text">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {savedCount > 0 && (
            <button
              onClick={() => setSavedModalOpen(true)}
              className="btn btn-secondary text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 flex items-center gap-1.5"
              title="View timetable history on this device"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span className="hidden xs:inline">History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                {savedCount}
              </span>
            </button>
          )}
          <Link href="/upload">
            <button className="btn btn-primary text-sm sm:text-base px-3 sm:px-5">
              <span className="hidden xs:inline">Get Started</span>
              <span className="xs:hidden">Start</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 glass px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm text-primary-400 mb-6 sm:mb-8 animate-fadeIn">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          AI-Powered · Health-First · Personalized
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold leading-tight mb-4 sm:mb-6 animate-fadeIn delay-100">
          Your Syllabus,{' '}
          <span className="gradient-text text-glow">Scheduled for</span>
          <br />
          Peak Performance
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-[#888baa] max-w-2xl mx-auto mb-8 sm:mb-10 animate-fadeIn delay-200 px-2">
          Upload your syllabus. Answer 5 quick questions about your lifestyle. Get a personalized,
          health-conscious study timetable — exportable as a beautiful PDF.
        </p>

        <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 justify-center animate-fadeIn delay-300 px-4 xs:px-0">
          <Link href="/upload" className="w-full xs:w-auto">
            <button className="btn btn-primary btn-lg glow-primary w-full xs:w-auto">
              <Upload className="w-5 h-5 flex-shrink-0" />
              Upload Your Syllabus
            </button>
          </Link>
          <Link href="/dashboard" className="w-full xs:w-auto">
            <button className="btn btn-secondary btn-lg w-full xs:w-auto">
              <Calendar className="w-5 h-5 flex-shrink-0" />
              View Demo Timetable
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-6 sm:gap-8 justify-center mt-12 sm:mt-16 animate-fadeIn delay-400">
          {[
            { label: 'Subjects Parsed', value: '∞' },
            { label: 'Health Guardrails', value: '7+' },
            { label: 'Max Horizon', value: '2 years' },
            { label: 'Export Formats', value: 'PDF' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs sm:text-sm text-[#888baa] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <div className="badge badge-primary mb-4">How It Works</div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            From syllabus to timetable in <span className="gradient-text">3 steps</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className="card p-5 sm:p-6 animate-fadeIn"
              style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
            >
              <div className="text-5xl sm:text-6xl font-bold gradient-text opacity-20 mb-3 sm:mb-4">{step.n}</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-[#888baa] text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <div className="badge badge-primary mb-4">Features</div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Built for <span className="gradient-text">serious learners</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="card p-5 sm:p-6 animate-fadeIn"
                style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
              >
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4"
                  style={{ background: `${f.color}22`, border: `1px solid ${f.color}44` }}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-[#888baa] text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="glass-strong p-6 sm:p-12 rounded-[20px] sm:rounded-[24px] glow-primary">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Ready to study <span className="gradient-text">smarter</span>?
          </h2>
          <p className="text-[#888baa] mb-6 sm:mb-8 max-w-lg mx-auto text-sm sm:text-base">
            Join the health-first study revolution. Upload your syllabus and get your personalized timetable in minutes.
          </p>
          <Link href="/upload">
            <button className="btn btn-primary btn-lg glow-primary w-full sm:w-auto">
              <Upload className="w-5 h-5 flex-shrink-0" />
              Start for Free — No Sign-Up Needed
            </button>
          </Link>
          <p className="text-[#555] text-xs mt-4 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Takes less than 3 minutes
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[#444] text-xs pb-8 px-4">
        StudySync AI — Health-First Timetable Maker · Built with ❤️ for learners everywhere
      </footer>

      {/* History Modal */}
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

      {/* In-App PDF Modal */}
      <InAppPdfModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfDataUri={pdfDataUri}
        title={pdfTitle}
      />
    </main>
  );
}

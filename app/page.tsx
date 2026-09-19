'use client';

import Link from 'next/link';
import { Brain, Calendar, FileText, Heart, Sparkles, ChevronRight, Clock, Shield, Zap, Upload } from 'lucide-react';

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
  return (
    <main className="animated-bg min-h-screen overflow-hidden">
      {/* Orbs */}
      <div className="orb orb-primary w-[600px] h-[600px] top-[-200px] left-[-100px]" />
      <div className="orb orb-accent w-[400px] h-[400px] top-[300px] right-[-80px]" />
      <div className="orb orb-pink w-[300px] h-[300px] bottom-[100px] left-[40%]" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">StudySync <span className="gradient-text">AI</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/upload">
            <button className="btn btn-primary">
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-primary-400 mb-8 animate-fadeIn">
          <Zap className="w-4 h-4" />
          AI-Powered · Health-First · Personalized
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fadeIn delay-100">
          Your Syllabus,{' '}
          <span className="gradient-text text-glow">Scheduled for</span>
          <br />
          Peak Performance
        </h1>

        <p className="text-lg md:text-xl text-[#888baa] max-w-2xl mx-auto mb-10 animate-fadeIn delay-200">
          Upload your syllabus. Answer 5 quick questions about your lifestyle. Get a personalized, 
          health-conscious study timetable — exportable as a beautiful PDF.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fadeIn delay-300">
          <Link href="/upload">
            <button className="btn btn-primary btn-lg glow-primary">
              <Upload className="w-5 h-5" />
              Upload Your Syllabus
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="btn btn-secondary btn-lg">
              <Calendar className="w-5 h-5" />
              View Demo Timetable
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-8 justify-center mt-16 animate-fadeIn delay-400">
          {[
            { label: 'Subjects Parsed', value: '∞' },
            { label: 'Health Guardrails', value: '7+' },
            { label: 'Max Horizon', value: '2 years' },
            { label: 'Export Formats', value: 'PDF' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold gradient-text">{s.value}</div>
              <div className="text-sm text-[#888baa] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="badge badge-primary mb-4">How It Works</div>
          <h2 className="text-3xl md:text-4xl font-bold">
            From syllabus to timetable in <span className="gradient-text">3 steps</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className="card p-6 animate-fadeIn"
              style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
            >
              <div className="text-6xl font-bold gradient-text opacity-20 mb-4">{step.n}</div>
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-[#888baa] text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="badge badge-primary mb-4">Features</div>
          <h2 className="text-3xl md:text-4xl font-bold">
            Built for <span className="gradient-text">serious learners</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="card p-6 animate-fadeIn"
                style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}22`, border: `1px solid ${f.color}44` }}
                >
                  <Icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-[#888baa] text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="glass-strong p-12 rounded-[24px] glow-primary">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to study <span className="gradient-text">smarter</span>?
          </h2>
          <p className="text-[#888baa] mb-8 max-w-lg mx-auto">
            Join the health-first study revolution. Upload your syllabus and get your personalized timetable in minutes.
          </p>
          <Link href="/upload">
            <button className="btn btn-primary btn-lg glow-primary">
              <Upload className="w-5 h-5" />
              Start for Free — No Sign-Up Needed
            </button>
          </Link>
          <p className="text-[#555] text-xs mt-4 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Takes less than 3 minutes
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[#444] text-xs pb-8">
        StudySync AI — Health-First Timetable Maker · Built with ❤️ for learners everywhere
      </footer>
    </main>
  );
}

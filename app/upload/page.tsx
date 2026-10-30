'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Heart,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  X,
  Edit3,
  Info,
  LayoutDashboard,
  CalendarDays,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { parseSyllabus, parseTextWithAPI } from '@/lib/syllabusParser';
import { ParsedSyllabus } from '@/lib/types';
import Link from 'next/link';

type ParseState = 'idle' | 'parsing' | 'done' | 'error';
type InputMode = 'file' | 'paste' | 'chapters';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const PARSE_STEPS = [
  'Reading document structure…',
  'Detecting subjects & chapters…',
  'Fetching academic knowledge base…',
  'Classifying difficulty levels (easy/medium/hard)…',
  'Calculating study hours & prerequisites…',
  'Finalising granular topic breakdown…',
];

const SAMPLE_CHAPTER_INPUT = `Class 12 Physics
- Rotational Motion
- Electromagnetic Induction
- Alternating Current
- Ray Optics & Optical Instruments

Class 12 Chemistry
- Electrochemistry
- Chemical Kinetics
- d & f Block Elements
- Coordination Compounds
- Haloalkanes and Haloarenes`;

const SAMPLE_CBSE_10 = `Class 10 Mathematics
- Real Numbers
- Polynomials
- Pair of Linear Equations
- Quadratic Equations
- Arithmetic Progressions
- Triangles`;

export default function UploadPage() {
  const router = useRouter();
  const { setSyllabus, setStep } = useAppStore();

  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [chapterInput, setChapterInput] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');

  const [parseState, setParseState] = useState<ParseState>('idle');
  const [parseStep, setParseStep] = useState(0);
  const [result, setResult] = useState<ParsedSyllabus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem('studysync_gemini_api_key');
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setParseState('idle');
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0]?.errors[0];
      setError(
        rejection?.code === 'file-too-large'
          ? 'That file is over the 20 MB limit. Choose a smaller file or paste the syllabus text instead.'
          : rejection?.code === 'file-invalid-type'
          ? 'That file type is not supported. Choose a PDF, image, TXT, or Markdown file.'
          : rejection?.message ?? 'We could not add that file. Try another file or paste the syllabus text.',
      );
      setParseState('error');
      setResult(null);
    },
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20 MB
    disabled: parseState === 'parsing',
  });

  const handleParse = async () => {
    if (inputMode === 'file' && !file) return;
    if (inputMode === 'paste' && !pastedText.trim()) return;
    if (inputMode === 'chapters' && !chapterInput.trim()) return;

    setParseState('parsing');
    setParseStep(0);
    setError(null);

    const interval = setInterval(() => {
      setParseStep((prev) => Math.min(prev + 1, PARSE_STEPS.length - 1));
    }, 500);

    try {
      let parsed: ParsedSyllabus;
      if (inputMode === 'paste') {
        parsed = await parseTextWithAPI(pastedText, customTitle.trim() || 'Custom Syllabus');
      } else if (inputMode === 'chapters') {
        // Send chapter names to AI — it will use its knowledge base to expand them
        const title = customTitle.trim() || 'My Syllabus';
        parsed = await parseTextWithAPI(chapterInput, title);
      } else {
        parsed = await parseSyllabus(file!);
      }

      clearInterval(interval);
      setParseStep(PARSE_STEPS.length - 1);
      setResult(parsed);
      setParseState('done');
    } catch (e: unknown) {
      clearInterval(interval);
      setError(e instanceof Error ? e.message : 'Failed to parse syllabus');
      setParseState('error');
    }
  };

  const handleContinue = () => {
    if (!result) return;
    setSyllabus(result);
    setStep(2);
    router.push('/questionnaire');
  };

  const fileIcon = file?.type === 'application/pdf'
    ? <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400" />
    : file?.name.endsWith('.txt') || file?.name.endsWith('.md')
    ? <Edit3 className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400" />
    : <ImageIcon className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400" />;
  const activeText = inputMode === 'chapters' ? chapterInput : pastedText;
  const activeLineCount = activeText.split(/\r?\n/).filter((line) => line.trim()).length;

  return (
    <main className="workspace-app upload-app">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand" aria-label="StudySync overview">
          <span className="workspace-brand-mark"><Sparkles size={17} aria-hidden="true" /></span>
          <span>StudySync</span>
        </Link>
        <p className="workspace-nav-label">WORKSPACE</p>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          <Link href="/" className="workspace-nav-item">
            <LayoutDashboard size={18} aria-hidden="true" />
            <span>Overview</span>
          </Link>
          <Link href="/dashboard" className="workspace-nav-item">
            <CalendarDays size={18} aria-hidden="true" />
            <span>My schedule</span>
          </Link>
          <Link href="/upload" className="workspace-nav-item workspace-nav-item-active" aria-current="page">
            <Upload size={18} aria-hidden="true" />
            <span>Add material</span>
          </Link>
        </nav>
        <div className="workspace-sidebar-bottom">
          <div className="workspace-sidebar-note">
            <span className="workspace-sidebar-note-icon"><Heart size={16} aria-hidden="true" /></span>
            <span><strong>Plan for your real week</strong><small>Classes, breaks, and rest count.</small></span>
          </div>
          <span className="workspace-version">STUDYSYNC · PLAN BUILDER</span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumb">
            <Link href="/">Workspace</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>New study plan</strong>
          </div>
          <div className="workspace-topbar-actions">
            <span className="upload-topbar-progress"><span /> Step 1 of 3</span>
            <Link href="/" className="upload-exit-link">Exit builder</Link>
          </div>
        </header>

        <div className="workspace-content upload-app-content">
          <section className="upload-page-heading">
            <div>
              <p className="workspace-overline">BUILD YOUR STUDY PLAN <span>·</span> STEP 01</p>
              <h1>Add your course material</h1>
              <p>Start with a syllabus, lecture notes, or a simple chapter list. We&apos;ll organize it into study topics.</p>
            </div>
          </section>

          <nav className="upload-stepper" aria-label="Study plan steps">
            <div className="upload-step upload-step-current" aria-current="step">
              <span>01</span><strong>Course material</strong>
            </div>
            <span className="upload-step-connector" aria-hidden="true" />
            <div className="upload-step">
              <span>02</span><strong>Your week</strong>
            </div>
            <span className="upload-step-connector" aria-hidden="true" />
            <div className="upload-step">
              <span>03</span><strong>Study plan</strong>
            </div>
          </nav>

          <div className="upload-app-grid">
          <section className="upload-workspace" aria-labelledby="upload-workspace-title">
          <div className="upload-workspace-heading">
            <div>
              <p>CHOOSE WHAT YOU HAVE</p>
              <h2 id="upload-workspace-title">Add your material</h2>
            </div>
            <span className="upload-workspace-index">STEP 01 / 03</span>
          </div>

        {/* Input Mode Selector */}
        <div className="upload-mode-switch" role="group" aria-label="Choose syllabus input method">
            <button
              type="button"
              disabled={parseState === 'parsing'}
              aria-pressed={inputMode === 'file'}
              onClick={() => { setInputMode('file'); setParseState('idle'); setResult(null); setError(null); }}
              className={`upload-mode ${
                inputMode === 'file'
                  ? 'upload-mode-active'
                  : ''
              }`}
            >
              <Upload size={16} aria-hidden="true" />
              <span><strong>Upload a file</strong><small>PDF, image, or text file</small></span>
            </button>
            <button
              type="button"
              disabled={parseState === 'parsing'}
              aria-pressed={inputMode === 'chapters'}
              onClick={() => { setInputMode('chapters'); setParseState('idle'); setResult(null); setError(null); }}
              className={`upload-mode ${
                inputMode === 'chapters'
                  ? 'upload-mode-active'
                  : ''
              }`}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span><strong>List chapters</strong><small>One chapter per line</small></span>
            </button>
            <button
              type="button"
              disabled={parseState === 'parsing'}
              aria-pressed={inputMode === 'paste'}
              onClick={() => { setInputMode('paste'); setParseState('idle'); setResult(null); setError(null); }}
              className={`upload-mode ${
                inputMode === 'paste'
                  ? 'upload-mode-active'
                  : ''
              }`}
            >
              <Edit3 size={16} aria-hidden="true" />
              <span><strong>Paste notes</strong><small>Syllabus or lecture notes</small></span>
            </button>
        </div>

        {/* File Dropzone Mode */}
        {inputMode === 'file' && (
          <div
            {...getRootProps()}
            className={`upload-dropzone ${isDragActive ? 'upload-dropzone-active' : ''} ${file ? 'upload-dropzone-has-file' : ''}`}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="upload-file-selected">
                <span className="upload-file-icon">{fileIcon}</span>
                <div className="upload-file-details">
                  <p className="font-semibold text-white text-sm sm:text-base break-all">{file.name}</p>
                  <p className="text-sm text-[#888baa]">{(file.size / 1024).toFixed(0)} KB · Ready to analyze</p>
                </div>
                <button
                  type="button"
                  disabled={parseState === 'parsing'}
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setParseState('idle'); }}
                  aria-label="Remove selected file"
                  className="upload-file-remove"
                >
                  <X size={16} aria-hidden="true" /> Remove
                </button>
              </div>
            ) : (
              <div className="upload-dropzone-content">
                <div className="upload-drop-illustration" aria-hidden="true">
                  <FileText className="upload-drop-paper" size={38} />
                  <span><Upload size={17} /></span>
                </div>
                <div>
                  <p className="upload-drop-title">
                    {isDragActive ? 'That’s it — let go to add your file' : 'Drop your syllabus here'}
                  </p>
                  <p className="upload-drop-subtitle">or click anywhere in this area to browse your files</p>
                </div>
                <div className="upload-file-types" aria-label="Accepted file types">
                  <span>PDF</span><span>PNG</span><span>JPG</span><span>WEBP</span><span>TXT</span><span>MD</span>
                </div>
                <p className="upload-file-limit">Up to 20 MB</p>
              </div>
            )}
          </div>
        )}

        {/* Paste Text Mode */}
        {inputMode === 'paste' && (
          <div className="card p-5 sm:p-6 animate-fadeIn space-y-4">
            <div>
              <label htmlFor="pasted-syllabus-title" className="block text-xs font-semibold uppercase tracking-wider text-[#888baa] mb-1.5">
                Syllabus Title (optional)
              </label>
              <input
                id="pasted-syllabus-title"
                type="text"
                disabled={parseState === 'parsing'}
                placeholder="e.g. Higher Mathematics, JavaScript Mastery, Physics 101"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-[#161824] border border-[#2a2d42] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#555870] focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="pasted-syllabus-text" className="block text-xs font-semibold uppercase tracking-wider text-[#888baa]">
                  Paste Full Syllabus or Notes
                </label>
              </div>
              <textarea
                id="pasted-syllabus-text"
                rows={8}
                disabled={parseState === 'parsing'}
                placeholder="Paste your chapters, topics, bullet points, or lecture notes here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full bg-[#161824] border border-[#2a2d42] rounded-lg p-3.5 text-sm text-white font-mono placeholder-[#555870] focus:outline-none focus:border-primary-500 resize-y"
              />
            </div>
            <p className="text-xs text-[#888baa]">
              Paste a structured syllabus or notes. Clear headings and chapter names help us organize topics.
            </p>
          </div>
        )}

        {/* Chapter Names Mode — AI Knowledge Enrichment */}
        {inputMode === 'chapters' && (
          <div className="card p-5 sm:p-6 animate-fadeIn space-y-4">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-accent/10 border border-accent/30">
              <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-accent">Smart topic expansion</p>
                <p className="text-xs text-[#a5b4fc] mt-0.5">
                  Just type your chapter names with class/grade. The AI will automatically expand each chapter into granular sub-topics with difficulty levels — using its academic knowledge base (CBSE, JEE, NEET, UPSC, University curricula).
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="chapter-course-title" className="block text-xs font-semibold uppercase tracking-wider text-[#888baa] mb-1.5">
                Course / Exam Title
              </label>
              <input
                id="chapter-course-title"
                type="text"
                disabled={parseState === 'parsing'}
                placeholder="e.g. Class 12 Physics & Chemistry, JEE Mains 2025, UPSC GS Paper 1"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-[#161824] border border-[#2a2d42] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#555870] focus:outline-none focus:border-accent/60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="chapter-names" className="block text-xs font-semibold uppercase tracking-wider text-[#888baa]">
                  Chapter Names (one per line)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChapterInput(SAMPLE_CHAPTER_INPUT);
                      setCustomTitle('Class 12 — Physics & Chemistry');
                    }}
                    className="text-xs text-accent hover:text-purple-300 transition-colors"
                  >
                    Class 12 Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChapterInput(SAMPLE_CBSE_10);
                      setCustomTitle('Class 10 Mathematics');
                    }}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Class 10 Sample
                  </button>
                </div>
              </div>
              <textarea
                id="chapter-names"
                rows={9}
                disabled={parseState === 'parsing'}
                placeholder={`Enter chapter names with class/subject info. Examples:

Class 12 Physics
- Rotational Motion
- Electromagnetic Induction
- Ray Optics

Class 12 Chemistry
- Electrochemistry
- Coordination Compounds`}
                value={chapterInput}
                onChange={(e) => setChapterInput(e.target.value)}
                className="w-full bg-[#161824] border border-accent/30 rounded-lg p-3.5 text-sm text-white font-mono placeholder-[#555870] focus:outline-none focus:border-accent/70 resize-y"
              />
            </div>
            <p className="text-xs text-[#888baa]">
              Add the course or exam name too, so chapter topics can be expanded in the right context.
            </p>
          </div>
        )}

        <details className="upload-samples">
          <summary>
            <span>Not ready with a syllabus?</span>
            <span>Try a sample <ChevronRight size={15} aria-hidden="true" /></span>
          </summary>
          <div className="upload-sample-options">
            {[
              { label: 'Biology Class 12 (CBSE)', idx: 2 },
              { label: 'CS Engineering Sem 5', idx: 0 },
              { label: 'UPSC General Studies', idx: 1 },
            ].map((demo) => (
              <button
                key={demo.label}
                type="button"
                disabled={parseState === 'parsing'}
                onClick={async () => {
                  setParseState('parsing');
                  const { parseWithMock } = await import('@/lib/syllabusParser');
                  const parsed = await parseWithMock(demo.idx);
                  setResult(parsed);
                  setParseState('done');
                  setFile({ name: `${demo.label}.pdf`, size: 0 } as File);
                }}
                className="upload-sample-button"
              >
                <FileText size={15} aria-hidden="true" /> {demo.label}
              </button>
            ))}
          </div>
        </details>

        <div className="upload-source-summary" aria-live="polite">
          <span className="upload-source-icon">
            {parseState === 'error'
              ? <AlertTriangle size={16} aria-hidden="true" />
              : parseState === 'done'
              ? <CheckCircle size={16} aria-hidden="true" />
              : <FileText size={16} aria-hidden="true" />}
          </span>
          <span className="upload-source-copy">
            <small>{parseState === 'error' ? 'CHECK YOUR INPUT' : parseState === 'done' ? 'MATERIAL READY' : 'CURRENT MATERIAL'}</small>
            <strong>
              {parseState === 'error'
                ? 'Needs attention'
                : parseState === 'done'
                ? 'Topics organized'
                : inputMode === 'file'
                ? file?.name ?? 'No file added yet'
                : activeLineCount
                ? `${activeLineCount} ${activeLineCount === 1 ? 'line' : 'lines'} added`
                : 'Nothing added yet'}
            </strong>
          </span>
          <span className="upload-source-detail">
            {inputMode === 'file'
              ? file ? `${(file.size / 1024).toFixed(0)} KB` : 'Up to 20 MB'
              : inputMode === 'chapters' ? 'Chapter list' : 'Pasted notes'}
          </span>
        </div>

        {/* Action Button */}
        {parseState === 'idle' && (
          <div className="mt-5 sm:mt-6 text-center animate-scaleIn">
            <button
              onClick={handleParse}
              disabled={
                inputMode === 'file' ? !file
                : inputMode === 'chapters' ? !chapterInput.trim()
                : !pastedText.trim()
              }
              className="upload-submit"
            >
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              {inputMode === 'chapters'
                ? 'Build my topic list'
                : inputMode === 'paste'
                ? 'Organize my notes'
                : 'Find my syllabus topics'}
            </button>
            {inputMode === 'chapters' && (
              <p className="text-xs text-[#888baa] mt-2">You can review the topics before building your schedule.</p>
            )}
          </div>
        )}

        {/* Parsing Progress */}
        {parseState === 'parsing' && (
          <div className="mt-5 sm:mt-6 card p-5 sm:p-6 animate-scaleIn">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-primary-400 animate-spin flex-shrink-0" />
              <span className="font-semibold">Extracting topics from your syllabus…</span>
            </div>
            <div className="progress-track mb-3">
              <div
                className="progress-fill"
                style={{ width: `${((parseStep + 1) / PARSE_STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-sm text-[#888baa]">{PARSE_STEPS[parseStep]}</p>
          </div>
        )}

        {/* Parsing Notice */}
        {parseState === 'error' && (
          <div className="mt-5 sm:mt-6 space-y-3 animate-scaleIn">
            <div className="warning-banner flex items-start gap-2.5 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Processing Notice</p>
                <p className="mt-1 text-xs sm:text-sm text-amber-300/90">{error}</p>
              </div>
            </div>
            <div className="glass p-3 rounded-lg flex items-center justify-between gap-2.5 text-xs text-[#888baa]">
              <span>Try pasting your syllabus text directly for instant chapter extraction.</span>
              <div className="flex items-center gap-2">
                {inputMode === 'file' && file && (
                  <button
                    onClick={() => { setError(null); setParseState('idle'); }}
                    className="btn btn-primary text-xs py-1 px-3"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => { setInputMode('paste'); setParseState('idle'); }}
                  className="btn btn-primary text-xs py-1 px-3"
                >
                  Switch to Paste Tab
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {parseState === 'done' && result && (
          <div className="mt-6 sm:mt-8 animate-fadeIn">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="font-semibold text-green-400">Syllabus parsed successfully!</span>

              <div className="sm:ml-auto flex items-center gap-2">
                {result.source === 'demo' ? (
                  <span className="badge badge-secondary text-xs">Sample / Demo Data</span>
                ) : result.source === 'meta-ai' || result.source === 'openai' ? (
                  <span className="badge badge-primary text-xs">
                    {(result.parseConfidence * 100).toFixed(0)}% AI confidence
                  </span>
                ) : (
                  <span className="badge badge-secondary text-xs">Fallback estimates</span>
                )}
                <span className="text-xs text-[#888baa]">
                  {result.source === 'meta-ai'
                    ? '✨ Meta AI'
                    : result.source === 'openai'
                    ? '🤖 OpenAI'
                    : result.source === 'smart-engine'
                    ? '⚡ Curriculum AI'
                    : result.source === 'local-parser'
                    ? '⚡ Structural Engine'
                    : 'Demo'}
                </span>
              </div>
            </div>

            <div className="card p-4 sm:p-5 mb-4">
              <h2 className="font-bold text-base sm:text-lg mb-1">{result.title}</h2>
              <p className="text-sm text-[#888baa] mb-3">
                {result.items.length} granular topics · {result.totalHours}h estimated · {[...new Set(result.items.map((i) => i.subject))].length} subjects
              </p>

              {/* Difficulty Breakdown Badges */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#888baa] mb-4 p-2.5 rounded-lg bg-[#161824] border border-[#2a2d42]/60">
                <span className="font-semibold text-white">Difficulty Breakdown:</span>
                <span className="badge badge-easy font-medium">
                  Easy: {result.items.filter((i) => (i.difficulty || i.complexity) === 'easy').length}
                </span>
                <span className="badge badge-medium font-medium">
                  Medium: {result.items.filter((i) => (i.difficulty || i.complexity) === 'medium').length}
                </span>
                <span className="badge badge-hard font-medium">
                  Hard: {result.items.filter((i) => (i.difficulty || i.complexity) === 'hard').length}
                </span>
              </div>

              <div className="space-y-4 max-h-72 sm:max-h-80 overflow-y-auto pr-2">
                {[...new Set(result.items.map((i) => i.subject))].map((subject) => {
                  const subjectItems = result.items.filter((i) => i.subject === subject);
                  const color = subjectItems[0]?.color || '#6366f1';
                  const chapters = [...new Set(subjectItems.map((i) => i.chapter))];

                  return (
                    <div key={subject} className="border border-[#2a2d42]/60 rounded-xl p-3 bg-[#12131d]">
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#2a2d42]/40">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="font-semibold text-sm text-white">{subject}</span>
                        </div>
                        <span className="text-xs text-[#888baa]">
                          {subjectItems.reduce((a, b) => a + (b.estimatedHours || 0), 0).toFixed(1)}h total
                        </span>
                      </div>

                      <div className="space-y-3 pl-1">
                        {chapters.map((chapter) => {
                          const chapItems = subjectItems.filter((i) => i.chapter === chapter);
                          return (
                            <div key={chapter} className="space-y-1.5">
                              <p className="text-xs font-semibold text-[#a5b4fc] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                                {chapter}
                              </p>
                              <div className="space-y-1 pl-3">
                                {chapItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-2 py-1 px-2 rounded-lg bg-[#181a28]/60 hover:bg-[#181a28] text-xs transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[#e2e8f0] font-medium">
                                        {item.topicName || item.chapter}
                                      </span>
                                      {item.prerequisites && item.prerequisites.length > 0 && (
                                        <p className="text-[10px] text-[#6b7280] truncate mt-0.5">
                                          Prerequisites: {item.prerequisites.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className={`badge badge-${item.difficulty || item.complexity} text-[10px] px-2 py-0.5`}>
                                        {item.difficulty || item.complexity}
                                      </span>
                                      <span className="text-[11px] text-[#94a3b8] font-mono">
                                        {item.estimatedHours}h
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={handleContinue} className="btn btn-primary btn-lg w-full glow-primary">
              Continue to weekly routine <ChevronRight className="w-5 h-5 flex-shrink-0" />
            </button>
          </div>
        )}
        </section>

          <aside className="upload-guide-panel" aria-label="Material tips and next steps">
            <div className="upload-guide-intro">
              <span className="upload-guide-icon"><Sparkles size={17} aria-hidden="true" /></span>
              <p className="workspace-overline">QUICK GUIDE</p>
              <h2>{inputMode === 'file' ? 'Bring your course outline' : inputMode === 'chapters' ? 'Give each chapter context' : 'Start with readable notes'}</h2>
              <p>
                {inputMode === 'file'
                  ? 'A syllabus or course outline gives the topic organizer the clearest structure to work with.'
                  : inputMode === 'chapters'
                  ? 'Add the course or exam name, then put each chapter on its own line.'
                  : 'Headings and chapter names make it easier to group related material.'}
              </p>
            </div>

            <div className="upload-guide-divider" />
            <p className="upload-guide-label">A FEW HELPFUL TIPS</p>
            <ul className="upload-guide-list">
              <li><CheckCircle size={15} aria-hidden="true" /><span>Include the subject or course name.</span></li>
              <li><CheckCircle size={15} aria-hidden="true" /><span>Keep chapter headings in the material.</span></li>
              <li><CheckCircle size={15} aria-hidden="true" /><span>You can review topics before scheduling.</span></li>
            </ul>

            {inputMode === 'file' && (
              <div className="upload-guide-formats">
                <span>SUPPORTED FILES</span>
                <p>PDF · PNG · JPG · WEBP · TXT · MD</p>
                <small>Maximum file size: 20 MB</small>
              </div>
            )}

            <div className="upload-guide-next">
              <span>02</span>
              <div>
                <strong>Next: shape your week</strong>
                <p>Add classes, routines, and the time you have for studying.</p>
              </div>
            </div>
          </aside>
          </div>
        </div>

        <nav className="workspace-mobile-nav upload-mobile-nav" aria-label="Mobile workspace navigation">
          <Link href="/" className="workspace-mobile-nav-item">
            <LayoutDashboard size={18} aria-hidden="true" /><span>Home</span>
          </Link>
          <Link href="/dashboard" className="workspace-mobile-nav-item">
            <CalendarDays size={18} aria-hidden="true" /><span>Schedule</span>
          </Link>
          <Link href="/upload" className="workspace-mobile-nav-item workspace-mobile-nav-active" aria-current="page">
            <Upload size={18} aria-hidden="true" /><span>Add material</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}

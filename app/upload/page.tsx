'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Image,
  CheckCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  X,
  Edit3,
  Key,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { parseSyllabus, parseTextWithAPI } from '@/lib/syllabusParser';
import { ParsedSyllabus } from '@/lib/types';
import Link from 'next/link';
import ApiKeyModal, { getStoredGeminiKey } from '@/components/ApiKeyModal';

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

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  const [parseState, setParseState] = useState<ParseState>('idle');
  const [parseStep, setParseStep] = useState(0);
  const [result, setResult] = useState<ParsedSyllabus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync API key state on mount
  useEffect(() => {
    setHasApiKey(!!getStoredGeminiKey());
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
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20 MB
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
    } catch (e: any) {
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
    : <Image className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400" />;

  return (
    <main className="animated-bg min-h-screen overflow-x-hidden">
      <div className="orb orb-primary w-[250px] h-[250px] sm:w-[500px] sm:h-[500px] top-[-80px] right-[-80px]" />
      <div className="orb orb-accent w-[180px] h-[180px] sm:w-[300px] sm:h-[300px] bottom-[100px] left-[-60px]" />

      {/* AI Key Setup Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => {
          setIsKeyModalOpen(false);
          setHasApiKey(!!getStoredGeminiKey());
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base sm:text-lg">
            StudySync <span className="gradient-text">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-[#888baa]">
          <span className="badge badge-primary">✨ AI Powered</span>
          <span className="text-xs text-[#888baa] hidden sm:inline-flex">Step 1 of 2</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-6 sm:mb-8 animate-fadeIn">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Add Your <span className="gradient-text">Syllabus & Notes</span>
          </h1>
          <p className="text-[#888baa] text-sm sm:text-base">
            Upload your document or paste notes directly. The scheduler extracts your actual topics.
          </p>
        </div>

        {/* Input Mode Selector */}
        <div className="flex justify-center mb-6">
          <div className="glass p-1 rounded-xl inline-flex gap-1 flex-wrap justify-center">
            <button
              onClick={() => { setInputMode('file'); setParseState('idle'); setResult(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                inputMode === 'file'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-[#888baa] hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" /> Upload Document
            </button>
            <button
              onClick={() => { setInputMode('chapters'); setParseState('idle'); setResult(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                inputMode === 'chapters'
                  ? 'bg-accent text-white shadow-lg'
                  : 'text-[#888baa] hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Enter Chapter Names
            </button>
            <button
              onClick={() => { setInputMode('paste'); setParseState('idle'); setResult(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                inputMode === 'paste'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-[#888baa] hover:text-white'
              }`}
            >
              <Edit3 className="w-4 h-4" /> Paste Full Notes
            </button>
          </div>
        </div>

        {/* File Dropzone Mode */}
        {inputMode === 'file' && (
          <div
            {...getRootProps()}
            className={`dropzone p-6 sm:p-12 text-center animate-fadeIn delay-100 ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                {fileIcon}
                <div>
                  <p className="font-semibold text-white text-sm sm:text-base break-all">{file.name}</p>
                  <p className="text-sm text-[#888baa]">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setParseState('idle'); }}
                  className="btn btn-ghost text-xs"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl glass flex items-center justify-center">
                  <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400" />
                </div>
                <div>
                  <p className="font-semibold text-base sm:text-lg">
                    {isDragActive ? 'Drop it here!' : 'Drag & drop your syllabus or notes'}
                  </p>
                  <p className="text-[#888baa] text-sm mt-1">PDF, PNG, JPG, or TXT / Markdown</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  {['PDF', 'PNG', 'JPG', 'TXT', 'Notes'].map((t) => (
                    <span key={t} className="badge badge-primary">{t}</span>
                  ))}
                </div>
                <p className="text-xs text-[#555]">Max 20 MB</p>
              </div>
            )}
          </div>
        )}

        {/* Paste Text Mode */}
        {inputMode === 'paste' && (
          <div className="card p-5 sm:p-6 animate-fadeIn space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888baa] mb-1.5">
                Syllabus Title (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Higher Mathematics, JavaScript Mastery, Physics 101"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-[#161824] border border-[#2a2d42] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#555870] focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#888baa]">
                  Paste Full Syllabus or Notes
                </label>
              </div>
              <textarea
                rows={8}
                placeholder="Paste your chapters, topics, bullet points, or lecture notes here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full bg-[#161824] border border-[#2a2d42] rounded-lg p-3.5 text-sm text-white font-mono placeholder-[#555870] focus:outline-none focus:border-primary-500 resize-y"
              />
            </div>
            <p className="text-xs text-[#888baa]">
              Works instantly even offline! The local engine groups chapters and estimates hours automatically.
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
                <p className="text-sm font-semibold text-accent">AI Knowledge Mode ✨</p>
                <p className="text-xs text-[#a5b4fc] mt-0.5">
                  Just type your chapter names with class/grade. The AI will automatically expand each chapter into granular sub-topics with difficulty levels — using its academic knowledge base (CBSE, JEE, NEET, UPSC, University curricula).
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888baa] mb-1.5">
                Course / Exam Title
              </label>
              <input
                type="text"
                placeholder="e.g. Class 12 Physics & Chemistry, JEE Mains 2025, UPSC GS Paper 1"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-[#161824] border border-[#2a2d42] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#555870] focus:outline-none focus:border-accent/60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#888baa]">
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
                rows={9}
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
              ⚡ Gemini AI will fetch detailed sub-topics from its knowledge of NCERT, JEE, NEET, UPSC syllabi and classify each by difficulty level.
            </p>
          </div>
        )}

        {/* Built-in Demo Section */}
        <div className="text-center my-5 sm:my-6 text-sm text-[#666]">
          — or explore sample syllabi —
        </div>
        <div className="glass p-4 rounded-xl text-center animate-fadeIn delay-200">
          <p className="text-sm text-[#888baa] mb-3">Try with a pre-configured sample syllabus</p>
          <div className="flex flex-col xs:flex-row gap-2.5 justify-center flex-wrap">
            {[
              { label: 'Biology Class 12 (CBSE)', idx: 2 },
              { label: 'CS Engineering Sem 5', idx: 0 },
              { label: 'UPSC General Studies', idx: 1 },
            ].map((demo) => (
              <button
                key={demo.label}
                onClick={async () => {
                  setParseState('parsing');
                  const { parseWithMock } = await import('@/lib/syllabusParser');
                  const parsed = await parseWithMock(demo.idx);
                  setResult(parsed);
                  setParseState('done');
                  setFile({ name: `${demo.label}.pdf`, size: 0 } as File);
                }}
                className={`btn text-sm w-full xs:w-auto ${
                  demo.idx === 2 ? 'btn-primary glow-primary' : 'btn-secondary'
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" /> {demo.label}
              </button>
            ))}
          </div>
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
              className={`btn btn-lg w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                inputMode === 'chapters'
                  ? 'bg-gradient-to-r from-accent to-primary-500 hover:from-purple-600 hover:to-primary-600 text-white glow-primary'
                  : 'btn-primary glow-primary'
              }`}
            >
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              {inputMode === 'chapters'
                ? 'Generate Topics with AI Knowledge'
                : inputMode === 'paste'
                ? 'Parse Pasted Notes'
                : 'Parse Syllabus with AI'}
            </button>
            {inputMode === 'chapters' && (
              <p className="text-xs text-[#888baa] mt-2">
                AI will expand your chapters using its academic knowledge (NCERT / JEE / NEET / UPSC)
              </p>
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
              <button
                onClick={() => { setInputMode('paste'); setParseState('idle'); }}
                className="btn btn-primary text-xs py-1 px-3"
              >
                Switch to Paste Tab
              </button>
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
                ) : (
                  <span className="badge badge-primary text-xs">
                    {(result.parseConfidence * 100).toFixed(0)}% genuine confidence
                  </span>
                )}
                <span className="text-xs text-[#888baa]">
                  {result.source === 'gemini-ai'
                    ? '✨ Gemini AI'
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
              Continue to Questionnaire <ChevronRight className="w-5 h-5 flex-shrink-0" />
            </button>
          </div>
        )}
        {/* Optional Custom API Key Trigger */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="text-[11px] text-[#555870] hover:text-[#888baa] transition-colors underline"
          >
            Custom API Key Settings (Optional)
          </button>
        </div>
      </div>
    </main>
  );
}

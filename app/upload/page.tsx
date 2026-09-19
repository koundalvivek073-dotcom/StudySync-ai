'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Image, CheckCircle, Loader2, Sparkles, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { parseSyllabus } from '@/lib/syllabusParser';
import { ParsedSyllabus } from '@/lib/types';
import Link from 'next/link';

type ParseState = 'idle' | 'parsing' | 'done' | 'error';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const PARSE_STEPS = [
  'Reading document structure…',
  'Extracting subjects & chapters…',
  'Estimating complexity levels…',
  'Calculating study hours…',
  'Finalising syllabus data…',
];

export default function UploadPage() {
  const router = useRouter();
  const { setSyllabus, setStep } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [parseStep, setParseStep] = useState(0);
  const [result, setResult] = useState<ParsedSyllabus | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!file) return;
    setParseState('parsing');
    setParseStep(0);
    setError(null);

    // Animate parse steps
    const interval = setInterval(() => {
      setParseStep((prev) => Math.min(prev + 1, PARSE_STEPS.length - 1));
    }, 500);

    try {
      const parsed = await parseSyllabus(file);
      clearInterval(interval);
      setParseStep(PARSE_STEPS.length - 1);
      setResult(parsed);
      setParseState('done');
    } catch (e) {
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
    : <Image className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400" />;

  return (
    <main className="animated-bg min-h-screen overflow-x-hidden">
      <div className="orb orb-primary w-[250px] h-[250px] sm:w-[500px] sm:h-[500px] top-[-80px] right-[-80px]" />
      <div className="orb orb-accent w-[180px] h-[180px] sm:w-[300px] sm:h-[300px] bottom-[100px] left-[-60px]" />

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
        {/* Step indicator */}
        <div className="flex items-center gap-1 sm:gap-2 text-sm text-[#888baa]">
          <span className="badge badge-primary">Step 1 of 2</span>
          <span className="hidden sm:inline">Upload Syllabus</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-10 animate-fadeIn">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Upload Your <span className="gradient-text">Syllabus</span>
          </h1>
          <p className="text-[#888baa] text-sm sm:text-base">
            Supports PDF, PNG, JPG — any screenshot or document works.
          </p>
        </div>

        {/* Dropzone */}
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
                  {isDragActive ? 'Drop it here!' : 'Drag & drop your syllabus'}
                </p>
                <p className="text-[#888baa] text-sm mt-1">or tap to browse files</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {['PDF', 'PNG', 'JPG', 'Screenshot'].map((t) => (
                  <span key={t} className="badge badge-primary">{t}</span>
                ))}
              </div>
              <p className="text-xs text-[#555]">Max 20 MB</p>
            </div>
          )}
        </div>

        {/* Or use demo */}
        <div className="text-center my-5 sm:my-6 text-sm text-[#666]">
          — or —
        </div>
        <div className="glass p-4 rounded-xl text-center animate-fadeIn delay-200">
          <p className="text-sm text-[#888baa] mb-3">Try with a built-in demo syllabus</p>
          <div className="flex flex-col xs:flex-row gap-3 justify-center">
            {['CS Engineering Sem 5', 'UPSC General Studies'].map((demo, i) => (
              <button
                key={demo}
                onClick={async () => {
                  setParseState('parsing');
                  const { parseWithMock } = await import('@/lib/syllabusParser');
                  const parsed = await parseWithMock(i);
                  setResult(parsed);
                  setParseState('done');
                  setFile({ name: `${demo}.pdf`, size: 0 } as File);
                }}
                className="btn btn-secondary text-sm w-full xs:w-auto"
              >
                <FileText className="w-4 h-4 flex-shrink-0" /> {demo}
              </button>
            ))}
          </div>
        </div>

        {/* Parse Button */}
        {file && parseState === 'idle' && (
          <div className="mt-5 sm:mt-6 text-center animate-scaleIn">
            <button onClick={handleParse} className="btn btn-primary btn-lg glow-primary w-full sm:w-auto">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              Parse Syllabus with AI
            </button>
          </div>
        )}

        {/* Parsing Progress */}
        {parseState === 'parsing' && (
          <div className="mt-5 sm:mt-6 card p-5 sm:p-6 animate-scaleIn">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-primary-400 animate-spin flex-shrink-0" />
              <span className="font-semibold">Analyzing your syllabus…</span>
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

        {/* Error */}
        {parseState === 'error' && (
          <div className="mt-5 sm:mt-6 warning-banner flex items-center gap-2 animate-scaleIn">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {parseState === 'done' && result && (
          <div className="mt-6 sm:mt-8 animate-fadeIn">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="font-semibold text-green-400">Syllabus parsed successfully!</span>
              <span className="badge badge-primary sm:ml-auto">
                {(result.parseConfidence * 100).toFixed(0)}% confidence
              </span>
            </div>

            <div className="card p-4 sm:p-5 mb-4">
              <h2 className="font-bold text-base sm:text-lg mb-1">{result.title}</h2>
              <p className="text-sm text-[#888baa] mb-4">
                {result.items.length} topics · {result.totalHours}h estimated · {[...new Set(result.items.map((i) => i.subject))].length} subjects
              </p>

              <div className="space-y-2 max-h-56 sm:max-h-64 overflow-y-auto pr-2">
                {[...new Set(result.items.map((i) => i.subject))].map((subject) => {
                  const items = result.items.filter((i) => i.subject === subject);
                  const color = items[0].color;
                  return (
                    <div key={subject}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="font-semibold text-sm">{subject}</span>
                        <span className="text-xs text-[#888baa]">
                          ({items.reduce((a, b) => a + b.estimatedHours, 0)}h)
                        </span>
                      </div>
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 pl-5 py-1 flex-wrap">
                          <span className="text-xs text-[#888baa] flex-1 min-w-0">• {item.chapter}</span>
                          <span className={`badge badge-${item.complexity}`}>{item.complexity}</span>
                          <span className="text-xs text-[#555] flex-shrink-0">{item.estimatedHours}h</span>
                        </div>
                      ))}
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
      </div>
    </main>
  );
}

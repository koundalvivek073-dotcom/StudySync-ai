/**
 * Syllabus Parser
 *
 * Mock mode: returns realistic sample data for demonstration.
 * Real mode: calls /api/parse-syllabus with the uploaded file.
 * Toggle via NEXT_PUBLIC_USE_MOCK_AI=true in .env.local
 */

import {
  ParsedSyllabus,
  SyllabusItem,
  Difficulty,
  SubjectItem,
  ChapterItem,
  GranularTopic,
} from './types';
import { generateSmartCurriculum } from './curriculumGenerator';

// ─── Color Palette ────────────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#fb923c', '#facc15', '#4ade80',
];

let colorIndex = 0;
export const nextColor = () => SUBJECT_COLORS[colorIndex++ % SUBJECT_COLORS.length];

/**
 * Normalizes raw structured model output or local parser output into the unified ParsedSyllabus structure.
 * Supports both the hierarchical subjects->chapters->topics structure and legacy flat items.
 */
export function normalizeToParsedSyllabus(raw: any, titleHint?: string, source = 'ai'): ParsedSyllabus {
  const colorMap = new Map<string, string>();
  let cIdx = 0;
  const getColor = (subj: string) => {
    if (!colorMap.has(subj)) {
      colorMap.set(subj, SUBJECT_COLORS[cIdx % SUBJECT_COLORS.length]);
      cIdx++;
    }
    return colorMap.get(subj)!;
  };

  const subjects: SubjectItem[] = [];
  const items: SyllabusItem[] = [];
  let calculatedHours = 0;

  // Case 1: Structured hierarchy { subjects: [ { subjectName, chapters: [ { chapterName, topics: [...] } ] } ] }
  if (raw && Array.isArray(raw.subjects) && raw.subjects.length > 0) {
    raw.subjects.forEach((subjRaw: any, sIdx: number) => {
      const subjectName = (subjRaw.subjectName || subjRaw.subject || `Subject ${sIdx + 1}`).trim();
      const color = getColor(subjectName);
      const chapters: ChapterItem[] = [];

      const rawChapters = Array.isArray(subjRaw.chapters) ? subjRaw.chapters : [];
      rawChapters.forEach((chapRaw: any, cIdxInner: number) => {
        const chapterName = (chapRaw.chapterName || chapRaw.chapter || `Chapter ${cIdxInner + 1}`).trim();
        const topics: GranularTopic[] = [];

        const rawTopics = Array.isArray(chapRaw.topics)
          ? chapRaw.topics
          : Array.isArray(chapRaw.subTopics)
          ? chapRaw.subTopics.map((st: string) => ({ topicName: st, difficulty: 'medium', estimatedHours: 2 }))
          : [];

        rawTopics.forEach((topRaw: any, tIdx: number) => {
          const rawName = typeof topRaw === 'string' ? topRaw : topRaw.topicName || topRaw.name || `Topic ${tIdx + 1}`;
          const topicName = rawName.replace(/^[-*•\s]+/, '').replace(/https?:\/\/\S+/gi, '').trim();
          if (!topicName || topicName.length < 2) return;

          let diff: Difficulty = 'medium';
          const dStr = (topRaw.difficulty || topRaw.complexity || '').toString().toLowerCase();
          if (dStr === 'easy' || dStr === 'medium' || dStr === 'hard') {
            diff = dStr;
          } else {
            const testText = `${chapterName} ${topicName}`.toLowerCase();
            if (/(proof|calculus|quantum|derivation|deep|advanced|theorem|optimization|dynamic|complex|deadlock|concurrency|b-tree)/.test(testText)) {
              diff = 'hard';
            } else if (/(intro|basics|overview|history|syntax|fundamentals|principles|definition|diagram)/.test(testText)) {
              diff = 'easy';
            }
          }

          const hours = typeof topRaw.estimatedHours === 'number' && !isNaN(topRaw.estimatedHours)
            ? Math.max(0.5, Math.min(8, Math.round(topRaw.estimatedHours * 2) / 2))
            : diff === 'hard' ? 2.5 : diff === 'medium' ? 1.5 : 1.0;

          const prereqs = Array.isArray(topRaw.prerequisites)
            ? topRaw.prerequisites.filter((p: any) => typeof p === 'string' && p.trim().length > 0)
            : [];

          const topicItem: GranularTopic = {
            id: `topic_${sIdx}_${cIdxInner}_${tIdx}_${Date.now()}`,
            topicName,
            difficulty: diff,
            estimatedHours: hours,
            prerequisites: prereqs,
            completed: 0,
          };
          topics.push(topicItem);

          items.push({
            id: topicItem.id!,
            subject: subjectName,
            chapter: chapterName,
            topicName,
            difficulty: diff,
            complexity: diff,
            estimatedHours: hours,
            prerequisites: prereqs,
            color,
            completed: 0,
            subTopics: [topicName],
          });

          calculatedHours += hours;
        });

        if (topics.length > 0) {
          chapters.push({
            id: `chap_${sIdx}_${cIdxInner}_${Date.now()}`,
            chapterName,
            topics,
          });
        }
      });

      if (chapters.length > 0) {
        subjects.push({
          id: `subj_${sIdx}_${Date.now()}`,
          subjectName,
          color,
          chapters,
        });
      }
    });
  }

  // Case 2: Legacy flat items array fallback
  if (items.length === 0 && raw && Array.isArray(raw.items) && raw.items.length > 0) {
    raw.items.forEach((item: any, iIdx: number) => {
      const subject = item.subject || 'General Studies';
      const chapter = item.chapter || `Chapter ${iIdx + 1}`;
      const color = getColor(subject);
      const subTopics: string[] = Array.isArray(item.subTopics) && item.subTopics.length > 0
        ? item.subTopics
        : [item.topicName || chapter];

      subTopics.forEach((st, sIdx) => {
        const diff: Difficulty = (item.difficulty || item.complexity || 'medium') as Difficulty;
        const hours = Math.max(1, Math.round((item.estimatedHours || 6) / subTopics.length * 2) / 2);
        items.push({
          id: `legacy_${iIdx}_${sIdx}_${Date.now()}`,
          subject,
          chapter,
          topicName: st,
          difficulty: diff,
          complexity: diff,
          estimatedHours: hours,
          prerequisites: [],
          color,
          completed: 0,
          subTopics: [st],
        });
        calculatedHours += hours;
      });
    });
  }

  // Ensure at least one fallback item exists
  if (items.length === 0) {
    const fallbackTitle = titleHint || 'Fundamentals';
    const color = getColor(fallbackTitle);
    items.push({
      id: `fallback_${Date.now()}`,
      subject: fallbackTitle,
      chapter: 'Core Concepts',
      topicName: 'Fundamental Principles & Practice',
      difficulty: 'medium',
      complexity: 'medium',
      estimatedHours: 6,
      prerequisites: [],
      color,
      completed: 0,
      subTopics: ['Fundamental Principles & Practice'],
    });
    calculatedHours = 6;
  }

  const finalTitle = raw?.title || titleHint || (items[0]?.subject ? `${items[0].subject} Syllabus` : 'Analyzed Syllabus');
  const confidence = Math.min(0.98, Math.max(0.7, typeof raw?.parseConfidence === 'number' ? raw.parseConfidence : 0.92));

  return {
    id: raw?.id || `syllabus_${Date.now()}`,
    title: finalTitle,
    source,
    subjects: subjects.length > 0 ? subjects : undefined,
    items,
    totalHours: Math.round(calculatedHours * 10) / 10,
    parseConfidence: confidence,
  };
}

// ─── Granular Mock Syllabi ────────────────────────────────────────────────────

const RAW_MOCK_DATA = [
  {
    id: 'demo_cs_sem5',
    title: 'Computer Science Engineering — Semester 5',
    subjects: [
      {
        subjectName: 'Operating Systems',
        chapters: [
          {
            chapterName: 'Process Management',
            topics: [
              { topicName: 'Processes & Thread Lifecycle', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'CPU Scheduling Algorithms (FCFS, SJF, Round Robin)', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Processes & Thread Lifecycle'] },
              { topicName: 'Deadlock Conditions & Prevention (Bankers Algorithm)', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['Processes & Thread Lifecycle'] },
              { topicName: 'Inter-Process Communication & Semaphores', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['Processes & Thread Lifecycle'] },
            ],
          },
          {
            chapterName: 'Memory Management',
            topics: [
              { topicName: 'Paging & Segmentation Architecture', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'Virtual Memory & Page Fault Handling', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Paging & Segmentation Architecture'] },
              { topicName: 'Page Replacement Algorithms (FIFO, LRU, Clock)', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['Virtual Memory & Page Fault Handling'] },
            ],
          },
        ],
      },
      {
        subjectName: 'Database Management Systems',
        chapters: [
          {
            chapterName: 'Relational Model & Design',
            topics: [
              { topicName: 'Entity-Relationship Diagrams & Schema Mapping', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
              { topicName: 'Relational Normalization (1NF, 2NF, 3NF, BCNF)', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['Entity-Relationship Diagrams & Schema Mapping'] },
              { topicName: 'Complex SQL Queries & Subquery Optimization', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'ACID Transactions & Two-Phase Locking', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Relational Normalization (1NF, 2NF, 3NF, BCNF)'] },
            ],
          },
          {
            chapterName: 'Indexing & Performance',
            topics: [
              { topicName: 'B-Tree & B+ Tree Indexing Internals', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'Stored Procedures, Triggers & Views', difficulty: 'medium' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
            ],
          },
        ],
      },
      {
        subjectName: 'Computer Networks',
        chapters: [
          {
            chapterName: 'Network Architecture & Protocols',
            topics: [
              { topicName: 'OSI Physical & Data Link Framing (MAC, ARP)', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
              { topicName: 'IPv4 & IPv6 Subnetting & CIDR Calculation', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'TCP Handshake, Congestion & Flow Control', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['IPv4 & IPv6 Subnetting & CIDR Calculation'] },
              { topicName: 'DNS, HTTP/2, HTTP/3 & TLS Security', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['TCP Handshake, Congestion & Flow Control'] },
            ],
          },
        ],
      },
      {
        subjectName: 'Theory of Computation',
        chapters: [
          {
            chapterName: 'Automata & Decidability',
            topics: [
              { topicName: 'DFA & NFA Equivalence and Regular Expressions', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'Context-Free Grammars & Pushdown Automata', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['DFA & NFA Equivalence and Regular Expressions'] },
              { topicName: 'Turing Machines & The Halting Problem', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['Context-Free Grammars & Pushdown Automata'] },
              { topicName: 'P vs NP Concepts & Reducibility', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Turing Machines & The Halting Problem'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'demo_upsc_gs',
    title: 'UPSC Civil Services — General Studies',
    subjects: [
      {
        subjectName: 'History',
        chapters: [
          {
            chapterName: 'Ancient & Medieval India',
            topics: [
              { topicName: 'Indus Valley Civilization & Town Planning', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
              { topicName: 'Vedic Literature, Philosophy & Society', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'Maurya Empire Administration & Ashokan Edicts', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Vedic Literature, Philosophy & Society'] },
            ],
          },
          {
            chapterName: 'Modern Indian Struggle',
            topics: [
              { topicName: 'British Colonial Policies & Socio-Religious Reforms', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'Freedom Movement: 1857 to Non-Cooperation', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['British Colonial Policies & Socio-Religious Reforms'] },
              { topicName: 'Partition, Independence & State Reorganisation', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['Freedom Movement: 1857 to Non-Cooperation'] },
            ],
          },
        ],
      },
      {
        subjectName: 'Polity & Governance',
        chapters: [
          {
            chapterName: 'Indian Constitutional Framework',
            topics: [
              { topicName: 'Preamble, Fundamental Rights & Writs', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'Directive Principles (DPSP) & Basic Structure Doctrine', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Preamble, Fundamental Rights & Writs'] },
              { topicName: 'Parliamentary Lawmaking & Executive Powers', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['Preamble, Fundamental Rights & Writs'] },
              { topicName: 'Supreme Court Jurisdiction & Judicial Review', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Parliamentary Lawmaking & Executive Powers'] },
            ],
          },
        ],
      },
      {
        subjectName: 'Economy',
        chapters: [
          {
            chapterName: 'Macroeconomics & Fiscal Policy',
            topics: [
              { topicName: 'National Income Accounting (GDP, GVA, Real vs Nominal)', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'Monetary Policy Framework & RBI Repo Mechanisms', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['National Income Accounting (GDP, GVA, Real vs Nominal)'] },
              { topicName: 'Union Budget, Fiscal Deficit & GST Architecture', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'Agricultural Subsidies & Food Security (MSP, PDS)', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
            ],
          },
        ],
      },
      {
        subjectName: 'Environment & Science',
        chapters: [
          {
            chapterName: 'Ecology & Biodiversity',
            topics: [
              { topicName: 'Ecosystem Dynamics & Energy Pyramids', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
              { topicName: 'Climate Change Conventions (UNFCCC, COP Accords)', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'Space Exploration, Biotechnology & AI Governance', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'demo_biology_12',
    title: 'Senior Secondary Biology — Class 12 (CBSE 2025-26)',
    subjects: [
      {
        subjectName: 'Biology',
        chapters: [
          {
            chapterName: 'Sexual Reproduction in Flowering Plants',
            topics: [
              { topicName: 'Flower Structure & Microsporogenesis Events', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: [] },
              { topicName: 'Pollination Mechanisms & Pollen-Pistil Interaction', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['Flower Structure & Microsporogenesis Events'] },
              { topicName: 'Double Fertilization & Endosperm Development', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Pollination Mechanisms & Pollen-Pistil Interaction'] },
              { topicName: 'Embryogeny, Seed Dispersal & Apomixis', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: ['Double Fertilization & Endosperm Development'] },
            ],
          },
          {
            chapterName: 'Human Reproduction & Health',
            topics: [
              { topicName: 'Male & Female Reproductive Anatomy', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
              { topicName: 'Gametogenesis (Spermatogenesis & Oogenesis)', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Male & Female Reproductive Anatomy'] },
              { topicName: 'Menstrual Cycle & Hormonal Feedback Loops', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Gametogenesis (Spermatogenesis & Oogenesis)'] },
              { topicName: 'Fertilization, Cleavage & Implantation', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['Menstrual Cycle & Hormonal Feedback Loops'] },
              { topicName: 'Contraceptive Strategies & Assisted Reproductive Tech (ART)', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
            ],
          },
          {
            chapterName: 'Genetics & Molecular Inheritance',
            topics: [
              { topicName: 'Mendelian Dihybrid Crosses & Deviations', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'Sex Determination, Linkage & Chromosome Mapping', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Mendelian Dihybrid Crosses & Deviations'] },
              { topicName: 'DNA Structure, Central Dogma & Nucleosome Packaging', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'DNA Replication Enzymology (Meselson-Stahl)', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['DNA Structure, Central Dogma & Nucleosome Packaging'] },
              { topicName: 'Transcription, RNA Splicing & Genetic Code', difficulty: 'hard' as Difficulty, estimatedHours: 3.0, prerequisites: ['DNA Replication Enzymology (Meselson-Stahl)'] },
              { topicName: 'Lac Operon Model & Human Genome Project Overview', difficulty: 'hard' as Difficulty, estimatedHours: 2.0, prerequisites: ['Transcription, RNA Splicing & Genetic Code'] },
            ],
          },
          {
            chapterName: 'Biotechnology & Applications',
            topics: [
              { topicName: 'Restriction Endonucleases, Ligases & pBR322 Vectors', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: [] },
              { topicName: 'Polymerase Chain Reaction (PCR) & Gel Electrophoresis', difficulty: 'medium' as Difficulty, estimatedHours: 2.0, prerequisites: ['Restriction Endonucleases, Ligases & pBR322 Vectors'] },
              { topicName: 'Bioreactors & Downstream Processing Systems', difficulty: 'easy' as Difficulty, estimatedHours: 1.5, prerequisites: [] },
              { topicName: 'Transgenic Crops (Bt Cotton, RNAi) & Recombinant Insulin', difficulty: 'hard' as Difficulty, estimatedHours: 2.5, prerequisites: ['Polymerase Chain Reaction (PCR) & Gel Electrophoresis'] },
            ],
          },
        ],
      },
    ],
  },
];

const MOCK_SYLLABI: ParsedSyllabus[] = RAW_MOCK_DATA.map((raw) =>
  normalizeToParsedSyllabus(raw, raw.title, 'demo'),
);

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse with mock AI (no API call needed). Returns a sample syllabus. */
export function parseWithMock(index = 0): Promise<ParsedSyllabus> {
  return new Promise((resolve) => {
    // Simulate 2.5 second processing time
    setTimeout(() => {
      resolve(MOCK_SYLLABI[index % MOCK_SYLLABI.length]);
    }, 2500);
  });
}

/** Helper to get stored key */
function getClientGeminiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('studysync_gemini_api_key') || null;
}

/** Parse a real file via the API route with automatic smart fallback. */
export async function parseWithAPI(file: File): Promise<ParsedSyllabus> {
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', fileName);

    const geminiKey = getClientGeminiKey();
    const headers: Record<string, string> = {};
    if (geminiKey) {
      headers['x-gemini-api-key'] = geminiKey;
    }

    const res = await fetch('/api/parse-syllabus', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.items && data.items.length > 0) {
        return {
          ...data,
          id: data.id ?? `upload_${Date.now()}`,
          source: data.source ?? file.name,
        } as ParsedSyllabus;
      }
    }
  } catch (err) {
    console.warn('API parsing encountered issue, engaging smart curriculum engine:', err);
  }

  // Seamless client fallback: guarantee a structured syllabus is returned
  return generateSmartCurriculum(fileName);
}

/** Parse raw text or pasted syllabus notes via the API route with automatic smart fallback. */
export async function parseTextWithAPI(text: string, title = 'Pasted Syllabus'): Promise<ParsedSyllabus> {
  try {
    const geminiKey = getClientGeminiKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (geminiKey) {
      headers['x-gemini-api-key'] = geminiKey;
    }

    const res = await fetch('/api/parse-syllabus', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, title }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.items && data.items.length > 0) {
        return {
          ...data,
          id: data.id ?? `text_${Date.now()}`,
          source: data.source ?? title,
        } as ParsedSyllabus;
      }
    }
  } catch (err) {
    console.warn('Text API parsing encountered issue, engaging smart curriculum engine:', err);
  }

  // Seamless client fallback: guarantee a structured syllabus is returned
  return generateSmartCurriculum(title || text.slice(0, 40));
}

/** Main entry point: uses real API parsing by default so uploaded notes (Maths, JS, etc.) are accurately analyzed. */
export async function parseSyllabus(file: File): Promise<ParsedSyllabus> {
  const useMockExplicit = process.env.NEXT_PUBLIC_USE_MOCK_AI === 'true';
  if (useMockExplicit) {
    return parseWithMock();
  }
  return parseWithAPI(file);
}

/** Assign fresh colors to all items (useful after editing). */
export function assignColors(items: SyllabusItem[]): SyllabusItem[] {
  const subjectColorMap = new Map<string, string>();
  return items.map((item) => {
    if (!subjectColorMap.has(item.subject)) {
      subjectColorMap.set(item.subject, nextColor());
    }
    return { ...item, color: subjectColorMap.get(item.subject)! };
  });
}

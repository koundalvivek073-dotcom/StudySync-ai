/**
 * Syllabus Parser
 *
 * Mock mode: returns realistic sample data for demonstration.
 * Real mode: calls /api/parse-syllabus with the uploaded file.
 * Toggle via NEXT_PUBLIC_USE_MOCK_AI=true in .env.local
 */

import { ParsedSyllabus, SyllabusItem } from './types';

// ─── Color Palette ────────────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#fb923c', '#facc15', '#4ade80',
];

let colorIndex = 0;
const nextColor = () => SUBJECT_COLORS[colorIndex++ % SUBJECT_COLORS.length];

// ─── Mock Syllabi ─────────────────────────────────────────────────────────────

const MOCK_SYLLABI: ParsedSyllabus[] = [
  {
    id: 'demo_cs_sem5',
    source: 'demo',
    title: 'Computer Science Engineering — Semester 5',
    totalHours: 180,
    parseConfidence: 0.92,
    items: [
      {
        id: 'cs1', subject: 'Operating Systems', chapter: 'Process Management',
        subTopics: ['Processes & Threads', 'CPU Scheduling', 'Deadlocks', 'IPC'],
        complexity: 'hard', estimatedHours: 18, color: '#6366f1', completed: 0,
      },
      {
        id: 'cs2', subject: 'Operating Systems', chapter: 'Memory Management',
        subTopics: ['Virtual Memory', 'Paging', 'Segmentation', 'Page Replacement'],
        complexity: 'hard', estimatedHours: 16, color: '#6366f1', completed: 0,
      },
      {
        id: 'cs3', subject: 'Database Management', chapter: 'Relational Model',
        subTopics: ['ER Diagrams', 'Normalization', 'SQL Queries', 'Transactions'],
        complexity: 'medium', estimatedHours: 20, color: '#8b5cf6', completed: 0,
      },
      {
        id: 'cs4', subject: 'Database Management', chapter: 'Advanced SQL & Indexing',
        subTopics: ['Stored Procedures', 'Triggers', 'B-Trees', 'Query Optimization'],
        complexity: 'hard', estimatedHours: 14, color: '#8b5cf6', completed: 0,
      },
      {
        id: 'cs5', subject: 'Computer Networks', chapter: 'OSI & TCP/IP Model',
        subTopics: ['Physical Layer', 'Data Link', 'Network Layer', 'Transport Layer'],
        complexity: 'medium', estimatedHours: 15, color: '#ec4899', completed: 0,
      },
      {
        id: 'cs6', subject: 'Computer Networks', chapter: 'Application Protocols',
        subTopics: ['HTTP/HTTPS', 'DNS', 'SMTP', 'FTP', 'Socket Programming'],
        complexity: 'medium', estimatedHours: 12, color: '#ec4899', completed: 0,
      },
      {
        id: 'cs7', subject: 'Theory of Computation', chapter: 'Automata',
        subTopics: ['DFA', 'NFA', 'Regular Expressions', 'CFG', 'Pushdown Automata'],
        complexity: 'hard', estimatedHours: 20, color: '#f43f5e', completed: 0,
      },
      {
        id: 'cs8', subject: 'Theory of Computation', chapter: 'Complexity',
        subTopics: ['P vs NP', 'Turing Machines', 'Decidability', 'Reducibility'],
        complexity: 'hard', estimatedHours: 18, color: '#f43f5e', completed: 0,
      },
      {
        id: 'cs9', subject: 'Software Engineering', chapter: 'SDLC & Agile',
        subTopics: ['Waterfall', 'Scrum', 'Kanban', 'Requirements Engineering'],
        complexity: 'easy', estimatedHours: 10, color: '#f97316', completed: 0,
      },
      {
        id: 'cs10', subject: 'Software Engineering', chapter: 'Testing & Metrics',
        subTopics: ['Unit Testing', 'Integration Testing', 'Code Coverage', 'CI/CD'],
        complexity: 'medium', estimatedHours: 12, color: '#f97316', completed: 0,
      },
      {
        id: 'cs11', subject: 'Discrete Mathematics', chapter: 'Graph Theory',
        subTopics: ['Trees', 'Shortest Paths', 'Spanning Trees', 'Network Flow'],
        complexity: 'medium', estimatedHours: 14, color: '#eab308', completed: 0,
      },
      {
        id: 'cs12', subject: 'Discrete Mathematics', chapter: 'Logic & Proofs',
        subTopics: ['Propositional Logic', 'Predicate Logic', 'Proof Techniques'],
        complexity: 'medium', estimatedHours: 11, color: '#eab308', completed: 0,
      },
    ],
  },
  {
    id: 'demo_upsc_gs',
    source: 'demo',
    title: 'UPSC Civil Services — General Studies',
    totalHours: 240,
    parseConfidence: 0.88,
    items: [
      {
        id: 'u1', subject: 'History', chapter: 'Ancient India',
        subTopics: ['Indus Valley', 'Vedic Period', 'Maurya Empire', 'Gupta Period'],
        complexity: 'medium', estimatedHours: 20, color: '#6366f1', completed: 0,
      },
      {
        id: 'u2', subject: 'History', chapter: 'Modern India',
        subTopics: ['British Rule', 'Freedom Struggle', 'Partition', 'Post-Independence'],
        complexity: 'hard', estimatedHours: 30, color: '#6366f1', completed: 0,
      },
      {
        id: 'u3', subject: 'Geography', chapter: 'Physical Geography',
        subTopics: ['Landforms', 'Climate', 'Drainage Systems', 'Natural Resources'],
        complexity: 'medium', estimatedHours: 25, color: '#8b5cf6', completed: 0,
      },
      {
        id: 'u4', subject: 'Polity', chapter: 'Indian Constitution',
        subTopics: ['Fundamental Rights', 'Directive Principles', 'Parliament', 'Judiciary'],
        complexity: 'hard', estimatedHours: 35, color: '#ec4899', completed: 0,
      },
      {
        id: 'u5', subject: 'Economics', chapter: 'Indian Economy',
        subTopics: ['GDP', 'Inflation', 'Monetary Policy', 'Five Year Plans', 'Agriculture'],
        complexity: 'hard', estimatedHours: 30, color: '#f43f5e', completed: 0,
      },
      {
        id: 'u6', subject: 'Science & Tech', chapter: 'Current Developments',
        subTopics: ['Space', 'Defence', 'Biotechnology', 'IT & Cyber'],
        complexity: 'medium', estimatedHours: 20, color: '#22c55e', completed: 0,
      },
      {
        id: 'u7', subject: 'Environment', chapter: 'Ecology & Climate',
        subTopics: ['Biodiversity', 'Climate Change', 'Treaties', 'Pollution'],
        complexity: 'medium', estimatedHours: 20, color: '#14b8a6', completed: 0,
      },
      {
        id: 'u8', subject: 'Current Affairs', chapter: 'Monthly Compilation',
        subTopics: ['National', 'International', 'Schemes', 'Awards & Recognition'],
        complexity: 'easy', estimatedHours: 60, color: '#06b6d4', completed: 0,
      },
    ],
  },
];

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

/** Parse a real file via the API route. */
export async function parseWithAPI(file: File): Promise<ParsedSyllabus> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/parse-syllabus', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Parse failed: ${res.statusText}`);
  }

  const data = await res.json();
  // Ensure id is present
  return {
    ...data,
    id: data.id ?? `upload_${Date.now()}`,
    source: file.name,
  } as ParsedSyllabus;
}

/** Main entry point: uses mock or real depending on env var. */
export async function parseSyllabus(file: File): Promise<ParsedSyllabus> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AI !== 'false';
  if (useMock) {
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

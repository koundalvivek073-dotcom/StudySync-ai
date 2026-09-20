/**
 * Syllabus Parser
 *
 * Mock mode: returns realistic sample data for demonstration.
 * Real mode: calls /api/parse-syllabus with the uploaded file.
 * Toggle via NEXT_PUBLIC_USE_MOCK_AI=true in .env.local
 */

import { ParsedSyllabus, SyllabusItem } from './types';
import { generateSmartCurriculum } from './curriculumGenerator';

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
  {
    id: 'demo_biology_12',
    source: 'demo',
    title: 'Senior Secondary Biology — Class 12 (CBSE 2025-26)',
    totalHours: 140,
    parseConfidence: 0.95,
    items: [
      {
        id: 'bio1', subject: 'Biology', chapter: 'Chapter 1: Sexual Reproduction in Flowering Plants',
        subTopics: ['Flower Structure & Pre-fertilization', 'Pollination & Pollen-Pistil Interaction', 'Double Fertilization', 'Endosperm & Embryo Development', 'Seeds, Fruits & Apomixis'],
        complexity: 'medium', estimatedHours: 12, color: '#10b981', completed: 0,
      },
      {
        id: 'bio2', subject: 'Biology', chapter: 'Chapter 2: Human Reproduction',
        subTopics: ['Male & Female Reproductive Systems', 'Gametogenesis (Spermatogenesis & Oogenesis)', 'Menstrual Cycle & Hormonal Regulation', 'Fertilization, Implantation & Pregnancy', 'Parturition & Lactation'],
        complexity: 'hard', estimatedHours: 14, color: '#10b981', completed: 0,
      },
      {
        id: 'bio3', subject: 'Biology', chapter: 'Chapter 3: Reproductive Health',
        subTopics: ['Population Stabilization & Contraceptive Methods', 'Medical Termination of Pregnancy (MTP)', 'Sexually Transmitted Infections (STIs)', 'Infertility & Assisted Reproductive Technologies (ART)'],
        complexity: 'easy', estimatedHours: 8, color: '#10b981', completed: 0,
      },
      {
        id: 'bio4', subject: 'Biology', chapter: 'Chapter 4: Principles of Inheritance & Variation',
        subTopics: ['Mendelian Ratios & Deviations', 'Chromosomal Theory of Inheritance', 'Sex Determination & Linkage', 'Pedigree Analysis & Mendelian Disorders', 'Chromosomal Disorders (Down, Turner, Klinefelter)'],
        complexity: 'hard', estimatedHours: 18, color: '#8b5cf6', completed: 0,
      },
      {
        id: 'bio5', subject: 'Biology', chapter: 'Chapter 5: Molecular Basis of Inheritance',
        subTopics: ['DNA as Genetic Material & Structure', 'DNA Packaging & Central Dogma', 'DNA Replication Mechanics', 'Transcription & RNA Processing', 'Genetic Code & Translation', 'Lac Operon & Human Genome Project', 'DNA Fingerprinting'],
        complexity: 'hard', estimatedHours: 20, color: '#8b5cf6', completed: 0,
      },
      {
        id: 'bio6', subject: 'Biology', chapter: 'Chapter 6: Evolution',
        subTopics: ['Origin of Life & Geological Time Scale', 'Evidences for Evolution (Comparative Anatomy & Embryology)', 'Darwinism, Natural Selection & Hardy-Weinberg Principle', 'Adaptive Radiation & Human Evolution'],
        complexity: 'medium', estimatedHours: 12, color: '#8b5cf6', completed: 0,
      },
      {
        id: 'bio7', subject: 'Biology', chapter: 'Chapter 7: Human Health & Disease',
        subTopics: ['Common Human Diseases (Typhoid, Malaria, Pneumonia)', 'Innate & Acquired Immunity, Antibodies', 'Vaccination, Allergies & Autoimmunity', 'AIDS (HIV Life Cycle) & Cancer', 'Drug & Alcohol Abuse Prevention'],
        complexity: 'medium', estimatedHours: 14, color: '#f59e0b', completed: 0,
      },
      {
        id: 'bio8', subject: 'Biology', chapter: 'Chapter 8: Microbes in Human Welfare',
        subTopics: ['Microbes in Household Food Processing', 'Industrial Fermentation & Antibiotics', 'Biological Sewage Treatment (STP)', 'Biogas Production & Methanogens', 'Biocontrol Agents & Biofertilizers'],
        complexity: 'easy', estimatedHours: 8, color: '#f59e0b', completed: 0,
      },
      {
        id: 'bio9', subject: 'Biology', chapter: 'Chapter 9: Biotechnology — Principles & Processes',
        subTopics: ['Genetic Engineering & Recombinant DNA', 'Restriction Enzymes & DNA Ligase', 'Cloning Vectors (pBR322, Ti Plasmid)', 'Polymerase Chain Reaction (PCR)', 'Bioreactors & Downstream Processing'],
        complexity: 'hard', estimatedHours: 14, color: '#06b6d4', completed: 0,
      },
      {
        id: 'bio10', subject: 'Biology', chapter: 'Chapter 10: Biotechnology and Its Applications',
        subTopics: ['Genetically Modified Crops (Bt Cotton, RNAi)', 'Therapeutic Insulin Production in Bacteria', 'Gene Therapy (ADA Deficiency)', 'Transgenic Animals & Ethical Issues'],
        complexity: 'medium', estimatedHours: 10, color: '#06b6d4', completed: 0,
      },
      {
        id: 'bio11', subject: 'Biology', chapter: 'Chapter 11: Organisms and Populations',
        subTopics: ['Major Abiotic Factors & Homeostasis', 'Physiological & Behavioral Adaptations', 'Population Attributes & Growth Models (Logistic vs Exponential)', 'Species Interactions (Mutualism, Parasitism, Competition)'],
        complexity: 'medium', estimatedHours: 10, color: '#ec4899', completed: 0,
      },
      {
        id: 'bio12', subject: 'Biology', chapter: 'Chapter 12: Ecosystem',
        subTopics: ['Ecosystem Structure & Stratification', 'Primary & Secondary Productivity', 'Decomposition Stages & Factors', 'Energy Flow (10% Law)', 'Ecological Pyramids (Number, Biomass, Energy)'],
        complexity: 'easy', estimatedHours: 8, color: '#ec4899', completed: 0,
      },
      {
        id: 'bio13', subject: 'Biology', chapter: 'Chapter 13: Biodiversity and Conservation',
        subTopics: ['Levels & Latitudinal Gradients of Biodiversity', 'The Evil Quartet (Habitat Loss, Over-exploitation)', 'Why We Must Conserve Biodiversity', 'In-Situ vs Ex-Situ Conservation Strategies'],
        complexity: 'easy', estimatedHours: 8, color: '#ec4899', completed: 0,
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

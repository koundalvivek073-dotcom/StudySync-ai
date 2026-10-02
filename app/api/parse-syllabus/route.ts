import { NextRequest, NextResponse } from 'next/server';
import {
  ParsedSyllabus,
  SyllabusItem,
  Difficulty,
  SubjectItem,
  ChapterItem,
  GranularTopic,
} from '@/lib/types';
import { generateSmartCurriculum } from '@/lib/curriculumGenerator';

export const maxDuration = 60;

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#fb923c', '#facc15', '#4ade80',
];

const SYSTEM_INSTRUCTION = `You are a World-Class Academic Curriculum Expert and AI Engineer with encyclopedic knowledge of all school/college syllabi worldwide (CBSE, ICSE, IB, IGCSE, JEE, NEET, UPSC, University curricula, etc.).

Your MOST CRITICAL capability: When given ONLY chapter names or class/grade information (e.g. "Class 12 Physics - Rotational Motion", "CBSE 10th Biology", "JEE Chemistry Organic"), you MUST use your internal academic knowledge base to generate a complete, detailed, pedagogically accurate breakdown of all key sub-topics for that chapter/subject — exactly as taught in textbooks.

YOU ARE THE KNOWLEDGE SOURCE. Do NOT say "I cannot determine topics from this input." ALWAYS generate granular topics from your training knowledge.

STRICT PEDAGOGICAL & EXTRACTION RULES:
1. KNOWLEDGE ENRICHMENT (MOST IMPORTANT):
   - If the input is bare chapter names, class info, or syllabus headings WITHOUT detailed topic lists, USE YOUR INTERNAL KNOWLEDGE to fill in all granular sub-topics.
   - For example: "Class 12 Physics - Rotational Motion" → generate sub-topics like: "Torque & Angular Momentum", "Moment of Inertia & Parallel/Perpendicular Axis Theorems", "Rolling Motion & Kinetic Energy", "Angular Momentum Conservation", etc.
   - For CBSE/JEE/NEET/UPSC subjects: Generate sub-topics exactly as they appear in NCERT textbooks or standard prep material.
   - NEVER return the chapter name itself as a topic.

2. STRUCTURE & HIERARCHY:
   - Group topics under their exact "subjectName" and "chapterName".
   - Break every chapter into 4 to 8 granular, actionable "topics".
   - NEVER output broad, vague, full chapter titles as topic names!
   - NEVER output raw web links, URLs, course policy text, grading breakdowns, or document noise.

3. DIFFICULTY CLASSIFICATION (MANDATORY for every topic):
   - "easy": Foundational definitions, basic recall, introductory concepts, qualitative overviews, historical facts.
   - "medium": Standard problem-solving, mechanism explanations, procedural calculations, standard algorithms, numerical applications.
   - "hard": Advanced theoretical proofs, complex derivations, multi-step optimization, nuanced edge cases, abstract theory, higher-order analysis.

4. ESTIMATED STUDY HOURS:
   - Assign realistic study hours per topic between 0.5 and 4.0 hours (typically 1.0–2.5h per sub-topic).
   - Easy topics: 1.0–1.5h | Medium: 1.5–2.0h | Hard: 2.0–3.0h

5. PREREQUISITES:
   - List prerequisite topic names from earlier in the same chapter/subject (or empty array []).

6. OUTPUT FORMAT — Output ONLY valid JSON:
{
  "title": "string (descriptive course/syllabus title)",
  "parseConfidence": number (0.75 to 0.98),
  "subjects": [
    {
      "subjectName": "Physics",
      "chapters": [
        {
          "chapterName": "Rotational Motion",
          "topics": [
            {
              "topicName": "Torque & Angular Momentum Concepts",
              "difficulty": "medium",
              "estimatedHours": 2.0,
              "prerequisites": []
            },
            {
              "topicName": "Moment of Inertia & Axis Theorems",
              "difficulty": "hard",
              "estimatedHours": 2.5,
              "prerequisites": ["Torque & Angular Momentum Concepts"]
            },
            {
              "topicName": "Rolling Motion & Kinetic Energy",
              "difficulty": "hard",
              "estimatedHours": 2.0,
              "prerequisites": ["Moment of Inertia & Axis Theorems"]
            }
          ]
        }
      ]
    }
  ]
}`;

import { normalizeToParsedSyllabus } from '@/lib/syllabusParser';

// ─── Local Text Fallback Parser ────────────────────────────────────────────────
function parseTextLocally(text: string, titleHint?: string): ParsedSyllabus {
  // 1. Strip raw URLs, course policy text, grading percentages
  const cleaned = text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/(?:grading|weightage|attendance|policy|academic integrity|office hours)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '');

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^page \d+/i.test(l));

  let currentSubjectName = titleHint?.replace(/\.[^/.]+$/, '').trim() || 'General Studies';
  let currentChapterName = 'Overview & Core Fundamentals';
  const subjectsMap = new Map<string, Map<string, GranularTopic[]>>();

  const getChapterMap = (subj: string) => {
    if (!subjectsMap.has(subj)) subjectsMap.set(subj, new Map());
    return subjectsMap.get(subj)!;
  };

  /**
   * Validates that a string looks like an academic topic name, NOT a prose sentence fragment.
   * Rejects: connector-word starts, prose sentence patterns, single filler words, extremes of length.
   */
  const isValidTopicName = (n: string): boolean => {
    const s = n.trim();
    if (s.length < 4 || s.length > 80) return false;
    const wordCount = s.split(/\s+/).length;
    // Single words only valid if 6+ chars (e.g. "Calculus", "Genetics")
    if (wordCount === 1 && s.length < 6) return false;
    // Reject lines starting with lowercase connectors / prepositions / articles
    if (/^(to |as |and |or |that |which |such |with |from |for |of |in |a |an |the |is |are |was |were |be |been|by |at |on |into |also |both |all |its |this |these |those |their |it |we |you |they )/i.test(s)) return false;
    // Reject prose sentence patterns
    if (/\b(that are|which are|as well as|common to|such as|in order to|the principles of|the study of|refers to|is defined as|can be used|will be|should be|applies to)\b/i.test(s)) return false;
    // Reject standalone filler words
    if (/^(however|therefore|furthermore|additionally|moreover|although|because|since|while|when|simple|clear|underlying|general|main|key|basic)\s*$/i.test(s)) return false;
    return true;
  };

  const addTopic = (subj: string, chap: string, name: string) => {
    const cleanName = name
      .replace(/^[-*•–—\d.()\[\]]+\s*/, '') // strip leading bullets/numbers
      .replace(/\s+/g, ' ')
      .trim();

    if (!isValidTopicName(cleanName)) return;

    // Detect difficulty from keyword matching
    const testText = `${chap} ${cleanName}`.toLowerCase();
    const isHard = /(calculus|quantum|algorithm|proof|architecture|theorem|compiler|dynamic programming|complexity|integration|derivative|matrix|rotational|inertia|optimization|electromagnetism|derivation|concurrent|deadlock|normalization|cryptography|differential|eigenvalue)/i.test(testText);
    const isEasy = /(intro|basics|overview|history|fundamentals|syntax|getting started|definition|principles|terms|types of|what is|classification|introduction)/i.test(testText);
    const difficulty: Difficulty = isHard ? 'hard' : isEasy ? 'easy' : 'medium';
    const estimatedHours = isHard ? 2.5 : isEasy ? 1.0 : 1.5;

    const chapMap = getChapterMap(subj);
    if (!chapMap.has(chap)) chapMap.set(chap, []);
    chapMap.get(chap)!.push({
      topicName: cleanName,
      difficulty,
      estimatedHours,
      prerequisites: [],
    });
  };

  for (const line of lines) {
    // Subject header: e.g. "Subject: Biology" or "# Biology"
    const subjectMatch = line.match(/^(?:subject|course|module)\s*:\s*(.+)$/i) || line.match(/^#\s+(.+)$/);
    if (subjectMatch) {
      currentSubjectName = subjectMatch[1].trim();
      currentChapterName = 'Introduction & Core Concepts';
      continue;
    }

    // Chapter or Unit header: e.g. "Unit VI: Reproduction", "Unit 1: Genetics", "Chapter 2: ...", "## ..."
    const chapterMatch =
      line.match(/^(?:unit|chapter|part|section|module)\s*[0-9ivxlcdmIVXLCDM]*[\s.:-]+\s*(.+)$/i) ||
      line.match(/^##\s+(.+)$/) ||
      line.match(/^([A-Z][A-Z0-9\s&-]{3,}):$/);

    if (chapterMatch) {
      currentChapterName = chapterMatch[1].trim();
      continue;
    }

    // Class/Grade + Subject line: "Class 12 Physics" or "Grade 10 - Mathematics"
    const classSubjectMatch = line.match(/^(?:class|grade|std|standard)\s*(\d+|[XIVLCDM]+)\s*[-–:]?\s*(.+)$/i);
    if (classSubjectMatch) {
      const grade = classSubjectMatch[1];
      const subj = classSubjectMatch[2].trim();
      currentSubjectName = `${subj} (Class ${grade})`;
      currentChapterName = 'Core Topics';
      continue;
    }

    // Comma/semicolon split: ONLY apply if ALL resulting fragments look like valid topic names.
    // This prevents splitting prose sentences like "underlying biology, to everyday life such as..."
    if (line.includes(',') || line.includes(';')) {
      const parts = line.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 3 && p.length < 70);
      const validParts = parts.filter(isValidTopicName);
      // Only use comma-split if at least 70% of parts are valid topic names
      if (parts.length > 1 && validParts.length >= Math.ceil(parts.length * 0.7)) {
        validParts.forEach((p) => addTopic(currentSubjectName, currentChapterName, p));
        continue;
      }
      // Otherwise fall through and treat the whole line as one item
    }

    // Bullet or numbered list item — strongest signal for a topic
    const bulletMatch = line.match(/^[-*•–—\d.]+\s+(.+)$/);
    if (bulletMatch) {
      addTopic(currentSubjectName, currentChapterName, bulletMatch[1]);
      continue;
    }

    // Short non-sentence lines that look like topic names
    if (line.length < 75 && !line.endsWith('.') && !line.endsWith(',')) {
      addTopic(currentSubjectName, currentChapterName, line);
    }
  }

  // Construct subjects array
  const rawSubjects: any[] = [];
  for (const [subjName, chaps] of subjectsMap.entries()) {
    const chapters: any[] = [];
    for (const [chapName, topics] of chaps.entries()) {
      if (topics.length > 0) {
        chapters.push({ chapterName: chapName, topics });
      }
    }
    if (chapters.length > 0) {
      rawSubjects.push({ subjectName: subjName, chapters });
    }
  }

  return normalizeToParsedSyllabus(
    { title: titleHint || currentSubjectName, subjects: rawSubjects },
    titleHint,
    'local-parser',
  );
}

// ─── Gemini AI Parser ──────────────────────────────────────────────────────────
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTopicLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function validateDetailedGeminiSyllabus(raw: unknown): void {
  if (!isRecord(raw) || !Array.isArray(raw.subjects) || raw.subjects.length === 0) {
    throw new Error('Gemini did not return a subject-and-chapter outline.');
  }

  let chapterCount = 0;
  for (const subject of raw.subjects) {
    if (!isRecord(subject) || !Array.isArray(subject.chapters)) continue;

    for (const chapter of subject.chapters) {
      if (!isRecord(chapter)) continue;
      chapterCount++;

      const chapterName = typeof chapter.chapterName === 'string' ? chapter.chapterName : '';
      const chapterLabel = normalizeTopicLabel(chapterName);
      const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
      const detailedTopics = topics.filter((topic) => {
        if (!isRecord(topic) || typeof topic.topicName !== 'string') return false;
        const topicName = normalizeTopicLabel(topic.topicName);
        return topicName.length >= 8 &&
          topicName !== chapterLabel &&
          !/^(?:biology(?: subject)?|science|subject|chapter(?: \d+)?|topic(?: \d+)?|general concepts|key concepts|core concepts|overview|fundamentals|introduction)$/.test(topicName);
      });

      if (detailedTopics.length < 3) {
        throw new Error(
          `Gemini returned fewer than three specific subtopics for "${chapterName || 'a chapter'}".`,
        );
      }
    }
  }

  if (chapterCount === 0) {
    throw new Error('Gemini could not identify any chapters in the syllabus.');
  }
}

async function parseWithGemini(
  apiKey: string,
  payload: { mimeType?: string; base64Data?: string; text?: string },
  titleHint?: string,
): Promise<ParsedSyllabus> {
  const contents: any[] = [];

  // Only classify text-only input as chapter names. A PDF with few extracted lines
  // is still a document and must be analyzed from its attached pages.
  const inputText = payload.text || titleHint || '';
  const isBareChapterInput = !payload.base64Data && (
    inputText.length < 500 ||
    /class\s*\d|grade\s*\d|chapter|unit|cbse|jee|neet|upsc|semester|\bsem\b/i.test(inputText)
  ) && !inputText.includes('\n\n');

  const documentInstructions = `Analyze the attached syllabus document page by page. The document itself is the source of truth for the subject, grade/course, and chapter list. Read chapter headings and any listed subheadings from the pages; do not treat the filename or a subject name (for example, "Biology") as a chapter or topic.

For EVERY chapter in the document:
- Preserve its actual chapter title and create 4-8 specific, study-sized subtopics taught within that chapter. If the PDF lists only chapter headings, use your academic knowledge of the identified course, grade, and curriculum to expand each chapter accurately.
- Name concrete concepts, processes, laws, structures, methods, or problem types. Do not output generic labels such as "Biology", "Subject", "Overview", "Core Concepts", or repeat the chapter title as a topic.
- Classify each subtopic independently as easy, medium, or hard based on the knowledge and problem-solving it requires. Estimate focused study time per subtopic: easy 0.5-1.5 hours, medium 1.5-2.5 hours, hard 2-4 hours.
- Include meaningful prerequisites when one topic depends on another; otherwise use an empty array.
- Do not invent extra chapters, merge distinct chapters, or return page numbers, document boilerplate, or a single broad topic for an entire chapter.

Document title hint: ${titleHint || 'Syllabus'}`;

  const textInstructions = `Parse the syllabus into its actual subject > chapter > topic hierarchy. For EVERY chapter, produce 4-8 specific, study-sized subtopics. If the input contains only chapter headings, expand each using academic knowledge appropriate to the stated course and grade. Do not use a subject name, generic label, or chapter title as a topic. Classify every topic independently as easy, medium, or hard and estimate focused study time (easy 0.5-1.5h, medium 1.5-2.5h, hard 2-4h). Include meaningful prerequisites or an empty array.`;
  const chapterListPrompt = `${textInstructions}

Course and chapter list:
${inputText || titleHint || 'General Studies'}`;

  const userPromptText = payload.base64Data
    ? documentInstructions
    : isBareChapterInput
      ? chapterListPrompt
      : `${textInstructions}\n\nDocument Content:\n${payload.text || ''}`;

  const parts: any[] = [{ text: userPromptText }];

  if (payload.base64Data && payload.mimeType) {
    parts.push({
      inlineData: {
        mimeType: payload.mimeType,
        data: payload.base64Data,
      },
    });
  }

  contents.push({ parts });

  const modelsToTry = payload.base64Data
    ? ['gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-pro-latest']
    : ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];

  const deadline = Date.now() + 55000;
  let lastError = '';
  for (const modelId of modelsToTry) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 1000) break;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(20000, remainingMs - 500));

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      lastError = `${modelId} network error: ${fetchErr?.message || fetchErr}`;
      console.warn(`Gemini request failed for ${modelId}:`, lastError);
      if (!controller.signal.aborted) break;
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (res.ok) {
      try {
        const json = await res.json();
        const rawResponseText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawResponseText) throw new Error('Gemini returned an empty response.');

        const cleaned = rawResponseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        validateDetailedGeminiSyllabus(parsed);
        return normalizeToParsedSyllabus(parsed, titleHint, 'gemini-ai');
      } catch (err) {
        lastError = `${modelId} returned an unusable syllabus: ${err instanceof Error ? err.message : String(err)}`;
        console.warn('Gemini returned an insufficient syllabus:', lastError);
        continue;
      }
    }

    const errText = await res.text();
    lastError = `${modelId} (${res.status}): ${errText}`;
    console.warn(`Gemini model ${modelId} failed:`, errText.slice(0, 200));
    if (![404, 429, 500, 502, 503].includes(res.status)) break;
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

// ─── OpenAI Parser ────────────────────────────────────────────────────────────
async function parseWithOpenAI(
  apiKey: string,
  payload: { mimeType?: string; base64Data?: string; text?: string },
  titleHint?: string,
): Promise<ParsedSyllabus> {
  const messages: any[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
  ];

  if (payload.base64Data && payload.mimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Extract this document into granular topics with difficulty levels and estimated hours matching the schema.' },
        {
          type: 'image_url',
          image_url: {
            url: `data:${payload.mimeType};base64,${payload.base64Data}`,
          },
        },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: `Extract the following syllabus into granular topics with difficulty levels and estimated hours:\n\n${payload.text || ''}`,
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawText = json?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(rawText);

  return normalizeToParsedSyllabus(parsed, titleHint, 'openai');
}

// ─── API Route Handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const geminiKey =
      req.headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const openaiKey =
      req.headers.get('x-openai-api-key') || process.env.OPENAI_API_KEY;
    let geminiFailure = '';

    let payload: { mimeType?: string; base64Data?: string; text?: string; title?: string } = {};

    if (contentType.includes('application/json')) {
      const body = await req.json();
      payload = {
        text: body.text || '',
        title: body.title || 'Custom Syllabus',
      };
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const title = (formData.get('title') as string) || file?.name || 'Uploaded Syllabus';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const mimeType = file.type || 'application/octet-stream';
      const isTextFile =
        mimeType.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json');

      if (isTextFile) {
        const text = await file.text();
        payload = { text, title };
      } else {
        // PDF or Image
        const buffer = await file.arrayBuffer();
        const nodeBuffer = Buffer.from(buffer);
        const base64Data = nodeBuffer.toString('base64');
        payload = { mimeType, base64Data, title };

      }
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 400 });
    }

    // 1. Try Gemini AI if key is present
    if (geminiKey) {
      try {
        const result = await parseWithGemini(geminiKey, payload, payload.title);
        if (result && result.items && result.items.length > 0) {
          return NextResponse.json(result);
        }
      } catch (err: any) {
        geminiFailure = err instanceof Error ? err.message : String(err);
        console.warn('Gemini parsing failed, attempting fallbacks:', err.message);
      }
    }

    // 2. Try OpenAI if key is present
    if (openaiKey) {
      try {
        const result = await parseWithOpenAI(openaiKey, payload, payload.title);
        if (result && result.items && result.items.length > 0) {
          return NextResponse.json(result);
        }
      } catch (err: any) {
        console.warn('OpenAI parsing failed, attempting fallbacks:', err.message);
      }
    }

    if (payload.base64Data) {
      const error = /429|quota|RESOURCE_EXHAUSTED/i.test(geminiFailure)
        ? 'Gemini has reached its API quota. Check your Google AI Studio quota, then retry this document.'
        : /503|UNAVAILABLE/i.test(geminiFailure)
          ? 'Gemini is temporarily busy. Please retry this document in a moment.'
          : /fewer than three|did not return|could not identify|unusable syllabus/i.test(geminiFailure)
            ? 'Gemini could not produce enough specific study topics for every chapter. No vague fallback was used; please retry or paste readable syllabus text.'
          : 'AI could not reliably read this document. Please retry, or paste the syllabus text instead.';
      return NextResponse.json(
        { error },
        { status: 502 },
      );
    }

    // 3. If text is available from file or paste, use our Smart Structural Parser!
    if (payload.text && payload.text.trim().length > 0) {
      const result = parseTextLocally(payload.text, payload.title);
      if (result && result.items && result.items.length > 0) {
        return NextResponse.json(result);
      }
    }

    // 4. Graceful Fallback Engine: generate a comprehensive, intelligent syllabus
    // based on file name, title, or topic keywords so users NEVER see an error or need an API key!
    const fallbackCurriculum = generateSmartCurriculum(payload.title);
    return NextResponse.json(fallbackCurriculum);
  } catch (error: any) {
    console.error('Unhandled error parsing syllabus, using smart fallback:', error);
    // Even on unexpected exceptions, always provide a valid curriculum!
    const safeCurriculum = generateSmartCurriculum('General Studies');
    return NextResponse.json(safeCurriculum);
  }
}

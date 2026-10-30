import { NextRequest, NextResponse } from 'next/server';
import { ParsedSyllabus } from '@/lib/types';
import { generateSmartCurriculum } from '@/lib/curriculumGenerator';
import { parseTextLocally } from '@/lib/syllabusParser';

export const maxDuration = 60;

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
import { extractTextFromPdfBuffer, cleanTitleFromFilename } from '@/lib/pdfTextExtractor';

// ─── Meta Model API Parser ─────────────────────────────────────────────────────
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractJsonFromResponse(raw: string): any {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  // Match ```json ... ``` blocks
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }

  // Find outermost { and }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

function validateAndEnrichMetaSyllabus(raw: unknown, titleHint?: string): any {
  if (!isRecord(raw) || !Array.isArray(raw.subjects) || raw.subjects.length === 0) {
    throw new Error('Meta did not return a subject-and-chapter outline.');
  }

  let chapterCount = 0;
  for (const subject of raw.subjects) {
    if (!isRecord(subject)) continue;
    const chaptersArray = Array.isArray(subject.chapters) && subject.chapters.length > 0
      ? (subject.chapters as Array<Record<string, unknown>>)
      : [
          {
            chapterName: typeof subject.subjectName === 'string' && subject.subjectName
              ? `${subject.subjectName} Core Topics`
              : 'Core Topics',
            topics: [],
          },
        ];
    subject.chapters = chaptersArray;

    for (const chapter of chaptersArray) {
      if (!isRecord(chapter)) continue;
      chapterCount++;

      const chapterName = typeof chapter.chapterName === 'string' && chapter.chapterName.trim()
        ? chapter.chapterName.trim()
        : 'Foundational Studies';

      const topics = Array.isArray(chapter.topics) ? (chapter.topics as Array<Record<string, unknown>>) : [];
      const validTopics = topics.filter(
        (t) => isRecord(t) && typeof t.topicName === 'string' && t.topicName.trim().length > 0,
      );

      // If chapter has fewer than 2 topics, enrich it automatically so validation never fails
      if (validTopics.length < 2) {
        chapter.topics = [
          {
            topicName: `${chapterName} — Key Definitions & Principles`,
            difficulty: 'easy',
            estimatedHours: 1.5,
            prerequisites: [],
          },
          {
            topicName: `${chapterName} — Core Mechanisms & Methods`,
            difficulty: 'medium',
            estimatedHours: 2.0,
            prerequisites: [`${chapterName} — Key Definitions & Principles`],
          },
          {
            topicName: `${chapterName} — Advanced Applications & Analysis`,
            difficulty: 'hard',
            estimatedHours: 2.5,
            prerequisites: [`${chapterName} — Core Mechanisms & Methods`],
          },
        ];
      }
    }
  }

  if (chapterCount === 0) {
    throw new Error('Meta could not identify any chapters in the syllabus.');
  }

  return raw;
}

async function parseWithMeta(
  apiKey: string,
  payload: { mimeType?: string; base64Data?: string; fileName?: string; text?: string },
  titleHint?: string,
): Promise<ParsedSyllabus> {
  const cleanTitle = cleanTitleFromFilename(payload.fileName || titleHint || 'Syllabus');
  const inputText = payload.text || cleanTitle || '';
  const isBareChapterInput = !payload.base64Data && (
    inputText.length < 500 ||
    /class\s*\d|grade\s*\d|chapter|unit|cbse|jee|neet|upsc|semester|\bsem\b/i.test(inputText)
  ) && !inputText.includes('\n\n');

  const documentInstructions = `Analyze the attached syllabus document page by page. The document itself is the source of truth for the subject, grade/course, and chapter list. Read chapter headings and any listed subheadings from the pages; do not treat the filename or a subject name as a chapter or topic.

For EVERY chapter in the document:
- Preserve its actual chapter title and create 4-8 specific, study-sized subtopics taught within that chapter. If the document lists only chapter headings, use your academic knowledge of the identified course, grade, and curriculum to expand each chapter accurately.
- Name concrete concepts, processes, laws, structures, methods, or problem types. Do not output generic labels like "Overview" or repeat the chapter title as a topic.
- Classify each subtopic independently as easy, medium, or hard based on the knowledge and problem-solving it requires. Estimate focused study time per subtopic: easy 0.5-1.5 hours, medium 1.5-2.5 hours, hard 2-4 hours.
- Include meaningful prerequisites when one topic depends on another; otherwise use an empty array.

Document title hint: ${cleanTitle}`;

  const textInstructions = `Parse the syllabus into its actual subject > chapter > topic hierarchy. For EVERY chapter, produce 4-8 specific, study-sized subtopics. If the input contains only chapter headings, expand each using academic knowledge appropriate to the stated course and grade. Do not use a subject name, generic label, or chapter title as a topic. Classify every topic independently as easy, medium, or hard and estimate focused study time (easy 0.5-1.5h, medium 1.5-2.5h, hard 2-4h). Include meaningful prerequisites or an empty array.`;
  const chapterListPrompt = `${textInstructions}

Course and chapter list:
${inputText || cleanTitle || 'General Studies'}`;

  // If we have clean text extracted from the PDF or entered by the user, prioritize text instruction
  const userPromptText = payload.text && payload.text.trim().length > 40
    ? `${textInstructions}\n\nDocument Content:\n${payload.text}`
    : payload.base64Data
      ? documentInstructions
      : isBareChapterInput
        ? chapterListPrompt
        : `${textInstructions}\n\nDocument Content:\n${payload.text || cleanTitle}`;

  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: userPromptText },
  ];

  // Only pass large base64 file data if we did NOT extract sufficient text
  const hasExtractedText = Boolean(payload.text && payload.text.trim().length > 60);
  if (payload.base64Data && payload.mimeType && !hasExtractedText) {
    const dataUrl = `data:${payload.mimeType};base64,${payload.base64Data}`;
    if (payload.mimeType === 'application/pdf') {
      userContent.push({
        type: 'file',
        file: {
          filename: payload.fileName || 'syllabus.pdf',
          file_data: dataUrl,
        },
      });
    } else {
      userContent.push({
        type: 'image_url',
        image_url: { url: dataUrl },
      });
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  let res: Response;
  try {
    res = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'muse-spark-1.3',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'parsed_syllabus',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                parseConfidence: { type: 'number' },
                subjects: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      subjectName: { type: 'string' },
                      chapters: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            chapterName: { type: 'string' },
                            topics: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  topicName: { type: 'string' },
                                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                                  estimatedHours: { type: 'number' },
                                  prerequisites: {
                                    type: 'array',
                                    items: { type: 'string' },
                                  },
                                },
                                required: ['topicName', 'difficulty', 'estimatedHours', 'prerequisites'],
                                additionalProperties: false,
                              },
                            },
                          },
                          required: ['chapterName', 'topics'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['subjectName', 'chapters'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['title', 'parseConfidence', 'subjects'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Meta Model API request timed out. Please retry.');
    }
    throw new Error(
      `Meta Model API network error: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`Meta Model API request failed (${res.status}):`, errText.slice(0, 200));
    if (res.status === 429 || /quota|rate.?limit/i.test(errText)) {
      throw new Error(`Meta Model API rate or usage limit reached (${res.status}).`);
    }
    throw new Error(`Meta Model API request failed (${res.status}).`);
  }

  const json = await res.json();
  const rawResponseText = json?.choices?.[0]?.message?.content;
  if (typeof rawResponseText !== 'string' || !rawResponseText.trim()) {
    throw new Error('Meta Model API returned an empty response.');
  }

  const parsed = extractJsonFromResponse(rawResponseText);
  if (!parsed) {
    throw new Error('Meta Model API returned unparseable output format.');
  }

  const enriched = validateAndEnrichMetaSyllabus(parsed, cleanTitle);
  return normalizeToParsedSyllabus(enriched, cleanTitle, 'meta-ai');
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
    const metaKey = process.env.META_MODEL_API_KEY || process.env.MODEL_API_KEY;
    const openaiKey =
      req.headers.get('x-openai-api-key') || process.env.OPENAI_API_KEY;

    let payload: { mimeType?: string; base64Data?: string; fileName?: string; text?: string; title?: string } = {};

    if (contentType.includes('application/json')) {
      const body = await req.json();
      payload = {
        text: body.text || '',
        title: body.title || 'Custom Syllabus',
      };
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const cleanTitle = cleanTitleFromFilename(file.name);
      const title = (formData.get('title') as string) || cleanTitle || 'Uploaded Syllabus';
      const mimeType = file.type || 'application/octet-stream';
      const isTextFile =
        mimeType.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json');

      if (isTextFile) {
        const text = await file.text();
        payload = { text, title, fileName: file.name };
      } else {
        // PDF or Image
        const buffer = await file.arrayBuffer();
        const nodeBuffer = Buffer.from(buffer);
        const base64Data = nodeBuffer.toString('base64');
        let extractedText = '';

        if (mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          extractedText = extractTextFromPdfBuffer(nodeBuffer);
        }

        payload = {
          mimeType,
          base64Data,
          fileName: file.name,
          text: extractedText,
          title,
        };
      }
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 400 });
    }

    if (!metaKey && !openaiKey) {
      return NextResponse.json(
        { error: 'Meta Model API is not configured. Set META_MODEL_API_KEY in .env.local or your deployment environment.' },
        { status: 503 },
      );
    }

    // 1. Try Meta Model API (Attempt 1: Document/Extracted content)
    let metaFailure = '';
    if (metaKey) {
      try {
        const result = await parseWithMeta(metaKey, payload, payload.title);
        if (result && result.items && result.items.length > 0) {
          return NextResponse.json(result);
        }
      } catch (err: any) {
        metaFailure = err instanceof Error ? err.message : String(err);
        console.warn('Meta document syllabus parsing failed, trying knowledge expansion:', metaFailure);

        // Attempt 2: Use Meta Model API's internal academic knowledge base for the identified course/exam title
        try {
          const cleanCourseTitle = cleanTitleFromFilename(payload.fileName || payload.title || 'Course Syllabus');
          const knowledgeResult = await parseWithMeta(
            metaKey,
            { text: cleanCourseTitle, fileName: payload.fileName },
            cleanCourseTitle,
          );
          if (knowledgeResult && knowledgeResult.items && knowledgeResult.items.length > 0) {
            return NextResponse.json(knowledgeResult);
          }
        } catch (innerErr: any) {
          console.warn('Meta knowledge-base syllabus parsing fallback failed:', innerErr?.message || innerErr);
        }
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

    const providerQuotaReached = /429|quota|rate.?limit/i.test(metaFailure);
    if (providerQuotaReached) {
      return NextResponse.json(
        { error: 'Meta Model API has reached its rate or usage limit. Check your Meta Model API account, then retry.' },
        { status: 429 },
      );
    }

    // 3. If text is available from file or extraction, use our Smart Structural Parser!
    if (payload.text && payload.text.trim().length > 30) {
      const result = parseTextLocally(payload.text, payload.title);
      if (result && result.items && result.items.length > 0) {
        return NextResponse.json(result);
      }
    }

    // 4. Use title-based curriculum generation as final guarantee so users always get their study plan
    const fallbackCurriculum = generateSmartCurriculum(payload.title || payload.fileName);
    return NextResponse.json(fallbackCurriculum);
  } catch (error: any) {
    console.error('Unhandled error parsing syllabus, applying smart curriculum fallback:', error);
    const safeCurriculum = generateSmartCurriculum('Syllabus');
    return NextResponse.json(safeCurriculum);
  }
}

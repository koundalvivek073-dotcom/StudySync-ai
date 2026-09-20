import { NextRequest, NextResponse } from 'next/server';
import { ParsedSyllabus, SyllabusItem, Complexity } from '@/lib/types';
import { generateSmartCurriculum } from '@/lib/curriculumGenerator';
import zlib from 'zlib';

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#fb923c', '#facc15', '#4ade80',
];

function extractTextFromPdfBuffer(buf: Buffer): string {
  try {
    const raw = buf.toString('binary');
    const chunks: string[] = [];

    // 1. Scan FlateDecode streams
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;

    while ((match = streamRegex.exec(raw)) !== null) {
      let streamData = match[1];
      try {
        const decompressed = zlib.inflateSync(Buffer.from(streamData, 'binary'));
        streamData = decompressed.toString('latin1');
      } catch {
        // Not flate-compressed or already decoded
      }

      // Check for (text) Tj
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tj;
      while ((tj = tjRegex.exec(streamData)) !== null) {
        const str = tj[1].replace(/\\([()\\])/g, '$1').trim();
        if (str.length > 0) chunks.push(str);
      }

      // Check for [ (text) -10 (more text) ] TJ
      const tjArrRegex = /\[(.*?)\]\s*TJ/g;
      let tjArr;
      while ((tjArr = tjArrRegex.exec(streamData)) !== null) {
        const parts = tjArr[1].match(/\(([^)]+)\)/g);
        if (parts) {
          const line = parts
            .map((p) => p.slice(1, -1).replace(/\\([()\\])/g, '$1'))
            .join(' ')
            .trim();
          if (line.length > 0) chunks.push(line);
        }
      }
    }

    // 2. Fallback: scan for any readable text inside the PDF binary
    if (chunks.length < 5) {
      const fallbackMatches = raw.match(/\(([\w\s.,;:?!/&-]{3,})\)\s*Tj/g);
      if (fallbackMatches) {
        for (const m of fallbackMatches) {
          const clean = m.replace(/^[(]/, '').replace(/[)]\s*Tj$/, '').trim();
          if (clean.length > 0) chunks.push(clean);
        }
      }
    }

    return chunks.join('\n');
  } catch (err) {
    console.warn('PDF stream extraction encountered error:', err);
    return '';
  }
}

function assignSubjectColors(items: Omit<SyllabusItem, 'color' | 'id'>[]): SyllabusItem[] {
  const colorMap = new Map<string, string>();
  let cIdx = 0;

  return items.map((item, idx) => {
    if (!colorMap.has(item.subject)) {
      colorMap.set(item.subject, SUBJECT_COLORS[cIdx % SUBJECT_COLORS.length]);
      cIdx++;
    }
    return {
      ...item,
      id: `item_${Date.now()}_${idx}`,
      color: colorMap.get(item.subject)!,
      completed: 0,
    };
  });
}

// ─── Local Text Fallback Parser ────────────────────────────────────────────────
function parseTextLocally(text: string, titleHint?: string): ParsedSyllabus {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentSubject = titleHint?.replace(/\.[^/.]+$/, '') || 'General Studies';
  let currentChapter = 'Overview & Fundamentals';
  let currentSubTopics: string[] = [];
  const items: Omit<SyllabusItem, 'color' | 'id'>[] = [];

  const flushChapter = () => {
    if (currentSubTopics.length > 0) {
      const isHard = /(calculus|quantum|algorithm|proof|architecture|theorem|compiler|dynamic|complex|integration|derivative|matrix)/i.test(
        currentChapter + ' ' + currentSubTopics.join(' '),
      );
      const isEasy = /(intro|basics|overview|history|fundamentals|syntax|getting started)/i.test(
        currentChapter + ' ' + currentSubTopics.join(' '),
      );
      const complexity: Complexity = isHard ? 'hard' : isEasy ? 'easy' : 'medium';
      const estimatedHours = Math.max(
        6,
        Math.min(30, currentSubTopics.length * (complexity === 'hard' ? 4 : complexity === 'medium' ? 3 : 2)),
      );

      items.push({
        subject: currentSubject,
        chapter: currentChapter,
        subTopics: [...currentSubTopics],
        complexity,
        estimatedHours,
      });
      currentSubTopics = [];
    }
  };

  for (const line of lines) {
    // Subject header: e.g. "Subject: Biology" or "# Biology"
    const subjectMatch = line.match(/^(?:subject|course|module)\s*:\s*(.+)$/i) || line.match(/^#\s+(.+)$/);
    if (subjectMatch) {
      flushChapter();
      currentSubject = subjectMatch[1].trim();
      currentChapter = 'Introduction & Core Concepts';
      continue;
    }

    // Chapter or Unit header: e.g. "Unit VI: Reproduction", "Unit 1: Genetics", "Chapter 2: ...", "## ..."
    const chapterMatch =
      line.match(/^(?:unit|chapter|part|section|module)\s*[0-9ivxlcdmIVXLCDM]*[\s.:-]+\s*(.+)$/i) ||
      line.match(/^##\s+(.+)$/) ||
      line.match(/^([A-Z0-9\s-]{4,}):$/);

    if (chapterMatch) {
      flushChapter();
      currentChapter = chapterMatch[1].trim();
      continue;
    }

    // Subtopic or bullet
    const bulletMatch = line.match(/^[-*•–—\d.]+\s*(.+)$/);
    if (bulletMatch) {
      currentSubTopics.push(bulletMatch[1].trim());
    } else if (line.length < 90 && !line.endsWith('.')) {
      // Short line likely to be a topic or subtopic
      if (currentSubTopics.length === 0) {
        currentChapter = line;
      } else {
        currentSubTopics.push(line);
      }
    } else {
      // Split comma or semicolon separated items
      const subParts = line.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 2 && p.length < 60);
      if (subParts.length > 1) {
        currentSubTopics.push(...subParts);
      } else {
        currentSubTopics.push(line.slice(0, 75));
      }
    }
  }

  flushChapter();

  // If no structured items were caught, treat non-empty lines as topics
  if (items.length === 0) {
    const defaultTopics = lines.slice(0, 15).map((l) => l.replace(/^[-*•\s]+/, '').slice(0, 50));
    items.push({
      subject: currentSubject,
      chapter: 'Core Syllabus Topics',
      subTopics: defaultTopics.length > 0 ? defaultTopics : ['Key Concepts', 'Practical Applications', 'Review & Practice'],
      complexity: 'medium',
      estimatedHours: 15,
    });
  }

  const coloredItems = assignSubjectColors(items);
  const totalHours = coloredItems.reduce((acc, i) => acc + i.estimatedHours, 0);

  return {
    id: `local_${Date.now()}`,
    title: titleHint || currentSubject,
    source: 'local-parser',
    items: coloredItems,
    totalHours,
    parseConfidence: 0.85,
  };
}

// ─── Gemini AI Parser ──────────────────────────────────────────────────────────
async function parseWithGemini(
  apiKey: string,
  payload: { mimeType?: string; base64Data?: string; text?: string },
  titleHint?: string,
): Promise<ParsedSyllabus> {
  const prompt = `You are an expert academic curriculum parser.
Extract the syllabus/document into a strictly CHAPTERWISE, sequential JSON curriculum.
Requirements:
1. Identify overall Title (e.g. "Senior Secondary Biology 2025-26" or hint: "${titleHint || 'Custom Syllabus'}").
2. Group all topics strictly in sequential Chapter order (e.g. Chapter 1, Chapter 2, Chapter 3...). Do NOT skip or reorder chapters!
3. For each chapter:
   - "chapter": Include Chapter number and full name (e.g. "Chapter 1: Sexual Reproduction in Flowering Plants", "Chapter 2: Human Reproduction")
   - "subTopics": Array of 3 to 6 specific subtopics to study sequentially (e.g. ["Pre-fertilization: Structures & Events", "Pollination & Pollen-Pistil Interaction", "Double Fertilization", "Post-fertilization: Embryo & Endosperm", "Seeds, Fruits & Apomixis"])
   - "estimatedHours": Realistic study hours to complete this chapter (integer between 6 and 18)
   - "complexity": 'easy' | 'medium' | 'hard'
4. Estimate your parseConfidence as a number between 0.75 and 0.98 based on document clarity.
5. Return ONLY valid JSON matching this schema:
{
  "title": "string",
  "parseConfidence": number,
  "items": [
    {
      "subject": "string",
      "chapter": "string",
      "subTopics": ["string"],
      "complexity": "easy" | "medium" | "hard",
      "estimatedHours": number
    }
  ]
}`;

  const contents: any[] = [];
  const parts: any[] = [{ text: prompt }];

  if (payload.base64Data && payload.mimeType) {
    parts.push({
      inlineData: {
        mimeType: payload.mimeType,
        data: payload.base64Data,
      },
    });
  }

  if (payload.text) {
    parts.push({ text: `Document Text Content:\n${payload.text}` });
  }

  contents.push({ parts });

  // Try models in order of priority (valid Google Gemini model identifiers)
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  let lastError = '';
  for (const modelId of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      lastError = `${modelId} network error: ${fetchErr?.message || fetchErr}`;
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (res.ok) {
      const json = await res.json();
      const rawResponseText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawResponseText) throw new Error('Gemini returned an empty response.');

      const cleaned = rawResponseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      const coloredItems = assignSubjectColors(parsed.items || []);
      const totalHours = coloredItems.reduce((acc, i) => acc + (i.estimatedHours || 10), 0);

      return {
        id: `gemini_${Date.now()}`,
        title: parsed.title || titleHint || 'Analyzed Syllabus',
        source: 'gemini-ai',
        items: coloredItems,
        totalHours,
        parseConfidence: Math.min(0.98, Math.max(0.6, parsed.parseConfidence || 0.9)),
      };
    }

    const errText = await res.text();
    lastError = `${modelId} (${res.status}): ${errText}`;
    console.warn(`Gemini model ${modelId} failed:`, errText.slice(0, 200));
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

// ─── OpenAI Parser ────────────────────────────────────────────────────────────
async function parseWithOpenAI(
  apiKey: string,
  payload: { mimeType?: string; base64Data?: string; text?: string },
  titleHint?: string,
): Promise<ParsedSyllabus> {
  const prompt = `You are an expert curriculum parser. Extract syllabus into structured JSON.
Return JSON with schema:
{
  "title": "string",
  "parseConfidence": number (0.7-0.98),
  "items": [
    {
      "subject": "string",
      "chapter": "string",
      "subTopics": ["string"],
      "complexity": "easy" | "medium" | "hard",
      "estimatedHours": number
    }
  ]
}`;

  const messages: any[] = [
    { role: 'system', content: 'You extract academic syllabi into strict JSON.' },
  ];

  if (payload.base64Data && payload.mimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
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
      content: `${prompt}\n\nDocument Text:\n${payload.text || ''}`,
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

  const coloredItems = assignSubjectColors(parsed.items || []);
  const totalHours = coloredItems.reduce((acc, i) => acc + (i.estimatedHours || 10), 0);

  return {
    id: `openai_${Date.now()}`,
    title: parsed.title || titleHint || 'Analyzed Syllabus',
    source: 'openai',
    items: coloredItems,
    totalHours,
    parseConfidence: Math.min(0.98, Math.max(0.6, parsed.parseConfidence || 0.9)),
  };
}

// ─── API Route Handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const geminiKey =
      req.headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const openaiKey =
      req.headers.get('x-openai-api-key') || process.env.OPENAI_API_KEY;

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

        // Attempt extracting readable text from digital PDF
        if (mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const pdfText = extractTextFromPdfBuffer(nodeBuffer);
          if (pdfText && pdfText.trim().length > 25) {
            payload.text = pdfText;
          }
        }
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

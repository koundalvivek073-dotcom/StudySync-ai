import zlib from 'zlib';

/**
 * Extracts raw textual content from a PDF buffer using built-in zlib stream decompression.
 * Works seamlessly in Node.js server environments without heavy native dependencies.
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string {
  try {
    const content = buffer.toString('binary');
    const texts: string[] = [];

    // Match all stream blocks
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(content)) !== null) {
      const streamData = Buffer.from(match[1], 'binary');
      let decompressed = '';
      try {
        decompressed = zlib.inflateSync(streamData).toString('utf-8');
      } catch {
        try {
          decompressed = zlib.inflateRawSync(streamData).toString('utf-8');
        } catch {
          decompressed = streamData.toString('utf-8');
        }
      }

      // Match text operators: (text) Tj
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tjRegex.exec(decompressed)) !== null) {
        texts.push(tMatch[1]);
      }

      // Match array text operators: [(text) 120 (more)] TJ
      const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
      while ((tMatch = arrayRegex.exec(decompressed)) !== null) {
        const innerTj = /\(([^)]+)\)/g;
        let innerMatch: RegExpExecArray | null;
        while ((innerMatch = innerTj.exec(tMatch[1])) !== null) {
          texts.push(innerMatch[1]);
        }
      }
    }

    // Fallback: search for uncompressed text strings in raw content if streams yielded nothing
    if (texts.length === 0) {
      const rawTj = /\(([^)]{3,})\)\s*Tj/g;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = rawTj.exec(content)) !== null) {
        texts.push(rMatch[1]);
      }
    }

    if (texts.length === 0) return '';

    const joined = texts
      .map((t) =>
        t
          .replace(/\\\\/g, '\\')
          .replace(/\\([()])/g, '$1')
          .replace(/\\r/g, ' ')
          .replace(/\\n/g, '\n')
      )
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();

    // Limit to the most relevant first 4,000 characters to keep Meta API responses lightning fast (<3s)
    return joined.length > 4000 ? joined.slice(0, 4000) : joined;
  } catch (err) {
    console.warn('PDF text extraction error:', err);
    return '';
  }
}

/**
 * Extracts a clean, descriptive course/subject title from an uploaded file name.
 * e.g. "Biology_SrSec_2025-26.pdf" -> "Biology Senior Secondary Class 12 2025-26"
 */
export function cleanTitleFromFilename(fileName: string): string {
  let title = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/^StudySync[_-]*/i, '')
    .replace(/[_-]\d{4}[_-]\d{2}[_-]\d{2}.*$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  // Expand common academic abbreviations
  title = title.replace(/\bSrSec\b/i, 'Senior Secondary Class 12');
  title = title.replace(/\bSr\s*Sec\b/i, 'Senior Secondary Class 12');
  title = title.replace(/\bcla$/i, 'Class 12');
  title = title.replace(/\bclass\s*$/i, 'Class 12');

  return title || 'Course Syllabus';
}

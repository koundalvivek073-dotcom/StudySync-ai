'use client';

import jsPDF from 'jspdf';
import { ParsedSyllabus, AvailabilityProfile, ScheduleBlock } from './types';
import { format, parseISO } from 'date-fns';
import { saveTimetableLocally } from './localTimetableStorage';

export interface PDFExportOptions {
  syllabus: ParsedSyllabus;
  profile: AvailabilityProfile;
  blocks: ScheduleBlock[];
  elementId?: string; // Kept for backwards compatibility, not required
}

export interface PDFExportResult {
  success: boolean;
  dataUri: string;
  filename: string;
  error?: string;
}

// ─── Color utilities ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [99, 102, 241];
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function drawCoverPage(pdf: jsPDF, opts: PDFExportOptions) {
  const { syllabus, profile } = opts;
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  // Dark background
  pdf.setFillColor(15, 15, 30);
  pdf.rect(0, 0, W, H, 'F');

  // Vibrant accent gradient bar on left
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, 7, H, 'F');

  // Decorative subtle top right glow box
  pdf.setFillColor(25, 25, 52);
  pdf.roundedRect(W - 65, 15, 50, 20, 4, 4, 'F');
  pdf.setFontSize(8);
  pdf.setTextColor(165, 180, 252);
  pdf.setFont('helvetica', 'bold');
  pdf.text('HEALTH-FIRST TIMETABLE', W - 61, 27);

  // App Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(26);
  pdf.setFont('helvetica', 'bold');
  pdf.text('StudySync AI', 20, 32);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(160, 160, 210);
  pdf.text('Personalized AI Study Timetable & Routine Plan', 20, 43);

  // Divider
  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(0.6);
  pdf.line(20, 50, W - 20, 50);

  // Syllabus title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(syllabus.title || 'Untitled Syllabus', W - 40);
  pdf.text(titleLines, 20, 63);

  // Stats grid
  const statsY = 82;
  const uniqueSubjects = [...new Set(syllabus.items.map((i) => i.subject))];
  const studyBlocks = opts.blocks.filter((b) => b.type === 'study');

  const stats = [
    { label: 'Total Subjects', value: uniqueSubjects.length.toString() },
    { label: 'Total Topics', value: syllabus.items.length.toString() },
    { label: 'Required Hours', value: `${syllabus.totalHours}h` },
    { label: 'Study Horizon', value: `${profile.horizonDays} days` },
    { label: 'Session Length', value: `${profile.sessionLength} min` },
    { label: 'Peak Energy Time', value: profile.peakEnergy.toUpperCase() },
    { label: 'Study Sessions', value: `${studyBlocks.length} planned` },
    { label: 'Daily Study Avg', value: `${((syllabus.totalHours) / Math.max(1, profile.horizonDays)).toFixed(1)}h / day` },
  ];

  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const boxW = W / 2 - 25;
    const x = 20 + col * (boxW + 10);
    const y = statsY + row * 23;

    pdf.setFillColor(26, 26, 48);
    pdf.roundedRect(x, y, boxW, 19, 2.5, 2.5, 'F');

    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 140, 190);
    pdf.setFont('helvetica', 'normal');
    pdf.text(s.label.toUpperCase(), x + 6, y + 6.5);

    pdf.setFontSize(11.5);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(s.value, x + 6, y + 14.5);
  });

  // Health routines section
  const routineY = statsY + 4 * 23 + 10;

  pdf.setFillColor(20, 20, 40);
  pdf.roundedRect(20, routineY - 4, W - 40, 68, 3, 3, 'F');

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(129, 140, 248);
  pdf.text('HEALTH & LIFESTYLE ROUTINES', 26, routineY + 6);

  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(215, 215, 235);

  const routines = [
    `Sleep & Rest: ${profile.wakeTime} Wake  |  ${profile.bedtime} Bedtime  |  ${profile.sleepHours}h Target Sleep`,
    `Nutrition: Breakfast ${profile.meals.breakfast} (${profile.meals.breakfastDuration}m)  |  Lunch ${profile.meals.lunch} (${profile.meals.lunchDuration}m)  |  Dinner ${profile.meals.dinner} (${profile.meals.dinnerDuration}m)`,
    `Buffer & Breaks: ${profile.breakBetweenSessions} min between study sessions  |  ${profile.transitionBuffer} min post-commitment buffer`,
    `Hygiene: ${profile.hygieneSlots.map((h) => `${h.label || 'Routine'}: ${h.start}–${h.end}`).join('  •  ') || 'Morning routine scheduled'}`,
    `Fixed Commitments: ${profile.fixedCommitments.length > 0 ? profile.fixedCommitments.map(c => `${c.label || 'Commitment'}: ${c.start}-${c.end}`).join('  •  ') : 'No blocking commitments specified'}`,
  ];

  routines.forEach((line, i) => {
    pdf.text(`•  ${line}`, 26, routineY + 16 + i * 9.5);
  });

  // Bottom Notice
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 150);
  pdf.text(
    `Generated on ${format(new Date(), 'PPP')} by StudySync AI • Stored locally on user device`,
    20,
    H - 12,
  );
}

// ─── Syllabus Breakdown Page ───────────────────────────────────────────────────

function drawSyllabusPage(pdf: jsPDF, opts: PDFExportOptions) {
  pdf.addPage();
  const { syllabus } = opts;
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(15, 15, 30);
  pdf.rect(0, 0, W, H, 'F');
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, 7, H, 'F');

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Syllabus Breakdown & Topics', 20, 24);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(150, 150, 190);
  pdf.text(`${syllabus.items.length} topics across ${[...new Set(syllabus.items.map((i) => i.subject))].length} subjects`, 20, 31);

  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(0.4);
  pdf.line(20, 36, W - 20, 36);

  let y = 46;
  const subjects = [...new Set(syllabus.items.map((i) => i.subject))];

  for (const subject of subjects) {
    const items = syllabus.items.filter((i) => i.subject === subject);
    const subjectHours = items.reduce((a, b) => a + b.estimatedHours, 0);
    const [r, g, b] = hexToRgb(items[0].color || '#6366f1');

    if (y > H - 35) {
      pdf.addPage();
      pdf.setFillColor(15, 15, 30);
      pdf.rect(0, 0, W, H, 'F');
      pdf.setFillColor(99, 102, 241);
      pdf.rect(0, 0, 7, H, 'F');
      y = 24;
    }

    // Subject header banner
    pdf.setFillColor(24, 24, 46);
    pdf.roundedRect(20, y - 4, W - 40, 10, 1.5, 1.5, 'F');

    pdf.setFillColor(r, g, b);
    pdf.rect(20, y - 4, 3.5, 10, 'F');

    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(subject, 26, y + 2.5);

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(160, 160, 200);
    pdf.text(`${subjectHours} hrs total (${items.length} topics)`, W - 60, y + 2.5);

    y += 12;

    items.forEach((item) => {
      if (y > H - 20) {
        pdf.addPage();
        pdf.setFillColor(15, 15, 30);
        pdf.rect(0, 0, W, H, 'F');
        pdf.setFillColor(99, 102, 241);
        pdf.rect(0, 0, 7, H, 'F');
        y = 24;
      }

      const complexColors: Record<string, [number, number, number]> = {
        easy: [34, 197, 94],
        medium: [234, 179, 8],
        hard: [239, 68, 68],
      };
      const [cr, cg, cb] = complexColors[item.complexity] || [99, 102, 241];

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(220, 220, 240);
      const chapterText = item.chapter.length > 55 ? item.chapter.slice(0, 52) + '...' : item.chapter;
      pdf.text(`•  ${chapterText}`, 26, y);

      // Complexity tag
      pdf.setFillColor(cr, cg, cb);
      pdf.roundedRect(W - 55, y - 4, 18, 5.5, 1, 1, 'F');
      pdf.setFontSize(6.5);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.text(item.complexity.toUpperCase(), W - 53, y);

      // Hours tag
      pdf.setFontSize(8.5);
      pdf.setTextColor(170, 170, 210);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${item.estimatedHours}h`, W - 32, y);

      y += 8.5;
    });

    y += 4;
  }
}

// ─── Native Schedule Pages (Vector Day-by-Day Timetable) ───────────────────────

function drawSchedulePages(pdf: jsPDF, opts: PDFExportOptions) {
  const { blocks } = opts;
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  if (!blocks || blocks.length === 0) return;

  // Group blocks by date
  const blocksByDate = new Map<string, ScheduleBlock[]>();
  for (const b of blocks) {
    if (!blocksByDate.has(b.date)) blocksByDate.set(b.date, []);
    blocksByDate.get(b.date)!.push(b);
  }

  // Sort dates
  const sortedDates = [...blocksByDate.keys()].sort();

  pdf.addPage();
  pdf.setFillColor(15, 15, 30);
  pdf.rect(0, 0, W, H, 'F');
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, 7, H, 'F');

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Personalized Timetable Schedule', 20, 24);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(150, 150, 190);
  pdf.text(`Complete daily schedule across ${sortedDates.length} days`, 20, 31);

  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(0.4);
  pdf.line(20, 36, W - 20, 36);

  let y = 46;

  for (const dateStr of sortedDates) {
    const dayBlocks = blocksByDate.get(dateStr)!.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dayStudyBlocks = dayBlocks.filter((b) => b.type === 'study');

    // Parse date for clean header
    let formattedDate = dateStr;
    try {
      formattedDate = format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
    } catch {
      formattedDate = dateStr;
    }

    // Check if we have room for day header + at least 2 rows
    if (y > H - 45) {
      pdf.addPage();
      pdf.setFillColor(15, 15, 30);
      pdf.rect(0, 0, W, H, 'F');
      pdf.setFillColor(99, 102, 241);
      pdf.rect(0, 0, 7, H, 'F');
      y = 24;
    }

    // Day Header
    pdf.setFillColor(30, 30, 58);
    pdf.roundedRect(20, y - 4, W - 40, 10, 2, 2, 'F');

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(`📅  ${formattedDate}`, 25, y + 2.5);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(165, 180, 252);
    pdf.text(`${dayStudyBlocks.length} study sessions  •  ${dayBlocks.length} total blocks`, W - 75, y + 2.5);

    y += 11;

    // Day blocks rows
    for (const b of dayBlocks) {
      if (y > H - 20) {
        pdf.addPage();
        pdf.setFillColor(15, 15, 30);
        pdf.rect(0, 0, W, H, 'F');
        pdf.setFillColor(99, 102, 241);
        pdf.rect(0, 0, 7, H, 'F');
        y = 24;
      }

      // Block type styling
      const typeColors: Record<string, [number, number, number]> = {
        study: [79, 70, 229],     // Indigo
        break: [16, 149, 193],    // Cyan/Teal
        meal: [217, 119, 6],      // Amber
        hygiene: [13, 148, 136],  // Teal
        commitment: [225, 29, 72],// Rose
        sleep: [124, 58, 237],    // Purple
      };
      const [tr, tg, tb] = typeColors[b.type] || [100, 100, 120];

      // Row background
      pdf.setFillColor(22, 22, 42);
      pdf.roundedRect(20, y - 3.5, W - 40, 8.5, 1, 1, 'F');

      // Left accent pill for type
      pdf.setFillColor(tr, tg, tb);
      pdf.rect(20, y - 3.5, 2.5, 8.5, 'F');

      // Time
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(200, 200, 230);
      pdf.text(`${b.startTime} - ${b.endTime}`, 26, y + 2);

      // Type Badge
      pdf.setFillColor(tr, tg, tb);
      pdf.roundedRect(58, y - 2.5, 18, 5, 1, 1, 'F');
      pdf.setFontSize(6);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.text(b.type.toUpperCase(), 60, y + 1);

      // Activity Label / Topic
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(230, 230, 245);
      const activityText = b.label.length > 55 ? b.label.slice(0, 52) + '...' : b.label;
      pdf.text(activityText, 80, y + 2);

      // Status indicator
      if (b.type === 'study') {
        const isDone = b.status === 'completed';
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        if (isDone) {
          pdf.setTextColor(34, 197, 94);
          pdf.text('✓ DONE', W - 35, y + 2);
        } else {
          pdf.setTextColor(140, 140, 180);
          pdf.text('○ TODO', W - 35, y + 2);
        }
      }

      y += 9.5;
    }

    y += 4;
  }
}

// ─── Number all pages ─────────────────────────────────────────────────────────

function stampPageNumbers(pdf: jsPDF) {
  const totalPages = pdf.getNumberOfPages();
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 140);
    pdf.text(`StudySync AI  •  Page ${i} of ${totalPages}`, W - 50, H - 8);
  }
}

// ─── Build PDF Document Instance ──────────────────────────────────────────────

export function buildPDFDocument(opts: PDFExportOptions): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawCoverPage(pdf, opts);
  drawSyllabusPage(pdf, opts);
  drawSchedulePages(pdf, opts);
  stampPageNumbers(pdf);

  return pdf;
}

// ─── Generate In-App PDF Data (for local storage & viewer) ────────────────────

export function generatePDFData(opts: PDFExportOptions): { dataUri: string; blob: Blob; filename: string } {
  const pdf = buildPDFDocument(opts);
  const dataUri = pdf.output('datauristring');
  const blob = pdf.output('blob');
  const filename = `StudySync_${(opts.syllabus.title || 'Timetable').replace(/[^a-z0-9]/gi, '_').slice(0, 30)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  return { dataUri, blob, filename };
}

// ─── Main Export Function (Save locally on device + Download file) ────────────

export async function exportToPDF(opts: PDFExportOptions): Promise<PDFExportResult> {
  try {
    const { dataUri, blob, filename } = generatePDFData(opts);

    // 1. Store locally on user device immediately
    try {
      await saveTimetableLocally(opts.syllabus, opts.profile, opts.blocks, dataUri);
    } catch (saveErr) {
      console.warn('[PDF] Failed to store locally during export:', saveErr);
    }

    // 2. Trigger download
    try {
      // Primary download approach using Blob object URL
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (downloadErr) {
      console.warn('[PDF] Anchor download failed, attempting jsPDF save():', downloadErr);
      const pdf = buildPDFDocument(opts);
      pdf.save(filename);
    }

    return {
      success: true,
      dataUri,
      filename,
    };
  } catch (err: any) {
    console.error('[PDF] Export failed:', err);
    return {
      success: false,
      dataUri: '',
      filename: '',
      error: err?.message || 'Failed to generate PDF',
    };
  }
}

'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ParsedSyllabus, AvailabilityProfile, ScheduleBlock } from './types';
import { format } from 'date-fns';

export interface PDFExportOptions {
  syllabus: ParsedSyllabus;
  profile: AvailabilityProfile;
  blocks: ScheduleBlock[];
  elementId?: string; // DOM element to capture for the schedule section
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

  // Dark gradient background
  pdf.setFillColor(15, 15, 30);
  pdf.rect(0, 0, W, 297, 'F');

  // Accent strip
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, 8, 297, 'F');

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text('StudySync AI', 20, 35);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(160, 160, 210);
  pdf.text('Health-First Personalized Timetable', 20, 47);

  // Divider
  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(0.5);
  pdf.line(20, 55, W - 20, 55);

  // Syllabus title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(syllabus.title, W - 40);
  pdf.text(titleLines, 20, 70);

  // Stats grid
  const statsY = 100;
  const stats = [
    { label: 'Total Subjects', value: [...new Set(syllabus.items.map((i) => i.subject))].length.toString() },
    { label: 'Total Topics', value: syllabus.items.length.toString() },
    { label: 'Required Hours', value: `${syllabus.totalHours}h` },
    { label: 'Study Horizon', value: `${profile.horizonDays} days` },
    { label: 'Session Length', value: `${profile.sessionLength} min` },
    { label: 'Peak Energy', value: profile.peakEnergy },
  ];

  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 20 + col * (W / 2 - 10);
    const y = statsY + row * 28;

    pdf.setFillColor(30, 30, 60);
    pdf.roundedRect(x, y, W / 2 - 25, 22, 3, 3, 'F');

    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 180);
    pdf.setFont('helvetica', 'normal');
    pdf.text(s.label.toUpperCase(), x + 6, y + 8);

    pdf.setFontSize(13);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(s.value, x + 6, y + 17);
  });

  // Health routines section
  const routineY = statsY + 3 * 28 + 15;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(99, 102, 241);
  pdf.text('Health Routines', 20, routineY);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(200, 200, 220);

  const routines = [
    `🌅 Wake: ${profile.wakeTime}   🛏️ Bed: ${profile.bedtime}   😴 Sleep: ${profile.sleepHours}h`,
    `🍳 Breakfast: ${profile.meals.breakfast}  🥗 Lunch: ${profile.meals.lunch}  🍽️ Dinner: ${profile.meals.dinner}`,
    `💊 Break between sessions: ${profile.breakBetweenSessions} min  |  Buffer after commitments: ${profile.transitionBuffer} min`,
    `🚿 Hygiene slots: ${profile.hygieneSlots.map((h) => `${h.start}–${h.end}`).join(', ') || 'None specified'}`,
  ];

  routines.forEach((line, i) => {
    pdf.text(line, 20, routineY + 10 + i * 8);
  });

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 120);
  pdf.text(`Generated on ${format(new Date(), 'PPP')} by StudySync AI`, 20, 285);
}

// ─── Syllabus Overview Page ───────────────────────────────────────────────────

function drawSyllabusPage(pdf: jsPDF, opts: PDFExportOptions) {
  pdf.addPage();
  const { syllabus } = opts;
  const W = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(15, 15, 30);
  pdf.rect(0, 0, W, 297, 'F');
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, 8, 297, 'F');

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Syllabus Breakdown', 20, 25);

  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(0.4);
  pdf.line(20, 30, W - 20, 30);

  let y = 42;
  const subjects = [...new Set(syllabus.items.map((i) => i.subject))];

  for (const subject of subjects) {
    const items = syllabus.items.filter((i) => i.subject === subject);
    const subjectHours = items.reduce((a, b) => a + b.estimatedHours, 0);
    const [r, g, b] = hexToRgb(items[0].color);

    pdf.setFillColor(r, g, b);
    pdf.rect(20, y - 4, 4, items.length * 14 + 6, 'F');

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(r, g, b);
    pdf.text(`${subject}  (${subjectHours}h total)`, 28, y + 2);
    y += 10;

    items.forEach((item) => {
      const complexColors: Record<string, [number, number, number]> = {
        easy: [34, 197, 94],
        medium: [234, 179, 8],
        hard: [239, 68, 68],
      };
      const [cr, cg, cb] = complexColors[item.complexity];

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(220, 220, 240);
      pdf.text(`• ${item.chapter}`, 30, y);

      pdf.setFillColor(cr, cg, cb);
      pdf.roundedRect(W - 55, y - 4, 20, 6, 1, 1, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text(item.complexity.toUpperCase(), W - 54, y);

      pdf.setFontSize(9);
      pdf.setTextColor(160, 160, 200);
      pdf.text(`${item.estimatedHours}h`, W - 30, y);

      y += 10;
      if (y > 275) {
        pdf.addPage();
        pdf.setFillColor(15, 15, 30);
        pdf.rect(0, 0, W, 297, 'F');
        pdf.setFillColor(99, 102, 241);
        pdf.rect(0, 0, 8, 297, 'F');
        y = 20;
      }
    });
    y += 5;
  }
}

// ─── Schedule Capture Page ────────────────────────────────────────────────────

async function drawSchedulePage(pdf: jsPDF, elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const canvas = await html2canvas(el, {
    backgroundColor: '#0f0f1e',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  pdf.addPage();
  pdf.setFillColor(15, 15, 30);
  pdf.rect(0, 0, W, H, 'F');

  const imgH = (canvas.height * W) / canvas.width;
  const pages = Math.ceil(imgH / H);

  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, -p * H, W, imgH);
  }
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export async function exportToPDF(opts: PDFExportOptions): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawCoverPage(pdf, opts);
  drawSyllabusPage(pdf, opts);

  if (opts.elementId) {
    await drawSchedulePage(pdf, opts.elementId);
  }

  const filename = `StudySync_${opts.syllabus.title.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(filename);
}

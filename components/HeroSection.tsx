'use client';

import * as React from 'react';
import { DotField } from '@/components/ui/dot-field';
import { Sparkles, Calendar, Compass } from 'lucide-react';
import Link from 'next/link';

export interface HeroSectionProps {
  onEnterTunnel?: () => void;
}

export default function HeroSection({ onEnterTunnel }: HeroSectionProps) {
  return (
    <div className="w-full bg-[#0B0F17] text-white">
      <DotField
        headline="StudySync AI"
        accent="#A3E635"
        eyebrow={
          <span className="flex items-center gap-1.5 text-white/90">
            <Sparkles className="w-3.5 h-3.5 text-[#A3E635]" /> Health-First Timetable Maker
          </span>
        }
        description="Transform your syllabus PDFs and screenshots into personalized, intelligent study schedules automatically."
        actions={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/upload"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#A3E635] px-6 text-[15px] font-semibold text-slate-950 transition-transform active:scale-95 shadow-lg shadow-lime-500/20 hover:brightness-105"
            >
              <Calendar className="w-4 h-4" /> Create a study plan
            </Link>

            {onEnterTunnel && (
              <button
                type="button"
                onClick={onEnterTunnel}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#A3E635]/40 bg-[#A3E635]/10 px-6 text-[15px] font-semibold text-[#A3E635] backdrop-blur-md transition-all active:scale-95 hover:bg-[#A3E635]/20 shadow-md shadow-lime-500/10"
              >
                <Compass className="w-4 h-4" /> 3D Warp Tunnel
              </button>
            )}

            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-full border border-slate-800 bg-slate-900/60 px-6 text-[15px] font-medium text-white backdrop-blur-md transition-transform active:scale-95 hover:bg-slate-800"
            >
              Explore Dashboard
            </Link>
          </div>
        }
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { BookOpen, CheckCircle2, FileText, FolderOpen } from "lucide-react";
import { Tile } from "@/components/ui/studysync-bento";

export interface UploadSamplePreset {
  id: string;
  title: string;
  detail: string;
}

interface UploadBentoProps {
  children: React.ReactNode;
  samples: UploadSamplePreset[];
  onLoadSample: (id: string) => void;
  sampleLoading?: boolean;
  currentMaterial: React.ReactNode;
  guide: React.ReactNode;
  formats: React.ReactNode;
}

const SAMPLE_COLORS = [
  ["#d9f99d", "#a3e635", "#1a2e05"],
  ["#ddd6fe", "#a78bfa", "#2e1065"],
  ["#fed7aa", "#fb923c", "#431407"],
];

export function UploadBento({
  children,
  samples,
  onLoadSample,
  sampleLoading = false,
  currentMaterial,
  guide,
  formats,
}: UploadBentoProps) {
  const [order, setOrder] = React.useState(() => samples.map((sample) => sample.id));
  const frontId = order[order.length - 1];
  const front = samples.find((sample) => sample.id === frontId) ?? samples[0];

  return (
    <div className="upload-bento-grid">
      <Tile className="upload-bento-main upload-workspace" ariaLabelledBy="upload-page-title">
        {children}
      </Tile>

      <Tile
        title={<>Try a sample <sup className="font-mono text-[10px]">{samples.length}</sup></>}
        className="upload-bento-samples"
      >
        {front ? (
          <>
            <div className="upload-bento-sample-stage" role="group" aria-label="Sample syllabus presets">
              {order.map((id, position) => {
                const sample = samples.find((item) => item.id === id);
                if (!sample) return null;
                const depth = order.length - 1 - position;
                const [color, color2, ink] = SAMPLE_COLORS[position % SAMPLE_COLORS.length];
                const style = {
                  top: `${depth * 32}px`,
                  zIndex: position + 1,
                  transform: `translateX(-50%) scale(${1 - depth * 0.045})`,
                  color: ink,
                  background: `linear-gradient(135deg, ${color}, ${color2})`,
                };

                return depth === 0 ? (
                  <div key={sample.id} className="upload-bento-sample-card" style={style}>
                    <span className="upload-bento-sample-label">SAMPLE PRESET</span>
                    <strong>{sample.title}</strong>
                    <span>{sample.detail}</span>
                  </div>
                ) : (
                  <button
                    key={sample.id}
                    type="button"
                    className="upload-bento-sample-card upload-bento-sample-behind"
                    style={style}
                    onClick={() => setOrder((current) => [...current.filter((item) => item !== id), id])}
                    aria-label={`Show ${sample.title} sample`}
                    disabled={sampleLoading}
                  >
                    <span className="upload-bento-sample-label">SAMPLE PRESET</span>
                    <strong>{sample.title}</strong>
                    <span>{sample.detail}</span>
                  </button>
                );
              })}
            </div>
            <div className="upload-bento-sample-footer">
              <span>Choose a preset to preview its topics.</span>
              <button
                type="button"
                onClick={() => onLoadSample(front.id)}
                disabled={sampleLoading}
              >
                {sampleLoading ? "Loading…" : "Load sample"}
              </button>
            </div>
          </>
        ) : (
          <p className="upload-bento-muted">Sample presets are unavailable.</p>
        )}
      </Tile>

      <Tile title="Quick Guide" className="upload-bento-guide">
        {guide}
      </Tile>

      <Tile title="Current Material" className="upload-bento-status">
        <div className="upload-bento-status-content">
          <span className="upload-bento-status-icon"><FolderOpen size={18} aria-hidden="true" /></span>
          <div className="min-w-0">{currentMaterial}</div>
        </div>
      </Tile>

      <Tile title="Supported Formats" className="upload-bento-formats">
        {formats}
      </Tile>

    </div>
  );
}

export function UploadFormatSummary() {
  return (
    <div className="upload-bento-format-content">
      <div className="upload-bento-format-intro">
        <BookOpen size={18} aria-hidden="true" />
        <p>One place for your course materials.</p>
      </div>
      <ul>
        {["PDF documents", "PNG / JPG / WEBP", "TXT / Markdown"].map((format) => (
          <li key={format}><CheckCircle2 size={14} aria-hidden="true" /><span>{format}</span></li>
        ))}
      </ul>
      <p className="upload-bento-format-limit"><FileText size={13} aria-hidden="true" /> Maximum file size: 20 MB</p>
    </div>
  );
}

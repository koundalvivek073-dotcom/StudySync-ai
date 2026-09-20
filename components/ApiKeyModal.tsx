'use client';

import { useState, useEffect } from 'react';
import { Key, Sparkles, Check, ExternalLink, X, ShieldCheck } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export const STORAGE_KEY_GEMINI = 'studysync_gemini_api_key';

export function getStoredGeminiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_GEMINI) || null;
}

export default function ApiKeyModal({ isOpen, onClose, onKeySaved }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = getStoredGeminiKey();
      if (existing) {
        setApiKey(existing);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY_GEMINI, trimmed);
      setIsSaved(true);
      if (onKeySaved) onKeySaved(trimmed);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 1000);
    } else {
      localStorage.removeItem(STORAGE_KEY_GEMINI);
      onClose();
    }
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY_GEMINI);
    setApiKey('');
    setIsSaved(false);
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md card p-6 border border-primary-500/30 bg-[#121422] shadow-2xl rounded-2xl animate-scaleIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#888baa] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
            <Key className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">AI Setup & API Key</h3>
            <p className="text-xs text-[#888baa]">Powers chapterwise syllabus parsing and AI scheduling</p>
          </div>
        </div>

        {/* Gemini Explanation */}
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3.5 mb-4 text-xs text-[#a0a3bd] space-y-2">
          <div className="flex items-center gap-2 text-primary-300 font-semibold">
            <Sparkles className="w-4 h-4" /> Google Gemini API (Recommended & Free)
          </div>
          <p>
            Google gives free tier access for vision and text models. This allows StudySync to analyze full PDF documents (like CBSE Biology, Maths, Physics) chapter by chapter.
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 font-medium underline"
          >
            Get your free key at Google AI Studio <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Input */}
        <div className="space-y-2 mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#888baa]">
            Paste Gemini API Key
          </label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-[#181a2b] border border-[#2c2f48] focus:border-primary-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-[#555870] outline-none transition-all"
          />
          <div className="flex items-center gap-1.5 text-[11px] text-[#777a94]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Stored safely in your local browser only. Never shared.
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {apiKey && (
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-ghost text-xs text-rose-400 hover:bg-rose-500/10"
            >
              Clear Key
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="btn btn-primary flex-1 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> Saved!
              </>
            ) : (
              'Save & Enable AI'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { X, Download, Printer, ExternalLink, Sparkles, FileText, CheckCircle } from 'lucide-react';

interface InAppPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDataUri: string | null;
  title: string;
  onDownload?: () => void;
}

export default function InAppPdfModal({
  isOpen,
  onClose,
  pdfDataUri,
  title,
  onDownload,
}: InAppPdfModalProps) {
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen || !pdfDataUri) return null;

  const handlePrint = () => {
    try {
      const win = window.open(pdfDataUri, '_blank');
      if (win) {
        win.focus();
        setTimeout(() => win.print(), 500);
      }
    } catch (e) {
      console.warn('Print failed:', e);
    }
  };

  const handleOpenNewTab = () => {
    try {
      window.open(pdfDataUri, '_blank');
    } catch (e) {
      console.warn('Open in new tab failed:', e);
    }
  };

  const handleTriggerDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] flex flex-col rounded-2xl bg-[#0f0f1e] border border-indigo-500/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-indigo-500/20 bg-[#141428]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span className="truncate">{title}</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  In-App PDF View
                </span>
              </h3>
              <p className="text-[11px] text-[#888baa] hidden xs:block">
                Stored locally on your device • Access anytime without exporting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleOpenNewTab}
              title="Open in new tab"
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Full Tab</span>
            </button>

            <button
              onClick={handlePrint}
              title="Print document"
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Print</span>
            </button>

            <button
              onClick={handleTriggerDownload}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30"
            >
              {downloaded ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="hidden xs:inline">Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Export PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-[#888baa] hover:text-white transition-colors ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 w-full bg-[#0a0a14] relative overflow-hidden flex flex-col">
          <iframe
            src={pdfDataUri}
            className="w-full h-full border-none"
            title="Stored Timetable PDF"
          />

          {/* Device storage pill overlay */}
          <div className="absolute bottom-3 left-3 pointer-events-none hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-[#aaa]">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Saved on your device storage</span>
          </div>
        </div>
      </div>
    </div>
  );
}

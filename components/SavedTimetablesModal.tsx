'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  Sparkles,
  HardDrive,
  CheckCircle,
  Eye,
} from 'lucide-react';
import {
  StoredTimetableMeta,
  getStoredTimetablesList,
  getStoredTimetable,
  deleteStoredTimetable,
} from '@/lib/localTimetableStorage';
import { format, formatDistanceToNow } from 'date-fns';

interface SavedTimetablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTimetable: (id: string) => Promise<void>;
  onViewPdf: (pdfDataUri: string, title: string) => void;
  currentActiveId?: string;
}

export default function SavedTimetablesModal({
  isOpen,
  onClose,
  onSelectTimetable,
  onViewPdf,
  currentActiveId,
}: SavedTimetablesModalProps) {
  const [timetables, setTimetables] = useState<StoredTimetableMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const list = await getStoredTimetablesList();
      setTimetables(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleChanged = () => {
      if (isOpen) loadList();
    };
    window.addEventListener('studysync_timetables_changed', handleChanged);
    return () => window.removeEventListener('studysync_timetables_changed', handleChanged);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenInApp = async (id: string) => {
    setActionLoadingId(id);
    try {
      await onSelectTimetable(id);
      onClose();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewPdfClick = async (id: string, title: string) => {
    setActionLoadingId(id);
    try {
      const full = await getStoredTimetable(id);
      if (full) {
        if (full.pdfDataUri) {
          onViewPdf(full.pdfDataUri, full.title);
        } else {
          // If no cached dataUri, generate one on the fly
          const { generatePDFData } = await import('@/lib/pdfExport');
          const { dataUri } = generatePDFData({
            syllabus: full.syllabus,
            profile: full.profile,
            blocks: full.blocks,
          });
          onViewPdf(dataUri, full.title);
        }
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this stored timetable from your device?')) {
      await deleteStoredTimetable(id);
      setTimetables((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0f0f1e] border border-indigo-500/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-indigo-500/20 bg-[#141428]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Timetable History
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {timetables.length} saved on device
                </span>
              </h2>
              <p className="text-xs text-[#888baa]">
                All timetables created on this device are saved here • Access & view PDF offline anytime
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-[#888baa] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-[#888baa]">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
              <p className="text-sm">Loading stored plans...</p>
            </div>
          ) : timetables.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-white/[0.02] border border-white/10">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-indigo-400/60" />
              <h3 className="text-sm font-semibold text-white mb-1">No Timetables Stored Yet</h3>
              <p className="text-xs text-[#888baa] max-w-md mx-auto mb-4">
                Whenever you create a timetable or export a PDF, StudySync AI automatically stores it locally on your device so you can access it anytime right inside the app.
              </p>
            </div>
          ) : (
            timetables.map((item) => {
              const isCurrent = item.id === currentActiveId;
              const dateText = (() => {
                try {
                  return formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
                } catch {
                  return item.createdAt.slice(0, 10);
                }
              })();

              const percentDone =
                item.studyBlocksCount > 0
                  ? Math.round((item.completedBlocksCount / item.studyBlocksCount) * 100)
                  : 0;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                          {item.title}
                        </h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#888baa]">
                        <span>Saved {dateText}</span>
                        <span>•</span>
                        <span>{item.horizonDays} days horizon</span>
                        <span>•</span>
                        <span>{item.totalHours}h study total</span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="text-left sm:text-right min-w-[120px]">
                      <div className="text-xs font-semibold text-white mb-1">
                        {item.completedBlocksCount}/{item.studyBlocksCount} sessions
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all"
                          style={{ width: `${percentDone}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewPdfClick(item.id, item.title)}
                        disabled={actionLoadingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View In-App PDF</span>
                      </button>

                      <button
                        onClick={() => handleOpenInApp(item.id)}
                        disabled={actionLoadingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Load in Dashboard</span>
                      </button>
                    </div>

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete from device"
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#888baa] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-indigo-500/20 bg-[#141428] flex items-center justify-between text-xs text-[#888baa]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Encrypted in local browser storage</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

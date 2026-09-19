/**
 * lib/localTimetableStorage.ts
 * Manages local persistence of generated timetables and their PDF documents
 * directly on the user's device using IndexedDB with localStorage fallback.
 */

import { ParsedSyllabus, AvailabilityProfile, ScheduleBlock } from './types';

export interface StoredTimetable {
  id: string;
  title: string;
  createdAt: string; // ISO date string
  updatedAt: string;
  syllabus: ParsedSyllabus;
  profile: AvailabilityProfile;
  blocks: ScheduleBlock[];
  stats: {
    totalHours: number;
    horizonDays: number;
    totalSubjects: number;
    totalTopics: number;
    studyBlocksCount: number;
    completedBlocksCount: number;
  };
  pdfDataUri?: string; // Base64 PDF data URI for instant in-app viewing
}

export interface StoredTimetableMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  totalHours: number;
  horizonDays: number;
  totalSubjects: number;
  studyBlocksCount: number;
  completedBlocksCount: number;
}

const DB_NAME = 'StudySyncLocalDB';
const DB_VERSION = 1;
const STORE_NAME = 'timetables';
const META_STORAGE_KEY = 'studysync_saved_timetables_meta';

// ─── IndexedDB Helper ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── LocalStorage Meta Helper (for fast sync queries & fallback) ─────────────

function getMetaList(): StoredTimetableMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[Storage] Failed to read meta from localStorage', e);
    return [];
  }
}

function saveMetaList(list: StoredTimetableMeta[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[Storage] Failed to save meta to localStorage', e);
  }
}

function notifyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studysync_timetables_changed'));
  }
}

// ─── Core Storage APIs ───────────────────────────────────────────────────────

/**
 * Save or update a timetable on the user's local device.
 */
export async function saveTimetableLocally(
  syllabus: ParsedSyllabus,
  profile: AvailabilityProfile,
  blocks: ScheduleBlock[],
  pdfDataUri?: string,
  existingId?: string,
): Promise<StoredTimetable> {
  const studyBlocks = blocks.filter((b) => b.type === 'study');
  const completedBlocks = studyBlocks.filter((b) => b.status === 'completed');
  const uniqueSubjects = [...new Set(syllabus.items.map((i) => i.subject))];

  const now = new Date().toISOString();
  const id = existingId || `tt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const storedItem: StoredTimetable = {
    id,
    title: syllabus.title || 'Personalized Study Timetable',
    createdAt: now,
    updatedAt: now,
    syllabus,
    profile,
    blocks,
    stats: {
      totalHours: syllabus.totalHours,
      horizonDays: profile.horizonDays,
      totalSubjects: uniqueSubjects.length,
      totalTopics: syllabus.items.length,
      studyBlocksCount: studyBlocks.length,
      completedBlocksCount: completedBlocks.length,
    },
    pdfDataUri,
  };

  // 1. Try writing to IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(storedItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn('[Storage] IndexedDB put failed, attempting localStorage backup:', idbErr);
    try {
      // If IndexedDB fails, save compressed copy without massive PDF in localStorage
      const fallbackCopy = { ...storedItem, pdfDataUri: undefined };
      localStorage.setItem(`studysync_tt_${id}`, JSON.stringify(fallbackCopy));
    } catch (lsErr) {
      console.error('[Storage] localStorage backup failed:', lsErr);
    }
  }

  // 2. Update metadata index
  const metaItem: StoredTimetableMeta = {
    id: storedItem.id,
    title: storedItem.title,
    createdAt: storedItem.createdAt,
    updatedAt: storedItem.updatedAt,
    totalHours: storedItem.stats.totalHours,
    horizonDays: storedItem.stats.horizonDays,
    totalSubjects: storedItem.stats.totalSubjects,
    studyBlocksCount: storedItem.stats.studyBlocksCount,
    completedBlocksCount: storedItem.stats.completedBlocksCount,
  };

  const metaList = getMetaList();
  const filteredMeta = metaList.filter((m) => m.id !== id);
  saveMetaList([metaItem, ...filteredMeta]);

  notifyChange();
  return storedItem;
}

/**
 * Retrieve all saved timetables metadata (sorted newest first).
 */
export async function getStoredTimetablesList(): Promise<StoredTimetableMeta[]> {
  const metaList = getMetaList();
  if (metaList.length > 0) return metaList;

  // If localStorage meta is empty, try reconstructing from IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as StoredTimetable[]) || [];
        const reconstructed: StoredTimetableMeta[] = items.map((i) => ({
          id: i.id,
          title: i.title,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          totalHours: i.stats.totalHours,
          horizonDays: i.stats.horizonDays,
          totalSubjects: i.stats.totalSubjects,
          studyBlocksCount: i.stats.studyBlocksCount,
          completedBlocksCount: i.stats.completedBlocksCount,
        })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveMetaList(reconstructed);
        resolve(reconstructed);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Retrieve a specific saved timetable by ID (including full blocks & PDF).
 */
export async function getStoredTimetable(id: string): Promise<StoredTimetable | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as StoredTimetable) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`studysync_tt_${id}`);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
    }
    return null;
  }
}

/**
 * Retrieve the most recently saved timetable.
 */
export async function getLatestStoredTimetable(): Promise<StoredTimetable | null> {
  const metaList = await getStoredTimetablesList();
  if (metaList.length === 0) return null;
  return getStoredTimetable(metaList[0].id);
}

/**
 * Update the PDF data URI of a stored timetable.
 */
export async function updateStoredTimetablePDF(id: string, pdfDataUri: string): Promise<void> {
  const existing = await getStoredTimetable(id);
  if (!existing) return;

  existing.pdfDataUri = pdfDataUri;
  existing.updatedAt = new Date().toISOString();

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(existing);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    notifyChange();
  } catch (e) {
    console.warn('[Storage] Failed to update PDF in IndexedDB:', e);
  }
}

/**
 * Update the schedule blocks and completion count of a stored timetable.
 */
export async function updateStoredTimetableBlocks(id: string, blocks: ScheduleBlock[]): Promise<void> {
  const existing = await getStoredTimetable(id);
  if (!existing) return;

  const studyBlocks = blocks.filter((b) => b.type === 'study');
  const completedBlocks = studyBlocks.filter((b) => b.status === 'completed');

  existing.blocks = blocks;
  existing.stats.completedBlocksCount = completedBlocks.length;
  existing.updatedAt = new Date().toISOString();

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(existing);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Update metadata list
    const metaList = getMetaList();
    const updatedMeta = metaList.map((m) =>
      m.id === id ? { ...m, completedBlocksCount: completedBlocks.length, updatedAt: existing.updatedAt } : m
    );
    saveMetaList(updatedMeta);
    notifyChange();
  } catch (e) {
    console.warn('[Storage] Failed to update blocks in IndexedDB:', e);
  }
}

/**
 * Delete a stored timetable by ID.
 */
export async function deleteStoredTimetable(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[Storage] Failed to delete from IndexedDB:', e);
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(`studysync_tt_${id}`);
    const metaList = getMetaList().filter((m) => m.id !== id);
    saveMetaList(metaList);
    notifyChange();
  }
}

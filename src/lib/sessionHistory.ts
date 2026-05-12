import type { Lecture } from "./mockData";

const KEY = "nebula.sessions.v1";
const MAX = 10;

export interface StoredSession {
  id: string;
  title: string;
  url: string;
  savedAt: number;
  lecture: Lecture;
}

export const loadSessions = (): StoredSession[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persist = (list: StoredSession[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
};

export const saveSession = (
  lecture: Lecture,
  url: string,
): StoredSession[] => {
  const existing = loadSessions().filter(
    (s) => s.url !== url && s.title !== lecture.title,
  );
  const next: StoredSession = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: lecture.title,
    url,
    savedAt: Date.now(),
    lecture,
  };
  const list = [next, ...existing].slice(0, MAX);
  persist(list);
  return list;
};

export const removeSession = (id: string): StoredSession[] => {
  const list = loadSessions().filter((s) => s.id !== id);
  persist(list);
  return list;
};

export const clearSessions = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};

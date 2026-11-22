import type { Material, Preferences, PublicActivity, SkillCode, Support } from "@langkahbelajar/shared";
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: { ...(options.body !== undefined ? { "content-type": "application/json" } : {}), ...options.headers },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Network error");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? "UNKNOWN", data?.error?.message ?? "Request failed", data?.error?.fields);
  return data as T;
}

export function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    try {
      const value = await load();
      if (request === latest.current) {
        setData(value);
        setError(null);
      }
    } catch (caught) {
      if (request === latest.current) setError(caught);
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, deps);

  useEffect(() => void reload(), [reload]);
  return { data, error, loading, reload, setData };
}

// crypto.randomUUID is unavailable on plain HTTP, which is how the STB may be served on a local network.
export function newIdempotencyKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}
export interface Child {
  id: string;
  nickname: string;
  isSample: boolean;
  role: "PARENT" | "TEACHER";
  isOwner: boolean;
}
export interface LearningProfile {
  preferences: Preferences;
  targets: SkillCode[];
  initialNotes: string;
}
export interface SessionStep {
  id: string;
  position: number;
  kind: "START" | "PRACTICE" | "BREAK" | "FINISH";
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "POSTPONED";
  skillCode: SkillCode | null;
  level: number | null;
  attempts: number;
  adaptationReason: string | null;
  activity: PublicActivity | null;
  material: Material | null;
}
export interface LearningSession {
  id: string;
  childId: string;
  type: "PRACTICE" | "STARTER";
  status: "PLANNED" | "IN_PROGRESS" | "PAUSED" | "STOPPED" | "COMPLETED";
  durationMinutes: number;
  profileSnapshot: { preferences: Preferences; targets: SkillCode[] };
  currentStepId: string | null;
  steps: SessionStep[];
}
export interface SkillProgress {
  skillCode: SkillCode;
  isTarget: boolean;
  currentLevel: number;
  maxLevel: number;
  status: "PRACTICING" | "NEXT_STAGE_OFFERED" | "FINAL_STAGE_REACHED";
  independentSessions: number;
  threshold: number;
}
export interface HistoryItem {
  id: string;
  createdAt: string;
  level: number;
  title: string;
  isCorrect: boolean;
  independent: boolean;
  supportUsed: Support[];
  stepStatus: string;
  countsTowardMastery: boolean;
}
export interface Note {
  id: string;
  body: string;
  skillCode: SkillCode | null;
  createdAt: string;
  authorName: string;
}
export interface Routine {
  days: number[];
  time: string;
  durationMinutes: 5 | 10 | 15;
  breakMinutes: number;
  remindersEnabled: boolean;
}
export interface Summary {
  sessionId: string;
  completedAt: string;
  skills: { skillCode: SkillCode; completed: number; skipped: number; postponed: number; independent: number; withTaskHelp: number }[];
}

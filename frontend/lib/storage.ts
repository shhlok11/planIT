const TOKEN_KEY = "planit.token";
const UPLOAD_KEY = "planit.activeUploadId";
const UPLOAD_HISTORY_KEY = "planit.uploadHistory";
const PLAN_KEY = "planit.activePlanId";
const PLAN_HISTORY_KEY = "planit.planHistory";

export interface StoredUploadRecord {
  uploadId: number;
  originalFilename: string;
  createdAt: string;
}

export interface StoredPlanRecord {
  planId: number;
  title: string;
  createdAt: string;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUploadId(): number | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(UPLOAD_KEY);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredUploadId(uploadId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UPLOAD_KEY, String(uploadId));
}

export function clearStoredUploadId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(UPLOAD_KEY);
}

export function getStoredUploadHistory(): StoredUploadRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(UPLOAD_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredUploadRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => Number.isFinite(item.uploadId) && typeof item.originalFilename === "string");
  } catch {
    return [];
  }
}

export function pushStoredUpload(record: StoredUploadRecord) {
  if (typeof window === "undefined") return;
  const existing = getStoredUploadHistory().filter((item) => item.uploadId !== record.uploadId);
  const next = [record, ...existing].slice(0, 12);
  window.localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(next));
}

export function getStoredPlanId(): number | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(PLAN_KEY);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredPlanId(planId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAN_KEY, String(planId));
}

export function clearStoredPlanId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLAN_KEY);
}

export function getStoredPlanHistory(): StoredPlanRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PLAN_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredPlanRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => Number.isFinite(item.planId) && typeof item.title === "string");
  } catch {
    return [];
  }
}

export function pushStoredPlan(record: StoredPlanRecord) {
  if (typeof window === "undefined") return;
  const existing = getStoredPlanHistory().filter((item) => item.planId !== record.planId);
  const next = [record, ...existing].slice(0, 12);
  window.localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(next));
}

export function updateStoredPlanTitle(planId: number, title: string) {
  if (typeof window === "undefined") return;
  const next = getStoredPlanHistory().map((item) => (
    item.planId === planId ? { ...item, title } : item
  ));
  window.localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(next));
}

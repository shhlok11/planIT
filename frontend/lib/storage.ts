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

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getBrowserStorage(): BrowserStorage | null {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    if (
      !storage
      || typeof storage.getItem !== "function"
      || typeof storage.setItem !== "function"
      || typeof storage.removeItem !== "function"
    ) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return getBrowserStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function setStoredToken(token: string) {
  getBrowserStorage()?.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  getBrowserStorage()?.removeItem(TOKEN_KEY);
}

export function getStoredUploadId(): number | null {
  const value = getBrowserStorage()?.getItem(UPLOAD_KEY);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredUploadId(uploadId: number) {
  getBrowserStorage()?.setItem(UPLOAD_KEY, String(uploadId));
}

export function clearStoredUploadId() {
  getBrowserStorage()?.removeItem(UPLOAD_KEY);
}

export function getStoredUploadHistory(): StoredUploadRecord[] {
  const raw = getBrowserStorage()?.getItem(UPLOAD_HISTORY_KEY);
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
  const storage = getBrowserStorage();
  if (!storage) return;
  const existing = getStoredUploadHistory().filter((item) => item.uploadId !== record.uploadId);
  const next = [record, ...existing].slice(0, 12);
  storage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(next));
}

export function getStoredPlanId(): number | null {
  const value = getBrowserStorage()?.getItem(PLAN_KEY);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredPlanId(planId: number) {
  getBrowserStorage()?.setItem(PLAN_KEY, String(planId));
}

export function clearStoredPlanId() {
  getBrowserStorage()?.removeItem(PLAN_KEY);
}

export function getStoredPlanHistory(): StoredPlanRecord[] {
  const raw = getBrowserStorage()?.getItem(PLAN_HISTORY_KEY);
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
  const storage = getBrowserStorage();
  if (!storage) return;
  const existing = getStoredPlanHistory().filter((item) => item.planId !== record.planId);
  const next = [record, ...existing].slice(0, 12);
  storage.setItem(PLAN_HISTORY_KEY, JSON.stringify(next));
}

export function updateStoredPlanTitle(planId: number, title: string) {
  const storage = getBrowserStorage();
  if (!storage) return;
  const next = getStoredPlanHistory().map((item) => (
    item.planId === planId ? { ...item, title } : item
  ));
  storage.setItem(PLAN_HISTORY_KEY, JSON.stringify(next));
}

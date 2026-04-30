import type {
  AuthProvidersResponse,
  CourseEventCreate,
  CourseEventRead,
  CourseEventUpdate,
  CoursePreferenceUpdate,
  CourseRead,
  DeleteEventResponse,
  LoginPayload,
  PlanConflictsResponse,
  PlanCoursesResponse,
  PlanCreatePayload,
  PlanPriorityScoresResponse,
  PlanRead,
  PlanScheduleResponse,
  PlanUpdatePayload,
  RegisterPayload,
  TokenResponse,
  UploadConflictsResponse,
  UploadCoursesResponse,
  UploadFileResponse,
  UploadPriorityScoresResponse,
  UploadScheduleResponse,
  UploadStatusResponse,
  UserPreferenceCreate,
  UserPreferenceRead,
  UserRead,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function friendlyStatusMessage(status: number) {
  if (status === 400) return "That request could not be completed. Check the details and try again.";
  if (status === 401) return "Your session expired. Sign in again to continue.";
  if (status === 403) return "You do not have access to that item.";
  if (status === 404) return "We could not find that item. It may have been moved or deleted.";
  if (status === 409) return "That change conflicts with the current plan. Refresh and try again.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 415) return "That file type is not supported. Upload a PDF.";
  if (status === 422) return "Some required details are missing or invalid.";
  if (status === 429) return "Too many requests came in at once. Wait a moment and try again.";
  if (status >= 500) return "The server ran into a problem. Try again in a moment.";
  return "Something went wrong. Try again.";
}

function decodeErrorText(value: string) {
  const plusAsSpaces = value.replace(/\+/g, " ");
  try {
    return decodeURIComponent(plusAsSpaces);
  } catch {
    return plusAsSpaces;
  }
}

function formatValidationIssues(issues: unknown[]) {
  const messages = issues
    .map((issue) => {
      if (typeof issue === "string") return issue;
      if (!issue || typeof issue !== "object") return null;

      const record = issue as { loc?: unknown; msg?: unknown };
      if (typeof record.msg !== "string") return null;

      const field = Array.isArray(record.loc)
        ? record.loc.filter((part) => typeof part === "string" || typeof part === "number").at(-1)
        : null;

      return field ? `${field}: ${record.msg}` : record.msg;
    })
    .filter((message): message is string => Boolean(message));

  if (!messages.length) return null;

  return `Some required details are missing or invalid: ${messages.slice(0, 2).join("; ")}.`;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as { detail?: unknown; message?: unknown; error?: unknown };

  if (Array.isArray(record.detail)) {
    return formatValidationIssues(record.detail);
  }

  if (typeof record.detail === "string") return record.detail;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  return null;
}

export function normalizeErrorMessage(value: unknown, fallback = "Something went wrong. Try again.") {
  if (typeof value !== "string") return fallback;

  const decoded = decodeErrorText(value)
    .replace(/\brequest failed with status\s+\d{3}\b/gi, "")
    .replace(/\bHTTP\s+\d{3}\b/gi, "")
    .replace(/^\s*\d{3}\s*[:\-]\s*/g, "")
    .trim();

  if (!decoded) return fallback;

  const genericServerMessages = new Set([
    "bad request",
    "unauthorized",
    "forbidden",
    "not found",
    "unprocessable entity",
    "internal server error",
    "service unavailable",
  ]);

  if (genericServerMessages.has(decoded.toLowerCase())) return fallback;

  return decoded;
}

export async function readApiErrorMessage(response: Response) {
  const fallback = friendlyStatusMessage(response.status);

  let bodyText = "";

  try {
    bodyText = await response.text();
  } catch {
    return fallback;
  }

  if (!bodyText) return fallback;

  try {
    return normalizeErrorMessage(extractErrorMessage(JSON.parse(bodyText)), fallback);
  } catch {
    return normalizeErrorMessage(bodyText, fallback);
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Backend connection dropped. Restart the FastAPI server and try again.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await readApiErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getProviders() {
    return apiFetch<AuthProvidersResponse>("/api/v1/auth/providers");
  },
  register(payload: RegisterPayload) {
    return apiFetch<TokenResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: LoginPayload) {
    return apiFetch<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  me(token: string) {
    return apiFetch<UserRead>("/api/v1/auth/me", {}, token);
  },
  logout() {
    return apiFetch<{ detail: string }>("/api/v1/auth/logout", { method: "POST" });
  },
  createPlan(payload: PlanCreatePayload, token: string) {
    return apiFetch<PlanRead>("/api/v1/plans", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
  },
  listPlans(token: string) {
    return apiFetch<PlanRead[]>("/api/v1/plans", {}, token);
  },
  getPlan(planId: number, token: string) {
    return apiFetch<PlanRead>(`/api/v1/plans/${planId}`, {}, token);
  },
  updatePlan(planId: number, payload: PlanUpdatePayload, token: string) {
    return apiFetch<PlanRead>(`/api/v1/plans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token);
  },
  uploadFile(file: File, token: string) {
    const body = new FormData();
    body.append("file", file);
    return apiFetch<UploadFileResponse>("/api/v1/uploads/upload-file", {
      method: "POST",
      body,
    }, token);
  },
  uploadFileToPlan(planId: number, file: File, token: string) {
    const body = new FormData();
    body.append("file", file);
    return apiFetch<UploadFileResponse>(`/api/v1/plans/${planId}/upload-file`, {
      method: "POST",
      body,
    }, token);
  },
  getUploadStatus(uploadId: number, token: string) {
    return apiFetch<UploadStatusResponse>(`/api/v1/uploads/upload-status/${uploadId}`, {}, token);
  },
  extractUpload(uploadId: number, token: string) {
    return apiFetch<UploadCoursesResponse>(`/api/v1/uploads/${uploadId}/extract`, {
      method: "POST",
    }, token);
  },
  extractPlan(planId: number, token: string) {
    return apiFetch<PlanCoursesResponse>(`/api/v1/plans/${planId}/extract`, {
      method: "POST",
    }, token);
  },
  getCourses(uploadId: number, token: string) {
    return apiFetch<UploadCoursesResponse>(`/api/v1/uploads/${uploadId}/courses`, {}, token);
  },
  getPlanCourses(planId: number, token: string) {
    return apiFetch<PlanCoursesResponse>(`/api/v1/plans/${planId}/courses`, {}, token);
  },
  getPriorityScores(uploadId: number, token: string) {
    return apiFetch<UploadPriorityScoresResponse>(`/api/v1/uploads/${uploadId}/priority-scores`, {}, token);
  },
  getPlanPriorityScores(planId: number, token: string) {
    return apiFetch<PlanPriorityScoresResponse>(`/api/v1/plans/${planId}/priority-scores`, {}, token);
  },
  getConflicts(uploadId: number, token: string) {
    return apiFetch<UploadConflictsResponse>(`/api/v1/uploads/${uploadId}/conflicts`, {}, token);
  },
  getPlanConflicts(planId: number, token: string) {
    return apiFetch<PlanConflictsResponse>(`/api/v1/plans/${planId}/conflicts`, {}, token);
  },
  generateSchedule(uploadId: number, token: string) {
    return apiFetch<UploadScheduleResponse>(`/api/v1/uploads/${uploadId}/schedule`, {
      method: "POST",
    }, token);
  },
  generatePlanSchedule(planId: number, token: string) {
    return apiFetch<PlanScheduleResponse>(`/api/v1/plans/${planId}/schedule`, {
      method: "POST",
    }, token);
  },
  getStudyBlocks(uploadId: number, token: string) {
    return apiFetch<UploadScheduleResponse>(`/api/v1/uploads/${uploadId}/study-blocks`, {}, token);
  },
  getPlanStudyBlocks(planId: number, token: string) {
    return apiFetch<PlanScheduleResponse>(`/api/v1/plans/${planId}/study-blocks`, {}, token);
  },
  getLatestPreferences(token: string) {
    return apiFetch<UserPreferenceRead>("/api/v1/preferences/latest", {}, token);
  },
  upsertPreferences(payload: UserPreferenceCreate, token: string) {
    return apiFetch<UserPreferenceRead>("/api/v1/preferences", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
  },
  patchCoursePreferences(courseId: number, payload: CoursePreferenceUpdate, token: string) {
    return apiFetch<CourseRead>(`/api/v1/courses/${courseId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token);
  },
  createEvent(courseId: number, payload: CourseEventCreate, token: string) {
    return apiFetch<CourseEventRead>(`/api/v1/courses/${courseId}/events`, {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
  },
  patchEvent(eventId: number, payload: CourseEventUpdate, token: string) {
    return apiFetch<CourseEventRead>(`/api/v1/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token);
  },
  deleteEvent(eventId: number, token: string) {
    return apiFetch<DeleteEventResponse>(`/api/v1/events/${eventId}`, {
      method: "DELETE",
    }, token);
  },
  getIcsUrl(uploadId: number) {
    return `/api/v1/uploads/${uploadId}/export.ics`;
  },
  getPdfUrl(uploadId: number) {
    return `/api/v1/uploads/${uploadId}/export.pdf`;
  },
  getPlanIcsUrl(planId: number) {
    return `/api/v1/plans/${planId}/export.ics`;
  },
  getPlanPdfUrl(planId: number) {
    return `/api/v1/plans/${planId}/export.pdf`;
  },
};

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

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    return fallback;
  } catch {
    return fallback;
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
    throw new ApiError(await readErrorMessage(response), response.status);
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

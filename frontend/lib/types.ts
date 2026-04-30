export type EventType = "assignment" | "exam" | "quiz" | "lab" | "project" | "other";
export type ConflictRule = "48_hour_window" | "same_week" | "high_weight_window";
export type ConflictSeverity = "low" | "medium" | "high";
export type PreferredStudyTime = "morning" | "afternoon" | "evening" | "night" | "flexible";
export type PlanIntensity = "light" | "balanced" | "intense";
export type UploadPipelineStatus = "UPLOADED" | "PROCESSING" | "PARSED" | "CLEANED" | "EXTRACTED" | "NEEDS_REVIEW" | "FAILED";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserRead {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface AuthProviderState {
  enabled: boolean;
  login_url: string | null;
}

export interface AuthProvidersResponse {
  google: AuthProviderState;
  github: AuthProviderState;
}

export interface UploadFileResponse {
  message: string;
  upload_id: number;
  plan_id?: number | null;
  original_filename: string;
  saved_filename: string;
  content_type: string;
  file_size_bytes: number;
  storage_path: string;
  status: UploadPipelineStatus;
}

export interface UploadStatusResponse {
  upload_id: number;
  plan_id?: number | null;
  original_filename: string;
  saved_filename: string;
  status: UploadPipelineStatus;
  file_size_bytes: number;
  storage_path: string;
  created_at: string;
  has_extracted_text: boolean;
  has_clean_text: boolean;
}

export interface CourseEventRead {
  id: number;
  course_id: number;
  title: string;
  type: EventType;
  date: string | null;
  weight: number | null;
  confidence: number | null;
  source_text: string | null;
  is_user_edited: boolean;
  created_at: string;
}

export interface CourseRead {
  id: number;
  upload_id: number;
  course_code: string;
  course_name: string | null;
  semester: string | null;
  priority_rank: number | null;
  difficulty: number | null;
  created_at: string;
  events: CourseEventRead[];
}

export interface UploadCoursesResponse {
  upload_id: number;
  courses: CourseRead[];
}

export interface PlanUploadRead {
  id: number;
  original_filename: string;
  status: UploadPipelineStatus | string;
  created_at: string;
}

export interface PlanRead {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  uploads: PlanUploadRead[];
}

export interface PlanCreatePayload {
  title: string;
}

export interface PlanUpdatePayload {
  title: string;
}

export interface PlanCoursesResponse {
  plan_id: number;
  courses: CourseRead[];
}

export interface PriorityScoreComponents {
  urgency: number;
  course_priority: number;
  difficulty: number;
  weight: number;
  event_type: number;
  confidence_adjustment: number;
  reminder_window: number;
  intensity_multiplier: number;
}

export interface PriorityScoreRead {
  event_id: number;
  course_id: number;
  course_code: string;
  title: string;
  type: string;
  date: string | null;
  days_until_due: number | null;
  weight: number | null;
  confidence: number | null;
  priority_score: number;
  components: PriorityScoreComponents;
  reasons: string[];
  warnings: string[];
}

export interface UploadPriorityScoresResponse {
  upload_id: number;
  preference_id: number | null;
  scores: PriorityScoreRead[];
}

export interface PlanPriorityScoresResponse {
  plan_id: number;
  preference_id: number | null;
  scores: PriorityScoreRead[];
}

export interface ConflictRead {
  rule: ConflictRule;
  severity: ConflictSeverity;
  window_start: string;
  window_end: string;
  event_ids: number[];
  message: string;
}

export interface UploadConflictsResponse {
  upload_id: number;
  conflicts: ConflictRead[];
}

export interface PlanConflictsResponse {
  plan_id: number;
  conflicts: ConflictRead[];
}

export interface StudyBlockRead {
  id: number;
  upload_id: number;
  course_id: number;
  event_id: number;
  title: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  priority_score: number;
  created_at: string;
}

export interface UploadScheduleResponse {
  upload_id: number;
  preference_id: number | null;
  study_blocks: StudyBlockRead[];
}

export interface PlanScheduleResponse {
  plan_id: number;
  preference_id: number | null;
  study_blocks: StudyBlockRead[];
}

export interface UserPreferenceRead {
  id: number;
  study_hours_per_day: number;
  preferred_study_time: PreferredStudyTime;
  intensity: PlanIntensity;
  weekends_available: boolean;
  minimum_reminder_days: number;
  created_at: string;
  updated_at: string | null;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserPreferenceCreate {
  study_hours_per_day: number;
  preferred_study_time: PreferredStudyTime;
  intensity: PlanIntensity;
  weekends_available: boolean;
  minimum_reminder_days: number;
}

export interface CoursePreferenceUpdate {
  priority_rank?: number;
  difficulty?: number;
}

export interface CourseEventCreate {
  title: string;
  type: EventType;
  date?: string | null;
  weight?: number | null;
  confidence?: number | null;
  source_text?: string | null;
}

export interface CourseEventUpdate {
  title?: string;
  type?: EventType;
  date?: string | null;
  weight?: number | null;
  confidence?: number | null;
  source_text?: string | null;
}

export interface DeleteEventResponse {
  deleted: boolean;
  event_id: number;
}

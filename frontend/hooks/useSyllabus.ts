"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { clearStoredPlanId } from "@/lib/storage";
import type {
  CourseEventCreate,
  CourseEventUpdate,
  CourseRead,
  PlanConflictsResponse,
  PlanPriorityScoresResponse,
  PlanRead,
  PlanScheduleResponse,
  UserPreferenceCreate,
  UserPreferenceRead,
} from "@/lib/types";

interface SyllabusState {
  plan: PlanRead | null;
  courses: CourseRead[];
  priorityScores: PlanPriorityScoresResponse["scores"];
  conflicts: PlanConflictsResponse["conflicts"];
  studyBlocks: PlanScheduleResponse["study_blocks"];
  preferences: UserPreferenceRead | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  savePreferences: (payload: UserPreferenceCreate) => Promise<void>;
  updateCoursePreferences: (courseId: number, payload: { priority_rank?: number; difficulty?: number }) => Promise<void>;
  createEvent: (courseId: number, payload: CourseEventCreate) => Promise<void>;
  updateEvent: (eventId: number, payload: CourseEventUpdate) => Promise<void>;
  deleteEvent: (eventId: number) => Promise<void>;
  generateSchedule: () => Promise<void>;
}

export function useSyllabus(planId: number | null, token: string | null): SyllabusState {
  const [plan, setPlan] = useState<PlanRead | null>(null);
  const [courses, setCourses] = useState<CourseRead[]>([]);
  const [priorityScores, setPriorityScores] = useState<PlanPriorityScoresResponse["scores"]>([]);
  const [conflicts, setConflicts] = useState<PlanConflictsResponse["conflicts"]>([]);
  const [studyBlocks, setStudyBlocks] = useState<PlanScheduleResponse["study_blocks"]>([]);
  const [preferences, setPreferences] = useState<UserPreferenceRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preferencesMissingRef = useRef(false);
  const invalidPlanRef = useRef(false);

  useEffect(() => {
    invalidPlanRef.current = false;
  }, [planId, token]);

  const refresh = useCallback(async () => {
    if (!planId || !token) {
      setPlan(null);
      setCourses([]);
      setPriorityScores([]);
      setConflicts([]);
      setStudyBlocks([]);
      setPreferences(null);
      setLoading(false);
      return;
    }

    if (invalidPlanRef.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [status, coursePayload, scorePayload, conflictPayload, blockPayload, preferencePayload] =
        await Promise.all([
          api.getPlan(planId, token),
          api.getPlanCourses(planId, token),
          api.getPlanPriorityScores(planId, token),
          api.getPlanConflicts(planId, token),
          api.getPlanStudyBlocks(planId, token),
          preferencesMissingRef.current
            ? Promise.resolve(null)
            : api.getLatestPreferences(token).catch((err) => {
                if (err instanceof ApiError && err.status === 404) {
                  preferencesMissingRef.current = true;
                  return null;
                }
                throw err;
              }),
        ]);

      setPlan(status);
      setCourses(coursePayload.courses);
      setPriorityScores(scorePayload.scores);
      setConflicts(conflictPayload.conflicts);
      setStudyBlocks(blockPayload.study_blocks);
      setPreferences(preferencePayload);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        invalidPlanRef.current = true;
        clearStoredPlanId();
        setPlan(null);
        setCourses([]);
        setPriorityScores([]);
        setConflicts([]);
        setStudyBlocks([]);
        setPreferences(null);
        setError("The selected plan could not be found. Select another plan or create a new one.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load syllabus data");
    } finally {
      setLoading(false);
    }
  }, [token, planId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePreferences = useCallback(async (payload: UserPreferenceCreate) => {
    if (!token) return;
    try {
      const result = await api.upsertPreferences(payload, token);
      if (planId) {
        await api.generatePlanSchedule(planId, token);
      }
      preferencesMissingRef.current = false;
      setPreferences(result);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    }
  }, [planId, refresh, token]);

  const updateCoursePreferences = useCallback(async (courseId: number, payload: { priority_rank?: number; difficulty?: number }) => {
    if (!token) return;
    try {
      await api.patchCoursePreferences(courseId, payload, token);
      if (planId) {
        await api.generatePlanSchedule(planId, token);
      }
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update course preferences");
    }
  }, [planId, refresh, token]);

  const createEvent = useCallback(async (courseId: number, payload: CourseEventCreate) => {
    if (!token) return;
    try {
      await api.createEvent(courseId, payload, token);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    }
  }, [refresh, token]);

  const updateEvent = useCallback(async (eventId: number, payload: CourseEventUpdate) => {
    if (!token) return;
    try {
      await api.patchEvent(eventId, payload, token);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    }
  }, [refresh, token]);

  const deleteEvent = useCallback(async (eventId: number) => {
    if (!token) return;
    try {
      await api.deleteEvent(eventId, token);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    }
  }, [refresh, token]);

  const generateSchedule = useCallback(async () => {
    if (!token || !planId) return;
    try {
      await api.generatePlanSchedule(planId, token);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate schedule");
    }
  }, [refresh, token, planId]);

  return {
    plan,
    courses,
    priorityScores,
    conflicts,
    studyBlocks,
    preferences,
    loading,
    error,
    refresh,
    savePreferences,
    updateCoursePreferences,
    createEvent,
    updateEvent,
    deleteEvent,
    generateSchedule,
  };
}

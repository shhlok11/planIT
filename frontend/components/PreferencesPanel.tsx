"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { SpotlightCard } from "@/components/SpotlightCard";
import type { UserPreferenceCreate, UserPreferenceRead } from "@/lib/types";

interface PreferencesPanelProps {
  preferences: UserPreferenceRead | null;
  onSave: (payload: UserPreferenceCreate) => Promise<void>;
}

export function PreferencesPanel({ preferences, onSave }: PreferencesPanelProps) {
  const [form, setForm] = useState<UserPreferenceCreate>({
    study_hours_per_day: 2,
    preferred_study_time: "evening",
    intensity: "balanced",
    weekends_available: true,
    minimum_reminder_days: 3,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setForm({
      study_hours_per_day: preferences.study_hours_per_day,
      preferred_study_time: preferences.preferred_study_time,
      intensity: preferences.intensity,
      weekends_available: preferences.weekends_available,
      minimum_reminder_days: preferences.minimum_reminder_days,
    });
  }, [preferences]);

  return (
    <SpotlightCard accent="cyan" className="section-panel">
      <div className="section-header">
        <div>
          <h2 className="display" style={{ margin: 0 }}>Planner Settings</h2>
          <div className="muted">Tune the scheduler before regenerating study blocks.</div>
        </div>
      </div>

      <div className="grid-two">
        <div className="field-group">
          <label>Study Hours Per Day</label>
          <input
            className="field"
            type="number"
            min={1}
            max={12}
            step="0.5"
            value={form.study_hours_per_day}
            onChange={(event) => setForm((current) => ({
              ...current,
              study_hours_per_day: event.target.value === "" ? 0 : Number(event.target.value),
            }))}
          />
        </div>
        <div className="field-group">
          <label>Preferred Study Time</label>
          <select
            className="field"
            value={form.preferred_study_time}
            onChange={(event) => setForm((current) => ({
              ...current,
              preferred_study_time: event.target.value as UserPreferenceCreate["preferred_study_time"],
            }))}
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
        <div className="field-group">
          <label>Intensity</label>
          <select
            className="field"
            value={form.intensity}
            onChange={(event) => setForm((current) => ({
              ...current,
              intensity: event.target.value as UserPreferenceCreate["intensity"],
            }))}
          >
            <option value="light">Light</option>
            <option value="balanced">Balanced</option>
            <option value="intense">Intense</option>
          </select>
        </div>
        <div className="field-group">
          <label>Minimum Reminder Days</label>
          <input
            className="field"
            type="number"
            min={0}
            max={30}
            value={form.minimum_reminder_days}
            onChange={(event) => setForm((current) => ({
              ...current,
              minimum_reminder_days: event.target.value === "" ? 0 : Number(event.target.value),
            }))}
          />
        </div>
      </div>

      <label className="tag" style={{ marginTop: "1rem", width: "fit-content" }}>
        <input
          type="checkbox"
          checked={form.weekends_available}
          onChange={(event) => setForm((current) => ({
            ...current,
            weekends_available: event.target.checked,
          }))}
        />
        Weekends Available
      </label>

      {error ? <div className="error-banner" style={{ marginTop: "1rem" }}>{error}</div> : null}

      <div className="action-row" style={{ marginTop: "1rem" }}>
        <button
          className="cta-primary mono"
          disabled={saving}
          onClick={async () => {
            setError(null);
            if (!Number.isFinite(form.study_hours_per_day) || form.study_hours_per_day <= 0 || form.study_hours_per_day > 12) {
              setError("Study hours per day must be between 0.5 and 12.");
              return;
            }
            if (!Number.isFinite(form.minimum_reminder_days) || form.minimum_reminder_days < 0 || form.minimum_reminder_days > 30) {
              setError("Reminder days must be between 0 and 30.");
              return;
            }

            try {
              setSaving(true);
              await onSave(form);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to save preferences");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving + Regenerating..." : "Save Preferences"}
        </button>
      </div>
    </SpotlightCard>
  );
}

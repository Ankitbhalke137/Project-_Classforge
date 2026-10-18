"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ATTENDANCE_STATUSES } from "@/types";

const STATUS_INFO: {
  key: (typeof ATTENDANCE_STATUSES)[number];
  label: string;
  description: string;
  tone: "neutral" | "brand" | "amber" | "red";
}[] = [
  {
    key: "PRESENT",
    label: "Present",
    description: "Student attended the full school day.",
    tone: "brand",
  },
  {
    key: "ABSENT",
    label: "Absent",
    description: "Student was not present without an approved reason.",
    tone: "red",
  },
  {
    key: "LATE",
    label: "Late",
    description: "Student arrived after the start of the school day.",
    tone: "amber",
  },
  {
    key: "EXCUSED",
    label: "Excused",
    description: "Student was absent with an approved reason.",
    tone: "neutral",
  },
];

export function AttendanceSettingsSection() {
  const [policy, setPolicy] = useState({
    allowTeacherEdit: true,
    requireParentNoteForExcused: false,
    lateThresholdMinutes: 15,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);

    // There is no backend endpoint for saving attendance policy preferences.
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 800);

    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Attendance Statuses"
          description="The four attendance statuses used across the school. These are fixed and cannot be changed."
        />
        <CardBody className="divide-y divide-line">
          {STATUS_INFO.map((status) => (
            <div key={status.key} className="px-5 py-4 flex items-center gap-4">
              <Badge tone={status.tone} className="shrink-0 text-[11px]">
                {status.label}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{status.label}</p>
                <p className="mt-0.5 text-[13px] text-body">{status.description}</p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Attendance Policy Preferences"
          description="Optional preferences for how attendance is recorded and managed."
        />
        <CardBody className="space-y-5">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-white">
              <div>
                <h3 className="text-sm font-medium text-ink">Allow teachers to edit attendance</h3>
                <p className="mt-0.5 text-xs text-body">
                  Teachers can mark and correct attendance for their classes.
                </p>
              </div>
              <label className="relative inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.allowTeacherEdit}
                  onChange={(event) =>
                    setPolicy((p) => ({ ...p, allowTeacherEdit: event.target.checked }))
                  }
                  className="rounded border-line bg-white text-secondary focus:border-secondary focus:ring-2 focus:ring-secondary-soft"
                />
                <span className="block h-5 w-9 rounded-full border border-line bg-white transition-colors peer-checked:bg-secondary peer-checked:after:translate-x-full peer-checked:after:border-white">
                  <span className="peer-checked:after:translate-x-full peer-checked:after:border-white after:block after:w-3 after:h-3 after:bg-current after:rounded-full after:border border-line after:bg-white after:top-1 after:left-1 after:transition-all" />
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-white">
              <div>
                <h3 className="text-sm font-medium text-ink">Require parent note for excused absences</h3>
                <p className="mt-0.5 text-xs text-body">
                  A written note from a parent or guardian is required to mark a student as excused.
                </p>
              </div>
              <label className="relative inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.requireParentNoteForExcused}
                  onChange={(event) =>
                    setPolicy((p) => ({ ...p, requireParentNoteForExcused: event.target.checked }))
                  }
                  className="rounded border-line bg-white text-secondary focus:border-secondary focus:ring-2 focus:ring-secondary-soft"
                />
                <span className="block h-5 w-9 rounded-full border border-line bg-white transition-colors peer-checked:bg-secondary peer-checked:after:translate-x-full peer-checked:after:border-white">
                  <span className="peer-checked:after:translate-x-full peer-checked:after:border-white after:block after:w-3 after:h-3 after:bg-current after:rounded-full after:border border-line after:bg-white after:top-1 after:left-1 after:transition-all" />
                </span>
              </label>
            </div>

            <div>
              <label htmlFor="late-threshold" className="text-sm font-medium text-primary block mb-2">
                Late arrival threshold (minutes)
              </label>
              <input
                id="late-threshold"
                type="number"
                min="0"
                max="120"
                value={policy.lateThresholdMinutes}
                onChange={(event) =>
                  setPolicy((p) => ({ ...p, lateThresholdMinutes: Number(event.target.value) || 0 }))
                }
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
              />
            </div>

            <div className="pt-4 flex items-center gap-3 justify-between">
              {saved ? (
                <div className="flex items-center gap-2 text-sm text-secondary-strong">
                  <span className="size-4 shrink-0 flex items-center justify-center rounded-full bg-secondary-soft text-secondary-strong">
                    ✓
                  </span>
                  <span>Policy preferences saved</span>
                </div>
              ) : null}
              <p className="text-xs text-body">
                Saving attendance policy preferences requires a backend endpoint that is not yet available.
                Changes above are held locally and will not be persisted.
              </p>
              <Button type="submit" variant="primary" isLoading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

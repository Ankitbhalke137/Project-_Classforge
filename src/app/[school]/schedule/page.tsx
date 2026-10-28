"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireArea } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import { useApi, useCanPerform, useMembership, useRole } from "@/lib/hooks";
import type {
  SchoolClass,
  Subject,
  TeachingAssignment,
  TimetablePeriod,
  TimetableSlot,
} from "@/types";
import { WEEKDAYS } from "@/types";

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <Schedule />
    </Suspense>
  );
}

function Schedule() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const searchParams = useSearchParams();
  const role = useRole();
  const canManage = useCanPerform("manageClasses");

  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const periods = useApi(() => schoolApi.listTimetablePeriods(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);

  const sectionRows = (classes.data ?? []).filter((row) => row.section);
  const requested = searchParams.get("class");
  const [sectionId, setSectionId] = useState(requested ?? "");
  const currentId = sectionId || sectionRows[0]?.id || "";

  const currentClass = sectionRows.find((row) => row.id === currentId) ?? null;

  const slots = useApi(
    () => (currentId ? schoolApi.getClassTimetable(schoolSlug, currentId) : Promise.resolve([])),
    [schoolSlug, currentId],
  );
  const assignments = useApi(
    () =>
      currentId && role !== "STUDENT"
        ? schoolApi.listTeachingAssignments(schoolSlug, { sectionId: currentId })
        : Promise.resolve([] as TeachingAssignment[]),
    [schoolSlug, currentId, role],
  );

  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (classes.loading) {
    return (
      <RequireArea area="schedule">
        <TableSkeleton rows={8} columns={7} />
      </RequireArea>
    );
  }

  return (
    <RequireArea area="schedule">
      <div className="space-y-6">
        <PageHeader
          eyebrow={currentClass ? currentClass.name : "Weekly timetable"}
          title="Schedule"
          description="One week at a time, per class. Period times come from the school's academic settings."
          action={
            canManage && currentClass ? (
              <Button onClick={() => setEditing(true)}>Edit timetable</Button>
            ) : null
          }
        />

        {notice ? (
          <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-secondary-strong">
            {notice}
          </p>
        ) : null}

        {sectionRows.length === 0 ? (
          <Card>
            <EmptyState
              title="No classes to schedule"
              description="Create a class and at least one section before building a timetable."
              action={
                canManage ? (
                  <Link
                    href={`/${schoolSlug}/classes`}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-strong"
                  >
                    Go to classes
                  </Link>
                ) : null
              }
            />
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <label className="block max-w-sm">
                <span className="mb-1.5 block text-sm font-medium text-ink">Class</span>
                <select
                  value={currentId}
                  onChange={(event) => {
                    setSectionId(event.target.value);
                    setNotice(null);
                  }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
                >
                  {sectionRows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            </Card>

            <Card className="p-4">
              {periods.loading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : (periods.data ?? []).length === 0 ? (
                <EmptyState
                  title="No periods defined"
                  description="Add the school day's periods in Settings → Academic settings, then come back."
                  action={
                    canManage ? (
                      <Link
                        href={`/${schoolSlug}/settings`}
                        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-strong"
                      >
                        Open academic settings
                      </Link>
                    ) : null
                  }
                />
              ) : slots.loading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : slots.error ? (
                <p className="py-8 text-center text-sm text-danger-600">
                  Could not load this timetable.
                </p>
              ) : (
                <WeeklyGrid
                  slots={slots.data ?? []}
                  periods={periods.data ?? []}
                  subjects={subjects.data ?? []}
                  assignments={assignments.data ?? []}
                />
              )}
            </Card>
          </>
        )}
      </div>

      {editing && currentClass ? (
        <TimetableEditor
          schoolSlug={schoolSlug}
          section={currentClass}
          slots={slots.data ?? []}
          periods={periods.data ?? []}
          subjects={(subjects.data ?? []).filter(
            (subject) => subject.classId === (currentClass.classId ?? currentClass.id),
          )}
          assignments={assignments.data ?? []}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice("Timetable saved.");
            slots.reload();
          }}
        />
      ) : null}
    </RequireArea>
  );
}

function WeeklyGrid({
  slots,
  periods,
  subjects,
  assignments,
}: {
  slots: TimetableSlot[];
  periods: TimetablePeriod[];
  subjects: Subject[];
  assignments: TeachingAssignment[];
}) {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const teacherByAssignment = new Map(
    assignments.map((assignment) => [assignment.subjectId, assignment.teacherName]),
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Period</TH>
            {WEEKDAYS.map((day) => (
              <TH key={day}>{day.slice(0, 3)}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {periods.map((period) => (
            <TR key={period.id}>
              <TD className="whitespace-nowrap align-top">
                <span className="block font-medium text-ink">{period.period}</span>
                <span className="block text-[11px] text-body">
                  {period.startTime}–{period.endTime}
                </span>
                {period.label ? (
                  <span className="block text-[11px] text-muted">{period.label}</span>
                ) : null}
              </TD>
              {WEEKDAYS.map((day) => {
                const slot = slots.find(
                  (row) => row.day === day && row.period === period.period,
                );
                const subject = slot ? subjectById.get(slot.subjectId) : null;
                return (
                  <TD key={day} className="min-w-28 align-top">
                    {subject ? (
                      <>
                        <span className="block font-medium text-ink">
                          {subject.code || subject.name}
                        </span>
                        <span className="block text-xs text-body">
                          {teacherByAssignment.get(subject.id) || "Teacher not assigned"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function TimetableEditor({
  schoolSlug,
  section,
  slots,
  periods,
  subjects,
  assignments,
  onClose,
  onSaved,
}: {
  schoolSlug: string;
  section: SchoolClass;
  slots: TimetableSlot[];
  periods: TimetablePeriod[];
  subjects: Subject[];
  assignments: TeachingAssignment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useMemo(() => {
    const grid: Record<string, string> = {};
    for (const slot of slots) grid[`${slot.day}:${slot.period}`] = slot.subjectId;
    return grid;
  }, [slots]);

  const [grid, setGrid] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A timetable slot needs a teacher. The class's teaching assignments already
  // say who takes each subject, so the editor does not ask for it twice.
  const teacherForSubject = new Map(
    assignments.map((assignment) => [assignment.subjectId, assignment.teacherId]),
  );
  const unassignedSubjects = new Set(
    subjects.filter((subject) => !teacherForSubject.has(subject.id)).map((subject) => subject.id),
  );

  async function save() {
    setBusy(true);
    setError(null);

    const payload: {
      day: string;
      period: number;
      subjectId: string;
      teacherId: string;
    }[] = [];

    for (const [key, subjectId] of Object.entries(grid)) {
      if (!subjectId) continue;
      const [day, periodText] = key.split(":");
      const teacherId = teacherForSubject.get(subjectId);
      if (!teacherId) {
        const subject = subjects.find((row) => row.id === subjectId);
        setError(
          `Assign a teacher to ${subject?.name ?? "that subject"} in Classes before timetabling it.`,
        );
        setBusy(false);
        return;
      }
      payload.push({ day, period: Number(periodText), subjectId, teacherId });
    }

    try {
      await schoolApi.saveClassTimetable(schoolSlug, section.id, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this timetable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Timetable · ${section.name}`}
      description="Pick a subject in each slot. The teacher comes from the class's subject assignments."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={busy}>
            Save timetable
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {error}
          </p>
        ) : null}

        {subjects.length === 0 ? (
          <p className="text-sm text-body">
            Add subjects to this class first, then assign a teacher to each.
          </p>
        ) : unassignedSubjects.size > 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {unassignedSubjects.size} subject{unassignedSubjects.size === 1 ? "" : "s"} still
            need a teacher. Assign them in Classes → Teachers before using those subjects here.
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-line bg-page px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-body">
                  Period
                </th>
                {WEEKDAYS.map((day) => (
                  <th
                    key={day}
                    className="border border-line bg-page px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-body"
                  >
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td className="border border-line px-2 py-1.5 align-top">
                    <span className="block font-medium text-ink">{period.period}</span>
                    <span className="block text-[11px] text-body">
                      {period.startTime}–{period.endTime}
                    </span>
                  </td>
                  {WEEKDAYS.map((day) => {
                    const key = `${day}:${period.period}`;
                    return (
                      <td key={day} className="border border-line p-1">
                        <select
                          value={grid[key] ?? ""}
                          onChange={(event) =>
                            setGrid((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="w-full rounded-md border border-line bg-white px-1.5 py-1.5 text-xs text-ink focus:border-secondary focus:outline-none"
                        >
                          <option value="">—</option>
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.code || subject.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

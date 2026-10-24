"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useSchoolCalendar } from "@/lib/hooks";
import { WEEKDAYS } from "@/types";
import type { Subject, TimetableSlot } from "@/types";

/**
 * The student's own class.
 *
 * /classes and /subjects are scoped on the server to the student's active
 * section, so this screen cannot list another class even if the UI is bypassed.
 * The timetable route additionally checks that the section belongs to the
 * signed-in student.
 */
export function StudentClasses() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const { identity, loading } = useIdentity();
  const student = identity?.student ?? null;
  const { calendar } = useSchoolCalendar();

  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);
  const timetable = useApi(
    () =>
      student?.classId
        ? schoolApi.getClassTimetable(schoolSlug, student.classId)
        : Promise.resolve([]),
    [schoolSlug, student?.classId],
  );

  const ownClass = (classes.data ?? []).find((row) => row.id === student?.classId);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-body">Loading your class…</p>
      </Card>
    );
  }

  if (!student) {
    return (
      <Card>
        <EmptyState
          title="No student record linked"
          description="Ask the school office to connect your account to your student record."
        />
      </Card>
    );
  }

  const subjectName = (subjectId: string) =>
    subjects.data?.find((subject) => subject.id === subjectId)?.name ?? "Subject";

  const periodOf = (period: number) =>
    calendar?.periods.find((row) => row.period === period);

  const slotsByDay = new Map(
    WEEKDAYS.map((day) => [
      day,
      (timetable.data ?? [])
        .filter((slot) => slot.day === day)
        .sort((a, b) => a.period - b.period),
    ]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My class</h1>
        <p className="mt-1 text-sm text-body">
          Your section, the subjects you take, and your weekly timetable.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-ink">
              {ownClass?.name ?? student.className ?? "No class assigned"}
            </p>
            <p className="mt-1 text-sm text-body">
              {ownClass?.room ? `Room ${ownClass.room}` : "Room not set"} ·{" "}
              {ownClass?.homeroomTeacherName
                ? `Homeroom ${ownClass.homeroomTeacherName}`
                : "Homeroom teacher not set"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Admission {student.admissionNo} · {student.name}
            </p>
          </div>
          <div className="text-right text-sm text-body">
            <p className="font-semibold text-ink">{subjects.data?.length ?? 0} subjects</p>
            <p className="text-xs">Academic year {ownClass?.academicYear?.name ?? "—"}</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Subjects</h2>
          <p className="mt-1 text-xs text-body">Everything taught to your class.</p>
        </div>
        {(subjects.data ?? []).length === 0 ? (
          <p className="px-5 py-5 text-sm text-body">No subjects have been added yet.</p>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {(subjects.data ?? []).map((subject) => (
              <SubjectTile key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Weekly timetable</h2>
          <p className="mt-1 text-xs text-body">Your section&apos;s scheduled periods.</p>
        </div>
        {(timetable.data ?? []).length === 0 ? (
          <p className="px-5 py-5 text-sm text-body">
            The timetable for your class has not been published yet.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {WEEKDAYS.map((day) => {
              const slots = slotsByDay.get(day) ?? [];
              if (slots.length === 0) return null;
              return (
                <div key={day} className="px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {day[0]}
                    {day.slice(1).toLowerCase()}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {slots.map((slot) => (
                      <TimetableLine
                        key={slot.id}
                        slot={slot}
                        subject={subjectName(slot.subjectId)}
                        period={periodOf(slot.period)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function SubjectTile({ subject }: { subject: Subject }) {
  return (
    <div className="rounded-xl border border-line bg-page px-4 py-3">
      <p className="text-sm font-semibold text-ink">{subject.name}</p>
      <p className="mt-0.5 text-xs text-body">
        {subject.code || "No code"}
      </p>
    </div>
  );
}

function TimetableLine({
  slot,
  subject,
  period,
}: {
  slot: TimetableSlot;
  subject: string;
  period: { label: string; startTime: string; endTime: string } | undefined;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="font-medium text-ink">{subject}</span>
      <span className="text-xs text-body">
        {period
          ? `${period.label} · ${period.startTime} – ${period.endTime}`
          : `Period ${slot.period}`}
      </span>
    </li>
  );
}

"use client";

import { useMemo, useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useRole } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import type {
  AttendanceStatus,
  AttendanceSummary,
  AttendanceTrendPoint,
  Student,
  StudentAttendance,
} from "@/types";
import { ATTENDANCE_STATUSES } from "@/types";

/** Present, absent, late, excused — the four the register can hold. */
const STATUS_TONE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-600 text-white",
  ABSENT: "bg-red-600 text-white",
  LATE: "bg-amber-500 text-white",
  EXCUSED: "bg-slate-500 text-white",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

export default function AttendancePage() {
  const role = useRole();
  const isStaff = role === "SCHOOL_ADMIN" || role === "TEACHER";

  return (
    <RequireArea area="attendance">
      {isStaff ? <MarkRegister /> : <OwnAttendance />}
    </RequireArea>
  );
}

/* ------------------------------------------------------------------ *
 * Staff — mark the register for one class on one day
 * ------------------------------------------------------------------ */

function MarkRegister() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const rows = classes.data ?? [];
  const activeId = classId || (rows[0]?.id ?? "");

  // The whole school on one day, so a form teacher can see how the day is going.
  const daySheet = useApi(() => schoolApi.getDaySheet(schoolSlug, { date }), [schoolSlug, date]);
  const trend = useApi(() => schoolApi.getAttendanceTrend(schoolSlug, { days: 14 }), [schoolSlug]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark the register for a section, and see how the school as a whole is doing today."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TrendStat trend={trend.data ?? []} />
        <DayStat summaries={daySheet.data ?? []} date={date} />
      </div>

      <Card>
        <CardHeader
          title="Mark the register"
          description="Untouched students are saved as present."
        />
        <div className="grid gap-4 border-b border-slate-200 p-4 sm:grid-cols-2">
          <Select
            label="Class"
            value={activeId}
            onChange={(event) => setClassId(event.target.value)}
            options={
              rows.length === 0
                ? [{ value: "", label: "No classes" }]
                : rows.map((item) => ({ value: item.id, label: item.name }))
            }
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="attendance-date" className="text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
            />
          </div>
        </div>

        {activeId ? (
          // Remounting on a new class or day is what resets the draft.
          <RegisterEditor
            key={`${activeId}:${date}`}
            schoolSlug={schoolSlug}
            classId={activeId}
            date={date}
            onSaved={() => {
              daySheet.reload();
              trend.reload();
            }}
          />
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Day sheet" description={`Every class on ${date}.`} />
          {daySheet.loading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Class</TH>
                  <TH>Present</TH>
                  <TH>Absent</TH>
                  <TH>Late</TH>
                </TR>
              </THead>
              <TBody>
                {(daySheet.data ?? []).map((summary) => (
                  <TR key={summary.classId}>
                    <TD className="font-medium text-slate-900">{summary.className}</TD>
                    <TD>{summary.present}</TD>
                    <TD>{summary.absent}</TD>
                    <TD>{summary.late}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Last 14 school days" description="Present as a percentage of the roll." />
          <CardBody>
            <TrendBars points={trend.data ?? []} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/**
 * One class on one day.
 *
 * `draft` starts null and the register from the server is shown until the first
 * edit, so there is no effect syncing two states together. Saving drops the
 * draft back to null, which is what pulls in whatever the server now holds.
 */
function RegisterEditor({
  schoolSlug,
  classId,
  date,
  onSaved,
}: {
  schoolSlug: string;
  classId: string;
  date: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, AttendanceStatus> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useApi(
    () => schoolApi.getRegister(schoolSlug, { classId, date }),
    [schoolSlug, classId, date],
  );

  const students = register.data?.students ?? [];
  const fromServer = Object.fromEntries(
    (register.data?.records ?? []).map((row) => [row.studentId, row.status]),
  );
  const marked = draft ?? fromServer;

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await schoolApi.markAttendance(schoolSlug, {
        date,
        classId,
        records: students.map((student) => ({
          studentId: student.id,
          // Anyone the teacher did not touch counts as present.
          status: marked[student.id] ?? "PRESENT",
        })),
      });
      setDraft(null);
      setSaved(true);
      register.reload();
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the register.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setDraft(Object.fromEntries(students.map((student) => [student.id, "PRESENT"])))
          }
          disabled={students.length === 0}
        >
          Mark all present
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setDraft({})}
          disabled={draft === null || Object.keys(draft).length === 0}
        >
          Reset
        </Button>
        <span className="ml-auto flex items-center gap-3">
          {error ? (
            <span className="text-xs text-red-600">{error}</span>
          ) : saved ? (
            <span className="text-xs text-emerald-600">Saved</span>
          ) : null}
          <Button size="sm" onClick={onSave} isLoading={saving} disabled={students.length === 0}>
            Save register
          </Button>
        </span>
      </div>

      {register.loading ? (
        <TableSkeleton rows={6} columns={3} />
      ) : students.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          This class has nobody active on the roll.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Student</TH>
              <TH>Admission no.</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {students.map((student) => (
              <TR key={student.id}>
                <TD className="font-medium text-slate-900">{student.name}</TD>
                <TD>{student.admissionNo}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {ATTENDANCE_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setDraft({ ...marked, [student.id]: status } satisfies Record<
                            string,
                            AttendanceStatus
                          >)
                        }
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          (marked[student.id] ?? "PRESENT") === status
                            ? STATUS_TONE[status]
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Students and parents — my own record
 * ------------------------------------------------------------------ */

function OwnAttendance() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const { identity, loading: loadingIdentity } = useIdentity();
  const [studentId, setStudentId] = useState("");

  const people = useMemo(() => {
    if (!identity) return [] as Student[];
    if (identity.children.length > 0) return identity.children;
    return identity.student ? [identity.student] : [];
  }, [identity]);

  const activeId = studentId || people[0]?.id || "";

  const record = useApi(
    () =>
      // The identity request has not come back yet, so there is no student id
      // to ask about. Calling the API with an empty id builds
      // `/students//attendance`, which the route matches as `/students/attendance`
      // and rejects with a 404 — noise on every visit to this page.
      activeId
        ? schoolApi.getStudentAttendance(schoolSlug, activeId, { days: 30 })
        : Promise.resolve<StudentAttendance>({
            studentId: "",
            records: [],
            summary: { total: 0, present: 0, absent: 0, late: 0, excused: 0, percentage: 0 },
          }),
    [schoolSlug, activeId],
  );

  if (loadingIdentity) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" />
        <TableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" description="Your attendance record." />
        <Card>
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No student record is linked to this account yet.
          </div>
        </Card>
      </div>
    );
  }

  const summary = record.data?.summary;
  const person = people.find((student) => student.id === activeId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Your record over the last 30 school days."
        action={
          people.length > 1 ? (
            <div className="w-56">
              <Select
                label="Student"
                value={activeId}
                onChange={(event) => setStudentId(event.target.value)}
                options={people.map((student) => ({ value: student.id, label: student.name }))}
              />
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Attendance"
          value={summary ? `${summary.percentage}%` : "—"}
          tone={summary && summary.percentage >= 75 ? "positive" : "warning"}
          hint={person ? `${person.className}` : undefined}
        />
        <StatCard label="Present" value={summary?.present ?? 0} />
        <StatCard label="Absent" value={summary?.absent ?? 0} tone="negative" />
        <StatCard label="Late" value={summary?.late ?? 0} tone="warning" />
        <StatCard label="Excused" value={summary?.excused ?? 0} />
      </div>

      <Card>
        <CardHeader title="Day by day" description="Most recent first." />
        {record.loading ? (
          <TableSkeleton rows={8} columns={3} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Class</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {(record.data?.records ?? []).map((row) => (
                <TR key={row.id}>
                  <TD>{row.date}</TD>
                  <TD>{row.className}</TD>
                  <TD>
                    <Badge
                      tone={
                        row.status === "PRESENT"
                          ? "green"
                          : row.status === "ABSENT"
                            ? "red"
                            : row.status === "LATE"
                              ? "amber"
                              : "neutral"
                      }
                    >
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function TrendStat({ trend }: { trend: AttendanceTrendPoint[] }) {
  const marked = trend.filter((point) => point.marked > 0);
  const average =
    marked.length === 0
      ? 0
      : Math.round(marked.reduce((sum, point) => sum + point.percentage, 0) / marked.length);

  return <StatCard label="Attendance, 14 days" value={`${average}%`} tone="positive" />;
}

function DayStat({ summaries, date }: { summaries: AttendanceSummary[]; date: string }) {
  const totals = summaries.reduce(
    (sum, summary) => ({
      present: sum.present + summary.present,
      absent: sum.absent + summary.absent,
      late: sum.late + summary.late,
      total: sum.total + summary.total,
    }),
    { present: 0, absent: 0, late: 0, total: 0 },
  );

  const percentage = totals.total === 0 ? 0 : Math.round((totals.present / totals.total) * 100);

  return (
    <StatCard
      label="Today"
      value={`${percentage}%`}
      hint={`${formatNumber(totals.present)} present, ${formatNumber(totals.absent)} absent · ${date}`}
      tone={percentage >= 90 ? "positive" : "warning"}
    />
  );
}

/** A plain bar chart — no chart library needed for one series. */
function TrendBars({ points }: { points: AttendanceTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No registers have been marked yet.</p>;
  }

  return (
    <div className="flex h-40 items-end gap-1">
      {points.map((point) => (
        <div key={point.date} className="group flex flex-1 flex-col items-center gap-1">
          <div
            title={`${point.date}: ${point.percentage}% of ${point.marked}`}
            className="w-full rounded-t bg-brand-500/80"
            style={{ height: `${Math.max(point.percentage, 2)}%` }}
          />
          <span className="text-[10px] text-slate-400">{point.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Badge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { AttendanceIcon, BookIcon, ExamsIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/states";
import { schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useSchoolCalendar } from "@/lib/hooks";
import { schoolHref } from "@/lib/nav";
import { weekdayOf } from "@/lib/schedule";
import { cn, formatDate } from "@/lib/utils";
import type { Announcement, AttendanceStatus, Grade, TimetableSlot } from "@/types";

const STATUS_TONE: Record<AttendanceStatus, "green" | "red" | "amber" | "neutral"> = {
  PRESENT: "green",
  ABSENT: "red",
  LATE: "amber",
  EXCUSED: "neutral",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

const GRADE_TONE: Record<Grade, "green" | "brand" | "amber" | "red" | "neutral"> = {
  "A+": "green",
  A: "green",
  "B+": "brand",
  B: "brand",
  C: "amber",
  D: "amber",
  E: "red",
};

/**
 * The student's own landing screen.
 *
 * Every request is identity-scoped: attendance is this student's record, results
 * are only published papers for their section, the timetable is their own
 * section, and the announcements endpoint filters to student audiences. Nothing
 * here can be pointed at another family's data.
 */
export function StudentDashboard() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const schoolName = useMembership()?.schoolName ?? "your school";
  const { identity, loading } = useIdentity();
  const student = identity?.student ?? null;
  const { calendar } = useSchoolCalendar();

  const today = new Date();
  const day = weekdayOf(today);

  const attendance = useApi(
    () =>
      student
        ? schoolApi.getStudentAttendance(schoolSlug, student.id)
        : Promise.resolve(null),
    [schoolSlug, student?.id],
  );
  const results = useApi(() => schoolApi.getMyResults(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);
  const announcements = useApi(
    () => schoolApi.listAnnouncements(schoolSlug, { page: 1 }),
    [schoolSlug],
  );
  const timetable = useApi(
    () =>
      student?.classId
        ? schoolApi.getClassTimetable(schoolSlug, student.classId)
        : Promise.resolve([]),
    [schoolSlug, student?.classId],
  );

  const summary = attendance.data?.summary;
  const records = attendance.data?.records ?? [];
  const published = results.data?.results ?? [];
  const graded = published.filter((row) => row.percentage !== null);
  const average =
    graded.length > 0
      ? Math.round(
          graded.reduce((sum, row) => sum + (row.percentage ?? 0), 0) / graded.length,
        )
      : null;

  const slots = (timetable.data ?? [])
    .filter((slot) => slot.day === day)
    .sort((a, b) => a.period - b.period);

  const subjectName = (subjectId: string) =>
    subjects.data?.find((subject) => subject.id === subjectId)?.name ?? "Subject";

  const periodOf = (period: number) =>
    calendar?.periods.find((row) => row.period === period);

  const firstName = student?.name.split(" ")[0] ?? "there";

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-body">Loading your dashboard…</p>
      </Card>
    );
  }

  if (!student) {
    return (
      <Card>
        <EmptyState
          title="No student record linked"
          description="Your account is active, but the school has not connected it to a student record yet. Ask the school office to check the email on your admission record."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My dashboard</h1>
          <p className="mt-1 text-sm text-body">
            Hello, {firstName}. Here is your class, attendance and results at a glance.
          </p>
        </div>
        <div className="text-right text-sm text-body">
          <p>{new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(today)}</p>
          <p className="text-xs">{schoolName}</p>
        </div>
      </div>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={student.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{student.name}</p>
          <p className="mt-0.5 text-sm text-body">
            {student.className || "No class assigned"} · Admission {student.admissionNo}
          </p>
          <p className="mt-0.5 text-xs text-muted">{student.email}</p>
        </div>
        <Link
          href={schoolHref(schoolSlug, "classes")}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          View my class
        </Link>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance"
          value={summary?.percentage != null ? `${summary.percentage}%` : "—"}
          hint={
            summary
              ? `${summary.present + summary.late} present of ${summary.total} marked days`
              : "No attendance marked yet"
          }
          icon={<AttendanceIcon width={20} height={20} />}
          tone={
            summary?.percentage != null && summary.percentage < 75 ? "warning" : "default"
          }
        />
        <StatCard
          label="Present days"
          value={summary?.present ?? 0}
          hint={summary ? `${summary.late} late · ${summary.absent} absent` : undefined}
          icon={<AttendanceIcon width={20} height={20} />}
        />
        <StatCard
          label="Published results"
          value={published.length}
          hint={published.length > 0 ? "Released by your teachers" : "Nothing published yet"}
          icon={<ExamsIcon width={20} height={20} />}
        />
        <StatCard
          label="Average score"
          value={average != null ? `${average}%` : "—"}
          hint={graded.length > 0 ? `Across ${graded.length} papers` : "Waiting for marks"}
          icon={<BookIcon width={20} height={20} />}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Today's timetable"
          description={day ? `${day[0]}${day.slice(1).toLowerCase()}'s periods` : "No school day"}
          href={schoolHref(schoolSlug, "schedule")}
          linkLabel="Full timetable"
        >
          {slots.length === 0 ? (
            <SoftEmpty>No periods scheduled for your class today.</SoftEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {slots.map((slot) => (
                <TimetableRow
                  key={slot.id}
                  slot={slot}
                  subject={subjectName(slot.subjectId)}
                  period={periodOf(slot.period)}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent attendance"
          href={schoolHref(schoolSlug, "attendance")}
          linkLabel="View all"
        >
          {records.length === 0 ? (
            <SoftEmpty>No attendance recorded yet.</SoftEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {records.slice(0, 5).map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-ink">{formatDate(record.date)}</span>
                  <Badge tone={STATUS_TONE[record.status]}>
                    {STATUS_LABEL[record.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="My results"
          description="Only papers your teacher has published"
          href={schoolHref(schoolSlug, "exams")}
          linkLabel="View all"
        >
          {published.length === 0 ? (
            <SoftEmpty>No results have been published yet.</SoftEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {published.slice(0, 6).map((row) => (
                <li
                  key={row.examId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {row.examName} · {row.subjectName}
                    </span>
                    <span className="mt-0.5 block text-xs text-body">
                      {formatDate(row.date)}
                      {row.term ? ` · ${row.term}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-ink">
                      {row.marksObtained ?? "—"} / {row.maxMarks}
                    </span>
                    <span className="mt-0.5 block text-xs text-body">
                      {row.percentage != null ? `${row.percentage}%` : "Not marked"}
                    </span>
                  </span>
                  {row.grade ? (
                    <Badge tone={GRADE_TONE[row.grade]}>{row.grade}</Badge>
                  ) : (
                    <Badge tone="neutral">—</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Announcements"
          href={schoolHref(schoolSlug, "announcements")}
          linkLabel="View all"
          description="Notices for you and your class"
        >
          {(announcements.data?.data ?? []).length === 0 ? (
            <SoftEmpty>No announcements yet.</SoftEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {(announcements.data?.data ?? []).slice(0, 3).map((notice) => (
                <AnnouncementRow key={notice.id} notice={notice} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * Guardians have no linked children yet — the schema has no guardian table, and
 * /me deliberately returns an empty list rather than guessing. The empty state
 * is the honest screen until that link exists.
 */
export function ParentDashboard() {
  const { identity, loading } = useIdentity();
  const children = identity?.children ?? [];

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-body">Loading your dashboard…</p>
      </Card>
    );
  }

  if (children.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No child linked yet"
          description="The school has not linked a student to this parent account. Ask the school office to connect your email to your child's record."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">My children</h1>
      {children.map((child) => (
        <Card key={child.id} className="flex flex-wrap items-center gap-4 p-5">
          <Avatar name={child.name} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{child.name}</p>
            <p className="text-sm text-body">
              {child.className || "No class"} · {child.admissionNo}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function Panel({
  title,
  description,
  href,
  linkLabel,
  className,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-xs text-body">{description}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function SoftEmpty({ children }: { children: ReactNode }) {
  return <p className="px-5 pb-5 text-sm text-body">{children}</p>;
}

function TimetableRow({
  slot,
  subject,
  period,
}: {
  slot: TimetableSlot;
  subject: string;
  period: { label: string; startTime: string; endTime: string } | undefined;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{subject}</span>
        <span className="mt-0.5 block text-xs text-body">
          {period ? `${period.startTime} – ${period.endTime}` : `Period ${slot.period}`}
        </span>
      </span>
      <Badge tone="neutral">{period?.label ?? `Period ${slot.period}`}</Badge>
    </li>
  );
}

function AnnouncementRow({ notice }: { notice: Announcement }) {
  return (
    <li className="px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-600">
          {notice.priority === "URGENT" ? "Urgent" : "Notice"}
        </p>
        {notice.pinned ? <Badge tone="amber">Pinned</Badge> : null}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink">{notice.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-body">{notice.body}</p>
      <p className="mt-2 text-xs text-muted">
        {notice.authorName} · {formatDate(notice.publishedAt)}
      </p>
    </li>
  );
}

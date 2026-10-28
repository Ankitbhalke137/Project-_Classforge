"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import {
  ArrowRightIcon,
  AssignmentsIcon,
  AttendanceIcon,
  BookIcon,
  ClipboardIcon,
  ShieldCheckIcon,
  StudentsIcon,
} from "@/components/ui/icons";
import { schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useSchoolCalendar } from "@/lib/hooks";
import { schoolHref } from "@/lib/nav";
import { currentTerm, isoDate, weekdayOf, type TermWindow } from "@/lib/schedule";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type {
  Announcement,
  AssignmentListRow,
  AttendanceSummary,
  Exam,
  SchoolCalendar,
  SchoolClass,
  TimetableSlot,
} from "@/types";

/** The API returns terms as startDate/endDate; the calendar helpers want startsOn/endsOn. */
function calendarTerms(calendar: SchoolCalendar | null): TermWindow[] {
  return (calendar?.terms ?? []).map((term) => ({
    label: term.label,
    startsOn: term.startDate,
    endsOn: term.endDate,
  }));
}

/** The wall-clock times of one teaching period, as the school set them. */
function findPeriod(
  periods: SchoolCalendar["periods"],
  period: number,
): SchoolCalendar["periods"][number] | undefined {
  return periods.find((row) => row.period === period);
}

/**
 * The landing screen for a teacher: the shape of their day, what is still
 * unmarked, and what is coming. Everything is derived from the signed-in
 * teacher's own class ids, so two teachers on the same school see their own
 * version of it.
 */
export function TeacherDashboard() {
  const router = useRouter();
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const schoolName = useMembership()?.schoolName ?? "your school";
  const email = useAuth((state) => state.user?.email) ?? "";
  const { identity } = useIdentity();
  const teacher = identity?.teacher ?? null;

  const today = new Date();
  const date = isoDate(today);
  const day = weekdayOf(today);
  const { calendar } = useSchoolCalendar();
  const periods = calendar?.periods ?? [];
  const classKey = teacher?.classIds.join(",") ?? "";

  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);
  const daySheet = useApi(() => schoolApi.getDaySheet(schoolSlug, { date }), [schoolSlug, date]);
  const assignments = useApi(
    // Filtered on the server: the list is paginated, so narrowing it here would
    // only ever look at the first page.
    () => schoolApi.listAssignments(schoolSlug, { page: 1, mine: true, email, status: "OPEN" }),
    [schoolSlug, email],
  );
  const exams = useApi(
    () => schoolApi.listExams(schoolSlug, { page: 1, status: "SCHEDULED" }),
    [schoolSlug],
  );
  const announcements = useApi(() => schoolApi.listAnnouncements(schoolSlug, { page: 1 }), [
    schoolSlug,
  ]);

  // One request per assigned class; the timetable endpoint is per class.
  const timetable = useApi(async () => {
    const ids = teacher?.classIds ?? [];
    const perClass = await Promise.all(
      ids.map((classId) => schoolApi.getClassTimetable(schoolSlug, classId)),
    );
    return perClass.flat();
  }, [schoolSlug, classKey]);

  const allClasses: SchoolClass[] = classes.data ?? [];
  const myClasses = allClasses.filter((item) => teacher?.classIds.includes(item.id));
  const className = (classId: string) =>
    allClasses.find((item) => item.id === classId)?.name ?? "Class";
  const subjectName = (subjectId: string) =>
    subjects.data?.find((item) => item.id === subjectId)?.name ?? "Subject";

  /* --- Today's periods --- */
  const slots: TimetableSlot[] = (timetable.data ?? [])
    .filter((slot) => slot.day === day && slot.teacherId === teacher?.id)
    .sort((a, b) => a.period - b.period);

  const statusByPeriod = periodStatuses(slots, today, periods);

  /* --- Today's registers --- */
  const myClassIds = new Set(myClasses.map((item) => item.id));
  const registers = (daySheet.data ?? []).filter((summary) => myClassIds.has(summary.classId));
  const pending = registers.filter((summary) => !isRegisterMarked(summary));
  const submitted = registers.length - pending.length;

  /* --- Open work --- */
  const openAssignments = dedupeById(assignments.data?.data ?? [])
    .filter((item) => item.status === "OPEN")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcomingExams = dedupeById(exams.data?.data ?? [])
    .filter((exam) => new Date(`${exam.date}T00:00:00`) >= startOfDay(today))
    .sort((a, b) => a.date.localeCompare(b.date));

  const timeline: TimelineEntry[] = [
    ...openAssignments.map((row) => ({ kind: "assignment" as const, date: row.dueDate, row })),
    ...upcomingExams.map((exam) => ({ kind: "exam" as const, date: exam.date, exam })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const totalStudents = myClasses.reduce((sum, item) => sum + item.studentCount, 0);
  const firstName = useAuth.getState().user?.name.split(" ")[0] ?? "";

  const scopeLine = [
    teacher?.subject,
    ...myClasses.map((item) => `${item.name} (${item.studentCount})`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeading firstName={firstName} calendar={calendar} />

      {/* Scope banner — a teacher only ever sees their own classes. */}
      {myClasses.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-brand-50 px-4 py-3">
          <ShieldCheckIcon width={18} height={18} className="shrink-0 text-brand-600" />
          <span className="text-sm font-semibold text-ink">Only your assigned classes</span>
          <span className="text-sm text-body">{scopeLine}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assigned classes"
          value={myClasses.length}
          hint={
            myClasses.length === 0
              ? "—"
              : `${teacher?.subject ?? ""} · ${summarise(myClasses.map((item) => item.name))}`
          }
          icon={<BookIcon width={20} height={20} />}
        />
        <StatCard
          label="Total students"
          value={totalStudents}
          hint={
            myClasses.length > 0
              ? `Across your ${myClasses.length} assigned classes`
              : "No classes assigned yet"
          }
          icon={<StudentsIcon width={20} height={20} />}
        />
        <StatCard
          label="Pending attendance"
          value={pending.length}
          hint={pendingHint(pending, myClasses)}
          tone={pending.length > 0 ? "warning" : "default"}
          icon={<AttendanceIcon width={20} height={20} />}
        />
        <StatCard
          label="Assignments"
          value={openAssignments.length}
          hint={
            openAssignments[0]
              ? `Open · Next due ${formatDate(openAssignments[0].dueDate)}`
              : "Nothing open right now"
          }
          icon={<AssignmentsIcon width={20} height={20} />}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Today's timetable"
          href={schoolHref(schoolSlug, "attendance")}
          linkLabel="Full timetable"
          description={
            slots.length > 0
              ? `${slots.length} teaching ${slots.length === 1 ? "period" : "periods"} · ${teacher?.subject ?? ""}`
              : undefined
          }
        >
          {slots.length === 0 ? (
            <SoftEmpty>No periods scheduled for you today.</SoftEmpty>
          ) : (
            <>
              <ul>
                {slots.map((slot) => (
                  <PeriodRow
                    key={slot.id}
                    time={findPeriod(periods, slot.period)}
                    title={`${className(slot.classId)} · ${subjectName(slot.subjectId)}`}
                    subtitle={`Room ${allClasses.find((item) => item.id === slot.classId)?.room ?? "—"} · 45 minutes`}
                    status={statusByPeriod.get(slot.period) ?? "Upcoming"}
                    highlight={(statusByPeriod.get(slot.period) ?? "") === "Up next"}
                  />
                ))}
              </ul>
              {calendar?.breaks ? (
                <p className="mt-2 border-t border-line px-5 py-3 text-xs text-body">
                  {calendar.breaks}
                </p>
              ) : null}
            </>
          )}
        </Panel>

        <Panel
          title="Attendance"
          href={schoolHref(schoolSlug, "attendance")}
          linkLabel="View all"
        >
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-4">
              <ClipboardIcon width={20} height={20} className="mt-0.5 shrink-0 text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {pending.length === 0
                    ? "Every register is in"
                    : `${pending.length} ${pending.length === 1 ? "register needs" : "registers need"} your attention`}
                </p>
                <p className="mt-0.5 text-xs text-body">
                  Today · {submitted} of {registers.length} classes submitted
                </p>
              </div>
            </div>

            {registers.length === 0 ? (
              <SoftEmpty>No classes to mark today.</SoftEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {registers.map((summary) => {
                  const isMarked = isRegisterMarked(summary);
                  return (
                    <li
                      key={summary.classId}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{summary.className}</p>
                        <p className="mt-0.5 text-xs text-body">
                          {summary.total} students ·{" "}
                          {isMarked
                            ? `Submitted · ${summary.present}/${summary.total} present`
                            : "Not marked"}
                        </p>
                      </div>
                      {isMarked ? (
                        <Badge tone="green">Submitted</Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `${schoolHref(schoolSlug, "attendance")}?classId=${summary.classId}`,
                            )
                          }
                        >
                          Mark attendance
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-xs text-muted">Registers for your assigned classes only.</p>
          </div>
        </Panel>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Upcoming assignments & exams"
          href={schoolHref(schoolSlug, "assignments")}
          linkLabel="View all"
          description={`${openAssignments.length} open assignments · ${upcomingExams.length} upcoming exams`}
        >
          {timeline.length === 0 ? (
            <SoftEmpty>Nothing due in the coming weeks.</SoftEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {timeline.map((entry, index) => (
                <TimelineRow
                  key={`${entry.kind}-${entry.kind === "exam" ? entry.exam.id : entry.row.id}-${index}`}
                  entry={entry}
                  classNameOf={className}
                  subjectNameOf={subjectName}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent announcements"
          href={schoolHref(schoolSlug, "announcements")}
          linkLabel="View all"
          description={`School-wide updates · ${schoolName}`}
        >
          {(announcements.data?.data ?? []).length === 0 ? (
            <SoftEmpty>No announcements yet.</SoftEmpty>
          ) : (
            <ul className="divide-y divide-line">
              {(announcements.data?.data ?? []).slice(0, 3).map((notice) => (
                <AnnouncementRow key={notice.id} notice={notice} now={today.getTime()} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

type TimelineEntry =
  | { kind: "assignment"; date: string; row: AssignmentListRow }
  | { kind: "exam"; date: string; exam: Exam };

type SlotStatus = "Completed" | "In progress" | "Up next" | "Upcoming";

const AUDIENCE_LABELS: Record<string, string> = {
  EVERYONE: "School-wide",
  STAFF: "Staff",
  TEACHERS: "Teachers",
  STUDENTS: "Students",
  PARENTS: "Parents",
};

const PUBLISHED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const TODAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function PageHeading({
  firstName,
  calendar,
}: {
  firstName: string;
  calendar: SchoolCalendar | null;
}) {
  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const term = currentTerm(today, calendarTerms(calendar));

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Teacher Dashboard</h1>
        <p className="mt-1 text-sm text-body">
          {greeting}, {firstName}. Here&apos;s your teaching day at a glance.
        </p>
      </div>
      <div className="text-right text-sm">
        <p className="text-body">{TODAY.format(today)}</p>
        {(calendar?.academicYear || term) && (
          <p className="text-xs text-body">
            {calendar?.academicYear ? `Academic year ${calendar.academicYear.name}` : ""}
            {term ? `${calendar?.academicYear ? " · " : ""}${term.label}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

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
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {linkLabel}
            <ArrowRightIcon width={15} height={15} />
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

function PeriodRow({
  time,
  title,
  subtitle,
  status,
  highlight,
}: {
  time: SchoolCalendar["periods"][number] | undefined;
  title: string;
  subtitle: string;
  status: SlotStatus;
  highlight: boolean;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1 border-t border-line px-5 py-3.5 first:border-t-0 sm:flex-row sm:items-center sm:gap-4",
        highlight && "bg-brand-50",
      )}
    >
      <span className="text-sm font-medium text-ink sm:w-28 sm:shrink-0">
        {time?.label ?? "Period"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-body">{subtitle}</span>
      </span>
      <Badge
        className="self-start sm:self-auto"
        tone={status === "In progress" ? "amber" : status === "Upcoming" ? "neutral" : "green"}
      >
        {status}
      </Badge>
    </li>
  );
}

function TimelineRow({
  entry,
  classNameOf,
  subjectNameOf,
}: {
  entry: TimelineEntry;
  classNameOf: (classId: string) => string;
  subjectNameOf: (subjectId: string) => string;
}) {
  const date = new Date(`${entry.date}T00:00:00`);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();

  // One exam session covers every subject a class takes, so the subject is what
  // tells two rows apart.
  const title =
    entry.kind === "exam"
      ? `${entry.exam.name} · ${subjectNameOf(entry.exam.subjectId)}`
      : entry.row.title;
  const meta =
    entry.kind === "exam"
      ? `${classNameOf(entry.exam.classId)} · ${entry.exam.maxMarks} marks · ${entry.exam.term}`
      : `${classNameOf(entry.row.classId)} · ${entry.row.stats.submitted + entry.row.stats.graded} of ${submittedExpected(entry.row)} submitted`;

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50">
        <span className="text-base font-semibold leading-none text-ink">{day}</span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-body">
          {month}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-body">{meta}</span>
      </span>

      <Badge tone="neutral">{entry.kind === "exam" ? "Exam" : "Assignment"}</Badge>
    </li>
  );
}

function AnnouncementRow({ notice, now }: { notice: Announcement; now: number }) {
  const isNew = now - new Date(notice.publishedAt).getTime() < 3 * 24 * 60 * 60 * 1000;
  const audiences = notice.audience.map((item) => AUDIENCE_LABELS[item] ?? item);

  return (
    <li className="px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-600">
          {audiences.join(" · ") || "School"}
        </p>
        {isNew ? <Badge tone="green">New</Badge> : null}
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{notice.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-body">{notice.body}</p>
      <p className="mt-2 text-xs text-muted">
        {notice.authorName} · {PUBLISHED.format(new Date(notice.publishedAt))}
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Derivation helpers
 * ------------------------------------------------------------------ */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Ids are the row's identity, so a repeated id would render the same row twice. */
function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * A register counts as submitted once any student on it has a status — the day
 * sheet carries tallies, not a submitted flag.
 */
function isRegisterMarked(summary: AttendanceSummary): boolean {
  return summary.present + summary.absent + summary.late + summary.excused > 0;
}

/** Marks each period Completed / In progress / Up next / Upcoming. */
function periodStatuses(
  slots: TimetableSlot[],
  now: Date,
  periods: SchoolCalendar["periods"],
): Map<number, SlotStatus> {
  const statuses = new Map<number, SlotStatus>();
  const clock = now.getHours() * 60 + now.getMinutes();
  let nextAssigned = false;

  for (const slot of [...slots].sort((a, b) => a.period - b.period)) {
    const time = findPeriod(periods, slot.period);
    if (!time) continue;

    const start = minutesOf(time.startTime);
    const end = minutesOf(time.endTime);

    if (end <= clock) statuses.set(slot.period, "Completed");
    else if (start <= clock && clock < end) statuses.set(slot.period, "In progress");
    else if (!nextAssigned) {
      statuses.set(slot.period, "Up next");
      nextAssigned = true;
    } else statuses.set(slot.period, "Upcoming");
  }

  return statuses;
}

function pendingHint(
  pending: { classId: string }[],
  myClasses: SchoolClass[],
): string {
  if (pending.length === 0) return "All registers submitted";
  const names = pending
    .map((item) => myClasses.find((schoolClass) => schoolClass.id === item.classId)?.name)
    .filter(Boolean)
    .join(" and ");
  return `${names} · Due today`;
}

/** Keeps a stat hint to one readable line however many classes there are. */
function summarise(names: string[], limit = 3): string {
  if (names.length <= limit) return names.join(", ");
  return `${names.slice(0, limit).join(", ")} +${names.length - limit} more`;
}

/** Everyone expected to submit: the class roll, which the stats row carries. */
function submittedExpected(row: AssignmentListRow): number {
  return row.stats.submitted + row.stats.inProgress + row.stats.notStarted + row.stats.late;
}
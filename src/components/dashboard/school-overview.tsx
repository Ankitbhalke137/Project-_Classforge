"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CampusScene } from "@/components/brand/campus-scene";
import { Badge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  BadgeIcon,
  BarChartIcon,
  CalendarIcon,
  CampaignIcon,
  ClipboardCheckIcon,
  GraduationIcon,
  HistoryIcon,
  ReportsIcon,
  StudentsIcon,
  TeachersIcon,
  VerifiedIcon,
} from "@/components/ui/icons";
import { FullPageLoader } from "@/components/ui/states";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership, useRole, useSchoolCalendar } from "@/lib/hooks";
import { canPerform } from "@/lib/roles";
import { schoolHref, schoolHrefForArea } from "@/lib/nav";
import { currentTerm, type TermWindow } from "@/lib/schedule";
import { useAuth } from "@/store/auth";
import { ANNOUNCEMENT_PRIORITIES, type SchoolCalendar, type SchoolDashboard } from "@/types";
import { cn } from "@/lib/utils";

/** The API returns terms as startDate/endDate; the calendar helpers want startsOn/endsOn. */
function calendarTerms(calendar: SchoolCalendar | null): TermWindow[] {
  return (calendar?.terms ?? []).map((term) => ({
    label: term.label,
    startsOn: term.startDate,
    endsOn: term.endDate,
  }));
}

/**
 * The school-wide roll-up.
 *
 * Everything on this screen is derived from the dashboard payload and the two
 * attendance reads, so the numbers on screen are always the numbers the API
 * returned. Where the design hard-coded a figure — the "+2.4% vs last term"
 * chips on the roster and staff metrics — there is no history behind it, so
 * those cards carry a factual note instead of an invented trend.
 */
export function SchoolOverview() {
  const membership = useMembership();
  const schoolSlug = membership?.schoolSlug ?? "";

  const dashboard = useApi(() => schoolApi.getDashboard(schoolSlug), [schoolSlug]);
  const trend = useApi(() => schoolApi.getAttendanceTrend(schoolSlug, { days: 5 }), [
    schoolSlug,
  ]);
  const daySheet = useApi(() => schoolApi.getDaySheet(schoolSlug, { date: todayIso() }), [
    schoolSlug,
  ]);
  const { calendar } = useSchoolCalendar();

  if (dashboard.loading || !dashboard.data) {
    return <FullPageLoader label="Loading your school's overview" />;
  }

  if (dashboard.error) {
    return (
      <p className="py-16 text-center text-sm text-body">
        Could not load the school overview. Check the connection and reload.
      </p>
    );
  }

  const data = dashboard.data;

  return (
    <div className="space-y-6 lg:space-y-7">
      <Greeting schoolName={membership?.schoolName ?? ""} calendar={calendar} />

      <KpiRow data={data} trend={trend.data ?? []} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
        <div className="lg:col-span-8">
          <AttendanceChart
            points={trend.data ?? []}
            loading={trend.loading}
            markedToday={data.attendanceToday.marked}
          />
        </div>
        <div className="lg:col-span-4">
          <QuickActions schoolSlug={schoolSlug} classCount={data.classCount} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
        <div className="flex flex-col gap-6 lg:col-span-7 lg:gap-7">
          <RecentAnnouncements schoolSlug={schoolSlug} announcements={data.latestAnnouncements} />
          <AcademicYearCard
            classCount={data.classCount}
            registersSubmitted={daySheet.data?.length ?? 0}
            calendar={calendar}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5 lg:gap-7">
          <UpcomingExams
            schoolSlug={schoolSlug}
            exams={data.upcomingExams}
            periods={calendar?.periods ?? []}
          />
          <RecentActivity data={data} />
          <MissionQuote />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

function Greeting({
  schoolName,
  calendar,
}: {
  schoolName: string;
  calendar: SchoolCalendar | null;
}) {
  const user = useAuth((state) => state.user);
  const term = currentTerm(new Date(), calendarTerms(calendar));

  const firstName = user?.name.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 sm:p-6">
      {/* Ambient emerald glow, behind the copy only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 -top-12 size-64 rounded-full bg-secondary-container/40 blur-3xl"
      />

      <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-secondary-strong">
              <span className="size-2 animate-pulse rounded-full bg-secondary" />
              {salutation}, {firstName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-mid px-3 py-1 text-xs font-medium text-body">
              <CalendarIcon width={14} height={14} className="text-secondary" />
              {dateLabel}
              {calendar?.academicYear ? ` · AY ${calendar.academicYear.name}` : ""}
              {term ? ` · ${term.label}` : ""}
            </span>
          </div>

          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-primary sm:text-[32px]">
            Here&rsquo;s what&rsquo;s happening at {schoolName || "your school"} today.
          </h1>
          <p className="text-sm leading-relaxed text-body">
            Students, teachers and classes — the whole school in one
            operational view.
          </p>
        </div>

        <div className="w-full shrink-0 rounded-2xl bg-surface-low/70 p-2 lg:w-[340px]">
          <CampusScene className="h-auto w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Key metrics
 * ------------------------------------------------------------------ */

function KpiRow({
  data,
  trend,
}: {
  data: SchoolDashboard;
  trend: { date: string; percentage: number; marked: number }[];
}) {
  const latest = trend.at(-1);
  const previous = trend.at(-2);

  // The only metric with real history behind it, so the only one carrying a delta.
  const attendanceDelta =
    latest && previous ? Math.round((latest.percentage - previous.percentage) * 10) / 10 : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total students"
        value={data.studentCount.toLocaleString("en-IN")}
        icon={<StudentsIcon width={22} height={22} />}
        chip={<Note>Across {data.classCount} classes</Note>}
      />

      <StatCard
        label="Total teachers"
        value={data.teacherCount.toLocaleString("en-IN")}
        icon={<Tile className="bg-violet-50 text-violet-600"><TeachersIcon width={22} height={22} /></Tile>}
        chip={<Note>Teaching staff on record</Note>}
      />

      <StatCard
        label="Total classes"
        value={data.classCount.toLocaleString("en-IN")}
        icon={<Tile className="bg-warn-50 text-warn-600"><GraduationIcon width={22} height={22} /></Tile>}
        chip={<Note>{data.parentCount} guardians linked</Note>}
      />

      <StatCard
        label="Today&rsquo;s attendance"
        value={`${data.attendanceToday.percentage}%`}
        tone={data.attendanceToday.percentage >= 90 ? "positive" : "warning"}
        icon={<Tile className="bg-danger-50 text-danger-600"><BarChartIcon width={22} height={22} /></Tile>}
        chip={
          attendanceDelta === null ? (
            <Note>Marked so far today</Note>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                attendanceDelta >= 0 ? "bg-brand-50 text-secondary-strong" : "bg-danger-50 text-danger-600",
              )}
            >
              <ArrowUpIcon
                width={12}
                height={12}
                className={attendanceDelta >= 0 ? undefined : "rotate-180"}
              />
              {attendanceDelta >= 0 ? "+" : ""}
              {attendanceDelta}% <span className="font-normal text-muted">vs prev</span>
            </span>
          )
        }
        spark={<Sparkline values={trend.map((point) => point.percentage)} tone="#059669" />}
      />
    </div>
  );
}

/** Neutral chip used where the design showed a trend we have no history for. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-low px-2 py-0.5 text-xs font-medium text-body">
      {children}
    </span>
  );
}

function Tile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", className)}>
      {children}
    </span>
  );
}

/** Micro trend line. Values are flat-filled from the series, not invented. */
function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = 76 / (values.length - 1);

  const points = values.map((value, index) => {
    const x = 2 + index * step;
    const y = 24 - ((value - min) / span) * 20;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const last = points.at(-1)!.split(" ");

  return (
    <svg
      width={64}
      height={26}
      viewBox="0 0 80 28"
      preserveAspectRatio="none"
      className="h-auto w-16 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        stroke={tone}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={tone} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Attendance
 * ------------------------------------------------------------------ */

function AttendanceChart({
  points,
  loading,
  markedToday,
}: {
  points: { date: string; percentage: number; marked: number }[];
  loading: boolean;
  markedToday: number;
}) {
  const rows = points.map((point) => {
    const present = Math.round((point.percentage / 100) * point.marked);
    return { ...point, present, absent: point.marked - present };
  });

  const totals = rows.reduce(
    (sum, row) => ({ present: sum.present + row.present, absent: sum.absent + row.absent }),
    { present: 0, absent: 0 },
  );

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChartIcon width={22} height={22} className="text-secondary" />
            <h2 className="text-[17px] font-bold tracking-tight text-primary">
              Attendance overview
            </h2>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            Student attendance · last {rows.length || 5} school days
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center text-sm text-body">
          Loading attendance…
        </div>
      ) : rows.length === 0 ? (
        <p className="flex h-56 items-center justify-center text-sm text-body">
          No registers have been marked yet.
        </p>
      ) : (
        <>
          <div className="flex gap-2 pt-2">
            <div className="flex h-40 w-10 shrink-0 flex-col justify-between text-right text-[11px] font-semibold text-muted">
              {["100%", "75%", "50%", "25%", "0%"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="relative h-40 flex-1">
              {[0, 1, 2, 3, 4].map((line) => (
                <div
                  key={line}
                  className="absolute inset-x-0 h-px bg-line/70"
                  style={{ top: `${line * 25}%` }}
                />
              ))}

              {/* Bar height is the day's attendance rate against the full 100%
                  gridline, so the shape is comparable across the week. */}
              <div className="absolute inset-0 flex items-end justify-around">
                {rows.map((row, index) => {
                  const isToday = index === rows.length - 1;

                  return (
                    <div
                      key={row.date}
                      title={`${row.present} present · ${row.absent} absent`}
                      className={cn(
                        "flex w-12 flex-col overflow-hidden rounded-t-lg sm:w-14",
                        isToday ? "ring-2 ring-secondary/30" : "",
                      )}
                      style={{ height: `${Math.max(row.percentage, 2)}%` }}
                    >
                      <div
                        className="w-full shrink-0 bg-[#f87171]"
                        style={{ height: row.percentage > 0 ? 12 : 0 }}
                      />
                      <div
                        className={cn(
                          "flex w-full flex-1 items-center justify-center",
                          isToday ? "bg-secondary" : "bg-primary",
                        )}
                      >
                        <span className="text-[11px] font-bold text-white">
                          {row.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Same widths and spacing as the bars above, so each day sits under
              its own column. */}
          <div className="ml-12 mt-2 flex justify-around">
            {rows.map((row, index) => {
              const isToday = index === rows.length - 1;

              return (
                <div key={row.date} className="w-12 text-center sm:w-14">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isToday ? "font-bold text-secondary" : "text-primary",
                    )}
                  >
                    {weekday(row.date)}
                  </p>
                  <p className={cn("text-[11px]", isToday ? "font-medium text-secondary" : "text-muted")}>
                    {dayMonth(row.date)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-line pt-4 text-xs font-medium text-ink">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-primary" />
              Present <strong className="font-bold text-primary">{totals.present}</strong>
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#f87171]" />
              Absent <strong className="font-bold text-danger-600">{totals.absent}</strong>
            </span>
            <span className="text-muted">{markedToday} marked today</span>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Quick actions
 * ------------------------------------------------------------------ */

function QuickActions({
  schoolSlug,
  classCount,
}: {
  schoolSlug: string;
  classCount: number;
}) {
  const role = useRole();

  const actions = [
    {
      label: "Add student",
      href: schoolHref(schoolSlug, "students"),
      icon: <StudentsIcon width={20} height={20} />,
      tint: "bg-secondary-container text-on-secondary-container",
      arrow: "text-secondary",
      allowed: canPerform(role, "manageRoster"),
    },
    {
      label: "Add teacher",
      href: schoolHref(schoolSlug, "teachers"),
      icon: <BadgeIcon width={20} height={20} />,
      tint: "bg-violet-50 text-violet-600",
      arrow: "text-violet-600",
      allowed: canPerform(role, "inviteUsers"),
    },
    {
      label: "Mark attendance",
      href: schoolHref(schoolSlug, "attendance"),
      icon: <ClipboardCheckIcon width={20} height={20} />,
      tint: "bg-[#e0e7ff] text-[#4338ca]",
      arrow: "text-[#4338ca]",
      allowed: canPerform(role, "markAttendance"),
    },
    {
      label: "Generate report",
      href: schoolHrefForArea(schoolSlug, "report-cards"),
      icon: <ReportsIcon width={20} height={20} />,
      tint: "bg-warn-50 text-warn-600",
      arrow: "text-warn-600",
      allowed: canPerform(role, "publishResults"),
    },
  ].filter((action) => action.allowed);

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center gap-2 pb-2">
        <CampaignIcon width={22} height={22} className="text-secondary" />
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Quick actions</h2>
      </div>

      <div className="my-auto grid grid-cols-2 gap-3 py-2">
        {actions.length === 0 ? (
          <p className="col-span-2 py-6 text-center text-sm text-body">
            No actions are open to your role yet.
          </p>
        ) : (
          actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex min-h-28 flex-col justify-between gap-2 rounded-2xl bg-surface-low p-4 transition-colors hover:bg-surface-mid"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                  action.tint,
                )}
              >
                {action.icon}
              </span>
              <span className="flex items-end justify-between gap-1">
                <span className="text-sm font-semibold leading-tight text-primary">
                  {action.label}
                </span>
                <ArrowRightIcon
                  width={18}
                  height={18}
                  className={cn("shrink-0 transition-all group-hover:translate-x-0.5", action.arrow)}
                />
              </span>
            </Link>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50/70 px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] text-ink">
          <VerifiedIcon width={18} height={18} className="text-secondary" />
          {classCount} classes on the roll
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">
          Synced
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

const PRIORITY_LABEL: Record<(typeof ANNOUNCEMENT_PRIORITIES)[number], string> = {
  NORMAL: "Notice",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};

const PRIORITY_TONE: Record<(typeof ANNOUNCEMENT_PRIORITIES)[number], string> = {
  NORMAL: "bg-brand-50 text-secondary-strong",
  IMPORTANT: "bg-info-50 text-info-600",
  URGENT: "bg-danger-50 text-danger-600",
};

function RecentAnnouncements({
  schoolSlug,
  announcements,
}: {
  schoolSlug: string;
  announcements: SchoolDashboard["latestAnnouncements"];
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <CampaignIcon width={22} height={22} className="text-secondary" />
          <h2 className="text-[17px] font-bold tracking-tight text-primary">
            Recent announcements
          </h2>
        </div>
        <ViewAll href={schoolHref(schoolSlug, "announcements")} />
      </div>

      {announcements.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-body">Nothing posted yet.</p>
      ) : (
        <div className="divide-y divide-line">
          {announcements.slice(0, 4).map((notice) => (
            <article key={notice.id} className="group px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                        PRIORITY_TONE[notice.priority],
                      )}
                    >
                      {PRIORITY_LABEL[notice.priority]}
                    </span>
                    {notice.pinned ? <Badge tone="neutral">Pinned</Badge> : null}
                    <span className="text-[13px] text-muted">
                      · {notice.audience.join(", ").toLowerCase().replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-primary">{notice.title}</h3>
                  <p className="line-clamp-1 text-[13px] text-body">{notice.body}</p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] font-semibold text-primary">{notice.authorName}</p>
                  <p className="text-[13px] text-muted">{shortStamp(notice.publishedAt)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Academic year
 * ------------------------------------------------------------------ */

function AcademicYearCard({
  classCount,
  registersSubmitted,
  calendar,
}: {
  classCount: number;
  registersSubmitted: number;
  calendar: SchoolCalendar | null;
}) {
  const term = currentTerm(new Date(), calendarTerms(calendar));
  const complete = classCount > 0 && registersSubmitted >= classCount;

  return (
    <Card className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationIcon width={22} height={22} className="text-secondary" />
          <h3 className="text-[17px] font-bold tracking-tight text-primary">
            {calendar?.academicYear
              ? `Academic year ${calendar.academicYear.name}`
              : "Academic year"}
          </h3>
        </div>
        {term ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-secondary-strong">
            <VerifiedIcon width={14} height={14} />
            {term.label} is {term.underway ? "underway" : "upcoming"}
          </span>
        ) : null}
      </div>

      {term ? <p className="text-[13px] text-muted">Period: {term.range}</p> : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-primary">Daily attendance compliance</span>
          <span className={cn(complete ? "text-secondary-strong" : "text-warn-600")}>
            {registersSubmitted} / {classCount} registers submitted
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-mid">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              complete ? "bg-secondary" : "bg-warn-600",
            )}
            style={{
              width: `${classCount === 0 ? 0 : Math.min(100, (registersSubmitted / classCount) * 100)}%`,
            }}
          />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Exams, activity, quote
 * ------------------------------------------------------------------ */

/**
 * The design puts a day timetable in this slot. There is no school-wide
 * timetable endpoint — the API exposes one class at a time — so this shows the
 * school's real upcoming exams instead of a fabricated schedule.
 */
function UpcomingExams({
  schoolSlug,
  exams,
  periods,
}: {
  schoolSlug: string;
  exams: SchoolDashboard["upcomingExams"];
  periods: SchoolCalendar["periods"];
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarIcon width={22} height={22} className="text-secondary" />
          <h2 className="text-[17px] font-bold tracking-tight text-primary">Upcoming exams</h2>
        </div>
        <ViewAll href={schoolHref(schoolSlug, "exams")} />
      </div>

      {exams.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-body">No exams are scheduled.</p>
      ) : (
        <div className="flex flex-col gap-3 p-5">
          {exams.slice(0, 4).map((exam, index) => {
            const time = periods[index];
            return (
              <div
                key={exam.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-low px-3 py-2.5 transition-colors hover:bg-surface-mid"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      ["bg-[#10b981]", "bg-[#3b82f6]", "bg-violet-600", "bg-[#f59e0b]"][index % 4],
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(exam.date))}
                      {time ? ` · ${time.startTime}` : ""}
                    </p>
                    <p className="truncate text-sm font-bold text-primary">{exam.name}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-surface-mid px-2.5 py-1 text-xs font-semibold text-primary">
                  {exam.term}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/**
 * A real activity feed, assembled from the records the dashboard already
 * returns: notices posted, exams published, and today's register.
 */
function RecentActivity({ data }: { data: SchoolDashboard }) {
  const entries: { text: React.ReactNode; when: string; tint: string; icon: ReactNode }[] = [];

  const [latestNotice] = data.latestAnnouncements;
  if (latestNotice) {
    entries.push({
      text: (
        <>
          Announcement posted —{" "}
          <strong className="font-semibold text-primary">{latestNotice.title}</strong>
        </>
      ),
      when: shortStamp(latestNotice.publishedAt),
      tint: "bg-brand-50 text-secondary-strong",
      icon: <CampaignIcon width={15} height={15} />,
    });
  }

  const [latestExam] = data.recentExams;
  if (latestExam) {
    entries.push({
      text: (
        <>
          Results published —{" "}
          <strong className="font-semibold text-primary">{latestExam.name}</strong>
        </>
      ),
      when: latestExam.publishedAt ? shortStamp(latestExam.publishedAt) : "",
      tint: "bg-violet-50 text-violet-600",
      icon: <GraduationIcon width={15} height={15} />,
    });
  }

  if (data.attendanceToday.marked > 0) {
    entries.push({
      text: (
        <>
          Attendance marked —{" "}
          <strong className="font-semibold text-primary">
            {data.attendanceToday.marked} registers
          </strong>
        </>
      ),
      when: "Today",
      tint: "bg-[#e0e7ff] text-[#4338ca]",
      icon: <ClipboardCheckIcon width={15} height={15} />,
    });
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <HistoryIcon width={22} height={22} className="text-secondary" />
          <h2 className="text-[17px] font-bold tracking-tight text-primary">Recent activity</h2>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                entry.tint,
              )}
            >
              {entry.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug text-ink">{entry.text}</p>
              <p className="mt-0.5 text-[11px] text-muted">{entry.when}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MissionQuote() {
  return (
    <Card className="flex items-center gap-4 overflow-hidden bg-gradient-to-br from-surface-low to-white p-5 sm:p-6">
      <svg
        viewBox="0 0 48 64"
        className="h-20 w-16 shrink-0 text-secondary/80"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M24 60 C24 35 38 20 44 14 C36 18 26 24 24 36 C22 24 12 18 4 14 C10 20 24 35 24 60 Z"
          fill="currentColor"
          opacity="0.85"
        />
        <path d="M24 60 V10" stroke="#0f382c" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 45 C32 40 37 32 40 26" stroke="#0f382c" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 36 C16 32 11 25 8 18" stroke="#0f382c" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div>
        <blockquote className="text-[15px] font-bold italic leading-snug text-primary">
          &ldquo;Education is the most powerful weapon which you can use to change the
          world.&rdquo;
        </blockquote>
        <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted">
          — Nelson Mandela
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Shared bits and formatting
 * ------------------------------------------------------------------ */

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-1 text-xs font-semibold text-secondary hover:text-secondary-strong"
    >
      View all
      <ArrowRightIcon
        width={16}
        height={16}
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_MONTH_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function weekday(iso: string): string {
  return WEEKDAY_SHORT.format(parseIso(iso));
}

function dayMonth(iso: string): string {
  return DAY_MONTH_SHORT.format(parseIso(iso));
}

/** "Today, 8:30 AM" for this week, "11 Oct, 4:15 PM" beyond it. */
function shortStamp(isoStamp: string): string {
  const date = new Date(isoStamp);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  const today = todayIso();
  const stampDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

  if (stampDay === today) return `Today, ${time}`;
  return `${dayMonth(stampDay)}, ${time}`;
}

"use client";

import Link from "next/link";
import { Avatar, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/states";
import {
  AssignmentsIcon,
  AttendanceIcon,
  ExamsIcon,
  ReportsIcon,
  ScheduleIcon,
} from "@/components/ui/icons";
import { schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership } from "@/lib/hooks";

export default function ParentPortalPage() {
  const membership = useMembership();
  const schoolSlug = membership?.schoolSlug ?? "";
  const { identity, loading } = useIdentity();

  const children = identity?.children ?? [];
  const primaryChild = children[0] ?? null;

  const attendance = useApi(
    () => (primaryChild ? schoolApi.getStudentAttendance(schoolSlug, primaryChild.id, { days: 30 }) : Promise.resolve(null)),
    [schoolSlug, primaryChild?.id],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Portal"
        description="Monitor your child's academic progress, attendance records, and upcoming schedules."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-body">
          Loading portal records…
        </Card>
      ) : children.length === 0 ? (
        <Card>
          <EmptyState
            title="No student linked"
            description="The school has not linked a student to your parent account yet. Please contact the school office to link your account to your child's student record."
          />
        </Card>
      ) : (
        <>
          {/* Children List */}
          <div className="grid gap-4 sm:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar name={child.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-ink">{child.name}</h2>
                      <Badge tone="green">{child.status}</Badge>
                    </div>
                    <p className="text-sm text-body">
                      {child.className || "Class"} · Admission #{child.admissionNo}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Quick Access Modules */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href={`/${schoolSlug}/attendance`}>
              <Card className="p-5 transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-secondary-strong">
                    <AttendanceIcon width={22} height={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">Attendance</h3>
                    <p className="text-xs text-body">
                      {attendance.data
                        ? `${attendance.data.summary.percentage}% attendance rate`
                        : "Check daily attendance"}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href={`/${schoolSlug}/exams`}>
              <Card className="p-5 transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-surface-low text-primary">
                    <ExamsIcon width={22} height={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">Grades &amp; Results</h3>
                    <p className="text-xs text-body">View exam marks &amp; performance</p>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href={`/${schoolSlug}/assignments`}>
              <Card className="p-5 transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-secondary">
                    <AssignmentsIcon width={22} height={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">Assignments</h3>
                    <p className="text-xs text-body">Homework, tasks &amp; deadlines</p>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href={`/${schoolSlug}/reports`}>
              <Card className="p-5 transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <ReportsIcon width={22} height={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">Report Cards</h3>
                    <p className="text-xs text-body">Term report cards &amp; ranking</p>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href={`/${schoolSlug}/schedule`}>
              <Card className="p-5 transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <ScheduleIcon width={22} height={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">Class Timetable</h3>
                    <p className="text-xs text-body">Weekly periods &amp; bell schedule</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

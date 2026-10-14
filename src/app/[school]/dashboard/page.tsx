"use client";

import Link from "next/link";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership, useRole } from "@/lib/hooks";
import { schoolHref } from "@/lib/nav";
import { ROLE_LABELS } from "@/types";

/**
 * A teacher gets their own day view. Everyone else gets the school-wide roll-up,
 * which is what the admin screens are actually about.
 */
export default function DashboardPage() {
  const role = useRole();
  return role === "TEACHER" ? <TeacherDashboard /> : <SchoolOverview />;
}

function SchoolOverview() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const membership = useMembership();
  const dashboard = useApi(() => schoolApi.getDashboard(schoolSlug), [schoolSlug]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of the school in the URL. Switch schools from the navbar to see this role resolve against a different tenant."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Students"
          value={dashboard.data?.studentCount ?? 0}
          hint="Across every class"
        />
        <StatCard
          label="Teachers"
          value={dashboard.data?.teacherCount ?? 0}
          tone="positive"
        />
        <StatCard
          label="Your role here"
          value={membership ? ROLE_LABELS[membership.role] : "—"}
        />
      </div>

      <Card>
        <CardHeader
          title="Screens open to your role"
          description="The sidebar is generated from the same role table the guards use, so what you see and what you can open never drift apart."
        />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Link href={schoolHref(schoolSlug, "students")}>
              <Badge tone="brand">Students</Badge>
            </Link>
            <Link href={schoolHref(schoolSlug, "attendance")}>
              <Badge tone="brand">Attendance</Badge>
            </Link>
            <Link href={schoolHref(schoolSlug, "announcements")}>
              <Badge tone="brand">Announcements</Badge>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
"use client";

import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";
import { schoolHref } from "@/lib/nav";
import { ROLE_LABELS } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const membership = useMembership();

  const students = useApi(() => schoolApi.listStudents(schoolSlug, { page: 1 }), [schoolSlug]);
  const teachers = useApi(() => schoolApi.listTeachers(schoolSlug), [schoolSlug]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of the school in the URL. Switch schools from the navbar to see this role resolve against a different tenant."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Students"
          value={students.data?.total ?? 0}
          hint="Across every class"
        />
        <StatCard label="Teachers" value={teachers.data?.length ?? 0} tone="positive" />
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
              <Badge tone="indigo">Students</Badge>
            </Link>
            <Link href={schoolHref(schoolSlug, "attendance")}>
              <Badge tone="indigo">Attendance</Badge>
            </Link>
            <Link href={schoolHref(schoolSlug, "announcements")}>
              <Badge tone="indigo">Announcements</Badge>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
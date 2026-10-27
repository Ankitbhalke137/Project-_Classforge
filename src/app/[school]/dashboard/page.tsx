"use client";

import { ComingSoon } from "@/components/coming-soon";
import { SchoolOverview } from "@/components/dashboard/school-overview";
import { ParentDashboard, StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { ForbiddenState } from "@/components/ui/states";
import { useRole } from "@/lib/hooks";
import { canAccessArea, canPerform } from "@/lib/roles";

/**
 * Which dashboard each role gets.
 *
 * The roll-up is not merely hidden below the admin tier — it is withheld,
 * because the school-wide endpoint returns counts and notices that a parent or
 * a student has no business reading. Teachers, students and parents each get a
 * dashboard built from identity-scoped endpoints.
 */
export default function DashboardPage() {
  const role = useRole();

  if (!canAccessArea(role, "dashboard")) return <ForbiddenState />;
  if (canPerform(role, "viewSchoolDashboard")) return <SchoolOverview />;
  if (role === "TEACHER") return <TeacherDashboard />;
  if (role === "STUDENT") return <StudentDashboard />;
  if (role === "PARENT") return <ParentDashboard />;

  return (
    <ComingSoon
      area="dashboard"
      title="Your dashboard"
      description="Attendance, marks and assignments for your own records."
    />
  );
}
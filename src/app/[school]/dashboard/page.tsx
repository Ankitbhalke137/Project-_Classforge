"use client";

import { ComingSoon } from "@/components/coming-soon";
import { SchoolOverview } from "@/components/dashboard/school-overview";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { ForbiddenState } from "@/components/ui/states";
import { useRole } from "@/lib/hooks";
import { canAccessArea, canPerform } from "@/lib/roles";

/**
 * Which dashboard each role gets.
 *
 * The roll-up is not merely hidden below the admin tier — it is withheld,
 * because the school-wide endpoint returns counts and notices that a parent or
 * a student has no business reading. A teacher gets their own day view.
 *
 * Student and parent dashboards are still placeholders. The identity-scoped reads
 * they need do not exist yet, and building them on the current unscoped
 * endpoints would show one family another family's records.
 */
export default function DashboardPage() {
  const role = useRole();

  if (!canAccessArea(role, "dashboard")) return <ForbiddenState />;
  if (canPerform(role, "viewSchoolDashboard")) return <SchoolOverview />;
  if (role === "TEACHER") return <TeacherDashboard />;

  return (
    <ComingSoon
      area="dashboard"
      title="Your dashboard"
      description="Attendance, marks, assignments and fees for your own records."
      note="The tailored student and parent views are designed but not built yet. They need identity-scoped endpoints first — until then this screen stays empty rather than showing another family's records."
    />
  );
}
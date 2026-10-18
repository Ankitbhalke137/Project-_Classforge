"use client";

import { RequireArea } from "@/components/auth/guards";
import { ComingSoon } from "@/components/coming-soon";
import { SchoolAdminReportsView } from "@/components/reports/school-admin-reports-view";
import { useRole } from "@/lib/hooks";

export default function ReportsPage() {
  const role = useRole();

  if (role === "SCHOOL_ADMIN") {
    return (
      <RequireArea area="report-cards">
        <SchoolAdminReportsView />
      </RequireArea>
    );
  }

  return (
    <ComingSoon
      area="report-cards"
      title="Reports & academic records"
      description="Whole-class report cards, published term results and the printable academic record."
      note="The route, the guard and the role check are in place. The screen drops in here."
    />
  );
}
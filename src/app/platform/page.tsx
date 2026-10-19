"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { platformApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";

export default function PlatformOverviewPage() {
  const { data, loading } = useApi(() => platformApi.listSchools(), []);
  const admins = useApi(() => platformApi.listAdmins(), []);

  const schools = data ?? [];
  const activeSchools = schools.filter((school) => school.status === "ACTIVE");
  const totalStudents = schools.reduce((sum, school) => sum + school.studentCount, 0);
  const schoolAdminCount = (admins.data ?? []).filter(
    (membership) => membership.role === "SCHOOL_ADMIN" && membership.status === "ACTIVE",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Cross-tenant view for the Super Admin. It creates and suspends schools but never reads a school's student data."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/platform/admins">
              <Button variant="secondary">School admins</Button>
            </Link>
            <Link href="/platform/schools">
              <Button variant="secondary">Manage schools</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Schools" value={loading ? "—" : formatNumber(schools.length)} />
        <StatCard
          label="Active"
          value={loading ? "—" : formatNumber(activeSchools.length)}
          tone="positive"
        />
        <StatCard
          label="Active school admins"
          value={admins.loading ? "—" : formatNumber(schoolAdminCount)}
        />
        <StatCard
          label="Students across schools"
          value={loading ? "—" : formatNumber(totalStudents)}
        />
      </div>

      <Card>
        <CardHeader
          title="How this area is kept separate"
          description="The platform routes sit outside every school route, so the platform guard never lets a school role in, and no school data is queried from here."
        />
        <CardBody>
          <p className="text-sm text-slate-600">
            Each school is then opened at <code className="text-slate-900">/&#123;school&#125;</code>,
            which is guarded separately.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
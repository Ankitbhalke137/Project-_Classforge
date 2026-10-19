"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { ArrowRightIcon, ShieldCheckIcon, StudentsIcon, TeachersIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { platformApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";

export default function PlatformOverviewPage() {
  const schools = useApi(() => platformApi.listSchools(), []);
  const admins = useApi(() => platformApi.listAdmins(), []);
  const stats = useApi(() => platformApi.stats(), []);

  const rows = schools.data ?? [];
  const activeSchools = rows.filter((school) => school.status === "ACTIVE").length;
  const suspendedSchools = rows.filter((school) => school.status === "SUSPENDED").length;
  const totalStudents = rows.reduce((sum, school) => sum + school.studentCount, 0);
  const totalStaff = rows.reduce((sum, school) => sum + school.staffCount, 0);
  const activeAdmins = (admins.data ?? []).filter(
    (membership) => membership.role === "SCHOOL_ADMIN" && membership.status === "ACTIVE",
  ).length;

  const numbers = stats.data;
  const recent = rows.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform console / Multi-tenant fleet"
        title="Platform overview"
        description="Create, edit and suspend schools, and give each one a School Admin. The Super Admin manages the fleet but never reads a school's student data."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/platform/admins">
              <Button variant="secondary">Invite a school admin</Button>
            </Link>
            <Link href="/platform/schools">
              <Button>Provision a school</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Schools"
          value={schools.loading ? "—" : formatNumber(numbers?.schoolCount ?? rows.length)}
          hint="Every tenant on the platform"
          chip={<span className="text-xs text-body">Global scope</span>}
        />
        <StatCard
          label="Active schools"
          value={schools.loading ? "—" : formatNumber(numbers?.activeSchoolCount ?? activeSchools)}
          tone="positive"
          hint="Signed in and writable"
          chip={<span className="text-xs text-body">No suspensions</span>}
        />
        <StatCard
          label="Suspended"
          value={schools.loading ? "—" : formatNumber(numbers?.suspendedSchoolCount ?? suspendedSchools)}
          tone={suspendedSchools > 0 ? "warning" : "default"}
          hint="Members get 403 while suspended"
          chip={<span className="text-xs text-body">Data untouched</span>}
        />
        <StatCard
          label="Students across schools"
          value={schools.loading ? "—" : formatNumber(numbers?.totalStudents ?? totalStudents)}
          icon={<StudentsIcon width={19} height={19} />}
          hint="Counts only — no roster is read here"
        />
        <StatCard
          label="Staff across schools"
          value={schools.loading ? "—" : formatNumber(numbers?.totalTeachers ?? totalStaff)}
          icon={<TeachersIcon width={19} height={19} />}
          hint="Teachers with a record in their school"
        />
        <StatCard
          label="Active school admins"
          value={admins.loading ? "—" : formatNumber(activeAdmins)}
          icon={<ShieldCheckIcon width={19} height={19} />}
          hint="One per school at minimum"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Schools at a glance"
            description="The newest tenants are not ordered here — every school is shown alphabetically."
            action={
              <Link href="/platform/schools">
                <Button variant="secondary" size="sm" rightIcon={<ArrowRightIcon />}>
                  View all
                </Button>
              </Link>
            }
          />
          {schools.loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : schools.error ? (
            <p className="px-5 py-10 text-center text-sm text-body">Could not load schools.</p>
          ) : recent.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-primary">No schools yet</p>
              <p className="mt-1 text-sm text-body">
                Provision the first school, then give it a School Admin.
              </p>
              <Link href="/platform/schools" className="mt-3 inline-block">
                <Button size="sm">Provision a school</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>School</TH>
                  <TH>Students</TH>
                  <TH>Staff</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recent.map((school) => (
                  <TR key={school.id}>
                    <TD>
                      <p className="font-medium text-ink">{school.name}</p>
                      <p className="text-xs text-muted">/{school.slug}</p>
                    </TD>
                    <TD>{formatNumber(school.studentCount)}</TD>
                    <TD>{formatNumber(school.staffCount)}</TD>
                    <TD>
                      <Badge tone={school.status === "ACTIVE" ? "green" : "amber"}>
                        {school.status === "ACTIVE" ? "Active" : "Suspended"}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="What this role can do"
            description="Straight from the product requirements."
            icon={<ShieldCheckIcon />}
          />
          <CardBody className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-primary">Can</p>
              <ul className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-body">
                <li>Create, edit and suspend schools (tenants).</li>
                <li>Map each school to a unique URL slug.</li>
                <li>Assign the first School Admin, and change staff roles.</li>
                <li>See counts across the fleet — never a roster.</li>
              </ul>
            </div>
            <div className="border-t border-line pt-4">
              <p className="text-sm font-semibold text-primary">Cannot</p>
              <ul className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-body">
                <li>Open a school&apos;s student, attendance or marks data.</li>
                <li>Act as a member of any school (SCH-06).</li>
              </ul>
            </div>
            <p className="rounded-xl bg-surface-low px-3 py-2.5 text-xs leading-relaxed text-body">
              Managing a school is not the same as reading it. A Super Admin with no membership
              gets 403 on every school route.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

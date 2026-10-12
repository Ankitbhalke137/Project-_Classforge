"use client";

import { RequireArea } from "@/components/auth/guards";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";

export default function TeachersPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const { data, loading, error } = useApi(() => schoolApi.listTeachers(schoolSlug), [schoolSlug]);

  return (
    <RequireArea area="teachers">
      <div className="space-y-6">
        <PageHeader
          title="Teachers"
          description="Staff list for this school. Invite and role assignment arrive with the designs."
        />

        <Card>
          {loading ? (
            <TableSkeleton rows={4} columns={3} />
          ) : error || !data ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Could not load teachers.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Subject</TH>
                </TR>
              </THead>
              <TBody>
                {data.map((teacher) => (
                  <TR key={teacher.id}>
                    <TD className="font-medium text-slate-900">{teacher.name}</TD>
                    <TD>{teacher.email}</TD>
                    <TD>{teacher.subject}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </RequireArea>
  );
}
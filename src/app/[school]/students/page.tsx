"use client";

import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";
import type { Student } from "@/types";

export default function StudentsPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, loading, error } = useApi(
    () => schoolApi.listStudents(schoolSlug, { page, search }),
    [schoolSlug, page, search],
  );

  return (
    <RequireArea area="students">
      <div className="space-y-6">
        <PageHeader
          title="Students"
          description="Server-paginated roster with search. Filters move into the URL once the designs land."
        />

        <Card>
          <div className="border-b border-slate-200 p-4">
            <Input
              label="Search"
              type="search"
              placeholder="Search by name or class"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          {loading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : error || !data ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Could not load the roster.
            </p>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Admission no.</TH>
                    <TH>Class</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.data.map((student) => (
                    <StudentRow key={student.id} student={student} />
                  ))}
                </TBody>
              </Table>
              <PaginationBar result={data} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>
    </RequireArea>
  );
}

function StudentRow({ student }: { student: Student }) {
  return (
    <TR>
      <TD>
        <span className="font-medium text-slate-900">{student.name}</span>
        <span className="block text-xs text-slate-500">{student.email}</span>
      </TD>
      <TD>{student.admissionNo}</TD>
      <TD>{student.className}</TD>
      <TD>
        <Badge tone={student.status === "ACTIVE" ? "green" : "neutral"}>{student.status}</Badge>
      </TD>
    </TR>
  );
}
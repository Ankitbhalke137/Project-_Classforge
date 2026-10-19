"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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

/**
 * The roster.
 *
 * `useSearchParams` is what lets the topbar's school-wide search land here with
 * a query already applied, so the split keeps the Suspense boundary as narrow as
 * the hook actually requires.
 */
export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsRoster />
    </Suspense>
  );
}

function StudentsRoster() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(urlSearch);

  const { data, loading, error } = useApi(
    () => schoolApi.listStudents(schoolSlug, { page, search }),
    [schoolSlug, page, search],
  );

  return (
    <RequireArea area="students">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Enrolment & records"
          title="Students directory"
          description="Server-paginated roster with search. Filters move into the URL once the designs land."
        />

        <Card>
          <div className="border-b border-line p-4">
            <Input
              label="Search"
              type="search"
              placeholder="Search by name, admission no. or class"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          {loading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : error || !data || data.data.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-body">
              {error ? "Could not load the roster." : "No students match this search."}
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
        <span className="font-semibold text-primary">{student.name}</span>
        {/* Not every student has an email on file, so fall back to something
            the school would recognise rather than leaving a blank line. */}
        <span className="block text-xs text-body">
          {student.email || `Roll ${student.admissionNo}`}
        </span>
      </TD>
      <TD>{student.admissionNo}</TD>
      <TD>{student.className}</TD>
      <TD>
        <Badge tone={student.status === "ACTIVE" ? "green" : "neutral"}>{student.status}</Badge>
      </TD>
    </TR>
  );
}
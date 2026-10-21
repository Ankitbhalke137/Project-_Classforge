"use client";

import { useMemo } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useRole } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import type { Exam } from "@/types";

export default function ExamsPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();
  const { identity, loading: identityLoading } = useIdentity();
  const student = identity?.student ?? null;
  const email = useAuth((state) => state.user?.email ?? "");
  const isStudent = role === "STUDENT";

  const { data, loading, error } = useApi(
    () => schoolApi.listExams(schoolSlug, {}),
    [schoolSlug],
  );

  const exams = useMemo(() => {
    let rows = (data?.data ?? []) as Exam[];

    if (isStudent && student) {
      // Students only see completed exams for their own class.
      rows = rows.filter(
        (exam) => exam.status === "COMPLETED" && exam.classId === student.classId,
      );
    }

    return rows;
  }, [data, isStudent, student]);

  return (
    <RequireArea area="exams">
      <div className="space-y-6">
        <PageHeader
          title="Exams & Grades"
          description={
            isStudent
              ? "Your published results across terms."
              : "Create exams, set maximum marks and enter results."
          }
        />

        <Card>
          <CardHeader title="Exams" description="Exam sessions across terms" />
          <CardBody>
            {loading || identityLoading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : error
              ? <p className="px-4 py-10 text-center text-sm text-slate-500">
                  Could not load exams.
                </p>
              : exams.length === 0
                ? <p className="px-4 py-10 text-center text-sm text-slate-500">
                    {isStudent
                      ? "No published results yet."
                      : "No exams created yet."}
                  </p>
                : (
                    <>
                      <Table>
                        <THead>
                          <TR>
                            <TH>Exam</TH>
                            <TH>Subject</TH>
                            <TH>Class</TH>
                            <TH>Term</TH>
                            <TH>Max Marks</TH>
                            <TH>Status</TH>
                            <TH>Actions</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {exams.map((exam) => {
                            const subjectName =
                              exam.subjectName || `Subject ${exam.subjectId}`;
                            const className =
                              exam.className || `Class ${exam.classId}`;
                            const statusTone =
                              exam.status === "SCHEDULED"
                                ? "neutral"
                                : exam.status === "IN_PROGRESS"
                                  ? "amber"
                                  : "green";

                            return (
                              <TR key={exam.id}>
                                <TD>
                                  <span className="font-medium text-slate-900">
                                    {exam.name}
                                  </span>
                                </TD>
                                <TD>
                                  <Badge tone="brand" className="text-xs">
                                    {subjectName}
                                  </Badge>
                                </TD>
                                <TD>{className}</TD>
                                <TD>{exam.term ?? "—"}</TD>
                                <TD>
                                  {exam.maxMarks !== undefined ? (
                                    <span className="font-medium text-slate-900">
                                      {exam.maxMarks}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TD>
                                <TD>
                                  <Badge tone={statusTone} className="text-xs">
                                    {exam.status}
                                  </Badge>
                                </TD>
                                <TD>
                                  {isStudent ? (
                                    <a
                                      href={`/${schoolSlug}/students/${student?.id}/report-card?term=${encodeURIComponent(exam.term ?? "")}`}
                                      className="text-sm font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
                                    >
                                      View Results
                                    </a>
                                  ) : (
                                    <a
                                      href={`/${schoolSlug}/exams/${exam.id}/results`}
                                      className="text-sm font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
                                    >
                                      View Results
                                    </a>
                                  )}
                                </TD>
                              </TR>
                            );
                          })}
                        </TBody>
                      </Table>
                    </>
                  )}
          </CardBody>
        </Card>
      </div>
    </RequireArea>
  );
}

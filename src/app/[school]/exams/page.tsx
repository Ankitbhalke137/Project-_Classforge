"use client";

import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { useApi, useMembership, useRole } from "@/lib/hooks";
import { schoolApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Exam } from "@/types";
import { SUBJECT_BY_ID, CLASS_BY_ID } from "@/mocks/fixtures";

export default function ExamsPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();

  const { data, loading, error } = useApi(
    () => schoolApi.listExams(schoolSlug, {}),
    [schoolSlug],
  );

  const exams = data?.data ?? [];

  return (
    <RequireArea area="exams">
      <div className="space-y-6">
        <PageHeader
          title="Exams & Grades"
          description="Create exams, set maximum marks and enter results."
        />

        <Card>
          <CardHeader title="Exams" description="Exam sessions across terms" />
          <CardBody>
            {loading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : error
              ? <p className="px-4 py-10 text-center text-sm text-slate-500">
                  Could not load exams.
                </p>
              : exams.length === 0
                ? <p className="px-4 py-10 text-center text-sm text-slate-500">
                    No exams created yet.
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
                            const subject =
                              exam.subjectId && SUBJECT_BY_ID?.get(exam.subjectId)
                                ? SUBJECT_BY_ID.get(exam.subjectId)?.name
                                : exam.subjectId
                                  ? `Subject ${exam.subjectId}`
                                  : "—";
                            const className =
                              exam.classId && CLASS_BY_ID?.get(exam.classId)
                                ? CLASS_BY_ID.get(exam.classId)?.name
                                : exam.classId
                                  ? `Class ${exam.classId}`
                                  : "—";
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
                                    {subject}
                                  </Badge>
                                </TD>
                                <TD>
                                  {className}
                                </TD>
                                <TD>
                                  {exam.term ?? "—"}
                                </TD>
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
                                  <a
                                    href={`/${schoolSlug}/exams/${exam.id}/results`}
                                    className="text-sm font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
                                  >
                                    View Results
                                  </a>
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
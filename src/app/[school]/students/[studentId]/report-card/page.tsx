"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useRole } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { ReportCard } from "@/types";

export default function ReportCardPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setStudentId(p.studentId));
  }, [params]);

  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();
  const { identity, loading: identityLoading } = useIdentity();
  const student = identity?.student ?? null;
  const email = useAuth((state) => state.user?.email ?? "");
  const isStudent = role === "STUDENT";

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const term = searchParams.get("term") ?? "Term 1";

  if (!studentId) return null;

  const { data, loading, error } = useApi(
    () => schoolApi.getReportCard(schoolSlug, studentId, { term }),
    [schoolSlug, studentId, term],
  );

  if (isStudent && student && student.id !== studentId) {
    notFound();
  }

  const reportCard = data as ReportCard | null;

  if (loading || identityLoading) {
    return (
      <RequireArea area="exams">
        <div className="min-h-screen bg-page p-6">
          <p className="text-sm text-body">Loading your report card…</p>
        </div>
      </RequireArea>
    );
  }

  if (error || !reportCard) {
    return (
      <RequireArea area="exams">
        <div className="min-h-screen bg-page p-6">
          <p className="text-sm text-body">Could not load your report card.</p>
        </div>
      </RequireArea>
    );
  }

  const percentage =
    reportCard.maxTotal > 0
      ? Math.round((reportCard.totalMarks / reportCard.maxTotal) * 100)
      : 0;

  return (
    <RequireArea area="exams">
      <div className="space-y-6">
        <PageHeader
          title="Report Card"
          description={`${reportCard.studentName} — ${reportCard.className}`}
        />

        <Card>
          <CardHeader
            title="Results summary"
            description={`Term ${reportCard.term}`}
          />
          <CardBody>
            <div className="grid grid-cols-2 md:cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Total marks
                </p>
                <p className="text-lg font-semibold text-primary">
                  {reportCard.totalMarks}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Max marks
                </p>
                <p className="text-lg font-semibold text-primary">
                  {reportCard.maxTotal}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Percentage
                </p>
                <p className="text-lg font-semibold text-primary">
                  {percentage}%
                </p>
              </div>
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Overall grade
                </p>
                <p className="text-lg font-semibold text-primary">
                  {reportCard.overallGrade ?? "—"}
                </p>
              </div>
            </div>

            {reportCard.attendancePercentage !== undefined && (
              <div className="mt-4 p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Attendance
                </p>
                <p className="text-lg font-semibold text-primary">
                  {reportCard.attendancePercentage}%
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Results by exam" />
          <CardBody>
            {reportCard.rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No results published for this term.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Subject</TH>
                    <TH>Exam</TH>
                    <TH>Date</TH>
                    <TH>Score</TH>
                    <TH>Max</TH>
                    <TH>Grade</TH>
                  </TR>
                </THead>
                <TBody>
                  {reportCard.rows.map((row) => {
                    const subjectName = row.subjectName;
                    const scoreTone =
                      row.marksObtained === null
                        ? "neutral"
                        : row.marksObtained! / row.maxMarks >= 0.5
                          ? "green"
                          : "amber";

                    return (
                      <TR key={row.examId}>
                        <TD>{subjectName}</TD>
                        <TD>
                          <span className="font-medium text-slate-900">
                            {row.examName}
                          </span>
                        </TD>
                        <TD>{row.date}</TD>
                        <TD>
                          {row.marksObtained === null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={cn(
                                "font-medium",
                                scoreTone === "green"
                                  ? "text-green-600"
                                  : scoreTone === "amber"
                                    ? "text-amber-600"
                                    : "text-slate-900",
                              )}
                            >
                              {row.marksObtained}
                            </span>
                          )}
                        </TD>
                        <TD>{row.maxMarks}</TD>
                        <TD>
                          <Badge
                            tone={
                              row.grade === null ? "neutral" : ("brand" as const)
                            }
                            className="text-xs"
                          >
                            {row.grade ?? "—"}
                          </Badge>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </RequireArea>
  );
}

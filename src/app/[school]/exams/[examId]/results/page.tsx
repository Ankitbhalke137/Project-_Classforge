"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership, useRole } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Exam, ExamResult } from "@/types";

export default function ExamResultsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const [examId, setExamId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setExamId(p.examId));
  }, [params]);

  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();
  const isAdmin = role === "SCHOOL_ADMIN";

  const { data, loading, error } = useApi(
    () => schoolApi.getExamResults(schoolSlug, examId!),
    [schoolSlug, examId],
  );

  const payload = data as { exam: Exam; results: ExamResult[] } | null;
  const exam = payload?.exam ?? null;
  const results = payload?.results ?? [];

  if (!examId) return null;

  if (loading || !exam) {
    return (
      <RequireArea area="exams">
        <div className="min-h-screen bg-page p-6">
          <p className="text-sm text-body">Loading results…</p>
        </div>
      </RequireArea>
    );
  }

  if (error || !exam) {
    notFound();
  }

  return (
    <RequireArea area="exams">
      <div className="space-y-6">
        <PageHeader
          title="Exam Results"
          description={`${exam.name} — ${exam.term}`}
        />

        <Card>
          <CardHeader
            title="Exam"
            description={
              exam.className
                ? `Class ${exam.className} · ${exam.subjectName || ""}`
                : ""
            }
          />
          <CardBody>
            <div className="grid grid-cols-2 md:cols-4 gap-4 text-sm mb-4">
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Max marks
                </p>
                <p className="text-lg font-semibold text-primary">{exam.maxMarks}</p>
              </div>
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Pass marks
                </p>
                <p className="text-lg font-semibold text-primary">{exam.passMarks}</p>
              </div>
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Status
                </p>
                <p className="text-lg font-semibold text-primary">
                  <Badge
                    tone={exam.status === "COMPLETED" ? "green" : exam.status === "IN_PROGRESS" ? "amber" : "neutral"}
                    className="text-xs"
                  >
                    {exam.status}
                  </Badge>
                </p>
              </div>
              <div className="p-3 rounded-lg border border-line bg-surface-low">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Results entered
                </p>
                <p className="text-lg font-semibold text-primary">
                  {results.filter((r) => r.marksObtained !== null).length} / {results.length}
                </p>
              </div>
            </div>

            {isAdmin && exam.status !== "COMPLETED" && (
              <Button
                onClick={async () => {
                  try {
                    await schoolApi.publishExam(schoolSlug, examId);
                    window.location.reload();
                  } catch {
                    // Error handled by api layer; reload to reflect state
                  }
                }}
              >
                Publish results
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Student results" />
          <CardBody>
            {results.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No results yet for this exam.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>Admission no.</TH>
                    <TH>Score</TH>
                    <TH>Max</TH>
                    <TH>Grade</TH>
                    <TH>Remarks</TH>
                  </TR>
                </THead>
                <TBody>
                  {results.map((result) => {
                    const marksTone =
                      result.marksObtained === null
                        ? "neutral"
                        : result.marksObtained! / exam.maxMarks >= 0.5
                          ? "green"
                          : "amber";

                    return (
                      <TR key={result.id}>
                        <TD>
                          <span className="font-medium text-slate-900 truncate">
                            {result.studentName}
                          </span>
                        </TD>
                        <TD className="text-xs text-body truncate">
                          {result.admissionNo ?? "—"}
                        </TD>
                        <TD>
                          {result.marksObtained === null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={cn(
                                "font-medium",
                                marksTone === "green"
                                  ? "text-green-600"
                                  : marksTone === "amber"
                                    ? "text-amber-600"
                                    : "text-slate-900",
                              )}
                            >
                              {result.marksObtained}
                            </span>
                          )}
                        </TD>
                        <TD>{exam.maxMarks}</TD>
                        <TD>
                          <Badge
                            tone={result.grade === null ? "neutral" : ("brand" as const)}
                            className="text-xs"
                          >
                            {result.grade ?? "—"}
                          </Badge>
                        </TD>
                        <TD>
                          {result.remarks ? (
                            <span className="text-sm text-body">{result.remarks}</span>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
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

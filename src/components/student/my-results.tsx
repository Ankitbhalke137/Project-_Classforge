"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";
import { formatDate } from "@/lib/utils";
import type { Grade } from "@/types";

const GRADE_TONE: Record<Grade, "green" | "brand" | "amber" | "red" | "neutral"> = {
  "A+": "green",
  A: "green",
  "B+": "brand",
  B: "brand",
  C: "amber",
  D: "amber",
  E: "red",
};

/**
 * A student's own results screen.
 *
 * The endpoint returns only published exams for the student's active section,
 * and only their own marks. A parent gets an empty list until children are
 * linked in the schema.
 */
export function MyResultsView({ isParent = false }: { isParent?: boolean }) {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const { data, loading, error } = useApi(
    () =>
      isParent
        ? Promise.resolve({ student: null, results: [] })
        : schoolApi.getMyResults(schoolSlug),
    [schoolSlug, isParent],
  );

  const results = data?.results ?? [];
  const graded = results.filter((row) => row.percentage !== null);
  const average =
    graded.length > 0
      ? Math.round(
          graded.reduce((sum, row) => sum + (row.percentage ?? 0), 0) / graded.length,
        )
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isParent ? "Your child" : "Your progress"}
        title="My results"
        description="Published exams and the marks your teachers have released."
      />

      {isParent && !data?.student ? (
        <Card>
          <EmptyState
            title="No child linked yet"
            description="The school has not linked a student to this parent account. Ask the school office to connect your email to your child's record."
          />
        </Card>
      ) : loading ? (
        <Card>
          <TableSkeleton rows={6} columns={5} />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title="Could not load your results"
            description="Refresh the page to try again. If this keeps happening, ask the school office."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Published results"
              value={results.length}
              hint={data?.student ? `${data.student.name} · ${data.student.admissionNo}` : undefined}
            />
            <StatCard
              label="Average score"
              value={average != null ? `${average}%` : "—"}
              hint={graded.length > 0 ? `Across ${graded.length} papers` : "Waiting for marks"}
            />
            <StatCard
              label="Best grade"
              value={
                results
                  .map((row) => row.grade)
                  .filter(Boolean)
                  .sort((a, b) => gradeRank(a as Grade) - gradeRank(b as Grade))[0] ?? "—"
              }
              hint="Highest published grade"
            />
          </div>

          <Card>
            <CardHeader
              title="Published exams"
              description={
                results.length === 0
                  ? "Nothing has been released yet"
                  : `${results.length} ${results.length === 1 ? "paper" : "papers"}`
              }
            />
            <CardBody className="p-0">
              {results.length === 0 ? (
                <EmptyState
                  title="No results yet"
                  description="When a teacher publishes an exam, the marks appear here."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Exam</TH>
                      <TH>Subject</TH>
                      <TH>Date</TH>
                      <TH>Score</TH>
                      <TH>Grade</TH>
                      <TH>Remarks</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {results.map((row) => (
                      <TR key={row.examId}>
                        <TD>
                          <span className="font-medium text-primary">{row.examName}</span>
                          <span className="block text-xs text-body">
                            {row.className}
                            {row.term ? ` · ${row.term}` : ""}
                          </span>
                        </TD>
                        <TD>{row.subjectName}</TD>
                        <TD>{formatDate(row.date)}</TD>
                        <TD>
                          <span className="font-semibold text-primary">
                            {row.marksObtained ?? "—"} / {row.maxMarks}
                          </span>
                          <span className="block text-xs text-body">
                            {row.percentage != null ? `${row.percentage}%` : "Not marked"}
                          </span>
                        </TD>
                        <TD>
                          {row.grade ? (
                            <Badge tone={GRADE_TONE[row.grade]}>{row.grade}</Badge>
                          ) : (
                            <Badge tone="neutral">—</Badge>
                          )}
                        </TD>
                        <TD className="text-sm text-body">{row.remarks || "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

/** Lower index is a better grade. */
function gradeRank(grade: Grade): number {
  return ["A+", "A", "B+", "B", "C", "D", "E"].indexOf(grade);
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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

const CELL_INPUT =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft";

/**
 * Staff mark-entry sheet for one exam.
 *
 * The API returns every actively enrolled student, whether or not they have a
 * mark yet, so the teacher can fill in a whole class in one pass and publish
 * the result when it is complete.
 */
export default function ExamResultsPage() {
  const params = useParams<{ id: string }>();
  const examId = typeof params.id === "string" ? params.id : "";
  const schoolSlug = useMembership()?.schoolSlug ?? "";

  const { data, loading, error, reload } = useApi(
    () => (examId ? schoolApi.getExamResults(schoolSlug, examId) : Promise.reject(new Error("missing exam"))),
    [schoolSlug, examId],
  );

  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function saveMarks() {
    if (!data) return;
    setFormError(null);
    setNotice(null);
    setSaving(true);

    try {
      const records = data.results.map((row) => {
        const raw = (
          scoreDrafts[row.studentId] ??
          (row.marksObtained === null ? "" : String(row.marksObtained))
        ).trim();
        const score = raw === "" ? null : Number(raw);

        if (score !== null && (!Number.isFinite(score) || score < 0)) {
          throw new Error(`Enter a valid mark for ${row.studentName ?? "this student"}.`);
        }
        if (score !== null && score > data.exam.maxMarks) {
          throw new Error(
            `${row.studentName ?? "A student"} cannot score above ${data.exam.maxMarks}.`,
          );
        }

        return {
          studentId: row.studentId,
          score,
          remarks: (remarkDrafts[row.studentId] ?? row.remarks ?? "").trim() || null,
        };
      });

      await schoolApi.saveExamMarks(schoolSlug, examId, records);
      setNotice("Marks saved.");
      reload();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "Could not save the marks.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setFormError(null);
    setNotice(null);
    setPublishing(true);
    try {
      await schoolApi.publishExam(schoolSlug, examId);
      setNotice("Results published. Students can now see their marks.");
      reload();
    } catch (publishError) {
      setFormError(
        publishError instanceof Error
          ? publishError.message
          : "Could not publish the results.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <TableSkeleton rows={8} columns={5} />;
  }

  if (error || !data) {
    return (
      <Card>
        <EmptyState
          title="Could not load this exam"
          description="The exam may have been removed. Go back to the exams list and try again."
        />
      </Card>
    );
  }

  const { exam, results } = data;
  const marked = results.filter((row) => row.marksObtained !== null).length;

  return (
    <RequireArea area="exams">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Exams & grades"
          title={exam.name}
          description={`${exam.subjectName ?? "Subject"} · ${exam.className ?? "Class"} · ${exam.term ?? "No term"} · ${formatDate(exam.date)}`}
          action={
            <Link
              href={`/${schoolSlug}/exams`}
              className="text-sm font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
            >
              Back to exams
            </Link>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={exam.publishedAt ? "green" : "amber"}>
            {exam.publishedAt ? "Published" : "Draft"}
          </Badge>
          <span className="text-sm text-body">
            {marked} of {results.length} students marked · maximum {exam.maxMarks}
          </span>
        </div>

        {notice ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </p>
        ) : null}
        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {formError}
          </p>
        ) : null}

        <Card>
          <CardHeader
            title="Marks sheet"
            description="Leave a box empty to remove that student's mark."
          />
          <CardBody className="p-0">
            {results.length === 0 ? (
              <EmptyState
                title="No students enrolled"
                description="Add students to this class before entering marks."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>Admission no.</TH>
                    <TH>Marks</TH>
                    <TH>Grade</TH>
                    <TH>Remarks</TH>
                  </TR>
                </THead>
                <TBody>
                  {results.map((row) => (
                    <TR key={row.studentId}>
                      <TD className="font-medium text-primary">
                        {row.studentName ?? "Student"}
                      </TD>
                      <TD>{row.admissionNo ?? "—"}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <input
                            aria-label={`Marks for ${row.studentName ?? "student"}`}
                            type="number"
                            min={0}
                            max={exam.maxMarks}
                            value={
                              scoreDrafts[row.studentId] ??
                              (row.marksObtained === null ? "" : String(row.marksObtained))
                            }
                            onChange={(event) =>
                              setScoreDrafts((current) => ({
                                ...current,
                                [row.studentId]: event.target.value,
                              }))
                            }
                            className={`${CELL_INPUT} w-24`}
                          />
                          <span className="text-sm text-body">/ {exam.maxMarks}</span>
                        </div>
                      </TD>
                      <TD>
                        {row.grade ? (
                          <Badge tone={GRADE_TONE[row.grade]}>{row.grade}</Badge>
                        ) : (
                          <span className="text-body">—</span>
                        )}
                      </TD>
                      <TD>
                        <input
                          aria-label={`Remarks for ${row.studentName ?? "student"}`}
                          value={remarkDrafts[row.studentId] ?? row.remarks ?? ""}
                          onChange={(event) =>
                            setRemarkDrafts((current) => ({
                              ...current,
                              [row.studentId]: event.target.value,
                            }))
                          }
                          placeholder="Optional"
                          className={CELL_INPUT}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        {results.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" onClick={saveMarks} isLoading={saving}>
              Save marks
            </Button>
            <Button onClick={publish} isLoading={publishing} disabled={marked === 0}>
              {exam.publishedAt ? "Publish again" : "Publish results"}
            </Button>
          </div>
        ) : null}
      </div>
    </RequireArea>
  );
}

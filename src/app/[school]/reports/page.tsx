"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import {
  useApi,
  useIdentity,
  useMembership,
  useRole,
  useSchoolCalendar,
} from "@/lib/hooks";
import { formatDate } from "@/lib/utils";
import type { Grade, ReportCard } from "@/types";

const GRADE_TONE: Record<Grade, "green" | "brand" | "amber" | "red" | "neutral"> = {
  "A+": "green",
  A: "green",
  "B+": "brand",
  B: "brand",
  C: "amber",
  D: "amber",
  E: "red",
};

export default function ReportsPage() {
  const role = useRole();
  if (role === "STUDENT") return <StudentReport />;
  if (role === "PARENT") {
    return (
      <Card>
        <EmptyState
          title="No child linked yet"
          description="The school has not linked a student to this parent account, so there is no report card to show."
        />
      </Card>
    );
  }
  return <ClassReports />;
}

/* ------------------------------------------------------------------ *
 * Staff — a whole class for one term
 * ------------------------------------------------------------------ */

function ClassReports() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const { calendar } = useSchoolCalendar();
  const terms = calendar?.terms ?? [];
  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);

  const [classId, setClassId] = useState("");
  const [term, setTerm] = useState("");

  const sectionRows = (classes.data ?? []).filter((row) => row.section);
  const activeClassId = classId || sectionRows[0]?.id || "";
  const activeTerm = term || terms[0]?.label || "";

  const reports = useApi(
    () =>
      activeClassId && activeTerm
        ? schoolApi.listReportCards(schoolSlug, {
            classId: activeClassId,
            term: activeTerm,
          })
        : Promise.resolve([]),
    [schoolSlug, activeClassId, activeTerm],
  );

  if (classes.loading) {
    return <TableSkeleton rows={6} columns={5} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic records"
        title="Reports & report cards"
        description="Published term results for a whole class, with attendance and position."
      />

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Class"
            value={activeClassId}
            options={
              sectionRows.length === 0
                ? [{ value: "", label: "No classes yet" }]
                : sectionRows.map((row) => ({ value: row.id, label: row.name }))
            }
            onChange={(event) => setClassId(event.target.value)}
          />
          <Select
            label="Term"
            value={activeTerm}
            options={
              terms.length === 0
                ? [{ value: "", label: "No terms configured" }]
                : terms.map((row) => ({ value: row.label, label: row.label }))
            }
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
      </Card>

      {sectionRows.length === 0 ? (
        <Card>
          <EmptyState
            title="No classes yet"
            description="Create a class and at least one section before opening report cards."
          />
        </Card>
      ) : terms.length === 0 ? (
        <Card>
          <EmptyState
            title="No terms configured"
            description="Add the academic year's terms in Settings → Academic settings first."
          />
        </Card>
      ) : reports.loading ? (
        <Card>
          <TableSkeleton rows={8} columns={5} />
        </Card>
      ) : reports.error ? (
        <Card>
          <EmptyState
            title="Could not load report cards"
            description="Refresh the page to try again."
          />
        </Card>
      ) : (reports.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="No report cards for this term"
            description="Publish exam results for this class first, then the report cards appear here."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Whole-class report cards"
            description={`${(reports.data ?? []).length} students · ${activeTerm}`}
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Total</TH>
                  <TH>Percentage</TH>
                  <TH>Grade</TH>
                  <TH>Attendance</TH>
                  <TH>Class rank</TH>
                </TR>
              </THead>
              <TBody>
                {(reports.data ?? []).map((report) => (
                  <TR key={report.studentId}>
                    <TD>
                      <span className="font-medium text-primary">{report.studentName}</span>
                      <span className="block text-xs text-body">{report.admissionNo}</span>
                    </TD>
                    <TD>
                      {report.totalMarks} / {report.maxTotal}
                    </TD>
                    <TD>{report.percentage}%</TD>
                    <TD>
                      {report.overallGrade ? (
                        <Badge tone={GRADE_TONE[report.overallGrade]}>
                          {report.overallGrade}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">—</Badge>
                      )}
                    </TD>
                    <TD>{report.attendancePercentage}%</TD>
                    <TD>
                      {report.classRank ? `${report.classRank} of ${report.totalStudents}` : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Student — their own card
 * ------------------------------------------------------------------ */

function StudentReport() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const { identity } = useIdentity();
  const student = identity?.student ?? null;
  const { calendar } = useSchoolCalendar();
  const terms = calendar?.terms ?? [];
  const [term, setTerm] = useState("");

  const activeTerm = term || terms[0]?.label || "";

  const report = useApi(
    () =>
      student && activeTerm
        ? schoolApi.getReportCard(schoolSlug, student.id, { term: activeTerm })
        : Promise.resolve(null),
    [schoolSlug, student?.id, activeTerm],
  );

  if (!student) {
    return (
      <Card>
        <EmptyState
          title="No student record linked"
          description="Ask the school office to connect your account to your student record."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My academic record"
        title="My report card"
        description="Published exam results, attendance and position for one term."
        action={
          terms.length > 0 ? (
            <div className="w-56">
              <Select
                label="Term"
                value={activeTerm}
                options={terms.map((row) => ({ value: row.label, label: row.label }))}
                onChange={(event) => setTerm(event.target.value)}
              />
            </div>
          ) : null
        }
      />

      {terms.length === 0 ? (
        <Card>
          <EmptyState
            title="No terms configured"
            description="The school has not set up terms yet, so there is no report card to open."
          />
        </Card>
      ) : report.loading ? (
        <Card>
          <TableSkeleton rows={6} columns={4} />
        </Card>
      ) : report.data ? (
        <ReportCardView report={report.data} />
      ) : (
        <Card>
          <EmptyState
            title="No report card yet"
            description="When your teachers publish results for this term, the report card appears here."
          />
        </Card>
      )}
    </div>
  );
}

function ReportCardView({ report }: { report: ReportCard }) {
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-ink">{report.studentName}</p>
            <p className="mt-1 text-sm text-body">
              {report.className} · {report.admissionNo} · {report.term}
            </p>
          </div>
          <div className="text-right text-sm text-body">
            <p>
              Class rank{" "}
              <span className="font-semibold text-ink">
                {report.classRank ? `${report.classRank} of ${report.totalStudents}` : "—"}
              </span>
            </p>
            <p>
              School rank{" "}
              <span className="font-semibold text-ink">{report.rank ?? "—"}</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total marks"
          value={`${report.totalMarks} / ${report.maxTotal}`}
        />
        <StatCard label="Percentage" value={`${report.percentage}%`} />
        <StatCard
          label="Overall grade"
          value={report.overallGrade ?? "—"}
          hint="Across published papers"
        />
        <StatCard
          label="Attendance"
          value={`${report.attendancePercentage}%`}
          hint="Excused days excluded"
        />
      </div>

      <Card>
        <CardHeader title="Subjects" description={`Published exams · ${report.term}`} />
        <CardBody className="p-0">
          {report.rows.length === 0 ? (
            <EmptyState title="No published exams" description="Nothing to show for this term." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Subject</TH>
                  <TH>Exam</TH>
                  <TH>Date</TH>
                  <TH>Score</TH>
                  <TH>Grade</TH>
                </TR>
              </THead>
              <TBody>
                {report.rows.map((row) => (
                  <TR key={row.examId}>
                    <TD className="font-medium text-primary">{row.subjectName}</TD>
                    <TD>{row.examName}</TD>
                    <TD>{formatDate(row.date)}</TD>
                    <TD>
                      {row.marksObtained ?? "—"} / {row.maxMarks}
                    </TD>
                    <TD>
                      {row.grade ? (
                        <Badge tone={GRADE_TONE[row.grade]}>{row.grade}</Badge>
                      ) : (
                        <span className="text-body">—</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/states";
import { PaginationBar } from "@/components/ui/pagination";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import {
  useApi,
  useMembership,
  useRole,
  useSchoolCalendar,
} from "@/lib/hooks";
import { MyResultsView } from "@/components/student/my-results";
import type { Exam, SchoolClass, Subject } from "@/types";

export default function ExamsPage() {
  const role = useRole();

  if (role === "STUDENT" || role === "PARENT") {
    return <MyResultsView isParent={role === "PARENT"} />;
  }

  return <StaffExams />;
}

function StaffExams() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const router = useRouter();
  const { calendar } = useSchoolCalendar();
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, loading, error, reload } = useApi(
    () => schoolApi.listExams(schoolSlug, { page, search: search || undefined }),
    [schoolSlug, page, search],
  );
  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);

  const exams = data?.data ?? [];
  const paginated = data ?? null;

  return (
    <RequireArea area="exams">
      <div className="space-y-6">
        <PageHeader
          title="Exams & Grades"
          description="Create exams, set maximum marks and enter results."
          action={
            <Button variant="accent" onClick={() => setCreateOpen(true)}>
              New exam
            </Button>
          }
        />

        <div className="flex gap-2">
          <Input
            label="Search"
            type="search"
            placeholder="Search exams by name or subject"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
        </div>

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
                    No exams created yet. Use “New exam” to add the first one.
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
                                    {exam.subjectName || "—"}
                                  </Badge>
                                </TD>
                                <TD>{exam.className || "—"}</TD>
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
                      {paginated && (
                        <PaginationBar result={paginated} onPageChange={setPage} />
                      )}
                    </>
                  )}
          </CardBody>
        </Card>

        <NewExamModal
          open={createOpen}
          schoolSlug={schoolSlug}
          classes={classes.data ?? []}
          subjects={subjects.data ?? []}
          terms={calendar?.terms.map((term) => term.label) ?? []}
          onClose={() => setCreateOpen(false)}
          onSaved={(exam) => {
            setCreateOpen(false);
            reload();
            router.push(`/${schoolSlug}/exams/${exam.id}/results`);
          }}
        />
      </div>
    </RequireArea>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function NewExamModal({
  open,
  schoolSlug,
  classes,
  subjects,
  terms,
  onClose,
  onSaved,
}: {
  open: boolean;
  schoolSlug: string;
  classes: SchoolClass[];
  subjects: Subject[];
  terms: string[];
  onClose: () => void;
  onSaved: (exam: Exam) => void;
}) {
  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState<string | null>(null);
  const [examDate, setExamDate] = useState(today());
  const [maxMarks, setMaxMarks] = useState("100");
  const [passMarks, setPassMarks] = useState("35");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sectionRows = classes.filter((row) => row.section);
  const section = sectionRows.find((row) => row.id === sectionId);
  const subjectOptions = subjects.filter((subject) => subject.classId === section?.classId);
  // Terms arrive after the modal mounts, so fall back to the first configured
  // term until the person explicitly picks one (including "No term").
  const activeTerm = term ?? terms[0] ?? "";

  function reset() {
    setName("");
    setSectionId("");
    setSubjectId("");
    setTerm(null);
    setExamDate(today());
    setMaxMarks("100");
    setPassMarks("35");
    setErrors({});
    setFormError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name the exam";
    if (!sectionId) next.sectionId = "Choose a class";
    if (!subjectId) next.subjectId = "Choose the subject";
    if (!examDate) next.examDate = "Choose the exam date";
    const max = Number(maxMarks);
    const pass = Number(passMarks);
    if (!Number.isFinite(max) || max < 1) next.maxMarks = "At least 1";
    if (!Number.isFinite(pass) || pass < 0) next.passMarks = "Cannot be negative";
    if (Number.isFinite(max) && Number.isFinite(pass) && pass > max) {
      next.passMarks = "Cannot be above the maximum";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setFormError(null);
    try {
      const exam = await schoolApi.createExam(schoolSlug, {
        name: name.trim(),
        sectionId,
        subjectId,
        term: activeTerm || null,
        examDate,
        maxMarks: max,
        passMarks: pass,
      });
      reset();
      onSaved(exam);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields);
        setFormError(Object.keys(error.fields).length > 0 ? null : error.message);
      } else {
        setFormError("Could not create this exam. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New exam"
      description="Set the paper up, then enter marks for the whole class."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="new-exam-form" isLoading={busy}>
            Create exam
          </Button>
        </>
      }
    >
      <form id="new-exam-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Exam name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          placeholder="Unit Test 1"
        />

        <Select
          label="Class"
          value={sectionId}
          options={[
            { value: "", label: sectionRows.length ? "Choose a class" : "No classes yet" },
            ...sectionRows.map((row) => ({ value: row.id, label: row.name })),
          ]}
          onChange={(event) => {
            setSectionId(event.target.value);
            setSubjectId("");
          }}
          error={errors.sectionId}
        />

        <Select
          label="Subject"
          value={subjectId}
          options={[
            {
              value: "",
              label: subjectOptions.length ? "Choose a subject" : "Choose a class first",
            },
            ...subjectOptions.map((row) => ({ value: row.id, label: row.name })),
          ]}
          onChange={(event) => setSubjectId(event.target.value)}
          error={errors.subjectId}
        />

        <Select
          label="Term"
          value={activeTerm}
          options={
            terms.length === 0
              ? [{ value: "", label: "No terms configured" }]
              : [{ value: "", label: "No term" }, ...terms.map((label) => ({ value: label, label }))]
          }
          onChange={(event) => setTerm(event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Exam date"
            type="date"
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
            error={errors.examDate}
          />
          <Input
            label="Maximum marks"
            type="number"
            min={1}
            value={maxMarks}
            onChange={(event) => setMaxMarks(event.target.value)}
            error={errors.maxMarks}
          />
        </div>

        <Input
          label="Pass marks"
          type="number"
          min={0}
          value={passMarks}
          onChange={(event) => setPassMarks(event.target.value)}
          error={errors.passMarks}
        />

        {formError ? (
          <p role="alert" className="text-sm text-danger-600">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

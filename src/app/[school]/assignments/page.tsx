"use client";

import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PaginationBar } from "@/components/ui/pagination";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import {
  compactErrors,
  dateError,
  hasErrors,
  integerError,
  textError,
} from "@/lib/validation";
import { ApiError, schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useRole } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import type {
  AssignmentListRow,
  AssignmentSubmissionRow,
  SubmissionStatus,
} from "@/types";

const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  LATE: "Late",
  GRADED: "Graded",
};

const SUBMISSION_TONE: Record<SubmissionStatus, "neutral" | "amber" | "brand" | "green" | "red"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "amber",
  SUBMITTED: "brand",
  LATE: "red",
  GRADED: "green",
};

export default function AssignmentsPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();
  const isStaff = role === "SCHOOL_ADMIN" || role === "TEACHER";
  // ?mine=true is resolved against this address, so it has to be in the deps.
  const accountEmail = useAuth((state) => state.user?.email);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [onlyMine, setOnlyMine] = useState(!isStaff);
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);

  const list = useApi(
    () =>
      schoolApi.listAssignments(schoolSlug, {
        page,
        search,
        status,
        classId,
        mine: onlyMine,
        email: accountEmail,
      }),
    [schoolSlug, page, search, status, classId, onlyMine, accountEmail],
  );

  function resetAnd<T>(setter: (value: T) => void) {
    return (value: T) => {
      setPage(1);
      setter(value);
    };
  }

  const rows = list.data?.data ?? [];

  return (
    <RequireArea area="assignments">
      <div className="space-y-6">
        <PageHeader
          title="Assignments"
          description={
            isStaff
              ? "Homework set across the school, and how each class is getting on."
              : "Work set for you, and where each piece has got to."
          }
          action={
            isStaff ? (
              <Button onClick={() => setCreateOpen(true)}>Create assignment</Button>
            ) : null
          }
        />

        <Card>
          <div className="grid gap-4 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search"
              type="search"
              placeholder="Search by title or subject"
              value={search}
              onChange={(event) => resetAnd(setSearch)(event.target.value)}
            />
            <Select
              label="Class"
              value={classId}
              onChange={(event) => resetAnd(setClassId)(event.target.value)}
              options={[
                { value: "", label: "All classes" },
                ...(classes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <Select
              label="Status"
              value={status}
              onChange={(event) => resetAnd(setStatus)(event.target.value)}
              options={[
                { value: "", label: "Any status" },
                { value: "OPEN", label: "Open" },
                { value: "CLOSED", label: "Closed" },
                { value: "DRAFT", label: "Draft" },
              ]}
            />

            {isStaff ? (
              <div className="flex flex-col justify-end gap-1.5">
                <span className="text-sm font-medium text-slate-700">Scope</span>
                <div className="flex gap-1">
                  <ScopeButton active={onlyMine} onClick={() => resetAnd(setOnlyMine)(true)}>
                    My tasks
                  </ScopeButton>
                  <ScopeButton active={!onlyMine} onClick={() => resetAnd(setOnlyMine)(false)}>
                    All tasks
                  </ScopeButton>
                </div>
              </div>
            ) : null}
          </div>

          {list.loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No assignments here"
              description={
                onlyMine
                  ? "Nothing has been set for your classes yet."
                  : "Try clearing the filters, or widening the class."
              }
              action={
                (search || status || classId) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatus("");
                      setClassId("");
                      setPage(1);
                    }}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Assignment</TH>
                    <TH>Class</TH>
                    <TH>Due</TH>
                    <TH>Handed in</TH>
                    <TH>{onlyMine ? "Your work" : "Average"}</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((assignment) => (
                    <AssignmentRow
                      key={assignment.id}
                      assignment={assignment}
                      onOpen={() => setOpenId(assignment.id)}
                    />
                  ))}
                </TBody>
              </Table>
              <PaginationBar result={list.data!} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>

      {openId ? (
        <AssignmentModal
          schoolSlug={schoolSlug}
          assignmentId={openId}
          isStaff={isStaff}
          onClose={() => setOpenId(null)}
        />
      ) : null}

      {createOpen ? (
        <CreateAssignmentModal
          schoolSlug={schoolSlug}
          classes={classes.data ?? []}
          subjects={subjects.data ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            list.reload();
          }}
        />
      ) : null}
    </RequireArea>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function AssignmentRow({
  assignment,
  onOpen,
}: {
  assignment: AssignmentListRow;
  onOpen: () => void;
}) {
  const { stats } = assignment;
  const handed = stats.submitted + stats.late + stats.graded;

  return (
    <TR className="cursor-pointer" onClick={onOpen}>
      <TD>
        <div className="flex items-start gap-3">
          <Avatar name={assignment.subjectName} size="sm" />
          <div>
            <span className="block font-medium text-slate-900">{assignment.title}</span>
            <span className="block text-xs text-slate-500">
              {assignment.subjectName} · {assignment.teacherName}
            </span>
          </div>
        </div>
      </TD>
      <TD>{assignment.className}</TD>
      <TD>
        <span className="block whitespace-nowrap">{assignment.dueDate}</span>
        <DueBadge daysLeft={assignment.daysLeft} status={assignment.status} />
      </TD>
      <TD>
        <span className="whitespace-nowrap">
          {handed}/{stats.total}
        </span>
        <span className="block text-xs text-slate-500">{stats.onTimeRate}% on time</span>
      </TD>
      <TD>
        {assignment.mine ? (
          <Badge tone={SUBMISSION_TONE[assignment.mine.status]}>
            {SUBMISSION_LABEL[assignment.mine.status]}
            {assignment.mine.marksObtained !== null ? ` · ${assignment.mine.marksObtained}/${assignment.maxMarks}` : ""}
          </Badge>
        ) : (
          <span className="whitespace-nowrap text-slate-600">
            {stats.averageMarks === null ? "—" : `${stats.averageMarks}`}
          </span>
        )}
      </TD>
    </TR>
  );
}

function DueBadge({
  daysLeft,
  status,
}: {
  daysLeft: number;
  status: string;
}) {
  if (status === "DRAFT") return <Badge tone="neutral">Draft</Badge>;
  if (daysLeft < 0) return <Badge tone="red">{Math.abs(daysLeft)}d overdue</Badge>;
  if (daysLeft <= 2) return <Badge tone="amber">{daysLeft === 0 ? "Due today" : `${daysLeft}d left`}</Badge>;
  return <Badge tone="green">{daysLeft}d left</Badge>;
}

/* ------------------------------------------------------------------ *
 * Detail — submissions, marking, and handing work in
 * ------------------------------------------------------------------ */

function AssignmentModal({
  schoolSlug,
  assignmentId,
  isStaff,
  onClose,
}: {
  schoolSlug: string;
  assignmentId: string;
  isStaff: boolean;
  onClose: () => void;
}) {
  const { identity } = useIdentity();
  const detail = useApi(() => schoolApi.getAssignment(schoolSlug, assignmentId), [
    schoolSlug,
    assignmentId,
  ]);

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = identity?.student ?? identity?.children[0] ?? null;
  const mine = detail.data?.submissions.find((row) => row.studentId === me?.id) ?? null;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      detail.reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading || !detail.data) {
    return (
      <Modal open onClose={onClose} title="Assignment" size="lg">
        <TableSkeleton rows={6} columns={4} />
      </Modal>
    );
  }

  const { assignment, submissions, stats } = detail.data;

  return (
    <Modal open onClose={onClose} title={assignment.title} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Badge tone="brand">{assignment.subjectName}</Badge>
          <span>{assignment.className}</span>
          <span>·</span>
          <span>{assignment.teacherName}</span>
          <span>·</span>
          <span>out of {assignment.maxMarks}</span>
          <DueBadge daysLeft={assignment.daysLeft} status={assignment.status} />
        </div>

        <p className="text-sm text-slate-600">{assignment.description}</p>

        {assignment.attachments.length > 0 ? (
          <ul className="space-y-1">
            {assignment.attachments.map((file) => (
              <li key={file.name} className="text-xs text-slate-500">
                📎 {file.name} · {file.sizeKb} KB
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Handed in" value={`${stats.submitted + stats.late + stats.graded}/${stats.total}`} />
          <StatCard label="On time" value={`${stats.onTimeRate}%`} tone="positive" />
          <StatCard label="Not started" value={stats.notStarted} tone="warning" />
          <StatCard label="Average" value={stats.averageMarks ?? "—"} />
        </div>

        {message ? <p className="text-xs text-red-600">{message}</p> : null}

        {!isStaff && me ? (
          <Card>
            <CardHeader title="Your work" description={`Set ${assignment.assignedOn}`} />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone={mine ? SUBMISSION_TONE[mine.status] : "neutral"}>
                  {mine ? SUBMISSION_LABEL[mine.status] : "Not started"}
                </Badge>
                {mine?.marksObtained !== null && mine?.marksObtained !== undefined ? (
                  <span className="text-sm text-slate-700">
                    {mine.marksObtained}/{assignment.maxMarks}
                  </span>
                ) : null}
              </div>
              {mine?.feedback ? (
                <p className="text-sm text-slate-600">“{mine.feedback}”</p>
              ) : null}
              {assignment.status !== "DRAFT" ? (
                <Button
                  size="sm"
                  isLoading={busy}
                  onClick={() =>
                    run(() =>
                      schoolApi.submitAssignment(schoolSlug, assignmentId, {
                        studentId: me.id,
                        status: "SUBMITTED",
                      }),
                    )
                  }
                >
                  Hand in
                </Button>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            Submissions {isStaff ? `(${submissions.length})` : ""}
          </h3>
          <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Status</TH>
                  <TH>Handed in</TH>
                  <TH>Marks</TH>
                  {isStaff ? <TH>Mark</TH> : null}
                </TR>
              </THead>
              <TBody>
                {submissions.map((row) => (
                  <SubmissionRow
                    key={row.id}
                    row={row}
                    maxMarks={assignment.maxMarks}
                    canGrade={isStaff && assignment.status !== "DRAFT"}
                    columns={isStaff ? 5 : 4}
                    busy={busy}
                    onGrade={(marks, feedback) =>
                      run(() =>
                        schoolApi.gradeSubmission(schoolSlug, assignmentId, {
                          studentId: row.studentId,
                          marksObtained: marks,
                          feedback,
                        }),
                      )
                    }
                  />
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SubmissionRow({
  row,
  maxMarks,
  canGrade,
  columns,
  busy,
  onGrade,
}: {
  row: AssignmentSubmissionRow;
  maxMarks: number;
  canGrade: boolean;
  columns: number;
  busy: boolean;
  onGrade: (marks: number, feedback?: string) => void;
}) {
  const [marks, setMarks] = useState(row.marksObtained?.toString() ?? "");
  const [feedback, setFeedback] = useState(row.feedback ?? "");
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TR>
        <TD>
          <span className="font-medium text-slate-900">{row.studentName}</span>
          <span className="block text-xs text-slate-500">{row.admissionNo}</span>
        </TD>
        <TD>
          <Badge tone={SUBMISSION_TONE[row.status]}>{SUBMISSION_LABEL[row.status]}</Badge>
        </TD>
        <TD className="whitespace-nowrap text-xs">
          {row.submittedAt ? row.submittedAt.slice(0, 10) : "—"}
        </TD>
        <TD className="whitespace-nowrap">
          {row.marksObtained === null ? "—" : `${row.marksObtained}/${maxMarks}`}
        </TD>
        {canGrade ? (
          <TD>
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {expanded ? "Cancel" : row.marksObtained === null ? "Mark" : "Edit"}
            </button>
          </TD>
        ) : null}
      </TR>

      {canGrade && expanded ? (
        <TR>
          <TD colSpan={columns} className="bg-slate-50">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-28">
                <label htmlFor={`marks-${row.id}`} className="text-xs font-medium text-slate-700">
                  Marks (out of {maxMarks})
                </label>
                <input
                  id={`marks-${row.id}`}
                  type="number"
                  min={0}
                  max={maxMarks}
                  value={marks}
                  onChange={(event) => setMarks(event.target.value)}
                  className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300"
                />
              </div>
              <div className="min-w-56 flex-1">
                <label htmlFor={`feedback-${row.id}`} className="text-xs font-medium text-slate-700">
                  Feedback
                </label>
                <input
                  id={`feedback-${row.id}`}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Optional note for the student"
                  className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300"
                />
              </div>
              <Button
                size="sm"
                isLoading={busy}
                onClick={() => onGrade(Number(marks), feedback || undefined)}
              >
                Save mark
              </Button>
            </div>
          </TD>
        </TR>
      ) : null}
    </>
  );
}

function CreateAssignmentModal({
  schoolSlug,
  classes,
  subjects,
  onClose,
  onCreated,
}: {
  schoolSlug: string;
  classes: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  });
  const [maxMarks, setMaxMarks] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Why each field is validated before the call:
    // - title: an assignment with no name cannot be found in the student list.
    // - class / subject: a paper belongs to exactly one class and subject.
    // - due date: students and the timetable sort by this date.
    // - max marks: must be a whole number 1-100 so results are comparable.
    const next: Record<string, string | null> = {};
    next.title = textError(title, "Title", { min: 1, max: 150 });
    if (!classId) next.classId = "Choose a class.";
    if (!subjectId) next.subjectId = "Choose the subject.";
    next.dueDate = dateError(dueDate, "Due date", { required: true });
    next.maxMarks = integerError(maxMarks, {
      label: "Max marks",
      min: 1,
      max: 100,
      required: true,
    });
    setFields(compactErrors(next));
    if (hasErrors(next)) {
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await schoolApi.createAssignment(schoolSlug, {
        title: title.trim(),
        description: description.trim(),
        classId,
        subjectId,
        dueDate,
        maxMarks: Number(maxMarks) || 20,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Assignment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        ) : null}

        <Input
          label="Title"
          required
          error={fields.title}
          placeholder="e.g. Chapter 4 Exercise Problems"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Instructions for students..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Class"
            value={classId}
            error={fields.classId}
            onChange={(e) => setClassId(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Subject"
            value={subjectId}
            error={fields.subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Due Date"
            type="date"
            required
            error={fields.dueDate}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Input
            label="Max Marks"
            type="number"
            min={1}
            max={100}
            required
            error={fields.maxMarks}
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Create Assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
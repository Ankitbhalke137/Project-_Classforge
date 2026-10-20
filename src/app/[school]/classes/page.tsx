"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import {
  useApi,
  useCanPerform,
  useDebounced,
  useMembership,
} from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import type {
  AcademicYear,
  SchoolClass,
  Subject,
  Teacher,
  TeachingAssignment,
  TimetablePeriod,
  TimetableSlot,
} from "@/types";
import { WEEKDAYS } from "@/types";

export default function ClassesPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const canManage = useCanPerform("manageClasses");

  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<SchoolClass | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);

  const classes = useApi(
    () => schoolApi.listClasses(schoolSlug, { grade, search: debouncedSearch }),
    [schoolSlug, grade, debouncedSearch],
  );
  const allClasses = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);
  const teachers = useApi(() => schoolApi.listTeachers(schoolSlug), [schoolSlug]);
  const years = useApi(() => schoolApi.listAcademicYears(schoolSlug), [schoolSlug]);

  const rows = classes.data ?? [];
  const grades = useMemo(
    () => [...new Set((allClasses.data ?? []).map((row) => row.grade))].sort(),
    [allClasses.data],
  );

  const seated = rows.reduce((sum, item) => sum + item.studentCount, 0);
  const capacity = rows.reduce((sum, item) => sum + item.capacity, 0);
  const filtersActive = Boolean(grade || debouncedSearch);
  const activeYear = (years.data ?? []).find((year) => year.status === "ACTIVE") ?? null;

  function reloadAll(message: string) {
    setNotice(message);
    setActionError(null);
    classes.reload();
    allClasses.reload();
    subjects.reload();
    teachers.reload();
    years.reload();
  }

  return (
    <RequireArea area="classes">
      <div className="space-y-6">
        <PageHeader
          title="Classes"
          description="Every section in the school, who teaches it, and the weekly timetable."
          eyebrow={activeYear ? `Academic year · ${activeYear.name}` : undefined}
          action={
            canManage ? <Button onClick={() => setCreateOpen(true)}>New class</Button> : null
          }
        />

        {actionError ? (
          <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {actionError}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-secondary-strong">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sections"
            value={classes.data ? formatNumber(rows.length) : "—"}
            hint="Classes on the roll"
          />
          <StatCard
            label="Students seated"
            value={classes.loading ? "—" : formatNumber(seated)}
            hint={capacity > 0 ? `of ${formatNumber(capacity)} places` : "No capacity set"}
            tone={capacity > 0 && seated / capacity >= 0.9 ? "warning" : "default"}
          />
          <StatCard
            label="Subjects"
            value={subjects.data ? formatNumber(subjects.data.length) : "—"}
            hint="Across every class"
            tone="positive"
          />
          <StatCard
            label="Teachers"
            value={teachers.data ? formatNumber(teachers.data.length) : "—"}
            hint="On staff"
          />
        </div>

        {!activeYear && years.data ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            There is no active academic year.{" "}
            <Link href={`/${schoolSlug}/settings`} className="font-semibold underline">
              Add one in Academic settings
            </Link>{" "}
            before creating classes.
          </div>
        ) : null}

        <Card>
          <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2">
            <Input
              label="Search"
              type="search"
              placeholder="Search by class or room"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label="Grade"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              options={[
                { value: "", label: "All grades" },
                ...grades.map((value) => ({ value, label: value })),
              ]}
            />
          </div>

          {classes.loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : classes.error ? (
            <ErrorState onRetry={classes.reload} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={filtersActive ? "No classes match" : "No classes yet"}
              description={
                filtersActive
                  ? "Try clearing the search or picking a different grade."
                  : "Create the first class. Sections, subjects and the timetable hang off it."
              }
              action={
                filtersActive ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setGrade("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : canManage ? (
                  <Button onClick={() => setCreateOpen(true)}>New class</Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((schoolClass) => (
                <ClassCard
                  key={schoolClass.id}
                  schoolClass={schoolClass}
                  subjectCount={schoolClass.subjectIds.length}
                  onOpen={() => {
                    setNotice(null);
                    setDetailFor(schoolClass);
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <ClassFormModal
        key={createOpen ? `new-${activeYear?.id ?? "none"}` : "closed"}
        open={createOpen}
        mode="create"
        schoolSlug={schoolSlug}
        schoolClass={null}
        years={years.data ?? []}
        teachers={teachers.data ?? []}
        onClose={() => setCreateOpen(false)}
        onSaved={(message) => {
          setCreateOpen(false);
          reloadAll(message);
        }}
      />

      {detailFor ? (
        <ClassDetailModal
          schoolSlug={schoolSlug}
          schoolClass={detailFor}
          classRows={(allClasses.data ?? []).filter(
            (row) => row.classId === (detailFor.classId ?? detailFor.id),
          )}
          subjects={(subjects.data ?? []).filter(
            (subject) => subject.classId === (detailFor.classId ?? detailFor.id),
          )}
          allSubjects={subjects.data ?? []}
          teachers={teachers.data ?? []}
          canManage={canManage}
          onClose={() => setDetailFor(null)}
          onChanged={(message) => {
            reloadAll(message);
            // Keep the modal open on the refreshed row for this class.
            const refreshed = (allClasses.data ?? []).filter(
              (row) => row.classId === (detailFor.classId ?? detailFor.id),
            );
            if (refreshed.length) setDetailFor(refreshed[0]);
          }}
          onDeleted={() => {
            setDetailFor(null);
            reloadAll("Class deleted.");
          }}
        />
      ) : null}
    </RequireArea>
  );
}

function ClassCard({
  schoolClass,
  subjectCount,
  onOpen,
}: {
  schoolClass: SchoolClass;
  subjectCount: number;
  onOpen: () => void;
}) {
  const full = schoolClass.capacity > 0 && schoolClass.studentCount >= schoolClass.capacity;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{schoolClass.name}</h3>
          <p className="text-xs text-body">{schoolClass.room || "No room set"}</p>
        </div>
        <Badge tone={full ? "amber" : "green"}>
          {schoolClass.capacity > 0
            ? `${schoolClass.studentCount}/${schoolClass.capacity}`
            : `${schoolClass.studentCount} seated`}
        </Badge>
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-body">Homeroom</dt>
          <dd className="truncate font-medium text-ink">
            {schoolClass.homeroomTeacherName || "Vacant"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-body">Subjects</dt>
          <dd className="font-medium text-ink">{subjectCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-body">Sections</dt>
          <dd className="font-medium text-ink">{schoolClass.sectionCount ?? 1}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onOpen}
        className="mt-auto text-left text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        Manage class →
      </button>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Class detail
 * ------------------------------------------------------------------ */

const TABS = ["details", "sections", "subjects", "teachers", "timetable"] as const;
type Tab = (typeof TABS)[number];

function ClassDetailModal({
  schoolSlug,
  schoolClass,
  classRows,
  subjects,
  allSubjects,
  teachers,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  schoolSlug: string;
  schoolClass: SchoolClass;
  classRows: SchoolClass[];
  subjects: Subject[];
  allSubjects: Subject[];
  teachers: Teacher[];
  canManage: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onDeleted: () => void;
}) {
  const classId = schoolClass.classId ?? schoolClass.id;
  const [tab, setTab] = useState<Tab>("details");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const sectionRows = classRows.filter((row) => row.section);
  const periods = useApi(() => schoolApi.listTimetablePeriods(schoolSlug), [schoolSlug]);

  async function removeClass() {
    setBusy(true);
    setError(null);
    try {
      await schoolApi.deleteClass(schoolSlug, classId);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this class.");
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={schoolClass.name}
      description={`${schoolClass.grade} · ${schoolClass.room || "No room"} · ${
        schoolClass.capacity > 0
          ? `${schoolClass.studentCount} of ${schoolClass.capacity} places filled`
          : `${schoolClass.studentCount} students`
      }`}
      size="lg"
    >
      <div className="space-y-5">
        {error ? (
          <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-secondary-strong">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setError(null);
              }}
              aria-pressed={tab === value}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === value
                  ? "bg-primary text-on-primary"
                  : "border border-line bg-white text-body hover:bg-brand-50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {tab === "details" ? (
          <ClassDetailsTab
            schoolSlug={schoolSlug}
            schoolClass={schoolClass}
            teachers={teachers}
            canManage={canManage}
            onSaved={(message) => {
              setNotice(message);
              setError(null);
              onChanged(message);
            }}
            onError={setError}
            onDelete={() => setDeleteOpen(true)}
          />
        ) : null}

        {tab === "sections" ? (
          <SectionsTab
            schoolSlug={schoolSlug}
            classId={classId}
            rows={sectionRows}
            canManage={canManage}
            onChanged={(message) => {
              setNotice(message);
              setError(null);
              onChanged(message);
            }}
            onError={setError}
          />
        ) : null}

        {tab === "subjects" ? (
          <SubjectsTab
            schoolSlug={schoolSlug}
            classId={classId}
            subjects={subjects}
            allSubjects={allSubjects}
            canManage={canManage}
            onChanged={(message) => {
              setNotice(message);
              setError(null);
              onChanged(message);
            }}
            onError={setError}
          />
        ) : null}

        {tab === "teachers" ? (
          <TeachersTab
            schoolSlug={schoolSlug}
            sections={sectionRows}
            subjects={subjects}
            teachers={teachers}
            canManage={canManage}
            onChanged={(message) => {
              setNotice(message);
              setError(null);
              onChanged(message);
            }}
            onError={setError}
          />
        ) : null}

        {tab === "timetable" ? (
          <TimetableTab
            schoolSlug={schoolSlug}
            sections={sectionRows}
            subjects={subjects}
            teachers={teachers}
            periods={periods.data ?? []}
            periodsLoading={periods.loading}
            canManage={canManage}
            onChanged={(message) => {
              setNotice(message);
              setError(null);
              onChanged(message);
            }}
            onError={setError}
          />
        ) : null}
      </div>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeClass}
        title="Delete class"
        message={`Delete ${schoolClass.name}? This only works if it has no students or exams.`}
        confirmLabel="Delete class"
        isPending={busy}
      />
    </Modal>
  );
}

function ClassDetailsTab({
  schoolSlug,
  schoolClass,
  teachers,
  canManage,
  onSaved,
  onError,
  onDelete,
}: {
  schoolSlug: string;
  schoolClass: SchoolClass;
  teachers: Teacher[];
  canManage: boolean;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onDelete: () => void;
}) {
  const classId = schoolClass.classId ?? schoolClass.id;
  const [name, setName] = useState(schoolClass.grade);
  const [room, setRoom] = useState(schoolClass.room);
  const [capacity, setCapacity] = useState(String(schoolClass.capacity));
  const [homeroomTeacherId, setHomeroomTeacherId] = useState(
    schoolClass.homeroomTeacherId ?? "",
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      await schoolApi.updateClass(schoolSlug, classId, {
        name,
        room: room || null,
        capacity: Number(capacity) || 0,
        homeroomTeacherId: homeroomTeacherId || null,
      });
      onSaved("Class details were updated.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        if (!Object.keys(err.fields).length) onError(err.message);
      } else {
        onError("Could not save this class.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Class name"
          required
          value={name}
          error={fields.name}
          disabled={!canManage}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Room"
          value={room}
          error={fields.room}
          disabled={!canManage}
          onChange={(event) => setRoom(event.target.value)}
        />
        <Input
          label="Capacity"
          type="number"
          min={0}
          value={capacity}
          error={fields.capacity}
          disabled={!canManage}
          onChange={(event) => setCapacity(event.target.value)}
        />
        <Select
          label="Homeroom teacher"
          value={homeroomTeacherId}
          disabled={!canManage}
          options={[
            { value: "", label: "Vacant" },
            ...teachers.map((teacher) => ({ value: teacher.id, label: teacher.name })),
          ]}
          onChange={(event) => setHomeroomTeacherId(event.target.value)}
        />
      </div>

      {canManage ? (
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="submit" isLoading={busy}>
            Save changes
          </Button>
          <Button type="button" variant="secondary" onClick={onDelete}>
            Delete class
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function SectionsTab({
  schoolSlug,
  classId,
  rows,
  canManage,
  onChanged,
  onError,
}: {
  schoolSlug: string;
  classId: string;
  rows: SchoolClass[];
  canManage: boolean;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await schoolApi.addSection(schoolSlug, classId, name.trim());
      setName("");
      onChanged("Section added.");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not add this section.");
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!editing || !editName.trim()) return;
    setBusy(true);
    try {
      await schoolApi.updateSection(schoolSlug, editing.id, editName.trim());
      setEditing(null);
      onChanged("Section renamed.");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not rename this section.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await schoolApi.deleteSection(schoolSlug, deleting.id);
      setDeleting(null);
      onChanged("Section deleted.");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not delete this section.");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-body">
          This class has no sections yet. A section is what students, attendance and the timetable
          attach to.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{row.section}</span>
                <span className="block text-xs text-body">{row.studentCount} students</span>
              </span>
              {canManage ? (
                <span className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing(row);
                      setEditName(row.section);
                    }}
                  >
                    Rename
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setDeleting(row)}>
                    Delete
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input
              label="New section"
              placeholder="A"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" isLoading={busy}>
            Add section
          </Button>
        </form>
      ) : null}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Rename section"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={rename} isLoading={busy}>
              Save
            </Button>
          </>
        }
      >
        <Input label="Section name" value={editName} onChange={(event) => setEditName(event.target.value)} />
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete section"
        message={
          deleting
            ? `Delete section ${deleting.section}? This only works if it has no students or exams.`
            : ""
        }
        confirmLabel="Delete"
        isPending={busy}
      />
    </div>
  );
}

function SubjectsTab({
  schoolSlug,
  classId,
  subjects,
  canManage,
  onChanged,
  onError,
}: {
  schoolSlug: string;
  classId: string;
  subjects: Subject[];
  allSubjects: Subject[];
  canManage: boolean;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await schoolApi.createSubject(schoolSlug, {
        classId,
        name: name.trim(),
        code: code.trim() || null,
      });
      setName("");
      setCode("");
      onChanged("Subject added.");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not add this subject.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await schoolApi.deleteSubject(schoolSlug, deleting.id);
      setDeleting(null);
      onChanged("Subject deleted.");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not delete this subject.");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {subjects.length === 0 ? (
        <p className="text-sm text-body">
          No subjects for this class yet. Add them here, then assign a teacher to each.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {subject.name}
                  {subject.code ? (
                    <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-secondary-strong">
                      {subject.code}
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-body">
                  {subject.teacherCount} teacher{subject.teacherCount === 1 ? "" : "s"} assigned
                </span>
              </span>
              {canManage ? (
                <Button variant="secondary" size="sm" onClick={() => setDeleting(subject)}>
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <Input
            label="Subject"
            placeholder="Mathematics"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Code"
            placeholder="MATH"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button type="submit" isLoading={busy}>
            Add subject
          </Button>
        </form>
      ) : null}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete subject"
        message={
          deleting
            ? `Delete ${deleting.name}? This only works if no teacher, timetable slot or exam uses it.`
            : ""
        }
        confirmLabel="Delete"
        isPending={busy}
      />
    </div>
  );
}

function TeachersTab({
  schoolSlug,
  sections,
  subjects,
  teachers,
  canManage,
  onChanged,
  onError,
}: {
  schoolSlug: string;
  sections: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  canManage: boolean;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TeachingAssignment | null>(null);

  const assignments = useApi(
    () =>
      schoolApi.listTeachingAssignments(schoolSlug, {
        sectionId: sectionId || undefined,
      }),
    [schoolSlug, sectionId],
  );

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!sectionId || !subjectId || !teacherId) return;
    setBusy(true);
    try {
      await schoolApi.createTeachingAssignment(schoolSlug, {
        sectionId,
        subjectId,
        teacherId,
      });
      onChanged("Teacher assigned.");
      assignments.reload();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not assign this teacher.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await schoolApi.deleteTeachingAssignment(schoolSlug, deleting.id);
      setDeleting(null);
      onChanged("Teacher assignment removed.");
      assignments.reload();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not remove this assignment.");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (sections.length === 0) {
    return (
      <p className="text-sm text-body">
        Add at least one section before assigning teachers. Assignments belong to a section.
      </p>
    );
  }

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-body">
        Add subjects for this class first, then assign the teacher who takes each one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Select
        label="Section"
        value={sectionId}
        options={sections.map((section) => ({
          value: section.id,
          label: section.section,
        }))}
        onChange={(event) => setSectionId(event.target.value)}
      />

      {assignments.loading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : (assignments.data ?? []).length === 0 ? (
        <p className="text-sm text-body">No teacher is assigned in this section yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Teacher</TH>
              <TH>Subject</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {(assignments.data ?? []).map((row) => (
              <TR key={row.id}>
                <TD>{row.teacherName}</TD>
                <TD>
                  {row.subjectName}
                  {row.subjectCode ? (
                    <span className="ml-2 text-xs text-body">{row.subjectCode}</span>
                  ) : null}
                </TD>
                <TD>
                  {canManage ? (
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setDeleting(row)}>
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {canManage ? (
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <Select
            label="Teacher"
            value={teacherId}
            options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }))}
            onChange={(event) => setTeacherId(event.target.value)}
          />
          <Select
            label="Subject"
            value={subjectId}
            options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
            onChange={(event) => setSubjectId(event.target.value)}
          />
          <Button type="submit" isLoading={busy}>
            Assign teacher
          </Button>
        </form>
      ) : null}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Remove assignment"
        message={
          deleting
            ? `Remove ${deleting.teacherName} from ${deleting.subjectName}?`
            : ""
        }
        confirmLabel="Remove"
        isPending={busy}
      />
    </div>
  );
}

function TimetableTab({
  schoolSlug,
  sections,
  subjects,
  teachers,
  periods,
  periodsLoading,
  canManage,
  onChanged,
  onError,
}: {
  schoolSlug: string;
  sections: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  periods: TimetablePeriod[];
  periodsLoading: boolean;
  canManage: boolean;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");

  const slots = useApi(
    () => (sectionId ? schoolApi.getClassTimetable(schoolSlug, sectionId) : Promise.resolve([])),
    [schoolSlug, sectionId],
  );

  if (sections.length === 0) {
    return <p className="text-sm text-body">Add a section before building a timetable.</p>;
  }

  if (periodsLoading) return <TableSkeleton rows={6} columns={7} />;

  if (periods.length === 0) {
    return (
      <p className="text-sm text-body">
        No periods are defined. Add them in Settings → Academic settings, then come back.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Select
        label="Section"
        value={sectionId}
        options={sections.map((section) => ({
          value: section.id,
          label: section.section,
        }))}
        onChange={(event) => setSectionId(event.target.value)}
      />

      <Timetable
        slots={slots.data ?? []}
        periods={periods}
        subjects={subjects}
        loading={slots.loading}
        error={slots.error}
        onRetry={slots.reload}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${schoolSlug}/schedule?class=${sectionId}`}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Open the full schedule →
        </Link>
        {canManage ? (
          <span className="text-xs text-body">
            Edit the grid on the schedule page.
          </span>
        ) : null}
      </div>

      <p className="text-xs text-body">
        {teachers.length} teachers available · {subjects.length} subjects in this class.
      </p>
    </div>
  );
}

function Timetable({
  slots,
  periods,
  subjects,
  loading,
  error,
  onRetry,
}: {
  slots: TimetableSlot[];
  periods: TimetablePeriod[];
  subjects: Subject[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  if (loading) return <TableSkeleton rows={6} columns={7} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (slots.length === 0) {
    return <p className="text-sm text-body">No slots set for this section yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Period</TH>
            {WEEKDAYS.map((day) => (
              <TH key={day}>{day.slice(0, 3)}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {periods.map((period) => (
            <TR key={period.id}>
              <TD className="whitespace-nowrap font-medium text-ink">
                {period.period}
                <span className="block text-[11px] font-normal text-body">
                  {period.startTime}–{period.endTime}
                </span>
              </TD>
              {WEEKDAYS.map((day) => {
                const slot = slots.find(
                  (row) => row.day === day && row.period === period.period,
                );
                return (
                  <TD key={day} className="min-w-24 align-top">
                    {slot ? (
                      <span className="text-sm text-ink">
                        {subjectById.get(slot.subjectId)?.code ||
                          subjectById.get(slot.subjectId)?.name ||
                          "Subject"}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Create / edit class
 * ------------------------------------------------------------------ */

function ClassFormModal({
  open,
  mode,
  schoolSlug,
  schoolClass,
  years,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  schoolSlug: string;
  schoolClass: SchoolClass | null;
  years: AcademicYear[];
  teachers: Teacher[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const activeYear = years.find((year) => year.status === "ACTIVE") ?? years[0] ?? null;
  const [name, setName] = useState(schoolClass?.grade ?? "");
  const [academicYearId, setAcademicYearId] = useState(
    schoolClass?.academicYearId ?? activeYear?.id ?? "",
  );
  const [room, setRoom] = useState(schoolClass?.room ?? "");
  const [capacity, setCapacity] = useState(String(schoolClass?.capacity ?? ""));
  const [homeroomTeacherId, setHomeroomTeacherId] = useState(
    schoolClass?.homeroomTeacherId ?? "",
  );
  const [sections, setSections] = useState("A");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFields({});

    try {
      if (mode === "create") {
        await schoolApi.createClass(schoolSlug, {
          name,
          academicYearId: academicYearId || undefined,
          room: room || null,
          capacity: Number(capacity) || 0,
          homeroomTeacherId: homeroomTeacherId || null,
          sections: sections
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        });
        onSaved(`${name} was created.`);
      } else if (schoolClass) {
        await schoolApi.updateClass(schoolSlug, schoolClass.classId ?? schoolClass.id, {
          name,
          room: room || null,
          capacity: Number(capacity) || 0,
          homeroomTeacherId: homeroomTeacherId || null,
        });
        onSaved(`${name} was updated.`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else {
        setFormError("Could not save this class. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New class" : "Edit class"}
      description={
        mode === "create"
          ? "A class belongs to an academic year. Add its sections now or later."
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" isLoading={busy}>
            {mode === "create" ? "Create class" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4">
        {formError ? (
          <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {formError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Class name"
            required
            placeholder="Grade 6"
            value={name}
            error={fields.name}
            onChange={(event) => setName(event.target.value)}
          />
          <Select
            label="Academic year"
            value={academicYearId}
            disabled={mode === "edit"}
            error={fields.academicYearId}
            options={years.map((year) => ({
              value: year.id,
              label: `${year.name}${year.status === "ACTIVE" ? " (active)" : ""}`,
            }))}
            onChange={(event) => setAcademicYearId(event.target.value)}
          />
          <Input
            label="Room"
            value={room}
            error={fields.room}
            onChange={(event) => setRoom(event.target.value)}
          />
          <Input
            label="Capacity"
            type="number"
            min={0}
            value={capacity}
            error={fields.capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
          <Select
            label="Homeroom teacher"
            value={homeroomTeacherId}
            options={[
              { value: "", label: "Vacant" },
              ...teachers.map((teacher) => ({ value: teacher.id, label: teacher.name })),
            ]}
            onChange={(event) => setHomeroomTeacherId(event.target.value)}
          />
          {mode === "create" ? (
            <Input
              label="Sections"
              hint="Comma-separated, e.g. A, B"
              value={sections}
              onChange={(event) => setSections(event.target.value)}
            />
          ) : null}
        </div>

        {years.length === 0 ? (
          <p className="text-sm text-danger-600">
            Add an academic year in Settings → Academic settings first.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

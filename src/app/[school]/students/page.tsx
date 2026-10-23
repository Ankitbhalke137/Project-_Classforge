"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { PaginationBar } from "@/components/ui/pagination";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import {
  useApi,
  useCanPerform,
  useDebounced,
  useIdentity,
  useMembership,
  useRole,
} from "@/lib/hooks";
import type { SchoolClass, Student } from "@/types";

const SORT_OPTIONS = [
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "admissionNo:asc", label: "Admission no." },
  { value: "createdAt:desc", label: "Newest first" },
] as const;

export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsRoster />
    </Suspense>
  );
}

function StudentsRoster() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const role = useRole();
  const { identity } = useIdentity();
  const canManage = useCanPerform("manageRoster");
  const canCreate = useCanPerform("createStudent");
  const canResend = useCanPerform("resendStudentCredentials");
  const isTeacher = role === "TEACHER";
  const teacherId = identity?.teacher?.id ?? "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(urlSearch);
  const [classId, setClassId] = useState("");
  const [sort, setSort] = useState<string>("name:asc");
  const query = useDebounced(search);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deactivating, setDeactivating] = useState<Student | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    student: Student;
    email: string;
    temporaryPassword: string;
    emailSent: boolean;
    emailError: string | null;
  } | null>(null);

  // Rows are sections ("Grade 6 - A"), so the class filter uses the parent id.
  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);

  // A teacher may only add a student to a section they teach or are homeroom of.
  const assignments = useApi(
    () =>
      teacherId
        ? schoolApi.listTeachingAssignments(schoolSlug, { teacherId })
        : Promise.resolve([]),
    [schoolSlug, teacherId],
  );

  const { data, loading, error, reload } = useApi(
    () =>
      schoolApi.listStudents(schoolSlug, {
        page,
        search: query,
        classId: classId || undefined,
        sort,
      }),
    [schoolSlug, page, query, classId, sort],
  );

  const classOptions = [
    { value: "", label: "All classes" },
    ...Array.from(
      new Map(
        (classes.data ?? []).map((row) => [row.classId ?? row.id, row.grade || row.name]),
      ).entries(),
    ).map(([value, label]) => ({ value, label })),
  ];

  const filtersActive = Boolean(search || classId);

  const assignedSections = new Set(
    (assignments.data ?? []).map((row) => row.sectionId),
  );
  const formClasses = isTeacher
    ? (classes.data ?? []).filter(
        (row) => row.homeroomTeacherId === teacherId || assignedSections.has(row.id),
      )
    : classes.data ?? [];

  function afterChange(message: string) {
    setNotice(message);
    setActionError(null);
    reload();
  }

  async function resendCredentials(student: Student) {
    setPendingId(student.id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await schoolApi.resendStudentCredentials(schoolSlug, student.id);
      setCredentials({ student, ...result });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Could not resend this student's credentials.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function reactivate(student: Student) {
    setPendingId(student.id);
    setActionError(null);
    try {
      await schoolApi.updateStudent(schoolSlug, student.id, { status: "ACTIVE" });
      afterChange(`${student.name} is active again.`);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not reactivate this student.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function deactivate(student: Student) {
    setPendingId(student.id);
    setActionError(null);
    try {
      await schoolApi.deleteStudent(schoolSlug, student.id);
      setDeactivating(null);
      afterChange(`${student.name} was deactivated. Their record is kept.`);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not deactivate this student.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <RequireArea area="students">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Enrolment & records"
          title="Students directory"
          description="Server-paginated roster with search, class filter and sorting."
          action={
            canCreate ? (
              <Button onClick={() => setAddOpen(true)}>Add student</Button>
            ) : null
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

        <Card>
          <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search"
              type="search"
              placeholder="Name, admission no., email or class"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Class"
              value={classId}
              options={classOptions}
              onChange={(event) => {
                setClassId(event.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Sort by"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            />
            {filtersActive ? (
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setClassId("");
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : error || !data ? (
            <p className="px-4 py-10 text-center text-sm text-body">
              Could not load the roster. Refresh the page to try again.
            </p>
          ) : data.data.length === 0 ? (
            <EmptyState
              title={filtersActive ? "No students match these filters" : "No students yet"}
              description={
                filtersActive
                  ? "Try a different search or class."
                  : "Add the first student to start the roster."
              }
              action={
                filtersActive ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setClassId("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : canCreate ? (
                  <Button onClick={() => setAddOpen(true)}>Add student</Button>
                ) : null
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>Admission no.</TH>
                    <TH>Class</TH>
                    <TH>Guardian</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.data.map((student) => {
                    const busy = pendingId === student.id;

                    return (
                      <TR key={student.id}>
                        <TD>
                          <span className="font-semibold text-primary">{student.name}</span>
                          <span className="block text-xs text-body">
                            {student.email || student.phone || `Roll ${student.admissionNo}`}
                          </span>
                        </TD>
                        <TD>{student.admissionNo}</TD>
                        <TD>{student.className}</TD>
                        <TD>
                          {student.guardianName || "—"}
                          {student.guardianPhone ? (
                            <span className="block text-xs text-body">
                              {student.guardianPhone}
                            </span>
                          ) : null}
                        </TD>
                        <TD>
                          <Badge tone={student.status === "ACTIVE" ? "green" : "neutral"}>
                            {student.status}
                          </Badge>
                        </TD>
                        <TD>
                          {canManage || (canResend && student.email) ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {canResend && student.email ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => resendCredentials(student)}
                                >
                                  Resend login
                                </Button>
                              ) : null}
                              {canManage ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => {
                                      setNotice(null);
                                      setEditing(student);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  {student.status === "ACTIVE" ? (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => {
                                        setNotice(null);
                                        setDeactivating(student);
                                      }}
                                    >
                                      Deactivate
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => reactivate(student)}
                                    >
                                      Reactivate
                                    </Button>
                                  )}
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-body">View only</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <PaginationBar result={data} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>

      <StudentFormModal
        key={addOpen ? "new" : editing?.id ?? "closed"}
        open={addOpen || editing !== null}
        schoolSlug={schoolSlug}
        student={editing}
        classes={formClasses}
        isTeacher={isTeacher}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={(student, created) => {
          setAddOpen(false);
          setEditing(null);
          afterChange(
            created
              ? `${student.name} was added to the roster.`
              : `${student.name} was updated.`,
          );
        }}
      />

      <Modal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title="Login details reissued"
        description={
          credentials
            ? `${credentials.student.name} has a new temporary password.`
            : undefined
        }
        footer={<Button onClick={() => setCredentials(null)}>Done</Button>}
      >
        {credentials ? (
          <div className="space-y-3">
            <p className="text-sm text-body">
              {credentials.emailSent
                ? `The new password was emailed to ${credentials.email}. It is shown once here as a backup.`
                : "The email could not be sent. Share this password with the student directly."}
            </p>
            <p className="select-all rounded-xl border border-line bg-page px-4 py-3 font-mono text-sm text-ink">
              {credentials.temporaryPassword}
            </p>
            {credentials.emailError ? (
              <p className="text-xs text-danger-600">{credentials.emailError}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => (deactivating ? deactivate(deactivating) : undefined)}
        title="Deactivate student"
        message={
          deactivating
            ? `${deactivating.name} will be marked inactive and removed from the active roster. Their record, attendance and marks are kept, and you can reactivate them later.`
            : ""
        }
        confirmLabel="Deactivate"
        isPending={deactivating !== null && pendingId === deactivating.id}
      />
    </RequireArea>
  );
}

/* ------------------------------------------------------------------ *
 * Add / edit form
 * ------------------------------------------------------------------ */

type FormState = {
  firstName: string;
  lastName: string;
  admissionNo: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  sectionId: string;
  status: "ACTIVE" | "INACTIVE";
};

function initialForm(student: Student | null): FormState {
  return {
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    admissionNo: student?.admissionNo ?? "",
    dateOfBirth: student?.dateOfBirth ?? "",
    email: student?.email ?? "",
    phone: student?.phone ?? "",
    guardianName: student?.guardianName ?? "",
    guardianPhone: student?.guardianPhone ?? "",
    sectionId: student?.sectionId ?? "",
    status: student?.status ?? "ACTIVE",
  };
}

function StudentFormModal({
  open,
  schoolSlug,
  student,
  classes,
  isTeacher,
  onClose,
  onSaved,
}: {
  open: boolean;
  schoolSlug: string;
  student: Student | null;
  classes: SchoolClass[];
  isTeacher: boolean;
  onClose: () => void;
  onSaved: (student: Student, created: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(student));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{
    student: Student;
    temporaryPassword: string | null;
    emailSent: boolean;
    emailError: string | null;
  } | null>(null);

  const editing = student !== null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.admissionNo.trim()) next.admissionNo = "Admission number is required";
    if (!student && !form.email.trim()) {
      next.email = "Email is required so the student receives a login";
    } else if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (!student && isTeacher && !form.sectionId) {
      next.sectionId = "Choose one of your classes";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setFormError(null);

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      admissionNo: form.admissionNo.trim(),
      dateOfBirth: form.dateOfBirth || null,
      // The create schema requires a string; validation above guarantees it is
      // present. Editing may clear the address, so the update call maps "" to null.
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      guardianName: form.guardianName.trim() || null,
      guardianPhone: form.guardianPhone.trim() || null,
      sectionId: form.sectionId || null,
    };

    try {
      if (student) {
        const updated = await schoolApi.updateStudent(schoolSlug, student.id, {
          ...payload,
          email: payload.email || null,
          status: form.status,
        });
        onSaved(updated, false);
      } else {
        const result = await schoolApi.createStudent(schoolSlug, payload);
        setCreated({
          student: result,
          temporaryPassword: result.temporaryPassword,
          emailSent: result.emailSent,
          emailError: result.emailError,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(Object.keys(err.fields).length > 0 ? null : err.message);
      } else {
        setFormError("Could not save this student. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Real sections only: a class with no sections has no section id to enrol in.
  const sectionOptions = [
    { value: "", label: "No section yet" },
    ...classes
      .filter((row) => row.section)
      .map((row) => ({ value: row.id, label: row.name })),
  ];

  if (created) {
    return (
      <Modal
        open={open}
        onClose={() => onSaved(created.student, true)}
        title="Student added"
        description={`${created.student.name} is now on the roster.`}
        footer={<Button onClick={() => onSaved(created.student, true)}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-secondary-strong">
            {created.student.admissionNo} · {created.student.className}
          </div>

          {created.temporaryPassword ? (
            <div className="space-y-2">
              <p className="text-sm text-body">
                {created.emailSent
                  ? `A temporary password was emailed to ${created.student.email}. It is shown once here as a backup.`
                  : "The sign-in email could not be sent. Share this temporary password by hand."}
              </p>
              <p className="select-all rounded-xl border border-line bg-page px-4 py-3 font-mono text-sm text-ink">
                {created.temporaryPassword}
              </p>
              {created.emailError ? (
                <p className="text-xs text-danger-600">{created.emailError}</p>
              ) : null}
            </div>
          ) : created.student.email ? (
            <p className="text-sm text-body">
              {created.student.email} already had an account, so they keep their existing
              password.
            </p>
          ) : null}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit student" : "Add student"}
      description={
        editing
          ? "Update the student's details, class or status."
          : "Create the student record and their sign-in account. A temporary password is emailed to the address below."
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" isLoading={busy}>
            {editing ? "Save changes" : "Add student"}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="space-y-4">
        {formError ? (
          <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {formError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            required
            value={form.firstName}
            error={errors.firstName}
            onChange={(event) => set("firstName", event.target.value)}
          />
          <Input
            label="Last name"
            required
            value={form.lastName}
            error={errors.lastName}
            onChange={(event) => set("lastName", event.target.value)}
          />
          <Input
            label="Admission number"
            required
            value={form.admissionNo}
            error={errors.admissionNo}
            onChange={(event) => set("admissionNo", event.target.value)}
          />
          <Input
            label="Date of birth"
            type="date"
            value={form.dateOfBirth}
            error={errors.dateOfBirth}
            onChange={(event) => set("dateOfBirth", event.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required={!editing}
            hint={
              editing
                ? "Used for the student's sign-in account."
                : "Required. The student's login and temporary password are sent here."
            }
            value={form.email}
            error={errors.email}
            onChange={(event) => set("email", event.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(event) => set("phone", event.target.value)}
          />
          <Input
            label="Guardian name"
            value={form.guardianName}
            error={errors.guardianName}
            onChange={(event) => set("guardianName", event.target.value)}
          />
          <Input
            label="Guardian phone"
            type="tel"
            value={form.guardianPhone}
            error={errors.guardianPhone}
            onChange={(event) => set("guardianPhone", event.target.value)}
          />
          <Select
            label="Class & section"
            required={isTeacher && !editing}
            value={form.sectionId}
            error={errors.sectionId}
            options={sectionOptions}
            onChange={(event) => set("sectionId", event.target.value)}
          />
          {editing ? (
            <Select
              label="Status"
              value={form.status}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
              onChange={(event) => set("status", event.target.value as FormState["status"])}
            />
          ) : null}
        </div>

        <p className="text-xs text-body">
          {isTeacher
            ? "You can add a student to a class you teach or are the homeroom teacher of. Ask a School Admin to assign you another class."
            : "A class with no sections cannot be selected yet. Create its sections first."}
        </p>
      </form>
    </Modal>
  );
}

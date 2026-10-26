"use client";

import { useState } from "react";
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
import { useApi, useCanPerform, useDebounced, useMembership } from "@/lib/hooks";
import type { Paginated, Teacher } from "@/types";

const SORT_OPTIONS = [
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "employeeNo:asc", label: "Employee no." },
  { value: "createdAt:desc", label: "Newest first" },
] as const;

export default function TeachersPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const canManage = useCanPerform("manageRoster");

  const [page, setPage] = useState(1);
  // A ?search= link deep-links straight into a filtered roster.
  const urlSearch = useSearchParams().get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [sort, setSort] = useState<string>("name:asc");
  const query = useDebounced(search);

  const { data, loading, error, reload } = useApi(
    () =>
      schoolApi.listTeachers(schoolSlug, {
        page,
        search: query,
        sort,
      }),
    [schoolSlug, page, query, sort],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deactivating, setDeactivating] = useState<Teacher | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The endpoint is always paginated now; the fallback only guards a
  // malformed response.
  const result = data as Paginated<Teacher> | null;
  const teachers: Teacher[] = result?.data ?? [];

  function afterChange(message: string) {
    setNotice(message);
    setActionError(null);
    reload();
  }

  async function reactivate(teacher: Teacher) {
    setPendingId(teacher.id);
    setActionError(null);
    try {
      await schoolApi.updateTeacher(schoolSlug, teacher.id, { status: "ACTIVE" });
      afterChange(`${teacher.name} can sign in to this school again.`);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not reactivate this teacher.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function deactivate(teacher: Teacher) {
    setPendingId(teacher.id);
    setActionError(null);
    try {
      await schoolApi.deactivateTeacher(schoolSlug, teacher.id);
      setDeactivating(null);
      afterChange(`${teacher.name} was deactivated. Their staff record is kept.`);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not deactivate this teacher.",
      );
    } finally {
      setPendingId(null);
    }
  }

  const filtersActive = Boolean(search);

  return (
    <RequireArea area="teachers">
      <div className="space-y-6">
        <PageHeader
          title="Teachers"
          description="The staff roster for this school. Adding a teacher also creates their sign-in."
          action={
            canManage ? <Button onClick={() => setAddOpen(true)}>Add teacher</Button> : null
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
          <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
            <div className="min-w-[220px] flex-1">
              <Input
                label="Search"
                type="search"
                placeholder="Name, email, employee no. or subject"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-48">
              <Select
                label="Sort by"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                options={SORT_OPTIONS}
              />
            </div>
            {filtersActive ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSort("name:asc");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>

          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : error ? (
            <p className="px-4 py-10 text-center text-sm text-body">
              Could not load the staff roster. Refresh the page to try again.
            </p>
          ) : teachers.length === 0 ? (
            <EmptyState
              title={filtersActive ? "No teachers match this search" : "No teachers yet"}
              description={
                filtersActive
                  ? "Try a different name, email or employee number."
                  : "Add the first teacher to give them access to this school."
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={() => {
                    setSearch("");
                    setSort("name:asc");
                    setPage(1);
                  }}>
                    Clear filters
                  </Button>
                ) : canManage ? (
                  <Button onClick={() => setAddOpen(true)}>Add teacher</Button>
                ) : null
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Teacher</TH>
                    <TH>Employee no.</TH>
                    <TH>Subject</TH>
                    <TH>Qualifications</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {teachers.map((teacher) => {
                    const busy = pendingId === teacher.id;

                    return (
                      <TR key={teacher.id}>
                        <TD>
                          <span className="font-semibold text-primary">{teacher.name}</span>
                          <span className="block text-xs text-body">
                            {teacher.email || "No account email"}
                          </span>
                          {teacher.phone ? (
                            <span className="block text-xs text-body">{teacher.phone}</span>
                          ) : null}
                        </TD>
                        <TD>{teacher.employeeNo || "—"}</TD>
                        <TD>{teacher.subject || "—"}</TD>
                        <TD>
                          {teacher.qualification || "—"}
                          {teacher.designation ? (
                            <span className="block text-xs text-body">{teacher.designation}</span>
                          ) : null}
                        </TD>
                        <TD>
                          <Badge tone={teacher.status === "ACTIVE" ? "green" : "neutral"}>
                            {teacher.status}
                          </Badge>
                        </TD>
                        <TD>
                          {canManage ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  setNotice(null);
                                  setEditing(teacher);
                                }}
                              >
                                Edit
                              </Button>
                              {teacher.status === "ACTIVE" ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setNotice(null);
                                    setDeactivating(teacher);
                                  }}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => reactivate(teacher)}
                                >
                                  Reactivate
                                </Button>
                              )}
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
              {result ? <PaginationBar result={result} onPageChange={setPage} /> : null}
            </>
          )}
        </Card>

        <TeacherFormModal
          key={addOpen ? "new" : editing?.id ?? "closed"}
          open={addOpen || editing !== null}
          schoolSlug={schoolSlug}
          teacher={editing}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
          onSaved={(teacher, created) => {
            setAddOpen(false);
            setEditing(null);
            afterChange(
              created
                ? `${teacher.name} was added to the staff roster.`
                : `${teacher.name} was updated.`,
            );
          }}
        />

        <ConfirmModal
          open={deactivating !== null}
          onClose={() => setDeactivating(null)}
          onConfirm={() => (deactivating ? deactivate(deactivating) : undefined)}
          title="Deactivate teacher"
          message={
            deactivating
              ? `${deactivating.name} will no longer be able to sign in to this school. Their staff record, assignments and history are kept, and you can reactivate them later.`
              : ""
          }
          confirmLabel="Deactivate"
          isPending={deactivating !== null && pendingId === deactivating.id}
        />
      </div>
    </RequireArea>
  );
}

/* ------------------------------------------------------------------ *
 * Add / edit form
 * ------------------------------------------------------------------ */

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  employeeNo: string;
  phone: string;
  qualification: string;
  designation: string;
};

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}

function initialForm(teacher: Teacher | null): FormState {
  const names = teacher ? splitName(teacher.name) : { firstName: "", lastName: "" };

  return {
    firstName: names.firstName,
    lastName: names.lastName,
    email: teacher?.email ?? "",
    employeeNo: teacher?.employeeNo ?? "",
    phone: teacher?.phone ?? "",
    qualification: teacher?.qualification ?? "",
    designation: teacher?.designation ?? "",
  };
}

function TeacherFormModal({
  open,
  schoolSlug,
  teacher,
  onClose,
  onSaved,
}: {
  open: boolean;
  schoolSlug: string;
  teacher: Teacher | null;
  onClose: () => void;
  onSaved: (teacher: Teacher, created: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(teacher));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{
    teacher: Teacher;
    temporaryPassword: string | null;
    emailSent: boolean;
    emailError: string | null;
    existingAccount: boolean;
  } | null>(null);

  const editing = teacher !== null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current: FormState) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current: Record<string, string>) => {
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
    if (!editing && !form.email.trim()) next.email = "Email is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setFormError(null);

    const profile = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      employeeNo: form.employeeNo.trim() || null,
      phone: form.phone.trim() || null,
      qualification: form.qualification.trim() || null,
      designation: form.designation.trim() || null,
    };

    try {
      if (teacher) {
        const updated = await schoolApi.updateTeacher(schoolSlug, teacher.id, profile);
        onSaved(updated, false);
      } else {
        const result = await schoolApi.createTeacher(schoolSlug, {
          ...profile,
          email: form.email.trim(),
        });
        setCreated(result);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(Object.keys(err.fields).length > 0 ? null : err.message);
      } else {
        setFormError("Could not save this teacher. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal
        open={open}
        onClose={() => onSaved(created.teacher, true)}
        title="Teacher added"
        description={`${created.teacher.name} is now on the staff roster.`}
        footer={<Button onClick={() => onSaved(created.teacher, true)}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-secondary-strong">
            {created.teacher.email} · Teacher
          </div>

          {created.temporaryPassword ? (
            <div className="space-y-2">
              <p className="text-sm text-body">
                {created.emailSent
                  ? `A temporary password was emailed to ${created.teacher.email}. It is shown once here as a backup.`
                  : "The sign-in email could not be sent. Share this temporary password by hand."}
              </p>
              <p className="select-all rounded-xl border border-line bg-page px-4 py-3 font-mono text-sm text-ink">
                {created.temporaryPassword}
              </p>
              {created.emailError ? (
                <p className="text-xs text-danger-600">{created.emailError}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-body">
              {created.teacher.email} already had an account, so they keep their existing
              password. They can sign in to this school immediately.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit teacher" : "Add teacher"}
      description={
        editing
          ? "Update the staff profile. The sign-in email cannot be changed here."
          : "The teacher gets a school membership and a sign-in account."
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="teacher-form" isLoading={busy}>
            {editing ? "Save changes" : "Add teacher"}
          </Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={submit} className="space-y-4">
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
            label="Email"
            type="email"
            required={!editing}
            disabled={editing}
            hint={editing ? "The sign-in address is part of the account." : undefined}
            value={form.email}
            error={errors.email}
            onChange={(event) => set("email", event.target.value)}
          />
          <Input
            label="Employee number"
            value={form.employeeNo}
            error={errors.employeeNo}
            onChange={(event) => set("employeeNo", event.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(event) => set("phone", event.target.value)}
          />
          <Input
            label="Qualification"
            placeholder="e.g. M.Sc, B.Ed"
            value={form.qualification}
            error={errors.qualification}
            onChange={(event) => set("qualification", event.target.value)}
          />
          <Input
            label="Designation"
            placeholder="e.g. Senior Teacher"
            value={form.designation}
            error={errors.designation}
            onChange={(event) => set("designation", event.target.value)}
          />
        </div>

        {!editing ? (
          <p className="text-xs text-body">
            An email that already has an account is added to this school without changing its
            password. A new email gets a temporary password by email.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

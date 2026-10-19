"use client";

import { useState } from "react";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { ApiError, platformApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { CreatedPlatformAdmin, PlatformAdmin, School, StaffRole } from "@/types";

const ROLE_OPTIONS = [
  { value: "SCHOOL_ADMIN", label: "School Admin" },
  { value: "TEACHER", label: "Teacher" },
] as const;

const ROLE_LABEL: Record<StaffRole, string> = {
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
};

export default function PlatformAdminsPage() {
  const admins = useApi(() => platformApi.listAdmins(), []);
  const schools = useApi(() => platformApi.listSchools(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<PlatformAdmin | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = admins.data ?? [];

  async function changeRole(row: PlatformAdmin, role: StaffRole) {
    setPendingKey(`${row.userId}:${row.tenantId}`);
    setActionError(null);
    try {
      await platformApi.updateAdmin(row.userId, { tenantId: row.tenantId, role });
      admins.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not change the role.");
    } finally {
      setPendingKey(null);
    }
  }

  async function toggleStatus(row: PlatformAdmin) {
    const next = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setPendingKey(`${row.userId}:${row.tenantId}`);
    setActionError(null);
    try {
      await platformApi.updateAdmin(row.userId, { tenantId: row.tenantId, status: next });
      admins.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not change the status.");
    } finally {
      setPendingKey(null);
    }
  }

  async function remove(row: PlatformAdmin) {
    setPendingKey(`${row.userId}:${row.tenantId}`);
    setActionError(null);
    try {
      await platformApi.removeAdmin(row.userId, row.tenantId);
      setRemoving(null);
      admins.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove this membership.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform console / Access"
        title="School admins"
        description="Give one person staff access to one school, change their role, or deactivate them. Accounts are created immediately; email delivery is not connected yet, so you pass the first password on yourself."
        action={<Button onClick={() => setAddOpen(true)}>Add school admin</Button>}
      />

      {actionError ? (
        <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
          {actionError}
        </p>
      ) : null}

      <Card>
        {admins.loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : admins.error || !admins.data ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-body">Could not load school admins.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={admins.reload}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No school admins yet"
            description="Add the first person who will administer a school. You can change their role or deactivate them at any time."
            action={<Button onClick={() => setAddOpen(true)}>Add school admin</Button>}
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Person</TH>
                <TH>School</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => {
                const key = `${row.userId}:${row.tenantId}`;
                const busy = pendingKey === key;

                return (
                  <TR key={key}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{row.name}</p>
                          <p className="truncate text-xs text-muted">{row.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <p className="font-medium text-ink">{row.schoolName}</p>
                      <p className="text-xs text-muted">/{row.schoolSlug}</p>
                    </TD>
                    <TD>
                      <select
                        aria-label={`Role for ${row.name}`}
                        value={row.role}
                        disabled={busy}
                        onChange={(event) => changeRole(row, event.target.value as StaffRole)}
                        className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft disabled:opacity-60"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TD>
                    <TD>
                      <Badge tone={row.status === "ACTIVE" ? "green" : "amber"}>
                        {row.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => toggleStatus(row)}
                        >
                          {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => setRemoving(row)}
                          className="text-danger-600 hover:bg-danger-50"
                        >
                          Remove
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-primary">What each role can do</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-page px-4 py-3">
              <p className="text-sm font-medium text-ink">School Admin</p>
              <p className="mt-1 text-[13px] text-body">
                Full access to one school: staff, students, classes, attendance, exams and
                settings. Never sees another school.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-page px-4 py-3">
              <p className="text-sm font-medium text-ink">Teacher</p>
              <p className="mt-1 text-[13px] text-body">
                Works with the classes they are assigned to: roster, attendance, marks and
                announcements. Cannot change school settings.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <AddAdminModal
        open={addOpen}
        schools={schools.data ?? []}
        onClose={() => setAddOpen(false)}
        onCreated={() => admins.reload()}
      />

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => (removing ? remove(removing) : undefined)}
        title="Remove school access"
        message={
          removing
            ? `${removing.name} will lose access to ${removing.schoolName}. Their account is kept, but they will not be able to sign in to that school.`
            : ""
        }
        confirmLabel="Remove access"
        isPending={removing !== null && pendingKey === `${removing.userId}:${removing.tenantId}`}
      />
    </div>
  );
}

function AddAdminModal({
  open,
  schools,
  onClose,
  onCreated,
}: {
  open: boolean;
  schools: School[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [role, setRole] = useState<StaffRole>("SCHOOL_ADMIN");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedPlatformAdmin | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setSchoolId("");
    setRole("SCHOOL_ADMIN");
    setError(null);
    setBusy(false);
    setCreated(null);
    setCopied(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await platformApi.createAdmin({ name, email, schoolId, role });
      setCreated(result);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldMessage = Object.values(err.fields)[0];
        setError(fieldMessage ?? err.message);
      } else {
        setError("Could not create the account.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    if (!created?.temporaryPassword) return;
    await navigator.clipboard.writeText(created.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const schoolOptions = schools.map((school) => ({ value: school.id, label: school.name }));

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? "Account created" : "Add school admin"}
      description={
        created
          ? undefined
          : "The person gets access to one school. If the email already has an account, their existing password still works."
      }
      footer={
        created ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-school-admin"
              isLoading={busy}
              disabled={schools.length === 0}
            >
              Create account
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-sm font-semibold text-secondary-strong">
              {created.name} now has access to {created.schoolName} as{" "}
              {ROLE_LABEL[created.role]}.
            </p>
          </div>

          {created.temporaryPassword ? (
            <div className="space-y-3">
              <p className="text-sm text-body">
                Share these credentials with them. This password is shown once and cannot be
                retrieved later.
              </p>
              <div className="rounded-xl border border-line bg-page px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Email
                </p>
                <p className="mt-0.5 break-all text-sm text-ink">{created.email}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Temporary password
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <code className="break-all text-sm font-semibold text-ink">
                    {created.temporaryPassword}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyPassword}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted">
                Email delivery is not configured yet. When SMTP is added, this password can be
                sent automatically instead.
              </p>
            </div>
          ) : (
            <p className="text-sm text-body">
              {created.name} already had an account, so their existing password still works.
              Only the school membership was added.
            </p>
          )}
        </div>
      ) : (
        <form id="add-school-admin" onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Full name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Priya Sharma"
          />
          <Input
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="priya@greenvalley.edu"
            hint="This is the address they will sign in with."
          />
          <Select
            label="School"
            required
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            options={[{ value: "", label: "Choose a school" }, ...schoolOptions]}
            hint={
              schools.length === 0
                ? "No schools exist yet. Create a school before adding an admin."
                : undefined
            }
          />
          <Select
            label="Role"
            required
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            options={ROLE_OPTIONS}
          />
          {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}

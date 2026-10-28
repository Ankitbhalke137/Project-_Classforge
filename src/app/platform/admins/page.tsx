"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, SelectControl } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { SearchIcon, ShieldCheckIcon } from "@/components/ui/icons";
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

type RoleFilter = "ALL" | StaffRole;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function PlatformAdminsPage() {
  // useSearchParams needs a Suspense boundary during static rendering.
  return (
    <Suspense fallback={<TableSkeleton rows={5} columns={5} />}>
      <PlatformAdminsContent />
    </Suspense>
  );
}

function PlatformAdminsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const schoolParam = params.get("school") ?? "";
  const addParam = params.get("add") === "1";

  const admins = useApi(() => platformApi.listAdmins(), []);
  const schools = useApi(() => platformApi.listSchools(), []);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [addOpen, setAddOpen] = useState(addParam);
  const [removing, setRemoving] = useState<PlatformAdmin | null>(null);
  const [resending, setResending] = useState<PlatformAdmin | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const rows = admins.data ?? [];
  const query = search.trim().toLowerCase();
  const focusedSchool = schools.data?.find((school) => school.id === schoolParam) ?? null;

  const filtered = rows.filter((row) => {
    const matchesSchool = schoolParam === "" || row.tenantId === schoolParam;
    const matchesRole = roleFilter === "ALL" || row.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
    const matchesQuery =
      query === "" ||
      row.name.toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.schoolName.toLowerCase().includes(query);
    return matchesSchool && matchesRole && matchesStatus && matchesQuery;
  });

  const activeSchoolAdmins = rows.filter(
    (row) => row.role === "SCHOOL_ADMIN" && row.status === "ACTIVE",
  ).length;
  const activeTeachers = rows.filter(
    (row) => row.role === "TEACHER" && row.status === "ACTIVE",
  ).length;

  function clearSchoolFilter() {
    router.replace("/platform/admins");
  }

  function closeAddModal() {
    setAddOpen(false);
    // Drop `add=1` so a refresh does not reopen a form that was already sent.
    if (addParam) {
      const query = schoolParam ? `?school=${encodeURIComponent(schoolParam)}` : "";
      router.replace(`/platform/admins${query}`);
    }
  }

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

  async function resendCredentials(row: PlatformAdmin) {
    setPendingKey(`${row.userId}:${row.tenantId}`);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await platformApi.resendAdminCredentials(row.userId, row.tenantId);
      setResending(null);
      setActionNotice(
        `A new temporary password was emailed to ${result.email}. Their old password no longer works, and any open session ends within 15 minutes.`,
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Could not send new credentials. Nothing was changed.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform console / Access"
        title="School admins"
        description="Give one person staff access to one school, change their role, or deactivate them. The account is created immediately and the first password is emailed to them."
        action={<Button onClick={() => setAddOpen(true)}>Invite school admin</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted">Active school admins</p>
          <p className="mt-0.5 text-[28px] font-bold leading-tight text-primary">
            {admins.loading ? "—" : activeSchoolAdmins}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted">Active teachers</p>
          <p className="mt-0.5 text-[28px] font-bold leading-tight text-primary">
            {admins.loading ? "—" : activeTeachers}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted">Total staff memberships</p>
          <p className="mt-0.5 text-[28px] font-bold leading-tight text-primary">
            {admins.loading ? "—" : rows.length}
          </p>
        </Card>
      </div>

      {focusedSchool ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm text-secondary-strong">
            Showing access for <strong>{focusedSchool.name}</strong>
          </p>
          <Button variant="secondary" size="sm" onClick={clearSchoolFilter}>
            Show all schools
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
          {actionError}
        </p>
      ) : null}

      {actionNotice ? (
        <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-secondary-strong">
          {actionNotice}
        </p>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <SearchIcon
              width={16}
              height={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or school…"
              aria-label="Search school admins"
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
            />
          </div>

          <SelectControl
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
          >
            <option value="ALL">All roles</option>
            <option value="SCHOOL_ADMIN">School Admin</option>
            <option value="TEACHER">Teacher</option>
          </SelectControl>

          <SelectControl
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectControl>

          <Button variant="secondary" onClick={admins.reload} isLoading={admins.loading}>
            Refresh
          </Button>
        </div>

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
            title="No staff access yet"
            description="Invite the first School Admin. They are the only role that can run a school, including inviting its staff."
            action={<Button onClick={() => setAddOpen(true)}>Invite school admin</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No people match those filters"
            description="Try another name, role, status or school."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("ALL");
                  setStatusFilter("ALL");
                  if (schoolParam) clearSchoolFilter();
                }}
              >
                Clear filters
              </Button>
            }
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
              {filtered.map((row) => {
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
                      <SelectControl
                        variant="compact"
                        aria-label={`Role for ${row.name}`}
                        value={row.role}
                        disabled={busy}
                        onChange={(event) => changeRole(row, event.target.value as StaffRole)}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectControl>
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
                          onClick={() => {
                            setActionNotice(null);
                            setResending(row);
                          }}
                        >
                          Resend login
                        </Button>
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
          <div className="flex items-center gap-2">
            <ShieldCheckIcon width={18} height={18} className="text-secondary" />
            <h2 className="text-sm font-semibold text-primary">What each role can do</h2>
          </div>
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
          <p className="mt-3 text-xs text-muted">
            A person may hold a different role in another school. Only the role for the school
            they are currently in applies.
          </p>
        </div>
      </Card>

      <AddAdminModal
        key={schoolParam}
        open={addOpen}
        schools={schools.data ?? []}
        initialSchoolId={schoolParam}
        onClose={closeAddModal}
        onCreated={() => admins.reload()}
      />

      <ConfirmModal
        open={resending !== null}
        onClose={() => setResending(null)}
        onConfirm={() => (resending ? resendCredentials(resending) : undefined)}
        title="Resend login details"
        message={
          resending
            ? `A new temporary password will be emailed to ${resending.email}. The one they have now stops working, and open sessions end within 15 minutes.`
            : ""
        }
        confirmLabel="Send new password"
        isPending={resending !== null && pendingKey === `${resending.userId}:${resending.tenantId}`}
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
  initialSchoolId,
  onClose,
  onCreated,
}: {
  open: boolean;
  schools: School[];
  initialSchoolId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [role, setRole] = useState<StaffRole>("SCHOOL_ADMIN");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    schoolId?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedPlatformAdmin | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setSchoolId(initialSchoolId);
    setRole("SCHOOL_ADMIN");
    setError(null);
    setFieldErrors({});
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

    const next: { name?: string; email?: string; schoolId?: string } = {};
    if (name.trim().length < 2) next.name = "Enter their full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!schoolId) next.schoolId = "Choose the school they will administer.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setError(null);

    try {
      const result = await platformApi.createAdmin({
        name: name.trim(),
        email: email.trim(),
        schoolId,
        role,
      });
      setCreated(result);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors({
          name: err.fields.name,
          email: err.fields.email,
          schoolId: err.fields.schoolId,
        });
        if (!err.fields.name && !err.fields.email && !err.fields.schoolId) {
          setError(err.message);
        }
      } else {
        setError("Could not create the account.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    if (!created?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the password is still on screen.
    }
  }

  const schoolOptions = schools.map((school) => ({ value: school.id, label: school.name }));

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? "Access created" : "Invite school admin"}
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
              Create access
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
                {created.emailSent
                  ? "We sent these credentials to them by email. The password is shown here once as a backup and cannot be retrieved later."
                  : "The email could not be sent, so share these credentials with them. The password is shown once and cannot be retrieved later."}
              </p>
              {!created.emailSent && created.emailError ? (
                <p className="rounded-lg border border-line bg-page px-3 py-2 text-[13px] text-body">
                  <span className="font-semibold text-ink">Reason: </span>
                  {created.emailError}
                </p>
              ) : null}
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
            error={fieldErrors.name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Priya Sharma"
          />
          <Input
            label="Email address"
            type="email"
            required
            value={email}
            error={fieldErrors.email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="priya@greenvalley.edu"
            hint="This is the address they will sign in with."
          />
          <Select
            label="School"
            required
            value={schoolId}
            error={fieldErrors.schoolId}
            onChange={(event) => {
              setSchoolId(event.target.value);
              setFieldErrors((current) => ({ ...current, schoolId: undefined }));
            }}
            options={[{ value: "", label: "Choose a school" }, ...schoolOptions]}
            hint={
              schools.length === 0
                ? "No schools exist yet. Provision a school before inviting an admin."
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
          <p className="rounded-xl bg-surface-low px-3 py-2.5 text-xs leading-relaxed text-body">
            {role === "SCHOOL_ADMIN"
              ? "A School Admin can run everything inside this one school, including inviting its staff."
              : "A Teacher only works with the classes they are assigned to. They cannot change school settings."}
          </p>
          {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}

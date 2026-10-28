"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { SearchIcon } from "@/components/ui/icons";
import { ApiError, platformApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { slugify } from "@/lib/slug";
import { formatNumber } from "@/lib/utils";
import type { School } from "@/types";

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

/** Pulls the most useful message out of an API error. */
function describeActionError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const fieldMessage = Object.values(error.fields)[0];
    return fieldMessage ?? error.message;
  }
  return fallback;
}

export default function SchoolsPage() {
  const router = useRouter();
  const schools = useApi(() => platformApi.listSchools(), []);
  const admins = useApi(() => platformApi.listAdmins(), []);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [suspending, setSuspending] = useState<School | null>(null);
  const [deleting, setDeleting] = useState<School | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = schools.data ?? [];
  const query = search.trim().toLowerCase();
  const filtered = rows.filter((school) => {
    const matchesStatus = status === "ALL" || school.status === status;
    const matchesQuery =
      query === "" ||
      school.name.toLowerCase().includes(query) ||
      school.slug.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  function schoolAdminCount(tenantId: string): number {
    return (admins.data ?? []).filter(
      (membership) => membership.tenantId === tenantId && membership.role === "SCHOOL_ADMIN",
    ).length;
  }

  async function setSchoolStatus(school: School, next: School["status"]) {
    setPendingId(school.id);
    setNotice(null);
    try {
      await platformApi.updateSchool(school.id, { status: next });
      setSuspending(null);
      schools.reload();
    } catch (error) {
      setSuspending(null);
      setNotice(describeActionError(error, "Could not change the school's status."));
    } finally {
      setPendingId(null);
    }
  }

  async function saveSchool(school: School, name: string, slug: string) {
    setPendingId(school.id);
    setNotice(null);
    try {
      await platformApi.updateSchool(school.id, { name, slug });
      setEditing(null);
      schools.reload();
    } catch (error) {
      setEditing(null);
      setNotice(describeActionError(error, "Could not save the school."));
    } finally {
      setPendingId(null);
    }
  }

  async function deleteSchool(school: School) {
    setPendingId(school.id);
    setNotice(null);
    try {
      await platformApi.removeSchool(school.id);
      setDeleting(null);
      schools.reload();
    } catch (error) {
      setDeleting(null);
      setNotice(describeActionError(error, "Could not delete the school."));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform infrastructure / Multi-tenant fleet"
        title="Platform schools & tenants"
        description="Create, edit and suspend schools. A Super Admin manages the fleet but never reads a school's student data."
        action={<Button onClick={() => setProvisionOpen(true)}>Provision new school</Button>}
      />

      {notice ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3">
          <p className="text-sm text-warn-600">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold text-warn-600 underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
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
              placeholder="Search by school name or slug…"
              aria-label="Search schools"
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
            />
          </div>

          <label className="sr-only" htmlFor="status-filter">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <Button variant="secondary" onClick={schools.reload} isLoading={schools.loading}>
            Refresh
          </Button>
        </div>

        {schools.loading ? (
          <TableSkeleton rows={4} columns={6} />
        ) : schools.error || !schools.data ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-body">Could not load schools.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={schools.reload}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No schools yet"
            description="Provision the first school, then give it a School Admin so somebody can sign in."
            action={<Button onClick={() => setProvisionOpen(true)}>Provision a school</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No schools match those filters"
            description="Try a different name, slug or status."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>School</TH>
                  <TH>School admins</TH>
                  <TH>Students</TH>
                  <TH>Staff</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((school) => {
                  const adminCount = schoolAdminCount(school.id);
                  const busy = pendingId === school.id;

                  return (
                    <TR key={school.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={school.name} shape="square" size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{school.name}</p>
                            <p className="truncate text-xs text-muted">/{school.slug}</p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        {adminCount === 0 ? (
                          <Badge tone="amber">None yet</Badge>
                        ) : (
                          <span className="text-sm text-ink">
                            {formatNumber(adminCount)}{" "}
                            <span className="text-muted">
                              {adminCount === 1 ? "admin" : "admins"}
                            </span>
                          </span>
                        )}
                      </TD>
                      <TD>{formatNumber(school.studentCount)}</TD>
                      <TD>{formatNumber(school.staffCount)}</TD>
                      <TD>
                        <Badge tone={school.status === "ACTIVE" ? "green" : "amber"}>
                          {school.status === "ACTIVE" ? "Active" : "Suspended"}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-2">
                          <Link href={`/platform/admins?school=${school.id}`}>
                            <Button variant="secondary" size="sm">
                              Admins
                            </Button>
                          </Link>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => setEditing(school)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            className={
                              school.status === "ACTIVE"
                                ? "text-warn-600 hover:bg-warn-50"
                                : "text-secondary-strong hover:bg-brand-50"
                            }
                            onClick={() => {
                              if (school.status === "ACTIVE") setSuspending(school);
                              else void setSchoolStatus(school, "ACTIVE");
                            }}
                          >
                            {school.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy || school.status !== "SUSPENDED"}
                            className="text-danger-600 hover:bg-danger-50 disabled:text-muted"
                            onClick={() => setDeleting(school)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>

            <div className="border-t border-line px-4 py-3 text-sm text-body">
              Showing {formatNumber(filtered.length)} of {formatNumber(rows.length)} schools
            </div>
          </>
        )}
      </Card>

      <ProvisionSchoolModal
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        onCreated={() => schools.reload()}
        onAddAdmin={(schoolId) =>
          router.push(`/platform/admins?school=${encodeURIComponent(schoolId)}&add=1`)
        }
      />

      {editing ? (
        <EditSchoolModal
          school={editing}
          busy={pendingId === editing.id}
          onClose={() => setEditing(null)}
          onSave={saveSchool}
        />
      ) : null}

      <ConfirmModal
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        onConfirm={() =>
          suspending ? void setSchoolStatus(suspending, "SUSPENDED") : undefined
        }
        title="Suspend school"
        message={
          suspending
            ? `Members of ${suspending.name} will get 403 on every school route until it is reactivated. No data is deleted.`
            : ""
        }
        confirmLabel="Suspend school"
        isPending={suspending !== null && pendingId === suspending.id}
      />

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? void deleteSchool(deleting) : undefined)}
        title="Delete school"
        message={
          deleting
            ? `This permanently deletes ${deleting.name} and everything in it — students, teachers, classes, marks and enrolments. It cannot be undone.`
            : ""
        }
        confirmLabel="Delete school"
        isPending={deleting !== null && pendingId === deleting.id}
      />
    </div>
  );
}

function ProvisionSchoolModal({
  open,
  onClose,
  onCreated,
  onAddAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onAddAdmin: (schoolId: string) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<School | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setError(null);
    setFieldErrors({});
    setBusy(false);
    setCreated(null);
  }

  function close() {
    reset();
    onClose();
  }

  function onNameChange(value: string) {
    setName(value);
    setFieldErrors((current) => ({ ...current, name: undefined }));
    // Keep following the name until the user takes over the slug themselves.
    if (!slugEdited) setSlug(slugify(value));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const next: { name?: string; slug?: string } = {};
    if (name.trim().length < 2) next.name = "Enter the school name.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      next.slug = "Use lowercase letters, numbers and single dashes.";
    } else if (slug.trim().length > 100) {
      next.slug = "Keep the slug to 100 characters or fewer.";
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setError(null);

    try {
      const school = await platformApi.createSchool(name.trim(), slug.trim());
      setCreated(school);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors({
          name: err.fields.name,
          slug: err.fields.slug,
        });
        if (!err.fields.name && !err.fields.slug) {
          setError(err.message);
        }
      } else {
        setError("Could not create the school.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? "School provisioned" : "Provision new school"}
      description={
        created
          ? undefined
          : "A school is a tenant: its slug becomes its URL, e.g. /greenwood/dashboard."
      }
      footer={
        created ? (
          <>
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
            <Button onClick={() => onAddAdmin(created.id)}>Add first admin</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="provision-school" isLoading={busy}>
              Provision school
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-sm font-semibold text-secondary-strong">
              {created.name} is ready.
            </p>
            <p className="mt-1 text-[13px] text-body">
              Its URL is <code className="text-ink">/{created.slug}</code>. The next step is
              giving it a School Admin — without one, nobody can sign in to this school.
            </p>
          </div>
          <p className="text-sm text-body">
            You can also add more admins or change their role later from School admins.
          </p>
        </div>
      ) : (
        <form id="provision-school" onSubmit={onSubmit} className="space-y-4">
          <Input
            label="School name"
            required
            value={name}
            error={fieldErrors.name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Greenwood High"
          />
          <Input
            label="URL slug"
            required
            value={slug}
            error={fieldErrors.slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
              setFieldErrors((current) => ({ ...current, slug: undefined }));
            }}
            placeholder="greenwood"
            hint="Lowercase letters, numbers and hyphens. This becomes /{slug}."
          />
          {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}

function EditSchoolModal({
  school,
  busy,
  onClose,
  onSave,
}: {
  school: School;
  busy: boolean;
  onClose: () => void;
  onSave: (school: School, name: string, slug: string) => void;
}) {
  const [name, setName] = useState(school.name);
  const [slug, setSlug] = useState(school.slug);

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit school"
      description="Changing the slug changes the school's URL. Existing links to the old slug stop working."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-school"
            isLoading={busy}
            disabled={!name.trim() || !slug.trim()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-school"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(school, name.trim(), slug.trim());
        }}
        className="space-y-4"
      >
        <Input
          label="School name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="URL slug"
          required
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          hint="Lowercase letters, numbers and hyphens only."
        />
      </form>
    </Modal>
  );
}

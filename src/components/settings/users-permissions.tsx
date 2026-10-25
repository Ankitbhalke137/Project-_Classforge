"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { ApiError, schoolApi } from "@/lib/api";
import type { Teacher } from "@/types";

function TeachersOverview({ schoolSlug }: { schoolSlug: string }) {
  const teachers = useApi(() => schoolApi.listTeachers(schoolSlug), [schoolSlug]);

  if (teachers.loading) return <TableSkeleton rows={5} columns={5} />;
  const rows = teachers.data?.data ?? [];
  if (teachers.error) return <div className="text-xs text-danger-600">Failed to load teachers.</div>;

  return (
    <Card className="col-span-full">
      <CardHeader title="School Staff & Teachers" description="Current staff members in this school." />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState title="No teachers found" description="No teachers have been added to this school yet." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Subject</TH>
                <TH>Designation</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((teacher: Teacher) => (
                <TR key={teacher.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={teacher.name} size="sm" />
                      <span className="font-medium text-ink">{teacher.name}</span>
                    </div>
                  </TD>
                  <TD className="text-body">{teacher.email}</TD>
                  <TD>{teacher.subject}</TD>
                  <TD>{teacher.designation}</TD>
                  <TD>
                    <Badge tone="positive">Active</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

const ROLE_INFO: {
  key: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT";
  label: string;
  description: string;
  scope: string;
}[] = [
  {
    key: "SCHOOL_ADMIN",
    label: "School Admin",
    description: "Full access to all settings and data within this school only.",
    scope: "All school data",
  },
  {
    key: "TEACHER",
    label: "Teacher",
    description: "Manages classes, attendance, assignments and grades for assigned classes.",
    scope: "Assigned classes",
  },
  {
    key: "STUDENT",
    label: "Student",
    description: "Access to their own attendance, assignments, exams and report cards.",
    scope: "Own records",
  },
];

export function UsersPermissionsSection() {
  const schoolSlug = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"TEACHER" | "STUDENT">("TEACHER");
  const [inviteResult, setInviteResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    setInviteResult(null);

    try {
      const result = await schoolApi.invite(schoolSlug, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setInviteResult({
        type: "success",
        message: result.emailSent
          ? `${result.name} has been added to ${result.schoolName} and emailed a temporary password.`
          : `${result.name} has been added to ${result.schoolName}, but the email could not be sent.${
              result.emailError ? ` (${result.emailError})` : ""
            }`,
      });
      setInviteName("");
      setInviteEmail("");
    } catch (error) {
      setInviteResult({
        type: "error",
        message:
          error instanceof ApiError
            ? (Object.values(error.fields)[0] ?? error.message)
            : "Could not send the invite. Try again in a moment.",
      });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-primary">Invite User</h2>
          <p className="mt-0.5 text-[13px] text-body">
            Users are created through invitations, not public sign-up. School Admin can invite
            staff to this school only.
          </p>
        </div>
        <Button
          variant="accent"
          onClick={() => setInviteOpen(true)}
          disabled={inviting}
        >
          Invite User
        </Button>
      </div>

      {inviteOpen ? (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onInvite={handleInvite}
          inviting={inviting}
          inviteName={inviteName}
          setInviteName={setInviteName}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          result={inviteResult}
        />
      ) : null}

      <TeachersOverview schoolSlug={schoolSlug} />

      <Card>
        <CardHeader title="Roles" description="What each role can do inside this school." />
        <CardBody className="divide-y divide-line">
          {ROLE_INFO.map((role) => (
            <div key={role.key} className="px-5 py-4">
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-primary">{role.label}</span>
                <Badge tone="brand" className="text-[11px]">{role.scope}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-body">{role.description}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Membership Status" description="Active and deactivated user status." />
        <CardBody className="px-5 py-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl bg-brand-50 border border-brand-100">
              <h3 className="text-sm font-semibold text-secondary-strong">Active members</h3>
              <p className="mt-1 text-[13px] text-body">
                Can sign in and access the school based on their role permissions.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-danger-50 border border-danger-100">
              <h3 className="text-sm font-semibold text-danger-600">Deactivated members</h3>
              <p className="mt-1 text-[13px] text-body">
                Cannot sign in to this school. Reactivation requires a backend endpoint.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted">
            School Admin can only manage memberships belonging to this school. Memberships
            belonging to other schools are not visible or editable here.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function InviteUserModal({
  onClose,
  onInvite,
  inviting,
  inviteName,
  setInviteName,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  result,
}: {
  onClose: () => void;
  onInvite: (event: React.FormEvent) => void;
  inviting: boolean;
  inviteName: string;
  setInviteName: (value: string) => void;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteRole: "TEACHER" | "STUDENT";
  setInviteRole: (value: "TEACHER" | "STUDENT") => void;
  result: { type: "success" | "error"; message: string } | null;
}) {
  return (
    <div>
      {result && (
        <div
          className={`p-3 rounded-lg mb-3 text-sm ${
            result.type === "success"
              ? "bg-brand-50 text-secondary-strong border border-brand-100"
              : "bg-danger-50 text-danger-600 border border-danger-100"
          }`}
        >
          {result.message}
        </div>
      )}
      {/* Inline invite form instead of Modal to keep it simple */}
      <Card className="col-span-full">
        <CardHeader title="Invite a New User" description="Send an invitation to join this school." />
        <CardBody>
          <form onSubmit={onInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="col-span-full sm:col-span-1">
                <label htmlFor="invite-name" className="text-sm font-medium text-primary block mb-1">
                  Full name <span className="ml-0.5 text-danger-600">*</span>
                </label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder="Priya Sharma"
                  disabled={inviting}
                  required
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft disabled:bg-page"
                />
              </div>
              <div className="col-span-full sm:col-span-1">
                <label htmlFor="invite-email" className="text-sm font-medium text-primary block mb-1">
                  Email address <span className="ml-0.5 text-danger-600">*</span>
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teacher@greenwood.edu"
                  disabled={inviting}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft disabled:bg-page"
                />
              </div>
              <div className="col-span-full sm:col-span-1">
                <label htmlFor="invite-role" className="text-sm font-medium text-primary block mb-1">
                  Role <span className="ml-0.5 text-danger-600">*</span>
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as "TEACHER" | "STUDENT")}
                  disabled={inviting}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft disabled:bg-page"
                >
                  <option value="TEACHER">Teacher</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
            </div>
            <p className="text-[12px] text-muted">
              The invitee is emailed a temporary password and can sign in straight away. They
              should change it after their first sign-in.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={inviting}>
                Cancel
              </Button>
              <Button
                onClick={onInvite}
                isLoading={inviting}
                disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
              >
                Send Invite
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

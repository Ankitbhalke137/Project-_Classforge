"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { ApiError, platformApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { slugify } from "@/lib/slug";

export default function SchoolsPage() {
  const { data, loading, error, reload } = useApi(() => platformApi.listSchools(), []);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools"
        description="Create, edit and suspend schools, and assign the first School Admin to each one."
        action={<Button onClick={() => setOpen(true)}>Add school</Button>}
      />

      <Card>
        {loading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : error || !data ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Could not load schools.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>School</TH>
                <TH>URL</TH>
                <TH>Students</TH>
                <TH>Staff</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((school) => (
                <TR key={school.id}>
                  <TD className="font-medium text-slate-900">{school.name}</TD>
                  <TD className="text-slate-500">/{school.slug}</TD>
                  <TD>{school.studentCount}</TD>
                  <TD>{school.staffCount}</TD>
                  <TD>
                    <Badge tone={school.status === "ACTIVE" ? "green" : "amber"}>
                      {school.status}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <AddSchoolModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          reload();
        }}
      />
    </div>
  );
}

function AddSchoolModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Typing the name fills the URL slug until the user edits it themselves.
  function onNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await platformApi.createSchool(name, slug);
      setName("");
      setSlug("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the school.");
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add school"
      description="The URL slug becomes the school's path, e.g. /greenwood/dashboard."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-school" isLoading={busy}>
            Create school
          </Button>
        </>
      }
    >
      <form id="add-school" onSubmit={onSubmit} className="space-y-4">
        <Input
          label="School name"
          required
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Greenwood High"
        />
        <Input
          label="URL slug"
          required
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="greenwood"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
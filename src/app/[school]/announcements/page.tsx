"use client";

import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PaginationBar } from "@/components/ui/pagination";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import { useApi, useIdentity, useMembership, useRole } from "@/lib/hooks";
import type { Announcement, AnnouncementPriority } from "@/types";
import { ANNOUNCEMENT_AUDIENCES } from "@/types";

const PRIORITY_TONE = {
  NORMAL: "neutral",
  IMPORTANT: "amber",
  URGENT: "red",
} as const;

const PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  NORMAL: "Notice",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};

export default function AnnouncementsPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();
  const canPost = role === "SCHOOL_ADMIN" || role === "TEACHER";
  const isTeacher = role === "TEACHER";

  const { identity } = useIdentity();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority | "">("");
  const [audience, setAudience] = useState("");
  const [composing, setComposing] = useState(false);

  const list = useApi(
    () =>
      schoolApi.listAnnouncements(schoolSlug, {
        page,
        search,
        priority: priority || undefined,
        audience,
      }),
    [schoolSlug, page, search, priority, audience],
  );

  // `/classes` returns one row per section, which is exactly what the section
  // picker needs. It is a flat array, not grouped by class.
  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);

  // `identity.teacher.classIds` already covers both sections they teach and
  // sections of classes they are homeroom teacher of — the same two cases the
  // backend accepts when posting.
  const assignedSectionIds = new Set(identity?.teacher?.classIds ?? []);
  const sectionRows = classes.data ?? [];
  const allSections = sectionRows.map((row) => ({
    value: row.id,
    label: row.name,
  }));
  const sectionOptions = isTeacher
    ? allSections.filter((section) => assignedSectionIds.has(section.value))
    : allSections;

  const rows = list.data?.data ?? [];

  /** Any filter change sends you back to page one. */
  function filtering<T>(setter: (value: T) => void) {
    return (value: T) => {
      setPage(1);
      setter(value);
    };
  }

  return (
    <RequireArea area="announcements">
      <div className="space-y-6">
        <PageHeader
          title="Announcements"
          description="Notices from the office. Pinned notices stay at the top."
          action={
            canPost ? (
              <Button onClick={() => setComposing(true)}>Post a notice</Button>
            ) : null
          }
        />

        <Card>
          <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-3">
            <Input
              label="Search"
              type="search"
              placeholder="Search titles and bodies"
              value={search}
              onChange={(event) => filtering(setSearch)(event.target.value)}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(event) => filtering(setPriority)(event.target.value as AnnouncementPriority | "")}
              options={[
                { value: "", label: "Any priority" },
                { value: "URGENT", label: "Urgent" },
                { value: "IMPORTANT", label: "Important" },
                { value: "NORMAL", label: "Notice" },
              ]}
            />
            <Select
              label="Audience"
              value={audience}
              onChange={(event) => filtering(setAudience)(event.target.value)}
              options={[
                { value: "", label: "Anyone" },
                ...ANNOUNCEMENT_AUDIENCES.map((value) => ({ value, label: value })),
              ]}
            />
          </div>

          {list.loading ? (
            <TableSkeleton rows={5} columns={2} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nothing to read"
              description={
                search || priority || audience
                  ? "No notice matches those filters."
                  : "No notices have been posted yet."
              }
              action={
                (search || priority || audience) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPriority("");
                      setAudience("");
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
              {/* Not a table: each notice is a card, so this is a list. */}
              <ul className="divide-y divide-line">
                {rows.map((notice) => (
                  <AnnouncementCard key={notice.id} notice={notice} />
                ))}
              </ul>
              <PaginationBar result={list.data!} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>

      {composing ? (
        <ComposeNotice
          schoolSlug={schoolSlug}
          role={role}
          isTeacher={isTeacher}
          sectionOptions={sectionOptions}
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false);
            setPage(1);
            list.reload();
          }}
        />
      ) : null}
    </RequireArea>
  );
}

function AnnouncementCard({ notice }: { notice: Announcement }) {
  return (
    <li>
      <article className="space-y-2 p-4 sm:p-5">
        <header className="flex flex-wrap items-center gap-2">
          {notice.pinned ? <Badge tone="brand">Pinned</Badge> : null}
          <Badge tone={PRIORITY_TONE[notice.priority]}>{PRIORITY_LABEL[notice.priority]}</Badge>
          {notice.audience.map((group) => (
            <Badge key={group} tone="neutral">
              {group}
            </Badge>
          ))}
        </header>

        <h2 className="text-base font-semibold text-ink">{notice.title}</h2>
        <p className="text-sm text-body">{notice.body}</p>

        <footer className="flex flex-wrap items-center gap-3 pt-1 text-xs text-body">
          <span className="flex items-center gap-2">
            <Avatar name={notice.authorName} size="sm" />
            <span className="font-medium text-ink">{notice.authorName}</span>
          </span>
          <span>{notice.publishedAt.slice(0, 10)}</span>
          {notice.eventDate ? <span>Event {notice.eventDate}</span> : null}
          {notice.attachments.map((file) => (
            <span key={file.name}>📎 {file.name}</span>
          ))}
          <span className="ml-auto">{notice.readCount} read</span>
        </footer>
      </article>
    </li>
  );
}

function ComposeNotice({
  schoolSlug,
  role,
  isTeacher,
  sectionOptions,
  onClose,
  onPosted,
}: {
  schoolSlug: string;
  role: import("@/types").Role | null;
  isTeacher: boolean;
  sectionOptions: { value: string; label: string }[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("NORMAL");
  const [audience, setAudience] = useState<Announcement["audience"]>(["EVERYONE"]);
  const [sectionId, setSectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canPostSchoolWide = role === "SCHOOL_ADMIN";

  function clearField(field: string) {
    setFields((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleAudience(value: (typeof ANNOUNCEMENT_AUDIENCES)[number]) {
    clearField("audience");
    setAudience((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function onSubmit() {
    // The server validates all of this too; checking first puts the message on
    // the field instead of making the person read a banner.
    const next: Record<string, string> = {};
    if (title.trim().length < 3) {
      next.title = "Give the notice a title (at least 3 characters).";
    }
    if (!body.trim()) {
      next.body = "Write the notice.";
    }
    if (audience.length === 0) {
      next.audience = "Choose at least one audience.";
    }
    if (isTeacher && !sectionId) {
      next.sectionId = "Choose one of your assigned sections.";
    }

    setFields(next);
    setSubmitError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);

    try {
      await schoolApi.createAnnouncement(schoolSlug, {
        title: title.trim(),
        body: body.trim(),
        priority,
        audience,
        sectionId: sectionId || undefined,
      });
      onPosted();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFields(caught.fields);
        if (!Object.keys(caught.fields).length) {
          setSubmitError(caught.message || "Could not post this notice.");
        }
      } else {
        setSubmitError("Could not post this notice. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const sectionChoices = canPostSchoolWide
    ? [{ value: "", label: "School-wide" }, ...sectionOptions]
    : sectionOptions;

  return (
    <Modal
      open
      onClose={onClose}
      title="Post a notice"
      description="Everyone in the chosen audience will see this at the top of their list."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={busy}>
            Post
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError ? (
          <p role="alert" className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {submitError}
          </p>
        ) : null}

        <Input
          label="Title"
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            clearField("title");
          }}
          error={fields.title}
          placeholder="What is this about?"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notice-body" className="text-sm font-medium text-ink">
            Message <span className="text-danger-600">*</span>
          </label>
          <textarea
            id="notice-body"
            rows={5}
            value={body}
            aria-invalid={fields.body ? true : undefined}
            aria-describedby={fields.body ? "notice-body-error" : undefined}
            onChange={(event) => {
              setBody(event.target.value);
              clearField("body");
            }}
            placeholder="The detail people actually need to act on."
            className={`w-full rounded-lg bg-white px-3 py-2 text-sm text-ink placeholder:text-muted ring-1 focus:outline-2 focus:outline-offset-1 focus:outline-brand-600 ${
              fields.body ? "ring-danger-600" : "ring-line"
            }`}
          />
          {fields.body ? (
            <p id="notice-body-error" role="alert" className="text-xs text-danger-600">
              {fields.body}
            </p>
          ) : null}
        </div>

        <Select
          label="Priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as AnnouncementPriority)}
          options={[
            { value: "NORMAL", label: "Notice" },
            { value: "IMPORTANT", label: "Important" },
            { value: "URGENT", label: "Urgent" },
          ]}
        />

        {sectionChoices.length > 0 ? (
          <Select
            label="Section"
            required={isTeacher}
            value={sectionId}
            error={fields.sectionId}
            onChange={(event) => {
              setSectionId(event.target.value);
              clearField("sectionId");
            }}
            options={sectionChoices}
            hint={
              isTeacher
                ? "Choose one of your assigned sections. School-wide notices are restricted to School Admins."
                : "Leave as School-wide to reach the whole school, or pick a section."
            }
          />
        ) : (
          <p className="text-xs text-body">
            {isTeacher
              ? "You are not assigned to any section yet. Ask a School Admin to assign you a class."
              : "No sections are configured for this school yet."}
          </p>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-ink">Audience</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ANNOUNCEMENT_AUDIENCES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleAudience(value)}
                aria-pressed={audience.includes(value)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                  audience.includes(value)
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-ink ring-line hover:bg-page"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          {fields.audience ? (
            <p role="alert" className="mt-2 text-xs text-danger-600">
              {fields.audience}
            </p>
          ) : null}
        </fieldset>
      </div>
    </Modal>
  );
}
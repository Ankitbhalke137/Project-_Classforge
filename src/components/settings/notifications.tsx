"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { ApiError, schoolApi } from "@/lib/api";
import type { Announcement, NotificationPreferences } from "@/types";

const PRIORITY_TONE: Record<Announcement["priority"], "neutral" | "brand" | "amber" | "red"> = {
  NORMAL: "neutral",
  IMPORTANT: "amber",
  URGENT: "red",
} as const;

const PRIORITY_LABEL: Record<Announcement["priority"], string> = {
  NORMAL: "Notice",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};

function RecentAnnouncements({ schoolSlug }: { schoolSlug: string }) {
  const announcements = useApi(
    () => schoolApi.listAnnouncements(schoolSlug, { page: 1, search: "" }),
    [schoolSlug],
  );

  if (announcements.loading) return <TableSkeleton rows={4} columns={4} />;
  const rows = announcements.data?.data ?? [];
  if (announcements.error) return <div className="text-xs text-danger-600">Failed to load announcements.</div>;

  return (
    <Card className="col-span-full">
      <CardHeader title="Recent Announcements" description="Latest school-wide announcements." />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState title="No announcements" description="No announcements have been posted yet." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Priority</TH>
                <TH>Audience</TH>
                <TH>Published</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((announcement: Announcement) => (
                <TR key={announcement.id}>
                  <TD className="font-medium text-ink">{announcement.title}</TD>
                  <TD>
                    <Badge tone={PRIORITY_TONE[announcement.priority]}>
                      {PRIORITY_LABEL[announcement.priority]}
                    </Badge>
                  </TD>
                  <TD className="text-body">{announcement.audience.join(", ")}</TD>
                  <TD className="text-body text-[12px]">{announcement.publishedAt.slice(0, 10)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

export function NotificationsSection() {
  const schoolSlug = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "";
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    inAppNotifications: true,
    emailNotifications: false,
    classAnnouncements: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set the moment the person touches a switch. The load below can land after
  // that, and it must not then undo what they did. A ref, not state: the
  // promise below needs to read the current value, and state would give it
  // the value from the render the effect was created in.
  const edited = useRef(false);

  // The choices belong to the signed-in person, so they are read from the
  // server rather than kept in component state that resets on reload.
  useEffect(() => {
    let cancelled = false;

    schoolApi
      .getNotificationPreferences(schoolSlug)
      .then((data) => {
        // A slow response must not overwrite a switch the person has already
        // flipped — otherwise the switch springs back on its own, and what
        // gets saved is not what they set.
        if (!cancelled && !edited.current) setPrefs(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your notification settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [schoolSlug]);

  function handleToggle(key: keyof NotificationPreferences, checked: boolean) {
    edited.current = true;
    setPrefs((p) => ({ ...p, [key]: checked }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const savedPrefs = await schoolApi.saveNotificationPreferences(schoolSlug, prefs);
      setPrefs(savedPrefs);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (Object.values(err.fields)[0] ?? err.message)
          : "Could not save your settings. Try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleRow({
    label,
    description,
    key,
    checked,
  }: {
    label: string;
    description: string;
    key: keyof typeof prefs;
    checked: boolean;
  }) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-white">
        <div>
          <h3 className="text-sm font-medium text-ink">{label}</h3>
          <p className="mt-0.5 text-xs text-body">{description}</p>
        </div>
        <label className="relative inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            // The visible text sits in a sibling heading, so the switch has no
            // accessible name of its own. Without this a screen reader
            // announces an unnamed checkbox.
            aria-label={label}
            checked={checked}
            onChange={(event) => handleToggle(key, event.target.checked)}
            className="rounded border-line bg-white text-secondary focus:border-secondary focus:ring-2 focus:ring-secondary-soft"
          />
          <span className="block h-5 w-9 rounded-full border border-line bg-white transition-colors peer-checked:bg-secondary peer-checked:after:translate-x-full peer-checked:after:border-white">
            <span className="peer-checked:after:translate-x-full peer-checked:after:border-white after:block after:w-3 after:h-3 after:bg-current after:rounded-full after:border border-line after:bg-white after:top-1 after:left-1 after:transition-all" />
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Notification Channels"
          description="Choose how the school reaches staff, students and parents."
        />
        <CardBody className="space-y-4">
          <form onSubmit={handleSave}>
            {toggleRow({
              label: "In-app notifications",
              description: "Show notifications inside the ClassForge app.",
              key: "inAppNotifications",
              checked: prefs.inAppNotifications,
            })}
            {toggleRow({
              label: "Email notifications",
              description: "Send notification emails to registered addresses.",
              key: "emailNotifications",
              checked: prefs.emailNotifications,
            })}
            {toggleRow({
              label: "Class-specific announcements",
              description: "Allow teachers to post announcements to their own classes.",
              key: "classAnnouncements",
              checked: prefs.classAnnouncements,
            })}

            <div className="pt-6 flex items-center gap-3 justify-between">
              {saved ? (
                <div className="flex items-center gap-2 text-sm text-secondary-strong">
                  <span className="size-4 shrink-0 flex items-center justify-center rounded-full bg-secondary-soft text-secondary-strong">
                    ✓
                  </span>
                  <span>Notification preferences saved</span>
                </div>
              ) : error ? (
                <p className="text-xs text-danger-600">{error}</p>
              ) : (
                <p className="text-xs text-body">
                  These choices apply to you in this school only.
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
                disabled={saving || loading}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <RecentAnnouncements schoolSlug={schoolSlug} />
    </div>
  );
}

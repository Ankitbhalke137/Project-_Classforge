"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { ApiError, schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";
import type { AcademicTerm, AcademicYear, TimetablePeriod } from "@/types";

/* ------------------------------------------------------------------ *
 * Academic years + terms
 * ------------------------------------------------------------------ */

export function AcademicSettingsSection() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";

  const years = useApi(() => schoolApi.listAcademicYears(schoolSlug), [schoolSlug]);
  const periods = useApi(() => schoolApi.listTimetablePeriods(schoolSlug), [schoolSlug]);

  const [yearModal, setYearModal] = useState<AcademicYear | "new" | null>(null);
  const [yearToDelete, setYearToDelete] = useState<AcademicYear | null>(null);
  const [termModal, setTermModal] = useState<{ year: AcademicYear; term: AcademicTerm | null } | null>(
    null,
  );
  const [termToDelete, setTermToDelete] = useState<AcademicTerm | null>(null);
  const [periodModal, setPeriodModal] = useState<TimetablePeriod | "new" | null>(null);
  const [periodToDelete, setPeriodToDelete] = useState<TimetablePeriod | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = years.data ?? [];

  function changed(message: string) {
    setNotice(message);
    setError(null);
    years.reload();
  }

  async function activate(year: AcademicYear) {
    setBusyId(year.id);
    setError(null);
    try {
      await schoolApi.updateAcademicYear(schoolSlug, year.id, { status: "ACTIVE" });
      changed(`${year.name} is now the active academic year.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not activate this year.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeYear(year: AcademicYear) {
    setBusyId(year.id);
    setError(null);
    try {
      await schoolApi.deleteAcademicYear(schoolSlug, year.id);
      setYearToDelete(null);
      changed(`${year.name} was deleted.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this year.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeTerm(term: AcademicTerm) {
    setBusyId(term.id);
    setError(null);
    try {
      await schoolApi.deleteTerm(schoolSlug, term.id);
      setTermToDelete(null);
      changed(`${term.label} was deleted.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this term.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePeriod(period: TimetablePeriod) {
    setBusyId(period.id);
    setError(null);
    try {
      await schoolApi.deleteTimetablePeriod(schoolSlug, period.id);
      setPeriodToDelete(null);
      changed(`Period ${period.period} was deleted.`);
      periods.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this period.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader
          title="Academic years"
          description="One current year, and the terms inside it. Everything else in the school hangs off this."
          action={<Button onClick={() => setYearModal("new")}>Add year</Button>}
        />
        <CardBody className="p-0">
          {years.loading ? (
            <TableSkeleton rows={3} columns={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No academic year yet"
              description="Add the current year first — classes, terms and enrolments belong to it."
              action={<Button onClick={() => setYearModal("new")}>Add year</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Year</TH>
                  <TH>Dates</TH>
                  <TH>Status</TH>
                  <TH>Classes</TH>
                  <TH>Terms</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((year) => (
                  <TR key={year.id}>
                    <TD>
                      <span className="font-semibold text-primary">{year.name}</span>
                      <span className="block text-xs text-body">{year.studentCount} enrolments</span>
                    </TD>
                    <TD className="whitespace-nowrap text-sm">
                      {formatDay(year.startDate)} → {formatDay(year.endDate)}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          year.status === "ACTIVE"
                            ? "green"
                            : year.status === "UPCOMING"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {year.status}
                      </Badge>
                    </TD>
                    <TD>{year.classCount}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {year.terms.length === 0 ? (
                          <span className="text-xs text-body">None</span>
                        ) : (
                          year.terms.map((term) => (
                            <span key={term.id} className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setTermModal({ year, term })}
                                className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-body hover:border-secondary hover:text-secondary-strong"
                                title={`${term.startDate} → ${term.endDate}`}
                              >
                                {term.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTermToDelete(term)}
                                className="text-[11px] text-muted hover:text-danger-600"
                                aria-label={`Delete ${term.label}`}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => setTermModal({ year, term: null })}
                          className="rounded-md border border-dashed border-line px-1.5 py-0.5 text-[11px] text-body hover:border-secondary hover:text-secondary-strong"
                        >
                          + term
                        </button>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        {year.status !== "ACTIVE" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === year.id}
                            onClick={() => activate(year)}
                          >
                            Activate
                          </Button>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={() => setYearModal(year)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === year.id}
                          onClick={() => setYearToDelete(year)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Timetable periods"
          description="The daily bells. A class timetable can only use periods defined here."
          action={<Button onClick={() => setPeriodModal("new")}>Add period</Button>}
        />
        <CardBody className="p-0">
          {periods.loading ? (
            <TableSkeleton rows={7} columns={4} />
          ) : (periods.data ?? []).length === 0 ? (
            <EmptyState
              title="No periods yet"
              description="Add the school day's periods — for example 08:00–08:45 — before timetabling a class."
              action={<Button onClick={() => setPeriodModal("new")}>Add period</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH>Starts</TH>
                  <TH>Ends</TH>
                  <TH>Label</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {(periods.data ?? []).map((period) => (
                  <TR key={period.id}>
                    <TD className="font-semibold text-primary">{period.period}</TD>
                    <TD>{period.startTime}</TD>
                    <TD>{period.endTime}</TD>
                    <TD>{period.label || "—"}</TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPeriodModal(period)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === period.id}
                          onClick={() => setPeriodToDelete(period)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-primary">Classes, sections and subjects</h3>
            <p className="mt-0.5 text-[13px] text-body">
              Add a class, split it into sections, add its subjects, and assign the teachers who take them.
            </p>
          </div>
          <Link
            href={`/${schoolSlug}/classes`}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-strong"
          >
            Manage classes
          </Link>
        </CardBody>
      </Card>

      <YearModal
        key={yearModal === "new" ? "new-year" : (yearModal?.id ?? "closed-year")}
        state={yearModal}
        schoolSlug={schoolSlug}
        onClose={() => setYearModal(null)}
        onSaved={(message) => {
          setYearModal(null);
          changed(message);
        }}
      />

      <TermModal
        key={termModal ? `${termModal.year.id}-${termModal.term?.id ?? "new"}` : "closed-term"}
        state={termModal}
        schoolSlug={schoolSlug}
        onClose={() => setTermModal(null)}
        onSaved={(message) => {
          setTermModal(null);
          changed(message);
        }}
      />

      <PeriodModal
        key={periodModal === "new" ? "new-period" : (periodModal?.id ?? "closed-period")}
        state={periodModal}
        schoolSlug={schoolSlug}
        onClose={() => setPeriodModal(null)}
        onSaved={(message) => {
          setPeriodModal(null);
          setNotice(message);
          setError(null);
          periods.reload();
        }}
      />

      <ConfirmModal
        open={yearToDelete !== null}
        onClose={() => setYearToDelete(null)}
        onConfirm={() => (yearToDelete ? removeYear(yearToDelete) : undefined)}
        title="Delete academic year"
        message={
          yearToDelete
            ? `Delete ${yearToDelete.name}? This only works if it has no classes or enrolments.`
            : ""
        }
        confirmLabel="Delete year"
        isPending={yearToDelete !== null && busyId === yearToDelete.id}
      />

      <ConfirmModal
        open={termToDelete !== null}
        onClose={() => setTermToDelete(null)}
        onConfirm={() => (termToDelete ? removeTerm(termToDelete) : undefined)}
        title="Delete term"
        message={termToDelete ? `Delete ${termToDelete.label}?` : ""}
        confirmLabel="Delete term"
        isPending={termToDelete !== null && busyId === termToDelete.id}
      />

      <ConfirmModal
        open={periodToDelete !== null}
        onClose={() => setPeriodToDelete(null)}
        onConfirm={() => (periodToDelete ? removePeriod(periodToDelete) : undefined)}
        title="Delete period"
        message={
          periodToDelete
            ? `Delete period ${periodToDelete.period}? This only works if no class timetable uses it.`
            : ""
        }
        confirmLabel="Delete period"
        isPending={periodToDelete !== null && busyId === periodToDelete.id}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Modals
 * ------------------------------------------------------------------ */

function YearModal({
  state,
  schoolSlug,
  onClose,
  onSaved,
}: {
  state: AcademicYear | "new" | null;
  schoolSlug: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = state !== "new" && state !== null;
  const [name, setName] = useState(editing ? state.name : "");
  const [startDate, setStartDate] = useState(editing ? state.startDate : "");
  const [endDate, setEndDate] = useState(editing ? state.endDate : "");
  const [status, setStatus] = useState<AcademicYear["status"]>(
    editing ? state.status : "UPCOMING",
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFields({});

    try {
      if (editing) {
        await schoolApi.updateAcademicYear(schoolSlug, state.id, {
          name,
          startDate,
          endDate,
          status,
        });
        onSaved(`${name} was updated.`);
      } else {
        await schoolApi.createAcademicYear(schoolSlug, { name, startDate, endDate, status });
        onSaved(`${name} was added.`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else {
        setFormError("Could not save this year. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={editing ? "Edit academic year" : "Add academic year"}
      description="Only one year can be active at a time; activating this one completes the old one."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="year-form" isLoading={busy}>
            {editing ? "Save changes" : "Add year"}
          </Button>
        </>
      }
    >
      <form id="year-form" onSubmit={submit} className="space-y-4">
        {formError ? <FormError message={formError} /> : null}
        <Input
          label="Name"
          required
          placeholder="2026–27"
          value={name}
          error={fields.name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Start date"
            type="date"
            required
            value={startDate}
            error={fields.startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Input
            label="End date"
            type="date"
            required
            value={endDate}
            error={fields.endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AcademicYear["status"])}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
          >
            <option value="UPCOMING">Upcoming</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
      </form>
    </Modal>
  );
}

function TermModal({
  state,
  schoolSlug,
  onClose,
  onSaved,
}: {
  state: { year: AcademicYear; term: AcademicTerm | null } | null;
  schoolSlug: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = state?.term ?? null;
  const [label, setLabel] = useState(editing?.label ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? state?.year.startDate ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? state?.year.endDate ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!state) return;
    setBusy(true);
    setFormError(null);
    setFields({});

    try {
      if (editing) {
        await schoolApi.updateTerm(schoolSlug, editing.id, { label, startDate, endDate });
        onSaved(`${label} was updated.`);
      } else {
        await schoolApi.createTerm(schoolSlug, {
          academicYearId: state.year.id,
          label,
          startDate,
          endDate,
        });
        onSaved(`${label} was added to ${state.year.name}.`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else {
        setFormError("Could not save this term. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={editing ? `Edit ${editing.label}` : "Add term"}
      description={state ? `Inside ${state.year.name}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="term-form" isLoading={busy}>
            {editing ? "Save changes" : "Add term"}
          </Button>
        </>
      }
    >
      <form id="term-form" onSubmit={submit} className="space-y-4">
        {formError ? <FormError message={formError} /> : null}
        <Input
          label="Label"
          required
          placeholder="Term 1"
          value={label}
          error={fields.label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Start date"
            type="date"
            required
            value={startDate}
            error={fields.startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Input
            label="End date"
            type="date"
            required
            value={endDate}
            error={fields.endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

function PeriodModal({
  state,
  schoolSlug,
  onClose,
  onSaved,
}: {
  state: TimetablePeriod | "new" | null;
  schoolSlug: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = state !== "new" && state !== null;
  const [period, setPeriod] = useState(editing ? String(state.period) : "");
  const [startTime, setStartTime] = useState(editing ? state.startTime : "");
  const [endTime, setEndTime] = useState(editing ? state.endTime : "");
  const [label, setLabel] = useState(editing ? (state.label ?? "") : "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFields({});

    try {
      if (editing) {
        await schoolApi.updateTimetablePeriod(schoolSlug, state.id, {
          period: Number(period),
          startTime,
          endTime,
          label: label || null,
        });
        onSaved(`Period ${period} was updated.`);
      } else {
        await schoolApi.createTimetablePeriod(schoolSlug, {
          period: Number(period),
          startTime,
          endTime,
          label: label || null,
        });
        onSaved(`Period ${period} was added.`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else {
        setFormError("Could not save this period. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={editing ? `Edit period ${state.period}` : "Add period"}
      description="Times are wall-clock labels, not dates."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="period-form" isLoading={busy}>
            {editing ? "Save changes" : "Add period"}
          </Button>
        </>
      }
    >
      <form id="period-form" onSubmit={submit} className="space-y-4">
        {formError ? <FormError message={formError} /> : null}
        <Input
          label="Period number"
          type="number"
          min={1}
          max={20}
          required
          value={period}
          error={fields.period}
          onChange={(event) => setPeriod(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Starts"
            type="time"
            required
            value={startTime}
            error={fields.startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
          <Input
            label="Ends"
            type="time"
            required
            value={endTime}
            error={fields.endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </div>
        <Input
          label="Label"
          placeholder="Break, Assembly…"
          value={label}
          error={fields.label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </form>
    </Modal>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
      {message}
    </p>
  );
}

function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

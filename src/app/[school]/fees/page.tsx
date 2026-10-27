"use client";

import { useState } from "react";
import { z } from "zod";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PaginationBar } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import {
  AlertIcon,
  PaymentsIcon,
  ReceiptIcon,
  SearchIcon,
  VerifiedIcon,
} from "@/components/ui/icons";
import { ApiError, schoolApi } from "@/lib/api";
import {
  useApi,
  useDebounced,
  useMembership,
  useRole,
  useSchoolCalendar,
} from "@/lib/hooks";
import { canPerform } from "@/lib/roles";
import { cn, formatNumber } from "@/lib/utils";
import {
  FEE_STATUSES,
  FEE_TYPES,
  type FeeInvoice,
  type FeeStatus,
  type FeeSummary,
  type FeeType,
  type Student,
} from "@/types";

/**
 * Fee management and invoices.
 *
 * Every figure comes from the fees summary and the invoice list — the design's
 * collection-trajectory chart and payment-method donut are deliberately absent,
 * because the API exposes neither monthly history nor a payment-mode field.
 */
export default function FeesPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const role = useRole();

  // Only a school admin reads the whole ledger; a guardian is served their own
  // records by the server and is not told about the school's.
  const wholeSchool = canPerform(role, "viewAllFees");

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FeeStatus | "">("");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<FeeInvoice | null>(null);

  const summary = useApi(() => schoolApi.getFeeSummary(schoolSlug), [schoolSlug]);
  const invoices = useApi(
    () =>
      schoolApi.listFees(schoolSlug, {
        page,
        status: status || undefined,
        search: query,
      }),
    [schoolSlug, page, status, query],
  );

  const students = useApi(
    () =>
      // Only the admin's invoice form needs the roster. A parent has no
      // business calling the students endpoint just because the page mounted.
      wholeSchool
        ? schoolApi.listStudents(schoolSlug, { limit: 100, status: "ACTIVE" })
        : Promise.resolve(null),
    [schoolSlug, wholeSchool],
  );
  const { calendar } = useSchoolCalendar();

  function refreshLedger() {
    summary.reload();
    invoices.reload();
  }

  return (
    <RequireArea area="fees">
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            wholeSchool
              ? "Bursar's office · Academic year 2026–27 · Term 2 active billing"
              : "Academic year 2026–27 · Term 2"
          }
          title={wholeSchool ? "Fee management & invoices" : "Fees & invoices"}
          description={
            wholeSchool
              ? "Track school fee billing, collection progress and outstanding dues across every class."
              : "Invoices raised for your own records, and what is still outstanding."
          }
          action={
            wholeSchool ? (
              <Button variant="accent" onClick={() => setCreateOpen(true)}>
                New invoice
              </Button>
            ) : undefined
          }
        />

        <SummaryRow
          summary={summary.data}
          loading={summary.loading}
          wholeSchool={wholeSchool}
        />

        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <StatusTab
              label="All invoices"
              active={status === ""}
              onSelect={() => {
                setStatus("");
                setPage(1);
              }}
            />
            {FEE_STATUSES.map((value) => (
              <StatusTab
                key={value}
                label={STATUS_LABEL[value]}
                active={status === value}
                onSelect={() => {
                  setStatus(value);
                  setPage(1);
                }}
              />
            ))}
          </div>

          <div className="border-b border-line p-4">
            <div className="relative max-w-lg">
              <label htmlFor="fee-search" className="sr-only">
                Search invoices
              </label>
              <SearchIcon
                width={18}
                height={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="fee-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search invoice #, student name, class…"
                className="h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft"
              />
            </div>
          </div>

          {invoices.loading ? (
            <TableSkeleton rows={8} columns={6} />
          ) : invoices.error || !invoices.data || invoices.data.data.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-body">
              {invoices.error ? "Could not load the invoices." : "No invoices match these filters."}
            </p>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-[150px]">Invoice</TH>
                    <TH>Student &amp; class</TH>
                    <TH>Fee description</TH>
                    <TH className="text-right">Total billed</TH>
                    <TH className="text-right">Paid</TH>
                    <TH className="text-right">Balance</TH>
                    <TH className="whitespace-nowrap">Due date</TH>
                    <TH>Status</TH>
                    {wholeSchool ? <TH className="text-right">Actions</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {invoices.data.data.map((invoice) => (
                    <InvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      canManage={wholeSchool}
                      onRecordPayment={() => setPaying(invoice)}
                    />
                  ))}
                </TBody>
              </Table>
              <PaginationBar result={invoices.data} onPageChange={setPage} />
            </>
          )}
        </Card>

        {wholeSchool ? (
          <>
            <NewInvoiceModal
              open={createOpen}
              schoolSlug={schoolSlug}
              students={students.data?.data ?? []}
              terms={calendar?.terms.map((term) => term.label) ?? []}
              onClose={() => setCreateOpen(false)}
              onSaved={() => {
                setCreateOpen(false);
                refreshLedger();
              }}
            />
            <RecordPaymentModal
              key={paying?.id ?? "none"}
              invoice={paying}
              schoolSlug={schoolSlug}
              onClose={() => setPaying(null)}
              onSaved={() => {
                setPaying(null);
                refreshLedger();
              }}
            />
          </>
        ) : null}
      </div>
    </RequireArea>
  );
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

function SummaryRow({
  summary,
  loading,
  wholeSchool,
}: {
  summary: FeeSummary | null;
  loading: boolean;
  wholeSchool: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="h-[148px] animate-pulse bg-white" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total billed",
      value: formatMoney(summary.totalBilled),
      note: wholeSchool ? "Across every active invoice this term" : "Raised on your records",
      icon: <ReceiptIcon width={22} height={22} />,
      tint: "bg-surface-low text-primary",
      valueClass: "text-primary",
    },
    {
      label: "Total collected",
      value: formatMoney(summary.totalCollected),
      note: `${summary.collectionRate}% of what was billed`,
      icon: <VerifiedIcon width={22} height={22} />,
      tint: "bg-brand-50 text-secondary-strong",
      valueClass: "text-secondary-strong",
      meter: summary.collectionRate,
    },
    {
      label: "Outstanding balance",
      value: formatMoney(summary.outstanding),
      note: "Not yet collected",
      icon: <PaymentsIcon width={22} height={22} />,
      tint: "bg-warn-50 text-warn-600",
      valueClass: "text-warn-600",
    },
    {
      label: "Critical overdue",
      value: formatMoney(summary.overdueAmount),
      note: `${formatNumber(summary.overdueCount)} invoices past due`,
      icon: <AlertIcon width={22} height={22} />,
      tint: "bg-danger-50 text-danger-600",
      valueClass: "text-danger-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              {card.label}
            </p>
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                card.tint,
              )}
            >
              {card.icon}
            </span>
          </div>

          <p
            className={cn(
              "text-[26px] font-bold leading-tight tracking-tight",
              card.valueClass,
            )}
          >
            {card.value}
          </p>

          {card.meter !== undefined ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-mid">
              <div
                className="h-full rounded-full bg-secondary"
                style={{ width: `${Math.min(100, card.meter)}%` }}
              />
            </div>
          ) : null}

          <p className="text-xs text-body">{card.note}</p>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Table
 * ------------------------------------------------------------------ */

function StatusTab({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
        active ? "bg-primary text-white" : "bg-surface-low text-body hover:bg-surface-mid",
      )}
    >
      {label}
    </button>
  );
}

function InvoiceRow({
  invoice,
  canManage,
  onRecordPayment,
}: {
  invoice: FeeInvoice;
  canManage: boolean;
  onRecordPayment: () => void;
}) {
  const balance = invoice.amount - invoice.amountPaid;
  const overdue = invoice.status === "OVERDUE";

  return (
    <TR>
      <TD>
        <span
          title={invoice.id}
          className={cn(
            "block max-w-[190px] truncate text-[13px]",
            overdue ? "font-semibold text-danger-600" : "font-semibold text-primary",
          )}
        >
          {invoice.invoiceNo}
        </span>
      </TD>

      <TD>
        <span className="font-semibold text-primary">{invoice.studentName}</span>
        <span className="block text-xs text-muted">{invoice.className}</span>
      </TD>

      <TD>
        <span className="text-ink">{invoice.feeType} fee</span>
        <span className="block text-xs text-muted">{invoice.term}</span>
      </TD>

      <TD className="text-right font-medium">{formatMoney(invoice.amount)}</TD>
      <TD className="text-right font-medium text-secondary-strong">
        {formatMoney(invoice.amountPaid)}
      </TD>
      <TD className={cn("text-right font-semibold", balance > 0 ? "text-warn-600" : "text-ink")}>
        {formatMoney(balance)}
      </TD>

      <TD>
        <span className={cn("whitespace-nowrap", overdue ? "text-danger-600" : "text-body")}>
          {new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(new Date(`${invoice.dueDate}T00:00:00`))}
        </span>
      </TD>

      <TD>
        <Badge tone={STATUS_TONE[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
      </TD>
      {canManage ? (
        <TD className="text-right">
          <Button
            size="sm"
            variant="secondary"
            onClick={onRecordPayment}
            disabled={invoice.status === "PAID" || balance <= 0}
          >
            Record payment
          </Button>
        </TD>
      ) : null}
    </TR>
  );
}

/* ------------------------------------------------------------------ *
 * New invoice
 * ------------------------------------------------------------------ */

const invoiceSchema = z.object({
  studentId: z.string().uuid("Choose a student."),
  feeType: z.enum(FEE_TYPES, { message: "Choose a fee type." }),
  term: z.string().trim().min(1, "Choose a term.").max(50),
  amount: z.coerce
    .number({ message: "Enter an amount." })
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "That amount is too large."),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a due date."),
});

type InvoiceFields = z.infer<typeof invoiceSchema>;

function inThirtyDays(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function NewInvoiceModal({
  open,
  schoolSlug,
  students,
  terms,
  onClose,
  onSaved,
}: {
  open: boolean;
  schoolSlug: string;
  students: Student[];
  terms: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<InvoiceFields>({
    studentId: "",
    feeType: "Tuition",
    term: "",
    amount: 0,
    dueDate: inThirtyDays(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setForm({
      studentId: "",
      feeType: "Tuition",
      term: "",
      amount: 0,
      dueDate: inThirtyDays(),
    });
    setErrors({});
    setFormError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = invoiceSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setBusy(true);
    setErrors({});
    setFormError(null);

    try {
      await schoolApi.createFeeInvoice(schoolSlug, {
        studentId: parsed.data.studentId,
        feeType: parsed.data.feeType,
        term: parsed.data.term,
        amount: parsed.data.amount,
        dueDate: parsed.data.dueDate,
      });
      reset();
      onSaved();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields);
        setFormError(Object.keys(error.fields).length ? null : error.message);
      } else {
        setFormError("Could not raise this invoice. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Raise a fee invoice"
      description="One bill for one student, fee head and term. Amounts are in rupees."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="new-invoice-form" isLoading={busy}>
            Create invoice
          </Button>
        </>
      }
    >
      <form id="new-invoice-form" onSubmit={submit} className="space-y-4">
        <Select
          label="Student"
          value={form.studentId}
          error={errors.studentId}
          options={[
            {
              value: "",
              label: students.length ? "Choose a student" : "No students enrolled yet",
            },
            ...students.map((student) => ({
              value: student.id,
              label: `${student.name} · ${student.className || "Unassigned"}`,
            })),
          ]}
          onChange={(event) =>
            setForm((current) => ({ ...current, studentId: event.target.value }))
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Fee type"
            value={form.feeType}
            error={errors.feeType}
            options={FEE_TYPES.map((value) => ({ value, label: value }))}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                feeType: event.target.value as FeeType,
              }))
            }
          />
          {terms.length > 0 ? (
            <Select
              label="Term"
              value={form.term}
              error={errors.term}
              options={[
                { value: "", label: "Choose a term" },
                ...terms.map((term) => ({ value: term, label: term })),
              ]}
              onChange={(event) =>
                setForm((current) => ({ ...current, term: event.target.value }))
              }
            />
          ) : (
            <Input
              label="Term"
              value={form.term}
              error={errors.term}
              placeholder="Term 1"
              onChange={(event) =>
                setForm((current) => ({ ...current, term: event.target.value }))
              }
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount || ""}
            error={errors.amount}
            placeholder="15000"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value === "" ? 0 : Number(event.target.value),
              }))
            }
          />
          <Input
            label="Due date"
            type="date"
            value={form.dueDate}
            error={errors.dueDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.target.value }))
            }
          />
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-danger-600">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Record payment
 * ------------------------------------------------------------------ */

const paymentSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter an amount." })
    .positive("Payment must be greater than zero."),
});

function RecordPaymentModal({
  invoice,
  schoolSlug,
  onClose,
  onSaved,
}: {
  invoice: FeeInvoice | null;
  schoolSlug: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const balance = invoice ? invoice.amount - invoice.amountPaid : 0;

  function close() {
    setAmount(0);
    setError(null);
    setFormError(null);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice) return;

    const parsed = paymentSchema.safeParse({ amount });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter an amount.");
      return;
    }
    if (parsed.data.amount > balance) {
      setError(`The outstanding balance is ${formatMoney(balance)}.`);
      return;
    }

    setBusy(true);
    setError(null);
    setFormError(null);

    try {
      await schoolApi.recordFeePayment(schoolSlug, invoice.id, parsed.data.amount);
      setAmount(0);
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.fields.amount ?? null);
        setFormError(caught.fields.amount ? null : caught.message);
      } else {
        setFormError("Could not record this payment. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={invoice !== null}
      onClose={close}
      title="Record a payment"
      description={
        invoice
          ? `${invoice.invoiceNo} · ${invoice.studentName} · balance ${formatMoney(balance)}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="record-payment-form" isLoading={busy}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Amount received"
          type="number"
          min="0"
          step="0.01"
          value={amount || ""}
          error={error ?? undefined}
          placeholder="0"
          onChange={(event) => setAmount(Number(event.target.value) || 0)}
        />
        {formError ? (
          <p role="alert" className="text-sm text-danger-600">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

const STATUS_LABEL: Record<FeeStatus, string> = {
  PAID: "Paid in full",
  PARTIAL: "Partially paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
};

const STATUS_TONE: Record<FeeStatus, "green" | "amber" | "neutral" | "red"> = {
  PAID: "green",
  PARTIAL: "amber",
  PENDING: "neutral",
  OVERDUE: "red",
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
"use client";

import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { schoolApi } from "@/lib/api";
import { useApi, useDebounced, useMembership, useRole } from "@/lib/hooks";
import { canPerform } from "@/lib/roles";
import { useAuth } from "@/store/auth";
import { cn, formatNumber } from "@/lib/utils";
import { FEE_STATUSES, type FeeInvoice, type FeeStatus, type FeeSummary } from "@/types";

/**
 * Fee management and invoices.
 *
 * Every figure comes from the fees summary and the invoice list — the design's
 * collection-trajectory chart and payment-method donut are deliberately absent,
 * because the API exposes neither monthly history nor a payment-mode field.
 */
export default function FeesPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const email = useAuth((state) => state.user?.email);

  // Only a school admin reads the whole ledger; a guardian and a student are
  // served their own records and should not be told about the school's.
  const wholeSchool = canPerform(useRole(), "viewAllFees");

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FeeStatus | "">("");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const summary = useApi(() => schoolApi.getFeeSummary(schoolSlug, email), [schoolSlug, email]);
  const invoices = useApi(
    () =>
      schoolApi.listFees(schoolSlug, {
        page,
        status: status || undefined,
        search: query,
        email,
      }),
    [schoolSlug, page, status, query, email],
  );

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
                  </TR>
                </THead>
                <TBody>
                  {invoices.data.data.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} schoolSlug={schoolSlug} />
                  ))}
                </TBody>
              </Table>
              <PaginationBar result={invoices.data} onPageChange={setPage} />
            </>
          )}
        </Card>
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

function InvoiceRow({ invoice, schoolSlug }: { invoice: FeeInvoice; schoolSlug: string }) {
  const balance = invoice.amount - invoice.amountPaid;
  const overdue = invoice.status === "OVERDUE";

  // The fixture ids are namespaced by tenant, and the tenant is already in the
  // URL and the switcher — dropping it makes the reference readable.
  const reference = invoice.id.startsWith(`${schoolSlug}_`)
    ? invoice.id.slice(schoolSlug.length + 1)
    : invoice.id;

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
          {reference}
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
    </TR>
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
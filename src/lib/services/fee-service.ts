import { randomBytes } from "node:crypto";
import { MembershipRole, Prisma } from "@prisma/client";
import { z } from "zod";
import { withTenant } from "@/lib/tenant-context";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import type { FeeInvoice, FeeSummary, FeeStatus, FeeType } from "@/types";

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export const FEE_TYPES = [
  "Tuition",
  "Transport",
  "Examination",
  "Lab",
  "Library",
] as const satisfies readonly FeeType[];

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.");

const money = z.coerce
  .number({ message: "Enter a valid amount." })
  .positive("Amount must be greater than zero.")
  .max(10_000_000, "That amount is too large.")
  .refine(
    (value) => Number.isFinite(value) && Math.abs(Math.round(value * 100) - value * 100) < 1e-9,
    { message: "Amount can have at most two decimal places." },
  );

export const createInvoiceSchema = z
  .object({
    studentId: z.string().uuid("Choose a student."),
    feeType: z.enum(FEE_TYPES),
    term: z.string().trim().min(1, "Choose a term.").max(50),
    amount: money,
    dueDate: isoDate,
    invoiceNo: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const recordPaymentSchema = z
  .object({
    amount: money,
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export interface FeeViewer {
  role: MembershipRole;
  userId: string;
}

export interface ListFeesQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  status?: string;
  classId?: string;
  term?: string;
}

const FEE_STATUSES: readonly FeeStatus[] = ["PENDING", "PARTIAL", "PAID", "OVERDUE"];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateInvoiceNo(): string {
  return `INV-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Who is allowed to see the ledger, and how much of it. */
async function viewerScope(
  tx: Prisma.TransactionClient,
  tenantId: string,
  viewer: FeeViewer,
): Promise<Prisma.FeeInvoiceWhereInput> {
  if (viewer.role === "SCHOOL_ADMIN") return {};

  if (viewer.role === "PARENT") {
    // A parent's children are resolved by the parent portal. The schema does
    // not yet carry a guardian ↔ student link, so the honest answer is an empty
    // ledger rather than another family's invoices.
    const children = await tx.student.findMany({
      where: { tenantId, userId: viewer.userId },
      select: { id: true },
    });
    return { studentId: { in: children.map((child) => child.id) } };
  }

  throw new ForbiddenError("You do not have permission to view fees.");
}

/**
 * A due date passing does not run a cron job in this app, so overdue is
 * materialised when the ledger is read. This keeps the stored status and the
 * filter in agreement instead of showing PENDING rows that are plainly late.
 */
async function refreshOverdue(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.$executeRaw`
    UPDATE "fee_invoices"
       SET "status" = 'OVERDUE'::"FeeStatus",
           "updated_at" = NOW()
     WHERE "tenant_id" = ${tenantId}::uuid
       AND "status" <> 'PAID'::"FeeStatus"
       AND "amount_paid" < "amount"
       AND "due_date" < CURRENT_DATE
  `;
}

type InvoiceWithStudent = Prisma.FeeInvoiceGetPayload<{
  include: {
    student: {
      include: {
        enrolments: {
          include: {
            section: { include: { schoolClass: true } };
          };
        };
      };
    };
  };
}>;

function invoiceInclude(): {
  student: {
    include: {
      enrolments: {
        where: { status: "ACTIVE" };
        orderBy: { enrolledAt: "desc" };
        take: 1;
        include: {
          section: { include: { schoolClass: true } };
        };
      };
    };
  };
} {
  return {
    student: {
      include: {
        enrolments: {
          where: { status: "ACTIVE" },
          orderBy: { enrolledAt: "desc" },
          take: 1,
          include: {
            section: { include: { schoolClass: true } },
          },
        },
      },
    },
  };
}

export function formatInvoice(row: InvoiceWithStudent): FeeInvoice {
  const student = row.student;
  const enrolment = student.enrolments[0];
  const className = enrolment
    ? `${enrolment.section.schoolClass.name} - ${enrolment.section.name}`
    : "Unassigned";

  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    studentId: row.studentId,
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    className,
    term: row.term,
    feeType: row.feeType as FeeType,
    amount: Number(row.amount),
    amountPaid: Number(row.amountPaid),
    dueDate: isoDay(row.dueDate),
    status: row.status as FeeStatus,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listFees(
  tenantId: string,
  query: ListFeesQuery,
  viewer: FeeViewer,
) {
  return withTenant(tenantId, async (tx) => {
    await refreshOverdue(tx, tenantId);
    const scope = await viewerScope(tx, tenantId, viewer);

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(
      Math.max(1, Number(query.pageSize ?? query.limit) || 10),
      100,
    );

    if (query.status && !FEE_STATUSES.includes(query.status as FeeStatus)) {
      throw new BadRequestError("Unknown fee status filter.");
    }

    const search = query.search?.trim();
    const where: Prisma.FeeInvoiceWhereInput = {
      tenantId,
      ...scope,
      ...(query.status ? { status: query.status as FeeStatus } : {}),
      ...(query.term ? { term: query.term } : {}),
      ...(query.classId
        ? {
            student: {
              enrolments: {
                some: { status: "ACTIVE", section: { classId: query.classId } },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNo: { contains: search, mode: "insensitive" } },
              { feeType: { contains: search, mode: "insensitive" } },
              { term: { contains: search, mode: "insensitive" } },
              { student: { firstName: { contains: search, mode: "insensitive" } } },
              { student: { lastName: { contains: search, mode: "insensitive" } } },
              {
                student: {
                  admissionNo: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      tx.feeInvoice.count({ where }),
      tx.feeInvoice.findMany({
        where,
        include: invoiceInclude(),
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map(formatInvoice),
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  });
}

export async function getFeeSummary(
  tenantId: string,
  viewer: FeeViewer,
): Promise<FeeSummary> {
  return withTenant(tenantId, async (tx) => {
    await refreshOverdue(tx, tenantId);
    const scope = await viewerScope(tx, tenantId, viewer);

    const [totals, overdue] = await Promise.all([
      tx.feeInvoice.aggregate({
        where: { tenantId, ...scope },
        _sum: { amount: true, amountPaid: true },
      }),
      tx.feeInvoice.findMany({
        where: { tenantId, ...scope, status: "OVERDUE" },
        select: { amount: true, amountPaid: true },
      }),
    ]);

    const totalBilled = Number(totals._sum.amount ?? 0);
    const totalCollected = Number(totals._sum.amountPaid ?? 0);
    const overdueAmount = overdue.reduce(
      (sum, invoice) => sum + (Number(invoice.amount) - Number(invoice.amountPaid)),
      0,
    );

    return {
      totalBilled,
      totalCollected,
      outstanding: totalBilled - totalCollected,
      overdueAmount,
      overdueCount: overdue.length,
      collectionRate:
        totalBilled === 0 ? 0 : Math.round((totalCollected / totalBilled) * 100),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export async function createInvoice(
  tenantId: string,
  rawInput: unknown,
  viewer: FeeViewer,
): Promise<FeeInvoice> {
  if (viewer.role !== "SCHOOL_ADMIN") {
    throw new ForbiddenError("Only a School Admin can raise a fee invoice.");
  }

  const input = createInvoiceSchema.parse(rawInput);
  const dueDate = new Date(`${input.dueDate}T00:00:00.000Z`);
  if (Number.isNaN(dueDate.getTime())) {
    throw new BadRequestError("Enter a valid due date.", {
      dueDate: "Enter a valid due date.",
    });
  }

  return withTenant(tenantId, async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, tenantId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundError("That student is not in this school.");
    }

    // A term that the school has configured is meaningful; a typo is not.
    const termsConfigured = await tx.academicTerm.count({ where: { tenantId } });
    if (termsConfigured > 0) {
      const term = await tx.academicTerm.findFirst({
        where: { tenantId, label: input.term },
        select: { id: true },
      });
      if (!term) {
        throw new BadRequestError("Choose a term configured for this school.", {
          term: "Choose a term configured for this school.",
        });
      }
    }

    const status: FeeStatus =
      dueDate < today() ? "OVERDUE" : "PENDING";

    // A caller-supplied number must not overwrite an existing invoice, and a
    // generated one must still be checked because two requests can collide.
    if (input.invoiceNo) {
      const existing = await tx.feeInvoice.findUnique({
        where: {
          tenantId_invoiceNo: {
            tenantId,
            invoiceNo: input.invoiceNo,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError("That invoice number is already in use.", {
          invoiceNo: "Already in use.",
        });
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNo = input.invoiceNo ?? generateInvoiceNo();
      try {
        const invoice = await tx.feeInvoice.create({
          data: {
            tenantId,
            studentId: input.studentId,
            invoiceNo,
            term: input.term,
            feeType: input.feeType,
            amount: input.amount,
            dueDate,
            status,
          },
          include: invoiceInclude(),
        });
        return formatInvoice(invoice);
      } catch (error) {
        const conflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";
        if (!conflict || input.invoiceNo) throw error;
        // Generated number collided with a concurrent create — try another.
      }
    }

    throw new ConflictError("Could not allocate an invoice number. Try again.");
  });
}

export async function recordPayment(
  tenantId: string,
  invoiceId: string,
  rawInput: unknown,
  viewer: FeeViewer,
): Promise<FeeInvoice> {
  if (viewer.role !== "SCHOOL_ADMIN") {
    throw new ForbiddenError("Only a School Admin can record a fee payment.");
  }

  const input = recordPaymentSchema.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    await refreshOverdue(tx, tenantId);

    const invoice = await tx.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: invoiceInclude(),
    });
    if (!invoice) throw new NotFoundError("Invoice not found.");

    const amount = Number(invoice.amount);
    const paid = Number(invoice.amountPaid);
    const balance = amount - paid;

    if (input.amount > balance) {
      throw new BadRequestError("Payment is more than the outstanding balance.", {
        amount: `The outstanding balance is ${balance.toFixed(2)}.`,
      });
    }

    const newPaid = paid + input.amount;
    const fullyPaid = newPaid >= amount;
    const status: FeeStatus = fullyPaid
      ? "PAID"
      : newPaid > 0
        ? invoice.dueDate < today()
          ? "OVERDUE"
          : "PARTIAL"
        : invoice.dueDate < today()
          ? "OVERDUE"
          : "PENDING";

    // Compare-and-set on the amount already paid: two clerks recording a
    // payment at the same moment would otherwise each read the old balance and
    // together overpay the invoice.
    const written = await tx.feeInvoice.updateMany({
      where: { id: invoice.id, tenantId, amountPaid: invoice.amountPaid },
      data: {
        amountPaid: newPaid,
        status,
        paidAt: fullyPaid ? new Date() : null,
      },
    });
    if (written.count === 0) {
      throw new ConflictError(
        "This invoice was updated by someone else. Reload and try again.",
      );
    }

    const updated = await tx.feeInvoice.findFirstOrThrow({
      where: { id: invoice.id, tenantId },
      include: invoiceInclude(),
    });

    return formatInvoice(updated);
  });
}

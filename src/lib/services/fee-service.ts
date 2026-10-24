import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { FeeInvoice, FeeSummary } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "fees.json");

interface StoredData {
  invoices: Record<string, FeeInvoice[]>;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }
}

function loadData(): StoredData {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return { invoices: {} };
}



const memoryStore: StoredData = loadData();

function getStore(): StoredData {
  return memoryStore;
}

/** Summarises a collection of invoices */
export function summariseFees(invoices: FeeInvoice[]): FeeSummary {
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const overdue = invoices.filter((inv) => inv.status === "OVERDUE");

  return {
    totalBilled,
    totalCollected,
    outstanding: totalBilled - totalCollected,
    overdueAmount: overdue.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0),
    overdueCount: overdue.length,
    collectionRate: totalBilled === 0 ? 0 : Math.round((totalCollected / totalBilled) * 100),
  };
}

export interface ListFeesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  classId?: string;
  term?: string;
  email?: string;
}

/** Lists invoices with search, status filter, and pagination */
export async function listFees(
  tenantSlug: string,
  tenantId: string | undefined,
  query: ListFeesQuery = {},
) {
  const store = getStore();
  let invoices = store.invoices[tenantSlug] ?? [];

  if (query.email && tenantId) {
    try {
      const student = await prisma.student.findFirst({
        where: { tenantId, user: { email: query.email.toLowerCase() } },
        select: { id: true },
      });
      if (student) {
        invoices = invoices.filter((inv) => inv.studentId === student.id);
      }
    } catch {
      // DB fallback
    }
  }

  const s = query.search?.toLowerCase().trim();
  const filtered = invoices.filter((inv) => {
    if (s) {
      const match =
        inv.id.toLowerCase().includes(s) ||
        inv.studentName.toLowerCase().includes(s) ||
        inv.className.toLowerCase().includes(s) ||
        inv.feeType.toLowerCase().includes(s);
      if (!match) return false;
    }
    if (query.status && inv.status !== query.status) {
      return false;
    }
    if (query.term && inv.term !== query.term) {
      return false;
    }
    return true;
  });

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Number(query.pageSize) || 10);
  const total = filtered.length;
  const skip = (page - 1) * pageSize;
  const paginated = filtered.slice(skip, skip + pageSize);

  return {
    data: paginated,
    total,
    page,
    pageSize,
  };
}

/** Returns fee summary metrics */
export async function getFeeSummary(
  tenantSlug: string,
  tenantId: string | undefined,
  email?: string,
): Promise<FeeSummary> {
  const store = getStore();
  let invoices = store.invoices[tenantSlug] ?? [];

  if (email && tenantId) {
    try {
      const student = await prisma.student.findFirst({
        where: { tenantId, user: { email: email.toLowerCase() } },
        select: { id: true },
      });
      if (student) {
        invoices = invoices.filter((inv) => inv.studentId === student.id);
      }
    } catch {
      // DB fallback
    }
  }

  return summariseFees(invoices);
}

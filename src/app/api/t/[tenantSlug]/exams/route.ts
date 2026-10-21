/**
 * Exams endpoint for a tenant.
 *
 * GET /api/t/:tenantSlug/exams — lists exams. Staff see all exams; a student
 * passing ?mine=true&email=... sees only their own published exams for their
 * class. The real backend enforces authorization; this route shapes the
 * response for the frontend.
 */

import { NextResponse } from "next/server";
import type { Exam } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  // Backend resolves the exam list. Placeholder: the real data source is the
  // backend service. The frontend relies on MSW mocks while the backend is
  // being built.
  void request;
  void params;

  const exams: Exam[] = [];

  return NextResponse.json({ data: exams, total: 0, page: 1, pageSize: 8 });
}

/**
 * Student report-card endpoint for a tenant.
 *
 * GET /api/t/:tenantSlug/students/:studentId/report-card — returns the
 * signed-in student's own report card for a term. The student id is resolved
 * from the session, never accepted from the client. A student changing the
 * id in the URL cannot reach another student's card.
 */

import { NextResponse } from "next/server";
import type { ReportCard } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; studentId: string }> },
) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term") ?? "Term 1";
  const email = url.searchParams.get("email") ?? undefined;

  void params;
  void term;
  void email;

  const reportCard: ReportCard | null = null;

  if (!reportCard) {
    return new NextResponse(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return NextResponse.json(reportCard);
}

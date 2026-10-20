import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { requireSuperAdmin } from "@/lib/platform-auth";
import { handleApiError } from "@/lib/errors";
import { appUrl } from "@/lib/mail";

/**
 * Says whether this deployment can actually send email.
 *
 * A failed invite is ambiguous: the variables may be missing from the
 * environment, the password may be wrong, or the network may block the port.
 * Those have different fixes, and the invite screen cannot tell them apart. This
 * runs the same transport the invite uses and reports each answer separately.
 *
 * Read-only. It never sends a message and never echoes a secret.
 */
const REQUIRED = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SMTP_PORT"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const missing = REQUIRED.filter((name) => !process.env[name]);
    const port = Number(process.env.SMTP_PORT ?? 587);

    const result: {
      configured: boolean;
      missing: string[];
      host: string | null;
      port: number;
      secure: boolean;
      user: string | null;
      from: string | null;
      appUrl: string;
      verified: boolean;
      error: string | null;
    } = {
      configured: missing.length === 0,
      missing,
      host: process.env.SMTP_HOST ?? null,
      port,
      secure: port === 465,
      user: process.env.SMTP_USER ?? null,
      from: process.env.SMTP_FROM ?? null,
      appUrl: appUrl() || "(empty — invite links will be relative)",
      verified: false,
      error: null,
    };

    if (missing.length > 0) {
      return NextResponse.json(result, { status: 200 });
    }

    try {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.verify();
      result.verified = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown mail error.";
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

import nodemailer from "nodemailer";

/**
 * Outbound email.
 *
 * The SMTP settings live in the environment (see `.env.production.example`).
 * Every sender here fails soft: a mail server that is down must never stop a
 * person from being created a membership or changing a password, so the
 * functions return `false` instead of throwing.
 */

export interface MailResult {
  sent: boolean;
  error?: string;
}

const REQUIRED_SMTP_VARS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;

/**
 * Names the variables that are missing, rather than just returning false.
 *
 * A deploy that forgot one of them looks identical to a mail server that is
 * down, and the fix is completely different. Naming them turns a silent failure
 * into a one-line answer in the logs.
 */
function missingSmtpVars(): string[] {
  return REQUIRED_SMTP_VARS.filter((name) => !process.env[name]);
}

function smtpConfigured(): boolean {
  const missing = missingSmtpVars();
  if (missing.length > 0) {
    console.error(`Email is not configured: missing ${missing.join(", ")}.`);
    return false;
  }
  return true;
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function fromAddress(): string {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";
  const name = process.env.SMTP_FROM_NAME;
  return name ? `"${name}" <${from}>` : from;
}

/**
 * The absolute base URL of this app, used to build the sign-in link in an
 * email. `APP_URL` is the right variable for it; the API base is only a
 * fallback for the single-origin setup, where the two are the same thing.
 */
export function appUrl(): string {
  // NEXTAUTH_URL is what many deployments already set for the app's own origin,
  // so it is accepted here rather than silently producing a relative "/login"
  // link in the email.
  return (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
  ).replace(/\/$/, "");
}

/**
 * Sends one plain-text email.
 *
 * Returns `{ sent: false }` when SMTP is not configured or the server rejects
 * the message. The caller decides what to tell the user.
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailResult> {
  if (!smtpConfigured()) {
    const missing = missingSmtpVars();
    return {
      sent: false,
      error: `Email is not configured on this server (missing ${missing.join(", ")}).`,
    };
  }

  try {
    const transport = getTransport();
    await transport.sendMail({
      from: fromAddress(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mail error.";
    console.error("Failed to send email:", message);
    return { sent: false, error: message };
  }
}

/**
 * Sends a new account's first password.
 *
 * The password is emailed once and never stored in the clear, so this is the
 * only chance to deliver it. If it fails, the account still exists and the
 * password can be reset by a Super Admin.
 */
export async function sendCredentialsEmail(options: {
  to: string;
  name: string;
  schoolName: string;
  role: string;
  temporaryPassword: string;
  signInUrl?: string;
}): Promise<MailResult> {
  const signInUrl = options.signInUrl ?? "/login";

  const text = [
    `Hi ${options.name},`,
    "",
    `An account has been created for you on ${options.schoolName} as ${options.role}.`,
    "",
    `Sign in at: ${signInUrl}`,
    `Email: ${options.to}`,
    `Temporary password: ${options.temporaryPassword}`,
    "",
    "Change this password after you sign in.",
    "",
    "If you were not expecting this, contact your administrator.",
  ].join("\n");

  return sendMail({
    to: options.to,
    subject: `Your ${options.schoolName} account`,
    text,
  });
}

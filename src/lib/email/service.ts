import type { SentMessageInfo } from "nodemailer";
import { getSmtpTransporter, smtpFrom } from "./transport";

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * The last transport-level failure, kept in memory so an admin screen or health
 * check can show why the last email did not go out. Cleared on every success.
 */
let lastSendError: Error | null = null;

/**
 * Sends one email through SMTP. Never throws — a failed send returns null and
 * the caller decides what to do, so a mail outage cannot fail a user-facing
 * request that already did its real work.
 */
export async function sendEmail(
  options: MailOptions,
): Promise<SentMessageInfo | null> {
  const { to, subject, html, text, replyTo } = options;
  const from = smtpFrom();

  try {
    const transporter = getSmtpTransporter();
    const info = await transporter.sendMail({
      from: `"${from.name}" <${from.address}>`,
      to,
      subject,
      text,
      html,
      replyTo,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[smtp] "${subject}" -> ${
          Array.isArray(to) ? to.join(", ") : to
        } (${info.messageId})`,
      );
    }

    lastSendError = null;
    return info;
  } catch (error) {
    lastSendError = error instanceof Error ? error : new Error(String(error));
    console.error("[smtp] send failed:", lastSendError.message);
    return null;
  }
}

export function getLastSendError(): Error | null {
  return lastSendError;
}

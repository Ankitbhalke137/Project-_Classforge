import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * SMTP transport for superadminclassforge@gmail.com.
 *
 * Gmail requires a 16-character App Password (Google Account → Security →
 * App passwords) when 2-Step Verification is on. A normal Gmail password will
 * be rejected by smtp.gmail.com.
 *
 * Env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=superadminclassforge@gmail.com
 *   SMTP_PASS=<gmail app password>
 *   SMTP_FROM=superadminclassforge@gmail.com
 *   SMTP_FROM_NAME=ClassForge Super Admin
 */

let transporter: Transporter | null = null;

export function getSmtpTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER and SMTP_PASS must be configured to send invite emails.",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user, pass },
  });

  return transporter;
}

export function smtpFrom() {
  return {
    name: process.env.SMTP_FROM_NAME ?? "ClassForge Super Admin",
    address: process.env.SMTP_FROM ?? process.env.SMTP_USER!,
  };
}

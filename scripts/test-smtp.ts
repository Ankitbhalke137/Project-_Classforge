/**
 * Verifies the Gmail SMTP setup by sending one email to yourself.
 *
 *   npx tsx scripts/test-smtp.ts you@example.com
 *
 * Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in .env.local.
 */
import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Next.js loads .env.local on its own, but a standalone script has to do it
// by hand. dotenv does not override an already-set variable, so .env.local is
// loaded first and it wins over .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

const to = process.argv[2] ?? process.env.SMTP_USER;

async function main() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    console.error(
      "Missing SMTP_HOST / SMTP_USER / SMTP_PASS. Check .env.local — SMTP_PASS must be a 16-character Gmail App Password.",
    );
    process.exit(1);
  }

  if (!to) {
    console.error("Give a recipient: npx tsx scripts/test-smtp.ts you@example.com");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  console.log(`Connecting to ${host}:${port} as ${user}...`);

  try {
    await transporter.verify();
    console.log("Connection OK. Sending test email...");
  } catch (error) {
    console.error("Connection FAILED:", (error as Error).message);
    process.exit(1);
  }

  try {
    const info = await transporter.sendMail({
      from: `"ClassForge Super Admin" <${from}>`,
      to,
      subject: "ClassForge SMTP test",
      text: "SMTP is working. This is a test message from ClassForge.",
      html: "<p>SMTP is working. This is a test message from <strong>ClassForge</strong>.</p>",
    });

    console.log(`Sent. messageId: ${info.messageId}`);
    console.log("Check the inbox of " + to);
  } catch (error) {
    console.error("Send FAILED:", (error as Error).message);
    process.exit(1);
  }
}

main();

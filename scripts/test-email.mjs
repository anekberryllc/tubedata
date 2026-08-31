/**
 * Prove the SMTP credentials work, before trusting them in a request path.
 *
 *   node --env-file=.env.local scripts/test-email.mjs
 *   node --env-file=.env.local scripts/test-email.mjs someone@example.com
 *
 * Verifies the connection and login FIRST, then sends. Separating the two is
 * the point: a bad app password fails at verify() with a clear authentication
 * error, whereas a send would bury it inside a generic failure.
 *
 * Check the message lands in the INBOX rather than spam. A first send from a
 * new setup is the moment to find that out, not a real refund notification.
 */
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!user || !pass) {
  console.error("SMTP_USER and SMTP_PASS are not set in .env.local — nothing to test.");
  console.error("Create an App Password at myaccount.google.com/apppasswords (needs 2-Step Verification).");
  process.exit(1);
}

const to = process.argv[2] ?? user;

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
  auth: { user, pass },
});

console.log(`connecting to ${host}:${port} as ${user} …`);

try {
  await transport.verify();
  console.log("✓ connection and login OK");
} catch (err) {
  console.error("✗ could not authenticate:", err.message);
  console.error("\nUsual causes:");
  console.error("  - using the account password instead of a 16-character App Password");
  console.error("  - 2-Step Verification not enabled on the account");
  console.error("  - a Workspace admin policy blocking app passwords");
  process.exit(1);
}

// The From address is the support mailbox, not the SMTP login — on providers
// other than Gmail the login is not an email address at all.
const from = process.env.MAIL_FROM ?? user;
if (!from.includes("@")) {
  console.error(`SMTP_USER (${user}) is not an email address — set MAIL_FROM to the sending address.`);
  process.exit(1);
}

const info = await transport.sendMail({
  from: `TubeData <${from}>`,
  to,
  subject: "TubeData SMTP test",
  text: `If you are reading this, the site can send mail as ${user}.

Sent by scripts/test-email.mjs at ${new Date().toISOString()}.`,
});

console.log(`✓ sent to ${to} — message id ${info.messageId}`);
console.log("Now check it arrived in the inbox and not in spam.");

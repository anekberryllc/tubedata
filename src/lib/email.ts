import nodemailer from "nodemailer";
import { SUPPORT_EMAIL } from "./support";

/**
 * Outbound email, over Gmail's SMTP.
 *
 * anekberry.com is on Google Workspace (its MX points at smtp.google.com) and
 * already publishes SPF and DKIM for Google, so authenticating as the mailbox
 * itself inherits that deliverability — no second vendor, no extra DNS. The
 * cost is an app password in the environment; if that becomes unacceptable,
 * swap the transport here and nothing else changes.
 *
 * NOTHING HERE MAY THROW INTO A REQUEST. Email is a side effect of actions
 * whose real work is already done: a refund request that was successfully
 * recorded must not report failure because Gmail was slow, and a Stripe
 * webhook that returns non-2xx gets retried forever. Every failure is caught
 * and logged, and send() reports it in its return value instead.
 *
 * With no credentials configured the whole thing is a no-op that logs what it
 * would have sent. That is deliberate: local development and preview
 * deployments should not need a mailbox to exercise the code paths.
 */

const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

/**
 * The address mail appears to come from. Defaults to the support inbox, which
 * is what we want in every case: on Gmail it is also the SMTP login, and on a
 * provider it is a domain-verified sender. Keeping it separate from SMTP_USER
 * is what makes switching provider a change of environment variables only.
 */
const MAIL_FROM = process.env.MAIL_FROM ?? SUPPORT_EMAIL;

/** False in any environment without SMTP credentials. */
export const isEmailConfigured = () => Boolean(user && pass);

/**
 * Created once and reused: nodemailer pools connections, and building a
 * transport per message would re-do the TLS handshake every time.
 */
let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host,
      port,
      // 587 is STARTTLS (secure:false, upgraded after connecting); 465 is
      // implicit TLS. Getting this backwards is the usual cause of a hang.
      secure: port === 465,
      auth: { user: user!, pass: pass! },
    });
  }
  return transport;
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true }
  | { ok: false; skipped?: false; message: string };

export async function sendEmail({
  to = SUPPORT_EMAIL,
  subject,
  text,
  replyTo,
}: {
  /** Defaults to the support inbox — most of what we send is to ourselves. */
  to?: string;
  subject: string;
  text: string;
  /** Set to the user's address so hitting Reply in Gmail answers them. */
  replyTo?: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) {
    console.warn(`[email] not configured — would have sent to ${to}: ${subject}`);
    return { ok: false, skipped: true };
  }

  try {
    const info = await getTransport().sendMail({
      // The support address, NOT the SMTP username. They are the same thing on
      // Gmail, where you authenticate as the mailbox — but every other provider
      // uses a login that is not an email address at all (Resend's is literally
      // "resend", SES issues a generated key), and putting that in a From
      // header produces a malformed address the server rejects.
      //
      // MAIL_FROM overrides it for the case where the sending identity has to
      // differ from the public contact address.
      from: `TubeData <${MAIL_FROM}>`,
      to,
      subject,
      text,
      replyTo,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown mail error.";
    console.error(`[email] failed to send "${subject}" to ${to}:`, message);
    return { ok: false, message };
  }
}

/**
 * Fire-and-forget for use inside a request handler.
 *
 * Awaited so the serverless invocation is not frozen mid-send, but its result
 * is deliberately discarded — the caller's own work has already succeeded and
 * must be reported as successful regardless of what the mail server did.
 */
export async function notifySupport(subject: string, text: string, replyTo?: string) {
  await sendEmail({ subject, text, replyTo });
}

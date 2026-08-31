/**
 * TWO ROLES: member and admin.
 *
 * A role is about POWERS OVER THE SITE; a plan is about what you bought. They
 * are stored in different columns and must stay that way — an admin on the free
 * plan is normal (that is how you'd test the free experience), and a Pro
 * subscriber must never gain moderation powers by paying.
 *
 * Deliberately free of auth and db imports: src/auth.ts imports from this file,
 * so importing either back would be circular. The guards that need a session
 * live in lib/admin.ts.
 */
// The site's one contact address, shared with the footer and the refund copy.
// Never a second copy of it, or those surfaces drift apart.
import { SUPPORT_EMAIL } from "./support";

export type Role = "admin" | "member";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
};

/**
 * Narrow an unknown column value to a Role.
 *
 * Anything unrecognised becomes "member" rather than throwing: a typo in the
 * database should cost someone their admin panel, never everyone's ability to
 * sign in. Failing closed is the only safe direction for a privilege check.
 */
export function toRole(value: unknown): Role {
  return value === "admin" ? "admin" : "member";
}

export const isAdmin = (role?: string | null): boolean => role === "admin";

/**
 * The one message a blocked user sees, wherever they hit the wall — the API,
 * a page, or a checkout attempt. Written in one place so the reason an admin
 * typed is quoted identically everywhere and never contradicts itself.
 */
export function blockedMessage(reason?: string | null): string {
  const base = "Your account has been suspended and cannot be used for lookups.";
  const why = reason?.trim() ? ` Reason: ${reason.trim()}` : "";
  return `${base}${why} Contact ${SUPPORT_EMAIL} if you think this is a mistake.`;
}

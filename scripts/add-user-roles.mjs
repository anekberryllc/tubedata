/**
 * One-off migration: roles and account blocking on "user".
 *
 *   node --env-file=.env.local scripts/add-user-roles.mjs
 *
 * Idempotent, and safe to re-run — that is the whole reason `role` is added
 * nullable first. Every row that exists BEFORE this runs is a founding account
 * and becomes an admin; the DEFAULT is only set afterwards, so every account
 * created from here on is a member. Re-running finds no NULLs and therefore
 * cannot silently re-promote someone who was deliberately demoted.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text`;
const promoted = await sql`UPDATE "user" SET "role" = 'admin' WHERE "role" IS NULL RETURNING email`;
await sql`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'member'`;
await sql`ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL`;

// The timestamp IS the flag: NULL means the account is active. Storing when,
// why and by whom rather than a bare boolean, because "why is this account
// locked out" is the first question anyone asks about a blocked user.
await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "blockedAt" timestamptz`;
await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "blockedReason" text`;
await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "blockedBy" text`;

console.log(`promoted to admin: ${promoted.length ? promoted.map(r => r.email).join(", ") : "none (already migrated)"}`);

const rows = await sql`SELECT email, role, plan, "blockedAt" FROM "user" ORDER BY email`;
console.table(rows);

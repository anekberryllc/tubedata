import {
  pgTable, text, timestamp, integer, primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Auth.js tables. Column names are camelCase because the Drizzle adapter
 * expects that exact shape — do not rename them to snake_case.
 */

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  // Our addition: which tier this user is on. Stripe updates this via webhook.
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripeCustomerId"),

  // Prepaid lookups, spent only after the daily free allowance runs out.
  // Never expire. Granted by the webhook, decremented in the video route.
  lookupCredits: integer("lookupCredits").notNull().default(0),

  // 'member' | 'admin'. Deliberately separate from `plan`: paying for Pro must
  // never grant moderation powers, and an admin need not be a subscriber.
  // Seeded by scripts/add-user-roles.mjs; new signups default to 'member'.
  role: text("role").notNull().default("member"),

  // Blocking. The timestamp IS the flag — null means the account is active.
  // Stored as when/why/by-whom rather than a bare boolean, because "why is this
  // account locked out" is the first question anyone asks about a blocked user.
  blockedAt: timestamp("blockedAt", { withTimezone: true, mode: "date" }),
  blockedReason: text("blockedReason"),
  /** The acting admin's user id. Not a foreign key: the note must outlive them. */
  blockedBy: text("blockedBy"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

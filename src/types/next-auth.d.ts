import type { Plan } from "@/lib/plans";
import type { Role } from "@/lib/roles";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: Plan;
      /** Prepaid lookup balance at the time the session was read. */
      lookupCredits: number;
      /** Site powers, not entitlements. See lib/roles.ts. */
      role: Role;
      /** True while the account is suspended. Re-read from the row per request. */
      blocked: boolean;
      /** What the admin typed when blocking, shown back to the user. */
      blockedReason: string | null;
    } & DefaultSession["user"];
  }
}

import type { Plan } from "@/lib/plans";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: Plan;
      /** Prepaid lookup balance at the time the session was read. */
      lookupCredits: number;
    } & DefaultSession["user"];
  }
}

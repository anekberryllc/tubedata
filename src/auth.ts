import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, users, accounts, sessions, verificationTokens } from "@/db";
import type { Plan } from "@/lib/plans";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],

  // Database sessions rather than JWTs: a plan change from a Stripe webhook
  // takes effect on the next request instead of waiting for a token to expire.
  session: { strategy: "database" },

  callbacks: {
    session({ session, user }) {
      // Expose the user's id, plan and credit balance to server code that reads
      // the session. `user` is the full database row under the database session
      // strategy, so none of this costs an extra query.
      const row = user as typeof user & { plan?: string; lookupCredits?: number };
      session.user.id = user.id;
      session.user.plan = (row.plan as Plan) ?? "free";
      // Only the value at session-read time. It goes stale the moment a lookup
      // spends one, which is why the header updates itself client-side.
      session.user.lookupCredits = row.lookupCredits ?? 0;
      return session;
    },
  },
});

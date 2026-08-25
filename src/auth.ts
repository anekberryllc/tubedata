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
      // Expose the user's id and plan to server code that reads the session.
      session.user.id = user.id;
      session.user.plan = (user as typeof user & { plan?: string }).plan as Plan ?? "free";
      return session;
    },
  },
});

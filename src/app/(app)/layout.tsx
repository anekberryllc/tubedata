import { auth } from "@/auth";
import { AuthHeader } from "@/components/AuthHeader";
import { BlockedNotice } from "@/components/BlockedNotice";

/**
 * The application routes: home, tools, pricing, account, history, admin.
 *
 * THIS is where the session is read, and reading it is what makes everything
 * under here dynamic. That is correct — every page in this group either shows
 * per-user state or gates on it. Moving the read down from the root layout is
 * what lets the (content) group next door be prerendered.
 *
 * One place to lock a suspended account out of every page in this group,
 * present and future. The header still renders, so they can read what happened
 * and sign out. Real enforcement lives in the API routes — this is the
 * explanation.
 *
 * The blocked gate deliberately does NOT extend to the (content) group: an
 * article about YouTube tags is public reading, and there is nothing for a
 * suspended account to abuse in it.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const blocked = !!session?.user?.blocked;

  return (
    <>
      <AuthHeader />
      {blocked ? (
        <BlockedNotice reason={session?.user?.blockedReason ?? null} />
      ) : (
        children
      )}
    </>
  );
}

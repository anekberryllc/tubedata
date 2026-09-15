import { auth, signOut } from "@/auth";
import { PLAN_LABELS, hasProAccess, type Plan } from "@/lib/plans";
import { isAdmin } from "@/lib/roles";
import { LoginButton } from "./AuthDialog";
import { UserMenu } from "./UserMenu";
import { BuyMeACoffee } from "./BuyMeACoffee";
import { HeaderShell } from "./HeaderShell";

/**
 * Server component: reads the session directly, no client-side auth state.
 * Sign in/out go through server actions rather than an API call from the browser.
 *
 * READING THE SESSION HERE IS WHAT MAKES A ROUTE DYNAMIC, which is why this
 * header is used only by the (app) group. The (content) group renders the same
 * HeaderShell with a client-side account cluster so its pages can be
 * prerendered — see ContentAccount.
 */
export async function AuthHeader() {
  const session = await auth();
  const user = session?.user;
  const plan = (user?.plan ?? "free") as Plan;

  // The badge names what the account CAN DO, not what it is billed. An admin
  // on the free plan has everything unlocked, and a badge reading "Free" next
  // to an unlocked site would just look broken.
  const premium = hasProAccess(user?.plan, user?.role);
  const viaAdmin = premium && plan !== "pro";

  return (
    <HeaderShell>
      <BuyMeACoffee />

      {user ? (
        <UserMenu
          email={user.email ?? null}
          name={user.name ?? null}
          image={user.image ?? null}
          planLabel={premium ? PLAN_LABELS.pro : PLAN_LABELS[plan]}
          premium={premium}
          viaAdmin={viaAdmin}
          initialCredits={user.lookupCredits ?? 0}
          // Only decides whether a link is drawn. /admin guards itself, so
          // a tampered prop reveals a 404 and nothing else.
          admin={isAdmin(user.role)}
          signOutAction={async () => {
            "use server";
            // No redirect here — the client forces a full page load so
            // premium data already held in React state cannot survive.
            await signOut({ redirect: false });
          }}
        />
      ) : (
        <LoginButton />
      )}
    </HeaderShell>
  );
}

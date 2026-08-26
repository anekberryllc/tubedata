import Link from "next/link";
import { auth, signOut } from "@/auth";
import { PLAN_LABELS, type Plan } from "@/lib/plans";
import { LoginButton } from "./AuthDialog";
import { UserMenu } from "./UserMenu";
import { BuyMeACoffee } from "./BuyMeACoffee";

/**
 * Server component: reads the session directly, no client-side auth state.
 * Sign in/out go through server actions rather than an API call from the browser.
 */
export async function AuthHeader() {
  const session = await auth();
  const user = session?.user;
  const plan = (user?.plan ?? "free") as Plan;
  const premium = plan !== "free";

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#070a12]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-[13px] font-black text-slate-950">
            T
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-100 transition group-hover:text-white">
            TubeData
            {/* Muted so the brand still reads "TubeData", while the wordmark
                doubles as the address people should type. */}
            <span className="font-normal text-slate-500 transition group-hover:text-slate-400">
              .io
            </span>
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <BuyMeACoffee />

          {user ? (
            <UserMenu
              email={user.email ?? null}
              name={user.name ?? null}
              image={user.image ?? null}
              planLabel={PLAN_LABELS[plan]}
              premium={premium}
              initialCredits={user.lookupCredits ?? 0}
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
        </div>
      </div>
    </header>
  );
}

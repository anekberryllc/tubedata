import Link from "next/link";
import { LogoMark } from "./Logo";
import { ToolsMenu } from "./ToolsMenu";
import { NavLink } from "./NavLink";

/**
 * The header, minus whoever is signed in.
 *
 * Extracted so the two headers cannot drift. There are two because of
 * rendering, not design:
 *
 *   AuthHeader    — server component, reads the session directly. Used on the
 *                   app routes, which are dynamic anyway.
 *   ContentHeader — reads no cookies, so the pages under it can be prerendered
 *                   as static HTML. The account cluster arrives client-side.
 *
 * Everything above the account cluster is identical between them and lives
 * here. A nav link added to one is added to both, which is the entire point.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#070a12]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <LogoMark className="h-7 w-7 shrink-0" />
          <span className="text-[15px] font-semibold tracking-tight text-slate-100 transition group-hover:text-white">
            TubeData
            {/* Muted so the brand still reads "TubeData", while the wordmark
                doubles as the address people should type. */}
            <span className="font-normal text-slate-500 transition group-hover:text-slate-400">
              .io
            </span>
          </span>
        </Link>

        {/* Sits next to the wordmark rather than in the right-hand cluster:
            these are destinations, and the right side is account and billing
            actions. */}
        <nav className="flex shrink-0 items-center gap-0.5">
          <ToolsMenu />
          <NavLink href="/guides">Guides</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">{children}</div>
      </div>
    </header>
  );
}

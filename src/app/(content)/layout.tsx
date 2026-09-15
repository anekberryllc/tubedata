import { HeaderShell } from "@/components/HeaderShell";
import { BuyMeACoffee } from "@/components/BuyMeACoffee";
import { ContentAccount } from "@/components/ContentAccount";

/**
 * The reading routes: guides and the privacy policy.
 *
 * NOTHING IN THIS LAYOUT MAY READ COOKIES OR HEADERS. That is the whole reason
 * the group exists — these pages have no per-user content, they are the ones
 * search engines actually fetch, and one cookie read anywhere in the tree turns
 * them all back into on-demand renders.
 *
 * So the account cluster is a client component that fetches the session after
 * the static HTML is already on screen. See ContentAccount for the trade that
 * makes.
 *
 * If a page under here ever needs the session on the server, it does not belong
 * in this group — move it to (app) rather than reaching for cookies here, or
 * everything beside it goes dynamic too.
 */
export default function ContentLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <HeaderShell>
        <BuyMeACoffee />
        <ContentAccount />
      </HeaderShell>
      {children}
    </>
  );
}

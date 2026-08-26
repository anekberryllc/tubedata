"use client";

/**
 * Keeps the header's prepaid balance in step with lookups happening on the page.
 *
 * The header is a server component and the lookup form is a client one; they are
 * siblings in the layout with no shared state, and the header does not re-render
 * when a lookup spends a credit. Its server-rendered number would sit there
 * stale until a full page load.
 *
 * A window event is enough, and is deliberately cheaper than the alternatives:
 * polling an endpoint would cost a request per tick for a number that usually
 * does not change, and router.refresh() would re-run every server component and
 * refetch the page to update one integer.
 *
 * The lookup response is the authority — it reports the balance AFTER the
 * request, so it is always at least as fresh as the session value.
 */
const EVENT = "tubedata:credits";

export function publishCredits(credits: number | null) {
  if (typeof window === "undefined" || credits === null) return;
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: credits }));
}

export function subscribeCredits(onChange: (credits: number) => void) {
  const handler = (e: Event) => onChange((e as CustomEvent<number>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

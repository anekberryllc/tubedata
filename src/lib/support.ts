/**
 * The public contact address, in one place.
 *
 * It is advertised in the footer, promised in refund-request copy, and given
 * to suspended accounts as the way to appeal — three surfaces that must never
 * disagree, because a card network or an angry user following the wrong one
 * reaches nobody. This lives in lib rather than beside any of them so no
 * surface owns it.
 *
 * A real mailbox has to exist behind this. Whatever domain it names must be
 * one we actually receive mail on.
 */
export const SUPPORT_EMAIL = "support@anekberry.com";

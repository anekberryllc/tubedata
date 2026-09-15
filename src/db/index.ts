import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

/**
 * The database handle.
 *
 * THIS FILE MUST NOT THROW AT IMPORT, and must still export a real drizzle
 * instance. Both halves of that are load-bearing, and each one rules out the
 * obvious fix for the other.
 *
 * It used to throw when DATABASE_URL was unset. That worked locally and broke
 * the Railway build:
 *
 *     Error: Failed to collect configuration for /api/video
 *       [cause]: Error: DATABASE_URL is not set
 *
 * Next.js evaluates route modules at BUILD time to collect their config, so a
 * throw at import is a throw during `next build`. It never showed up here
 * because every local build ran through `dotenv-cli -e .env.local`, handing the
 * build a variable it should never have needed. A build must not require
 * runtime secrets: compiling a page and connecting to a database are different
 * jobs, and a build host holding production credentials is one that can leak
 * them.
 *
 * The first fix was a Proxy that connected lazily on first property access.
 * It builds, and it breaks Auth.js:
 *
 *     Error: Unsupported database type (object) in Auth.js Drizzle adapter.
 *
 * DrizzleAdapter inspects the instance to work out its dialect, and a Proxy
 * over an empty object has no prototype to inspect. So the export has to be the
 * genuine article, constructed at import.
 *
 * Which leaves this: construct it always, and when the variable is absent, use
 * a placeholder whose HOSTNAME IS THE ERROR MESSAGE. `neon()` builds an
 * HTTP-based query function and connects to nothing until a query runs, so at
 * build time this costs nothing and nothing is contacted. If a query ever does
 * run without a real URL, the failure reads:
 *
 *     getaddrinfo ENOTFOUND database-url-is-not-set.invalid
 *
 * which names its own cause. `.invalid` is the reserved TLD guaranteed never to
 * resolve (RFC 2606), so this can never accidentally reach a real host.
 */
const PLACEHOLDER = "postgresql://unset:unset@database-url-is-not-set.invalid/unset";

const sql = neon(process.env.DATABASE_URL ?? PLACEHOLDER);

export const db = drizzle(sql, { schema: { ...schema, ...authSchema } });

export * from "./schema";
export * from "./auth-schema";

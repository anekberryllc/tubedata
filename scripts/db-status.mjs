// Dev utility: node --env-file=.env.local scripts/db-status.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const [{ v }] = await sql`SELECT COUNT(*)::int AS v FROM videos`;
const [{ s }] = await sql`SELECT COUNT(*)::int AS s FROM video_stats`;
const [{ l, q }] = await sql`SELECT COUNT(*)::int AS l, COALESCE(SUM(quota_units),0)::int AS q FROM lookups`;
console.log(`videos=${v}  snapshots=${s}  lookups=${l}  quota spent=${q}  saved=${l - q}`);

const top = await sql`SELECT ip_address, COUNT(*)::int AS n, COALESCE(SUM(quota_units),0)::int AS q
                      FROM lookups WHERE requested_at > now() - interval '1 hour'
                      GROUP BY ip_address ORDER BY q DESC LIMIT 5`;
console.log("\nlast hour by IP:");
for (const r of top) console.log(`  ${String(r.ip_address).padEnd(18)} requests=${r.n} quota=${r.q}`);

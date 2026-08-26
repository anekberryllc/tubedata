/**
 * Dev test: does the daily lookup allowance actually reset for an IP?
 *
 *   node --env-file=.env.local scripts/test-daily-reset.mjs
 *
 * Drives the REAL /api/video endpoint on localhost:3000 with a synthetic
 * client IP (TEST-NET-3, reserved for documentation — it can never collide
 * with a real visitor), then moves that IP's rows backwards in time to
 * simulate the clock advancing. Nothing else in the table is touched.
 *
 * Only cached videos are used, so this spends no YouTube quota.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TEST_IP = "203.0.113.7";
const LIMIT = 10;

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}${ok ? "" : `, expected ${expected}`}`);
};

/** Cached, available videos — a cache hit costs 0 quota units. */
async function pool() {
  const rows = await sql`SELECT video_id FROM videos WHERE status = 'available' LIMIT 10`;
  if (rows.length < 2) throw new Error("need at least 2 cached videos to test with");
  return rows.map(r => r.video_id);
}

/**
 * One lookup as TEST_IP.
 *
 * getClientIp takes the LAST X-Forwarded-For entry, and hitting :3000 direct
 * means Apache is not in the path to append a real peer — so this value is
 * what the route sees.
 *
 * Picks a video different from this IP's most recent one, because an
 * immediate repeat is deliberately free and would not move the counter.
 */
async function lookup(videos) {
  const [last] = await sql`
    SELECT video_id FROM lookups WHERE ip_address = ${TEST_IP} ORDER BY id DESC LIMIT 1`;
  const id = videos.find(v => v !== last?.video_id) ?? videos[0];

  const res = await fetch(`${BASE}/api/video?url=https://www.youtube.com/watch?v=${id}`, {
    headers: { "x-forwarded-for": TEST_IP },
  });
  return {
    status: res.status,
    header: res.headers.get("x-ratelimit-remaining"),
    retryAfter: res.headers.get("retry-after"),
    body: await res.json(),
  };
}

const clear = () => sql`DELETE FROM lookups WHERE ip_address = ${TEST_IP}`;
const shift = hours =>
  sql`UPDATE lookups SET requested_at = NOW() - (${hours} || ' hours')::interval
      WHERE ip_address = ${TEST_IP}`;
const countInWindow = async () => {
  const [r] = await sql`SELECT COUNT(*)::int n FROM lookups
                        WHERE ip_address = ${TEST_IP} AND requested_at > NOW() - interval '24 hours'`;
  return r.n;
};

const videos = await pool();
await clear();
console.log(`Testing as ${TEST_IP} against ${BASE}  (limit ${LIMIT}/24h)\n`);

// ---------------------------------------------------------------- day 1
console.log(`1. Spend all ${LIMIT} free lookups`);
for (let i = 1; i <= LIMIT; i++) {
  const r = await lookup(videos);
  const expected = LIMIT - i;
  const ok = r.status === 200 && r.body.rateLimit?.remaining === expected;
  if (!ok) failures++;
  console.log(
    `   ${ok ? "PASS" : "FAIL"}  #${String(i).padStart(2)}  ${r.status}  remaining=${r.body.rateLimit?.remaining}` +
    ` (header ${r.header})  cacheHit=${r.body.cacheHit}  quota=${r.body.quotaUnits}`
  );
}

console.log(`\n2. Lookup #${LIMIT + 1} — should be refused`);
{
  const r = await lookup(videos);
  check("status", r.status, 429);
  check("reason", r.body.reason, "rate_limited");
  check("remaining", r.body.rateLimit?.remaining, 0);
  const hrs = Number(r.retryAfter) / 3600;
  check("Retry-After is ~24h", hrs > 23.9 && hrs <= 24, true);
  console.log(`         Retry-After: ${r.retryAfter}s (${hrs.toFixed(2)}h) — "${r.body.message}"`);
}

// ------------------------------------------------- still inside the window
console.log("\n3. 23 hours later — still the same window, must STAY refused");
await shift(23);
{
  const r = await lookup(videos);
  check("in-window rows", await countInWindow(), LIMIT);
  check("status", r.status, 429);
  const mins = Number(r.retryAfter) / 60;
  console.log(`         Retry-After: ${r.retryAfter}s (~${mins.toFixed(0)} min left)`);
}

// ---------------------------------------------------------------- next day
console.log("\n4. 25 hours later — next day, allowance should be back");
await shift(25);
{
  check("in-window rows", await countInWindow(), 0);
  const r = await lookup(videos);
  check("status", r.status, 200);
  check("remaining after 1st lookup of the new day", r.body.rateLimit?.remaining, LIMIT - 1);
  check("header", r.header, String(LIMIT - 1));
}

// --------------------------------------------- rolling, not calendar-based
console.log("\n5. Rolling window: age out only SOME rows, allowance returns in part");
await clear();
for (let i = 0; i < LIMIT; i++) {
  await sql`INSERT INTO lookups (video_id, source_url, cache_hit, quota_units, ip_address, requested_at)
            VALUES (${videos[0]}, 'test', true, 0, ${TEST_IP},
                    NOW() - (${i < 4 ? 25 : 1} || ' hours')::interval)`;
}
{
  check("in-window rows (4 of 10 aged out)", await countInWindow(), 6);
  const r = await lookup(videos);
  check("status", r.status, 200);
  check("remaining reflects only the 4 freed slots", r.body.rateLimit?.remaining, 3);
  console.log("         → slots come back one at a time, 24h after each was used,");
  console.log("           NOT all at once at midnight.");
}

// --------------------------------------------------------------- teardown
await clear();
console.log(`\nCleanup: rows left for ${TEST_IP} = ${(await sql`SELECT COUNT(*)::int n FROM lookups WHERE ip_address = ${TEST_IP}`)[0].n}`);
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

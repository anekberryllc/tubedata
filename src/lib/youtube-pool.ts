import "server-only";
import { fetchVideoMetadata, type FetchResult } from "./youtube";
import { fetchChannel, type ChannelResult } from "./youtube-channel";
import {
  getUsableKeys,
  hasAnyKeys,
  markKeyExhausted,
  markKeyInvalid,
  noteKeyUsed,
} from "./api-keys";

/**
 * Fetch a video, spending whichever key still has quota.
 *
 * This is the seam between "which key" (a database question, server only) and
 * "call YouTube" (youtube.ts, which is reachable from client components and so
 * must stay free of database imports). Everything that needs metadata calls
 * here; nothing calls fetchVideoMetadata directly any more.
 *
 * THE LOOP IS THE WHOLE FEATURE. Google will not tell us in advance which key
 * has quota left, so the only way to find out is to try one:
 *
 *   1. take the keys in admin-chosen order;
 *   2. call with the first one;
 *   3. quotaExceeded → mark it spent, move to the next. The visitor who
 *      discovers the exhaustion pays one extra round trip; everyone after them
 *      skips that key until Google's Pacific-midnight reset;
 *   4. key refused outright → flag it for a person and move on, because a
 *      revoked key will not fix itself tomorrow;
 *   5. any other failure — video not found, network, a 500 from Google — is
 *      ABOUT THE VIDEO, NOT THE KEY. Return it immediately. Retrying those
 *      down the whole pool would turn one bad URL into N wasted quota units.
 */
export async function fetchVideoWithPool(sourceUrl: string): Promise<FetchResult> {
  const keys = await getUsableKeys();

  if (keys.length === 0) {
    return noUsableKeys(sourceUrl);
  }

  let lastQuotaMessage = "";

  for (const k of keys) {
    const result = await fetchVideoMetadata(sourceUrl, k.key);

    if (result.ok) {
      await noteKeyUsed(k.id);
      return result;
    }

    if (result.keyFailure === "quota") {
      lastQuotaMessage = result.message;
      // The call still cost a unit even though it failed, so count it: the
      // panel's "units today" should show where the quota actually went.
      await Promise.all([markKeyExhausted(k.id, result.message), noteKeyUsed(k.id)]);
      continue;
    }

    if (result.keyFailure === "invalid") {
      await markKeyInvalid(k.id, result.message);
      continue;
    }

    // Not the key's fault. Count the unit and hand the answer back as-is.
    await noteKeyUsed(k.id);
    return result;
  }

  return {
    ok: false,
    reason: "api_error",
    message: lastQuotaMessage
      ? "Every YouTube API key has reached its daily quota. Lookups resume after the quota resets at midnight Pacific time."
      : "No YouTube API key is currently usable. An administrator needs to check the key pool.",
  };
}

/**
 * Nothing in the pool can be used right now. Work out which of the two very
 * different reasons that is, because they need opposite answers.
 *
 * THE ORDER OF THESE CHECKS IS THE POINT. An empty pool means the feature was
 * never adopted, so YOUTUBE_API_KEY is still the configuration and is used —
 * that is what makes the pool safe to add to a running site, and it means a
 * database problem cannot take lookups down while the env var is set.
 *
 * A POPULATED pool that has nothing usable means every key an admin listed is
 * spent or flagged, and it must NOT quietly fall through to an env key. Once
 * the pool exists it is the configuration; an env var left over from before
 * would otherwise keep serving traffic on a key the admin believes is retired,
 * with nothing in the panel showing it.
 */
async function noUsableKeys(sourceUrl: string): Promise<FetchResult> {
  if (await hasAnyKeys()) {
    return {
      ok: false,
      reason: "api_error",
      message:
        "Every YouTube API key is out of rotation — spent for today, or flagged. " +
        "An administrator needs to check the key pool.",
    };
  }

  const envKey = process.env.YOUTUBE_API_KEY;
  if (envKey) return fetchVideoMetadata(sourceUrl, envKey);

  return {
    ok: false,
    reason: "api_error",
    message: "Server is missing a YouTube API key.",
  };
}

/**
 * The same rotation, for a channel lookup.
 *
 * Deliberately a near-duplicate of fetchVideoWithPool rather than a shared
 * generic over both. The two differ in the only place that would matter — a
 * channel call is THREE requests and can fail part-way through, having already
 * spent units — and a generic hiding that behind a callback would make the
 * quota accounting below harder to check, not easier. Three units is what a
 * channel costs; noteKeyUsed is told so.
 */
export async function fetchChannelWithPool(input: string): Promise<ChannelResult> {
  const keys = await getUsableKeys();

  if (keys.length === 0) {
    if (await hasAnyKeys()) {
      return {
        ok: false,
        reason: "api_error",
        message:
          "Every YouTube API key is out of rotation — spent for today, or flagged. " +
          "An administrator needs to check the key pool.",
      };
    }
    const envKey = process.env.YOUTUBE_API_KEY;
    if (envKey) return fetchChannel(input, envKey);
    return { ok: false, reason: "api_error", message: "Server is missing a YouTube API key." };
  }

  for (const k of keys) {
    const result = await fetchChannel(input, k.key);

    if (result.ok) {
      await noteKeyUsed(k.id, result.quotaUnits);
      return result;
    }

    if (result.keyFailure === "quota") {
      await Promise.all([markKeyExhausted(k.id, result.message), noteKeyUsed(k.id)]);
      continue;
    }

    if (result.keyFailure === "invalid") {
      await markKeyInvalid(k.id, result.message);
      continue;
    }

    // A bad URL or a channel that does not exist is not the key's fault, and
    // retrying it down the pool would spend units to be told the same thing.
    if (result.reason === "api_error") await noteKeyUsed(k.id);
    return result;
  }

  return {
    ok: false,
    reason: "api_error",
    message:
      "Every YouTube API key has reached its daily quota. Lookups resume after the " +
      "quota resets at midnight Pacific time.",
  };
}

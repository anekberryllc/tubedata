"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, apiKeys } from "@/db";
import { currentAdmin } from "@/lib/admin";
import { looksLikeApiKey, verifyKey } from "@/lib/api-keys";

/**
 * API key pool management.
 *
 * Every action re-checks admin the way the moderation actions do, and for the
 * same reason: a server action is an ordinary HTTP endpoint with a generated
 * id, so rendering the page only for admins hides the buttons and protects
 * nothing. These actions write CREDENTIALS, which makes the check the most
 * important line in the file rather than boilerplate.
 *
 * NOTHING HERE EVER RETURNS A KEY. Values go in from the form and are read
 * back only through listApiKeys(), which masks. There is deliberately no
 * "reveal" action: the key is already in Google Cloud Console if it is needed,
 * and an endpoint that prints credentials is a much better target than one
 * that does not exist.
 */

export type KeyActionResult = { ok: true; message?: string } | { ok: false; message: string };

const MAX_LABEL = 80;

function refresh() {
  revalidatePath("/admin/keys");
}

/**
 * Add a key, checking it against Google before it joins the rotation.
 *
 * The verification call costs one quota unit on the key being added. That is
 * the right trade: the alternative is finding out it was pasted wrong during
 * somebody's lookup, after the pool has already skipped past working keys.
 */
export async function addApiKey(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const label = String(formData.get("label") ?? "").trim().slice(0, MAX_LABEL);
  const key = String(formData.get("key") ?? "").trim();

  if (!key) return { ok: false, message: "Paste a key." };
  if (!label) return { ok: false, message: "Give the key a label so you can tell them apart." };

  if (!looksLikeApiKey(key)) {
    return {
      ok: false,
      message:
        "That does not look like a YouTube Data API key. They start with AIza and are 39 characters.",
    };
  }

  const check = await verifyKey(key);
  if (!check.ok) {
    return { ok: false, message: `Google rejected that key: ${check.message}` };
  }

  // Newest key goes last in the try order, so adding a spare never changes
  // which key the site is currently burning.
  const [{ next }] = await db
    .select({ next: sql<number>`COALESCE(MAX(${apiKeys.sortOrder}), 0) + 1` })
    .from(apiKeys);

  try {
    await db.insert(apiKeys).values({
      label,
      key,
      sortOrder: next,
      createdBy: admin.email ?? admin.id,
    });
  } catch {
    // The UNIQUE constraint on `key` is the only thing that can realistically
    // fail here, and "you already added this one" is more useful than the
    // Postgres text.
    return { ok: false, message: "That key is already in the pool." };
  }

  refresh();
  return { ok: true, message: `Added ${label} — Google accepted it.` };
}

/**
 * Replace the secret behind an existing entry.
 *
 * This is the "update the API key" path: the label, position and history stay,
 * and the quota flags are cleared because they described the OLD key and would
 * otherwise keep a working replacement out of rotation.
 */
export async function replaceApiKey(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const id = Number(formData.get("id"));
  const key = String(formData.get("key") ?? "").trim();

  if (!Number.isFinite(id)) return { ok: false, message: "Unknown key." };
  if (!looksLikeApiKey(key)) {
    return {
      ok: false,
      message: "That does not look like a YouTube Data API key (AIza…, 39 characters).",
    };
  }

  const check = await verifyKey(key);
  if (!check.ok) return { ok: false, message: `Google rejected that key: ${check.message}` };

  await db
    .update(apiKeys)
    .set({
      key,
      exhaustedAt: null,
      invalidAt: null,
      lastError: null,
      unitsToday: 0,
      unitsDate: null,
    })
    .where(eq(apiKeys.id, id));

  refresh();
  return { ok: true, message: "Key replaced and back in rotation." };
}

export async function renameApiKey(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const id = Number(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim().slice(0, MAX_LABEL);

  if (!Number.isFinite(id)) return { ok: false, message: "Unknown key." };
  if (!label) return { ok: false, message: "A label cannot be empty." };

  await db.update(apiKeys).set({ label }).where(eq(apiKeys.id, id));
  refresh();
  return { ok: true };
}

/** The admin's own on/off switch. Never written by the rotation code. */
export async function setApiKeyActive(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const id = Number(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  if (!Number.isFinite(id)) return { ok: false, message: "Unknown key." };

  await db.update(apiKeys).set({ active }).where(eq(apiKeys.id, id));
  refresh();
  return { ok: true };
}

/**
 * Clear the automatic flags on a key.
 *
 * For the case where the cause was fixed outside this app — a quota increase
 * granted, an IP restriction corrected — and waiting for the Pacific reset (or
 * for nothing at all, in the case of `invalidAt`) is not appropriate.
 */
export async function clearApiKeyFlags(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Unknown key." };

  await db
    .update(apiKeys)
    .set({ exhaustedAt: null, invalidAt: null, lastError: null })
    .where(eq(apiKeys.id, id));

  refresh();
  return { ok: true, message: "Flags cleared — the key is back in rotation." };
}

/**
 * Move a key up or down the try order.
 *
 * RENUMBERS THE WHOLE LIST rather than swapping two values. Swapping looks
 * cheaper and is wrong here: every key starts at sortOrder 0 until someone
 * reorders, and rows can share a position for other reasons too, so a swap can
 * leave two keys claiming the same slot and an order that depends on the id
 * tiebreak instead of on what the admin just did. Rewriting 0..n-1 is a
 * handful of rows and always leaves the list in the state shown on screen.
 */
export async function moveApiKey(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const id = Number(formData.get("id"));
  const direction = String(formData.get("direction"));
  if (!Number.isFinite(id)) return { ok: false, message: "Unknown key." };

  const rows = await db
    .select({ id: apiKeys.id, sortOrder: apiKeys.sortOrder })
    .from(apiKeys)
    .orderBy(apiKeys.sortOrder, apiKeys.id);

  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return { ok: false, message: "Unknown key." };

  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true }; // already at the end

  const reordered = [...rows];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];

  await Promise.all(
    reordered.map((row, position) =>
      db.update(apiKeys).set({ sortOrder: position }).where(eq(apiKeys.id, row.id))
    )
  );

  refresh();
  return { ok: true };
}

export async function deleteApiKey(formData: FormData): Promise<KeyActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorised." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Unknown key." };

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  refresh();
  return { ok: true, message: "Key removed from the pool." };
}

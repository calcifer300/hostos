import "server-only";
import { tryGetSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Team portraits uploaded from the editor live in a public Supabase Storage
 * bucket, `team`, one object per upload (`<slug>-<time>.jpg`, so a new photo
 * never fights a cached old one). The bucket is created on first use.
 */

const BUCKET = "team";
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

type Put = { ok: true; url: string } | { ok: false; error: string };

async function ensureBucket(client: NonNullable<ReturnType<typeof tryGetSupabaseAdmin>>): Promise<string | null> {
  const { data } = await client.storage.getBucket(BUCKET);
  if (data) return null;
  const { error } = await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: "12MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
  return error && !/already exists/i.test(error.message) ? error.message : null;
}

/** True for a URL that points into our bucket — the only photos we may delete. */
export const isTeamPhotoUrl = (url: string | null | undefined): url is string => typeof url === "string" && url.includes(PUBLIC_PREFIX);

export async function putTeamPhoto(bytes: ArrayBuffer, contentType: string, slug: string): Promise<Put> {
  const client = tryGetSupabaseAdmin();
  if (!client) return { ok: false, error: "Storage is not configured." };
  try {
    const bucketError = await ensureBucket(client);
    if (bucketError) return { ok: false, error: `Could not prepare the photo bucket: ${bucketError}` };
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${slug}-${Date.now().toString(36)}.${ext}`;
    const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The upload failed." };
  }
}

/**
 * Deletes a photo of ours once nothing points at it any more — after a
 * member is saved with a different photo, or removed. Best effort: a photo
 * that lingers costs a few hundred KB; a photo deleted too early is a hole
 * on the public page, so this is never called before the row is written.
 */
export async function removeTeamPhoto(url: string | null | undefined): Promise<void> {
  if (!isTeamPhotoUrl(url)) return;
  const client = tryGetSupabaseAdmin();
  if (!client) return;
  const path = url.slice(url.indexOf(PUBLIC_PREFIX) + PUBLIC_PREFIX.length).split("?")[0];
  try {
    await client.storage.from(BUCKET).remove([decodeURIComponent(path)]);
  } catch {
    // leave it; nothing references it
  }
}

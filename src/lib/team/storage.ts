import "server-only";
import { tryGetSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Photos uploaded from the editors live in public Supabase Storage buckets —
 * `team` for portraits, `site` for the landing page's photographs — one
 * object per upload (`<slug>-<time>.jpg`, so a new photo never fights a
 * cached old one). A bucket is created on first use.
 */

type Bucket = "team" | "site";
const LIMITS: Record<Bucket, string> = { team: "12MB", site: "16MB" };
const publicPrefix = (bucket: Bucket) => `/storage/v1/object/public/${bucket}/`;

type Put = { ok: true; url: string } | { ok: false; error: string };

async function ensureBucket(client: NonNullable<ReturnType<typeof tryGetSupabaseAdmin>>, bucket: Bucket): Promise<string | null> {
  const { data } = await client.storage.getBucket(bucket);
  if (data) return null;
  const { error } = await client.storage.createBucket(bucket, { public: true, fileSizeLimit: LIMITS[bucket], allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
  return error && !/already exists/i.test(error.message) ? error.message : null;
}

/** True for a URL that points into the given bucket of ours — the only objects we may delete. */
export const isOurObjectUrl = (bucket: Bucket, url: string | null | undefined): url is string => typeof url === "string" && url.includes(publicPrefix(bucket));
export const isTeamPhotoUrl = (url: string | null | undefined): url is string => isOurObjectUrl("team", url);

export async function putPublicObject(bucket: Bucket, bytes: ArrayBuffer, contentType: string, slug: string): Promise<Put> {
  const client = tryGetSupabaseAdmin();
  if (!client) return { ok: false, error: "Storage is not configured." };
  try {
    const bucketError = await ensureBucket(client, bucket);
    if (bucketError) return { ok: false, error: `Could not prepare the photo bucket: ${bucketError}` };
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${slug}-${Date.now().toString(36)}.${ext}`;
    const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The upload failed." };
  }
}

export const putTeamPhoto = (bytes: ArrayBuffer, contentType: string, slug: string): Promise<Put> => putPublicObject("team", bytes, contentType, slug);

/**
 * Deletes a photo of ours once nothing points at it any more — after a
 * member is saved with a different photo, or removed. Best effort: a photo
 * that lingers costs a few hundred KB; a photo deleted too early is a hole
 * on the public page, so this is never called before the row is written.
 */
export async function removePublicObject(bucket: Bucket, url: string | null | undefined): Promise<void> {
  if (!isOurObjectUrl(bucket, url)) return;
  const client = tryGetSupabaseAdmin();
  if (!client) return;
  const prefix = publicPrefix(bucket);
  const path = url.slice(url.indexOf(prefix) + prefix.length).split("?")[0];
  try {
    await client.storage.from(bucket).remove([decodeURIComponent(path)]);
  } catch {
    // leave it; nothing references it
  }
}

export const removeTeamPhoto = (url: string | null | undefined): Promise<void> => removePublicObject("team", url);

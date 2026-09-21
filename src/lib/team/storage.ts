import "server-only";
import { tryGetSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Photos uploaded from the editors live in public Supabase Storage buckets —
 * `team` for portraits, `site` for the landing page's photographs — one
 * object per upload (`<slug>-<time>.jpg`, so a new photo never fights a
 * cached old one). A bucket is created on first use.
 */

type Bucket = "team" | "site";
const LIMITS: Record<Bucket, string> = { team: "12MB", site: "50MB" };
const TYPES: Record<Bucket, string[]> = { team: ["image/jpeg", "image/png", "image/webp"], site: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"] };
const publicPrefix = (bucket: Bucket) => `/storage/v1/object/public/${bucket}/`;

type Put = { ok: true; url: string } | { ok: false; error: string };

async function ensureBucket(client: NonNullable<ReturnType<typeof tryGetSupabaseAdmin>>, bucket: Bucket): Promise<string | null> {
  const { data } = await client.storage.getBucket(bucket);
  if (data) {
    // keep the limits current (the site bucket grew to take video)
    if (data.file_size_limit !== undefined && String(data.file_size_limit) !== LIMITS[bucket]) await client.storage.updateBucket(bucket, { public: true, fileSizeLimit: LIMITS[bucket], allowedMimeTypes: TYPES[bucket] });
    return null;
  }
  const { error } = await client.storage.createBucket(bucket, { public: true, fileSizeLimit: LIMITS[bucket], allowedMimeTypes: TYPES[bucket] });
  return error && !/already exists/i.test(error.message) ? error.message : null;
}

/**
 * A one-shot signed URL the browser can PUT a file to directly — the way
 * a 100 MB video reaches storage without passing through a server action.
 * Returns the URL to upload to and the public URL the object will have.
 */
export async function signPublicUpload(bucket: Bucket, slug: string, ext: string): Promise<{ ok: true; uploadUrl: string; publicUrl: string; path: string } | { ok: false; error: string }> {
  const client = tryGetSupabaseAdmin();
  if (!client) return { ok: false, error: "Storage is not configured." };
  try {
    const bucketError = await ensureBucket(client, bucket);
    if (bucketError) return { ok: false, error: bucketError };
    const path = `${slug}-${Date.now().toString(36)}.${ext}`;
    const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? "Could not sign the upload." };
    return { ok: true, uploadUrl: data.signedUrl, publicUrl: client.storage.from(bucket).getPublicUrl(path).data.publicUrl, path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not sign the upload." };
  }
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

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

export async function putTeamPhoto(bytes: ArrayBuffer, contentType: string, slug: string, previous: string | null): Promise<Put> {
  const client = tryGetSupabaseAdmin();
  if (!client) return { ok: false, error: "Storage is not configured." };
  try {
    const bucketError = await ensureBucket(client);
    if (bucketError) return { ok: false, error: `Could not prepare the photo bucket: ${bucketError}` };
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${slug}-${Date.now().toString(36)}.${ext}`;
    const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) return { ok: false, error: error.message };
    // Best effort: the photo this one replaces, if it was ours, goes away.
    const old = previous && previous.includes(PUBLIC_PREFIX) ? previous.slice(previous.indexOf(PUBLIC_PREFIX) + PUBLIC_PREFIX.length) : null;
    if (old && old !== path) await client.storage.from(BUCKET).remove([old]);
    return { ok: true, url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The upload failed." };
  }
}

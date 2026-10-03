import "server-only";
import { getServerEnv } from "@/lib/env";
import { fetchJsonOrThrow } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface GmailTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

interface GmailAccountRow {
  user_email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

/** Called from the Auth.js jwt callback on sign-in — never exposes tokens to the client. */
export async function saveGmailTokens(userEmail: string, tokens: GmailTokens): Promise<void> {
  const { error } = await getSupabaseAdmin().from("gmail_accounts").upsert(
    {
      user_email: userEmail,
      access_token: tokens.accessToken,
      // Google only returns a refresh_token on the first consent; don't
      // overwrite a previously stored one with null on later logins.
      ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
      expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_email" }
  );

  if (error) {
    throw new Error(`Failed to save Gmail tokens: ${error.message}`);
  }
}

async function refreshAccessToken(userEmail: string, refreshToken: string): Promise<string> {
  const { googleClientId, googleClientSecret } = getServerEnv();
  if (!googleClientId || !googleClientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local.");
  }

  // Bounded, and distinguishes "Google is unreachable" (retryable) from
  // "Google rejected this refresh token" (needs the host to reconnect).
  const data = await fetchJsonOrThrow<{ access_token: string; expires_in: number }>(
    "Google OAuth",
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      timeoutMs: 10_000,
    }
  );

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await saveGmailTokens(userEmail, {
    accessToken: data.access_token,
    refreshToken: null,
    expiresAt,
  });

  return data.access_token;
}

/**
 * Returns a Gmail access token for this user, refreshing it first if it's
 * expired (or about to be). Throws a specific, user-actionable error if the
 * user has never granted Gmail access — that's the one condition Sprint 3
 * calls out as worth stopping for.
 */
export async function getValidAccessToken(userEmail: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("gmail_accounts")
    .select("user_email, access_token, refresh_token, expires_at")
    .eq("user_email", userEmail)
    .maybeSingle<GmailAccountRow>();

  if (error) {
    throw new Error(`Failed to read Gmail tokens: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      "Gmail isn't connected for this account yet. Sign out and sign back in, and approve Gmail access on the Google consent screen."
    );
  }

  const expiresAt = new Date(data.expires_at);
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 60_000;

  if (!isExpiringSoon) {
    return data.access_token;
  }

  if (!data.refresh_token) {
    throw new Error(
      "Your Gmail access has expired and no refresh token is on file. Sign out and sign back in to reconnect Gmail."
    );
  }

  return refreshAccessToken(userEmail, data.refresh_token);
}

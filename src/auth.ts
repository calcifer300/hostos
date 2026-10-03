import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServerEnv } from "@/lib/env";

const { googleClientId, googleClientSecret } = getServerEnv();

/**
 * Missing Google credentials disable sign-in — they do not take the app down.
 *
 * This used to `throw` at module scope. Because `auth()` is called from the
 * root (app) layout, that turned one unset variable into a 500 on every route
 * including the ones that need no account at all, which contradicts the
 * public-shell model this app is built around (Project Aurora Phase 1). The
 * startup report in src/instrumentation.ts names the missing variable; here we
 * simply register no provider, so /login degrades instead of the whole app.
 */
const googleConfigured = Boolean(googleClientId && googleClientSecret);

if (!googleConfigured) {
  console.warn(
    "[auth] Google sign-in is disabled: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. The app runs signed-out; Gmail-derived pages will prompt to connect an account."
  );
}

/**
 * Gmail integration is opt-in and OFF by default.
 *
 * Sprint 3 briefly wired Gmail directly into the login path and broke it:
 * the Gmail scope, and a Supabase write inside the jwt callback, both ran
 * during authentication, so any failure there (Gmail API not enabled, or
 * the gmail_accounts table not yet created) surfaced as
 * /api/auth/error?error=Configuration.
 *
 * Sign-in must never depend on Gmail or Supabase. Set GMAIL_SYNC_ENABLED=true
 * in .env.local only after both prerequisites are done — see README
 * "Enabling Gmail sync". With the flag off, this file is functionally
 * identical to the configuration that authenticated successfully.
 */
const gmailSyncEnabled = getServerEnv().gmailSyncEnabled;

const baseScope = "openid email profile";
const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured
    ? [
        Google({
          clientId: googleClientId as string,
          clientSecret: googleClientSecret as string,
          ...(gmailSyncEnabled
            ? {
                // access_type=offline + prompt=consent are what make Google
                // return a refresh_token; without forced consent, repeat
                // logins yield an access token only.
                authorization: {
                  params: {
                    scope: `${baseScope} ${gmailScope}`,
                    access_type: "offline",
                    prompt: "consent",
                  },
                },
              }
            : {}),
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // HostOS is by invitation: the Founder, the roster, and approved requests. Everyone else lands on the request form.
    async signIn({ user }) {
      try {
        const { isAllowedEmail } = await import("@/lib/access-requests");
        if (await isAllowedEmail(user.email)) return true;
      } catch (err) {
        console.error("[auth] allowlist check failed:", err);
        return false;
      }
      return `/login?error=AccessDenied&email=${encodeURIComponent(user.email ?? "")}`;
    },
    async jwt({ token, account }) {
      // Nothing Gmail-related may run unless explicitly enabled, and even
      // then it must not be able to fail the login. The import is dynamic
      // so the Supabase client (and its `server-only` guard) never enters
      // the middleware/proxy bundle graph when the flag is off.
      if (gmailSyncEnabled && account?.access_token && token.email) {
        try {
          const { saveGmailTokens } = await import("@/lib/gmail/tokens");
          await saveGmailTokens(token.email, {
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : new Date(Date.now() + 3600_000),
          });
        } catch (err) {
          // Log and continue: a Gmail/Supabase problem is a sync problem,
          // never a reason to reject an otherwise valid Google sign-in.
          console.error("[auth] Gmail token persistence failed (login unaffected):", err);
        }
      }
      return token;
    },
  },
});

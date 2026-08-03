import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local for Google sign-in to work."
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
const gmailSyncEnabled = process.env.GMAIL_SYNC_ENABLED === "true";

const baseScope = "openid email profile";
const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
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
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
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

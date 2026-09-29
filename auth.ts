import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { isDiscordAccessConfigured, verifyDiscordMembership } from "./src/lib/discord-verification";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID ?? "",
      clientSecret: process.env.AUTH_DISCORD_SECRET ?? "",
      authorization: { params: { scope: "identify guilds.members.read" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.discordAccessToken = account.access_token;
        token.discordRefreshToken = account.refresh_token;
        token.discordAccessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1_000
          : Date.now() + 7 * 24 * 60 * 60 * 1_000;
        token.discordReauthRequired = false;
      }

      const refreshToken = typeof token.discordRefreshToken === "string"
        ? token.discordRefreshToken
        : undefined;
      const expiresAt = typeof token.discordAccessTokenExpiresAt === "number"
        ? token.discordAccessTokenExpiresAt
        : undefined;
      if (refreshToken && expiresAt && expiresAt < Date.now() + 60_000) {
        try {
          const response = await fetch("https://discord.com/api/v10/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.AUTH_DISCORD_ID ?? "",
              client_secret: process.env.AUTH_DISCORD_SECRET ?? "",
              grant_type: "refresh_token",
              refresh_token: refreshToken,
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(5_000),
          });
          if (!response.ok) {
            token.discordReauthRequired = true;
            token.discordAccessToken = undefined;
            token.discordRefreshToken = undefined;
            console.error(`Discord OAuth token refresh failed with HTTP ${response.status}.`);
          } else {
            const refreshed = await response.json() as {
              access_token: string;
              refresh_token?: string;
              expires_in: number;
            };
            token.discordAccessToken = refreshed.access_token;
            token.discordRefreshToken = refreshed.refresh_token ?? token.discordRefreshToken;
            token.discordAccessTokenExpiresAt = Date.now() + refreshed.expires_in * 1_000;
            token.discordReauthRequired = false;
          }
        } catch (error) {
          token.discordReauthRequired = true;
          token.discordAccessToken = undefined;
          token.discordRefreshToken = undefined;
          console.error("Discord OAuth token refresh request failed:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      session.accessStatus = token.discordReauthRequired
        ? "unavailable"
        : isDiscordAccessConfigured()
          ? typeof token.discordAccessToken === "string"
            ? await verifyDiscordMembership(token.sub, token.discordAccessToken)
            : "unavailable"
          : "setup_required";
      return session;
    },
  },
});

export function hasDiscordOAuthConfiguration() {
  return Boolean(
    process.env.AUTH_DISCORD_ID &&
    process.env.AUTH_DISCORD_SECRET &&
    process.env.AUTH_SECRET,
  );
}

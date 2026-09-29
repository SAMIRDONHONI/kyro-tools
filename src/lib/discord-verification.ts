import "server-only";
import type { AccessStatus } from "./discord-shared";

type Member = { roles?: string[] };
type CachedStatus = { status: AccessStatus; expiresAt: number };

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const CACHE_TTL_MS = 1_000;
const accessCache = new Map<string, CachedStatus>();
const INVITE_URL = process.env.DISCORD_INVITE_URL || "https://discord.gg/N8c5m2QA8A";

export function isDiscordAccessConfigured() {
  return Boolean(
    process.env.AUTH_DISCORD_ID &&
    process.env.AUTH_DISCORD_SECRET &&
    process.env.AUTH_SECRET &&
    process.env.DISCORD_GUILD_ID &&
    SNOWFLAKE_PATTERN.test(process.env.DISCORD_GUILD_ID) &&
    process.env.DISCORD_REQUIRED_ROLE_ID &&
    SNOWFLAKE_PATTERN.test(process.env.DISCORD_REQUIRED_ROLE_ID),
  );
}

export function getDiscordInviteUrl() {
  try {
    const invite = new URL(INVITE_URL);
    if (
      invite.protocol === "https:" &&
      (invite.hostname === "discord.gg" || invite.hostname === "discord.com")
    ) {
      return invite.toString();
    }
  } catch {
    console.error("DISCORD_INVITE_URL must be a valid HTTPS Discord invite.");
  }
  return "https://discord.gg/N8c5m2QA8A";
}

export async function verifyDiscordMembership(
  userId: string | undefined,
  accessToken: string,
): Promise<Exclude<AccessStatus, "unauthenticated" | "setup_required">> {
  if (!userId || !isDiscordAccessConfigured()) return "unavailable";

  const now = Date.now();
  const cached = accessCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.status as Exclude<AccessStatus, "unauthenticated" | "setup_required">;
  }

  const guildId = process.env.DISCORD_GUILD_ID!;
  const roleId = process.env.DISCORD_REQUIRED_ROLE_ID!;
  try {
    const response = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      },
    );

    let status: Exclude<AccessStatus, "unauthenticated" | "setup_required">;
    if (response.status === 404) {
      status = "not_member";
    } else if (response.status === 403) {
      console.error("Discord membership verification was denied; ensure the OAuth app requests guilds.members.read.");
      return "unavailable";
    } else if (response.ok) {
      const member = await response.json() as Member;
      status = member.roles?.includes(roleId) ? "authorized" : "missing_role";
    } else {
      console.error(`Discord membership verification failed with HTTP ${response.status}.`);
      return "unavailable";
    }

    accessCache.set(userId, { status, expiresAt: now + CACHE_TTL_MS });
    if (accessCache.size > 2_000) {
      for (const [cachedUserId, entry] of accessCache) {
        if (entry.expiresAt <= now) accessCache.delete(cachedUserId);
      }
    }
    return status;
  } catch (error) {
    console.error("Discord membership verification request failed:", error);
    return "unavailable";
  }
}

import "server-only";
import { auth } from "../../auth";
import type { AccessStatus } from "./discord-shared";
import { isDiscordAccessConfigured } from "./discord-verification";
import { verifyVideoAccessToken, withVideoApiCors } from "./video-access-token";

export type { AccessStatus } from "./discord-shared";

function accessError(status: AccessStatus, request?: Request) {
  if (status === "authorized") return null;

  const message = status === "unauthenticated"
    ? "Sign in with Discord to use KYRO TOOLS."
    : status === "not_member"
      ? "Join the KYRO Discord server before using this feature."
      : status === "missing_role"
        ? "You need the creator access role in the KYRO Discord server."
        : status === "rate_limited"
          ? "Discord is temporarily rate-limiting role checks. Please wait a minute and try again."
        : status === "setup_required"
          ? "Discord access has not been configured."
          : "Discord access could not be verified. Try again.";
  const httpStatus = status === "unauthenticated" ? 401 : status === "unavailable" || status === "rate_limited" || status === "setup_required" ? 503 : 403;
  const response = Response.json({ error: message, status }, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
  return request ? withVideoApiCors(request, response) : response;
}

export async function checkRequestDiscordAccess(request?: Request, mediaJobId?: string) {
  if (process.env.VIDEO_API_TOKEN_SECRET) {
    const authorization = request?.headers.get("authorization");
    const queryToken = request ? new URL(request.url).searchParams.get("token") : null;
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    const token = queryToken ?? bearerToken;
    const claims = token ? verifyVideoAccessToken(token) : null;
    const mediaRequest = Boolean(queryToken);
    const validScope = mediaRequest
      ? claims?.scope === "media" && claims.jobId === mediaJobId
      : claims?.scope === "api";
    if (!claims || !validScope) {
      return { status: "unauthenticated" as AccessStatus, userId: null };
    }
    return { status: "authorized" as AccessStatus, userId: claims.sub };
  }
  if (!isDiscordAccessConfigured()) {
    return { status: "setup_required" as AccessStatus, userId: null };
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "unauthenticated" as AccessStatus, userId: null };
  return { status: session.accessStatus ?? "unavailable", userId };
}

export async function getVideoRequestAccess(request: Request, mediaJobId?: string) {
  const access = await checkRequestDiscordAccess(request, mediaJobId);
  if (access.status === "authorized" && access.userId) {
    return { ok: true as const, userId: access.userId };
  }
  const error = accessError(access.status, request);
  return {
    ok: false as const,
    error: error ?? Response.json({ error: "Video access could not be verified." }, { status: 401 }),
  };
}

export async function getDiscordAccessError(request?: Request, mediaJobId?: string) {
  const { status } = await checkRequestDiscordAccess(request, mediaJobId);
  return accessError(status, request);
}

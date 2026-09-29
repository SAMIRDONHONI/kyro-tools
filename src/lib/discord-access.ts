import "server-only";
import { auth } from "../../auth";
import type { AccessStatus } from "./discord-shared";
import { isDiscordAccessConfigured } from "./discord-verification";

export type { AccessStatus } from "./discord-shared";

export async function checkRequestDiscordAccess() {
  if (!isDiscordAccessConfigured()) {
    return { status: "setup_required" as AccessStatus, userId: null };
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "unauthenticated" as AccessStatus, userId: null };
  return { status: session.accessStatus ?? "unavailable", userId };
}

export async function getDiscordAccessError() {
  const { status } = await checkRequestDiscordAccess();
  if (status === "authorized") return null;

  const message = status === "unauthenticated"
    ? "Sign in with Discord to use KYRO TOOLS."
    : status === "not_member"
      ? "Join the KYRO Discord server before using this feature."
      : status === "missing_role"
        ? "You need the creator access role in the KYRO Discord server."
        : status === "setup_required"
          ? "Discord access has not been configured."
          : "Discord access could not be verified. Try again.";
  const httpStatus = status === "unauthenticated" ? 401 : status === "unavailable" || status === "setup_required" ? 503 : 403;
  return Response.json({ error: message, status }, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}

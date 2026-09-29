import { auth } from "../../auth";
import AccessGate from "./access-gate";
import Workspace from "./workspace";
import {
  getDiscordInviteUrl,
  isDiscordAccessConfigured,
} from "@/lib/discord-verification";

export const dynamic = "force-dynamic";

export default async function Home() {
  const inviteUrl = getDiscordInviteUrl();

  if (!isDiscordAccessConfigured()) {
    return <AccessGate status="setup_required" inviteUrl={inviteUrl} />;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return <AccessGate status="unauthenticated" inviteUrl={inviteUrl} />;
  }

  const status = session.accessStatus;
  if (status !== "authorized") {
    return <AccessGate status={status} inviteUrl={inviteUrl} username={session.user.name} />;
  }

  return <Workspace />;
}

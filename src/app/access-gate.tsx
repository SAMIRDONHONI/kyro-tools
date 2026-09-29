"use client";

import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, RefreshCw, ShieldCheck, Users, Zap } from "lucide-react";
import type { AccessStatus } from "@/lib/discord-shared";

type Props = {
  status: AccessStatus;
  inviteUrl: string;
  username?: string | null;
};

export default function AccessGate({ status, inviteUrl, username }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(status === "rate_limited" ? 60 : 0);

  useEffect(() => {
    if (status !== "rate_limited") return;

    const interval = window.setInterval(() => {
      setRetrySeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [status]);

  async function verifyRole() {
    setChecking(true);
    if (status === "rate_limited") setRetrySeconds(60);
    router.refresh();
    window.setTimeout(() => setChecking(false), 1_500);
  }

  async function continueWithDiscord() {
    setSigningIn(true);
    await signIn("discord", { redirectTo: "/" }, { prompt: "consent" });
  }

  const setupRequired = status === "setup_required";
  const notSignedIn = status === "unauthenticated";
  const notMember = status === "not_member";
  const missingRole = status === "missing_role";
  const rateLimited = status === "rate_limited";
  const unavailable = status === "unavailable";

  return (
    <main className="access-gate">
      <div className="gate-card">
        <Link className="brand gate-brand" href="/" aria-label="KYRO Tools home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-name">KYRO <span>TOOLS</span></span>
        </Link>

        <div className="gate-emblem">
          {setupRequired ? <LockKeyhole size={24} /> : notMember ? <Users size={25} /> : missingRole ? <ShieldCheck size={25} /> : unavailable || rateLimited ? <RefreshCw size={24} /> : <Zap size={24} />}
        </div>

        <span className="gate-kicker"><span className="live-dot" /> CREATOR ACCESS</span>
        <h1>
          {setupRequired && "Discord access isn’t configured yet."}
          {notSignedIn && "Join the server. Get the role. Create."}
          {notMember && "Join our Discord to continue."}
          {missingRole && "You’re in. One role away."}
          {rateLimited && "Discord is cooling down."}
          {unavailable && "We couldn’t verify your role."}
        </h1>
        <p className="gate-description">
          {setupRequired && "The site owner needs to finish setting up Discord sign-in, the server, and the access role before anyone can use the workspace."}
          {notSignedIn && "KYRO TOOLS is reserved for our Discord community. Join the server, connect your Discord account, and get the creator access role."}
          {notMember && "You’re signed in, but your Discord account hasn’t joined the server yet. Join first, then come back to verify."}
          {missingRole && "You’ve joined the server. Ask a moderator to give you the creator access role, then check your role again."}
          {rateLimited && "Discord temporarily rate-limited role checks. Wait a minute, then try again. Your role assignment has not changed."}
          {unavailable && "The Discord server couldn’t be reached right now. Your access stays locked until we can confirm your role."}
        </p>

        {username && <div className="gate-account"><span className="gate-account-dot" /><span>CONNECTED AS <strong>{username}</strong></span></div>}

        {notSignedIn && (
          <>
            <a className="button button-primary gate-action" href={inviteUrl} target="_blank" rel="noopener noreferrer">
              Join the Discord server <ArrowRight size={16} />
            </a>
            <button className="button button-secondary gate-action" onClick={continueWithDiscord} disabled={signingIn}>
              {signingIn ? "Connecting to Discord…" : "I joined — verify with Discord"} <ShieldCheck size={15} />
            </button>
          </>
        )}

        {setupRequired && (
          <a className="button button-primary gate-action" href={inviteUrl} target="_blank" rel="noopener noreferrer">
            Join the Discord server <ArrowRight size={16} />
          </a>
        )}

        {notMember && (
          <>
            <a className="button button-primary gate-action" href={inviteUrl} target="_blank" rel="noopener noreferrer">
              Join the Discord server <ArrowRight size={16} />
            </a>
            <button className="button button-secondary gate-action" onClick={verifyRole} disabled={checking}>
              {checking ? "Checking membership…" : "I joined — check again"} <RefreshCw size={14} />
            </button>
          </>
        )}

        {missingRole && (
          <>
            <div className="role-pending"><CheckCircle2 size={17} /><span>Server membership confirmed<strong>Waiting for your access role</strong></span></div>
            <button className="button button-primary gate-action" onClick={verifyRole} disabled={checking}>
              {checking ? "Checking your role…" : "Check my role"} <RefreshCw size={14} />
            </button>
          </>
        )}

        {unavailable && (
          <button className="button button-primary gate-action" onClick={verifyRole} disabled={checking}>
            {checking ? "Checking Discord…" : "Try again"} <RefreshCw size={14} />
          </button>
        )}

        {rateLimited && (
          <button className="button button-primary gate-action" onClick={verifyRole} disabled={checking || retrySeconds > 0}>
            {retrySeconds > 0 ? `Try again in ${retrySeconds}s` : checking ? "Checking Discord…" : "Try again"} <RefreshCw size={14} />
          </button>
        )}

        {username && !setupRequired && (
          <button className="gate-signout" onClick={() => signOut({ redirectTo: "/" })}>Not you? Sign out</button>
        )}

        <div className="gate-footnote"><LockKeyhole size={13} /><span>Every page and video endpoint checks your Discord role.<br />Your files stay private and are automatically deleted.</span></div>
      </div>
      <footer className="gate-footer"><span>KYRO TOOLS</span><i /> PRIVATE VIDEO COMPRESSION FOR CREATORS <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></footer>
    </main>
  );
}

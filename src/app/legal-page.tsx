import type { ReactNode } from "react";
import Link from "next/link";

type LegalPageProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

export default function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="brand" href="/" aria-label="KYRO TOOLS home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-name">KYRO<span>.</span></span>
        </Link>
        <Link className="legal-home-link" href="/">Back to KYRO TOOLS</Link>
      </header>
      <article className="legal-content">
        <div className="section-kicker">KYRO TOOLS · LEGAL</div>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        <p className="legal-updated">Effective date: September 30, 2026</p>
        <div className="legal-sections">{children}</div>
        <p className="legal-contact">
          Questions about this page? Contact KYRO TOOLS through our{" "}
          <a href="https://discord.gg/N8c5m2QA8A" target="_blank" rel="noreferrer">Discord server</a>.
        </p>
      </article>
      <footer className="legal-footer">
        <span>© 2026 KYRO TOOLS</span>
        <nav aria-label="Legal">
          <Link href="/terms">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </nav>
      </footer>
    </main>
  );
}

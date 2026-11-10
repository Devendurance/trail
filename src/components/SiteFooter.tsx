import Link from "next/link";
import { BOT_EXPLORER_URL, BOT_SITE_URL } from "@/lib/client/chain677";
import { TrailMark } from "./SiteHeader";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--hairline)] bg-[var(--n900)]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <TrailMark /> Trail
          </div>
          <p className="muted mt-3 max-w-sm text-sm">
            Firsthand reviews of BOT Chain apps, backed by proof that the reviewer really used them.
          </p>
        </div>
        <nav aria-label="Explore">
          <h2 className="font-display text-sm font-semibold text-white">Explore</h2>
          <ul className="muted mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/discover">Discover apps</Link></li>
            <li><Link className="hover:text-white" href="/rankings">Rankings</Link></li>
            <li><Link className="hover:text-white" href="/rewards">Rewards</Link></li>
            <li><Link className="hover:text-white" href="/methodology">Methodology</Link></li>
          </ul>
        </nav>
        <nav aria-label="BOT Chain">
          <h2 className="font-display text-sm font-semibold text-white">Built for BOT Chain</h2>
          <ul className="muted mt-3 space-y-2 text-sm">
            <li>
              <a className="hover:text-white" href={BOT_SITE_URL} target="_blank" rel="noopener noreferrer">
                botchain.ai
              </a>
            </li>
            <li>
              <a className="hover:text-white" href={BOT_EXPLORER_URL} target="_blank" rel="noopener noreferrer">
                scan.botchain.ai
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-5 text-center text-xs text-[var(--n400)]">
        Trail is independent. Reviews are opinions of the reviewers, not endorsements.
      </div>
    </footer>
  );
}

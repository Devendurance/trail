"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import WalletButton from "./WalletButton";

export const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/rankings", label: "Rankings" },
  { href: "/rewards", label: "Rewards" },
  { href: "/methodology", label: "Methodology" },
];

export function TrailMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#fff" />
      <path d="M7 22c5 0 4-8 9-8s4 6 9 6" stroke="#0a0a0a" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="25" cy="9" r="2.6" fill="#0a0a0a" />
    </svg>
  );
}

export default function SiteHeader() {
  const path = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === path;
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[rgba(10,10,10,0.7)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-[17px] font-semibold" aria-label="Trail home">
          <TrailMark />
          <span className="hidden sm:inline">Trail</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active(n.href) ? "bg-[var(--n800)] text-white" : "text-[var(--n400)] hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <WalletButton />
          <button
            className="btn btn-ghost md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpenFor(open ? null : path)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-[var(--hairline)] px-4 py-3 md:hidden">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className="flex min-h-12 items-center rounded-2xl px-3 text-base text-[var(--n200)] hover:bg-[var(--n850)]"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

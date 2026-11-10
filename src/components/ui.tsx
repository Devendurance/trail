import Link from "next/link";
import type { ReactNode } from "react";
import { explorerAddress, explorerTx, shortHash } from "@/lib/client/chain677";
import { OUTCOME_LABELS, REWARD_STATE_LABELS, type Tone } from "@/lib/client/states";
import type { PublicReview } from "@/lib/client/types";

export function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" aria-hidden>
          <path
            d="M10 1.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.6 4.8 17.5 6 11.7 1.6 7.7l5.9-.7z"
            fill={i <= Math.round(value) ? "#fff" : "none"}
            stroke={i <= Math.round(value) ? "#fff" : "#3a3a3a"}
            strokeWidth="1.2"
          />
        </svg>
      ))}
    </span>
  );
}

const TONE: Record<Tone, string> = {
  ok: "border-[rgba(69,195,90,0.35)] text-[var(--success)]",
  warn: "border-[rgba(240,180,41,0.35)] text-[var(--warn)]",
  error: "border-[rgba(255,107,107,0.4)] text-[var(--error)]",
  info: "border-[var(--hairline-strong)] text-[var(--n200)]",
};

export function Banner({ tone, title, children, action }: { tone: Tone; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border bg-[var(--n900)] p-4 ${TONE[tone]}`}>
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-[var(--n200)]">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--hairline-strong)] bg-[var(--n900)] p-8 text-center">
      <svg className="mx-auto mb-4" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
        <path d="M6 32c8 0 6-14 16-14s7 10 16 10" stroke="#3a3a3a" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
        <circle cx="38" cy="12" r="3.5" fill="#8a8a8a" />
      </svg>
      <h3 className="font-display text-xl">{title}</h3>
      <div className="muted mx-auto mt-2 max-w-md text-sm">{children}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Unavailable({ what }: { what: string }) {
  return (
    <Banner tone="warn" title={`${what} is temporarily unavailable`}>
      We could not load this right now. Nothing is lost. Refresh in a moment.
    </Banner>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-8 pt-12 md:px-6 md:pt-16">
      {eyebrow && <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--n400)]">{eyebrow}</p>}
      <h1 className="text-[32px] leading-[1.1] md:text-5xl">{title}</h1>
      {children && <div className="muted mt-4 max-w-2xl text-[17px] leading-relaxed">{children}</div>}
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1200px] px-4 md:px-6 ${className}`}>{children}</div>;
}

export function ProjectTile({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center font-display font-semibold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: "22%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 45%), #1c1c1c",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
        fontSize: size * 0.42,
      }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

export const ExtLink = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={`underline decoration-[var(--n700)] underline-offset-4 hover:decoration-white ${className ?? ""}`}>
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

/// Safe official outbound link: http(s) only.
export function safeHttp(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function EvidenceBadge() {
  return (
    <span className="badge badge-ok">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 6.5l2.6 2.5L10 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified action
    </span>
  );
}

/// Plain-text rendering only: React escapes, and whitespace is preserved.
export function ReviewCard({ r, showProject }: { r: PublicReview; showProject?: string }) {
  return (
    <article className="card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Stars value={r.rating} />
        <span className="badge">{OUTCOME_LABELS[r.outcome] ?? "Outcome unknown"}</span>
        <EvidenceBadge />
      </div>
      {showProject && <p className="muted mt-3 text-sm">{showProject}</p>}
      <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white">{r.body}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--hairline)] pt-4 text-xs text-[var(--n400)]">
        <a href={explorerAddress(r.reviewer)} target="_blank" rel="noopener noreferrer" className="hover:text-white" title={r.reviewer}>
          {shortAddr(r.reviewer)}
        </a>
        <time dateTime={r.publishedAt}>{new Date(r.publishedAt).toISOString().slice(0, 10)}</time>
        <span>{REWARD_STATE_LABELS[r.rewardState] ?? r.rewardState}</span>
        <Link href={`/reviews/${r.id}`} className="ml-auto text-white underline underline-offset-4">
          Read review
        </Link>
      </div>
    </article>
  );
}

export function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--n400)]">{label}</dt>
      <dd className="mt-1 break-all font-mono text-sm">
        <ExtLink href={explorerTx(hash)}>{shortHash(hash, 10)}</ExtLink>
      </dd>
    </div>
  );
}

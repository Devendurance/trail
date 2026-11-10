"use client";

import { useAuth } from "./Providers";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/// Compact header control plus a status line for each wallet state.
export default function WalletButton() {
  const { status, account, busy, connect, switchNetwork, signIn, logout, notice } = useAuth();

  let main: React.ReactNode;
  switch (status) {
    case "no_wallet":
      main = (
        <button className="btn btn-ghost" onClick={connect} aria-describedby="wallet-notice">
          Connect
        </button>
      );
      break;
    case "disconnected":
      main = (
        <button className="btn btn-ghost" onClick={connect} disabled={busy}>
          {busy ? "Connecting…" : "Connect"}
        </button>
      );
      break;
    case "wrong_network":
      main = (
        <button className="btn btn-ghost" onClick={switchNetwork} disabled={busy}>
          Switch to BOT Chain
        </button>
      );
      break;
    case "needs_signin":
      main = (
        <button className="btn btn-ghost" onClick={signIn} disabled={busy}>
          {busy ? "Waiting for wallet…" : "Sign in"}
        </button>
      );
      break;
    case "session_mismatch":
      main = (
        <button className="btn btn-ghost" onClick={signIn} disabled={busy}>
          Sign in as {account ? short(account) : "this wallet"}
        </button>
      );
      break;
    default:
      main = (
        <div className="flex items-center gap-2">
          <span className="badge badge-ok" title={account}>
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            {account ? short(account) : ""}
          </span>
          <button className="btn btn-link" onClick={logout}>
            Sign out
          </button>
        </div>
      );
  }

  return (
    <div className="relative">
      {main}
      <p id="wallet-notice" role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <p className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-[var(--hairline-strong)] bg-[var(--n850)] p-3 text-xs text-[var(--n200)]" aria-hidden>
          {notice}
        </p>
      )}
    </div>
  );
}

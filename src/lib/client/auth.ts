import { api, postJson } from "./api";
import { BOT_CHAIN_ID } from "./chain677";

export interface SessionInfo {
  authenticated: boolean;
  wallet?: string;
  chainId?: number;
  expiresAt?: string;
}

export type SignInResult =
  | { ok: true; wallet: string }
  | { ok: false; code: "REJECTED" | "WRONG_CHAIN" | "NETWORK" | "UNAVAILABLE" | "SESSION_MISMATCH" | "ERROR"; message: string };

export async function fetchSession(): Promise<SessionInfo> {
  const r = await api<SessionInfo>("/api/auth/session", { timeoutMs: 8000 });
  return r.ok ? r.data : { authenticated: false };
}

export function isRejection(e: unknown): boolean {
  const o = e as { code?: number; name?: string; message?: string; cause?: { code?: number } } | null;
  const s = (o?.message ?? "").toLowerCase();
  return o?.code === 4001 || o?.cause?.code === 4001 || o?.name === "UserRejectedRequestError" || s.includes("user rejected") || s.includes("user denied");
}

/// Challenge -> sign the exact returned message -> verify -> confirm session.
/// `sign` is injected so the same flow is testable without a wallet.
/// This is an off-chain login signature. It publishes nothing and costs no gas.
export async function signInWithWallet(args: {
  wallet: string;
  chainId: number | undefined;
  sign: (message: string) => Promise<string>;
}): Promise<SignInResult> {
  if (args.chainId !== BOT_CHAIN_ID) {
    return { ok: false, code: "WRONG_CHAIN", message: "Switch your wallet to BOT Chain (677) first." };
  }
  const ch = await postJson<{ message: string }>("/api/auth/challenge", { wallet: args.wallet, chainId: BOT_CHAIN_ID });
  if (!ch.ok) {
    return ch.code === "NETWORK"
      ? { ok: false, code: "NETWORK", message: "Could not reach Trail. Try again." }
      : { ok: false, code: "UNAVAILABLE", message: ch.message };
  }
  let signature: string;
  try {
    signature = await args.sign(ch.data.message);
  } catch (e) {
    return isRejection(e)
      ? { ok: false, code: "REJECTED", message: "You declined the sign-in request. Nothing was sent." }
      : { ok: false, code: "ERROR", message: "Your wallet could not sign the message." };
  }
  const v = await postJson<{ authenticated: boolean; wallet: string }>("/api/auth/verify", {
    message: ch.data.message,
    signature,
  });
  if (!v.ok) {
    return { ok: false, code: v.code === "NETWORK" ? "NETWORK" : "UNAVAILABLE", message: v.message };
  }
  const session = await fetchSession();
  if (!session.authenticated || session.wallet?.toLowerCase() !== args.wallet.toLowerCase()) {
    return { ok: false, code: "SESSION_MISMATCH", message: "Sign-in did not match your wallet. Try again." };
  }
  return { ok: true, wallet: session.wallet! };
}

export async function signOut(): Promise<void> {
  await postJson("/api/auth/logout", {});
}

export type AuthStatus =
  | "no_wallet"
  | "disconnected"
  | "wrong_network"
  | "needs_signin"
  | "session_mismatch"
  | "authenticated";

/// Pure derivation of what the user needs to do next.
export function deriveAuthStatus(args: {
  hasProvider: boolean;
  account: string | undefined;
  chainId: number | undefined;
  session: SessionInfo | null;
}): AuthStatus {
  if (!args.hasProvider) return "no_wallet";
  if (!args.account) return "disconnected";
  if (args.chainId !== BOT_CHAIN_ID) return "wrong_network";
  if (!args.session?.authenticated || !args.session.wallet) return "needs_signin";
  if (args.session.wallet.toLowerCase() !== args.account.toLowerCase()) return "session_mismatch";
  return "authenticated";
}

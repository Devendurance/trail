import { api, postJson } from "./api";
import type { PreparedReview } from "./types";
import { RECONCILE_RETRY_CODES } from "./states";

export const MIN_BODY = 100;
export const MAX_BODY = 700;

/// Mirrors the server's normalizeBody so the counter matches what is hashed.
export function normalizeBodyClient(body: string): string {
  return body.normalize("NFC").replace(/\s+/g, " ").trim();
}

export type BodyCheck = { ok: true; length: number } | { ok: false; length: number; message: string };

export function checkBody(body: string): BodyCheck {
  const length = normalizeBodyClient(body).length;
  if (length < MIN_BODY) return { ok: false, length, message: `Write at least ${MIN_BODY} characters (${MIN_BODY - length} more).` };
  if (length > MAX_BODY) return { ok: false, length, message: `Keep it under ${MAX_BODY} characters (${length - MAX_BODY} too many).` };
  return { ok: true, length };
}

export const isTxHash = (v: string) => /^0x[0-9a-fA-F]{64}$/.test(v.trim());

export interface ProofOk {
  eligible: true;
  code: "OK";
  project: { id: number; slug: string; name: string };
  action: { selector: string; target: string; version: number };
  proof: { txHash: string; from: string; domainName: string; tokenId: string; blockNumber: number; confirmations: number };
  explorerUrl: string;
}
export interface ProofNo {
  eligible: false;
  code: string;
  message: string;
  explorerUrl?: string;
}
export type ProofOutcome = { kind: "ok"; data: ProofOk } | { kind: "no"; code: string; message: string; explorerUrl?: string };

/// Never treats a hash as verified until the API says eligible: true.
export async function checkProof(projectId: number, transactionHash: string): Promise<ProofOutcome> {
  const r = await postJson<ProofOk | ProofNo>("/api/proofs/check", { projectId, transactionHash: transactionHash.trim() });
  if (!r.ok) return { kind: "no", code: r.code === "NETWORK" ? "NETWORK" : r.code, message: r.message };
  const d = r.data;
  if (d.eligible === true && d.code === "OK") return { kind: "ok", data: d };
  const no = d as ProofNo;
  return { kind: "no", code: no.code ?? "ERROR", message: no.message ?? "Not eligible.", explorerUrl: no.explorerUrl };
}

export type PrepareOutcome =
  | { kind: "ok"; prepared: PreparedReview }
  | { kind: "no"; code: string; message: string };

export async function prepareReview(args: {
  projectId: number;
  transactionHash: string;
  rating: number;
  outcome: number;
  body: string;
}): Promise<PrepareOutcome> {
  const r = await postJson<PreparedReview | { eligible: false; code: string; message: string }>("/api/reviews/prepare", args);
  if (!r.ok) return { kind: "no", code: r.code, message: r.message };
  const d = r.data;
  if ("eligible" in d && d.eligible === true) return { kind: "ok", prepared: d as PreparedReview };
  const no = d as { code: string; message: string };
  return { kind: "no", code: no.code, message: no.message };
}

export type ReconcileOutcome =
  | { kind: "ok"; reviewId: number; reviewTxHash: string; onchainReviewId: number }
  | { kind: "no"; code: string; message: string };

interface ReconcileResp {
  reconciled: boolean;
  code: string;
  message?: string;
  review?: { id: number; onchainReviewId: number; reviewTxHash: string };
}

/// The chain needs a few confirmations before the backend accepts it, so
/// retry the retryable codes. Only a reconciled response means "published".
export async function reconcileWithRetry(
  transactionHash: string,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ReconcileOutcome> {
  const attempts = opts.attempts ?? 20;
  const delay = opts.delayMs ?? 3000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: ReconcileOutcome = { kind: "no", code: "NETWORK", message: "Could not reach Trail." };
  for (let i = 0; i < attempts; i++) {
    const r = await postJson<ReconcileResp>("/api/reviews/reconcile", { transactionHash });
    if (r.ok && r.data.reconciled && r.data.review) {
      return { kind: "ok", reviewId: r.data.review.id, reviewTxHash: r.data.review.reviewTxHash, onchainReviewId: r.data.review.onchainReviewId };
    }
    const code = r.ok ? r.data.code : r.code;
    const message = r.ok ? (r.data.message ?? "Not reconciled.") : r.message;
    last = { kind: "no", code, message };
    if (!RECONCILE_RETRY_CODES.has(code)) return last;
    await sleep(delay);
  }
  return last;
}

export async function fetchPublishingAvailable(): Promise<boolean | null> {
  const r = await api<{ publishingAvailable: boolean }>("/api/config", { timeoutMs: 8000 });
  return r.ok ? r.data.publishingAvailable : null;
}

/// A prepared authorization can be reused on retry until its deadline.
/// Reusing it avoids re-staging a second row while the first still blocks.
export function reusablePrepared(
  cached: { prepared: PreparedReview; key: string } | null,
  key: string,
  nowMs = Date.now(),
  marginMs = 30_000,
): PreparedReview | null {
  if (!cached || cached.key !== key) return null;
  return new Date(cached.prepared.expiresAt).getTime() - marginMs > nowMs ? cached.prepared : null;
}

export const draftKey = (slug: string, wallet?: string) => `trail:draft:${slug}:${(wallet ?? "anon").toLowerCase()}`;

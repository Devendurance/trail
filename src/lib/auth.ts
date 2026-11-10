import { createHmac, randomBytes, createHash } from "node:crypto";
import { recoverMessageAddress, type Hex } from "viem";
import { AUTH_TTL_SECONDS, SESSION_TTL_SECONDS } from "./config";

export const SESSION_COOKIE = "trail_session";

export interface Challenge {
  nonce: string;
  message: string;
  expiresAt: Date;
}

export function createChallengeInput(): { nonce: string; nonceHash: string } {
  const nonce = randomBytes(32).toString("hex");
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  return { nonce, nonceHash };
}

export function buildChallengeMessage(args: {
  wallet: `0x${string}`;
  domain: string;
  chainId: number;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    "Trail sign-in",
    "",
    `Wallet: ${args.wallet}`,
    `Domain: ${args.domain}`,
    `Chain ID: ${args.chainId}`,
    `Nonce: ${args.nonce}`,
    `Issued: ${args.issuedAt.toISOString()}`,
    `Expires: ${args.expiresAt.toISOString()}`,
    "",
    "This signature only signs you in. It never moves funds or publishes a review.",
  ].join("\n");
}

export async function recoverChallengeSigner(message: string, signature: Hex): Promise<`0x${string}`> {
  return recoverMessageAddress({ message, signature });
}

export interface SessionPayload {
  wallet: `0x${string}`;
  chainId: number;
  domain: string;
  iat: number;
  exp: number;
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

export function createSessionToken(payload: SessionPayload, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function parseSessionToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.wallet || !payload.exp || payload.exp * 1000 < Date.now()) return null;
    return { ...payload, wallet: payload.wallet.toLowerCase() as `0x${string}` };
  } catch {
    return null;
  }
}

export function newSessionPayload(wallet: `0x${string}`, chainId: number, domain: string): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return { wallet: wallet.toLowerCase() as `0x${string}`, chainId, domain, iat: now, exp: now + SESSION_TTL_SECONDS };
}

export function sessionCookieHeader(token: string, secure: boolean, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function challengeTTL(): { issuedAt: Date; expiresAt: Date } {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + AUTH_TTL_SECONDS * 1000);
  return { issuedAt, expiresAt };
}

// ---- minimal in-memory rate limiter (per process) ----
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

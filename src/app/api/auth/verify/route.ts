import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  buildChallengeMessage,
  clientIp,
  createSessionToken,
  newSessionPayload,
  rateLimit,
  recoverChallengeSigner,
  sessionCookieHeader,
} from "@/lib/auth";
import { getSessionSecret } from "@/lib/config";
import { isSecureRequest } from "@/lib/session";
import { createHash } from "node:crypto";

const Body = z.object({
  message: z.string().min(10).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

function parseField(message: string, label: string): string | null {
  const m = message.match(new RegExp(`^${label}: (.+)$`, "m"));
  return m ? m[1].trim() : null;
}

export async function POST(req: Request) {
  if (!rateLimit(`verify:${clientIp(req.headers)}`, 30, 60_000)) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests." } }, { status: 429 });
  }
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Sessions are not configured." } }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "message and signature required." } }, { status: 400 });
  }
  const { message, signature } = parsed.data;
  const nonce = parseField(message, "Nonce");
  const walletField = parseField(message, "Wallet");
  if (!nonce || !walletField) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Malformed challenge message." } }, { status: 400 });
  }
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  const db = getDb();
  // Atomically consume: single-use, unexpired only.
  const consumed = await db
    .execute(sql`UPDATE login_nonces SET used_at = now()
      WHERE nonce_hash = ${nonceHash} AND used_at IS NULL AND expires_at > now()
      RETURNING wallet, chain_id AS "chainId", domain, expires_at AS "expiresAt"`)
    .catch(() => null);
  const row = (consumed?.rows?.[0] ?? null) as {
    wallet: string;
    chainId: number;
    domain: string;
    expiresAt: string;
  } | null;
  if (!row) {
    return NextResponse.json({ error: { code: "INVALID_NONCE", message: "Nonce unknown, reused, or expired." } }, { status: 401 });
  }
  // Recompute the exact expected message and require a byte match.
  const expected = buildChallengeMessage({
    wallet: row.wallet as `0x${string}`,
    domain: row.domain,
    chainId: row.chainId,
    nonce,
    issuedAt: new Date(new Date(row.expiresAt).getTime() - 600_000),
    expiresAt: new Date(row.expiresAt),
  });
  if (message !== expected) {
    return NextResponse.json({ error: { code: "INVALID_MESSAGE", message: "Message fields do not match the challenge." } }, { status: 401 });
  }
  let recovered: `0x${string}`;
  try {
    recovered = await recoverChallengeSigner(message, signature as `0x${string}`);
  } catch {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature recovery failed." } }, { status: 401 });
  }
  if (recovered.toLowerCase() !== row.wallet.toLowerCase()) {
    return NextResponse.json({ error: { code: "WRONG_WALLET", message: "Signature is not from the challenged wallet." } }, { status: 401 });
  }
  const payload = newSessionPayload(recovered, row.chainId, row.domain);
  const token = createSessionToken(payload, secret);
  const res = NextResponse.json({ authenticated: true, wallet: payload.wallet, chainId: payload.chainId });
  res.headers.set("Set-Cookie", sessionCookieHeader(token, isSecureRequest(req)));
  return res;
}

export async function GET() {
  return NextResponse.json({ hint: "POST { message, signature } to verify." }, { status: 405 });
}

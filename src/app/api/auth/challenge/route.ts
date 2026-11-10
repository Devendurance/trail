import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { loginNonces } from "@/db/schema";
import {
  buildChallengeMessage,
  challengeTTL,
  clientIp,
  createChallengeInput,
  rateLimit,
} from "@/lib/auth";
import { BOT_MAINNET_CHAIN_ID, getAppDomain } from "@/lib/config";

const Body = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int(),
});

function requestDomain(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host;
    } catch {
      // fall through
    }
  }
  return req.headers.get("host") ?? getAppDomain();
}

export async function POST(req: Request) {
  if (!rateLimit(`challenge:${clientIp(req.headers)}`, 20, 60_000)) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests." } }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "wallet and chainId required." } }, { status: 400 });
  }
  const chainId = parsed.data.chainId;
  const wallet = parsed.data.wallet.toLowerCase() as `0x${string}`;
  if (chainId !== BOT_MAINNET_CHAIN_ID) {
    return NextResponse.json({ error: { code: "WRONG_CHAIN", message: "Only BOT Chain mainnet (677) is supported." } }, { status: 400 });
  }
  const domain = requestDomain(req);
  const { nonce, nonceHash } = createChallengeInput();
  const { issuedAt, expiresAt } = challengeTTL();
  const message = buildChallengeMessage({
    wallet: wallet as `0x${string}`,
    domain,
    chainId,
    nonce,
    issuedAt,
    expiresAt,
  });
  try {
    await getDb().insert(loginNonces).values({
      nonceHash,
      wallet,
      chainId,
      domain,
      expiresAt,
    });
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
  return NextResponse.json({ message, nonce, expiresAt: expiresAt.toISOString() });
}

export async function GET() {
  // Allow clients to discover the challenge TTL without minting a nonce.
  return NextResponse.json({ chainId: BOT_MAINNET_CHAIN_ID, ttlSeconds: 600 });
}

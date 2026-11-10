import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    wallet: session.wallet,
    chainId: session.chainId,
    domain: session.domain,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}

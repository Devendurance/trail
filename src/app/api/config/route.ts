import { NextResponse } from "next/server";
import { registryClient } from "@/lib/registry";
import { computeReadiness, configuredInputs, liveReader, type Readiness } from "@/lib/readiness";

/// Public, non-secret readiness so the UI is honest before a user writes a review.
/// "publishingAvailable" is true only when the real contract, signer and (optional
/// ?projectId=) project are ready. Cached briefly to avoid hammering the RPC.
const TTL_MS = 20_000;
const cache = new Map<string, { at: number; value: Readiness }>();

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("projectId");
  const projectId = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : undefined;
  const key = String(projectId ?? "all");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.value);
  const value = await computeReadiness({
    ...configuredInputs(),
    projectId,
    reader: liveReader(registryClient() as never),
  });
  cache.set(key, { at: Date.now(), value });
  return NextResponse.json(value);
}

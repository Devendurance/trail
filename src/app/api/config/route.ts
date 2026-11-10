import { NextResponse } from "next/server";
import { BOT_MAINNET_CHAIN_ID, getDeployedRegistry, getSessionSecret, getVerifierKey } from "@/lib/config";

/// Public, non-secret capability flags so the UI can be honest before a user
/// writes a review. Never exposes keys or secrets.
export async function GET() {
  const publishingAvailable = Boolean(
    getDeployedRegistry(BOT_MAINNET_CHAIN_ID) && getVerifierKey() && getSessionSecret(),
  );
  return NextResponse.json({ chainId: BOT_MAINNET_CHAIN_ID, publishingAvailable });
}

export const BOT_MAINNET_CHAIN_ID = 677;
export const BOT_MAINNET_RPC =
  process.env.BOT_MAINNET_RPC ?? "https://rpc.botchain.ai";
export const BOT_MAINNET_EXPLORER =
  process.env.BOT_MAINNET_EXPLORER ?? "https://scan.botchain.ai";

export function explorerTxUrl(hash: string): string {
  return `${BOT_MAINNET_EXPLORER}/tx/${hash}`;
}

export function getDeployedRegistry(chainId: number): `0x${string}` | null {
  const addr =
    chainId === BOT_MAINNET_CHAIN_ID ? process.env.REGISTRY_ADDRESS_MAINNET : undefined;
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return addr as `0x${string}`;
}

export function getVerifierKey(): `0x${string}` | null {
  const key = process.env.VERIFIER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key as `0x${string}`;
}

export function getSessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function getAppDomain(): string {
  return process.env.APP_DOMAIN ?? "localhost:3000";
}

export function getAdminAddresses(): string[] {
  return (process.env.ADMIN_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a));
}

export function rewardsProgramFlags() {
  return {
    visible: process.env.REWARDS_PROGRAM_VISIBLE === "true",
    accepting: process.env.REWARDS_ACCEPTING_SUBMISSIONS === "true",
    claimEnabled: process.env.REWARDS_CLAIM_ENABLED === "true",
    funded: false,
    vault: null as string | null,
  };
}

export const CONFIRMATIONS_REQUIRED = 3;
export const AUTH_TTL_SECONDS = 600;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

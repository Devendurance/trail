import { defineChain } from "viem";

/// Client-safe BOT Chain definition (chain 677). No server imports.
export const BOT_CHAIN_ID = 677;
export const BOT_RPC_URL = "https://rpc.botchain.ai";
export const BOT_EXPLORER_URL = "https://scan.botchain.ai";
export const BOT_SITE_URL = "https://botchain.ai";

export const botChain = defineChain({
  id: BOT_CHAIN_ID,
  name: "BOT Chain",
  nativeCurrency: { decimals: 18, name: "BOT", symbol: "BOT" },
  rpcUrls: { default: { http: [BOT_RPC_URL] } },
  blockExplorers: { default: { name: "BOT Scan", url: BOT_EXPLORER_URL } },
});

export const explorerTx = (hash: string) => `${BOT_EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${BOT_EXPLORER_URL}/address/${addr}`;
export const shortHash = (h: string, n = 6) =>
  h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h;

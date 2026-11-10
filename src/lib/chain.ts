import { createPublicClient, defineChain, http, type Transaction, type TransactionReceipt } from "viem";
import { BOT_MAINNET_CHAIN_ID, BOT_MAINNET_RPC } from "./config";

export const botMainnet = defineChain({
  id: BOT_MAINNET_CHAIN_ID,
  name: "BOT Chain",
  nativeCurrency: { decimals: 18, name: "BOT", symbol: "BOT" },
  rpcUrls: { default: { http: [BOT_MAINNET_RPC] } },
  blockExplorers: { default: { name: "BOT Scan", url: "https://scan.botchain.ai" } },
});

export function botPublicClient() {
  return createPublicClient({ chain: botMainnet, transport: http(BOT_MAINNET_RPC) });
}

export type PublicClient = ReturnType<typeof botPublicClient>;

/// Minimal read surface the verifier needs. Production uses a viem client;
/// tests inject recorded fixtures.
export interface ProofProvider {
  getChainId(): Promise<number | null>;
  getBlockNumber(): Promise<bigint>;
  getTransaction(hash: `0x${string}`): Promise<Transaction | null>;
  getReceipt(hash: `0x${string}`): Promise<TransactionReceipt | null>;
  getCode(address: `0x${string}`): Promise<`0x${string}` | undefined>;
}

export function liveProvider(client: PublicClient): ProofProvider {
  return {
    getChainId: async () => {
      try {
        return await client.getChainId();
      } catch {
        return null;
      }
    },
    getBlockNumber: () => client.getBlockNumber(),
    getTransaction: async (hash) => {
      try {
        return await client.getTransaction({ hash });
      } catch {
        return null;
      }
    },
    getReceipt: async (hash) => {
      try {
        return await client.getTransactionReceipt({ hash });
      } catch {
        return null;
      }
    },
    getCode: (address) => client.getCode({ address }),
  };
}

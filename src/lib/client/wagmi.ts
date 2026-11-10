import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { botChain, BOT_RPC_URL } from "./chain677";

export const wagmiConfig = createConfig({
  chains: [botChain],
  connectors: [injected()],
  transports: { [botChain.id]: http(BOT_RPC_URL) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

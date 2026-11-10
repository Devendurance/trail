"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useChainId, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { wagmiConfig } from "@/lib/client/wagmi";
import { BOT_CHAIN_ID } from "@/lib/client/chain677";
import {
  deriveAuthStatus,
  fetchSession,
  isRejection,
  signInWithWallet,
  signOut,
  type AuthStatus,
  type SessionInfo,
} from "@/lib/client/auth";

interface AuthCtx {
  status: AuthStatus;
  account: `0x${string}` | undefined;
  session: SessionInfo | null;
  busy: boolean;
  notice: string | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  signIn: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearNotice: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <Providers>");
  return v;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const { address, connector } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const hasProvider = useSyncExternalStore(
    () => () => undefined,
    () => Boolean((window as unknown as { ethereum?: unknown }).ethereum),
    () => true,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setSession(await fetchSession());
  }, []);

  useEffect(() => {
    // Initial session read from the server on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSession();
  }, [refreshSession]);

  // The wallet may sit on another network than the app. useChainId reports
  // the configured chain, so read the wallet's actual chain from the connector.
  const [walletChain, setWalletChain] = useState<number | undefined>(undefined);
  useEffect(() => {
    let off = false;
    if (!connector || !address) return;
    const read = async () => {
      try {
        const id = await connector.getChainId();
        if (!off) setWalletChain(id);
      } catch {
        if (!off) setWalletChain(undefined);
      }
    };
    void read();
    const eth = (window as unknown as { ethereum?: { on?: (e: string, f: () => void) => void; removeListener?: (e: string, f: () => void) => void } }).ethereum;
    eth?.on?.("chainChanged", read);
    return () => {
      off = true;
      eth?.removeListener?.("chainChanged", read);
    };
  }, [connector, address, chainId]);

  const status = deriveAuthStatus({ hasProvider, account: address, chainId: address ? walletChain : undefined, session });

  // Session expiry: poll lightly and on focus.
  useEffect(() => {
    if (!session?.authenticated) return;
    const t = setInterval(() => void refreshSession(), 60_000);
    const onFocus = () => void refreshSession();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [session?.authenticated, refreshSession]);

  const connect = useCallback(async () => {
    setNotice(null);
    if (!hasProvider) {
      setNotice("No browser wallet found. Install an EVM wallet such as MetaMask or Rabby, then reload.");
      return;
    }
    setBusy(true);
    try {
      const inj = connectors[0];
      await connectAsync({ connector: inj });
    } catch (e) {
      setNotice(isRejection(e) ? "Connection request declined." : "Could not connect your wallet.");
    } finally {
      setBusy(false);
    }
  }, [connectAsync, connectors, hasProvider]);

  const switchNetwork = useCallback(async () => {
    setNotice(null);
    setBusy(true);
    try {
      await switchChainAsync({ chainId: BOT_CHAIN_ID });
      const id = await connector?.getChainId();
      setWalletChain(id);
    } catch (e) {
      setNotice(isRejection(e) ? "Network switch declined." : "Your wallet could not switch to BOT Chain.");
    } finally {
      setBusy(false);
    }
  }, [switchChainAsync, connector]);

  const signIn = useCallback(async () => {
    if (!address) return false;
    setNotice(null);
    setBusy(true);
    try {
      const r = await signInWithWallet({
        wallet: address,
        chainId: walletChain,
        sign: (message) => signMessageAsync({ message }),
      });
      if (!r.ok) {
        setNotice(r.message);
        return false;
      }
      await refreshSession();
      return true;
    } finally {
      setBusy(false);
    }
  }, [address, walletChain, signMessageAsync, refreshSession]);

  const logout = useCallback(async () => {
    await signOut();
    setSession({ authenticated: false });
    try {
      await disconnectAsync();
    } catch {
      /* wallet may already be gone */
    }
  }, [disconnectAsync]);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      account: address,
      session,
      busy,
      notice,
      connect,
      switchNetwork,
      signIn,
      logout,
      refreshSession,
      clearNotice: () => setNotice(null),
    }),
    [status, address, session, busy, notice, connect, switchNetwork, signIn, logout, refreshSession],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

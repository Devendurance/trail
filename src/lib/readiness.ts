import { privateKeyToAccount } from "viem/accounts";
import { BOT_MAINNET_CHAIN_ID, getDeployedRegistry, getSessionSecret, getVerifierKey } from "./config";
import { registryAbi } from "./registry-abi";

export interface ReadinessChecks {
  registryConfigured: boolean;
  signerConfigured: boolean;
  sessionConfigured: boolean;
  contractLive: boolean | null;
  verifierMatches: boolean | null;
  paused: boolean | null;
  projectActive: boolean | null;
}

export interface Readiness {
  chainId: number;
  publishingAvailable: boolean;
  checks: ReadinessChecks;
}

export interface RegistryReader {
  getCode(address: `0x${string}`): Promise<string | undefined>;
  verifier(address: `0x${string}`): Promise<string>;
  paused(address: `0x${string}`): Promise<boolean>;
  projectActive(address: `0x${string}`, projectId: bigint): Promise<boolean>;
}

/// Publishing is only reported available when the real contract exists at the
/// configured address, its on-chain verifier is the backend signer, it is not
/// paused, and (when asked) the project is active. Any read failure is "not ready".
export async function computeReadiness(args: {
  registry: `0x${string}` | null;
  signerAddress: string | null;
  sessionConfigured: boolean;
  projectId?: number;
  reader: RegistryReader;
}): Promise<Readiness> {
  const checks: ReadinessChecks = {
    registryConfigured: Boolean(args.registry),
    signerConfigured: Boolean(args.signerAddress),
    sessionConfigured: args.sessionConfigured,
    contractLive: null,
    verifierMatches: null,
    paused: null,
    projectActive: null,
  };
  const base = checks.registryConfigured && checks.signerConfigured && checks.sessionConfigured;
  if (base && args.registry) {
    try {
      const code = await args.reader.getCode(args.registry);
      checks.contractLive = Boolean(code && code !== "0x");
      if (checks.contractLive) {
        checks.verifierMatches =
          (await args.reader.verifier(args.registry)).toLowerCase() === args.signerAddress!.toLowerCase();
        checks.paused = await args.reader.paused(args.registry);
        if (args.projectId !== undefined) {
          checks.projectActive = await args.reader.projectActive(args.registry, BigInt(args.projectId));
        }
      }
    } catch {
      // Unreadable chain state is never "ready".
      checks.contractLive = checks.contractLive ?? false;
    }
  }
  const projectOk = args.projectId === undefined ? true : checks.projectActive === true;
  const publishingAvailable =
    base && checks.contractLive === true && checks.verifierMatches === true && checks.paused === false && projectOk;
  return { chainId: BOT_MAINNET_CHAIN_ID, publishingAvailable, checks };
}

export function liveReader(client: {
  getCode(a: { address: `0x${string}` }): Promise<string | undefined>;
  readContract(a: never): Promise<unknown>;
}): RegistryReader {
  const read = (address: `0x${string}`, functionName: string, args: unknown[] = []) =>
    (client.readContract as (a: unknown) => Promise<unknown>)({ address, abi: registryAbi, functionName, args });
  return {
    getCode: (address) => client.getCode({ address }),
    verifier: async (a) => (await read(a, "verifier")) as string,
    paused: async (a) => (await read(a, "paused")) as boolean,
    projectActive: async (a, id) => (await read(a, "projectActive", [id])) as boolean,
  };
}

export function configuredInputs() {
  const key = getVerifierKey();
  return {
    registry: getDeployedRegistry(BOT_MAINNET_CHAIN_ID),
    signerAddress: key ? privateKeyToAccount(key).address : null,
    sessionConfigured: Boolean(getSessionSecret()),
  };
}

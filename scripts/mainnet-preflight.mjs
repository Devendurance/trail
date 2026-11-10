// Read-only mainnet preflight. Sends NO transactions and prints NO secrets.
// Usage:  node scripts/mainnet-preflight.mjs            (before deploy)
//         node scripts/mainnet-preflight.mjs --post     (after deploy + env set)
// Env:    DEPLOYER_ADDRESS (pre), VERIFIER_PRIVATE_KEY (derives signer address only),
//         REGISTRY_ADDRESS_MAINNET (post), PROJECT_ID (default 1)
import { createPublicClient, http, formatEther, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.BOT_MAINNET_RPC ?? "https://rpc.botchain.ai";
const post = process.argv.includes("--post");
const projectId = BigInt(process.env.PROJECT_ID ?? "1");
const client = createPublicClient({ transport: http(RPC) });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

const chainId = await client.getChainId().catch(() => null);
check("RPC reports chain 677", chainId === 677, `(got ${chainId})`);

const key = process.env.VERIFIER_PRIVATE_KEY;
const keyOk = /^0x[0-9a-fA-F]{64}$/.test(key ?? "");
check("VERIFIER_PRIVATE_KEY is set and well-formed", keyOk);
const signer = keyOk ? privateKeyToAccount(key).address : null;
if (signer) console.log(`INFO  verifier (signer) address = ${signer}`);

if (!post) {
  const dep = process.env.DEPLOYER_ADDRESS;
  const depOk = /^0x[0-9a-fA-F]{40}$/.test(dep ?? "");
  check("DEPLOYER_ADDRESS is set", depOk);
  if (depOk) {
    const bal = await client.getBalance({ address: dep });
    const gasPrice = await client.getGasPrice();
    // Deploy (~1.5M gas) + setProjectActive (~60k); 2x headroom.
    const need = gasPrice * 3_200_000n;
    console.log(`INFO  deployer balance ${formatEther(bal)} BOT, gas price ${gasPrice} wei, suggested minimum ${formatEther(need)} BOT`);
    check("Deployer has enough BOT for deploy + activation", bal >= need);
    if (signer) check("Deployer address differs from verifier address", dep.toLowerCase() !== signer.toLowerCase());
  }
} else {
  const registry = process.env.REGISTRY_ADDRESS_MAINNET;
  const regOk = /^0x[0-9a-fA-F]{40}$/.test(registry ?? "");
  check("REGISTRY_ADDRESS_MAINNET is set", regOk);
  if (regOk) {
    const abi = parseAbi([
      "function verifier() view returns (address)",
      "function owner() view returns (address)",
      "function paused() view returns (bool)",
      "function projectActive(uint256) view returns (bool)",
    ]);
    const code = await client.getCode({ address: registry });
    check("Contract code exists at registry address", Boolean(code && code !== "0x"));
    const rd = (fn, args = []) => client.readContract({ address: registry, abi, functionName: fn, args }).catch(() => null);
    const v = await rd("verifier");
    check("On-chain verifier equals backend signer", Boolean(v && signer && v.toLowerCase() === signer.toLowerCase()), `(on-chain ${v})`);
    console.log(`INFO  owner = ${await rd("owner")}`);
    check("Not paused", (await rd("paused")) === false);
    check(`Project ${projectId} active`, (await rd("projectActive", [projectId])) === true);
  }
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed. Do not proceed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);

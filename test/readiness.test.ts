import { describe, expect, it } from "vitest";
import { computeReadiness, type RegistryReader } from "../src/lib/readiness";

const REG = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
const SIGNER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const good: RegistryReader = {
  getCode: async () => "0x6080",
  verifier: async () => SIGNER.toLowerCase(),
  paused: async () => false,
  projectActive: async () => true,
};
const base = { registry: REG, signerAddress: SIGNER, sessionConfigured: true, projectId: 1 };

describe("publishing readiness", () => {
  it("is available only when contract, signer, session and project are all ready", async () => {
    const r = await computeReadiness({ ...base, reader: good });
    expect(r.publishingAvailable).toBe(true);
    expect(r.checks).toMatchObject({ contractLive: true, verifierMatches: true, paused: false, projectActive: true });
  });

  it.each([
    ["no registry", { registry: null }],
    ["no signer", { signerAddress: null }],
    ["no session secret", { sessionConfigured: false }],
  ])("is unavailable with %s and never reads the chain", async (_n, patch) => {
    let reads = 0;
    const reader: RegistryReader = { ...good, getCode: async () => { reads++; return "0x6080"; } };
    const r = await computeReadiness({ ...base, ...patch, reader });
    expect(r.publishingAvailable).toBe(false);
    expect(reads).toBe(0);
  });

  it("is unavailable when no contract exists at the address", async () => {
    const r = await computeReadiness({ ...base, reader: { ...good, getCode: async () => "0x" } });
    expect(r.publishingAvailable).toBe(false);
    expect(r.checks.contractLive).toBe(false);
  });

  it("is unavailable when the on-chain verifier is not the backend signer", async () => {
    const r = await computeReadiness({ ...base, reader: { ...good, verifier: async () => "0x" + "22".repeat(20) } });
    expect(r.publishingAvailable).toBe(false);
    expect(r.checks.verifierMatches).toBe(false);
  });

  it("is unavailable when paused or the project is inactive", async () => {
    expect((await computeReadiness({ ...base, reader: { ...good, paused: async () => true } })).publishingAvailable).toBe(false);
    expect((await computeReadiness({ ...base, reader: { ...good, projectActive: async () => false } })).publishingAvailable).toBe(false);
  });

  it("treats any RPC failure as not ready", async () => {
    const r = await computeReadiness({ ...base, reader: { ...good, verifier: async () => { throw new Error("rpc down"); } } });
    expect(r.publishingAvailable).toBe(false);
  });

  it("without a projectId, reports contract-level readiness only", async () => {
    const r = await computeReadiness({ ...base, projectId: undefined, reader: { ...good, projectActive: async () => false } });
    expect(r.publishingAvailable).toBe(true);
    expect(r.checks.projectActive).toBeNull();
  });
});

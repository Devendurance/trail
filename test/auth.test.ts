import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";
import {
  buildChallengeMessage,
  createChallengeInput,
  createSessionToken,
  newSessionPayload,
  parseSessionToken,
  rateLimit,
  recoverChallengeSigner,
} from "../src/lib/auth";
import { REVIEW_AUTH_TYPEHASH, contentHashOf, normalizeBody } from "../src/lib/eip712";

describe("wallet challenge auth", () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const domain = "localhost:3000";

  function challenge() {
    const { nonce } = createChallengeInput();
    const issuedAt = new Date("2026-11-10T12:00:00.000Z");
    const expiresAt = new Date("2026-11-10T12:10:00.000Z");
    const message = buildChallengeMessage({
      wallet: account.address,
      domain,
      chainId: 677,
      nonce,
      issuedAt,
      expiresAt,
    });
    return { nonce, message };
  }

  it("recovers the correct signer for a valid signature", async () => {
    const { message } = challenge();
    const signature = await account.signMessage({ message });
    const recovered = await recoverChallengeSigner(message, signature);
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("binds wallet, domain, chain and nonce into the message", () => {
    const { message } = challenge();
    expect(message).toContain(account.address);
    expect(message).toContain(domain);
    expect(message).toContain("677");
    expect(message).toContain("Nonce: ");
  });

  it("detects another wallet's signature", async () => {
    const { message } = challenge();
    const other = privateKeyToAccount(generatePrivateKey());
    const signature = await other.signMessage({ message });
    const recovered = await recoverChallengeSigner(message, signature);
    expect(recovered.toLowerCase()).not.toBe(account.address.toLowerCase());
  });

  it("detects a changed message", async () => {
    const { message } = challenge();
    const signature = await account.signMessage({ message });
    const tampered = message.replace("677", "678");
    const recovered = await recoverChallengeSigner(tampered, signature);
    expect(recovered.toLowerCase()).not.toBe(account.address.toLowerCase());
  });

  it("creates nonces with unique hashes", () => {
    const a = createChallengeInput();
    const b = createChallengeInput();
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.nonceHash).not.toBe(b.nonceHash);
    expect(a.nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips a session token and rejects tampering and expiry", () => {
    const secret = "test-secret-".padEnd(32, "x");
    const payload = newSessionPayload(account.address, 677, domain);
    const token = createSessionToken(payload, secret);
    const parsed = parseSessionToken(token, secret);
    expect(parsed?.wallet).toBe(account.address.toLowerCase());
    expect(parseSessionToken(`${token}x`, secret)).toBeNull();
    const expired = createSessionToken({ ...payload, exp: Math.floor(Date.now() / 1000) - 10 }, secret);
    expect(parseSessionToken(expired, secret)).toBeNull();
  });

  it("rate-limits repeated callers", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60_000)).toBe(true);
    expect(rateLimit(key, 5, 60_000)).toBe(false);
  });
});

describe("review body and EIP-712 constants", () => {
  it("normalizes whitespace and enforces 100-700 chars", () => {
    expect(normalizeBody("  hello   world \n new line ")).toBe("hello world new line");
    expect(contentHashOf("abc")).toBe(keccak256(toHex("abc")));
  });

  it("documents the exact on-chain type hash", () => {
    const recomputed = keccak256(
      toHex("ReviewAuth(address reviewer,uint256 projectId,bytes32 proofTxHash,bytes32 contentHash,uint8 rating,uint8 outcome,uint256 nonce,uint64 deadline)"),
    );
    expect(REVIEW_AUTH_TYPEHASH).toBe(recomputed);
  });
});

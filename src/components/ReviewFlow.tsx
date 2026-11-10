"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicClient, useWalletClient } from "wagmi";
import { useAuth } from "./Providers";
import { Banner, ExtLink } from "./ui";
import { explorerTx, shortHash } from "@/lib/client/chain677";
import { publishReviewOnChain } from "@/lib/client/publish";
import {
  MAX_BODY,
  MIN_BODY,
  checkBody,
  checkProof,
  draftKey,
  fetchPublishingAvailable,
  isTxHash,
  prepareReview,
  reconcileWithRetry,
  reusablePrepared,
  type ProofOk,
} from "@/lib/client/review-flow";
import { stateFor } from "@/lib/client/states";
import type { PreparedReview } from "@/lib/client/types";

type Phase = "edit" | "preparing" | "wallet" | "confirming" | "reconciling" | "done";
interface Err { code: string; title?: string; message: string; retryable?: boolean }

const STEPS = ["Connect", "Prove", "Write", "Publish"];

export default function ReviewFlow({ project, actionDescription }: { project: { id: number; slug: string; name: string }; actionDescription: string | null }) {
  const router = useRouter();
  const { status, account, connect, switchNetwork, signIn, busy: authBusy, notice } = useAuth();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [available, setAvailable] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState("");
  const [checking, setChecking] = useState(false);
  const [proofState, setProofState] = useState<{ account: string | undefined; proof: ProofOk } | null>(null);
  // A different wallet invalidates any earlier verification.
  const proof = proofState && proofState.account === account ? proofState.proof : null;
  const setProof = useCallback((p: ProofOk | null) => setProofState(p ? { account, proof: p } : null), [account]);
  const [proofErr, setProofErr] = useState<Err | null>(null);
  const [rating, setRating] = useState(0);
  const [outcome, setOutcome] = useState<0 | 1 | null>(null);
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>("edit");
  const [err, setErr] = useState<Err | null>(null);
  const [publishedTx, setPublishedTx] = useState<string | null>(null);
  const cache = useRef<{ prepared: PreparedReview; key: string } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const authed = status === "authenticated";

  useEffect(() => {
    void fetchPublishingAvailable().then(setAvailable);
  }, []);

  // Restore the draft so a failure never costs the reviewer their words.
  useEffect(() => {
    // Syncing from external storage on mount is the intended use of an effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(draftKey(project.slug, account));
      if (raw) {
        const d = JSON.parse(raw) as { txHash?: string; rating?: number; outcome?: 0 | 1 | null; body?: string };
        if (d.txHash) setTxHash(d.txHash);
        if (d.rating) setRating(d.rating);
        if (d.outcome === 0 || d.outcome === 1) setOutcome(d.outcome);
        if (d.body) setBody(d.body);
      }
    } catch { /* storage unavailable */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [project.slug, account]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(project.slug, account), JSON.stringify({ txHash, rating, outcome, body }));
    } catch { /* ignore */ }
  }, [project.slug, account, txHash, rating, outcome, body]);

  // Lock the text while a signed authorization is active; unlock on expiry.
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setTimeout(() => { setLocked(false); setLockedUntil(null); }, Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [lockedUntil]);

  const bodyCheck = checkBody(body);
  const busyPhase = phase !== "edit" && phase !== "done";

  const onCheck = useCallback(async () => {
    setProofErr(null);
    setProof(null);
    if (!isTxHash(txHash)) {
      setProofErr({ code: "INVALID", title: "Check the hash", message: "A transaction hash starts with 0x and has 64 characters after it." });
      return;
    }
    setChecking(true);
    const r = await checkProof(project.id, txHash);
    setChecking(false);
    if (r.kind === "ok") setProof(r.data);
    else {
      const s = stateFor(r.code);
      setProofErr({ code: r.code, title: s.title, message: r.code === "VERIFIER_UNAVAILABLE" || r.code === "NETWORK" ? s.message : r.message || s.message, retryable: s.retryable });
    }
  }, [project.id, txHash, setProof]);

  const onPublish = useCallback(async () => {
    setTouched(true);
    setErr(null);
    if (!proof || rating < 1 || outcome === null || !bodyCheck.ok || !account) return;
    if (available === false) {
      setErr({ code: "NOT_CONFIGURED", message: "Mainnet review publishing not yet available." });
      return;
    }
    const key = `${proof.proof.txHash}|${rating}|${outcome}|${body}`;
    let prepared = reusablePrepared(cache.current, `${account}|${key}`);
    if (!prepared) {
      setPhase("preparing");
      const p = await prepareReview({ projectId: project.id, transactionHash: proof.proof.txHash, rating, outcome, body });
      if (p.kind === "no") {
        setPhase("edit");
        const s = stateFor(p.code);
        setErr({ code: p.code, title: s.title, message: p.code === "NOT_CONFIGURED" ? "Mainnet review publishing not yet available." : s.message, retryable: s.retryable });
        return;
      }
      prepared = p.prepared;
      cache.current = { prepared, key: `${account}|${key}` };
      setLocked(true);
      setLockedUntil(new Date(prepared.expiresAt).getTime());
    }

    if (!publicClient || !walletClient) {
      setPhase("edit");
      setErr({ code: "NO_WALLET_CLIENT", message: "Your wallet is not ready. Reconnect and try again." });
      return;
    }
    setPhase("wallet");
    const walletChainId = await walletClient.getChainId().catch(() => undefined);
    const res = await publishReviewOnChain({
      publicClient: publicClient as never,
      walletClient: walletClient as never,
      prepared,
      account,
      walletChainId,
      confirmations: 1,
    });
    if (!res.ok) {
      setPhase("edit");
      if (res.code === "DEADLINE_PASSED") { cache.current = null; setLocked(false); setLockedUntil(null); }
      setErr({ code: res.code, title: res.stage === "revert" ? "Publication reverted" : "Not published", message: res.message, retryable: true });
      if (res.txHash) setPublishedTx(res.txHash);
      return;
    }
    setPublishedTx(res.txHash);
    setPhase("reconciling");
    const rec = await reconcileWithRetry(res.txHash);
    if (rec.kind === "no") {
      setPhase("edit");
      setErr({ code: rec.code, title: "Confirmed on-chain, not recorded yet", message: `Your transaction succeeded but Trail has not recorded it yet. ${rec.message} You can retry recording without paying again.`, retryable: true });
      return;
    }
    setPhase("done");
    try { localStorage.removeItem(draftKey(project.slug, account)); } catch { /* ignore */ }
    router.push(`/reviews/${rec.reviewId}`);
  }, [proof, rating, outcome, bodyCheck.ok, account, available, body, project.id, project.slug, publicClient, walletClient, router]);

  const retryRecord = useCallback(async () => {
    if (!publishedTx) return;
    setErr(null);
    setPhase("reconciling");
    const rec = await reconcileWithRetry(publishedTx);
    if (rec.kind === "ok") { setPhase("done"); router.push(`/reviews/${rec.reviewId}`); return; }
    setPhase("edit");
    setErr({ code: rec.code, title: "Still not recorded", message: rec.message, retryable: true });
  }, [publishedTx, router]);

  const activeStep = !authed ? 0 : !proof ? 1 : phase === "edit" ? 2 : 3;
  const ratingErr = touched && rating < 1;
  const outcomeErr = touched && outcome === null;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === activeStep ? "step" : undefined} className={`badge ${i < activeStep ? "badge-ok" : ""} ${i === activeStep ? "!border-white !text-white" : ""}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {available === false && (
        <Banner tone="info" title="Mainnet review publishing not yet available.">
          You can sign in and verify your action now, and try the form. Publishing opens once the Trail registry is live on BOT Chain.
        </Banner>
      )}

      {/* Step 1: wallet */}
      <section className="card" aria-labelledby="s1">
        <h2 id="s1" className="text-[20px] font-semibold">1. Connect the wallet that used {project.name}</h2>
        {authed ? (
          <p className="mt-2 text-sm text-[var(--success)]">Signed in as {account}. Sign-in is a free signature and publishes nothing.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="muted text-sm">
              {status === "no_wallet" && "No browser wallet found. Install an EVM wallet such as MetaMask or Rabby, then reload."}
              {status === "disconnected" && "Connect the wallet you used for the action. We never ask for your seed phrase."}
              {status === "wrong_network" && "Your wallet is on another network. Trail works on BOT Chain (677)."}
              {status === "needs_signin" && "Sign a short message to prove you control this wallet. It is free and publishes nothing."}
              {status === "session_mismatch" && "You are signed in as a different wallet than the one connected. Sign in again as the connected wallet."}
            </p>
            {status === "disconnected" && <button className="btn btn-primary" onClick={connect} disabled={authBusy}>Connect wallet</button>}
            {status === "no_wallet" && <button className="btn btn-primary" onClick={connect}>Connect wallet</button>}
            {status === "wrong_network" && <button className="btn btn-primary" onClick={switchNetwork} disabled={authBusy}>Switch to BOT Chain</button>}
            {(status === "needs_signin" || status === "session_mismatch") && <button className="btn btn-primary" onClick={signIn} disabled={authBusy}>{authBusy ? "Waiting for wallet…" : "Sign in with wallet"}</button>}
            {notice && <p role="status" className="text-sm text-[var(--warn)]">{notice}</p>}
          </div>
        )}
      </section>

      {/* Step 2: proof */}
      <section className="card" aria-labelledby="s2">
        <h2 id="s2" className="text-[20px] font-semibold">2. Prove you used it</h2>
        <p className="muted mt-2 text-sm">
          {actionDescription ?? `Paste the transaction hash of your supported ${project.name} action.`} Only a successful action counts in version 1.
        </p>
        <label htmlFor="tx" className="label mt-4">Transaction hash</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="tx"
            className="input font-mono"
            placeholder="0x…"
            value={txHash}
            onChange={(e) => { setTxHash(e.target.value); setProof(null); setProofErr(null); }}
            disabled={!authed || busyPhase || locked}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="tx-help"
            aria-invalid={Boolean(proofErr)}
          />
          <button className="btn btn-primary" onClick={onCheck} disabled={!authed || checking || busyPhase || locked || !txHash.trim()}>
            {checking ? "Checking the chain…" : "Verify"}
          </button>
        </div>
        <p id="tx-help" className="helper">The hash is not trusted until Trail confirms it on BOT Chain.</p>
        {checking && <div className="skeleton mt-4 h-16" role="status" aria-label="Verifying" />}
        {proofErr && (
          <div className="mt-4">
            <Banner tone={stateFor(proofErr.code).tone === "warn" ? "warn" : "error"} title={proofErr.title ?? "Not verified"}>
              {proofErr.message}
              {proofErr.code !== "INVALID" && txHash && isTxHash(txHash) && (
                <> <ExtLink href={explorerTx(txHash.trim())}>View on explorer</ExtLink></>
              )}
            </Banner>
          </div>
        )}
        {proof && (
          <div className="mt-4">
            <Banner tone="ok" title="Verified: this wallet completed the supported action">
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[var(--n400)]">Action</dt><dd>{proof.project.name}, version {proof.action.version}</dd></div>
                <div><dt className="text-xs text-[var(--n400)]">Result</dt><dd>{proof.proof.domainName ? `Name “${proof.proof.domainName}” (token ${proof.proof.tokenId})` : `Token ${proof.proof.tokenId}`}</dd></div>
                <div><dt className="text-xs text-[var(--n400)]">Block</dt><dd>{proof.proof.blockNumber} ({proof.proof.confirmations} confirmations)</dd></div>
                <div><dt className="text-xs text-[var(--n400)]">Transaction</dt><dd><ExtLink href={proof.explorerUrl}>{shortHash(proof.proof.txHash, 8)}</ExtLink></dd></div>
              </dl>
            </Banner>
          </div>
        )}
      </section>

      {/* Step 3: write */}
      <section className="card" aria-labelledby="s3">
        <h2 id="s3" className="text-[20px] font-semibold">3. Write your review</h2>
        <p className="muted mt-2 text-sm">
          Honest negative feedback is welcome. Version 1 proof needs a successful supported action, so tell us how it went for you after that.
        </p>

        <fieldset className="mt-5" aria-describedby={ratingErr ? "rating-err" : undefined} disabled={busyPhase || locked}>
          <legend className="label">Your experience with {project.name}</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} out of 5`}
                onClick={() => setRating(n)}
                className={`grid h-12 w-12 place-items-center rounded-2xl border text-base font-semibold transition-colors ${rating === n ? "border-white bg-white text-[#0a0a0a]" : "border-[var(--hairline-strong)] bg-[var(--n850)] text-white hover:bg-[var(--n800)]"}`}
              >
                {n}
              </button>
            ))}
          </div>
          {ratingErr && <p id="rating-err" className="helper !text-[var(--error)]">Choose a rating from 1 to 5.</p>}
        </fieldset>

        <fieldset className="mt-5" disabled={busyPhase || locked}>
          <legend className="label">How did it go?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([[0, "It worked well"], [1, "It worked with friction"]] as const).map(([v, label]) => (
              <label key={v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${outcome === v ? "border-white bg-[var(--n800)]" : "border-[var(--hairline-strong)] bg-[var(--n850)]"}`}>
                <input type="radio" name="outcome" className="h-4 w-4 accent-white" checked={outcome === v} onChange={() => setOutcome(v)} />
                {label}
              </label>
            ))}
          </div>
          {outcomeErr && <p className="helper !text-[var(--error)]">Pick how it went.</p>}
        </fieldset>

        <label htmlFor="body" className="label mt-5">Your review</label>
        <textarea
          id="body"
          className="input min-h-[160px] resize-y"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => setTouched(true)}
          readOnly={busyPhase || locked}
          aria-describedby="body-help"
          aria-invalid={touched && !bodyCheck.ok}
          placeholder="What did you do, what happened, and what would help the next person?"
        />
        <p id="body-help" className={`helper ${touched && !bodyCheck.ok ? "!text-[var(--error)]" : ""}`}>
          <span aria-live="polite">{bodyCheck.length} / {MAX_BODY} characters (minimum {MIN_BODY}).</span>{" "}
          {touched && !bodyCheck.ok ? bodyCheck.message : "Write in your own words. Plain text only."}
        </p>
        {locked && <p className="helper">Text is locked while your signed authorization is active so it cannot change after signing. It unlocks if it expires.</p>}
      </section>

      {/* Step 4: publish */}
      <section className="card" aria-labelledby="s4">
        <h2 id="s4" className="text-[20px] font-semibold">4. Sign and publish on-chain</h2>
        <p className="muted mt-2 text-sm">
          Publishing is a BOT Chain transaction from your wallet. Your wallet will ask you to approve it and you pay the network fee.
        </p>
        {err && (
          <div className="mt-4">
            <Banner tone={err.code === "NOT_CONFIGURED" ? "info" : stateFor(err.code).tone === "warn" ? "warn" : "error"} title={err.title ?? stateFor(err.code).title}>
              {err.message}
              {publishedTx && <> <ExtLink href={explorerTx(publishedTx)}>View transaction</ExtLink></>}
              {publishedTx && err.title === "Confirmed on-chain, not recorded yet" && (
                <div className="mt-3"><button className="btn btn-ghost" onClick={retryRecord}>Retry recording</button></div>
              )}
            </Banner>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            onClick={onPublish}
            disabled={!authed || !proof || busyPhase || available === null}
          >
            {phase === "preparing" && "Preparing…"}
            {phase === "wallet" && "Confirm in your wallet…"}
            {phase === "reconciling" && "Recording your review…"}
            {(phase === "edit" || phase === "done") && "Publish review"}
          </button>
          <span className="text-sm text-[var(--n400)]" role="status" aria-live="polite">
            {phase === "wallet" && "Approve the transaction in your wallet, then wait for confirmation."}
            {phase === "reconciling" && "Confirmed. Waiting for Trail to verify it on-chain."}
            {phase === "edit" && !proof && authed && "Verify your transaction first."}
          </span>
        </div>
      </section>
    </div>
  );
}

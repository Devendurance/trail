/// Exhaustive mapping from backend result codes to user-facing states.
export type Tone = "ok" | "warn" | "error" | "info";
export interface UiState {
  tone: Tone;
  title: string;
  message: string;
  retryable: boolean;
}

export const PROOF_STATES: Record<string, UiState> = {
  OK: { tone: "ok", title: "Action verified", message: "This wallet completed a supported BOT Chain action.", retryable: false },
  WRONG_CHAIN: { tone: "error", title: "Wrong network", message: "That transaction is not on BOT Chain (677).", retryable: false },
  WRONG_WALLET: { tone: "error", title: "Different wallet", message: "That transaction was sent by another wallet. Use the wallet that did the action.", retryable: false },
  TX_NOT_FOUND: { tone: "error", title: "Transaction not found", message: "We could not find that hash on BOT Chain. Check it and try again.", retryable: true },
  TX_FAILED: { tone: "error", title: "Transaction failed", message: "That transaction failed on-chain. Version 1 needs a successful supported action.", retryable: false },
  INSUFFICIENT_CONFIRMATIONS: { tone: "warn", title: "Still confirming", message: "That transaction needs a few more confirmations. Try again in a minute.", retryable: true },
  UNSUPPORTED_ACTION: { tone: "error", title: "Not a supported action", message: "That transaction is not the supported action for this app.", retryable: false },
  PROOF_MISMATCH: { tone: "error", title: "Does not match", message: "That transaction does not match the supported action's expected result.", retryable: false },
  PROOF_ALREADY_USED: { tone: "error", title: "Already used", message: "This transaction already backs a review.", retryable: false },
  REVIEW_ALREADY_EXISTS: { tone: "error", title: "You already reviewed this app", message: "Each wallet can publish one review per app.", retryable: false },
  VERIFIER_UNAVAILABLE: { tone: "warn", title: "Verification unavailable", message: "The chain or database could not be reached. Nothing was decided. Try again shortly.", retryable: true },
  RATE_LIMITED: { tone: "warn", title: "Slow down", message: "Too many requests. Wait a moment and retry.", retryable: true },
  INVALID_BODY: { tone: "error", title: "Review length", message: "Reviews must be 100 to 700 characters.", retryable: false },
  PROJECT_INACTIVE: { tone: "warn", title: "Not open yet", message: "This app is not activated for publishing yet.", retryable: true },
  NOT_CONFIGURED: { tone: "info", title: "Publishing not available", message: "Mainnet review publishing not yet available.", retryable: false },
  UNAUTHENTICATED: { tone: "warn", title: "Sign in required", message: "Your session ended. Sign in with your wallet again.", retryable: true },
  NETWORK: { tone: "warn", title: "Connection problem", message: "The request timed out or could not reach Trail. Try again.", retryable: true },
};

export const FALLBACK_STATE: UiState = {
  tone: "error",
  title: "Something went wrong",
  message: "Unexpected response. Try again.",
  retryable: true,
};

export function stateFor(code: string | undefined): UiState {
  return (code && PROOF_STATES[code]) || FALLBACK_STATE;
}

export const RECONCILE_RETRY_CODES = new Set([
  "INSUFFICIENT_CONFIRMATIONS",
  "TX_NOT_FOUND",
  "VERIFIER_UNAVAILABLE",
  "DB_ERROR",
  "NETWORK",
]);

export const REWARD_STATE_LABELS: Record<string, string> = {
  pending_review: "Quality review pending",
  approved_unfunded: "Approved, awaiting funding",
  rejected: "Not selected for rewards",
  claimable: "Claimable",
  claimed: "Claimed",
};

export const OUTCOME_LABELS: Record<number, string> = { 0: "Worked well", 1: "Worked with friction" };

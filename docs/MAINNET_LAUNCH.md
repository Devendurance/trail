# Mainnet launch and rollback

Production database: existing Neon. Production hosting: existing Vercel project. No staging branches.
Nothing here has been broadcast yet. Spending BOT happens only at step 3.

## Roles (two different keys)

- Deployer (owner): the wallet that runs the deploy. It becomes the contract owner (`Ownable` uses `msg.sender`).
  It rotates the verifier, activates projects and pauses. Keep it in an encrypted Foundry keystore, never in Vercel.
- Verifier (backend signer): a separate fresh key held only as `VERIFIER_PRIVATE_KEY` in Vercel.
  It never needs BOT. Its address is passed to the constructor as `VERIFIER`. The deployer must not equal the verifier.

## Verified before funding

- `Deploy.s.sol` deploys the registry, then calls `setProjectActive(PROJECT_ID, true)` (default 1) in the same broadcast.
- It refuses any chain other than 677 unless `ALLOW_ANY_CHAIN=true` (checked).
- Local Anvil broadcast succeeded. Dry-run against `https://rpc.botchain.ai` (no broadcast) succeeded.
  Estimated 1.96M gas at 20 gwei, about 0.04 BOT. Fund the deployer with at least 0.1 BOT.
- `/api/config?projectId=1` now says `publishingAvailable: true` only when the contract has code, its on-chain
  `verifier()` equals the backend signer address, it is not paused, and the project is active.
- Contract source verification on scan.botchain.ai (Blockscout) has not been exercised yet. If it fails, the
  contract still works. Retry or verify by hand.

## Before funding (no BOT spent)

```bash
# 1. Deployer keystore (prompts for the key and a password, nothing stored in shell history)
cast wallet import trail-deployer --interactive
cast wallet address --account trail-deployer        # note as DEPLOYER

# 2. Fresh verifier key. Copy the private key straight into Vercel, do not save it anywhere else.
cast wallet new                                      # note address as VERIFIER, key goes to Vercel only
```

Vercel project settings, Environment Variables, Production. Confirm each exists and holds the right value:

| Variable | Value | When |
| --- | --- | --- |
| `DATABASE_URL` | existing Neon production URL | already set, verify |
| `SESSION_SECRET` | 32+ random chars | already set, verify |
| `APP_DOMAIN` | production host, no scheme | already set, verify |
| `ADMIN_ADDRESSES` | comma list of moderator wallets | already set, verify |
| `VERIFIER_PRIVATE_KEY` | verifier key, mark Sensitive | before launch |
| `REGISTRY_ADDRESS_MAINNET` | deployed address | LAST, step 5 |
| `REWARDS_*` flags | leave unset (rewards stay disabled) | never in this launch |

## Launch, once the deployer is funded

```bash
# 3. Preflight (read-only). Needs the verifier key in this shell for the address check only.
export DEPLOYER_ADDRESS=0x...            # from step 1
export VERIFIER_PRIVATE_KEY=0x...        # same key as Vercel
node scripts/mainnet-preflight.mjs       # every line must PASS

# 4. Deploy and activate project 1 (spends BOT here)
cd contracts
export VERIFIER=0x...                    # verifier ADDRESS from step 2
forge script script/Deploy.s.sol --rpc-url https://rpc.botchain.ai \
  --account trail-deployer --sender $DEPLOYER_ADDRESS --broadcast --slow
# note the printed "Contract Address" as REGISTRY

# 4b. Verify source (optional but recommended)
forge verify-contract $REGISTRY src/TrailReviewRegistry.sol:TrailReviewRegistry \
  --chain-id 677 --verifier blockscout --verifier-url https://scan.botchain.ai/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" $VERIFIER) --watch
cd ..

# 5. Post-deploy on-chain check
export REGISTRY_ADDRESS_MAINNET=$REGISTRY
node scripts/mainnet-preflight.mjs --post   # verifier, not paused, project 1 active
```

6. In Vercel set `REGISTRY_ADDRESS_MAINNET` (Production), then redeploy production (env changes need a new deployment).
7. Confirm readiness:

```bash
curl -s "https://<production-host>/api/config?projectId=1"
# expect "publishingAvailable": true and every check true
```

8. First real review, by hand: connect the wallet that did a real BOT Names mint, verify the tx, write and publish.
   Check the receipt on scan.botchain.ai, then that `/reviews/<id>` and `/apps/bot-names` show it.
   Use one real review only. Never insert synthetic reviews into Neon.

## Rollback

Fast stop (seconds), from the deployer:

```bash
cast send $REGISTRY "pause()" --rpc-url https://rpc.botchain.ai --account trail-deployer
```

Pause rejects every `publishReview`, including authorizations already signed (they expire in 10 minutes anyway).
`/api/config` reports `publishingAvailable: false` within 20 seconds and the UI shows publishing unavailable.
Resume with `unpause()`.

UI stop: remove `REGISTRY_ADDRESS_MAINNET` in Vercel and redeploy. Do this after pausing, because removing it alone
does not cancel signatures that are already out.

Verifier key leaked or suspect: `pause()`, generate a new verifier key, then
`cast send $REGISTRY "setVerifier(address)" $NEW_VERIFIER ...`, update `VERIFIER_PRIVATE_KEY` in Vercel,
redeploy, `unpause()`. Outstanding authorizations die with the old key.

Bad deploy (wrong verifier or wrong chain): the registry has no upgrade path. Pause it, deploy a new one, point
`REGISTRY_ADDRESS_MAINNET` at it. Reviews already on the old registry stay readable on-chain but Trail only
reconciles from the configured address.

Published reviews are append-only and cannot be edited or deleted by anyone, including the owner.

---
title: Devnet deployment
description: How Cloak is deployed on Solana devnet, what it shares with mainnet, and how to connect.
---

# Devnet

Cloak runs a parallel devnet stack for pre-release testing and integration development. It shares no state with mainnet: separate Solana program, separate on-chain pools, separate relay, separate RDS, separate admin key. The published `@cloak.dev/sdk` NPM package targets mainnet only — devnet has its own local-only SDK fork.

## Endpoints

| Surface | Mainnet | Devnet |
|---|---|---|
| Relay HTTPS | `https://api.cloak.ag` | `https://api.devnet.cloak.ag` |
| Solana RPC | Helius mainnet | Helius devnet (+ public `api.devnet.solana.com` as commitment-sync fallback) |
| Program ID | `zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW` | `Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h` |
| Admin authority | `5nNamRwUKNUCK272DkjaMWtghCBLwFSaGiLU5oCdwYJr` | `HViJ13JMFWoXCzxrUj3p1ZmTRmoAJBBcUfJhaCwJXN3E` |
| SDK package | `@cloak.dev/sdk` (NPM) | `@cloak.dev/sdk-devnet` (**local only**, `file:../sdk-devnet` in the monorepo) |
| Asset pools | SOL, USDC, USDT (Circle mints) | SOL, mock-USDC `61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf` |
| Range (compliance) | Real Range API + Switchboard queue | Mock mode: all risk scores = 0, cryptographically valid quotes signed by devnet admin |
| Reconciler timings | 300s / 24h / 7d | 60s / 1h / 1d (faster for dev iteration) |

## Architecture differences

### Program

Devnet runs a separate Rust crate `programs/shield-pool-devnet/` — a sibling of `shield-pool/`, never built or deployed together. The only intentional source-level differences are:

- `shield-pool-devnet/src/lib.rs`: `pub const ID` → devnet program pubkey.
- `shield-pool-devnet/src/constants.rs`: `ADMIN_AUTHORITY` → devnet admin pubkey.

Everything else — Range verification, Ed25519 sig-verify path, state layout, Groth16 circuit, error codes — is byte-identical to `shield-pool/`. The split exists so that mainnet is operationally untouched during devnet work and devnet never accidentally accepts a mainnet admin sig or vice versa.

### Range / compliance on devnet

The devnet relay runs with `RANGE_ENABLED=true` + `RANGE_MOCK_ENABLED=true`. In this mode:

- The relay produces **cryptographically valid** Ed25519 Range-quote signatures signed by the devnet admin keypair (which doubles as the relay's `signer_keypair` via `relay/config.rs:320` using `ADMIN_KEYPAIR`).
- The on-chain program stores the admin's pubkey as each pool's `range_signer` at init time (`shield-pool-devnet/src/instructions/initialize.rs:73`).
- Every `/transact`-routed tx's Range-quote signature verifies against that stored pubkey → program accepts → tx lands.
- No one outside our devnet holds the admin's private key, so no one else can forge quotes.
- Risk score is always `0` — every address passes the sanctions check.

A safety guard at `relay/src/main.rs:77` panics the relay immediately at startup if `RANGE_MOCK_ENABLED=true` while `SOLANA_RPC_URL` points at a mainnet endpoint. This makes it structurally impossible for mock mode to leak onto prod.

### Mock USDC

Devnet USDC (Circle) is `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` on mainnet-fork dev clusters but has thin liquidity / wallet support on actual Solana devnet. Cloak's devnet pool uses its own mint — `61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf`, 6 decimals, mint authority = devnet admin — so we control distribution. Request mock USDC by asking the admin to transfer from their ATA (`2rzBDMbUD1YgZy8cmywy21RsLruKroW5JcepYkJ278bC`).

### Database

The devnet relay writes to `cloak_devnet` on RDS instance `cloak-devnet` (separate from prod's `cloak-sg` instance). Private-only, security-group-restricted to the EC2. Stored credentials: AWS Secrets Manager `cloak/relay/devnet`.

## Connecting to devnet

### From the SDK

Inside the monorepo, `devnet-soak/package.json` and any downstream devnet consumer pin:

```json
{
  "dependencies": {
    "@cloak.dev/sdk-devnet": "file:../sdk-devnet"
  }
}
```

Then imports look normal:

```ts
import {
  CLOAK_PROGRAM_ID,
  DEVNET_MOCK_USDC_MINT,
  transact,
  fullWithdraw,
} from "@cloak.dev/sdk-devnet";
```

`CLOAK_PROGRAM_ID` resolves to the devnet program (`Zc1k...`). `DEVNET_MOCK_USDC_MINT` is the devnet-only mock-USDC mint address.

The sdk-devnet package is `"private": true` in `sdk-devnet/package.json` — this blocks accidental `npm publish`. It will never be on NPM; devnet is a monorepo-local concern.

### From a script (direct RPC)

Until DNS propagation for `api.devnet.cloak.ag` finishes, connect via the EC2 origin directly:

```
relayUrl: "http://54.196.88.186:8080"
rpcUrl:   "https://devnet.helius-rpc.com/?api-key=<your_helius_devnet_key>"
programId: "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h"
```

Once `api.devnet.cloak.ag` is wired, use the HTTPS CloudFront endpoint and drop the Host-header workaround.

## Getting devnet SOL

Official Solana devnet faucet: `https://faucet.solana.com/`. Shared rate limit (~2 SOL/request, ~5 SOL/8h/IP). Helius devnet also supports `requestAirdrop` via their `/?api-key=` endpoint, with separate per-account quotas.

For a 5-SOL deploy budget (program deploy + pool inits + buffer), expect 2-3 rounds of airdrop retries.

## End-to-end soak

`cloak/devnet-soak/devnet-soak.ts` exercises deposit + transfer + withdraw through the full devnet pipeline (SDK → relay → program → DB). Run it after any devnet deploy change:

```bash
cd cloak/devnet-soak
npm install
npx tsx devnet-soak.ts
```

Asserts balance integrity: sender's mock-USDC ATA drops to 0 post-deposit, external recipient receives `DEPOSIT - 0.3% fee` post-withdrawal.

## Reproducible redeploy

### Program

```bash
cd cloak/programs
just devnet-build    # cargo build-sbf -p shield-pool-devnet
just devnet-deploy   # solana program deploy --upgrade
just devnet-init     # pool inits + ALT
```

### Relay

```bash
cd cloak/services
just devnet          # build :devnet image, push to GHCR, SCP + recreate containers on EC2
```

## Known limitations

- Solana devnet has shorter history retention than mainnet archive RPCs. The reconciler's retention guard (7-day default on mainnet, 1-day on devnet) and Phase B "ancient-row not-found" short-circuit will fire more frequently here. This is operationally fine — the guard exists precisely for this class of RPC behavior.
- Jupiter routes on devnet are thin to nonexistent. Swap functionality isn't exercised in the default soak; mock-USDC doesn't have Jupiter liquidity. Test swap paths on mainnet-fork (surfpool + `https://api.mainnet-beta.solana.com` unshielded fallback) instead.
- The mock USDC mint's authority is held by the devnet admin keypair. Anyone with that keypair can mint infinite supply. Don't use the devnet token for anything requiring trust.

## Files

- `programs/shield-pool-devnet/` — Rust crate.
- `programs/scripts/init_devnet.ts` — pool init runner.
- `services/deployment/compose.devnet.yml` — compose stack.
- `services/.env.devnet` — relay env (gitignored, secrets).
- `sdk-devnet/` — local SDK fork.
- `devnet-soak/` — e2e soak runner.
- AWS Secrets Manager `cloak/relay/devnet` — devnet DB URL + admin keypair.
- RDS `cloak-devnet` — PostgreSQL 17 on same VPC as prod, private-only.
- CloudFront distribution `E358Y9X6QA0E14` — `api.devnet.cloak.ag` ACM + EC2:8080 origin.

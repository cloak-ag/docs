# Documentation

This folder contains the Mintlify docs site for Cloak: the user guide and explainers, the SDK, the platform and on-chain program docs, circuits, and the AI tooling setup pages.

## Local development

1. Install Mintlify CLI:

```bash
npm i -g mint
```

2. Start docs preview from this folder:

```bash
mint dev
```

3. Open the preview URL printed by `mint dev`.

## Checks before you open a PR

This repo has no CI: no workflows, no build step, no test gate. These are the checks, and they run locally:

```bash
mint dev             # local preview at the URL it prints
mint validate        # strict build validation; exits on warnings or errors
mint broken-links    # link check across the site
```

Two things `mint` does not check, so check them by hand when you add a page:

- Every page must be listed in `docs.json` under the right tab and group, or it renders nowhere.
- `llms.txt`, `llms-full.txt` and `.well-known/llms.txt` are written by hand, not generated. A new page that belongs in the AI index has to be added to them too.

## Deploys

Mintlify deploys this site; nothing in this repo builds or publishes it, and there is no CI here.
The Mintlify project `cloak/cloak` is connected to `cloak-ag/docs` and **deploys `main`** — that is
the deployment branch shown in the Mintlify dashboard, not an inference.

`main` is the only branch that matters:

| Branch | What it is |
| --- | --- |
| a topic branch (`docs/...`, `feat/...`) | where you write |
| `main` | production. A merge here publishes `docs.cloak.ag`. |

How a writer checks a change before it reaches production:

1. Branch off `main`, write, and run the three commands above locally.
2. Open the PR against `main`. Mintlify builds a preview deployment for the pull request and links
   it from the PR — that preview, not the local `mint dev`, is what a reviewer should read.
3. Merge to `main`. That publishes production.

The repo also has a long-abandoned `staging` branch, diverged from `main` in both directions. It is
not a gate and nothing deploys from it; ignore it.

<!-- Branch protection is not available on this GitHub plan, so nothing mechanically stops a push
     straight to `main`. Treat any merge to `main` as a production deploy. -->

## Structure

- `guide/` user-facing guide (what-is-cloak, how-it-works, private balance, bridge, private send, fees, payment links, security, bridge routes, compliance, verified addresses, FAQ, glossary, wallets and tokens)
- `learn/` plain-language explainers (privacy, zero-knowledge, proof of funds)
- `sdk/` SDK guides and API references
- `platform/` architecture components and transaction flows
- `protocol/` on-chain architecture and Shield Pool docs
- `architecture/` viewing-key and compliance model docs
- `packages/` circuit pipeline docs
- `development/` devnet integration guide
- `operations/` runtime trust boundaries and security controls for integrators
- `ai-tools/` IDE/assistant setup pages
- `llms.txt` top-level AI index and route map
- `llms-full.txt` single-file AI context pack
- `.well-known/llms.txt` compatibility alias for AI tooling

## Source of truth

When updating docs, prioritize these sources:

- SDK exports: `sdk/src/index.ts`
- SDK runtime behavior: `sdk/src/flows/*` (`transact`, `transfer`, `partialWithdraw`/`fullWithdraw`, `swapUtxo`/`swapWithChange` all live in `flows/transact.ts`), `sdk/src/proving/*`, `sdk/src/notes/*`, `sdk/src/scanning/*`, `sdk/src/program/*` (PDAs, instructions, error map), `sdk/src/wallet/*`, `sdk/src/shared/*`
- Program behavior: `programs/shield-pool/src/*`
- Submission and retry semantics: `sdk/src/relay/*` (client side only; the submission service itself is not a documented surface)
- Circuits/build flow: `packages/circuits/*`, `packages/scripts/*`

## Notes

- Fees are on-chain program fees, read from the per-mint `pool_config` PDA and collected by the program into the treasury. Only the program collects them; never describe a fee as belonging to any other component. Take fee constants and minimums from `programs/shield-pool/src/constants.rs` and the deployed `PoolConfig`, never from SDK code, and keep program IDs and fee constants matching the deployed program, which is the source of truth.
- Prefer documenting implemented behavior over planned behavior.

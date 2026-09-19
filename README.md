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

## Deploys, and the staging path

Mintlify deploys this site; nothing in this repo builds or publishes it. There is no CI, workflow, or deploy config in this repo to confirm it, but as far as can be told, the Mintlify GitHub App is connected to `cloak-ag/docs` and publishes the site from the project's deployment branch.

The branch chain is the same one every Cloak repo uses:

| Branch | What it is |
| --- | --- |
| a topic branch (`docs/...`, `feat/...`) | where you write |
| `staging` | long-lived pre-production. Changes land here first and the team reads them here |
| `main` | production, presumably: `docs.cloak.ag` is assumed to be built from this branch, but the actual deployment branch is a dashboard setting this repo can't confirm (see below) |

How a writer checks a change before it reaches production:

1. Branch off `staging`, write, and run the three commands above locally.
2. Open the PR against `staging`. Mintlify builds a preview deployment for the pull request and links it from the PR — that preview, not the local `mint dev`, is what a reviewer should read.
3. Merge to `staging`. If a staging docs site is configured (see below), this publishes it.
4. When the release ships, open `staging` → `main`. Merging to `main` publishes production.

### Dashboard settings only an admin can make

A Mintlify project deploys one branch, and both the deployment branch and preview behaviour are dashboard settings — no file in this repo can make `staging` a deployed environment. Confirm the current options on the plan in use, then pick one:

- **A second Mintlify project** connected to this same repo with its deployment branch set to `staging` and its own subdomain (for example `docs-staging.cloak.ag`). This is the only way to get a persistent staging site with a stable URL. It should be excluded from search indexing so it never competes with production.
- **Pull-request previews only.** Keep the single project on `main` and treat the per-PR preview link as the review artifact. Cheaper, but there is no stable staging URL and the preview goes away when the PR closes.

Record which one was chosen here once it is set up.

<!-- Branch protection is not available on this GitHub plan, so nothing mechanically stops a
     push straight to `main` from publishing. The `staging` step is a team convention, not an
     enforced gate; treat a direct push to `main` as a production deploy. -->

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

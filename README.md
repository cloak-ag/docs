# Documentation

This folder contains the Mintlify docs site for Cloak: the user guide and explainers, the TypeScript and Rust SDKs, the platform and on-chain program docs, circuits, and the AI tooling setup pages.

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

## Structure

- `guide/` user-facing guide (what-is-cloak, how-it-works, private balance, private send, fees, payment links, security, compliance, verified addresses, FAQ, glossary, wallets and tokens)
- `learn/` plain-language explainers (privacy, zero-knowledge, proof of funds)
- `sdk/` SDK guides and API references (TypeScript and Rust)
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

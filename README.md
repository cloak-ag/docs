# Documentation

This folder contains the Mintlify docs site for Cloak platform, SDK, programs, services, circuits, and bots.

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

- `sdk/` SDK guides and API references
- `platform/` architecture components and transaction flows
- `protocol/` on-chain architecture and Shield Pool docs
- `architecture/` viewing-key and compliance model docs
- `services/` relay API docs
- `packages/` circuit pipeline docs
- `ai-tools/` IDE/assistant setup pages

## Source of truth

When updating docs, prioritize these sources:

- SDK exports: `sdk/src/index.ts`
- SDK runtime behavior: `sdk/src/core/*`, `sdk/src/utils/*`
- Program behavior: `programs/shield-pool/src/*`
- Relay routes/payloads: `services/relay/src/main.rs`, `services/relay/src/api/*`
- Relay sync behavior: `services/relay/src/commitment_sync.rs`
- Circuits/build flow: `packages/circuits/*`, `packages/justfile`, `packages/scripts/*`

## Notes

- Keep program IDs and fee constants aligned across SDK/program/relay docs.
- Prefer documenting implemented behavior over planned behavior.

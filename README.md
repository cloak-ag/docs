# Cloak Documentation

This folder contains the Mintlify docs site for Cloak SDK, protocol, and relay APIs.

## Local development

1. Install Mintlify CLI:

```bash
npm i -g mint
```

2. Start docs preview from this folder:

```bash
mint dev
```

3. Open `http://localhost:3000`.

## Structure

- `sdk/` SDK guides and API references
- `protocol/` on-chain architecture and Shield Pool docs
- `services/` relay API docs
- `ai-tools/` IDE/assistant setup pages

## Source of truth

When updating docs, prioritize these sources:

- SDK exports: `sdk/src/index.ts`
- SDK runtime behavior: `sdk/src/core/*`, `sdk/src/utils/*`
- Program behavior: `programs/shield-pool/src/*`
- Relay routes/payloads: `services/relay/src/main.rs`, `services/relay/src/api/*`

## Notes

- Keep program IDs and fee constants aligned across SDK/program/relay docs.
- Prefer documenting implemented behavior over planned behavior.
- For API drift checks, run: `node scripts/check-sdk-api-reference.mjs --update`

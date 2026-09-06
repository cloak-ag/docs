# Cloak Docs

Mintlify site for Cloak: user guide, plain-language explainers, SDK reference,
platform/program architecture, circuits, and AI-tooling setup pages. Content
only, no application code.

## Run locally

```bash
npm i -g mint
mint dev
```

Open the preview URL `mint dev` prints. Nothing else to build or install.

## Where things live

- `guide/` — the user-facing guide tab: what-is-cloak, how-it-works, private
  balance, private send, fees, payment links, security, compliance, verified
  addresses, FAQ, glossary, wallets and tokens.
- `learn/` — plain-language explainers (privacy, zero-knowledge, proof of
  funds).
- `sdk/` — `@cloak.dev/sdk` guides and API reference.
- `platform/` and `protocol/` — architecture components, transaction flows,
  and on-chain Shield Pool docs.
- `architecture/` — viewing-key and compliance model.
- `packages/` — circuit pipeline docs.
- `development/` — devnet integration guide.
- `operations/` — runtime trust boundaries for integrators.
- `releases/` — dated release notes (e.g. `releases/2026-08-mainnet.mdx`).
- `ai-tools/` — IDE/assistant setup pages.
- `llms.txt`, `llms-full.txt`, `.well-known/llms.txt` — AI index and context
  pack, kept in sync with the real page set.
- Navigation (tabs, groups, page order) is declared in `docs.json`, under
  `navigation.tabs`. Adding a page means creating the `.mdx` file and listing
  it in the right group in `docs.json`, or it won't render in the sidebar.

## Rules for this content

- The product name is **Cloak**, never "Cloak Labs".
- The published surface is **shield, unshield, private send, and private
  swap** only. Do not add or imply other product surfaces.
- Never document the relay (the submission/relay service) as a user-facing
  component, and never list its endpoints or internal responsibilities. The
  SDK's `relayUrl` option (a client-side parameter every flow requires) is
  fair game; the service behind it is not, per the existing note in
  `README.md`'s "Source of truth" section.
- Never mention PIX or any fiat off-ramp/on-ramp anywhere in this site.
- Fees are on-chain program policy: read from the per-mint `pool_config` PDA
  and collected by the program into the treasury. Never attribute fees to
  the SDK or any other component. Source fee constants from
  `programs/shield-pool/src/constants.rs` and the deployed `PoolConfig`.
- Swaps are Jupiter-only. Never name another DEX or aggregator.
- The wallet adapter is the signer. Never instruct a reader to provide a
  keypair file/path as if it were an app-facing flow.
- Do not name the audit firm publicly in any page. Describe remediations
  and findings without attribution.
- Use the SDK's actual published version numbers: `0.2.2` is the current
  live release (published 2026-09-06), referenced in `sdk/introduction.mdx`,
  `sdk/api-reference.mdx`, and `sdk/llms.txt`. The exported `VERSION`
  constant currently lags at `"0.2.1"` due to a known SDK bug — don't
  document it as the package version; see the Versioned exports section of
  `sdk/api-reference.mdx` for how that's phrased. The circuits bundle
  version (`circuits/0.2.0`, ceremony `cloak-transaction-0.2.0`) is a
  separate number and did not change in 0.2.2 — don't bump those.
- Prefer documenting implemented behavior over planned behavior (see
  `README.md`).

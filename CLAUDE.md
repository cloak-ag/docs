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
  balance, bridge, private send, fees, payment links, security, bridge routes,
  compliance, verified addresses, FAQ, glossary, wallets and tokens.
- `learn/` — plain-language explainers (privacy, zero-knowledge, proof of
  funds).
- `sdk/` — `@cloak.dev/sdk` guides and API reference.
- `platform/` and `protocol/` — architecture components, transaction flows,
  and on-chain Shield Pool docs.
- `architecture/` — viewing-key and compliance model.
- `packages/` — circuit pipeline docs.
- `operations/` — runtime trust boundaries for integrators.
- `releases/` — one page, `releases/latest.mdx`, describing what is live now. Do not
  add dated release pages; update that page instead.
- `ai-tools/` — IDE/assistant setup pages.
- `llms.txt`, `llms-full.txt`, `.well-known/llms.txt` — AI index and context
  pack, kept in sync with the real page set.
- Navigation (tabs, groups, page order) is declared in `docs.json`, under
  `navigation.tabs`. Adding a page means creating the `.mdx` file and listing
  it in the right group in `docs.json`, or it won't render in the sidebar.

## Rules for this content

- The product name is **Cloak**, never "Cloak Labs".
- The published surface is **shield, unshield, private send, private swap,
  and bridging in from another chain** only. Do not add or imply other product
  surfaces.
- Bridge pages (`guide/bridge.mdx`, `guide/bridge-routes.mdx`) state route
  guarantees, and the two routes are not interchangeable: 1Click signs the
  deposit address and the recipient (so a client can verify it independently)
  and refunds an order it cannot fill; Jupiter Universal Deposit signs nothing
  and has no refund path at all. Never flatten that into one "verified" badge,
  never rank the two on output amount, and never describe the money as
  trustless in transit — every route here custodies it between chains. Chain
  and asset coverage differs per route; source it from the app's own chain
  list, not from memory.
- The cost of getting a bridged deposit into the pool is a **Solana network
  cost covered out of the bridged amount**. It is not a Cloak fee, not a
  third-party fee, and no operator is named — the only fee Cloak charges is the
  on-chain program fee, and arriving carries none.
- Never document the relay (the submission/relay service) as a user-facing
  component, and never list its endpoints or internal responsibilities. The
  SDK's `relayUrl` option (a client-side parameter every flow requires) is
  fair game; the service behind it is not, per the existing note in
  `README.md`'s "Source of truth" section.
- Never mention PIX or any fiat off-ramp/on-ramp anywhere in this site.
- Fees are on-chain program policy: read from the per-mint `pool_config` PDA
  and collected by the program into the treasury. Never attribute fees to
  the SDK or any other component. Source fee constants from
  the program's own constants and the deployed `PoolConfig`.
- Swaps are Jupiter-only. Never name another DEX or aggregator.
- The wallet adapter is the signer. Never instruct a reader to provide a
  keypair file/path as if it were an app-facing flow.
- Do not name the audit firm publicly in any page. Describe remediations
  and findings without attribution.
- Use the SDK's actual published version numbers: `0.2.5` is the current
  live release (published 2026-09-17), referenced in `sdk/introduction.mdx`,
  `sdk/api-reference.mdx`, and `sdk/llms.txt`. The exported `VERSION`
  constant matches the package version again as of 0.2.5 (it lagged at
  `"0.2.1"` through 0.2.2); it is still informational only. The circuits
  bundle version (`circuits/0.2.0`, ceremony `cloak-transaction-0.2.0`) is a
  separate number and did not change in 0.2.3–0.2.5 — don't bump those.
- **SDK 0.2.5 is `@solana/kit`-native.** `connection` is a `CloakRpc` from
  `createCloakRpc()`, addresses are Kit `Address` strings, `depositorKeypair`
  is a `KeyPairSigner`, and `@solana/web3.js` is only a peer dependency used
  by `signerFromWalletAdapter`. `keypairToAdapter` and the `WalletAdapter`
  type were removed, and `RelayAuthSigner` is now a Kit signer built with
  `messageSignerFromCallback`. Every `sdk/` page and `sdk/llms.txt` is
  migrated; source new samples from the SDK's maintained examples, which CI
  dry-runs, and never hand a wallet-adapter `PublicKey` straight to a Cloak
  option — convert it with `addressFromPublicKey`.
- The SDK repo's `docs/transact-split.md` (an internal refactor plan marked
  "PLAN ONLY") and `docs/DEPOSIT-SIZE-NOTES.md` (0.2.0-era internal
  measurements) stay unpublished: this site documents implemented,
  integrator-facing behaviour.
- Prefer documenting implemented behavior over planned behavior (see
  `README.md`).
- Never state a figure you did not read from source or observe. Where a number
  is genuinely unknown, omit it or leave a clearly marked placeholder for the
  team — an invented "typical" number is the defect this rule exists to stop.

## Deploys

Mintlify publishes this site from `main` (the deployment branch set on the
`cloak/cloak` Mintlify project); there is no CI in this repo. Work lands on a
topic branch and reaches production on merge to `main` — there is no staging
gate, and the repo's abandoned `staging` branch deploys nothing. Local gates
are `mint validate` and `mint broken-links`; the PR's Mintlify preview is what
a reviewer should read. See `README.md`.

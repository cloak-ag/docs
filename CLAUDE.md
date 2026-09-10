# Cloak Docs

Fumadocs (Next.js) site for Cloak: user guide, plain-language explainers, SDK
reference, platform/program architecture, circuits, and AI-tooling setup
pages. Deployed on Vercel at docs.cloak.ag.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` is what Vercel runs; run it before opening a PR.

## Where things live

Pages are MDX under `content/docs/`, one parenthesised folder per sidebar
tab. The parentheses folder is ignored in URLs, so
`content/docs/(guide)/guide/fees.mdx` is `/guide/fees`.

- `content/docs/(guide)/guide/` — the user-facing guide: what-is-cloak,
  how-it-works, private balance, private send, fees, payment links, security,
  compliance, verified addresses, FAQ, glossary, wallets and tokens.
- `content/docs/(guide)/learn/` — plain-language explainers (privacy,
  zero-knowledge, proof of funds).
- `content/docs/(documentation)/sdk/` — `@cloak.dev/sdk` guides and API
  reference.
- `content/docs/(documentation)/platform/` and `protocol/` — architecture
  components, transaction flows, and on-chain Shield Pool docs.
- `content/docs/(documentation)/architecture/` — viewing-key and compliance
  model.
- `content/docs/(documentation)/packages/` — circuit pipeline docs.
- `content/docs/(documentation)/development/` — devnet integration guide.
- `content/docs/(documentation)/operations/` — runtime trust boundaries for
  integrators.
- `content/docs/(documentation)/releases/` — dated release notes (e.g.
  `releases/2026-08-mainnet.mdx`).
- `content/docs/(ai-tools)/ai-tools/` — IDE/assistant setup pages.
- `public/llms.txt`, `public/llms-full.txt`, `public/sdk/llms.txt`,
  `public/.well-known/llms.txt` — hand-maintained AI index and context pack,
  kept in sync with the real page set. Served as static files at the same
  URLs as before (`/llms.txt`, `/sdk/llms.txt`, ...).
- `public/images/`, `public/architecture/diagrams/`, `public/logo/` — static
  assets referenced by absolute path from MDX.
- Navigation (groups, page order) is declared in each tab folder's
  `meta.json` (`content/docs/(guide)/meta.json`, etc.): `"root": true` makes
  the folder a tab, `"---Label---"` entries are group headings, pages are
  listed as `"./folder/page"`. Tab order is in `content/docs/meta.json`.
  Adding a page means creating the `.mdx` file and listing it in the right
  `meta.json`, or it won't render in the sidebar.
- Site code: `lib/source.ts` (content source), `lib/layout.shared.tsx`
  (navbar links), `lib/shared.ts` (site URL), `app/(docs)/` (layout + page
  route), `app/api/search/route.ts` (search), `components/mdx.tsx` (MDX
  components and the Mintlify-compatible shims).

## Authoring conventions

- Frontmatter: `title`, `description`, optional `icon`. Icon names (frontmatter
  and `<Card icon="...">`) are Lucide icons in PascalCase (`Wallet`,
  `ShieldCheck`, `FileLock`); unknown names log a warning at build time.
- `<Note>`, `<Tip>`, `<Warning>`, `<Card>`, `<CardGroup cols={n}>`,
  `<Accordion title>`, `<AccordionGroup>` are supported via shims. Do not use
  `<CodeGroup>`: tabbed code samples are consecutive fences with a
  `tab="Label"` meta string; a single titled block uses `title="file.ts"`.
- Do not add an H1 in the body; the title comes from frontmatter.
- Link between pages with absolute paths (`/sdk/quickstart`).

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
  live release (published 2026-09-06), referenced in
  `content/docs/(documentation)/sdk/introduction.mdx`,
  `content/docs/(documentation)/sdk/api-reference.mdx`, and
  `public/sdk/llms.txt`. The exported `VERSION`
  constant currently lags at `"0.2.1"` due to a known SDK bug — don't
  document it as the package version; see the Versioned exports section of
  the API reference page for how that's phrased. The circuits bundle
  version (`circuits/0.2.0`, ceremony `cloak-transaction-0.2.0`) is a
  separate number and did not change in 0.2.2 — don't bump those.
- Prefer documenting implemented behavior over planned behavior (see
  `README.md`).

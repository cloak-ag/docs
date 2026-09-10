# Documentation

This folder contains the Cloak docs site, built with [Fumadocs](https://fumadocs.dev) on Next.js and deployed on Vercel: the user guide and explainers, the SDK, the platform and on-chain program docs, circuits, and the AI tooling setup pages.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root URL redirects to `/guide/what-is-cloak`.

`npm run build` produces the production build (this is what Vercel runs).

## Structure

Pages live under `content/docs/`, grouped into one folder per sidebar tab. The tab folders are wrapped in parentheses so they do not affect URLs: `content/docs/(guide)/guide/fees.mdx` is served at `/guide/fees`.

- `content/docs/(guide)/`
  - `guide/` user-facing guide (what-is-cloak, how-it-works, private balance, private send, fees, payment links, security, compliance, verified addresses, FAQ, glossary, wallets and tokens)
  - `learn/` plain-language explainers (privacy, zero-knowledge, proof of funds)
- `content/docs/(documentation)/`
  - `sdk/` SDK guides and API references
  - `platform/` architecture components and transaction flows
  - `protocol/` on-chain architecture and Shield Pool docs
  - `architecture/` viewing-key and compliance model docs
  - `packages/` circuit pipeline docs
  - `releases/` dated release notes
  - `development/` devnet integration guide
  - `operations/` runtime trust boundaries and security controls for integrators
- `content/docs/(ai-tools)/ai-tools/` IDE/assistant setup pages
- `public/` static files served as-is: `llms.txt` (top-level AI index and route map), `llms-full.txt` (single-file AI context pack), `sdk/llms.txt`, `.well-known/llms.txt`, images, diagrams, logos, favicon

Site code:

- `lib/source.ts` content source (`fumadocs-mdx` collection + `loader()`)
- `lib/layout.shared.tsx` navbar: logo, links, GitHub
- `lib/shared.ts` site name, canonical URL, route prefixes
- `app/(docs)/` docs layout and the catch-all page route
- `app/api/search/route.ts` built-in search (Orama)
- `app/llms.mdx/` per-page Markdown (used by the "copy page" button); `app/og/` Open Graph images
- `components/mdx.tsx` MDX components, including the Mintlify-compatible shims

## Navigation

Sidebar order and grouping is declared in the `meta.json` of each tab folder (`content/docs/(guide)/meta.json`, `content/docs/(documentation)/meta.json`, `content/docs/(ai-tools)/meta.json`). Each has `"root": true`, which is what makes it a tab. Group headings are `"---Label---"` entries and pages are listed as `"./folder/page"`.

Adding a page means creating the `.mdx` file (frontmatter: `title`, `description`, optional `icon`) and adding it to the right `meta.json`, or it will not appear in the sidebar. Tab order is set in `content/docs/meta.json`.

## Writing pages

- `icon` values (frontmatter and `<Card icon="...">`) are [Lucide](https://lucide.dev/icons) icon names in PascalCase, e.g. `Wallet`, `ShieldCheck`.
- `<Note>`, `<Tip>`, `<Warning>`, `<Card>`, `<CardGroup cols={n}>`, `<Accordion title="...">` and `<AccordionGroup>` keep working (see `components/mdx.tsx`). Fumadocs' own components (`Callout`, `Cards`, `Tabs`, `Steps`, ...) are available too.
- Tabbed code samples use the Fumadocs syntax: give consecutive fences a `tab="Label"` meta string. A single titled block uses `title="file.ts"`.
- Use absolute links (`/sdk/quickstart`) between pages.

## Deployment

The site is a standard Next.js app on Vercel (`vercel.json` pins the framework). Pushing to `main` deploys production; every branch gets a preview URL.

The custom domain (`docs.cloak.ag`) is configured on the Vercel project, not in this repo: Project Settings → Domains → add the domain, then create the `docs` CNAME at the DNS provider pointing at the target Vercel shows. The only place the domain appears in code is `siteUrl` in `lib/shared.ts`, used for canonical and Open Graph URLs.

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

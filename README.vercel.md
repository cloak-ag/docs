# Cloak docs on Vercel

This branch contains a self-hosted Next.js renderer for the existing MDX documentation. It does not use the Mintlify GitHub App or Mintlify hosting.

## Local development

```bash
npm install
npm run dev
```

## Vercel deployment

Import this repository into Vercel. The framework should be detected as **Next.js**, with the root directory set to the repository root. Vercel will use `npm run build` automatically.

After the first deployment, add `docs.cloak.ag` under **Project Settings → Domains**. At the DNS provider, point the `docs` CNAME record to the target shown by Vercel. Remove old Mintlify CNAME records first.

The root URL redirects to the guide, and `/quickstart` redirects to `/sdk/quickstart`.

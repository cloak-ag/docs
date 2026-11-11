/**
 * Type-check every TypeScript/JavaScript code block in the SDK docs against the published
 * `@cloak.dev/sdk`, so a page cannot teach an API the package no longer has.
 *
 * Usage (from a directory where `@cloak.dev/sdk`, `@solana/kit`, `@solana/web3.js` and
 * `typescript` are installed, see .github/workflows/snippets.yml):
 *
 *     npx tsx <docs>/scripts/check-snippets.ts <docs-dir> [page.mdx ...]
 *
 * Each code block compiles as its own module. Blocks are often fragments that use a `connection`
 * or `wallet` set up on an earlier line of the page, so "cannot find name" errors are not reported:
 * those names type as `any`. Everything else is: an import the package does not export, an option
 * it does not take, a required option a call leaves out, a wrong argument count.
 *
 * A block whose fence carries `nocheck` (```ts nocheck) is skipped, for pseudo-code and for code
 * that is not meant to run against the SDK.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import type TS from "typescript";

// Loaded from the directory the check runs in, which is where the SDK is installed, not from this
// repo, which has no dependencies of its own.
const ts: typeof TS = createRequire(join(process.cwd(), "package.json"))("typescript");

const FENCE = /^```(ts|typescript|tsx|js|javascript)\b(.*)$/;

/** Names a fragment may use without declaring them. Other diagnostics are real. */
const IGNORED_CODES = new Set([
  2304, // Cannot find name 'x'.
  2552, // Cannot find name 'x'. Did you mean 'y'?
  18004, // No value exists in scope for the shorthand property 'x' (`{ connection, relayUrl }`).
  7005, // Variable implicitly has an 'any' type.
  7006, // Parameter implicitly has an 'any' type.
  7031, // Binding element implicitly has an 'any' type.
]);

/** Modules a snippet may import that this checker does not install. */
const UNCHECKED_MODULES = /^(react|react-dom|next\/|@solana\/wallet-adapter|@privy-io|express|bs58|dotenv)/;

interface Block {
  page: string;
  line: number;
  file: string;
}

function pages(docsDir: string, explicit: string[]): string[] {
  if (explicit.length > 0) return explicit.map((p) => resolve(docsDir, p));
  const sdkDir = join(docsDir, "sdk");
  return readdirSync(sdkDir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => join(sdkDir, f))
    .concat(join(sdkDir, "llms.txt"), join(docsDir, "releases", "latest.mdx"));
}

function extract(docsDir: string, outDir: string, files: string[]): Block[] {
  const blocks: Block[] = [];
  for (const page of files) {
    const lines = readFileSync(page, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const open = FENCE.exec(lines[i].trim());
      if (!open) continue;
      const start = i + 1;
      let end = start;
      while (end < lines.length && !lines[end].trim().startsWith("```")) end++;
      i = end;
      if (/\bnocheck\b/.test(open[2])) continue;
      const ext = open[1] === "tsx" ? "tsx" : "ts";
      const name = `${relative(docsDir, page).replace(/[\\/.]/g, "_")}__L${start}.${ext}`;
      // `export {}` makes every block a module, so top-level await works and names do not clash.
      const body = lines.slice(start, end).join("\n");
      writeFileSync(join(outDir, name), `${body}\nexport {};\n`);
      blocks.push({ page: relative(docsDir, page), line: start, file: join(outDir, name) });
    }
  }
  return blocks;
}

function main(): void {
  const [docsArg, ...explicit] = process.argv.slice(2);
  if (!docsArg) throw new Error("usage: check-snippets.ts <docs-dir> [page.mdx ...]");
  const docsDir = resolve(docsArg);
  // Per process, so concurrent runs in one directory never delete each other's files.
  const outDir = resolve(process.cwd(), `.snippets-${process.pid}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const blocks = extract(docsDir, outDir, pages(docsDir, explicit));
  const program = ts.createProgram(
    blocks.map((b) => b.file),
    {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true,
      esModuleInterop: true,
      types: ["node"],
    },
  );

  const byFile = new Map(blocks.map((b) => [b.file, b]));
  let failures = 0;

  // An install line pinned to another release teaches a different API than the one checked here.
  // Read from disk: the package's `exports` map does not expose its package.json.
  const installed: string = JSON.parse(
    readFileSync(join(process.cwd(), "node_modules/@cloak.dev/sdk/package.json"), "utf8"),
  ).version;
  for (const page of pages(docsDir, explicit)) {
    readFileSync(page, "utf8")
      .split("\n")
      .forEach((text, i) => {
        for (const m of text.matchAll(/@cloak\.dev\/sdk@\^?(\d+\.\d+\.\d+)/g)) {
          if (m[1] === installed) continue;
          console.log(`${relative(docsDir, page)}:${i + 1}  VERSION  installs ${m[1]}, npm latest is ${installed}`);
          failures++;
        }
      });
  }
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (IGNORED_CODES.has(d.code) || !d.file) continue;
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    const missing = /Cannot find module '([^']+)'/.exec(message);
    if (d.code === 2307 && missing && UNCHECKED_MODULES.test(missing[1])) continue;
    const block = byFile.get(resolve(d.file.fileName));
    if (!block) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    console.log(`${block.page}:${block.line + line + 1}  TS${d.code}  ${message.split("\n")[0]}`);
    failures++;
  }
  console.log(`\n${blocks.length} blocks checked, ${failures} error(s).`);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}

main();

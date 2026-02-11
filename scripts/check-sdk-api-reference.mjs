#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    update: false,
    api: "sdk/api-reference.mdx",
    sdkIndex: "../sdk/src/index.ts",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--update") {
      args.update = true;
      continue;
    }
    if (arg === "--api") {
      args.api = argv[++i];
      continue;
    }
    if (arg === "--sdk-index") {
      args.sdkIndex = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function splitExportNames(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((token) => {
      let cleaned = token.replace(/^type\s+/, "").trim();
      const asMatch = cleaned.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      if (asMatch) return asMatch[1];
      return cleaned.split(/\s+/)[0];
    })
    .filter(Boolean);
}

function extractExports(indexSource) {
  const out = new Set();

  const reExportFrom = /export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["'];/g;
  let match;
  while ((match = reExportFrom.exec(indexSource)) !== null) {
    const kind = match[1] ? "type" : "value";
    const names = splitExportNames(match[2]);
    for (const name of names) out.add(`${kind}:${name}`);
  }

  const reLocalNamed = /export\s+(type\s+)?\{([\s\S]*?)\};/g;
  while ((match = reLocalNamed.exec(indexSource)) !== null) {
    const kind = match[1] ? "type" : "value";
    const names = splitExportNames(match[2]);
    for (const name of names) out.add(`${kind}:${name}`);
  }

  const directPatterns = [
    { re: /export\s+const\s+([A-Za-z_$][\w$]*)/g, kind: "value" },
    { re: /export\s+function\s+([A-Za-z_$][\w$]*)/g, kind: "value" },
    { re: /export\s+class\s+([A-Za-z_$][\w$]*)/g, kind: "value" },
    { re: /export\s+type\s+([A-Za-z_$][\w$]*)/g, kind: "type" },
    { re: /export\s+interface\s+([A-Za-z_$][\w$]*)/g, kind: "type" },
  ];

  for (const { re, kind } of directPatterns) {
    let m;
    while ((m = re.exec(indexSource)) !== null) {
      out.add(`${kind}:${m[1]}`);
    }
  }

  return [...out].sort((a, b) => a.localeCompare(b));
}

function buildInventoryBlock(items, sourceLabel) {
  return [
    "{/* SDK_EXPORTS_START */}",
    "```text sdk-exports",
    `source: ${sourceLabel}`,
    ...items,
    "```",
    "{/* SDK_EXPORTS_END */}",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiPath = path.resolve(process.cwd(), args.api);
  const sdkIndexPath = path.resolve(process.cwd(), args.sdkIndex);

  const apiText = fs.readFileSync(apiPath, "utf8");
  const indexText = fs.readFileSync(sdkIndexPath, "utf8");

  const inventory = extractExports(indexText);
  const sourceLabel = path.relative(path.dirname(apiPath), sdkIndexPath) || path.basename(sdkIndexPath);
  const desiredBlock = buildInventoryBlock(inventory, sourceLabel);

  const markerRe = /\{\/\*\s*SDK_EXPORTS_START\s*\*\/\}[\s\S]*?\{\/\*\s*SDK_EXPORTS_END\s*\*\/\}/m;
  if (!markerRe.test(apiText)) {
    throw new Error(`Marker block not found in ${apiPath}. Add SDK_EXPORTS_START/END markers first.`);
  }

  const nextText = apiText.replace(markerRe, desiredBlock);

  if (args.update) {
    fs.writeFileSync(apiPath, nextText);
    process.stdout.write(`Updated export inventory in ${apiPath}\n`);
    return;
  }

  if (nextText !== apiText) {
    process.stderr.write("SDK API reference drift detected.\n");
    process.stderr.write(
      `Run: node scripts/check-sdk-api-reference.mjs --update --api ${args.api} --sdk-index ${args.sdkIndex}\n`
    );
    process.exit(1);
  }

  process.stdout.write("SDK API reference export inventory is up to date.\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

#!/usr/bin/env node
// =====================================================================
// sync-shared.mjs
//
// Copies the canonical shooter engine (sim.ts, map.ts, types.ts) from
// the website repo into shooter-server/src/shared/ so the server can
// build against the same code that single-player runs.
//
// Run this whenever you edit any of these files in the website:
//   ardoremy_actually_website_github_repo/hry/shooter/types.ts
//   ardoremy_actually_website_github_repo/hry/shooter/engine/map.ts
//   ardoremy_actually_website_github_repo/hry/shooter/engine/sim.ts
//
// Or just `cd shooter-server && npm run build` — prebuild auto-runs it
// if the website source is reachable as a sibling. In Docker (Railway)
// the website isn't reachable, so the committed copy in src/shared/ is
// what ships.
//
// Pure Node (no bash) so it runs on Alpine in Docker too.
// =====================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(SCRIPT_DIR, '..');
const WEBSITE = resolve(
  SERVER_ROOT,
  '..',
  'ardoremy_actually_website_github_repo',
  'hry',
  'shooter',
);
const SHARED = resolve(SERVER_ROOT, 'src', 'shared');

if (!existsSync(WEBSITE)) {
  console.log(
    `[sync-shared] website source not found at ${WEBSITE} — skipping (using committed copy)`,
  );
  process.exit(0);
}

mkdirSync(SHARED, { recursive: true });

const HEADER = `// =====================================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source of truth: ardoremy_actually_website_github_repo/hry/shooter/
// Re-sync: cd shooter-server && node scripts/sync-shared.mjs
// =====================================================================
`;

function writeWithHeader(src, dst, transform = (s) => s) {
  const content = readFileSync(src, 'utf8');
  writeFileSync(dst, HEADER + '\n' + transform(content));
}

// NodeNext requires explicit .js extensions in relative imports.
// Website (Vite, bundler resolution) doesn't, so rewrite as we copy.
const rewriteImports = (s) => s.replace(/from '\.\.\/types'/g, "from './types.js'");

writeWithHeader(resolve(WEBSITE, 'types.ts'), resolve(SHARED, 'types.ts'));
writeWithHeader(resolve(WEBSITE, 'engine', 'map.ts'), resolve(SHARED, 'map.ts'), rewriteImports);
writeWithHeader(resolve(WEBSITE, 'engine', 'sim.ts'), resolve(SHARED, 'sim.ts'), rewriteImports);

console.log(`[sync-shared] copied types.ts, map.ts, sim.ts → ${SHARED}`);

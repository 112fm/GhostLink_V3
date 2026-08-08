#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const sourceFile = path.join(projectDir, 'src/templates/admin.module.template.js');
const outputFile = path.join(projectDir, 'src/modules/admin.js');
const includePattern = /\/\*\s*@include\s+([^\s]+)\s*\*\//g;

async function renderFile(filePath, seen = new Set()) {
  const canonicalPath = path.resolve(filePath);
  if (seen.has(canonicalPath)) {
    throw new Error(`Circular JavaScript include: ${canonicalPath}`);
  }

  const nextSeen = new Set(seen);
  nextSeen.add(canonicalPath);
  const source = await readFile(canonicalPath, 'utf8');
  const parts = [];
  let cursor = 0;

  for (const match of source.matchAll(includePattern)) {
    parts.push(source.slice(cursor, match.index));
    const includedFile = path.resolve(projectDir, match[1]);
    parts.push(await renderFile(includedFile, nextSeen));
    cursor = match.index + match[0].length;
  }

  parts.push(source.slice(cursor));
  return parts.join('');
}

const rendered = await renderFile(sourceFile);

if (process.argv.includes('--check')) {
  const current = await readFile(outputFile, 'utf8');
  if (current !== rendered) {
    throw new Error('src/modules/admin.js is stale. Run: node scripts/build-admin.mjs');
  }
  console.log('admin.js matches the admin source modules.');
} else {
  await writeFile(outputFile, rendered);
  console.log('Built src/modules/admin.js from admin source modules.');
}

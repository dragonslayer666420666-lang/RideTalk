import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const file = process.argv[2] || 'index.html';
const html = fs.readFileSync(file, 'utf8');
const failures = [];

if (html.length < 500) failures.push('index.html is unexpectedly small.');
if (html.length > 2_000_000) failures.push('index.html is larger than 2 MB.');
if (!/^\s*<!doctype html>/i.test(html)) failures.push('Missing HTML doctype.');
if (!/<html\b/i.test(html) || !/<\/html>/i.test(html)) failures.push('Missing html element.');
if (!/<body\b/i.test(html) || !/<\/body>/i.test(html)) failures.push('Missing body element.');

const idMatches = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const counts = new Map();
for (const id of idMatches) counts.set(id, (counts.get(id) || 0) + 1);
const duplicateIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
if (duplicateIds.length) failures.push(`Duplicate element IDs: ${duplicateIds.join(', ')}`);

const uiReferences = [...html.matchAll(/\$\(["']([^"']+)["']\)/g)].map((match) => match[1]);
const idSet = new Set(idMatches);
const missingIds = [...new Set(uiReferences.filter((id) => !idSet.has(id)))];
if (missingIds.length) failures.push(`JavaScript references missing element IDs: ${missingIds.join(', ')}`);

const forbidden = [
  ['GitHub personal token', /github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+/],
  ['OpenAI-style secret', /sk-[A-Za-z0-9_-]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['private key', /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/],
  ['GITHUB_TOKEN in public page', /GITHUB_TOKEN/],
  ['dynamic eval', /\beval\s*\(/],
  ['dynamic Function constructor', /new\s+Function\s*\(/],
];
for (const [label, pattern] of forbidden) {
  if (pattern.test(html)) failures.push(`Blocked ${label}.`);
}

const scripts = [...html.matchAll(/<script(?<attrs>[^>]*)>(?<code>[\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match.groups.attrs || ''))
  .map((match) => ({
    module: /\btype\s*=\s*["']module["']/.test(match.groups.attrs || ''),
    code: match.groups.code,
  }))
  .filter((item) => item.code.trim());

for (const [index, script] of scripts.entries()) {
  const extension = script.module ? '.mjs' : '.js';
  const tempFile = path.join(os.tmpdir(), `ridetalk-check-${process.pid}-${index}${extension}`);
  fs.writeFileSync(tempFile, script.code, 'utf8');
  const result = spawnSync(process.execPath, ['--check', tempFile], { encoding: 'utf8' });
  fs.rmSync(tempFile, { force: true });
  if (result.status !== 0) {
    failures.push(`Inline script ${index + 1} has invalid JavaScript: ${result.stderr.trim()}`);
  }
}

if (failures.length) {
  console.error('RideTalk validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RideTalk validation passed: ${idMatches.length} IDs, ${scripts.length} inline script(s), ${html.length} characters.`);

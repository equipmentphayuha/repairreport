import fs from 'node:fs';

function extractIds(html) {
  const matches = [...html.matchAll(/id=["']([^"']+)["']/g)];
  return matches.map(m => m[1]);
}

const origHtml = fs.readFileSync('_legacy_backup/index.monolithic.backup.html', 'utf8');
const distHtml = fs.readFileSync('dist/index.html', 'utf8');

const origIds = extractIds(origHtml);
const distIds = extractIds(distHtml);

console.log('Original IDs count:', origIds.length);
console.log('Dist IDs count:    ', distIds.length);

const isExactMatch = origIds.length === distIds.length && origIds.every((id, idx) => id === distIds[idx]);
console.log('Exact 1:1 IDs match across all 397 elements:', isExactMatch);

if (!isExactMatch) {
  process.exit(1);
}

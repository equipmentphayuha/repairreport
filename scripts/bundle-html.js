import fs from 'node:fs';
import path from 'node:path';

export function resolveHtmlIncludes(html, baseDir = process.cwd()) {
  const includeRegex = /<!--\s*#include\s+["']([^"']+)["']\s*-->/g;
  return html.replace(includeRegex, (match, relPath) => {
    const fullPath = path.resolve(baseDir, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`[html-include] Missing partial file: ${fullPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return resolveHtmlIncludes(content, baseDir);
  });
}

const inputHtml = fs.readFileSync('index.html', 'utf8');
const outputHtml = resolveHtmlIncludes(inputHtml);
fs.writeFileSync('index.bundled.html', outputHtml, 'utf8');
console.log('Successfully bundled index.html into index.bundled.html');

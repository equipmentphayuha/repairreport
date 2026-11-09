import fs from 'node:fs';
import path from 'node:path';

function checkTopLevelDom(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let depth = 0;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    
    // check top-level addEventListener
    if (depth === 0 && line.includes('document.getElementById') && line.includes('.addEventListener')) {
      if (!line.includes('?.addEventListener')) {
        console.log(`[STABILITY WARNING - Missing optional chaining] ${filePath}:${i+1} -> ${trimmed}`);
      }
    }

    const open = (line.match(/{/g) || []).length;
    const close = (line.match(/}/g) || []).length;
    depth += open - close;
    if (depth < 0) depth = 0;
  });
}

function scanDir(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) scanDir(p);
    else if (p.endsWith('.js')) checkTopLevelDom(p);
  }
}

scanDir('js');

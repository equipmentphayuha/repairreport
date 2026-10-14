const fs = require('fs');
let s = fs.readFileSync('storage.js', 'utf8');

s = s.replace(/function loadRepairs\(\) \{\s+const data = localStorage\.getItem\(STORAGE_KEY_REPAIRS\);\s+return data \? JSON\.parse\(data\) : DEFAULT_REPAIRS;\s+\}/,
`function loadRepairs() {
  const data = localStorage.getItem(STORAGE_KEY_REPAIRS);
  if (!data) return DEFAULT_REPAIRS;
  const parsed = JSON.parse(data);
  let migrated = false;
  parsed.forEach(r => {
    if (r.dept && !r.div) { r.div = r.dept; delete r.dept; migrated = true; }
  });
  if (migrated) saveRepairs(parsed);
  return parsed;
}`);

s = s.replace(/function loadEquipments\(\) \{\s+const data = localStorage\.getItem\(STORAGE_KEY_EQUIPMENTS\);\s+return data \? JSON\.parse\(data\) : DEFAULT_EQUIPMENTS;\s+\}/,
`function loadEquipments() {
  const data = localStorage.getItem(STORAGE_KEY_EQUIPMENTS);
  if (!data) return DEFAULT_EQUIPMENTS;
  const parsed = JSON.parse(data);
  let migrated = false;
  parsed.forEach(eq => {
    if (eq.dept && !eq.div) { eq.div = eq.dept; delete eq.dept; migrated = true; }
  });
  if (migrated) saveEquipments(parsed);
  return parsed;
}`);

fs.writeFileSync('storage.js', s);
console.log('storage.js patched for migration');

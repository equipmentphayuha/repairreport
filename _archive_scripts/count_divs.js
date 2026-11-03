const fs = require('fs');
const content = fs.readFileSync('storage.js', 'utf8');
const divs = new Set();
const matches = content.match(/div:\s*\"([^\"]+)\"/g);
if (matches) {
  matches.forEach(m => divs.add(m.replace(/div:\s*\"|\"/g, '')));
}
console.log('Total unique departments:', divs.size);
console.log(Array.from(divs).join(', '));

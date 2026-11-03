const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const divDatalistFunc = `
function updateDivDatalist() {
  const datalist = document.getElementById('divDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  const divSet = new Set();
  repairs.forEach(r => { if(r.div) divSet.add(r.div); });
  equipments.forEach(eq => { if(eq.div) divSet.add(eq.div); });
  Array.from(divSet).sort().forEach(divName => {
    const opt = document.createElement('option');
    opt.value = divName;
    datalist.appendChild(opt);
  });
}
`;

if (!appJs.includes('updateDivDatalist')) {
  appJs = appJs.replace('function updateEquipmentDatalist() {', divDatalistFunc + '\nfunction updateEquipmentDatalist() {');
  appJs = appJs.replace(/updateEquipmentDatalist\(\);/g, 'updateEquipmentDatalist();\n  updateDivDatalist();');
  fs.writeFileSync('app.js', appJs);
  console.log('app.js updated');
}

const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const newDivDatalistFunc = `function updateDivDatalist() {
  const datalist = document.getElementById('divDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  const divSet = new Set([
    "ซ่อมเครื่องมือทั่วไป", "ศูนย์เครื่องมือแพทย์", "กลุ่มงานเทคนิคการแพทย์", 
    "กลุ่มงานการพยาบาล", "งานการพยาบาลผู้ป่วยนอก (OPD)", "งานการพยาบาลผู้ป้วยใน (IPD)", 
    "งานการพยาบาลผู้ป่วยคลอด", "งานการผู้ป่วยอุบัติเหตุฉุกเฉินและนิติเวช (ER)", 
    "งานการพยาบาลหน่วยควบคุมการติดเชื้อและงานจ่ายกลาง", "กลุ่มงานบริการด้านปฐมภูมิและองค์รวม", 
    "กลุ่มงานจิตเวชและยาเสพติด", "กลุ่มงานประกันสุขภาพยุทธศาสตร์", "ไม่ระบุแผนก", 
    "กลุ่มงานดิจิทัล", "งานการเงินและบัญชี", "กลุ่มงานโภชนศาสตร์", "กลุ่มงานเวชกรรมฟื้นฟู", 
    "กลุ่มงานการแพทย์แผนไทยฯ", "กลุ่มงานรังสีวิทยา", "กลุ่มงานบริหารทั่วไป", "กลุ่มงานทันตกรรม", 
    "กลุ่มงานรังสี", "กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค"
  ]);
  repairs.forEach(r => { if(r.div) divSet.add(r.div); });
  equipments.forEach(eq => { if(eq.div) divSet.add(eq.div); });
  Array.from(divSet).sort().forEach(divName => {
    const opt = document.createElement('option');
    opt.value = divName;
    datalist.appendChild(opt);
  });
}`;

appJs = appJs.replace(/function updateDivDatalist\(\) \{[\s\S]*?\}\s*function updateEquipmentDatalist/m, newDivDatalistFunc + '\nfunction updateEquipmentDatalist');
fs.writeFileSync('app.js', appJs);
console.log('app.js updated with new default departments');

const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

// Replace tab buttons
const newTabs = `
      <div class="flex gap-2">
        <button onclick="switchTab('charts')" id="btn-tab-charts" class="px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-900 shadow transition-colors">ภาพรวมสถิติ (กราฟ)</button>
        <button onclick="switchTab('tables')" id="btn-tab-tables" class="px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-800 transition-colors">รายละเอียดแผนก/ครุภัณฑ์</button>
        <button onclick="switchTab('repairs')" id="btn-tab-repairs" class="px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-800 transition-colors">รายการใบส่งซ่อม</button>
      </div>`;
html = html.replace(/<div class="flex gap-2">\s*<button onclick="switchTab\('dashboard'\).*?<\/button>\s*<button onclick="switchTab\('repairs'\).*?<\/button>\s*<\/div>/s, newTabs.trim());

// Split section-dashboard into section-charts and section-tables
// Find the Breakdown Tables part
const breakdownSplitIndex = html.indexOf('<!-- Breakdown Tables -->');
const sectionDashboardStart = html.indexOf('<section id="section-dashboard" class="space-y-6">');
const sectionDashboardEnd = html.indexOf('</section>', sectionDashboardStart);

if (breakdownSplitIndex !== -1) {
  let beforeBreakdown = html.substring(0, breakdownSplitIndex);
  let afterBreakdown = html.substring(breakdownSplitIndex, sectionDashboardEnd);
  
  beforeBreakdown = beforeBreakdown.replace('<section id="section-dashboard" class="space-y-6">', '<section id="section-charts" class="space-y-6">');
  
  let newHtml = beforeBreakdown + '</section>\n\n    <!-- ================= แท็บ 1.5: สรุปรายละเอียด ================= -->\n    <section id="section-tables" class="space-y-6 hidden">\n      ' + afterBreakdown + '</section>\n';
  newHtml += html.substring(sectionDashboardEnd + 10);
  html = newHtml;
}

// Add filter bar clone to section-tables?
// Or just let it be. Let's add a small header for tables.
html = html.replace(/<!-- Breakdown Tables -->/, `
      <!-- Export Bar for Tables -->
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-base font-bold text-slate-700">รายละเอียดตารางสรุป</h2>
          <p class="text-xs text-slate-500">ข้อมูลค่าใช้จ่ายและความถี่แยกตามแผนกและครุภัณฑ์</p>
        </div>
        <div class="flex gap-2">
          <button onclick="window.print()" class="bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium shadow flex items-center gap-1.5 transition no-print">
            <span>🖨️</span> พิมพ์รายงาน
          </button>
        </div>
      </div>
      <!-- Breakdown Tables -->`);

fs.writeFileSync('index.html', html);
console.log('index.html updated');

// 2. Update app.js switchTab
let appJs = fs.readFileSync('app.js', 'utf8');
const newSwitchTab = `
function switchTab(tab) {
  const secCharts = document.getElementById('section-charts');
  const secTables = document.getElementById('section-tables');
  const secRepairs = document.getElementById('section-repairs');
  const btnCharts = document.getElementById('btn-tab-charts');
  const btnTables = document.getElementById('btn-tab-tables');
  const btnRepairs = document.getElementById('btn-tab-repairs');

  secCharts.classList.add('hidden');
  secTables.classList.add('hidden');
  secRepairs.classList.add('hidden');
  
  const activeClass = "px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-900 shadow transition-colors";
  const inactiveClass = "px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-800 transition-colors";
  
  btnCharts.className = inactiveClass;
  btnTables.className = inactiveClass;
  btnRepairs.className = inactiveClass;

  if (tab === 'charts') {
    secCharts.classList.remove('hidden');
    btnCharts.className = activeClass;
    renderDashboard();
  } else if (tab === 'tables') {
    secTables.classList.remove('hidden');
    btnTables.className = activeClass;
    renderDashboardTables();
  } else {
    secRepairs.classList.remove('hidden');
    btnRepairs.className = activeClass;
    renderTable();
  }
}
`;

appJs = appJs.replace(/function switchTab\(tab\) \{[\s\S]*?\}\s*function renderTable\(\)/, newSwitchTab.trim() + '\n\nfunction renderTable()');
fs.writeFileSync('app.js', appJs);
console.log('app.js updated');

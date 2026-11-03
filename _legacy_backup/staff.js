/**
 * staff.js
 * จัดการระบบเจ้าหน้าที่:
 *  - ช่างซ่อม (assignee): สรุปภาระงาน, กราฟ, รายละเอียด
 *  - ผู้ส่งซ่อม (requester): สรุปความถี่, กราฟ, รายละเอียด
 *  - Export PPT / Excel สำหรับผู้บริหาร
 */

let techChartInstance = null;
let requesterChartInstance = null;

// ─── Utility: คำนวณข้อมูลจาก repairs[] ──────────────────────────────────────────

function buildTechData() {
  const map = {};
  repairs.forEach(r => {
    const name = (r.assignee || 'ยังไม่ระบุ').trim();
    if (!map[name]) {
      map[name] = { name, count: 0, done: 0, inprogress: 0, cost: 0, items: [] };
    }
    map[name].count++;
    map[name].cost += Number(r.cost) || 0;
    if (r.status === 'เสร็จสิ้น') map[name].done++;
    else if (['กำลังดำเนินการ', 'รอดำเนินการ', 'รออะไหล่/ช่างภายนอก'].includes(r.status)) map[name].inprogress++;
    map[name].items.push(r);
  });
  return Object.values(map).sort((a, b) => b.count - a.count || b.cost - a.cost);
}

function buildRequesterData() {
  const map = {};
  repairs.forEach(r => {
    const name = (r.requester || 'ไม่ระบุผู้แจ้ง').trim();
    const dept = (r.div || '-').trim();
    const key = name;
    if (!map[key]) {
      map[key] = { name, dept, count: 0, cost: 0, items: [] };
    }
    map[key].count++;
    map[key].cost += Number(r.cost) || 0;
    // เก็บ dept ที่หลากหลาย
    if (!map[key].dept.includes(dept)) map[key].dept += (map[key].dept === dept ? '' : ', ' + dept);
    map[key].items.push(r);
  });
  return Object.values(map).sort((a, b) => b.count - a.count);
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

function renderStaffKPI(techData, requesterData) {
  const totalTechJobs = techData.reduce((s, t) => s + t.count, 0);
  document.getElementById('kpi-staff-technicians').innerText = `${techData.length} คน`;
  document.getElementById('kpi-staff-tech-sub').innerText = `ปฏิบัติงานรวม ${totalTechJobs} ครั้ง`;

  if (techData.length > 0) {
    const top = techData[0];
    document.getElementById('kpi-staff-top-tech').innerText = top.name;
    document.getElementById('kpi-staff-top-tech-sub').innerText = `${top.count} งาน | ${top.cost.toLocaleString()} บาท`;
  }

  const totalReqJobs = requesterData.reduce((s, r) => s + r.count, 0);
  document.getElementById('kpi-staff-requesters').innerText = `${requesterData.length} คน`;
  document.getElementById('kpi-staff-req-sub').innerText = `ส่งซ่อมรวม ${totalReqJobs} ครั้ง`;

  if (requesterData.length > 0) {
    const top = requesterData[0];
    document.getElementById('kpi-staff-top-req').innerText = top.name;
    document.getElementById('kpi-staff-top-req-sub').innerText = `${top.count} ครั้ง`;
  }
}

// ─── กราฟ ─────────────────────────────────────────────────────────────────────

function renderStaffCharts(techData, requesterData) {
  // กราฟช่างซ่อม (Bar แนวนอน: งาน + cost)
  const topTechs = techData.slice(0, 10);
  const ctxTech = document.getElementById('techChart').getContext('2d');
  if (techChartInstance) techChartInstance.destroy();

  const gradTeal = ctxTech.createLinearGradient(0, 0, 400, 0);
  gradTeal.addColorStop(0, 'rgba(20, 184, 166, 0.7)');
  gradTeal.addColorStop(1, 'rgba(13, 148, 136, 0.9)');

  techChartInstance = new Chart(ctxTech, {
    type: 'bar',
    data: {
      labels: topTechs.map(t => t.name.length > 18 ? t.name.substring(0, 18) + '…' : t.name),
      datasets: [
        {
          label: 'จำนวนงาน (ครั้ง)',
          data: topTechs.map(t => t.count),
          backgroundColor: gradTeal,
          borderRadius: 4,
          yAxisID: 'yCount',
          order: 2
        },
        {
          label: 'ค่าใช้จ่าย (บาท)',
          data: topTechs.map(t => t.cost),
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: 0.3,
          yAxisID: 'yCost',
          order: 1
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, font: { family: "'Prompt', sans-serif" } } },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          titleColor: '#1e293b', bodyColor: '#334155',
          borderColor: '#e2e8f0', borderWidth: 1,
          titleFont: { family: "'Prompt', sans-serif" },
          bodyFont: { family: "'Prompt', sans-serif" }
        }
      },
      scales: {
        x: { display: false },
        yCount: {
          type: 'linear', position: 'bottom',
          title: { display: true, text: 'จำนวนงาน', font: { family: "'Prompt', sans-serif" } },
          beginAtZero: true, grid: { color: '#f1f5f9' },
          ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } }
        },
        yCost: {
          type: 'linear', position: 'top',
          title: { display: true, text: 'ค่าใช้จ่าย (บาท)', font: { family: "'Prompt', sans-serif" } },
          beginAtZero: true, grid: { display: false },
          ticks: { font: { family: "'Prompt', sans-serif" } }
        },
        y: { grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif", size: 11 } } }
      }
    }
  });

  // กราฟผู้ส่งซ่อม (Horizontal Bar)
  const topReq = requesterData.slice(0, 10);
  const ctxReq = document.getElementById('requesterChart').getContext('2d');
  if (requesterChartInstance) requesterChartInstance.destroy();

  const gradPurple = ctxReq.createLinearGradient(0, 0, 400, 0);
  gradPurple.addColorStop(0, 'rgba(167, 139, 250, 0.7)');
  gradPurple.addColorStop(1, 'rgba(124, 58, 237, 0.9)');

  requesterChartInstance = new Chart(ctxReq, {
    type: 'bar',
    data: {
      labels: topReq.map(r => r.name.length > 18 ? r.name.substring(0, 18) + '…' : r.name),
      datasets: [{
        label: 'จำนวนครั้งที่ส่งซ่อม',
        data: topReq.map(r => r.count),
        backgroundColor: gradPurple,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          titleColor: '#1e293b', bodyColor: '#334155',
          borderColor: '#e2e8f0', borderWidth: 1,
          titleFont: { family: "'Prompt', sans-serif" },
          bodyFont: { family: "'Prompt', sans-serif" }
        }
      },
      scales: {
        x: {
          beginAtZero: true, grid: { color: '#f1f5f9' },
          ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } }
        },
        y: { grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif", size: 11 } } }
      }
    }
  });
}

// ─── ตารางช่างซ่อม ────────────────────────────────────────────────────────────

function renderTechTable(techData) {
  const query = (document.getElementById('techSearchInput')?.value || '').toLowerCase();
  const filtered = techData.filter(t => t.name.toLowerCase().includes(query));
  const tbody = document.getElementById('techTableBody');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">ไม่พบข้อมูลช่างซ่อม</td></tr>`;
    return;
  }

  filtered.forEach((t, i) => {
    const avgCost = t.count > 0 ? Math.round(t.cost / t.count) : 0;
    const topItems = [...new Set(t.items.map(it => it.equipName))].slice(0, 3).join(', ');
    const rankBadge = i === 0
      ? `<span class="inline-block w-5 h-5 rounded-full text-center leading-5 font-bold bg-amber-100 text-amber-800">${i + 1}</span>`
      : `<span class="inline-block w-5 h-5 rounded-full text-center leading-5 font-bold bg-slate-100 text-slate-600">${i + 1}</span>`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b';
    tr.innerHTML = `
      <td class="py-2.5 px-3">${rankBadge}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800">${t.name}</td>
      <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700">${t.count}</span></td>
      <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">${t.done}</span></td>
      <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700">${t.inprogress}</span></td>
      <td class="py-2.5 px-3 text-right font-semibold text-rose-600">${t.cost.toLocaleString()} บ.</td>
      <td class="py-2.5 px-3 text-right text-slate-600">${avgCost.toLocaleString()} บ.</td>
      <td class="py-2.5 px-3 text-slate-500 max-w-[12rem] truncate" title="${[...new Set(t.items.map(it => it.equipName))].join(', ')}">${topItems}${t.items.length > 3 ? ` +${[...new Set(t.items.map(it => it.equipName))].length - 3} รายการ` : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── ตารางผู้ส่งซ่อม ──────────────────────────────────────────────────────────

function renderRequesterTable(requesterData) {
  const query = (document.getElementById('requesterSearchInput')?.value || '').toLowerCase();
  const filtered = requesterData.filter(r => r.name.toLowerCase().includes(query));
  const tbody = document.getElementById('requesterTableBody');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">ไม่พบข้อมูลผู้ส่งซ่อม</td></tr>`;
    return;
  }

  filtered.forEach((r, i) => {
    const topItems = [...new Set(r.items.map(it => it.equipName))].slice(0, 3).join(', ');
    const allItems = [...new Set(r.items.map(it => it.equipName))];
    const rankBadge = i === 0
      ? `<span class="inline-block w-5 h-5 rounded-full text-center leading-5 font-bold bg-purple-200 text-purple-800">${i + 1}</span>`
      : `<span class="inline-block w-5 h-5 rounded-full text-center leading-5 font-bold bg-slate-100 text-slate-600">${i + 1}</span>`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b';
    tr.innerHTML = `
      <td class="py-2.5 px-3">${rankBadge}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800">${r.name}</td>
      <td class="py-2.5 px-3 text-slate-500 text-xs">${r.dept}</td>
      <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700">${r.count}</span></td>
      <td class="py-2.5 px-3 text-right font-semibold text-rose-600">${r.cost.toLocaleString()} บ.</td>
      <td class="py-2.5 px-3 text-slate-500 max-w-[14rem] truncate" title="${allItems.join(', ')}">${topItems}${allItems.length > 3 ? ` +${allItems.length - 3} รายการ` : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── รายละเอียดงานแต่ละช่าง (Accordion) ─────────────────────────────────────

function renderTechDetailList(techData) {
  const container = document.getElementById('techDetailList');
  container.innerHTML = '';

  if (techData.length === 0) {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-4">ยังไม่มีข้อมูลช่างซ่อม</p>`;
    return;
  }

  techData.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'border border-slate-200 rounded-xl overflow-hidden';

    const statusColors = {
      'เสร็จสิ้น': 'bg-emerald-100 text-emerald-800',
      'กำลังดำเนินการ': 'bg-blue-100 text-blue-800',
      'รออะไหล่/ช่างภายนอก': 'bg-amber-100 text-amber-800',
      'รอดำเนินการ': 'bg-slate-100 text-slate-700',
      'จำหน่ายออก': 'bg-rose-100 text-rose-800'
    };

    const rows = t.items.map(r => `
      <tr class="hover:bg-slate-50 border-b">
        <td class="py-2 px-3 font-mono text-teal-700 text-xs font-bold">${r.repairNo}</td>
        <td class="py-2 px-3 text-xs text-slate-500">${r.date}</td>
        <td class="py-2 px-3 text-xs font-medium">${r.equipName}</td>
        <td class="py-2 px-3 text-xs text-slate-500">${r.div}</td>
        <td class="py-2 px-3 text-xs text-slate-500 max-w-[10rem] truncate" title="${r.symptom}">${r.symptom}</td>
        <td class="py-2 px-3 text-xs">${r.requester || '-'}</td>
        <td class="py-2 px-3">
          <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[r.status] || 'bg-slate-100 text-slate-700'}">${r.status}</span>
        </td>
        <td class="py-2 px-3 text-xs text-right font-medium">${Number(r.cost).toLocaleString()} บ.</td>
      </tr>
    `).join('');

    div.innerHTML = `
      <button class="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-teal-50 transition text-left"
        onclick="this.nextElementSibling.classList.toggle('hidden')">
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold text-sm">${i + 1}</span>
          <div>
            <p class="font-semibold text-slate-800 text-sm">${t.name}</p>
            <p class="text-xs text-slate-500">${t.count} งาน | เสร็จ ${t.done} | ค่าใช้จ่ายรวม ${t.cost.toLocaleString()} บาท</p>
          </div>
        </div>
        <span class="text-slate-400 text-lg">▼</span>
      </button>
      <div class="hidden overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-teal-700 text-white">
            <tr>
              <th class="py-2 px-3">เลขที่</th>
              <th class="py-2 px-3">วันที่</th>
              <th class="py-2 px-3">ครุภัณฑ์</th>
              <th class="py-2 px-3">แผนก</th>
              <th class="py-2 px-3">อาการ</th>
              <th class="py-2 px-3">ผู้แจ้งซ่อม</th>
              <th class="py-2 px-3">สถานะ</th>
              <th class="py-2 px-3 text-right">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    container.appendChild(div);
  });
}

// ─── Main render entry point ──────────────────────────────────────────────────

function renderStaffDashboard() {
  const techData = buildTechData();
  const requesterData = buildRequesterData();
  renderStaffKPI(techData, requesterData);
  renderStaffCharts(techData, requesterData);
  renderStaffTables();
  renderTechDetailList(techData);
  if (typeof renderStaffManagementTable === 'function') {
    renderStaffManagementTable();
  }
}

function renderStaffTables() {
  const techData = buildTechData();
  const requesterData = buildRequesterData();
  renderTechTable(techData);
  renderRequesterTable(requesterData);
}

// ─── อัปเดต requester datalist ───────────────────────────────────────────────

// ─── อัปเดต requester datalist ───────────────────────────────────────────────

function updateRequesterDatalist() {
  const datalist = document.getElementById('requesterDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  const names = new Set();
  
  // นำชื่อจาก staffList ที่ระบุว่าเป็น requester มาร่วมด้วย
  if (typeof staffList !== 'undefined' && Array.isArray(staffList)) {
    staffList.filter(s => s.role === 'requester').forEach(s => {
      if (s.name) names.add(s.name.trim());
    });
  }

  // นำชื่อจากประวัติการส่งซ่อม repairs[]
  repairs.forEach(r => {
    if (r.requester && r.requester.trim()) names.add(r.requester.trim());
  });

  Array.from(names).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    datalist.appendChild(opt);
  });
}

// ─── Export Excel สำหรับเจ้าหน้าที่ ─────────────────────────────────────────

function exportStaffToExcel() {
  if (typeof XLSX === 'undefined') { alert('ไม่สามารถโหลดโมดูล Excel ได้'); return; }
  if (repairs.length === 0) { alert('ยังไม่มีข้อมูล'); return; }

  const wb = XLSX.utils.book_new();
  const todayStr = new Date().toISOString().split('T')[0];

  // Sheet 1: ช่างซ่อม
  const techData = buildTechData();
  const techRows = techData.map((t, i) => ({
    'อันดับ': i + 1,
    'ชื่อช่างซ่อม': t.name,
    'จำนวนงานทั้งหมด': t.count,
    'งานเสร็จสิ้น': t.done,
    'งานกำลังดำเนินการ': t.inprogress,
    'ค่าใช้จ่ายรวม (บาท)': t.cost,
    'ค่าใช้จ่ายเฉลี่ย/งาน (บาท)': t.count > 0 ? Math.round(t.cost / t.count) : 0
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(techRows), 'ช่างซ่อม');

  // Sheet 2: รายละเอียดงานช่าง
  const techDetailRows = [];
  techData.forEach(t => {
    t.items.forEach(r => {
      techDetailRows.push({
        'ช่างซ่อม': t.name,
        'เลขที่ใบส่งซ่อม': r.repairNo,
        'วันที่': r.date,
        'แผนก': r.div,
        'ครุภัณฑ์': r.equipName,
        'อาการ': r.symptom,
        'ผู้แจ้งซ่อม': r.requester || '-',
        'สถานะ': r.status,
        'ค่าใช้จ่าย (บาท)': Number(r.cost) || 0
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(techDetailRows), 'รายละเอียดงานช่าง');

  // Sheet 3: ผู้ส่งซ่อม
  const requesterData = buildRequesterData();
  const reqRows = requesterData.map((r, i) => ({
    'อันดับ': i + 1,
    'ชื่อผู้ส่งซ่อม': r.name,
    'แผนก': r.dept,
    'ส่งซ่อมทั้งหมด (ครั้ง)': r.count,
    'ค่าใช้จ่ายรวม (บาท)': r.cost,
    'รายการที่ส่งซ่อม': [...new Set(r.items.map(it => it.equipName))].join(', ')
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reqRows), 'ผู้ส่งซ่อม');

  XLSX.writeFile(wb, `รายงานเจ้าหน้าที่_รพ_พยุหะคีรี_${todayStr}.xlsx`);
}

// ─── Export PPT สำหรับผู้บริหาร ──────────────────────────────────────────────

function exportStaffToPPT() {
  if (typeof PptxGenJS === 'undefined') { alert('ไม่สามารถโหลดโมดูล PowerPoint ได้'); return; }

  const todayStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const techData = buildTechData();
  const requesterData = buildRequesterData();
  const totalJobs = repairs.length;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // ── Slide 1: ปก ──────────────────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.background = { color: '0F766E' };
  s1.addText('รายงานสรุปผลการปฏิบัติงานเจ้าหน้าที่', {
    x: 0.8, y: 1.6, w: 8.5, h: 1.0,
    fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Prompt'
  });
  s1.addText('ช่างซ่อม & ผู้แจ้งซ่อม', {
    x: 0.8, y: 2.7, w: 8.5, h: 0.6,
    fontSize: 18, color: 'CCFBF1', fontFace: 'Prompt'
  });
  s1.addText(`โรงพยาบาลพยุหะคีรี จ.นครสวรรค์\nจัดทำเมื่อ: ${todayStr}`, {
    x: 0.8, y: 3.5, w: 8.5, h: 1.0,
    fontSize: 14, color: 'A7F3D0', fontFace: 'Prompt', lineSpacing: 22
  });

  // ── Slide 2: KPI ──────────────────────────────────────────────────────────────
  const s2 = pptx.addSlide();
  s2.addText('ภาพรวมสรุปเจ้าหน้าที่', {
    x: 0.6, y: 0.4, w: 9, h: 0.55,
    fontSize: 20, bold: true, color: '0F766E', fontFace: 'Prompt'
  });

  const kpiItems = [
    { title: 'ช่างซ่อมทั้งหมด', val: `${techData.length} คน`, color: '0D9488' },
    { title: 'งานซ่อมทั้งหมด', val: `${totalJobs} งาน`, color: '3B82F6' },
    { title: 'ช่างที่ซ่อมมากสุด', val: techData.length > 0 ? `${techData[0].name}\n(${techData[0].count} งาน)` : '-', color: 'D97706' },
    { title: 'ผู้ส่งซ่อมทั้งหมด', val: `${requesterData.length} คน`, color: '7C3AED' }
  ];
  kpiItems.forEach((item, idx) => {
    const posX = 0.6 + idx * 2.25;
    s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: posX, y: 1.1, w: 2.1, h: 1.5,
      fill: { color: 'F8FAFC' }, line: { color: item.color, width: 2 }
    });
    s2.addText(item.title, { x: posX, y: 1.2, w: 2.1, h: 0.35, fontSize: 10, color: '64748B', align: 'center', fontFace: 'Prompt' });
    s2.addText(item.val,   { x: posX, y: 1.6, w: 2.1, h: 0.8, fontSize: 13, bold: true, color: item.color, align: 'center', fontFace: 'Prompt' });
  });

  if (techChartInstance) {
    s2.addImage({ data: techChartInstance.toBase64Image(), x: 0.6, y: 2.85, w: 8.8, h: 2.6 });
  }

  // ── Slide 3: ตารางช่างซ่อม Top 10 ───────────────────────────────────────────
  const s3 = pptx.addSlide();
  s3.addText('สรุปภาระงานช่างซ่อม (Top 10)', {
    x: 0.6, y: 0.3, w: 9, h: 0.55,
    fontSize: 20, bold: true, color: '0F766E', fontFace: 'Prompt'
  });

  const techHeaders = [
    { text: 'อันดับ', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'center' } },
    { text: 'ชื่อช่างซ่อม', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
    { text: 'งาน (ครั้ง)', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'center' } },
    { text: 'เสร็จสิ้น', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'center' } },
    { text: 'ค่าใช้จ่ายรวม (บ.)', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'right' } },
    { text: 'เฉลี่ย/งาน (บ.)', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'right' } }
  ];
  const techRows = techData.slice(0, 10).map((t, i) => [
    { text: `${i + 1}`, options: { align: 'center' } },
    { text: t.name },
    { text: `${t.count}`, options: { align: 'center' } },
    { text: `${t.done}`, options: { align: 'center' } },
    { text: t.cost.toLocaleString(), options: { align: 'right' } },
    { text: (t.count > 0 ? Math.round(t.cost / t.count) : 0).toLocaleString(), options: { align: 'right' } }
  ]);
  s3.addTable([techHeaders, ...techRows], {
    x: 0.6, y: 1.1, w: 8.8,
    fontSize: 9, fontFace: 'Prompt',
    border: { color: 'CBD5E1', pt: 0.5 },
    rowH: 0.32
  });

  // ── Slide 4: กราฟผู้ส่งซ่อม ─────────────────────────────────────────────────
  const s4 = pptx.addSlide();
  s4.addText('สรุปการส่งซ่อมแยกตามผู้แจ้ง (Top 10)', {
    x: 0.6, y: 0.3, w: 9, h: 0.55,
    fontSize: 20, bold: true, color: '7C3AED', fontFace: 'Prompt'
  });

  if (requesterChartInstance) {
    s4.addImage({ data: requesterChartInstance.toBase64Image(), x: 0.6, y: 1.0, w: 5.2, h: 3.5 });
  }

  const reqHeaders = [
    { text: 'อันดับ', options: { bold: true, fill: '7C3AED', color: 'FFFFFF', align: 'center' } },
    { text: 'ชื่อผู้แจ้งซ่อม', options: { bold: true, fill: '7C3AED', color: 'FFFFFF' } },
    { text: 'แผนก', options: { bold: true, fill: '7C3AED', color: 'FFFFFF' } },
    { text: 'ส่งซ่อม (ครั้ง)', options: { bold: true, fill: '7C3AED', color: 'FFFFFF', align: 'center' } },
    { text: 'ค่าใช้จ่าย (บ.)', options: { bold: true, fill: '7C3AED', color: 'FFFFFF', align: 'right' } }
  ];
  const reqRows = requesterData.slice(0, 10).map((r, i) => [
    { text: `${i + 1}`, options: { align: 'center' } },
    { text: r.name },
    { text: r.dept.split(',')[0] },
    { text: `${r.count}`, options: { align: 'center' } },
    { text: r.cost.toLocaleString(), options: { align: 'right' } }
  ]);
  s4.addTable([reqHeaders, ...reqRows], {
    x: 6.1, y: 1.0, w: 3.3,
    fontSize: 9, fontFace: 'Prompt',
    border: { color: 'CBD5E1', pt: 0.5 },
    rowH: 0.3
  });

  // ── Slide 5: รายละเอียดงานช่างรายคน ─────────────────────────────────────────
  techData.slice(0, 8).forEach((t, tIdx) => {
    const sDetail = pptx.addSlide();
    sDetail.addText(`รายละเอียดงาน: ${t.name}`, {
      x: 0.5, y: 0.25, w: 9, h: 0.5,
      fontSize: 16, bold: true, color: '0F766E', fontFace: 'Prompt'
    });
    sDetail.addText(`งานทั้งหมด ${t.count} รายการ | เสร็จสิ้น ${t.done} | ค่าใช้จ่ายรวม ${t.cost.toLocaleString()} บาท`, {
      x: 0.5, y: 0.8, w: 9, h: 0.35,
      fontSize: 11, color: '475569', fontFace: 'Prompt'
    });

    const detailHeader = [
      { text: 'เลขที่', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
      { text: 'วันที่', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
      { text: 'ครุภัณฑ์', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
      { text: 'แผนก', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
      { text: 'ผู้แจ้ง', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
      { text: 'สถานะ', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
      { text: 'ค่าใช้จ่าย (บ.)', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'right' } }
    ];
    const detailRows = t.items.slice(0, 12).map(r => [
      { text: r.repairNo },
      { text: r.date },
      { text: r.equipName.length > 20 ? r.equipName.substring(0, 20) + '…' : r.equipName },
      { text: r.div.length > 15 ? r.div.substring(0, 15) + '…' : r.div },
      { text: r.requester || '-' },
      { text: r.status },
      { text: Number(r.cost).toLocaleString(), options: { align: 'right' } }
    ]);
    sDetail.addTable([detailHeader, ...detailRows], {
      x: 0.5, y: 1.25, w: 9,
      fontSize: 8, fontFace: 'Prompt',
      border: { color: 'CBD5E1', pt: 0.5 },
      rowH: 0.28
    });
  });

  const fileName = `รายงานเจ้าหน้าที่_รพ_พยุหะคีรี_${new Date().toISOString().split('T')[0]}.pptx`;
  pptx.writeFile({ fileName });
}

// ─── Staff Management (จัดการรายชื่อเจ้าหน้าที่) ─────────────────────────────

/**
 * เปิด modal เพิ่ม/แก้ไขเจ้าหน้าที่
 * @param {string|null} staffId  ถ้า null = เพิ่มใหม่
 */
function openStaffModal(staffId = null) {
  const modal = document.getElementById('staffModal');
  if (!modal) return;

  document.getElementById('staffModalTitle').innerText = staffId ? 'แก้ไขข้อมูลเจ้าหน้าที่' : 'เพิ่มเจ้าหน้าที่ใหม่';
  document.getElementById('staffEditId').value = staffId || '';
  document.getElementById('staffFormName').value = '';
  document.getElementById('staffFormRole').value = 'technician';
  document.getElementById('staffFormDept').value = '';

  if (staffId) {
    const found = staffList.find(s => s.id === staffId);
    if (found) {
      document.getElementById('staffFormName').value = found.name;
      document.getElementById('staffFormRole').value = found.role;
      document.getElementById('staffFormDept').value = found.dept || '';
    }
  }

  modal.classList.remove('hidden');
  document.getElementById('staffFormName').focus();
}

function closeStaffModal() {
  const modal = document.getElementById('staffModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * บันทึกเจ้าหน้าที่ลง Firebase + local
 */
async function saveStaffMember(e) {
  e.preventDefault();

  const editId   = document.getElementById('staffEditId').value;
  const name     = document.getElementById('staffFormName').value.trim();
  const role     = document.getElementById('staffFormRole').value;
  const dept     = document.getElementById('staffFormDept').value.trim();

  if (!name) { alert('กรุณาระบุชื่อ-นามสกุล'); return; }

  const id = editId || `staff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const staffData = { id, name, role, dept };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังบันทึก...'; }

  let ok = true;
  if (window.isFirebaseReady) {
    ok = await window.saveStaffToCloud(staffData);
  } else {
    // fallback local
    const idx = staffList.findIndex(s => s.id === id);
    if (idx >= 0) staffList[idx] = staffData;
    else staffList.push(staffData);
    saveStaff(staffList);
    _afterStaffUpdate();
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'บันทึก'; }

  if (!ok) {
    alert('❌ บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ');
    return;
  }
  closeStaffModal();
}

/**
 * ลบเจ้าหน้าที่
 */
async function deleteStaffMember(staffId) {
  const found = staffList.find(s => s.id === staffId);
  if (!found) return;
  const roleText = found.role === 'technician' ? 'ช่างซ่อม' : 'ผู้ส่งซ่อม';
  if (!confirm(`ต้องการลบ "${found.name}" (${roleText}) ออกจากระบบหรือไม่?`)) return;

  if (window.isFirebaseReady) {
    const ok = await window.deleteStaffFromCloud(staffId);
    if (!ok) { alert('❌ ลบไม่สำเร็จ'); return; }
  } else {
    staffList = staffList.filter(s => s.id !== staffId);
    saveStaff(staffList);
    _afterStaffUpdate();
  }
}

/** อัปเดต technicians + datalist + ตาราง หลังแก้ local */
function _afterStaffUpdate() {
  technicians = staffList.filter(s => s.role === 'technician').map(s => s.name);
  saveTechnicians(technicians);
  if (typeof renderTechnicianBadges === 'function') renderTechnicianBadges();
  if (typeof updateRequesterDatalist === 'function') updateRequesterDatalist();
  renderStaffManagementTable();
}

/**
 * เรนเดอร์ตารางรายชื่อเจ้าหน้าที่ใน section-staff
 */
function renderStaffManagementTable() {
  const tbody = document.getElementById('staffManagementBody');
  if (!tbody) return;

  const roleFilter  = document.getElementById('staffFilterRole')?.value || 'all';
  const searchQuery = (document.getElementById('staffSearchManage')?.value || '').toLowerCase();

  let list = [...staffList];
  if (roleFilter !== 'all') list = list.filter(s => s.role === roleFilter);
  if (searchQuery) list = list.filter(s =>
    s.name.toLowerCase().includes(searchQuery) ||
    (s.dept || '').toLowerCase().includes(searchQuery)
  );

  // เรียงชื่อ
  list.sort((a, b) => a.name.localeCompare(b.name, 'th'));

  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">
      ยังไม่มีรายชื่อเจ้าหน้าที่ กด "+ เพิ่มเจ้าหน้าที่" เพื่อเริ่มต้น
    </td></tr>`;
    return;
  }

  list.forEach(s => {
    const roleLabel = s.role === 'technician'
      ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">🔧 ช่างซ่อม</span>`
      : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">📋 ผู้ส่งซ่อม</span>`;

    // นับงานจาก repairs[]
    const jobCount = s.role === 'technician'
      ? repairs.filter(r => (r.assignee || '').trim() === s.name).length
      : repairs.filter(r => (r.requester || '').trim() === s.name).length;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b transition-colors';
    tr.innerHTML = `
      <td class="py-3 px-4 font-semibold text-slate-800">${s.name}</td>
      <td class="py-3 px-4">${roleLabel}</td>
      <td class="py-3 px-4 text-slate-500 text-sm">${s.dept || '-'}</td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded-full font-bold text-xs ${s.role === 'technician' ? 'bg-teal-50 text-teal-700' : 'bg-purple-50 text-purple-700'}">${jobCount} ครั้ง</span>
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex justify-center gap-2">
          <button onclick="openStaffModal('${s.id}')" class="text-xs text-teal-600 hover:text-teal-800 font-medium">แก้ไข</button>
          <button onclick="deleteStaffMember('${s.id}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium">ลบ</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // อัปเดต summary
  const techCount = staffList.filter(s => s.role === 'technician').length;
  const reqCount  = staffList.filter(s => s.role === 'requester').length;
  const summaryEl = document.getElementById('staffManageSummary');
  if (summaryEl) summaryEl.innerText = `ช่างซ่อม ${techCount} คน | ผู้ส่งซ่อม ${reqCount} คน`;
}


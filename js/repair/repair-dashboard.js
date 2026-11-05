/**
 * dashboard.js
 * จัดการสถิติ กราฟ แดชบอร์ด และระบบ Pagination / Search สำหรับครุภัณฑ์ที่มีจำนวนมาก
 */

let trendChartInstance = null;
let categoryChartInstance = null;
let deptChartInstance = null;
let tableDeptCostChartInstance = null;
let tableEquipCountChartInstance = null;

// สถานะการแบ่งหน้าตารางครุภัณฑ์ในแดชบอร์ด
let currentEquipPage = 1;
let cachedSortedDepts = [];
let cachedSortedEquips = [];

// Helper: Parse date string (DD/MM/YYYY พ.ศ. หรือ YYYY-MM-DD ค.ศ.) → Date object
function _dashParseDate(s) {
  if (!s) return null;
  const t = String(s).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  const i = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (t) {
    let y = Number(t[3]);
    if (y > 2400) y -= 543;
    return new Date(y, Number(t[2]) - 1, Number(t[1]));
  }
  if (i) return new Date(Number(i[1]), Number(i[2]) - 1, Number(i[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function _dashFormatBE(s) {
  if (!s) return '';
  const d = _dashParseDate(s);
  if (!d) return String(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
}

function renderDashboard() {
  const periodMode = document.getElementById('dashboardPeriod')?.value || 'monthly';
  const fyFilter = document.getElementById('dashboardFiscalYearFilter')?.value || 'current';
  const currentFY = (typeof getThaiFiscalYear === 'function') ? getThaiFiscalYear() : new Date().getFullYear() + 543;

  // ซิงค์ค่าไปยังตัวกรองในแท็บแผนก/ครุภัณฑ์ด้วย
  const tableFyEl = document.getElementById('tableFiscalYearFilter');
  if (tableFyEl && tableFyEl.value !== fyFilter) {
    tableFyEl.value = fyFilter;
  }

  // กรองรายการซ่อมตามปีงบประมาณที่เลือก
  const filteredRepairs = repairs.filter(r => {
    if (fyFilter === 'all') return true;
    const targetFY = fyFilter === 'current' ? currentFY : parseInt(fyFilter, 10);
    const itemFY = (typeof getRepairFiscalYear === 'function') ? getRepairFiscalYear(r) : currentFY;
    return itemFY === targetFY;
  });
  
  // 1. คำนวณ KPI
  const totalRepairs = filteredRepairs.length;
  const completedList = filteredRepairs.filter(r => r.status === 'เสร็จสิ้น');
  const completed = completedList.length;
  const pendingList = filteredRepairs.filter(r => ['กำลังดำเนินการ', 'รอดำเนินการ', 'รออะไหล่/ช่างภายนอก'].includes(r.status));
  const pending = pendingList.length;
  const totalCost = filteredRepairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

  // คำนวณระยะเวลาซ่อมเฉลี่ย (วัน) สำหรับรายการที่เสร็จสิ้น
  let totalRepairDays = 0;
  let countWithDuration = 0;
  completedList.forEach(r => {
    if (r.date) {
      const startDate = _dashParseDate(r.date);
      if (startDate) {
        const endDate = r.completedDate ? (_dashParseDate(r.completedDate) || startDate) : startDate;
        const diffTime = Math.max(0, endDate - startDate);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        totalRepairDays += diffDays;
        countWithDuration++;
      }
    }
  });
  const avgRepairDays = countWithDuration > 0 ? (totalRepairDays / countWithDuration).toFixed(1) : 0;

  // ตรวจสอบงานที่ค้างซ่อมเกิน 7 วัน
  const now = new Date();
  const overdueCount = pendingList.filter(r => {
    if (!r.date) return false;
    const reqDate = _dashParseDate(r.date);
    if (!reqDate) return false;
    const diffDays = Math.floor((now - reqDate) / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  }).length;

  document.getElementById('kpi-total-repairs').innerText = `${totalRepairs.toLocaleString()} ครั้ง`;
  document.getElementById('kpi-repair-status-sub').innerText = `เสร็จสิ้น ${completed} | กำลังซ่อม ${pending}`;
  document.getElementById('kpi-total-cost').innerText = `${totalCost.toLocaleString()} บาท`;

  const avgTimeEl = document.getElementById('kpi-avg-repair-time');
  if (avgTimeEl) avgTimeEl.innerText = `${avgRepairDays} วัน`;

  const slaSubEl = document.getElementById('kpi-sla-rate-sub');
  if (slaSubEl) {
    if (overdueCount > 0) {
      slaSubEl.innerHTML = `<span class="text-rose-200 font-bold">⚠️ ค้างเกิน 7 วัน: ${overdueCount} งาน</span>`;
    } else {
      slaSubEl.innerText = `งานค้างเกิน 7 วัน: 0 งาน 👍`;
    }
  }

  // 2. จัดกลุ่มสรุป แผนก & ครุภัณฑ์
  const deptMap = {};
  const equipMap = {};

  filteredRepairs.forEach(r => {
    const cost = Number(r.cost) || 0;
    const deptName = r.div ? r.div.trim() : 'ไม่ระบุแผนก';
    const equipName = r.equipName ? r.equipName.trim() : 'ไม่ระบุชื่อครุภัณฑ์';

    if (!deptMap[deptName]) {
      deptMap[deptName] = { count: 0, cost: 0 };
    }
    deptMap[deptName].count += 1;
    deptMap[deptName].cost += cost;

    if (!equipMap[equipName]) {
      equipMap[equipName] = { count: 0, cost: 0, divs: new Set(), category: r.category };
    }
    equipMap[equipName].count += 1;
    equipMap[equipName].cost += cost;
    equipMap[equipName].divs.add(deptName);
  });

  cachedSortedDepts = Object.keys(deptMap).map(name => ({
    name,
    count: deptMap[name].count,
    cost: deptMap[name].cost,
    pct: totalRepairs > 0 ? ((deptMap[name].count / totalRepairs) * 100).toFixed(1) : 0
  })).sort((a, b) => b.count - a.count || b.cost - a.cost);

  cachedSortedEquips = Object.keys(equipMap).map(name => ({
    name,
    count: equipMap[name].count,
    cost: equipMap[name].cost,
    avgCost: equipMap[name].count > 0 ? Math.round(equipMap[name].cost / equipMap[name].count) : 0,
    divs: Array.from(equipMap[name].divs).join(', ')
  })).sort((a, b) => b.cost - a.cost || b.count - a.count);

  // อันดับ 1 KPI
  if (cachedSortedDepts.length > 0) {
    const topDept = cachedSortedDepts[0];
    document.getElementById('kpi-top-dept').innerText = topDept.name;
    document.getElementById('kpi-top-dept-sub').innerText = `${topDept.count} ครั้ง (${topDept.cost.toLocaleString()} บ.)`;
  } else {
    document.getElementById('kpi-top-dept').innerText = '-';
    document.getElementById('kpi-top-dept-sub').innerText = '0 ครั้ง (0 บาท)';
  }

  if (cachedSortedEquips.length > 0) {
    const topEquip = cachedSortedEquips[0];
    document.getElementById('kpi-top-equip').innerText = topEquip.name;
    document.getElementById('kpi-top-equip-sub').innerText = `งบซ่อม ${topEquip.cost.toLocaleString()} บาท (${topEquip.count} ครั้ง)`;
  } else {
    document.getElementById('kpi-top-equip').innerText = '-';
    document.getElementById('kpi-top-equip-sub').innerText = 'งบซ่อม 0 บาท';
  }

  // อัปเดตกล่องเฝ้าระวังแทงจำหน่าย (Disposal Watchlist)
  renderDisposalWatchlist(filteredRepairs);

  // เรนเดอร์ตารางสรุป
  renderDashboardTables();

  // 3. กราฟช่วงเวลา
  const groupData = {};
  filteredRepairs.forEach(r => {
    if (!r.date) return;
    const d = _dashParseDate(r.date);
    if (!d) return;
    const yearBE = d.getFullYear() + 543;
    let key = '';

    if (periodMode === 'monthly') {
      key = `${yearBE}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (periodMode === 'quarterly') {
      const quarter = Math.ceil((d.getMonth() + 1) / 3);
      key = `ปี ${yearBE} ไตรมาส ${quarter}`;
    } else {
      key = `ปี ${yearBE}`;
    }

    if (!groupData[key]) groupData[key] = { count: 0, cost: 0 };
    groupData[key].count += 1;
    groupData[key].cost += Number(r.cost) || 0;
  });

  const sortedKeys = Object.keys(groupData).sort();
  const counts = sortedKeys.map(k => groupData[k].count);
  const costs = sortedKeys.map(k => groupData[k].cost);

    const ctxTrend = document.getElementById('trendChart').getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();

  // Create Gradients
  const gradBlue = ctxTrend.createLinearGradient(0, 0, 0, 400);
  gradBlue.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // blue-500
  gradBlue.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  const gradGreen = ctxTrend.createLinearGradient(0, 0, 0, 400);
  gradGreen.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // emerald-500
  gradGreen.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  trendChartInstance = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: sortedKeys.length > 0 ? sortedKeys : ['ไม่มีข้อมูล'],
      datasets: [
        {
          label: 'จำนวนครั้งส่งซ่อม (ครั้ง)',
          data: counts,
          borderColor: '#10b981', // emerald-500
          backgroundColor: gradGreen,
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#10b981',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          yAxisID: 'yCount',
          order: 2
        },
        {
          label: 'ค่าใช้จ่ายรวม (บาท)',
          data: costs,
          borderColor: '#3b82f6', // blue-500
          backgroundColor: gradBlue,
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          yAxisID: 'yCost',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Prompt', sans-serif" } }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          titleFont: { family: "'Prompt', sans-serif", size: 13 },
          bodyFont: { family: "'Prompt', sans-serif", size: 12 }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Prompt', sans-serif" } }
        },
        yCount: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'จำนวนครั้ง', font: { family: "'Prompt', sans-serif" } },
          beginAtZero: true,
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } }
        },
        yCost: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'ค่าใช้จ่าย (บาท)', font: { family: "'Prompt', sans-serif" } },
          beginAtZero: true,
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Prompt', sans-serif" } }
        }
      }
    }
  });

  // วิเคราะห์แนวโน้มฤดูกาล (Seasonality & Trend Insights)
  const seasonEl = document.getElementById('seasonalityText');
  if (seasonEl) {
    if (sortedKeys.length >= 2) {
      const lastKey = sortedKeys[sortedKeys.length - 1];
      const prevKey = sortedKeys[sortedKeys.length - 2];
      const lastCount = groupData[lastKey]?.count || 0;
      const prevCount = groupData[prevKey]?.count || 0;
      const diffPct = prevCount > 0 ? Math.round(((lastCount - prevCount) / prevCount) * 100) : 0;
      
      let trendIcon = '➡️';
      let trendWord = 'ทรงตัว';
      if (diffPct > 0) {
        trendIcon = '📈';
        trendWord = `เพิ่มขึ้น +${diffPct}% จากช่วงก่อนหน้า`;
      } else if (diffPct < 0) {
        trendIcon = '📉';
        trendWord = `ลดลง ${diffPct}% จากช่วงก่อนหน้า`;
      }
      seasonEl.innerHTML = `${trendIcon} ${lastKey}: <strong>${lastCount} ครั้ง</strong> (${trendWord})`;
    } else if (sortedKeys.length === 1) {
      seasonEl.innerHTML = `📊 ข้อมูลช่วงล่าสุด: <strong>${groupData[sortedKeys[0]].count} ครั้ง</strong>`;
    } else {
      seasonEl.innerHTML = `ยังไม่มีข้อมูลเพียงพอสำหรับประเมินแนวโน้ม`;
    }
  }

  // กราฟสัดส่วนประเภท
  const categoryCosts = {};
  filteredRepairs.forEach(r => {
    categoryCosts[r.category] = (categoryCosts[r.category] || 0) + (Number(r.cost) || 0);
  });

  let catLabels = Object.keys(categoryCosts);
  let catValues = Object.values(categoryCosts);
  const sumCost = catValues.reduce((sum, val) => sum + val, 0);

  let bgColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

  // ถ้าผลรวมค่าใช้จ่ายเป็น 0 กราฟโดนัทจะไม่วาดตัวเอง เลยต้องกำหนดค่าจำลองเป็น 1 พร้อมสีเทา
  if (catLabels.length === 0 || sumCost === 0) {
    catLabels = ['ยังไม่มีข้อมูลค่าใช้จ่าย'];
    catValues = [1];
    bgColors = ['#e2e8f0']; 
  }

  const ctxCat = document.getElementById('categoryChart').getContext('2d');
  if (categoryChartInstance) categoryChartInstance.destroy();

  categoryChartInstance = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: { 
        legend: { 
          position: 'right',
          labels: { usePointStyle: true, boxWidth: 8, padding: 15, font: { family: "'Prompt', sans-serif", size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          usePointStyle: true
        }
      }
    }
  });

  // กราฟจำนวนครั้งแยกตามแผนก (Horizontal Bar)
  const topDepts = cachedSortedDepts.slice(0, 10);
  const deptLabels = topDepts.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);
  const deptCounts = topDepts.map(d => d.count);
  const maxCount = Math.max(...deptCounts, 1); // For scaling

  const ctxDept = document.getElementById('deptChart').getContext('2d');
  if (deptChartInstance) deptChartInstance.destroy();
  
  // Create gradient for bars
  const gradPurple = ctxDept.createLinearGradient(0, 0, 400, 0);
  gradPurple.addColorStop(0, 'rgba(167, 139, 250, 0.8)'); // purple-400
  gradPurple.addColorStop(1, 'rgba(124, 58, 237, 0.8)');  // purple-600

  deptChartInstance = new Chart(ctxDept, {
    type: 'bar',
    data: {
      labels: deptLabels.length > 0 ? deptLabels : ['ยังไม่มีข้อมูล'],
      datasets: [{
        label: 'จำนวนครั้งส่งซ่อม',
        data: deptCounts.length > 0 ? deptCounts : [0],
        backgroundColor: gradPurple,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          titleFont: { family: "'Prompt', sans-serif", size: 13 },
          bodyFont: { family: "'Prompt', sans-serif", size: 12 }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } },
          min: 0,
          max: maxCount + (maxCount * 0.2) // Add some padding to the right
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Prompt', sans-serif", size: 11 } }
        }
      }
    }
  });
} // End of renderDashboard

// ฟังก์ชันเรนเดอร์ตารางสรุปแบบมี Pagination และ Search ป้องกันปัญหาหน้ายาวเกินไป
function renderDashboardTables() {
  // 1. เรนเดอร์ฝั่งแผนก (พร้อมค้นหา)
  const deptQuery = (document.getElementById('deptSearchInput')?.value || '').toLowerCase();
  const filteredDepts = cachedSortedDepts.filter(d => d.name.toLowerCase().includes(deptQuery));
  
  const deptTbody = document.getElementById('deptSummaryTableBody');
  deptTbody.innerHTML = '';
  document.getElementById('dept-summary-count').innerText = `${filteredDepts.length} แผนก`;

  filteredDepts.forEach((dept, index) => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-teal-50/60 border-b cursor-pointer transition-colors group";
    tr.onclick = () => openDeptDetailModal(dept.name);
    let rankBadge = `<span class="inline-block w-5 h-5 rounded-full text-center leading-5 font-bold ${index === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">${index + 1}</span>`;
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-medium">${rankBadge}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
        <span>${dept.name}</span>
        <span class="opacity-0 group-hover:opacity-100 text-[11px] text-teal-600 font-normal transition">🔍 ดูใบซ่อม</span>
      </td>
      <td class="py-2.5 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
          ${dept.count} ใบ
        </span>
      </td>
      <td class="py-2.5 px-3 text-right font-medium text-slate-700">${dept.cost.toLocaleString()} บ.</td>
      <td class="py-2.5 px-3 text-right text-slate-500">${dept.pct}%</td>
    `;
    deptTbody.appendChild(tr);
  });

  // 2. เรนเดอร์ฝั่งครุภัณฑ์ (มี Search + Pagination)
  const equipQuery = (document.getElementById('equipSearchInput')?.value || '').toLowerCase();
  const filteredEquips = cachedSortedEquips.filter(e => 
    e.name.toLowerCase().includes(equipQuery) || 
    e.divs.toLowerCase().includes(equipQuery)
  );

  const pageSize = parseInt(document.getElementById('equipPageSize')?.value || '10');
  const totalItems = filteredEquips.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (currentEquipPage > totalPages) currentEquipPage = totalPages;
  if (currentEquipPage < 1) currentEquipPage = 1;

  const startIdx = (currentEquipPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pagedEquips = filteredEquips.slice(startIdx, endIdx);

  const equipTbody = document.getElementById('equipSummaryTableBody');
  equipTbody.innerHTML = '';
  document.getElementById('equip-summary-count').innerText = `${totalItems} รายการ`;

  if (pagedEquips.length === 0) {
    equipTbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">ไม่พบครุภัณฑ์ตามที่ระบุ</td></tr>`;
  } else {
    pagedEquips.forEach(eq => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 border-b";
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-semibold text-slate-800">${eq.name}</td>
        <td class="py-2.5 px-3 text-slate-500 max-w-[12rem] truncate" title="${eq.divs}">${eq.divs}</td>
        <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700">${eq.count}</span></td>
        <td class="py-2.5 px-3 text-right font-semibold text-rose-600">${eq.cost.toLocaleString()} บ.</td>
        <td class="py-2.5 px-3 text-right text-slate-600">${eq.avgCost.toLocaleString()} บ.</td>
      `;
      equipTbody.appendChild(tr);
    });
  }

  // อัปเดตข้อมูลแบ่งหน้า
  const infoEl = document.getElementById('equipPaginationInfo');
  if (infoEl) {
    infoEl.innerText = totalItems > 0 ? `${startIdx + 1}-${endIdx} จาก ${totalItems}` : '0 จาก 0';
  }
  const btnPrev = document.getElementById('btnEquipPrev');
  const btnNext = document.getElementById('btnEquipNext');
  if (btnPrev) btnPrev.disabled = (currentEquipPage <= 1);
  if (btnNext) btnNext.disabled = (currentEquipPage >= totalPages);

  // 3. อัปเดต KPI Cards & Charts สำหรับหน้า แผนก/ครุภัณฑ์
  renderTableSectionKPIAndCharts();
}

function renderTableSectionKPIAndCharts() {
  // KPI Cards
  const deptCountEl = document.getElementById('table-kpi-dept-count');
  if (deptCountEl) deptCountEl.innerText = `${cachedSortedDepts.length} แผนก`;

  const equipCountEl = document.getElementById('table-kpi-equip-count');
  const equipSubEl = document.getElementById('table-kpi-equip-sub');
  const totalRepairCount = cachedSortedEquips.reduce((sum, eq) => sum + eq.count, 0);
  if (equipCountEl) equipCountEl.innerText = `${cachedSortedEquips.length} ชนิด`;
  if (equipSubEl) equipSubEl.innerText = `รวมส่งซ่อม ${totalRepairCount} ครั้ง`;

  const topDept = cachedSortedDepts[0];
  const topDeptEl = document.getElementById('table-kpi-top-dept');
  const topDeptSubEl = document.getElementById('table-kpi-top-dept-sub');
  if (topDeptEl && topDept) {
    topDeptEl.innerText = topDept.name;
    topDeptEl.title = topDept.name;
    if (topDeptSubEl) topDeptSubEl.innerText = `${topDept.count} ครั้ง (${topDept.cost.toLocaleString()} บ.)`;
  }

  // หาสุดยอดครุภัณฑ์ที่ใช้งบสูงสุด (sort by cost)
  const equipsSortedByCost = [...cachedSortedEquips].sort((a, b) => b.cost - a.cost);
  const topEquip = equipsSortedByCost[0];
  const topEquipEl = document.getElementById('table-kpi-top-equip');
  const topEquipSubEl = document.getElementById('table-kpi-top-equip-sub');
  if (topEquipEl && topEquip) {
    topEquipEl.innerText = topEquip.name;
    topEquipEl.title = topEquip.name;
    if (topEquipSubEl) topEquipSubEl.innerText = `งบซ่อม ${topEquip.cost.toLocaleString()} บ. (${topEquip.count} ครั้ง)`;
  }

  // Chart 1: สัดส่วนค่าใช้จ่ายตามแผนก (Doughnut / Pie)
  const canvasDeptCost = document.getElementById('tableDeptCostChart');
  if (canvasDeptCost) {
    const top7Depts = cachedSortedDepts.slice(0, 7);
    const labels = top7Depts.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '…' : d.name);
    const data = top7Depts.map(d => d.cost);
    const colors = [
      '#0d9488', '#0284c7', '#8b5cf6', '#f59e0b',
      '#ec4899', '#10b981', '#64748b'
    ];

    if (tableDeptCostChartInstance) tableDeptCostChartInstance.destroy();
    tableDeptCostChartInstance = new Chart(canvasDeptCost.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['ไม่มีข้อมูล'],
        datasets: [{
          data: data.length ? data : [0],
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 12, font: { family: "'Prompt', sans-serif", size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString()} บาท`
            }
          }
        }
      }
    });
  }

  // Chart 2: ครุภัณฑ์ที่ส่งซ่อมบ่อยที่สุด (Horizontal Bar)
  const canvasEquipCount = document.getElementById('tableEquipCountChart');
  if (canvasEquipCount) {
    const top8Equips = cachedSortedEquips.slice(0, 8);
    const labels = top8Equips.map(e => e.name.length > 18 ? e.name.substring(0, 18) + '…' : e.name);
    const counts = top8Equips.map(e => e.count);

    if (tableEquipCountChartInstance) tableEquipCountChartInstance.destroy();
    tableEquipCountChartInstance = new Chart(canvasEquipCount.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['ไม่มีข้อมูล'],
        datasets: [{
          label: 'จำนวนครั้งส่งซ่อม',
          data: counts.length ? counts : [0],
          backgroundColor: '#8b5cf6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` จำนวน: ${ctx.raw} ครั้ง`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } },
            grid: { color: '#f1f5f9' }
          },
          y: {
            ticks: { font: { family: "'Prompt', sans-serif", size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }
}

function resetEquipPageAndRender() {
  currentEquipPage = 1;
  renderDashboardTables();
}

function changeEquipPage(step) {
  currentEquipPage += step;
  renderDashboardTables();
}

/**
 * เปิด Modal ดูรายละเอียดใบซ่อมของกลุ่มงาน/แผนก
 */
function openDeptDetailModal(deptName) {
  const modal = document.getElementById('deptDetailModal');
  if (!modal) return;

  const targetName = (deptName || '').trim();
  document.getElementById('deptModalTitle').innerText = targetName || 'ไม่ระบุกลุ่มงาน';

  // ค้นหาใบซ่อมทั้งหมดของแผนกนี้
  const deptRepairs = repairs.filter(r => (r.div || '').trim() === targetName);
  
  const total = deptRepairs.length;
  const completed = deptRepairs.filter(r => r.status === 'เสร็จสิ้น').length;
  const pending = total - completed;
  const totalCost = deptRepairs.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

  document.getElementById('deptModalStatTotal').innerText = `ทั้งหมด ${total} ใบ`;
  document.getElementById('deptModalStatCompleted').innerText = `เสร็จสิ้น ${completed} ใบ`;
  document.getElementById('deptModalStatPending').innerText = `ค้างซ่อม ${pending} ใบ`;
  document.getElementById('deptModalStatCost').innerText = `งบประมาณรวม ${totalCost.toLocaleString()} บ.`;

  // ปุ่มลัดไปหน้าจัดการใบซ่อมพร้อมกรองชื่อแผนก
  const filterBtn = document.getElementById('deptModalFilterBtn');
  if (filterBtn) {
    filterBtn.onclick = () => {
      closeDeptDetailModal();
      switchTab('repair-list');
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = targetName;
        resetRepairPageAndRender();
      }
    };
  }

  // เรนเดอร์รายการใบซ่อมใน Modal
  const listContainer = document.getElementById('deptModalRepairsList');
  listContainer.innerHTML = '';

  if (deptRepairs.length === 0) {
    listContainer.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">ไม่พบประวัติใบส่งซ่อมในกลุ่มงานนี้</div>`;
  } else {
    // เรียงจากวันที่ล่าสุด
    const sortedRepairs = [...deptRepairs].sort((a, b) => {
      const da = a.date ? (parseDateToObj(a.date) || 0) : 0;
      const db = b.date ? (parseDateToObj(b.date) || 0) : 0;
      return db - da;
    });

    sortedRepairs.forEach(r => {
      const realIndex = repairs.findIndex(item => item.repairNo === r.repairNo);
      let statusColor = 'bg-slate-100 text-slate-700';
      if (r.status === 'เสร็จสิ้น') statusColor = 'bg-emerald-100 text-emerald-800';
      else if (r.status === 'กำลังดำเนินการ') statusColor = 'bg-blue-100 text-blue-800';
      else if (r.status === 'รออะไหล่/ช่างภายนอก') statusColor = 'bg-amber-100 text-amber-800';
      else if (r.status === 'จำหน่ายออก') statusColor = 'bg-rose-100 text-rose-800';

      const itemCard = document.createElement('div');
      itemCard.className = 'border border-slate-200 rounded-xl p-3.5 bg-white hover:border-teal-400 hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3';
      itemCard.innerHTML = `
        <div class="space-y-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-teal-800 font-mono text-sm">${r.repairNo}</span>
            <span class="text-xs text-slate-400 font-medium">📅 ${formatDateToBE(r.date)}</span>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor}">${r.status}</span>
          </div>
          <div class="font-semibold text-slate-800 text-sm truncate">${r.equipName || '-'}</div>
          <div class="text-xs text-slate-500 line-clamp-1"><strong>อาการ:</strong> ${r.symptom || '-'}</div>
          <div class="text-[11px] text-slate-400 flex flex-wrap gap-3">
            <span>ช่าง: <strong class="text-slate-600">${r.assignee || 'ยังไม่ระบุ'}</strong></span>
            <span>ค่าใช้จ่าย: <strong class="text-slate-600">${Number(r.cost || 0).toLocaleString()} บ.</strong></span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
          <button onclick="previewWorkOrderSlip(${realIndex})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition">
            <span>🖨️</span> พิมพ์ใบซ่อม
          </button>
          <button onclick="editRepair(${realIndex}); closeDeptDetailModal(); switchTab('repair-list');" class="bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition">
            <span>✏️</span> แก้ไข
          </button>
        </div>
      `;
      listContainer.appendChild(itemCard);
    });
  }

  modal.classList.remove('hidden');
}

function closeDeptDetailModal() {
  const modal = document.getElementById('deptDetailModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * ฟังก์ชันสร้างสไลด์นำเสนอ PowerPoint (.pptx) สำหรับผู้บริหารระดับสูง (Executive Pitch & Summary)
 * - เอาวันที่ทำรายงานออกตามคำสั่ง
 * - เพิ่มข้อมูลว่าแต่ละกลุ่มงาน/แผนก ใครเป็นผู้ส่งใบซ่อมมาบ้าง
 * - ปรับการแสดงผลข้อความเต็ม ไม่ให้มี "..." หรือตัดคำ
 * - ใช้ฟอนต์ TH Sarabun New / TH Sarabun PSK (สารบัญ) ทั้งชุดสไลด์
 */
function exportDashboardToPPT() {
  if (typeof PptxGenJS === 'undefined') {
    alert('ไม่สามารถโหลดโมดูลสร้าง PowerPoint ได้');
    return;
  }

  const FONT_TH = 'TH SarabunPSK';

  const periodMode = document.getElementById('dashboardPeriod')?.value || 'monthly';
  const fyFilter = document.getElementById('dashboardFiscalYearFilter')?.value || 'current';
  const currentFY = (typeof getThaiFiscalYear === 'function') ? getThaiFiscalYear() : new Date().getFullYear() + 543;
  const fyText = fyFilter === 'all' ? 'ทุกปีงบประมาณ' : `ปีงบประมาณ ${fyFilter === 'current' ? currentFY : fyFilter}`;
  const modeText = periodMode === 'monthly' ? 'รายเดือน' : periodMode === 'quarterly' ? 'รายไตรมาส (3 เดือน)' : 'รายปี';

  const filteredRepairs = repairs.filter(r => {
    if (fyFilter === 'all') return true;
    const targetFY = fyFilter === 'current' ? currentFY : parseInt(fyFilter, 10);
    const itemFY = (typeof getRepairFiscalYear === 'function') ? getRepairFiscalYear(r) : currentFY;
    return itemFY === targetFY;
  });

  const totalRepairs = filteredRepairs.length;
  const completedList = filteredRepairs.filter(r => r.status === 'เสร็จสิ้น');
  const completed = completedList.length;
  const pendingList = filteredRepairs.filter(r => ['กำลังดำเนินการ', 'รอดำเนินการ', 'รออะไหล่/ช่างภายนอก'].includes(r.status));
  const pending = pendingList.length;
  const totalCost = filteredRepairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  const successRate = totalRepairs > 0 ? Math.round((completed / totalRepairs) * 100) : 0;

  // คำนวณระยะเวลาเฉลี่ย
  let totalRepairDays = 0;
  let countWithDuration = 0;
  completedList.forEach(r => {
    if (r.date) {
      const startDate = _dashParseDate(r.date);
      if (startDate) {
        const endDate = r.completedDate ? (_dashParseDate(r.completedDate) || startDate) : startDate;
        const diffDays = Math.max(0, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
        totalRepairDays += diffDays;
        countWithDuration++;
      }
    }
  });
  const avgRepairDays = countWithDuration > 0 ? (totalRepairDays / countWithDuration).toFixed(1) : 0;

  // จัดกลุ่มข้อมูลแผนก พร้อมรายชื่อผู้ส่งใบซ่อมในกลุ่มงานนั้นๆ
  const deptRequestersMap = {};
  filteredRepairs.forEach(r => {
    const deptName = (r.div || 'ไม่ระบุกลุ่มงาน').trim();
    const reqName = (r.requester || '').trim();
    if (!deptRequestersMap[deptName]) {
      deptRequestersMap[deptName] = {
        name: deptName,
        count: 0,
        cost: 0,
        requesters: new Set()
      };
    }
    deptRequestersMap[deptName].count++;
    deptRequestersMap[deptName].cost += Number(r.cost) || 0;
    if (reqName && reqName !== 'ไม่ระบุ') {
      deptRequestersMap[deptName].requesters.add(reqName);
    }
  });

  const sortedDeptsWithRequesters = Object.values(deptRequestersMap).sort((a, b) => b.count - a.count || b.cost - a.cost);

  // สรุป Top แผนก & ครุภัณฑ์ (แสดงชื่อเต็ม ไม่ตัดคำ)
  const topDept = sortedDeptsWithRequesters.length > 0 ? sortedDeptsWithRequesters[0] : { name: '-', count: 0, cost: 0, requesters: new Set() };
  const topEquip = cachedSortedEquips.length > 0 ? cachedSortedEquips[0] : { name: '-', count: 0, cost: 0 };

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
  pptx.author = 'โรงพยาบาลพยุหะคีรี';
  pptx.company = 'โรงพยาบาลพยุหะคีรี';
  pptx.title = `Executive Report - ระบบซ่อมแซมครุภัณฑ์ ${fyText}`;

  // Helper สำหรับเพิ่ม Header / Footer ในทุกสไลด์เนื้อหา (เอาวันที่ทำรายงานออกแล้ว)
  function addSlideHeaderFooter(slide, title, category = 'EXECUTIVE SUMMARY') {
    // Top Accent Bar
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.1,
      fill: { color: '0D9488' }, line: { color: '0D9488' }
    });

    // Category Pill / Tag
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: 0.25, w: 2.3, h: 0.32,
      fill: { color: 'E0F2FE' }, line: { color: 'BAE6FD', width: 0.5 }
    });
    slide.addText(category, {
      x: 0.6, y: 0.25, w: 2.3, h: 0.32,
      fontSize: 11, bold: true, color: '0369A1', align: 'center', fontFace: FONT_TH
    });

    // Slide Title
    slide.addText(title, {
      x: 0.6, y: 0.55, w: 8.8, h: 0.55,
      fontSize: 22, bold: true, color: '0F172A', fontFace: FONT_TH
    });

    // Bottom Footer Line
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.6, y: 5.25, w: 8.8, h: 0.02,
      fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' }
    });
    // Footer Text (ไม่มีวันที่)
    slide.addText(`โรงพยาบาลพยุหะคีรี จ.นครสวรรค์ | ${fyText} (${modeText})`, {
      x: 0.6, y: 5.28, w: 6.0, h: 0.28,
      fontSize: 12, color: '94A3B8', fontFace: FONT_TH
    });
    slide.addText('ระบบบริหารงานซ่อมแซมครุภัณฑ์', {
      x: 6.8, y: 5.28, w: 2.6, h: 0.28,
      fontSize: 12, color: '94A3B8', align: 'right', fontFace: FONT_TH
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 1: Premium Title Slide (Executive Dark Teal Gradient)
  // ══════════════════════════════════════════════════════════════
  const s1 = pptx.addSlide();
  s1.background = { color: '042F2E' }; // Deep Dark Teal

  s1.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.35, h: 5.625,
    fill: { color: '0D9488' }, line: { color: '0D9488' }
  });
  s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 0.7, w: 3.8, h: 0.38,
    fill: { color: '134E4A' }, line: { color: '2DD4BF', width: 0.5 }
  });
  s1.addText('HOSPITAL MAINTENANCE EXECUTIVE REPORT', {
    x: 0.8, y: 0.7, w: 3.8, h: 0.38,
    fontSize: 12, bold: true, color: '2DD4BF', align: 'center', fontFace: FONT_TH
  });

  // Main Title & Subtitle (ไม่มีวันที่ทำเอกสาร)
  s1.addText('รายงานสรุปผลการซ่อมบำรุง\nและบริหารงบประมาณครุภัณฑ์', {
    x: 0.8, y: 1.25, w: 8.4, h: 1.45,
    fontSize: 32, bold: true, color: 'FFFFFF', fontFace: FONT_TH, lineSpacing: 38
  });

  s1.addText(`นำเสนอผู้บริหาร โรงพยาบาลพยุหะคีรี จ.นครสวรรค์\nรอบการรายงาน: ${fyText} • โหมดวิเคราะห์: ${modeText}`, {
    x: 0.8, y: 2.85, w: 8.4, h: 0.75,
    fontSize: 16, color: '99F6E4', fontFace: FONT_TH, lineSpacing: 22
  });

  // 3 Hero Highlights on Cover
  const heroHighlights = [
    { label: 'ส่งซ่อมสะสม', val: `${totalRepairs.toLocaleString()} ครั้ง`, sub: `ปิดงานสำเร็จ ${successRate}%`, bg: '115E59', accent: '2DD4BF' },
    { label: 'งบประมาณที่ใช้ไป', val: `${totalCost.toLocaleString()} บาท`, sub: `เฉลี่ย ${(totalRepairs > 0 ? Math.round(totalCost/totalRepairs) : 0).toLocaleString()} บ./งาน`, bg: '115E59', accent: 'FBBF24' },
    { label: 'ระยะเวลาปิดงานเฉลี่ย', val: `${avgRepairDays} วัน`, sub: `งานคงค้าง ${pending} งาน`, bg: '115E59', accent: '38BDF8' }
  ];

  heroHighlights.forEach((h, i) => {
    const cardX = 0.8 + (i * 2.8);
    s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: cardX, y: 3.8, w: 2.65, h: 1.25,
      fill: { color: h.bg }, line: { color: h.accent, width: 1 }
    });
    s1.addText(h.label, {
      x: cardX + 0.15, y: 3.88, w: 2.35, h: 0.28,
      fontSize: 12, color: 'CCFBF1', fontFace: FONT_TH
    });
    s1.addText(h.val, {
      x: cardX + 0.15, y: 4.16, w: 2.35, h: 0.45,
      fontSize: 18, bold: true, color: 'FFFFFF', fontFace: FONT_TH
    });
    s1.addText(h.sub, {
      x: cardX + 0.15, y: 4.62, w: 2.35, h: 0.3,
      fontSize: 11, color: h.accent, fontFace: FONT_TH
    });
  });

  s1.addText('กลุ่มงานบริหารทั่วไป • ฝ่ายเทคโนโลยีสารสนเทศและซ่อมบำรุง', {
    x: 0.8, y: 5.18, w: 8.4, h: 0.3,
    fontSize: 12, color: '5EEAD4', fontFace: FONT_TH
  });

  // ══════════════════════════════════════════════════════════════
  // SLIDE 2: Executive Summary Dashboard (Cards + 2 Charts)
  // ══════════════════════════════════════════════════════════════
  const s2 = pptx.addSlide();
  s2.background = { color: 'F8FAFC' };
  addSlideHeaderFooter(s2, 'ภาพรวมสถิติและตัวชี้วัดผลงานสำคัญ (KPI Dashboard)', 'EXECUTIVE PERFORMANCE');

  // แสดงชื่อเต็ม ไม่ตัดคำ
  const topDeptFullName = topDept.name || '-';
  const kpiExecutive = [
    { title: 'ส่งซ่อมทั้งหมด', val: `${totalRepairs.toLocaleString()}`, unit: 'ครั้ง', sub: `เสร็จสิ้น ${completed} | ค้าง ${pending}`, border: '0D9488', valColor: '0F766E' },
    { title: 'อัตราความสำเร็จ', val: `${successRate}%`, unit: 'Success Rate', sub: `ระยะเวลาเฉลี่ย ${avgRepairDays} วัน`, border: '3B82F6', valColor: '1D4ED8' },
    { title: 'งบประมาณสะสม', val: `${totalCost.toLocaleString()}`, unit: 'บาท', sub: `เฉลี่ย ${(totalRepairs > 0 ? Math.round(totalCost / totalRepairs) : 0).toLocaleString()} บ./งาน`, border: 'E11D48', valColor: 'BE123C' },
    { title: 'หน่วยงานส่งซ่อมสูงสุด', val: topDeptFullName, unit: `${topDept.count || 0} ครั้ง`, sub: `ส่งซ่อม ${topDept.count || 0} ครั้ง (${(topDept.cost || 0).toLocaleString()} บ.)`, border: 'D97706', valColor: 'B45309' }
  ];

  kpiExecutive.forEach((item, index) => {
    const posX = 0.6 + (index * 2.25);
    s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: posX, y: 1.15, w: 2.12, h: 1.35,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 }
    });
    s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: posX + 0.15, y: 1.15, w: 0.5, h: 0.05,
      fill: { color: item.border }, line: { color: item.border }
    });
    s2.addText(item.title, {
      x: posX + 0.1, y: 1.22, w: 1.92, h: 0.28,
      fontSize: 12, bold: true, color: '64748B', fontFace: FONT_TH
    });
    // ถ้าข้อความยาว เช่น ชื่อแผนก ให้ปรับขนาดตัวอักษรลงให้อ่านได้เต็ม ไม่ตัดคำ
    const valFontSize = item.val.length > 15 ? 13 : item.val.length > 10 ? 15 : 20;
    s2.addText(item.val, {
      x: posX + 0.1, y: 1.48, w: 1.92, h: 0.52,
      fontSize: valFontSize, bold: true, color: item.valColor, fontFace: FONT_TH
    });
    s2.addText(item.sub, {
      x: posX + 0.1, y: 2.05, w: 1.92, h: 0.35,
      fontSize: 10.5, color: '94A3B8', fontFace: FONT_TH
    });
  });

  // Chart Containers
  if (trendChartInstance && categoryChartInstance) {
    s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: 2.6, w: 5.4, h: 2.5,
      fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 }
    });
    s2.addText('แนวโน้มจำนวนงานส่งซ่อมและค่าใช้จ่ายตามคาบเวลา', {
      x: 0.8, y: 2.66, w: 5.0, h: 0.3,
      fontSize: 13, bold: true, color: '334155', fontFace: FONT_TH
    });
    s2.addImage({ data: trendChartInstance.toBase64Image(), x: 0.75, y: 2.95, w: 5.1, h: 2.05 });

    s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 6.2, y: 2.6, w: 3.2, h: 2.5,
      fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 }
    });
    s2.addText('สัดส่วนตามประเภทครุภัณฑ์', {
      x: 6.35, y: 2.66, w: 2.9, h: 0.3,
      fontSize: 13, bold: true, color: '334155', fontFace: FONT_TH
    });
    s2.addImage({ data: categoryChartInstance.toBase64Image(), x: 6.3, y: 2.95, w: 3.0, h: 2.05 });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 3: Top Departments (พร้อมรายชื่อผู้ส่งใบซ่อม) & Equipment
  // ══════════════════════════════════════════════════════════════
  const s3 = pptx.addSlide();
  s3.background = { color: 'F8FAFC' };
  addSlideHeaderFooter(s3, 'วิเคราะห์จัดอันดับกลุ่มงานและครุภัณฑ์ (Cost & Frequency Rankings)', 'RANKING & BREAKDOWN');

  // Box 1: Dept Ranking พร้อมผู้ส่งซ่อม
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 1.15, w: 4.8, h: 3.95,
    fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 }
  });
  s3.addText('🏢 อันดับกลุ่มงานที่ส่งซ่อมสูงสุด และผู้ส่งใบซ่อม (Top Departments & Requesters)', {
    x: 0.75, y: 1.22, w: 4.5, h: 0.35,
    fontSize: 13, bold: true, color: '0F766E', fontFace: FONT_TH
  });

  const deptHeaders = [
    { text: 'กลุ่มงาน / แผนก', options: { bold: true, fill: '0F766E', color: 'FFFFFF', fontSize: 11 } },
    { text: 'ผู้ส่งใบซ่อมในกลุ่มงาน', options: { bold: true, fill: '0F766E', color: 'FFFFFF', fontSize: 11 } },
    { text: 'ครั้ง', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'center', fontSize: 11 } },
    { text: 'งบรวม (บ.)', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'right', fontSize: 11 } }
  ];

  const deptRows = sortedDeptsWithRequesters.slice(0, 6).map((d, i) => {
    const reqList = Array.from(d.requesters || []);
    const reqStr = reqList.length > 0 ? reqList.join(', ') : 'ไม่ระบุผู้ส่ง';
    return [
      { text: `${i + 1}. ${d.name}`, options: { fontSize: 10.5 } },
      { text: reqStr, options: { fontSize: 9.5, color: '475569' } },
      { text: `${d.count}`, options: { align: 'center', fontSize: 10.5, bold: true } },
      { text: (d.cost || 0).toLocaleString(), options: { align: 'right', fontSize: 10.5 } }
    ];
  });

  s3.addTable([deptHeaders, ...deptRows], {
    x: 0.75, y: 1.62, w: 4.5,
    fontFace: FONT_TH, border: { color: 'E2E8F0', pt: 0.5 },
    rowH: 0.35
  });

  // Box 2: Equipment Ranking (แสดงชื่อเต็ม)
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 5.55, y: 1.15, w: 3.85, h: 3.95,
    fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 }
  });
  s3.addText('🔧 ครุภัณฑ์ที่ใช้งบซ่อมสูงสุด (High-Cost Assets)', {
    x: 5.7, y: 1.22, w: 3.55, h: 0.35,
    fontSize: 13, bold: true, color: '7C3AED', fontFace: FONT_TH
  });

  const eqHeaders = [
    { text: 'รายการครุภัณฑ์ (แสดงชื่อเต็ม)', options: { bold: true, fill: '6D28D9', color: 'FFFFFF', fontSize: 11 } },
    { text: 'ซ่อม', options: { bold: true, fill: '6D28D9', color: 'FFFFFF', align: 'center', fontSize: 11 } },
    { text: 'งบรวม (บาท)', options: { bold: true, fill: '6D28D9', color: 'FFFFFF', align: 'right', fontSize: 11 } }
  ];
  const eqRows = cachedSortedEquips.slice(0, 6).map((e, i) => [
    { text: `${i + 1}. ${e.name}`, options: { fontSize: 10.5 } },
    { text: `${e.count}`, options: { align: 'center', fontSize: 10.5 } },
    { text: (e.cost || 0).toLocaleString(), options: { align: 'right', fontSize: 10.5, bold: true } }
  ]);
  s3.addTable([eqHeaders, ...eqRows], {
    x: 5.7, y: 1.62, w: 3.55,
    fontFace: FONT_TH, border: { color: 'E2E8F0', pt: 0.5 },
    rowH: 0.35
  });

  // ══════════════════════════════════════════════════════════════
  // SLIDE 4: Executive Insights & Recommendations (กิมมิคเชิงกลยุทธ์)
  // ══════════════════════════════════════════════════════════════
  const s4 = pptx.addSlide();
  s4.background = { color: 'F8FAFC' };
  addSlideHeaderFooter(s4, 'บทวิเคราะห์เชิงลึกและข้อเสนอแนะเชิงบริหาร (Strategic Insights)', 'EXECUTIVE INSIGHTS');

  // ข้อเสนอแนะเชิงกลยุทธ์ 3 ด้าน (ชื่อเต็ม ไม่ตัดคำ)
  const recommendations = [
    {
      title: '1. การบริหารงบประมาณและครุภัณฑ์เสื่อมสภาพ',
      badge: 'COST MANAGEMENT',
      badgeBg: 'FEE2E2',
      badgeColor: 'DC2626',
      points: [
        `ครุภัณฑ์ที่มีค่าซ่อมสะสมสูงสุดคือ "${topEquip.name}" (งบประมาณ ${Number(topEquip.cost || 0).toLocaleString()} บาท)`,
        'พิจารณาจัดสรรงบประมาณเพื่อจัดซื้อทดแทนใหม่ (Replacement Plan) แทนการซ่อมแซมซ้ำซาก',
        'วิเคราะห์จุดคุ้มทุน (Breakeven Point) ระหว่างค่าใช้จ่ายซ่อมแซมเทียบกับสัญญาบำรุงรักษารายปี (MA)'
      ]
    },
    {
      title: '2. แผนงานบำรุงรักษาเชิงป้องกัน (Preventive Maintenance)',
      badge: 'MAINTENANCE STRATEGY',
      badgeBg: 'FEF3C7',
      badgeColor: 'D97706',
      points: [
        `หน่วยงานที่ส่งซ่อมสูงสุดคือกลุ่มงาน "${topDept.name}" คิดเป็นจำนวนส่งซ่อม ${topDept.count || 0} ครั้ง`,
        'จัดอบรมการใช้งานและการดูแลรักษาเบื้องต้น (First-line Maintenance) ให้แก่เจ้าหน้าที่ในหน่วยงาน',
        'กำหนดรอบตรวจเช็คสภาพเครื่องมือประจำไตรมาสสำหรับครุภัณฑ์สำคัญ เพื่อลดความเสี่ยงการชำรุดกะทันหัน'
      ]
    },
    {
      title: '3. การเพิ่มประสิทธิภาพการให้บริการ (Service Level & SLA)',
      badge: 'OPERATIONAL EFFICIENCY',
      badgeBg: 'E0F2FE',
      badgeColor: '0284C7',
      points: [
        `อัตราการปิดงานซ่อมปัจจุบันอยู่ที่ ${successRate}% โดยมีระยะเวลาปิดงานเฉลี่ย ${avgRepairDays} วัน`,
        `งานที่ยังอยู่ระหว่างดำเนินการ ${pending} งาน ควรเร่งรัดการจัดหาอะไหล่และการประสานงานช่าง`,
        'ใช้ระบบติดตามและแจ้งเตือนแบบเรียลไทม์เพื่อควบคุมไม่ให้มีงานค้างเกินเกณฑ์ SLA 7 วัน'
      ]
    }
  ];

  recommendations.forEach((rec, idx) => {
    const cardY = 1.15 + (idx * 1.3);
    s4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: cardY, w: 8.8, h: 1.18,
      fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 }
    });
    // Category Badge
    s4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: cardY + 0.12, w: 2.1, h: 0.26,
      fill: { color: rec.badgeBg }, line: { color: rec.badgeBg }
    });
    s4.addText(rec.badge, {
      x: 0.8, y: cardY + 0.12, w: 2.1, h: 0.26,
      fontSize: 10, bold: true, color: rec.badgeColor, align: 'center', fontFace: FONT_TH
    });

    // Title
    s4.addText(rec.title, {
      x: 3.0, y: cardY + 0.1, w: 6.2, h: 0.28,
      fontSize: 14, bold: true, color: '0F172A', fontFace: FONT_TH
    });

    // Bullet points
    const bulletText = rec.points.map(p => `• ${p}`).join('\n');
    s4.addText(bulletText, {
      x: 0.8, y: cardY + 0.38, w: 8.4, h: 0.72,
      fontSize: 12, color: '475569', fontFace: FONT_TH, lineSpacing: 18
    });
  });

  const fileName = `รายงานวิเคราะห์ผู้บริหาร_รพ_พยุหะคีรี_${fyFilter}_${new Date().toISOString().split('T')[0]}.pptx`;
  pptx.writeFile({ fileName: fileName });
}


// ══════════════════════════════════════════════════════════════════════════════
// ระบบรายงานสรุปภาพรวมสำหรับผู้บริหาร (Executive PDF Report - A4 Fit)
// - ปรับขนาด Layout ให้พอดีกับหน้ากระดาษ A4 หน้าเดียว (Single Page Fit)
// - เอาช่องลายเซ็นออกตามคำสั่ง (รายงานสำหรับเปิดดู/วิเคราะห์ภาพรวม)
// - เพิ่มรายละเอียดสรุปสถานะงานซ่อม, ปัญหาที่พบบ่อย, ภาระงานช่าง และตัวชี้วัดครบถ้วน
// ══════════════════════════════════════════════════════════════════════════════

function openExecutiveReportModal() {
  const modalEl = document.getElementById('printExecutiveReportModal');
  const contentEl = document.getElementById('printExecutiveReportContent');
  const printZone = document.getElementById('printExecutiveReportZone');
  if (!modalEl || !contentEl) return;

  const periodMode = document.getElementById('dashboardPeriod')?.value || 'monthly';
  const fyFilter = document.getElementById('dashboardFiscalYearFilter')?.value || 'current';
  const currentFY = (typeof getThaiFiscalYear === 'function') ? getThaiFiscalYear() : new Date().getFullYear() + 543;
  const fyText = fyFilter === 'all' ? 'ทุกปีงบประมาณ' : `ปีงบประมาณ ${fyFilter === 'current' ? currentFY : fyFilter}`;
  const modeText = periodMode === 'monthly' ? 'รายเดือน (Monthly)' : periodMode === 'quarterly' ? 'รายไตรมาส (Quarterly)' : 'รายปี (Yearly)';

  const filteredRepairs = repairs.filter(r => {
    if (fyFilter === 'all') return true;
    const targetFY = fyFilter === 'current' ? currentFY : parseInt(fyFilter, 10);
    const itemFY = (typeof getRepairFiscalYear === 'function') ? getRepairFiscalYear(r) : currentFY;
    return itemFY === targetFY;
  });

  const totalRepairs = filteredRepairs.length;
  const completedList = filteredRepairs.filter(r => r.status === 'เสร็จสิ้น');
  const completed = completedList.length;
  const inProgressList = filteredRepairs.filter(r => r.status === 'กำลังดำเนินการ');
  const inProgress = inProgressList.length;
  const waitingPartsList = filteredRepairs.filter(r => r.status === 'รออะไหล่/ช่างภายนอก');
  const waitingParts = waitingPartsList.length;
  const pendingQueueList = filteredRepairs.filter(r => r.status === 'รอดำเนินการ');
  const pendingQueue = pendingQueueList.length;
  const allPending = inProgress + waitingParts + pendingQueue;

  const totalCost = filteredRepairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  const successRate = totalRepairs > 0 ? Math.round((completed / totalRepairs) * 100) : 0;

  // ระยะเวลาเฉลี่ย
  let totalRepairDays = 0;
  let countWithDuration = 0;
  completedList.forEach(r => {
    if (r.date) {
      const startDate = _dashParseDate(r.date);
      if (startDate) {
        const endDate = r.completedDate ? (_dashParseDate(r.completedDate) || startDate) : startDate;
        const diffDays = Math.max(0, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
        totalRepairDays += diffDays;
        countWithDuration++;
      }
    }
  });
  const avgRepairDays = countWithDuration > 0 ? (totalRepairDays / countWithDuration).toFixed(1) : 0;

  // ตรวจงานค้างเกิน 7 วัน
  const now = new Date();
  const overdueCount = filteredRepairs.filter(r => {
    if (r.status === 'เสร็จสิ้น' || !r.date) return false;
    const reqDate = _dashParseDate(r.date);
    if (!reqDate) return false;
    return Math.floor((now - reqDate) / (1000 * 60 * 60 * 24)) > 7;
  }).length;

  // จัดกลุ่มข้อมูลแผนก พร้อมรายชื่อผู้ส่งซ่อม (แสดงเต็ม ไม่ย่อ)
  const deptRequestersMap = {};
  filteredRepairs.forEach(r => {
    const deptName = (r.div || 'ไม่ระบุกลุ่มงาน').trim();
    const reqName = (r.requester || '').trim();
    if (!deptRequestersMap[deptName]) {
      deptRequestersMap[deptName] = { name: deptName, count: 0, cost: 0, requesters: new Set() };
    }
    deptRequestersMap[deptName].count++;
    deptRequestersMap[deptName].cost += Number(r.cost) || 0;
    if (reqName && reqName !== 'ไม่ระบุ') deptRequestersMap[deptName].requesters.add(reqName);
  });
  const sortedDepts = Object.values(deptRequestersMap).sort((a, b) => b.count - a.count || b.cost - a.cost);

  // ภาระงานช่าง (Technicians workload)
  const techMap = {};
  filteredRepairs.forEach(r => {
    const tName = (r.assignee || 'ยังไม่ระบุช่าง').trim();
    if (!techMap[tName]) techMap[tName] = { name: tName, total: 0, done: 0, pending: 0 };
    techMap[tName].total++;
    if (r.status === 'เสร็จสิ้น') techMap[tName].done++;
    else techMap[tName].pending++;
  });
  const topTechs = Object.values(techMap).sort((a, b) => b.total - a.total).slice(0, 4);

  // ดึงภาพกราฟถ้ามี
  const trendImg = trendChartInstance ? `<img src="${trendChartInstance.toBase64Image()}" class="w-full h-auto object-contain max-h-[145px]" />` : '<div class="h-28 flex items-center justify-center text-xs text-slate-400 bg-slate-50 border border-dashed rounded">ไม่มีข้อมูลกราฟ</div>';
  const catImg = categoryChartInstance ? `<img src="${categoryChartInstance.toBase64Image()}" class="w-full h-auto object-contain max-h-[145px]" />` : '<div class="h-28 flex items-center justify-center text-xs text-slate-400 bg-slate-50 border border-dashed rounded">ไม่มีข้อมูลกราฟ</div>';

  // ตาราง Top 5 กลุ่มงาน พร้อมผู้ส่งใบซ่อม
  const deptTableRows = sortedDepts.slice(0, 5).map((d, i) => {
    const reqNames = Array.from(d.requesters || []).slice(0, 3).join(', ') || 'ไม่ระบุ';
    const moreReq = (d.requesters && d.requesters.size > 3) ? ` (+${d.requesters.size - 3})` : '';
    return `
      <tr class="border-b border-slate-100 text-[11px] leading-tight">
        <td class="py-1 px-1.5 text-center font-bold text-slate-400">${i + 1}</td>
        <td class="py-1 px-1.5 font-semibold text-slate-800">${d.name}</td>
        <td class="py-1 px-1.5 text-slate-600 text-[10px]">${reqNames}${moreReq}</td>
        <td class="py-1 px-1.5 text-center font-bold text-teal-800">${d.count}</td>
        <td class="py-1 px-1.5 text-right font-mono font-bold text-slate-700">${(d.cost || 0).toLocaleString()}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="text-center py-2 text-xs text-slate-400">ไม่มีข้อมูล</td></tr>';

  // ตาราง Top 5 ครุภัณฑ์งบสูงสุด
  const equipTableRows = cachedSortedEquips.slice(0, 5).map((e, i) => `
    <tr class="border-b border-slate-100 text-[11px] leading-tight">
      <td class="py-1 px-1.5 text-center font-bold text-slate-400">${i + 1}</td>
      <td class="py-1 px-1.5 font-semibold text-slate-800">${e.name}</td>
      <td class="py-1 px-1.5 text-center font-semibold text-purple-700">${e.count}</td>
      <td class="py-1 px-1.5 text-right font-mono font-bold text-purple-950">${(e.cost || 0).toLocaleString()}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="text-center py-2 text-xs text-slate-400">ไม่มีข้อมูล</td></tr>';

  // แถบสรุปช่างซ่อม
  const techPills = topTechs.map(t => `
    <div class="bg-white px-2 py-1 rounded border border-slate-200 text-[10px] flex justify-between items-center gap-2">
      <span class="font-bold text-slate-800">${t.name}</span>
      <span class="text-slate-500">${t.total} งาน <span class="text-emerald-700 font-bold">(เสร็จ ${t.done})</span></span>
    </div>
  `).join('');

  const html = `
    <div class="executive-a4-sheet font-sans text-slate-800 leading-normal bg-white p-2 sm:p-3">
      <!-- 1. Header Banner ทางการ (ไม่มีวันที่) -->
      <div class="border-b-2 border-teal-800 pb-2 mb-2.5 flex justify-between items-center gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-lg bg-teal-800 text-white flex items-center justify-center text-xl font-bold shadow-xs">
            🏥
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h1 class="text-base font-bold text-teal-950 leading-tight">โรงพยาบาลพยุหะคีรี จ.นครสวรรค์</h1>
              <span class="text-[9px] font-bold tracking-wider bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded border border-teal-200">
                EXECUTIVE REPORT
              </span>
            </div>
            <p class="text-[11px] text-slate-600 font-medium leading-none mt-0.5">รายงานสรุปผลการซ่อมบำรุงและบริหารงบประมาณครุภัณฑ์</p>
          </div>
        </div>
        <div class="text-right shrink-0 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <p class="text-[9px] text-slate-500 font-medium">รอบการวิเคราะห์</p>
          <p class="text-[11px] font-bold text-teal-900 leading-tight">${fyText}</p>
          <p class="text-[9px] text-slate-500">${modeText}</p>
        </div>
      </div>

      <!-- 2. KPI 4 Metric Cards -->
      <div class="grid grid-cols-4 gap-2 mb-2.5">
        <div class="p-2 rounded-lg border border-teal-200 bg-teal-50/70">
          <p class="text-[9px] font-bold text-teal-800 uppercase tracking-wider">ส่งซ่อมทั้งหมด</p>
          <p class="text-lg font-bold text-teal-950 leading-tight mt-0.5">${totalRepairs.toLocaleString()} <span class="text-[10px] font-normal text-slate-600">รายการ</span></p>
          <p class="text-[8.5px] text-teal-700 mt-0.5">เสร็จสิ้น ${completed} | ค้าง ${allPending}</p>
        </div>

        <div class="p-2 rounded-lg border border-blue-200 bg-blue-50/70">
          <p class="text-[9px] font-bold text-blue-800 uppercase tracking-wider">อัตราสำเร็จ SLA</p>
          <p class="text-lg font-bold text-blue-950 leading-tight mt-0.5">${successRate}% <span class="text-[10px] font-normal text-slate-600">ปิดงาน</span></p>
          <p class="text-[8.5px] text-blue-700 mt-0.5">ระยะเวลาเฉลี่ย ${avgRepairDays} วัน</p>
        </div>

        <div class="p-2 rounded-lg border border-rose-200 bg-rose-50/70">
          <p class="text-[9px] font-bold text-rose-800 uppercase tracking-wider">งบประมาณสะสม</p>
          <p class="text-lg font-bold text-rose-950 leading-tight mt-0.5">${totalCost.toLocaleString()} <span class="text-[10px] font-normal text-slate-600">บาท</span></p>
          <p class="text-[8.5px] text-rose-700 mt-0.5">เฉลี่ย ${(totalRepairs > 0 ? Math.round(totalCost/totalRepairs) : 0).toLocaleString()} บ./งาน</p>
        </div>

        <div class="p-2 rounded-lg border border-amber-200 bg-amber-50/70">
          <p class="text-[9px] font-bold text-amber-800 uppercase tracking-wider">สถานะงานคงค้าง</p>
          <p class="text-lg font-bold ${overdueCount > 0 ? 'text-rose-700' : 'text-emerald-700'} leading-tight mt-0.5">${allPending} <span class="text-[10px] font-normal text-slate-600">งาน</span></p>
          <p class="text-[8.5px] font-semibold ${overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-0.5">
            ${overdueCount > 0 ? `⚠️ ค้าง > 7 วัน: ${overdueCount} งาน` : '✅ ไม่มีงานค้างเกิน 7 วัน'}
          </p>
        </div>
      </div>

      <!-- 3. Work Breakdown Status Bar (รายละเอียดสถานะงานที่แทนที่ช่องลายเซ็น) -->
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-2.5">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[10px] font-bold text-slate-700 uppercase">📊 จำแนกสถานะการดำเนินงานปัจจุบัน (Work Status Breakdown)</span>
          <span class="text-[9px] text-slate-500">เสร็จสิ้น ${completed} จาก ${totalRepairs} งาน</span>
        </div>
        <div class="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div class="bg-emerald-100/70 border border-emerald-300 rounded p-1">
            <span class="text-emerald-800 font-bold block">✅ เสร็จสิ้นแล้ว</span>
            <span class="text-emerald-950 font-bold text-xs">${completed} งาน</span>
          </div>
          <div class="bg-blue-100/70 border border-blue-300 rounded p-1">
            <span class="text-blue-800 font-bold block">🔄 กำลังดำเนินการ</span>
            <span class="text-blue-950 font-bold text-xs">${inProgress} งาน</span>
          </div>
          <div class="bg-amber-100/70 border border-amber-300 rounded p-1">
            <span class="text-amber-800 font-bold block">⏳ รออะไหล่/ช่างนอก</span>
            <span class="text-amber-950 font-bold text-xs">${waitingParts} งาน</span>
          </div>
          <div class="bg-purple-100/70 border border-purple-300 rounded p-1">
            <span class="text-purple-800 font-bold block">📋 รอดำเนินการคิว</span>
            <span class="text-purple-950 font-bold text-xs">${pendingQueue} งาน</span>
          </div>
        </div>
      </div>

      <!-- 4. Visual Analytics Charts (ย่อความสูงให้พอดี A4 ไม่ล้นหน้า 2) -->
      <div class="grid grid-cols-2 gap-2.5 mb-2.5">
        <div class="border border-slate-200 rounded-lg p-2 bg-white">
          <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
            <span class="text-[11px] font-bold text-slate-800">📈 แนวโน้มภาระงานและงบประมาณตามช่วงเวลา</span>
          </div>
          <div class="flex justify-center items-center">
            ${trendImg}
          </div>
        </div>

        <div class="border border-slate-200 rounded-lg p-2 bg-white">
          <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
            <span class="text-[11px] font-bold text-slate-800">📊 สัดส่วนค่าใช้จ่ายตามประเภทครุภัณฑ์</span>
          </div>
          <div class="flex justify-center items-center">
            ${catImg}
          </div>
        </div>
      </div>

      <!-- 5. Top Rankings Tables (กลุ่มงานพร้อมผู้ส่งซ่อม & ครุภัณฑ์) -->
      <div class="grid grid-cols-2 gap-2.5 mb-2.5">
        <!-- แผนก + ผู้ส่งซ่อม -->
        <div class="border border-slate-200 rounded-lg p-2 bg-white">
          <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-200">
            <span class="text-[11px] font-bold text-teal-900">🏢 กลุ่มงานที่ส่งซ่อมสูงสุด & ผู้ส่งใบซ่อม</span>
            <span class="text-[9px] text-slate-400">Top 5 Departments</span>
          </div>
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-slate-50 text-[9px] font-bold text-slate-600 border-b border-slate-200">
                <th class="py-1 px-1.5 text-center w-6">#</th>
                <th class="py-1 px-1.5 text-left">กลุ่มงาน</th>
                <th class="py-1 px-1.5 text-left">ผู้ส่งใบซ่อม</th>
                <th class="py-1 px-1.5 text-center w-10">ครั้ง</th>
                <th class="py-1 px-1.5 text-right w-16">งบรวม</th>
              </tr>
            </thead>
            <tbody>
              ${deptTableRows}
            </tbody>
          </table>
        </div>

        <!-- ครุภัณฑ์งบสูงสุด -->
        <div class="border border-slate-200 rounded-lg p-2 bg-white">
          <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-200">
            <span class="text-[11px] font-bold text-purple-900">🔧 ครุภัณฑ์ที่ใช้งบซ่อมสูงสุด</span>
            <span class="text-[9px] text-slate-400">Top 5 High-Cost Assets</span>
          </div>
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-slate-50 text-[9px] font-bold text-slate-600 border-b border-slate-200">
                <th class="py-1 px-1.5 text-center w-6">#</th>
                <th class="py-1 px-1.5 text-left">รายการครุภัณฑ์</th>
                <th class="py-1 px-1.5 text-center w-12">ซ่อม (ครั้ง)</th>
                <th class="py-1 px-1.5 text-right w-20">งบรวม (บาท)</th>
              </tr>
            </thead>
            <tbody>
              ${equipTableRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 6. ภาระงานช่างซ่อมผู้รับผิดชอบ (Staff Workload Distribution) -->
      <div class="border border-slate-200 rounded-lg p-2 bg-slate-50/70 mb-2">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-bold text-slate-700 uppercase">👷 การกระจายภาระงานช่างผู้รับผิดชอบ (Technician Workload)</span>
          <span class="text-[9px] text-slate-500">ทีมงานช่างฝ่ายซ่อมบำรุง</span>
        </div>
        <div class="grid grid-cols-4 gap-2">
          ${techPills || '<div class="col-span-4 text-center text-xs text-slate-400">ยังไม่มีการจ่ายงานให้ช่าง</div>'}
        </div>
      </div>

      <!-- 7. Strategic Insights (3 ข้อเสนอแนะเชิงบริหาร) -->
      <div class="border border-teal-200 rounded-lg p-2 bg-teal-50/40 mb-1">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-xs">💡</span>
          <h3 class="text-[10px] font-bold uppercase tracking-wide text-teal-950">ข้อเสนอแนะเชิงบริหารและการบริหารความเสี่ยง (Strategic Insights)</h3>
        </div>
        <div class="grid grid-cols-3 gap-2 text-[10px] text-slate-700 leading-snug">
          <div class="bg-white p-1.5 rounded border border-slate-200">
            <p class="font-bold text-teal-900">1. การจัดซื้อทดแทน (Replacement)</p>
            <p class="text-slate-600 mt-0.5">ครุภัณฑ์ที่ใช้งบสูงสุดคือ <strong>"${cachedSortedEquips[0]?.name || '-'}"</strong> ควรเปรียบเทียบจุดคุ้มทุนเพื่อจัดซื้อใหม่แทนซ่อมซ้ำซาก</p>
          </div>
          <div class="bg-white p-1.5 rounded border border-slate-200">
            <p class="font-bold text-teal-900">2. บำรุงรักษาเชิงป้องกัน (PM)</p>
            <p class="text-slate-600 mt-0.5">กลุ่มงาน <strong>"${sortedDepts[0]?.name || '-'}"</strong> ส่งซ่อมถี่สุด จัดรอบตรวจเช็คสภาพตามรอบไตรมาสเพื่อลด Downtime</p>
          </div>
          <div class="bg-white p-1.5 rounded border border-slate-200">
            <p class="font-bold text-teal-900">3. ควบคุมเกณฑ์บริการ (SLA)</p>
            <p class="text-slate-600 mt-0.5">อัตราปิดงานสำเร็จ ${successRate}% มีงานค้าง ${allPending} งาน ควรเร่งรัดจัดหาอะไหล่เพื่อไม่ให้เกินมาตรฐาน 7 วัน</p>
          </div>
        </div>
      </div>

      <!-- Footer ทางการ (ไม่มีวันที่) -->
      <div class="text-[8.5px] text-slate-400 flex justify-between items-center mt-2 pt-1 border-t border-slate-100">
        <span>โรงพยาบาลพยุหะคีรี • ระบบสารสนเทศบริหารงานซ่อมบำรุงและครุภัณฑ์</span>
        <span>Executive Overview Dashboard • เอกสารสรุปสำหรับผู้บริหาร</span>
      </div>
    </div>
  `;

  contentEl.innerHTML = html;
  if (printZone) {
    printZone.innerHTML = html;
  }
  modalEl.classList.remove('hidden');
}

function closeExecutiveReportModal() {
  const modalEl = document.getElementById('printExecutiveReportModal');
  if (modalEl) modalEl.classList.add('hidden');
}

function executePrintExecutiveReport() {
  document.body.classList.add('printing-executive-report');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-executive-report');
  }, 500);
}

window.openExecutiveReportModal = openExecutiveReportModal;
window.closeExecutiveReportModal = closeExecutiveReportModal;
window.executePrintExecutiveReport = executePrintExecutiveReport;

// =========================================================================
// EXECUTIVE ONE-PAGE KPI & DISPOSAL / COST-BENEFIT REPORT
// =========================================================================

// ฟังก์ชันวิเคราะห์ครุภัณฑ์ที่เข้าเกณฑ์เสนอแทงจำหน่ายและจุดคุ้มทุน
function analyzeDisposalAndBreakEven(repairsList = repairs) {
  // ดึงรายการพัสดุจาก local storage หรือตัวแปรระบบ
  let parcelItems = [];
  if (typeof window.AppStore !== 'undefined') {
    parcelItems = window.AppStore.getEquipments();
  } else {
    try {
      const raw = localStorage.getItem('hospital_equipments') || localStorage.getItem('hospital_equipments_data');
      if (raw) parcelItems = JSON.parse(raw);
    } catch (_) {}
  }

  const parcelPriceMap = {};
  parcelItems.forEach(p => {
    const code = (p.noid || p.code || '').trim().toLowerCase();
    const name = (p.name || '').trim().toLowerCase();
    const price = Number(String(p.perUnit || p.price || 0).replace(/,/g, '')) || 0;
    if (code) parcelPriceMap[code] = price;
    if (name && !parcelPriceMap[name]) parcelPriceMap[name] = price;
  });

  // รวบรวมข้อมูลการซ่อมตามครุภัณฑ์
  const equipStats = {};
  repairsList.forEach(r => {
    const equipName = (r.equipName || 'ไม่ระบุ').trim();
    const equipCode = (r.equipCode || '').trim();
    const div = (r.div || 'ไม่ระบุ').trim();
    const cost = Number(r.cost) || 0;
    const key = equipCode ? `${equipName}__${equipCode}` : equipName;

    if (!equipStats[key]) {
      // ค้นหาราคาจัดซื้อโดยประมาณ
      let originalPrice = 0;
      if (equipCode && parcelPriceMap[equipCode.toLowerCase()]) {
        originalPrice = parcelPriceMap[equipCode.toLowerCase()];
      } else if (parcelPriceMap[equipName.toLowerCase()]) {
        originalPrice = parcelPriceMap[equipName.toLowerCase()];
      }

      equipStats[key] = {
        name: equipName,
        code: equipCode || '-',
        div,
        repairCount: 0,
        totalCost: 0,
        originalPrice: originalPrice,
        isDisposed: r.status === 'จำหน่ายออก'
      };
    }

    equipStats[key].repairCount += 1;
    equipStats[key].totalCost += cost;
    if (r.status === 'จำหน่ายออก') equipStats[key].isDisposed = true;
  });

  const allEquips = Object.values(equipStats);

  // คัดกรอง Watchlist:
  // 1. ซ่อมบ่อย >= 3 ครั้ง
  // 2. หรือค่าซ่อมสะสม >= 50% ของราคาเดิม (ถ้ามีราคา)
  // 3. หรือค่าซ่อมสะสม >= 15,000 บาท
  // 4. หรือมีสถานะจำหน่ายออกแล้ว
  const watchlist = allEquips.filter(eq => {
    if (eq.isDisposed) return true;
    if (eq.repairCount >= 3) return true;
    if (eq.originalPrice > 0 && (eq.totalCost / eq.originalPrice) >= 0.5) return true;
    if (eq.totalCost >= 15000) return true;
    return false;
  }).sort((a, b) => {
    // เรียงตามสัดส่วนค่าซ่อมต่อราคา หรือเรียงตามค่าซ่อม
    const ratioA = a.originalPrice > 0 ? a.totalCost / a.originalPrice : 0;
    const ratioB = b.originalPrice > 0 ? b.totalCost / b.originalPrice : 0;
    return (ratioB - ratioA) || (b.totalCost - a.totalCost);
  });

  return { allEquips, watchlist };
}

// อัปเดตกล่องแจ้งเตือนบนหน้า Dashboard
function renderDisposalWatchlist(repairsList) {
  const countEl = document.getElementById('disposalWatchlistCount');
  const summaryEl = document.getElementById('disposalWatchlistSummary');
  if (!countEl || !summaryEl) return;

  const { watchlist } = analyzeDisposalAndBreakEven(repairsList);
  countEl.innerText = `${watchlist.length} รายการ`;

  if (watchlist.length === 0) {
    summaryEl.innerHTML = `
      <div class="col-span-3 text-emerald-800 bg-white/70 p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
        <span>✅</span>
        <span>ยอดเยี่ยม! ไม่พบครุภัณฑ์ที่มีประวัติซ่อมเกินจุดคุ้มทุนหรือซ่อมซ้ำซากในรอบปีงบประมาณนี้</span>
      </div>
    `;
    return;
  }

  // แสดง 3 อันดับแรกในกล่อง
  const top3 = watchlist.slice(0, 3);
  let html = '';
  top3.forEach((item, idx) => {
    let ratioText = '';
    if (item.originalPrice > 0) {
      const pct = Math.round((item.totalCost / item.originalPrice) * 100);
      ratioText = `สัดส่วนค่าซ่อม: <strong>${pct}%</strong> ของราคากลาง`;
    } else {
      ratioText = `ค่าซ่อมสะสมสูง: <strong>${item.totalCost.toLocaleString()} ฿</strong>`;
    }

    html += `
      <div class="bg-white/90 p-3 rounded-xl border border-rose-200 space-y-1 shadow-xs">
        <div class="flex items-center justify-between font-bold text-slate-800">
          <span class="truncate" title="${item.name}">${idx + 1}. ${item.name}</span>
          <span class="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">${item.repairCount} ครั้ง</span>
        </div>
        <div class="text-[11px] text-slate-500">🏢 ${item.div} | รหัส: ${item.code}</div>
        <div class="text-[11px] text-rose-700">${ratioText}</div>
      </div>
    `;
  });

  summaryEl.innerHTML = html;
}

// เปิดหน้าต่าง One-Page KPI Modal
window.openExecutiveOnePageModal = function() {
  const modal = document.getElementById('executiveOnePageModal');
  if (!modal) return;

  // วันที่ปัจจุบัน
  const dateEl = document.getElementById('onepageGeneratedDate');
  if (dateEl) {
    dateEl.innerText = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // คำนวณ KPI
  const totalRepairs = repairs.length;
  const completedList = repairs.filter(r => r.status === 'เสร็จสิ้น');
  const fixRate = totalRepairs > 0 ? Math.round((completedList.length / totalRepairs) * 100) : 0;
  const totalCost = repairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  const avgCostPerRepair = totalRepairs > 0 ? Math.round(totalCost / totalRepairs) : 0;

  // ระยะเวลาเฉลี่ย
  let totalDays = 0, countDays = 0;
  completedList.forEach(r => {
    if (r.date) {
      const s = _dashParseDate(r.date);
      if (s) {
        const e = r.completedDate ? (_dashParseDate(r.completedDate) || s) : s;
        totalDays += Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
        countDays++;
      }
    }
  });
  const avgDays = countDays > 0 ? (totalDays / countDays).toFixed(1) : 0;

  // วิเคราะห์จุดคุ้มทุน
  const { watchlist } = analyzeDisposalAndBreakEven(repairs);

  document.getElementById('onepageKpiSuccessRate').innerText = `${fixRate}%`;
  document.getElementById('onepageKpiSuccessSub').innerText = `ซ่อมเสร็จ ${completedList.length} จาก ${totalRepairs} งาน`;
  document.getElementById('onepageKpiAvgTime').innerText = `${avgDays} วัน`;
  document.getElementById('onepageKpiTotalCost').innerText = `${totalCost.toLocaleString()} ฿`;
  document.getElementById('onepageKpiAvgCostPerRepair').innerText = `เฉลี่ย ${avgCostPerRepair.toLocaleString()} ฿/งาน`;
  document.getElementById('onepageKpiDisposalCount').innerText = `${watchlist.length} รายการ`;
  document.getElementById('onepageKpiDisposalSub').innerText = watchlist.length > 0 ? `พบ ${watchlist.length} ชิ้นที่ซ่อมไม่คุ้มทุน` : 'อยู่ในเกณฑ์คุ้มค่า';

  // ตาราง Watchlist
  const tbody = document.getElementById('disposalReportTableBody');
  if (tbody) {
    if (watchlist.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">ไม่พบรายการครุภัณฑ์ที่เข้าข่ายเสนอแทงจำหน่าย</td></tr>`;
    } else {
      let html = '';
      watchlist.forEach((eq, idx) => {
        let pct = eq.originalPrice > 0 ? Math.round((eq.totalCost / eq.originalPrice) * 100) : null;
        let pctBadge = '';
        let recommendation = '';

        if (eq.isDisposed) {
          pctBadge = `<span class="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">แทงจำหน่ายแล้ว</span>`;
          recommendation = `<span class="text-slate-600 font-semibold">✅ ดำเนินการแทงจำหน่ายเรียบร้อยแล้ว</span>`;
        } else if (pct !== null && pct >= 70) {
          pctBadge = `<span class="bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold">${pct}% (วิกฤติ)</span>`;
          recommendation = `<span class="text-rose-700 font-bold">⛔ สั่งยุติการซ่อม และทำเรื่องขออนุมัติแทงจำหน่ายทันที</span>`;
        } else if (pct !== null && pct >= 50) {
          pctBadge = `<span class="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">${pct}%</span>`;
          recommendation = `<span class="text-amber-800 font-semibold">⚠️ เสนอเข้าแผนจัดซื้อทดแทนปีถัดไป (Replacement)</span>`;
        } else if (eq.repairCount >= 4) {
          pctBadge = `<span class="bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full font-semibold">ซ่อมบ่อย (${eq.repairCount} ครั้ง)</span>`;
          recommendation = `<span class="text-purple-800 font-medium">🔍 ส่งตรวจเช็กระบบโครงสร้างหลัก / ประเมินความคุ้มค่ารอบใหม่</span>`;
        } else {
          pctBadge = `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">ค่าซ่อมสูง</span>`;
          recommendation = `<span class="text-slate-600">พิจารณาจำกัดงบซ่อมครั้งต่อไป</span>`;
        }

        const origPriceText = eq.originalPrice > 0 ? `${eq.originalPrice.toLocaleString()} ฿` : '<span class="text-slate-300">- ไม่ระบุ -</span>';

        html += `
          <tr class="hover:bg-rose-50/40 transition-colors">
            <td class="py-2.5 px-3 font-bold text-slate-900">${eq.name}</td>
            <td class="py-2.5 px-3 font-mono text-slate-600">${eq.code}</td>
            <td class="py-2.5 px-3 text-slate-700">${eq.div}</td>
            <td class="py-2.5 px-3 text-center font-bold">${eq.repairCount}</td>
            <td class="py-2.5 px-3 text-right font-bold text-rose-600">${eq.totalCost.toLocaleString()} ฿</td>
            <td class="py-2.5 px-3 text-right text-slate-600">${origPriceText}</td>
            <td class="py-2.5 px-3 text-center">${pctBadge}</td>
            <td class="py-2.5 px-3">${recommendation}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }
  }

  modal.classList.remove('hidden');
};

window.closeExecutiveOnePageModal = function() {
  document.getElementById('executiveOnePageModal')?.classList.add('hidden');
};
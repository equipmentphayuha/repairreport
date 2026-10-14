/**
 * dashboard.js
 * จัดการสถิติ กราฟ แดชบอร์ด และระบบ Pagination / Search สำหรับครุภัณฑ์ที่มีจำนวนมาก
 */

let trendChartInstance = null;
let categoryChartInstance = null;
let deptChartInstance = null;

// สถานะการแบ่งหน้าตารางครุภัณฑ์ในแดชบอร์ด
let currentEquipPage = 1;
let cachedSortedDepts = [];
let cachedSortedEquips = [];

function renderDashboard() {
  const periodMode = document.getElementById('dashboardPeriod').value;
  
  // 1. คำนวณ KPI
  const totalRepairs = repairs.length;
  const completedList = repairs.filter(r => r.status === 'เสร็จสิ้น');
  const completed = completedList.length;
  const pendingList = repairs.filter(r => ['กำลังดำเนินการ', 'รอดำเนินการ', 'รออะไหล่/ช่างภายนอก'].includes(r.status));
  const pending = pendingList.length;
  const totalCost = repairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

  // คำนวณระยะเวลาซ่อมเฉลี่ย (วัน) สำหรับรายการที่เสร็จสิ้น
  let totalRepairDays = 0;
  let countWithDuration = 0;
  completedList.forEach(r => {
    if (r.date) {
      const startDate = new Date(r.date);
      const endDate = r.completedDate ? new Date(r.completedDate) : new Date(r.date);
      const diffTime = Math.max(0, endDate - startDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      totalRepairDays += diffDays;
      countWithDuration++;
    }
  });
  const avgRepairDays = countWithDuration > 0 ? (totalRepairDays / countWithDuration).toFixed(1) : 0;

  // ตรวจสอบงานที่ค้างซ่อมเกิน 7 วัน
  const now = new Date();
  const overdueCount = pendingList.filter(r => {
    if (!r.date) return false;
    const reqDate = new Date(r.date);
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

  repairs.forEach(r => {
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

  // เรนเดอร์ตารางสรุป
  renderDashboardTables();

  // 3. กราฟช่วงเวลา
  const groupData = {};
  repairs.forEach(r => {
    if (!r.date) return;
    const d = new Date(r.date);
    let key = '';

    if (periodMode === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (periodMode === 'quarterly') {
      const quarter = Math.ceil((d.getMonth() + 1) / 3);
      key = `ปี ${d.getFullYear()} ไตรมาส ${quarter}`;
    } else {
      key = `ปี ${d.getFullYear()}`;
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

  // กราฟสัดส่วนประเภท
  const categoryCosts = {};
  repairs.forEach(r => {
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
    tr.className = "hover:bg-slate-50 border-b";
    let rankBadge = `<span class="inline-block w-5 h-5 rounded-full text-center leading-5 font-bold ${index === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">${index + 1}</span>`;
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-medium">${rankBadge}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800">${dept.name}</td>
      <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700">${dept.count}</span></td>
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
 * ฟังก์ชันสร้างสไลด์นำเสนอ PowerPoint (.pptx)
 * เลือกแสดง Top 10 แผนก และ Top 10 ครุภัณฑ์ที่ใช้งบสูงสุด ไม่ให้สไลด์ล้น
 */
function exportDashboardToPPT() {
  if (typeof PptxGenJS === 'undefined') {
    alert('ไม่สามารถโหลดโมดูลสร้าง PowerPoint ได้');
    return;
  }

  const periodMode = document.getElementById('dashboardPeriod').value;
  const modeText = periodMode === 'monthly' ? 'รายเดือน' : periodMode === 'quarterly' ? 'ราย 3 เดือน (ไตรมาส)' : 'รายปี';
  const todayStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  const totalRepairs = repairs.length;
  const completed = repairs.filter(r => r.status === 'เสร็จสิ้น').length;
  const pending = repairs.filter(r => ['กำลังดำเนินการ', 'รอดำเนินการ', 'รออะไหล่/ช่างภายนอก'].includes(r.status)).length;
  const totalCost = repairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // Slide 1: ปก
  const slide1 = pptx.addSlide();
  slide1.background = { color: '0F766E' };
  slide1.addText('รายงานวิเคราะห์การซ่อมบำรุงและงบประมาณครุภัณฑ์', {
    x: 0.8, y: 1.8, w: 8.5, h: 1.2,
    fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Prompt'
  });
  slide1.addText(`โรงพยาบาลพยุหะคีรี จ.นครสวรรค์\nมุมมองการนำเสนอ: ${modeText}\nจัดทำเมื่อ: ${todayStr}`, {
    x: 0.8, y: 3.2, w: 8.5, h: 1.5,
    fontSize: 16, color: 'CCFBF1', fontFace: 'Prompt', lineSpacing: 24
  });

  // Slide 2: KPI และกราฟ
  const slide2 = pptx.addSlide();
  slide2.addText('ภาพรวมสถิติและตัวชี้วัดสำคัญ (Key Summary)', {
    x: 0.6, y: 0.4, w: 9, h: 0.6,
    fontSize: 20, bold: true, color: '0F766E', fontFace: 'Prompt'
  });

  const topDeptName = cachedSortedDepts.length > 0 ? `${cachedSortedDepts[0].name} (${cachedSortedDepts[0].count} ครั้ง)` : '-';
  const topEquipName = cachedSortedEquips.length > 0 ? `${cachedSortedEquips[0].name} (${cachedSortedEquips[0].cost.toLocaleString()} บ.)` : '-';

  const kpiData = [
    { title: 'ส่งซ่อมทั้งหมด', val: `${totalRepairs} ครั้ง`, color: '0D9488' },
    { title: 'งบซ่อมสะสมรวม', val: `${totalCost.toLocaleString()} บาท`, color: 'E11D48' },
    { title: 'แผนกส่งซ่อมบ่อยที่สุด 🏆', val: topDeptName, color: 'D97706' },
    { title: 'ครุภัณฑ์งบซ่อมสูงสุด 💰', val: topEquipName, color: '7C3AED' }
  ];

  kpiData.forEach((item, index) => {
    const posX = 0.6 + (index * 2.25);
    slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: posX, y: 1.2, w: 2.1, h: 1.5,
      fill: { color: 'F8FAFC' },
      line: { color: item.color, width: 2 }
    });
    slide2.addText(item.title, {
      x: posX, y: 1.3, w: 2.1, h: 0.4,
      fontSize: 10, color: '64748B', align: 'center', fontFace: 'Prompt'
    });
    slide2.addText(item.val, {
      x: posX, y: 1.8, w: 2.1, h: 0.8,
      fontSize: 13, bold: true, color: item.color, align: 'center', fontFace: 'Prompt'
    });
  });

  if (trendChartInstance && categoryChartInstance) {
    slide2.addImage({ data: trendChartInstance.toBase64Image(), x: 0.6, y: 2.9, w: 5.4, h: 2.4 });
    slide2.addImage({ data: categoryChartInstance.toBase64Image(), x: 6.2, y: 2.9, w: 3.2, h: 2.4 });
  }

  // Slide 3: Top 10 แผนก & Top 10 ครุภัณฑ์ (สรุปสำหรับผู้บริหาร)
  const slide3 = pptx.addSlide();
  slide3.addText('สรุปอันดับกลุ่มงาน และครุภัณฑ์สำคัญ (Top Rankings)', {
    x: 0.6, y: 0.4, w: 9, h: 0.5,
    fontSize: 18, bold: true, color: '0F766E', fontFace: 'Prompt'
  });

  const deptHeaders = [
    { text: 'แผนก/กลุ่มงาน', options: { bold: true, fill: '0F766E', color: 'FFFFFF' } },
    { text: 'จำนวนครั้ง', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'center' } },
    { text: 'งบประมาณ (บาท)', options: { bold: true, fill: '0F766E', color: 'FFFFFF', align: 'right' } }
  ];
  const deptRows = cachedSortedDepts.slice(0, 6).map(d => [
    { text: d.name },
    { text: `${d.count} ครั้ง`, options: { align: 'center' } },
    { text: d.cost.toLocaleString(), options: { align: 'right' } }
  ]);
  slide3.addTable([deptHeaders, ...deptRows], {
    x: 0.6, y: 1.2, w: 4.2,
    fontSize: 9, fontFace: 'Prompt', border: { color: 'CBD5E1', pt: 0.5 }
  });

  const eqHeaders = [
    { text: 'รายการครุภัณฑ์', options: { bold: true, fill: '7C3AED', color: 'FFFFFF' } },
    { text: 'ซ่อม (ครั้ง)', options: { bold: true, fill: '7C3AED', color: 'FFFFFF', align: 'center' } },
    { text: 'งบรวม (บาท)', options: { bold: true, fill: '7C3AED', color: 'FFFFFF', align: 'right' } }
  ];
  const eqRows = cachedSortedEquips.slice(0, 6).map(e => [
    { text: e.name },
    { text: `${e.count}`, options: { align: 'center' } },
    { text: e.cost.toLocaleString(), options: { align: 'right' } }
  ]);
  slide3.addTable([eqHeaders, ...eqRows], {
    x: 5.2, y: 1.2, w: 4.2,
    fontSize: 9, fontFace: 'Prompt', border: { color: 'CBD5E1', pt: 0.5 }
  });

  const fileName = `รายงานวิเคราะห์แยกรายการ_รพ_พยุหะคีรี_${new Date().toISOString().split('T')[0]}.pptx`;
  pptx.writeFile({ fileName: fileName });
}

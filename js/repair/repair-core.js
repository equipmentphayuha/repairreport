/**
 * app.js
 * - คำนวณปีงบประมาณไทย เช่น ตุลาคม 2569 นับเป็นปีงบประมาณ 2570
 * - รันเลขที่ใบส่งซ่อมรูปแบบ "ลำดับ/ปีงบประมาณ" เช่น 1/2570, 2/2570
 * - ระบบจัดการรายชื่อช่างซ่อม และกดปุ่มเลือกชื่อได้ทันที
 */

let repairs = [];
let equipments = [];
let technicians = [];
let staffList = [];
let currentRepairPage = 1;
let currentSortColumn = 'date';
let currentSortDirection = 'desc'; // 'asc' or 'desc'

// ===== THAI DATE PICKER HELPERS (Repair Module) =====
const REPAIR_THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];

function initRepairDatePicker(dayId, monId, yrId, hiddenId) {
  const daySel = document.getElementById(dayId);
  const monSel = document.getElementById(monId);
  const yrSel  = document.getElementById(yrId);
  const hidden = document.getElementById(hiddenId);
  if (!daySel || !monSel || !yrSel || !hidden) return;

  if (daySel.options.length <= 1) {
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement('option');
      opt.value = String(d).padStart(2, '0');
      opt.textContent = d;
      daySel.appendChild(opt);
    }
  }
  if (monSel.options.length <= 1) {
    REPAIR_THAI_MONTHS.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx + 1).padStart(2, '0');
      opt.textContent = name;
      monSel.appendChild(opt);
    });
  }
  if (yrSel.options.length <= 1) {
    const currentBE = new Date().getFullYear() + 543;
    for (let y = currentBE + 1; y >= currentBE - 20; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yrSel.appendChild(opt);
    }
  }

  function sync() {
    const d = daySel.value, m = monSel.value, y = yrSel.value;
    hidden.value = (d && m && y) ? `${d}/${m}/${y}` : '';
  }
  daySel.onchange = sync;
  monSel.onchange = sync;
  yrSel.onchange = sync;
}

function setRepairDatePickerValue(dayId, monId, yrId, hiddenId, value) {
  initRepairDatePicker(dayId, monId, yrId, hiddenId);
  const daySel = document.getElementById(dayId);
  const monSel = document.getElementById(monId);
  const yrSel  = document.getElementById(yrId);
  const hidden = document.getElementById(hiddenId);
  if (!daySel || !monSel || !yrSel) return;

  if (!value || String(value).trim() === '') {
    daySel.value = ''; monSel.value = ''; yrSel.value = '';
    if (hidden) hidden.value = '';
    return;
  }

  let d = '', m = '', y = '';
  const thaiM = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  const isoM  = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (thaiM) {
    d = thaiM[1].padStart(2, '0');
    m = thaiM[2].padStart(2, '0');
    y = String(Number(thaiM[3]) < 2400 ? Number(thaiM[3]) + 543 : Number(thaiM[3]));
  } else if (isoM) {
    d = isoM[3];
    m = isoM[2];
    y = String(Number(isoM[1]) + 543);
  }

  daySel.value = d;
  monSel.value = m;
  yrSel.value  = y;
  if (hidden) hidden.value = (d && m && y) ? `${d}/${m}/${y}` : '';
}

function clearRepairDatePicker(dayId, monId, yrId, hiddenId) {
  setRepairDatePickerValue(dayId, monId, yrId, hiddenId, '');
}

function parseDateToObj(dateStr) {
  if (!dateStr) return null;
  const thaiM = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  const isoM  = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (thaiM) {
    let y = Number(thaiM[3]);
    if (y > 2400) y -= 543;
    return new Date(y, Number(thaiM[2]) - 1, Number(thaiM[1]));
  } else if (isoM) {
    return new Date(Number(isoM[1]), Number(isoM[2]) - 1, Number(isoM[3]));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateToBE(dateStr) {
  if (!dateStr) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr) && Number(dateStr.split('/')[2]) > 2400) return dateStr;
  const d = parseDateToObj(dateStr);
  if (!d || isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yy}`;
}

function getThaiFiscalYear(targetDate = new Date()) {
  const d = new Date(targetDate);
  const month = d.getMonth() + 1; // 1-12
  let yearBE = d.getFullYear() + 543;
  if (month >= 10) {
    yearBE += 1; // เดือน ต.ค. - ธ.ค. เป็นปีงบประมาณถัดไป
  }
  return yearBE;
}

function generateNextRepairNo() {
  const fiscalYear = getThaiFiscalYear();
  const suffix = `/${fiscalYear}`;

  let maxSeq = 0;
  repairs.forEach(r => {
    if (r.repairNo && r.repairNo.endsWith(suffix)) {
      const parts = r.repairNo.split('/');
      const numPart = parseInt(parts[0], 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return `${nextSeq}/${fiscalYear}`;
}

function generateEquipmentCode(category) {
  let catPrefix = "6510";
  if (category === "ระบบคอมพิวเตอร์/เครือข่าย") catPrefix = "7440";
  else if (category === "ระบบสาธารณูปโภค") catPrefix = "5920";
  else if (category === "ครุภัณฑ์สำนักงานทั่วไป") catPrefix = "7110";

  const basePrefix = `${catPrefix}-001-`;
  let maxNum = 0;
  const allCodes = [...equipments.map(e => e.equipCode), ...repairs.map(r => r.equipCode)];

  allCodes.forEach(code => {
    if (code && code.startsWith(basePrefix)) {
      const numPart = parseInt(code.replace(basePrefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    }
  });

  return `${basePrefix}${(maxNum + 1).toString().padStart(4, '0')}`;
}

function onGenerateEquipCodeClick() {
  const cat = document.getElementById('formCategory').value;
  document.getElementById('formEquipCode').value = generateEquipmentCode(cat);
}

function renderTechnicianBadges() {
  const container = document.getElementById('technicianBadges');
  if (!container) return;
  container.innerHTML = '';

  technicians.forEach((tech) => {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = "text-xs bg-slate-100 hover:bg-teal-100 text-slate-700 hover:text-teal-800 border border-slate-200 px-2.5 py-1 rounded-full transition flex items-center gap-1";
    badge.innerHTML = `<span>👤</span> ${tech}`;
    badge.onclick = () => selectAssignee(tech);
    container.appendChild(badge);
  });
}

function selectAssignee(techName) {
  document.getElementById('formAssignee').value = techName;
}

function addNewTechnician() {
  if (typeof openStaffModal === 'function') {
    openStaffModal();
    // ปรับ role default เป็น technician
    const roleSelect = document.getElementById('staffFormRole');
    if (roleSelect) roleSelect.value = 'technician';
  } else {
    const name = prompt("ระบุชื่อ-นามสกุล ช่างซ่อม หรือหน่วยงานซ่อมบำรุงที่ต้องการเพิ่ม:");
    if (name && name.trim()) {
      const trimmed = name.trim();
      if (!technicians.includes(trimmed)) {
        technicians.push(trimmed);
        saveTechnicians(technicians);
        renderTechnicianBadges();
        selectAssignee(trimmed);
      } else {
        alert("มีชื่อช่างซ่อมนี้อยู่ในระบบแล้ว");
      }
    }
  }
}


function updateDivDatalist() {
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
}
function updateEquipmentDatalist() {
  const datalist = document.getElementById('equipmentsDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  equipments.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq.equipName;
    datalist.appendChild(opt);
  });
}

function onEquipNameChange(e) {
  const val = e.target.value.trim();
  const match = equipments.find(item => item.equipName.toLowerCase() === val.toLowerCase());
  if (match) {
    if (!document.getElementById('formEquipCode').value) {
      document.getElementById('formEquipCode').value = match.equipCode;
    }
    if (!document.getElementById('formDept').value) {
      document.getElementById('formDept').value = match.div;
    }
    if (match.category) {
      document.getElementById('formCategory').value = match.category;
    }
  }
}

function switchTab(tab) {
  const secCharts     = document.getElementById('section-charts');
  const secTables     = document.getElementById('section-tables');
  const secRepairs    = document.getElementById('section-repairs');
  const secStaff      = document.getElementById('section-staff');
  const secInventory  = document.getElementById('section-inventory');
  const secParcelStats = document.getElementById('section-parcel-stats');

  const btnCharts     = document.getElementById('btn-tab-charts');
  const btnTables     = document.getElementById('btn-tab-tables');
  const btnRepairs    = document.getElementById('btn-tab-repairs');
  const btnStaff      = document.getElementById('btn-tab-staff');
  const btnInventory  = document.getElementById('btn-tab-inventory');

  [secCharts, secTables, secRepairs, secStaff, secInventory, secParcelStats].forEach(s => { if (s) s.classList.add('hidden'); });

  const activeBtnClass   = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-900 text-white shadow-md transition-all flex items-center gap-1 border border-teal-400";
  const inactiveBtnClass = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-600/70 text-teal-100 hover:bg-teal-800 hover:text-white transition-all flex items-center gap-1 border border-teal-500/30";
  
  if (btnInventory) btnInventory.className = inactiveBtnClass;
  if (btnRepairs) btnRepairs.className = inactiveBtnClass;
  if (btnCharts) {
    btnCharts.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white shadow transition-all flex items-center gap-1.5 border border-teal-500/40";
  }

  if (tab === 'inventory') {
    if (secInventory) secInventory.classList.remove('hidden');
    if (btnInventory) btnInventory.className = activeBtnClass;
    if (typeof window.renderParcelViews === 'function') window.renderParcelViews();
  } else if (tab === 'parcel_stats') {
    if (secParcelStats) secParcelStats.classList.remove('hidden');
    if (btnCharts) {
      btnCharts.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-950 text-white shadow-md ring-2 ring-teal-300 transition-all flex items-center gap-1.5 border border-teal-400";
    }
    if (typeof window.renderParcelDashboard === 'function') window.renderParcelDashboard();
  } else if (tab === 'charts') {
    if (secCharts) secCharts.classList.remove('hidden');
    if (btnCharts) {
      btnCharts.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-950 text-white shadow-md ring-2 ring-teal-300 transition-all flex items-center gap-1.5 border border-teal-400";
    }
    if (typeof renderDashboard === 'function') renderDashboard();
  } else if (tab === 'tables') {
    if (secTables) secTables.classList.remove('hidden');
    if (btnCharts) {
      btnCharts.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-950 text-white shadow-md ring-2 ring-teal-300 transition-all flex items-center gap-1.5 border border-teal-400";
    }
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderDashboardTables === 'function') renderDashboardTables();
  } else if (tab === 'staff') {
    if (secStaff) secStaff.classList.remove('hidden');
    if (btnCharts) {
      btnCharts.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-950 text-white shadow-md ring-2 ring-teal-300 transition-all flex items-center gap-1.5 border border-teal-400";
    }
    if (typeof renderStaffDashboard === 'function') renderStaffDashboard();
  } else {
    // repairs (default)
    if (secRepairs) secRepairs.classList.remove('hidden');
    if (btnRepairs) btnRepairs.className = activeBtnClass;
    if (typeof renderTable === 'function') renderTable();
  }
}
window.switchTab = switchTab;

function getRepairFiscalYear(r) {
  // 1. จากเลขที่ใบส่งซ่อม เช่น 1/2570 -> 2570
  if (r.repairNo && r.repairNo.includes('/')) {
    const parts = r.repairNo.split('/');
    const yr = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(yr) && yr > 2400) return yr;
  }
  // 2. จากวันที่แจ้งซ่อม
  if (r.date) {
    const d = parseDateToObj(r.date);
    if (d) return getThaiFiscalYear(d);
  }
  return getThaiFiscalYear();
}

function updateFiscalYearFilterOptions() {
  const currentFY = getThaiFiscalYear();
  const fySet = new Set([currentFY]);
  repairs.forEach(r => {
    const fy = getRepairFiscalYear(r);
    if (fy) fySet.add(fy);
  });

  const sortedYears = Array.from(fySet).sort((a, b) => b - a);
  let html = `<option value="current">ปีงบประมาณปัจจุบัน (${currentFY})</option>`;
  sortedYears.forEach(y => {
    if (y !== currentFY) {
      html += `<option value="${y}">ปีงบประมาณ ${y}</option>`;
    }
  });
  html += `<option value="all">ทุกปีงบประมาณ (ทั้งหมด)</option>`;

  ['repairFiscalYearFilter', 'dashboardFiscalYearFilter', 'tableFiscalYearFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const curVal = el.value;
      el.innerHTML = html;
      if (curVal) el.value = curVal;
    }
  });
}

function onTableFiscalYearChange() {
  const tableVal = document.getElementById('tableFiscalYearFilter')?.value;
  const dashSel = document.getElementById('dashboardFiscalYearFilter');
  if (dashSel && tableVal) dashSel.value = tableVal;
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderDashboardTables === 'function') renderDashboardTables();
}

// ฟังก์ชันคำนวณจำนวนวันดำเนินการ (ระยะเวลาซ่อมหรือวันที่ค้างซ่อม)
function calculateRepairDays(r, today = new Date()) {
  if (!r.date) return -1;
  const reqDate = parseDateToObj(r.date);
  if (!reqDate) return -1;
  if (r.status === 'เสร็จสิ้น') {
    const compDate = r.completedDate ? parseDateToObj(r.completedDate) : reqDate;
    return compDate ? Math.max(0, Math.round((compDate - reqDate) / (1000 * 60 * 60 * 24))) : 0;
  } else {
    return Math.max(0, Math.floor((today - reqDate) / (1000 * 60 * 60 * 24)));
  }
}

// ฟังก์ชันเรียงลำดับรายการใบซ่อม
function sortRepairsList(list) {
  const sorted = [...list];
  const dirMultiplier = currentSortDirection === 'desc' ? -1 : 1;

  sorted.sort((a, b) => {
    if (currentSortColumn === 'date') {
      const da = a.date ? (parseDateToObj(a.date) || 0) : 0;
      const db = b.date ? (parseDateToObj(b.date) || 0) : 0;
      return (da - db) * dirMultiplier;
    }
    if (currentSortColumn === 'repairNo') {
      // เปรียบเทียบเลขที่ เช่น 1/2567 หรือสตริงทั่วไป
      return (a.repairNo || '').localeCompare(b.repairNo || '', 'th', { numeric: true }) * dirMultiplier;
    }
    if (currentSortColumn === 'duration') {
      const daysA = calculateRepairDays(a);
      const daysB = calculateRepairDays(b);
      return (daysA - daysB) * dirMultiplier;
    }
    if (currentSortColumn === 'cost') {
      const ca = parseFloat(a.cost) || 0;
      const cb = parseFloat(b.cost) || 0;
      return (ca - cb) * dirMultiplier;
    }
    if (currentSortColumn === 'div') {
      return (a.div || '').localeCompare(b.div || '', 'th') * dirMultiplier;
    }
    return 0;
  });

  return sorted;
}

function handleSortChange() {
  const sortSelect = document.getElementById('repairSortBy');
  if (!sortSelect) return;
  const [col, dir] = sortSelect.value.split('-');
  currentSortColumn = col;
  currentSortDirection = dir;
  updateSortIcons();
  resetRepairPageAndRender();
}

function toggleSortColumn(column) {
  if (currentSortColumn === column) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = column;
    currentSortDirection = (column === 'date' || column === 'duration' || column === 'cost') ? 'desc' : 'asc';
  }

  // อัปเดต dropdown ให้ตรงกันถ้ามีตัวเลือก
  const sortSelect = document.getElementById('repairSortBy');
  if (sortSelect) {
    const targetVal = `${currentSortColumn}-${currentSortDirection}`;
    for (let i = 0; i < sortSelect.options.length; i++) {
      if (sortSelect.options[i].value === targetVal) {
        sortSelect.selectedIndex = i;
        break;
      }
    }
  }

  updateSortIcons();
  resetRepairPageAndRender();
}

function updateSortIcons() {
  ['repairNo', 'date', 'div', 'duration', 'cost'].forEach(col => {
    const iconEl = document.getElementById(`sortIcon-${col}`);
    if (iconEl) {
      if (currentSortColumn === col) {
        iconEl.innerHTML = currentSortDirection === 'asc' ? '▲' : '▼';
        iconEl.className = 'text-teal-600 font-bold ml-0.5';
      } else {
        iconEl.innerHTML = '⇅';
        iconEl.className = 'text-slate-300 font-normal ml-0.5 text-[10px]';
      }
    }
  });
}

function renderTable() {
  const tbody = document.getElementById('repairTableBody');
  const mobileContainer = document.getElementById('repairMobileCardsContainer');
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const fyFilter = document.getElementById('repairFiscalYearFilter')?.value || 'current';
  const currentFY = getThaiFiscalYear();
  if (tbody) tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  updateSortIcons();

  const filtered = repairs.filter(r => {
    // 1. กรองตามปีงบประมาณ
    if (fyFilter !== 'all') {
      const targetFY = fyFilter === 'current' ? currentFY : parseInt(fyFilter, 10);
      const itemFY = getRepairFiscalYear(r);
      if (itemFY !== targetFY) return false;
    }

    // 2. กรองตามคำค้นหา
    return (
      (r.repairNo && r.repairNo.toLowerCase().includes(query)) ||
      (r.div && r.div.toLowerCase().includes(query)) ||
      (r.equipName && r.equipName.toLowerCase().includes(query)) ||
      (r.assignee && r.assignee.toLowerCase().includes(query)) ||
      (r.status && r.status.toLowerCase().includes(query)) ||
      (r.equipCode && r.equipCode.toLowerCase().includes(query))
    );
  });

  // ทำการเรียงลำดับ (Sort)
  const sortedRepairs = sortRepairsList(filtered);

  const pageSize = parseInt(document.getElementById('repairPageSize')?.value || '10');
  const totalItems = sortedRepairs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (currentRepairPage > totalPages) currentRepairPage = totalPages;
  if (currentRepairPage < 1) currentRepairPage = 1;

  const startIdx = (currentRepairPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pagedRepairs = sortedRepairs.slice(startIdx, endIdx);

  if (pagedRepairs.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">ไม่พบรายการข้อมูล</td></tr>`;
    if (mobileContainer) mobileContainer.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">ไม่พบรายการข้อมูล</div>`;
  } else {
    const today = new Date();
    pagedRepairs.forEach((r) => {
      const realIndex = repairs.findIndex(item => item.repairNo === r.repairNo);
      let statusBadge = "bg-slate-100 text-slate-700";
      if (r.status === 'เสร็จสิ้น') statusBadge = "bg-emerald-100 text-emerald-800";
      else if (r.status === 'กำลังดำเนินการ') statusBadge = "bg-blue-100 text-blue-800";
      else if (r.status === 'รออะไหล่/ช่างภายนอก') statusBadge = "bg-amber-100 text-amber-800";
      else if (r.status === 'จำหน่ายออก') statusBadge = "bg-rose-100 text-rose-800";

      // คำนวณระยะเวลาซ่อม หรือระยะเวลาที่ค้างซ่อม
      let durationBadge = `<span class="text-xs text-slate-400">-</span>`;
      let durationText = '-';
      if (r.date) {
        const reqDate = parseDateToObj(r.date);
        if (reqDate) {
          if (r.status === 'เสร็จสิ้น') {
            const compDate = r.completedDate ? parseDateToObj(r.completedDate) : reqDate;
            const days = compDate ? Math.max(0, Math.round((compDate - reqDate) / (1000 * 60 * 60 * 24))) : 0;
            durationText = `เสร็จสิ้น (${days} วัน)`;
            durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="เสร็จเมื่อ ${formatDateToBE(r.completedDate || r.date)}">⏱️ ${days} วัน</span>`;
          } else {
            // กำลังดำเนินการ / รอดำเนินการ
            const pendingDays = Math.max(0, Math.floor((today - reqDate) / (1000 * 60 * 60 * 24)));
            durationText = `ค้าง ${pendingDays} วัน`;
            if (pendingDays >= 14) {
              durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse" title="ค้างซ่อมเกิน 14 วัน!">⚠️ ${pendingDays} วัน</span>`;
            } else if (pendingDays >= 7) {
              durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200" title="ค้างซ่อมเกิน 7 วัน">⏳ ${pendingDays} วัน</span>`;
            } else {
              durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">${pendingDays} วัน</span>`;
            }
          }
        }
      }

      const canEditThis = canModifyRepair(r);
      const actionButtons = `
        <button onclick="previewWorkOrderSlip(${realIndex})" class="p-1 rounded hover:bg-slate-100 text-indigo-600 hover:text-indigo-800" title="พิมพ์ใบส่งซ่อม">
          <span class="text-sm">🖨️</span>
        </button>
        ${canEditThis ? `<button onclick="editRepair(${realIndex})" class="text-xs text-teal-600 hover:text-teal-800 font-medium px-1">แก้ไข</button>` : ''}
        ${canEditThis ? `<button onclick="deleteRepair(${realIndex})" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-1">ลบ</button>` : ''}
      `;

      // 1. เรนเดอร์ตารางบนคอมและแท็บเล็ต
      if (tbody) {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b transition-colors";
        tr.innerHTML = `
          <td class="py-3 px-4 font-bold text-teal-700 font-mono text-sm">${r.repairNo}</td>
          <td class="py-3 px-4 text-slate-500">${formatDateToBE(r.date)}</td>
          <td class="py-3 px-4 font-medium">${r.div}</td>
          <td class="py-3 px-4">
            <div class="font-medium text-slate-800">${r.equipName}</div>
            <div class="text-xs text-slate-400 font-mono">${r.equipCode || '-'} | ${r.category}</div>
          </td>
          <td class="py-3 px-4 text-slate-600 max-w-xs truncate" title="${r.symptom}">${r.symptom}</td>
          <td class="py-3 px-4">
            <div class="inline-flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md font-medium border border-indigo-100">
              <span>👷</span> ${r.assignee || 'ยังไม่มอบหมาย'}
            </div>
          </td>
          <td class="py-3 px-4">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge}">${r.status}</span>
            <div class="text-xs text-slate-500 mt-1">${r.step || '-'}</div>
          </td>
          <td class="py-3 px-4 text-center">
            ${durationBadge}
          </td>
          <td class="py-3 px-4 text-right font-medium text-slate-700">${Number(r.cost).toLocaleString()}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              ${actionButtons}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      }

      // 2. เรนเดอร์การ์ดบนโทรศัพท์มือถือ (Mobile Cards View) - ออกแบบสำหรับช่างและเจ้าหน้าที่หน้างานโดยเฉพาะ
      if (mobileContainer) {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border border-slate-200/90 shadow-md space-y-3 transition-all hover:border-teal-400";
        card.innerHTML = `
          <!-- Card Header: เลขที่ใบซ่อม & สถานะชัดเจน -->
          <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-teal-800 font-mono text-base tracking-tight">${r.repairNo}</span>
                ${durationBadge}
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">📅 วันที่แจ้ง: ${formatDateToBE(r.date)}</div>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${statusBadge}">${r.status}</span>
          </div>

          <!-- Card Body: ข้อมูลอุปกรณ์, แผนก, และอาการชำรุด -->
          <div class="space-y-1.5">
            <div class="flex items-start justify-between gap-1">
              <h4 class="font-bold text-slate-900 text-sm leading-snug">${r.equipName}</h4>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="inline-flex items-center gap-1 text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md font-semibold border border-teal-100">
                🏢 ${r.div}
              </span>
              ${r.equipCode ? `<span class="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-mono text-[11px] border border-purple-100">🏷️ ${r.equipCode}</span>` : ''}
            </div>
            <div class="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100 leading-relaxed">
              <strong class="text-rose-600">อาการ:</strong> ${r.symptom || '-'}
            </div>
          </div>

          <!-- Card Assignee & Cost -->
          <div class="flex items-center justify-between text-xs bg-slate-50/70 p-2 rounded-xl border border-slate-100">
            <div class="flex items-center gap-1 text-slate-600">
              <span>👷 ช่าง:</span>
              <strong class="text-indigo-700">${r.assignee || 'ยังไม่มอบหมาย'}</strong>
            </div>
            <div>
              <span class="text-slate-400 text-[11px]">ค่าใช้จ่าย:</span>
              <strong class="text-emerald-700 text-sm ml-1">${Number(r.cost || 0).toLocaleString()} ฿</strong>
            </div>
          </div>

          <!-- Quick Action Buttons สำหรับช่างและเจ้าหน้าที่บนมือถือ -->
          <div class="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
            <button onclick="previewWorkOrderSlip(${realIndex})" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-sm active:scale-95">
              <span>🖨️</span> ใบส่งซ่อม
            </button>
            ${canEditThis ? `
            <button onclick="editRepair(${realIndex})" class="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-sm active:scale-95">
              <span>⚡</span> อัปเดตงาน
            </button>
            <button onclick="deleteRepair(${realIndex})" class="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95">
              <span>🗑️</span> ลบ
            </button>` : `
            <div class="col-span-2 text-right text-[11px] text-slate-400 py-2 self-center">
              🔒 สิทธิ์ดูอย่างเดียว
            </div>
            `}
          </div>
        `;
        mobileContainer.appendChild(card);
      }
    });
  }

  const infoEl = document.getElementById('repairPaginationInfo');
  if (infoEl) {
    infoEl.innerText = totalItems > 0 ? `${startIdx + 1}-${endIdx} จาก ${totalItems} รายการ` : '0 จาก 0 รายการ';
  }
  const btnPrev = document.getElementById('btnRepairPrev');
  const btnNext = document.getElementById('btnRepairNext');
  if (btnPrev) btnPrev.disabled = (currentRepairPage <= 1);
  if (btnNext) btnNext.disabled = (currentRepairPage >= totalPages);
}

function resetRepairPageAndRender() {
  currentRepairPage = 1;
  renderTable();
}

function changeRepairPage(step) {
  currentRepairPage += step;
  renderTable();
}

function onStatusChange(statusVal) {
  const compDateInput = document.getElementById('formCompletedDate');
  if (!compDateInput) return;
  if (statusVal === 'เสร็จสิ้น') {
    if (!compDateInput.value) {
      const todayIso = new Date().toISOString().split('T')[0];
      setRepairDatePickerValue('formCompletedDate_d', 'formCompletedDate_m', 'formCompletedDate_y', 'formCompletedDate', todayIso);
    }
  }
}

// ฟังก์ชันตรวจสอบสิทธิ์การแก้ไข/ลบใบส่งซ่อม
function canModifyRepair(r) {
  const profile = window.currentUserProfile;
  if (!profile) return true; // ถ้าไม่มีระบบ auth ทำงาน ให้ทำตามปกติ
  const role = profile.role || 'general_user';
  if (role === 'admin' || role === 'technician' || role === 'parcel_staff') {
    return true;
  }
  // ถ้าเป็น general_user หรืออื่นๆ: แก้ไขได้เฉพาะใบที่ตนเองเป็นผู้แจ้งซ่อม หรือ แผนกตรงกับแผนกของตน
  const currentUserName = (profile.name || '').trim().toLowerCase();
  const currentUserDept = (profile.department || '').trim().toLowerCase();
  const requester = (r.requester || '').trim().toLowerCase();
  const div = (r.div || '').trim().toLowerCase();

  const isOwner = requester && currentUserName && (requester.includes(currentUserName) || currentUserName.includes(requester));
  const isSameDept = div && currentUserDept && (div === currentUserDept || div.includes(currentUserDept) || currentUserDept.includes(div));

  return isOwner || isSameDept;
}

function openModal() {
  document.getElementById('repairModal').classList.remove('hidden');
  document.getElementById('modalTitle').innerText = 'บันทึกข้อมูลใบส่งซ่อม';
  document.getElementById('repairForm').reset();
  document.getElementById('editIndex').value = '';

  document.getElementById('formRepairNo').value = generateNextRepairNo();
  
  const todayIso = new Date().toISOString().split('T')[0];
  setRepairDatePickerValue('formDate_d', 'formDate_m', 'formDate_y', 'formDate', todayIso);
  clearRepairDatePicker('formCompletedDate_d', 'formCompletedDate_m', 'formCompletedDate_y', 'formCompletedDate');
  
  document.getElementById('formAssignee').value = '';

  // เติมอัตโนมัติตามโปรไฟล์ผู้ใช้ปัจจุบัน
  const profile = window.currentUserProfile;
  if (profile) {
    if (profile.name) document.getElementById('formRequester').value = profile.name;
    if (profile.department) document.getElementById('formDept').value = profile.department;
  } else {
    document.getElementById('formRequester').value = '';
  }

  renderTechnicianBadges();
}

function closeModal() {
  document.getElementById('repairModal').classList.add('hidden');
}

function editRepair(idx) {
  const r = repairs[idx];
  if (!r) return;
  if (!canModifyRepair(r)) {
    alert("⛔ ขออภัย: คุณสามารถแก้ไขได้เฉพาะใบส่งซ่อมของตนเองหรือแผนกของคุณเท่านั้น");
    return;
  }
  openModal();
  document.getElementById('modalTitle').innerText = 'แก้ไขข้อมูลใบส่งซ่อม';
  document.getElementById('editIndex').value = idx;
  document.getElementById('formRepairNo').value = r.repairNo;
  setRepairDatePickerValue('formDate_d', 'formDate_m', 'formDate_y', 'formDate', r.date);
  setRepairDatePickerValue('formCompletedDate_d', 'formCompletedDate_m', 'formCompletedDate_y', 'formCompletedDate', r.completedDate || '');
  document.getElementById('formDept').value = r.div;
  document.getElementById('formRequester').value = r.requester || '';
  document.getElementById('formCategory').value = r.category;
  document.getElementById('formEquipCode').value = r.equipCode || '';
  document.getElementById('formEquipName').value = r.equipName;
  document.getElementById('formSymptom').value = r.symptom;
  document.getElementById('formAssignee').value = r.assignee || '';
  document.getElementById('formStatus').value = r.status;
  document.getElementById('formStep').value = r.step || '';
  document.getElementById('formCost').value = r.cost;
}

async function deleteRepair(idx) {
  const repairItem = repairs[idx];
  if (!repairItem) return;
  if (!canModifyRepair(repairItem)) {
    alert("⛔ ขออภัย: คุณสามารถลบได้เฉพาะใบส่งซ่อมของตนเองหรือแผนกของคุณเท่านั้น");
    return;
  }
  const repairNo = repairItem.repairNo;
  if (!confirm(`คุณต้องการลบใบส่งซ่อม ${repairNo} หรือไม่?\n\n⚠️ ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร`)) return;

  if (window.isFirebaseReady) {
    const ok = await window.deleteRepairFromCloud(repairNo);
    if (!ok) {
      alert('❌ ลบข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ');
      return;
    }
    // Audit Log: บันทึกประวัติการลบใบส่งซ่อม
    if (typeof window.logAuditAction === 'function') {
      window.logAuditAction('DELETE', 'repair', repairNo, {
        equipName: repairItem.equipName || '',
        symptom: repairItem.symptom || '',
        div: repairItem.div || ''
      });
    }
    repairs.splice(idx, 1);
    saveRepairs(repairs);
    renderTable();
    renderDashboard();
  } else {
    // fallback: ลบ local เท่านั้น
    repairs.splice(idx, 1);
    saveRepairs(repairs);
    renderTable();
    renderDashboard();
  }
}

async function saveRepair(e) {
  e.preventDefault();
  const idx = document.getElementById('editIndex').value;
  const isEditing = (idx !== '');
  const oldRepair = isEditing && repairs[idx] ? { ...repairs[idx] } : null;

  const dataObj = {
    repairNo: document.getElementById('formRepairNo').value.trim(),
    date: document.getElementById('formDate').value,
    completedDate: document.getElementById('formCompletedDate').value || '',
    div: document.getElementById('formDept').value.trim(),
    requester: document.getElementById('formRequester').value.trim() || 'ไม่ระบุผู้แจ้ง',
    category: document.getElementById('formCategory').value,
    equipCode: document.getElementById('formEquipCode').value.trim(),
    equipName: document.getElementById('formEquipName').value.trim(),
    symptom: document.getElementById('formSymptom').value.trim(),
    assignee: document.getElementById('formAssignee').value.trim() || 'ยังไม่ระบุ',
    status: document.getElementById('formStatus').value,
    step: document.getElementById('formStep').value.trim(),
    cost: parseFloat(document.getElementById('formCost').value) || 0
  };

  dataObj.id = dataObj.repairNo;

  // ─── บันทึกไป Firebase (source of truth) ───────────────────────────────────
  if (window.isFirebaseReady) {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังบันทึก...'; }

    const ok = await window.saveRepairToCloud(dataObj, !isEditing);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'บันทึกข้อมูล'; }

    if (!ok) {
      alert('❌ บันทึกไปยังฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง');
      return; // ไม่ปิด modal เพื่อให้ผู้ใช้ลองใหม่ได้
    }

    // ถ้ามีการรันเลขใหม่เนื่องจากชนกับผู้อื่น ให้แจ้งผู้ใช้ทราบ
    if (!isEditing && dataObj.repairNo !== document.getElementById('formRepairNo').value.trim()) {
      alert(`ℹ️ มีการส่งใบซ่อมพร้อมกัน ระบบจึงได้รันเลขที่ใบส่งซ่อมใหม่ให้อัตโนมัติเป็น: ${dataObj.repairNo}`);
    }

    // Audit Log: บันทึกประวัติการสร้างหรือแก้ไขใบส่งซ่อม
    if (typeof window.logAuditAction === 'function') {
      const actionType = isEditing ? 'UPDATE' : 'CREATE';
      const logDetails = {
        equipName: dataObj.equipName,
        status: dataObj.status,
        cost: dataObj.cost,
        div: dataObj.div
      };
      if (isEditing && oldRepair) {
        logDetails.previousStatus = oldRepair.status;
        logDetails.previousCost = oldRepair.cost;
      }
      window.logAuditAction(actionType, 'repair', dataObj.repairNo, logDetails);
    }

    // สำรองข้อมูลลง LocalStorage ทันที
    const existingIdx = repairs.findIndex(r => r.repairNo === dataObj.repairNo);
    if (existingIdx >= 0) {
      repairs[existingIdx] = dataObj;
    } else {
      repairs.unshift(dataObj);
    }
    saveRepairs(repairs);
    updateFiscalYearFilterOptions();
    renderTable();
    renderDashboard();
  } else {
    // ไม่มี Firebase → บันทึก local เท่านั้น (fallback)
    if (idx === '') {
      repairs.unshift(dataObj);
    } else {
      repairs[parseInt(idx)] = dataObj;
    }
    saveRepairs(repairs);
    updateFiscalYearFilterOptions();
    renderTable();
    renderDashboard();
  }

  if (dataObj.assignee && dataObj.assignee !== 'ยังไม่ระบุ' && !technicians.includes(dataObj.assignee)) {
    technicians.push(dataObj.assignee);
    saveTechnicians(technicians);
  }

  closeModal();
}

// Manual sync function to fetch latest data from Cloud Firestore
async function manualSyncFromCloud() {
  if (!isFirebaseReady) {
    alert("ระบบยังไม่ได้เชื่อมต่อกับ Cloud หรือไม่ได้ระบุ API Key");
    return;
  }

  const cloudRepairs = await window.fetchRepairsFromCloud();
  const cloudEquips = await window.fetchEquipmentsFromCloud();

  if (cloudRepairs.length > 0) repairs = cloudRepairs;
  if (cloudEquips.length > 0) equipments = cloudEquips;

  saveRepairs(repairs);
  saveEquipments(equipments);
  updateEquipmentDatalist();
  updateDivDatalist();
  updateFiscalYearFilterOptions();
  renderDashboard();
  renderTable();
  alert("ดึงข้อมูลล่าสุดจากฐานข้อมูลสำเร็จ!");
}

// Updated window.onload to initialize Firebase and fetch data
window.onload = function() {
  // ── ล้างข้อมูลตัวอย่างเก่าออกจาก localStorage ────────────────────────────────
  // (ทำครั้งเดียว: ถ้า Firebase sync มาแล้วก็จะ overwrite ให้เอง)
  const legacyKeys = ['phayuha_repairs', 'phayuha_equipments', 'phayuha_technicians'];
  legacyKeys.forEach(k => {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        // ถ้า key นี้ยังเป็นข้อมูลตัวอย่าง (มีชื่อ "ช่างวิรัช" ซึ่งเป็น default) ให้ล้างออก
        const str = JSON.stringify(parsed);
        if (str.includes('ช่างวิรัช') || str.includes('6510-001-0001')) {
          localStorage.removeItem(k);
          console.log(`🧹 ล้าง legacy data: ${k}`);
        }
      }
    } catch (_) {}
  });

  repairs = loadRepairs();
  equipments = loadEquipments();
  technicians = loadTechnicians();
  staffList = loadStaff();
  updateEquipmentDatalist();
  updateDivDatalist();
  if (typeof updateRequesterDatalist === 'function') updateRequesterDatalist();
  if (typeof renderTechnicianBadges === 'function') renderTechnicianBadges();
  updateFiscalYearFilterOptions();
  renderDashboard();
  renderTable();
};

window.startFirebaseSync = async function() {
  // ตรวจสอบว่าล็อกอินผ่านแล้วหรือยัง ถ้ายังไม่ล็อกอินห้ามยิงเด็ดขาด
  if (!window.currentUserProfile) {
    console.log("🔒 รอผู้ใช้เข้าสู่ระบบก่อนเริ่มซิงค์ Firebase...");
    return;
  }
  console.log("กำลังดึงข้อมูลล่าสุดจาก Firebase...");

  if (!window.isFirebaseReady) {
    if (typeof window.setSyncStatus === 'function') window.setSyncStatus("offline");
    return;
  }

  if (typeof window.setSyncStatus === 'function') window.setSyncStatus("saving");

  // ── ดึง equipments ใน Background (Non-blocking) เพื่อให้เข้าใช้งานหน้าแรกได้ทันที ──
  setTimeout(async () => {
    try {
      const cloudEquips = await window.fetchEquipmentsFromCloud();
      if (cloudEquips && cloudEquips.length > 0) {
        equipments = cloudEquips;
        saveEquipments(equipments);
        updateEquipmentDatalist();
        updateDivDatalist();
      }
    } catch (e) {
      console.warn("Background equipments fetch notice:", e);
    }
  }, 100);

  // ── ฟัง staff realtime ───────────────────────────────────────────────────────
  if (typeof window.listenToStaffRealtime === 'function') {
    window._unsubscribeStaff = window.listenToStaffRealtime((cloudStaff) => {
      staffList = cloudStaff;
      saveStaff(staffList);
      // อัปเดต technicians จาก staff list ใหม่
      technicians = staffList.filter(s => s.role === 'technician').map(s => s.name);
      saveTechnicians(technicians);
      if (typeof renderTechnicianBadges === 'function') renderTechnicianBadges();
      if (typeof updateRequesterDatalist === 'function') updateRequesterDatalist();
      if (typeof renderStaffManagementTable === 'function') renderStaffManagementTable();
      console.log(`✅ Staff sync: ${staffList.length} คน`);
    });
  }

  // ── ฟัง repairs แบบ realtime ─────────────────────────────────────────────────
  window._unsubscribeRepairs = window.listenToRepairsRealtime((cloudRepairs) => {
    repairs = cloudRepairs;
    saveRepairs(repairs);
    updateFiscalYearFilterOptions();
    renderDashboard();
    renderTable();
    if (typeof updateRequesterDatalist === 'function') updateRequesterDatalist();
    if (typeof window.setSyncStatus === 'function') window.setSyncStatus("ok");
    console.log(`✅ Realtime sync: ${repairs.length} รายการ`);
  });
};

// ─── ระบบพิมพ์ใบส่งซ่อม / ใบรับเครื่อง (Work Order Slip) ─────────────────────

/**
 * เปิด Modal แสดงตัวอย่างใบส่งซ่อมที่สมบูรณ์พร้อมพิมพ์
 * @param {number} idx - index ใน repairs[]
 */


// ══════════════════════════════════════════════════════════════════════════════
// ระบบแบบฟอร์มใบส่งซ่อม/ขออนุมัติซ่อม โรงพยาบาลพยุหะคีรี (Interactive Official Form)
// - ถอดแบบเป๊ะ 100% ตามต้นฉบับเอกสารราชการของโรงพยาบาล
// - แก้ไขข้อความได้ทุกช่องก่อนพิมพ์ (Editable In-Place)
// - เมื่อกดที่ช่อง ถ้าเป็นข้อความจุดประหรือตัวอย่างเริ่มต้น ให้เคลียร์เป็นช่องว่างทันที
// - ถ้ามีข้อความที่พิมพ์ไว้แล้ว เมื่อกดซ้ำจะพิมพ์ต่อได้ตามปกติ ไม่ลบข้อความเดิม
// - ซิงค์สองทาง: พิมพ์ในแบบฟอร์มนี้แล้วกดบันทึกลงระบบได้ทันที
// ══════════════════════════════════════════════════════════════════════════════

let currentSlipRepairIndex = null; // null คือสร้างใบใหม่, ตัวเลขคือแก้ไขรายการเดิม

function openNewWorkOrderDirectSlip() {
  const newRepairNo = (typeof generateNextRepairNo === 'function') ? generateNextRepairNo() : '';
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  
  const dummyRepair = {
    repairNo: newRepairNo,
    date: todayISO,
    completedDate: '',
    div: '',
    requester: '',
    category: 'เครื่องมือเครื่องใช้อื่นๆ',
    equipCode: '',
    equipName: '',
    symptom: '',
    assignee: 'ยังไม่ระบุ',
    status: 'รอดำเนินการ',
    step: '',
    cost: 0
  };

  currentSlipRepairIndex = null;
  renderInteractiveWorkOrderSlip(dummyRepair, true);
}

function previewWorkOrderSlip(idx) {
  const r = repairs[idx];
  if (!r) return;
  currentSlipRepairIndex = idx;
  renderInteractiveWorkOrderSlip(r, false);
}

function closePrintWorkOrderModal() {
  const modalEl = document.getElementById('printWorkOrderModal');
  if (modalEl) modalEl.classList.add('hidden');
}

// ฟังก์ชันเคลียร์ค่าเริ่มต้น/จุดประ เมื่อผู้ใช้คลิกพิมพ์ครั้งแรก
function handleSlipFieldFocus(el) {
  if (!el) return;
  // ถ้าเคยแก้ไขไปแล้ว (ผู้ใช้พิมพ์จริง) ให้ข้าม ไม่ต้องล้าง
  if (el.dataset.userEdited === 'true') return;

  const currentText = (el.innerText || '').trim();
  const placeholder = (el.dataset.placeholder || '').trim();

  // ตรวจว่าเป็นจุดไข่ปลา หรือเป็นข้อความ placeholder เริ่มต้นหรือไม่
  const isDots = /^[\.…_]+$/.test(currentText);
  const isDefaultPlaceholder = (currentText === placeholder) || 
    ['ระบุชื่อครุภัณฑ์', 'ระบุอาการชำรุด...', 'ไม่ระบุผู้แจ้ง', 'ยังไม่ระบุ', 'ไม่ระบุกลุ่มงาน'].includes(currentText);

  if (isDots || isDefaultPlaceholder) {
    el.innerText = '';
  }
}

// ฟังก์ชันเมื่อผู้ใช้พิมพ์ข้อความลงไปจริง
function handleSlipFieldInput(el) {
  if (!el) return;
  el.dataset.userEdited = 'true';
}

// ฟังก์ชันเมื่อผู้ใช้คลิกออกจากช่อง ถ้าปล่อยว่างไว้ให้คืนค่าจุดประหรือ placeholder เดิมเพื่อรักษาหน้าตาเอกสาร
function handleSlipFieldBlur(el) {
  if (!el) return;
  const currentText = (el.innerText || '').trim();
  if (!currentText) {
    el.dataset.userEdited = 'false';
    el.innerText = el.dataset.placeholder || '';
  }
}

function renderInteractiveWorkOrderSlip(r, isNew = false) {
  const contentEl = document.getElementById('printWorkOrderContent');
  const modalEl = document.getElementById('printWorkOrderModal');
  if (!contentEl || !modalEl) return;

  // แยกวันที่แจ้งซ่อม วัน / เดือน / ปี พ.ศ.
  const reqDateObj = r.date ? parseDateToObj(r.date) : new Date();
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  let reqDay = reqDateObj ? reqDateObj.getDate() : '';
  let reqMonth = reqDateObj ? thaiMonths[reqDateObj.getMonth()] : '';
  let reqYear = reqDateObj ? (reqDateObj.getFullYear() > 2400 ? reqDateObj.getFullYear() : reqDateObj.getFullYear() + 543) : '';

  // ดึงข้อมูลครุภัณฑ์จากทะเบียนพัสดุ (ถ้ามีตรงกัน)
  const code = (r.equipCode || '').trim();
  const eqInfo = equipments.find(e => (e.equipCode && e.equipCode === code) || (e.noid && e.noid === code)) || {};
  const buyYear = eqInfo.receivedDate ? (parseDateToObj(eqInfo.receivedDate)?.getFullYear() || '') : (eqInfo.buyYear || '');
  const buyYearBE = buyYear ? (Number(buyYear) > 2400 ? buyYear : Number(buyYear) + 543) : '';
  const buyPrice = eqInfo.price ? Number(eqInfo.price).toLocaleString() : (eqInfo.perUnit ? Number(String(eqInfo.perUnit).replace(/,/g, '')).toLocaleString() : '');
  const buyFrom = eqInfo.method || eqInfo.vendor || '';

  // นับครั้งที่ซ่อมของครุภัณฑ์ชิ้นนี้
  const repairHistoryCount = repairs.filter(item => {
    if (code && item.equipCode === code) return true;
    return r.equipName && item.equipName === r.equipName;
  }).length;
  const repairTimes = repairHistoryCount > 0 ? repairHistoryCount : (isNew ? '1' : '1');

  // ตรวจสอบประเภทครุภัณฑ์ (Checkbox)
  const cat = (r.category || '').toLowerCase();
  const isMedical = cat.includes('แพทย์') || cat.includes('รักษา') || cat.includes('พยาบาล');
  const isBuilding = cat.includes('อาคาร') || cat.includes('สิ่งก่อสร้าง') || cat.includes('สถานที่');
  const isOther = !isMedical && !isBuilding;

  const html = `
    <div class="official-work-order-sheet font-sarabun text-black bg-white mx-auto" style="font-family: 'TH SarabunPSK', 'TH Sarabun New', 'Sarabun', 'Prompt', sans-serif; width: 100%; max-width: 195mm; color: #000; line-height: 1.35; font-size: 14pt;">
      
      <!-- แถบแจ้งเตือนการแก้ไขได้ -->
      <div class="no-print bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg mb-2 text-xs flex items-center justify-between">
        <span>✏️ <strong>ระบบกรอกข้อมูลอัจฉริยะ:</strong> เมื่อกดที่ช่องจุดประ ช่องจะว่างให้อัตโนมัติพร้อมให้พิมพ์ทันที และหากเคยพิมพ์ข้อความไว้แล้วจะสามารถกดพิมพ์ต่อได้ต่อเนื่อง</span>
      </div>

      <!-- ส่วนหัวเอกสาร: หัวเรื่องและกล่องเลขที่ใบซ่อม -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2mm;">
        <div style="width: 25%;"></div>
        <div style="width: 50%; text-align: center;">
          <h2 style="font-size: 17pt; font-weight: bold; margin: 0; line-height: 1.2;">ใบส่งซ่อม/ขออนุมัติซ่อม</h2>
          <h3 style="font-size: 16pt; font-weight: bold; margin: 0; line-height: 1.2;">โรงพยาบาลพยุหะคีรี</h3>
        </div>
        <div style="width: 28%; border: 1.2px solid #000; padding: 3px 6px; font-size: 12pt; line-height: 1.25;">
          <div>เลขที่ใบซ่อม <span id="slip_repairNo" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="ระบุเลขที่..." style="font-weight: bold; font-family: monospace; font-size: 13pt; min-width: 50px; display: inline-block;">${r.repairNo || ''}</span></div>
          <div>วันที่...<span id="slip_day" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="........" style="font-weight: bold;">${reqDay || '........'}</span>...เดือน...<span id="slip_month" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="...................." style="font-weight: bold;">${reqMonth || '....................'}</span>...ปี...<span id="slip_year" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="............" style="font-weight: bold;">${reqYear || '............'}</span>...</div>
        </div>
      </div>

      <!-- เสนอ -->
      <div style="font-weight: bold; font-size: 14.5pt; margin-bottom: 2mm;">
        เสนอ &nbsp;ผู้อำนวยการโรงพยาบาลพยุหะคีรี
      </div>

      <!-- กล่องส่วนที่ 1: ส่วนผู้ขออนุมัติซ่อม -->
      <div style="border: 1.2px solid #000; padding: 5px 8px; margin-bottom: 2.5mm; font-size: 13.5pt;">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
          <span>มีความประสงค์ขอซ่อมแซม</span>
          <label style="display: inline-flex; align-items: center; margin-left: 6px; cursor: pointer;">
            <input type="radio" name="slip_category_radio" value="เครื่องมือแพทย์" ${isMedical ? 'checked' : ''} style="margin-right: 4px;"> เครื่องมือเครื่องใช้ทางการแพทย์
          </label>
          <label style="display: inline-flex; align-items: center; margin-left: 6px; cursor: pointer;">
            <input type="radio" name="slip_category_radio" value="เครื่องมือเครื่องใช้อื่นๆ" ${isOther ? 'checked' : ''} style="margin-right: 4px;"> เครื่องมือเครื่องใช้อื่นๆ
          </label>
          <label style="display: inline-flex; align-items: center; margin-left: 6px; cursor: pointer;">
            <input type="radio" name="slip_category_radio" value="อาคาร/สิ่งก่อสร้าง" ${isBuilding ? 'checked' : ''} style="margin-right: 4px;"> อาคาร/สิ่งก่อสร้าง
          </label>
        </div>

        <div style="margin-top: 4px;">
          ชื่อรายการ/ครุภัณฑ์: <span id="slip_equipName" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="ระบุชื่อครุภัณฑ์" style="font-weight: bold; text-decoration: underline; text-underline-offset: 3px; min-width: 120px; display: inline-block;">${r.equipName || 'ระบุชื่อครุภัณฑ์'}</span>
          &nbsp;&nbsp;&nbsp;&nbsp;
          หมายเลขครุภัณฑ์: <span id="slip_equipCode" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="................................................" style="font-weight: bold; font-family: monospace; font-size: 13pt; min-width: 120px; display: inline-block;">${r.equipCode || '................................................'}</span>
        </div>

        <div style="margin-top: 4px; min-height: 38px;">
          อาการเสีย/เหตุผล: <span id="slip_symptom" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="ระบุอาการชำรุด..." style="font-weight: bold; border-bottom: 1px dotted #000; padding-bottom: 1px; width: 85%; display: inline-block;">${r.symptom || 'ระบุอาการชำรุด...'}</span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px;">
          <div style="width: 48%; font-size: 12.5pt; line-height: 1.3;">
            <div>ปีที่ซื้อ...............<span id="slip_buyYear" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="........................" style="font-weight: bold;">${buyYearBE || '........................'}</span>...............</div>
            <div>ราคา...............<span id="slip_buyPrice" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="........................" style="font-weight: bold;">${buyPrice || '........................'}</span>...............ที่ซื้อ.....<span id="slip_buyFrom" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="........................................" style="font-weight: bold;">${buyFrom || '........................................'}</span>.....</div>
            <div>ซ่อมครั้งที่...........<span id="slip_repairTimes" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="1" style="font-weight: bold;">${repairTimes || '1'}</span>...........</div>
          </div>
          <div style="width: 48%; text-align: center; font-size: 12.5pt; line-height: 1.25;">
            <div>ลงชื่อ....................................................................ผู้ขออนุมัติซ่อม</div>
            <div style="margin-top: 2px;">( <span id="slip_requester" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="................................................................" style="font-weight: bold; min-width: 120px; display: inline-block;">${r.requester || '................................................................'}</span> )</div>
            <div style="margin-top: 2px;">ตำแหน่งหัวหน้ากลุ่มงาน/หน่วยงาน <span id="slip_dept" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="................................" style="font-weight: bold; min-width: 80px; display: inline-block;">${r.div || '................................'}</span></div>
          </div>
        </div>
      </div>

      <!-- กล่องส่วนที่ 2: ช่างได้ตรวจสอบตามรายการที่ขออนุมัติซ่อมแล้วปรากฏว่า -->
      <div style="border: 1.2px solid #000; padding: 5px 8px; margin-bottom: 2.5mm; font-size: 13.5pt;">
        <div style="font-weight: bold;">1. ช่างได้ตรวจสอบตามรายการที่ขออนุมัติซ่อมแล้วปรากฏว่า</div>
        <div style="margin-left: 12px; margin-top: 2px; font-size: 13pt; line-height: 1.3;">
          <div>
            <label style="cursor: pointer; margin-right: 15px;"><input type="radio" name="slip_action_type" value="free"> ดำเนินการแล้วโดยไม่เสียค่าใช้จ่าย</label>
            <label style="cursor: pointer;"><input type="radio" name="slip_action_type" value="cost" ${Number(r.cost) > 0 ? 'checked' : ''}> รอการจัดซื้อวัสดุในการซ่อมแซมเป็นเงิน..........<strong id="slip_cost" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="........................" style="text-decoration: underline; min-width: 40px; display: inline-block;">${Number(r.cost) > 0 ? Number(r.cost).toLocaleString() : '........................'}</strong>..........บาท</label>
          </div>
          <div style="margin-top: 2px;">
            <label style="cursor: pointer; margin-right: 15px;"><input type="radio" name="slip_action_type" value="outsource"> เห็นควรจ้างผู้ขายดำเนินการ/ผู้รับจ้างจากภายนอก</label>
            <label style="cursor: pointer;"><input type="radio" name="slip_action_type" value="discard"> ส่งให้เจ้าหน้าที่พัสดุแทงชำรุด</label>
          </div>
        </div>

        <div style="margin-top: 3px; font-size: 13pt;">
          เหตุผล: <span id="slip_step" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="..................................................................................................................................................................................................." style="font-weight: bold; border-bottom: 1px dotted #000; width: 90%; display: inline-block;">${r.step || '...................................................................................................................................................................................................'}</span>
        </div>

        <!-- ตารางรายการวัสดุที่ใช้ซ่อมแซม/วัสดุที่ขอจัดซื้อ (5 แถวเป๊ะตามแบบฟอร์ม พิมพ์แก้ได้) -->
        <div style="margin-top: 4px;">
          <div style="font-weight: bold; font-size: 12.5pt; margin-bottom: 2px;">รายการวัสดุที่ใช้ซ่อมแซม/วัสดุที่ขอจัดซื้อ</div>
          <table style="width: 100%; border-collapse: collapse; border: 1.2px solid #000; font-size: 12pt; text-align: center;">
            <thead>
              <tr style="border-bottom: 1.2px solid #000; background-color: #f8fafc;">
                <th style="border-right: 1.2px solid #000; width: 10%; padding: 2px 4px;">ลำดับ</th>
                <th style="border-right: 1.2px solid #000; width: 55%; padding: 2px 4px;">รายการ</th>
                <th style="border-right: 1.2px solid #000; width: 15%; padding: 2px 4px;">จำนวน</th>
                <th style="width: 20%; padding: 2px 4px;">ราคา</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #000; height: 19px;">
                <td style="border-right: 1.2px solid #000;">1.</td>
                <td id="slip_item_name_1" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000; text-align: left; padding-left: 6px;">${r.step && r.cost > 0 ? r.step : ''}</td>
                <td id="slip_item_qty_1" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000;">${r.cost > 0 ? '1 งาน' : ''}</td>
                <td id="slip_item_price_1" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="text-align: right; padding-right: 6px;">${r.cost > 0 ? Number(r.cost).toLocaleString() : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #000; height: 19px;">
                <td style="border-right: 1.2px solid #000;">2.</td>
                <td id="slip_item_name_2" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000; text-align: left; padding-left: 6px;"></td>
                <td id="slip_item_qty_2" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000;"></td>
                <td id="slip_item_price_2" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="text-align: right; padding-right: 6px;"></td>
              </tr>
              <tr style="border-bottom: 1px solid #000; height: 19px;">
                <td style="border-right: 1.2px solid #000;">3.</td>
                <td id="slip_item_name_3" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000; text-align: left; padding-left: 6px;"></td>
                <td id="slip_item_qty_3" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000;"></td>
                <td id="slip_item_price_3" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="text-align: right; padding-right: 6px;"></td>
              </tr>
              <tr style="border-bottom: 1px solid #000; height: 19px;">
                <td style="border-right: 1.2px solid #000;">4.</td>
                <td id="slip_item_name_4" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000; text-align: left; padding-left: 6px;"></td>
                <td id="slip_item_qty_4" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000;"></td>
                <td id="slip_item_price_4" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="text-align: right; padding-right: 6px;"></td>
              </tr>
              <tr style="height: 19px;">
                <td style="border-right: 1.2px solid #000;">5.</td>
                <td id="slip_item_name_5" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000; text-align: left; padding-left: 6px;"></td>
                <td id="slip_item_qty_5" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="border-right: 1.2px solid #000;"></td>
                <td id="slip_item_price_5" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="" style="text-align: right; padding-right: 6px;"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 4px; font-size: 13pt;">
          กำหนดระยะเวลาการแล้วเสร็จ 
          <label style="cursor: pointer; margin-right: 10px;"><input type="radio" name="slip_days_plan" value="1-3"> 1-3 วัน</label>
          <label style="cursor: pointer; margin-right: 10px;"><input type="radio" name="slip_days_plan" value="7" checked> 7 วัน</label>
          <label style="cursor: pointer; margin-right: 10px;"><input type="radio" name="slip_days_plan" value="15"> 15 วัน</label>
          <label style="cursor: pointer;"><input type="radio" name="slip_days_plan" value="30"> 30 วัน</label>
        </div>

        <div style="margin-top: 4px; font-size: 12.5pt; line-height: 1.25;">
          <div>ลงชื่อ............................................................</div>
          <div>( <span id="slip_assignee" contenteditable="true" onfocus="handleSlipFieldFocus(this)" oninput="handleSlipFieldInput(this)" onblur="handleSlipFieldBlur(this)" data-placeholder="............................................................" style="font-weight: bold; min-width: 100px; display: inline-block;">${r.assignee && r.assignee !== 'ยังไม่ระบุ' ? r.assignee : '............................................................'}</span> )</div>
          <div>หัวหน้างานซ่อมบำรุง</div>
          <div>วันที่............เดือน..................................พ.ศ...................</div>
        </div>
      </div>

      <!-- กล่องส่วนที่ 3: ความเห็นหัวหน้ากลุ่มงานบริหารทั่วไป -->
      <div style="border: 1.2px solid #000; padding: 5px 8px; margin-bottom: 2.5mm; font-size: 13pt; line-height: 1.25;">
        <div style="font-weight: bold;">2. ความเห็นหัวหน้ากลุ่มงานบริหารทั่วไป (วงเงินไม่เกิน 10,000 บาท)</div>
        <div style="margin-left: 12px; margin-top: 2px;">
          <label style="margin-right: 20px; cursor: pointer;"><input type="checkbox" name="slip_admin_comment" value="ทราบ"> ทราบ</label>
          <label style="margin-right: 20px; cursor: pointer;"><input type="checkbox" name="slip_admin_comment" value="แจ้งหน่วยซ่อมบำรุง" checked> แจ้งหน่วยซ่อมบำรุง</label>
          <label style="cursor: pointer;"><input type="checkbox" name="slip_admin_comment" value="แจ้ง จนท.เครื่องคอมพิวเตอร์"> แจ้ง จนท.เครื่องคอมพิวเตอร์</label>
        </div>
        <div style="margin-left: 12px; margin-top: 2px;">
          <label style="margin-right: 15px; cursor: pointer;"><input type="checkbox" name="slip_admin_comment" value="อนุมัติให้งานพัสดุจัดซื้ออุปกรณ์"> อนุมัติให้งานพัสดุจัดซื้ออุปกรณ์</label>
          <label style="cursor: pointer;"><input type="checkbox" name="slip_admin_comment" value="อื่นๆ"> อื่นๆ...........................................................................................</label>
        </div>

        <div style="font-weight: bold; margin-top: 3px;">วงเงินเกิน 10,000 บาท</div>
        <div style="margin-left: 12px; margin-top: 2px;">
          <label style="margin-right: 15px; cursor: pointer;"><input type="checkbox" name="slip_admin_over10k" value="เพื่อโปรดพิจารณา"> เพื่อโปรดพิจารณา</label>
          <label style="margin-right: 15px; cursor: pointer;"><input type="checkbox" name="slip_admin_over10k" value="เห็นควรอนุมัติจ้างเอกชน"> เห็นควรอนุมัติจ้างเอกชนดำเนินการ/ผู้รับจ้างจากภายนอก</label>
          <label style="cursor: pointer;"><input type="checkbox" name="slip_admin_over10k" value="แทงชำรุด"> เห็นควรแจ้งพัสดุแทงชำรุด</label>
        </div>

        <div style="text-align: center; margin-top: 4px; font-size: 12pt; line-height: 1.2;">
          <div>ลงชื่อ............................................................</div>
          <div style="font-weight: bold; margin-top: 1px;">(นายคมสัน ศรีสิงห์)</div>
          <div style="font-size: 11pt;">นักเทคนิคการแพทย์ปฏิบัติการ รักษาการในตำแหน่ง</div>
          <div style="font-size: 11.5pt; font-weight: bold;">หัวหน้ากลุ่มงานบริหารทั่วไป</div>
        </div>
      </div>

      <!-- กล่องส่วนที่ 4: คำสั่ง/ความคิดเห็นของผู้อำนวยการโรงพยาบาลพยุหะคีรี -->
      <div style="border: 1.2px solid #000; padding: 6px 8px; font-size: 13pt; line-height: 1.25;">
        <div style="font-weight: bold;">3. คำสั่ง/ความคิดเห็นของผู้อำนวยการโรงพยาบาลพยุหะคีรี</div>
        <div style="margin-left: 14px; margin-top: 3px;">
          <label style="margin-right: 25px; cursor: pointer;"><input type="radio" name="slip_director_cmd" value="อนุมัติจ้างเอกชน"> อนุมัติจ้างเอกชนดำเนินการ/ผู้รับจ้างจากภายนอก</label>
          <label style="cursor: pointer;"><input type="radio" name="slip_director_cmd" value="แทงชำรุด"> แจ้งพัสดุแทงชำรุด/จัดหาทดแทน</label>
        </div>
        <div style="margin-left: 14px; margin-top: 2px;">
          <label style="cursor: pointer;"><input type="radio" name="slip_director_cmd" value="อื่นๆ"> อื่นๆ..........................................................................................................................................................................</label>
        </div>

        <div style="text-align: center; margin-top: 6px; font-size: 12.5pt;">
          <div>ลงชื่อ............................................................</div>
          <div style="font-weight: bold; margin-top: 1px;">(นางสาวศิริพรรณ ชมภูฟู)</div>
          <div style="font-weight: bold;">ผู้อำนวยการโรงพยาบาลพยุหะคีรี</div>
        </div>
      </div>

    </div>
  `;

  contentEl.innerHTML = html;

  // เตรียมเนื้อหาสำหรับ Print Zone เฉพาะกิจ
  syncSlipToPrintZone();

  modalEl.classList.remove('hidden');
}

// ซิงค์ข้อความและการเลือกตัวเลือกทั้งหมด (Radio/Checkbox) ไปยัง Print Zone
// พร้อมแปลง Radio และ Checkbox ให้เป็นสัญลักษณ์กล่องสี่เหลี่ยมหรือวงเล็บที่มีเครื่องหมายถูก (✓)
function syncSlipToPrintZone() {
  const contentEl = document.getElementById('printWorkOrderContent');
  const printZone = document.getElementById('printWorkOrderOnlyZone');
  if (!contentEl || !printZone) return;

  // คัดลอก DOM
  const clone = contentEl.cloneNode(true);

  // ดึงค่า checked จาก contentEl ต้นฉบับมาแปลงเป็นเครื่องหมายติ๊กถูกใน clone
  const originalInputs = contentEl.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  const cloneInputs = clone.querySelectorAll('input[type="radio"], input[type="checkbox"]');

  originalInputs.forEach((origInput, idx) => {
    const cloneInput = cloneInputs[idx];
    if (!cloneInput) return;

    const isChecked = origInput.checked;
    const isCategoryBox = origInput.name === 'slip_category_radio';

    const checkSpan = document.createElement('span');
    checkSpan.className = 'print-check-mark';
    
    if (isCategoryBox) {
      // สำหรับหมวดหมู่ 3 ช่องด้านบน เป็นกล่องสี่เหลี่ยม [✓] หรือ [ ]
      checkSpan.style.display = 'inline-block';
      checkSpan.style.width = '13px';
      checkSpan.style.height = '13px';
      checkSpan.style.border = '1.2px solid #000';
      checkSpan.style.marginRight = '4px';
      checkSpan.style.textAlign = 'center';
      checkSpan.style.lineHeight = '11px';
      checkSpan.style.fontWeight = 'bold';
      checkSpan.style.fontSize = '12pt';
      checkSpan.innerText = isChecked ? '✓' : '';
    } else {
      // สำหรับข้ออื่นๆ ในแบบฟอร์ม เป็นวงเล็บ ( ✓ ) หรือ ( &nbsp; )
      checkSpan.style.display = 'inline-block';
      checkSpan.style.minWidth = '22px';
      checkSpan.style.textAlign = 'center';
      checkSpan.style.fontWeight = 'bold';
      checkSpan.style.fontSize = '12.5pt';
      checkSpan.innerHTML = isChecked ? '( ✓ )' : '(&nbsp;&nbsp;&nbsp;)';
    }

    // แทนที่ input ด้วยสัญลักษณ์ติ๊กถูกสำหรับพิมพ์
    if (cloneInput.parentNode) {
      cloneInput.parentNode.replaceChild(checkSpan, cloneInput);
    }
  });

  printZone.innerHTML = clone.innerHTML;
}

// บันทึกข้อมูลที่แก้ไขบนเอกสารใบส่งซ่อมกลับเข้าสู่ระบบ
async function saveSlipBackToSystem() {
  const getCleanText = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    const raw = el.innerText || '';
    const placeholder = (el.dataset.placeholder || '').trim();
    if (raw.trim() === placeholder) return '';
    return raw.replace(/[\.…_]/g, '').trim();
  };

  const repairNo = document.getElementById('slip_repairNo')?.innerText.trim() || ((typeof generateNextRepairNo === 'function') ? generateNextRepairNo() : '');
  const equipName = getCleanText('slip_equipName') || 'ครุภัณฑ์ไม่ระบุชื่อ';
  const equipCode = getCleanText('slip_equipCode');
  const symptom = getCleanText('slip_symptom');
  const div = getCleanText('slip_dept') || 'ไม่ระบุกลุ่มงาน';
  const requester = getCleanText('slip_requester') || 'ไม่ระบุผู้แจ้ง';
  const assignee = getCleanText('slip_assignee') || 'ยังไม่ระบุ';
  const step = getCleanText('slip_step');

  // ค่าใช้จ่าย
  let costStr = getCleanText('slip_cost').replace(/,/g, '');
  if (!costStr) {
    const p1 = getCleanText('slip_item_price_1').replace(/,/g, '');
    if (p1 && !isNaN(p1)) costStr = p1;
  }
  const cost = parseFloat(costStr) || 0;

  // ประเภทครุภัณฑ์
  const checkedCat = document.querySelector('input[name="slip_category_radio"]:checked')?.value || 'เครื่องมือเครื่องใช้อื่นๆ';

  // วันที่
  const day = parseInt(getCleanText('slip_day'), 10) || new Date().getDate();
  const yearBE = parseInt(getCleanText('slip_year'), 10) || (new Date().getFullYear() + 543);
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const monthText = getCleanText('slip_month');
  let monthIdx = thaiMonths.findIndex(m => monthText.includes(m));
  if (monthIdx === -1) monthIdx = new Date().getMonth();
  const yearCE = yearBE > 2400 ? yearBE - 543 : yearBE;
  const dateStr = `${yearCE}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const dataObj = {
    repairNo: repairNo,
    id: repairNo,
    date: dateStr,
    completedDate: '',
    div: div,
    requester: requester,
    category: checkedCat,
    equipCode: equipCode,
    equipName: equipName,
    symptom: symptom,
    assignee: assignee,
    status: 'รอดำเนินการ',
    step: step,
    cost: cost
  };

  const btn = document.getElementById('btnSaveSlipToSystem');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

  const isNewSlip = currentSlipRepairIndex === null;
  if (window.isFirebaseReady) {
    await window.saveRepairToCloud(dataObj, isNewSlip);
  }

  // อัปเดตอาเรย์ repairs ในเครื่อง
  const existingIdx = repairs.findIndex(r => r.repairNo === dataObj.repairNo);
  if (existingIdx >= 0) {
    repairs[existingIdx] = { ...repairs[existingIdx], ...dataObj };
  } else {
    repairs.unshift(dataObj);
  }

  saveRepairs(repairs);
  updateFiscalYearFilterOptions();
  renderTable();
  if (typeof renderDashboard === 'function') renderDashboard();

  if (btn) { btn.disabled = false; btn.innerHTML = '<span>💾</span> บันทึกเข้าระบบ'; }
  alert(`✅ บันทึกใบส่งซ่อมเลขที่ ${dataObj.repairNo} เข้าระบบเรียบร้อยแล้ว!`);
}

function executePrintWorkOrder() {
  syncSlipToPrintZone();
  document.body.classList.add('printing-work-order');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-work-order');
  }, 500);
}

window.openNewWorkOrderDirectSlip = openNewWorkOrderDirectSlip;
window.previewWorkOrderSlip = previewWorkOrderSlip;
window.closePrintWorkOrderModal = closePrintWorkOrderModal;
window.saveSlipBackToSystem = saveSlipBackToSystem;
window.executePrintWorkOrder = executePrintWorkOrder;
window.handleSlipFieldFocus = handleSlipFieldFocus;
window.handleSlipFieldInput = handleSlipFieldInput;
window.handleSlipFieldBlur = handleSlipFieldBlur;

// Namespace App.repair registration
window.App = window.App || {};
window.App.repair = {
  repairs: () => repairs,
  saveRepair,
  deleteRepair,
  editRepair,
  switchTab,
  openNewWorkOrderDirectSlip,
  previewWorkOrderSlip,
  saveSlipBackToSystem,
  executePrintWorkOrder
};
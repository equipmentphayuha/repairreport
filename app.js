/**
 * app.js
 * - คำนวณปีงบประมาณไทย เช่น ตุลาคม 2569 นับเป็นปีงบประมาณ 2570
 * - รันเลขที่ใบส่งซ่อมรูปแบบ "ลำดับ/ปีงบประมาณ" เช่น 1/2570, 2/2570
 * - ระบบจัดการรายชื่อช่างซ่อม และกดปุ่มเลือกชื่อได้ทันที
 */

let repairs = [];
let equipments = [];
let technicians = [];
let currentRepairPage = 1;

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
  const secCharts = document.getElementById('section-charts');
  const secTables = document.getElementById('section-tables');
  const secRepairs = document.getElementById('section-repairs');
  const btnCharts = document.getElementById('btn-tab-charts');
  const btnTables = document.getElementById('btn-tab-tables');
  const btnRepairs = document.getElementById('btn-tab-repairs');

  if (secCharts) secCharts.classList.add('hidden');
  if (secTables) secTables.classList.add('hidden');
  if (secRepairs) secRepairs.classList.add('hidden');
  
  const activeClass = "px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-900 shadow transition-colors";
  const inactiveClass = "px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-800 transition-colors";
  
  if (btnCharts) btnCharts.className = inactiveClass;
  if (btnTables) btnTables.className = inactiveClass;
  if (btnRepairs) btnRepairs.className = inactiveClass;

  if (tab === 'charts') {
    if (secCharts) secCharts.classList.remove('hidden');
    if (btnCharts) btnCharts.className = activeClass;
    if (typeof renderDashboard === 'function') renderDashboard();
  } else if (tab === 'tables') {
    if (secTables) secTables.classList.remove('hidden');
    if (btnTables) btnTables.className = activeClass;
    if (typeof renderDashboardTables === 'function') renderDashboardTables();
  } else {
    if (secRepairs) secRepairs.classList.remove('hidden');
    if (btnRepairs) btnRepairs.className = activeClass;
    if (typeof renderTable === 'function') renderTable();
  }
}

function renderTable() {
  const tbody = document.getElementById('repairTableBody');
  const query = (document.getElementById('searchInput').value || '').toLowerCase();
  tbody.innerHTML = '';

  const filtered = repairs.filter(r => 
    r.repairNo.toLowerCase().includes(query) ||
    r.div.toLowerCase().includes(query) ||
    r.equipName.toLowerCase().includes(query) ||
    (r.assignee && r.assignee.toLowerCase().includes(query)) ||
    r.status.toLowerCase().includes(query)
  );

  const pageSize = parseInt(document.getElementById('repairPageSize')?.value || '10');
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (currentRepairPage > totalPages) currentRepairPage = totalPages;
  if (currentRepairPage < 1) currentRepairPage = 1;

  const startIdx = (currentRepairPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pagedRepairs = filtered.slice(startIdx, endIdx);

  if (pagedRepairs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">ไม่พบรายการข้อมูล</td></tr>`;
  } else {
    pagedRepairs.forEach((r) => {
      const realIndex = repairs.findIndex(item => item.repairNo === r.repairNo);
      let statusBadge = "bg-slate-100 text-slate-700";
      if (r.status === 'เสร็จสิ้น') statusBadge = "bg-emerald-100 text-emerald-800";
      else if (r.status === 'กำลังดำเนินการ') statusBadge = "bg-blue-100 text-blue-800";
      else if (r.status === 'รออะไหล่/ช่างภายนอก') statusBadge = "bg-amber-100 text-amber-800";
      else if (r.status === 'จำหน่ายออก') statusBadge = "bg-rose-100 text-rose-800";

      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 border-b transition-colors";
      tr.innerHTML = `
        <td class="py-3 px-4 font-bold text-teal-700 font-mono text-sm">${r.repairNo}</td>
        <td class="py-3 px-4 text-slate-500">${r.date}</td>
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
        <td class="py-3 px-4 text-right font-medium text-slate-700">${Number(r.cost).toLocaleString()}</td>
        <td class="py-3 px-4 text-center">
          <div class="flex justify-center gap-2">
            <button onclick="editRepair(${realIndex})" class="text-xs text-teal-600 hover:text-teal-800 font-medium">แก้ไข</button>
            <button onclick="deleteRepair(${realIndex})" class="text-xs text-rose-600 hover:text-rose-800 font-medium">ลบ</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
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

function openModal() {
  document.getElementById('repairModal').classList.remove('hidden');
  document.getElementById('modalTitle').innerText = 'บันทึกข้อมูลใบส่งซ่อม';
  document.getElementById('repairForm').reset();
  document.getElementById('editIndex').value = '';

  document.getElementById('formRepairNo').value = generateNextRepairNo();
  document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('formAssignee').value = '';
  renderTechnicianBadges();
}

function closeModal() {
  document.getElementById('repairModal').classList.add('hidden');
}

function editRepair(idx) {
  openModal();
  document.getElementById('modalTitle').innerText = 'แก้ไขข้อมูลใบส่งซ่อม';
  const r = repairs[idx];
  document.getElementById('editIndex').value = idx;
  document.getElementById('formRepairNo').value = r.repairNo;
  document.getElementById('formDate').value = r.date;
  document.getElementById('formDept').value = r.div;
  document.getElementById('formCategory').value = r.category;
  document.getElementById('formEquipCode').value = r.equipCode || '';
  document.getElementById('formEquipName').value = r.equipName;
  document.getElementById('formSymptom').value = r.symptom;
  document.getElementById('formAssignee').value = r.assignee || '';
  document.getElementById('formStatus').value = r.status;
  document.getElementById('formStep').value = r.step || '';
  document.getElementById('formCost').value = r.cost;
}

function deleteRepair(idx) {
  if (confirm(`คุณต้องการลบใบส่งซ่อม ${repairs[idx].repairNo} หรือไม่?`)) {
    repairs.splice(idx, 1);
    saveRepairs(repairs);
    renderTable();
  }
}

function saveRepair(e) {
  e.preventDefault();
  const idx = document.getElementById('editIndex').value;
  const dataObj = {
    repairNo: document.getElementById('formRepairNo').value.trim(),
    date: document.getElementById('formDate').value,
    div: document.getElementById('formDept').value.trim(),
    category: document.getElementById('formCategory').value,
    equipCode: document.getElementById('formEquipCode').value.trim(),
    equipName: document.getElementById('formEquipName').value.trim(),
    symptom: document.getElementById('formSymptom').value.trim(),
    assignee: document.getElementById('formAssignee').value.trim() || 'ยังไม่ระบุ',
    status: document.getElementById('formStatus').value,
    step: document.getElementById('formStep').value.trim(),
    cost: parseFloat(document.getElementById('formCost').value) || 0
  };

  if (idx === '') {
    repairs.unshift(dataObj);
  } else {
    repairs[idx] = dataObj;
  }

  if (dataObj.assignee && dataObj.assignee !== 'ยังไม่ระบุ' && !technicians.includes(dataObj.assignee)) {
    technicians.push(dataObj.assignee);
    saveTechnicians(technicians);
  }

  saveRepairs(repairs);
  closeModal();
  renderTable();
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
  renderDashboard();
  renderTable();
  alert("ดึงข้อมูลล่าสุดจากฐานข้อมูลสำเร็จ!");
}

// Updated window.onload to initialize Firebase and fetch data
window.onload = function() {
  repairs = loadRepairs();
  equipments = loadEquipments();
  technicians = loadTechnicians();
  updateEquipmentDatalist();
  updateDivDatalist();
  renderDashboard();
  renderTable();
};

window.startFirebaseSync = async function() {
  console.log("กำลังดึงข้อมูลล่าสุดจาก Firebase...");
  
  if (!window.isFirebaseReady) return;

  const cloudEquips = await window.fetchEquipmentsFromCloud();
  if (cloudEquips.length > 0) {
    equipments = cloudEquips;
    saveEquipments(equipments);
    updateEquipmentDatalist();
  updateDivDatalist();
  }

  window.listenToRepairsRealtime((cloudRepairs) => {
    if (cloudRepairs.length > 0) {
      repairs = cloudRepairs;
      saveRepairs(repairs);
      renderDashboard();
      renderTable();
      console.log("ข้อมูลอัปเดตล่าสุดจาก Cloud เรียบร้อยแล้ว");
    }
  });
};
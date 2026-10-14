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

  const btnCharts     = document.getElementById('btn-tab-charts');
  const btnTables     = document.getElementById('btn-tab-tables');
  const btnRepairs    = document.getElementById('btn-tab-repairs');
  const btnStaff      = document.getElementById('btn-tab-staff');
  const btnInventory  = document.getElementById('btn-tab-inventory');

  [secCharts, secTables, secRepairs, secStaff, secInventory].forEach(s => { if (s) s.classList.add('hidden'); });

  const activeClass   = "px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-900 shadow transition-colors flex items-center gap-1";
  const inactiveClass = "px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-800 transition-colors flex items-center gap-1";
  [btnCharts, btnTables, btnRepairs, btnStaff, btnInventory].forEach(b => { if (b) b.className = inactiveClass; });

  if (tab === 'inventory') {
    if (secInventory) secInventory.classList.remove('hidden');
    if (btnInventory) btnInventory.className = activeClass;
    if (typeof window.renderParcelDashboard === 'function') window.renderParcelDashboard();
  } else if (tab === 'charts') {
    if (secCharts) secCharts.classList.remove('hidden');
    if (btnCharts) btnCharts.className = activeClass;
    if (typeof renderDashboard === 'function') renderDashboard();
  } else if (tab === 'tables') {
    if (secTables) secTables.classList.remove('hidden');
    if (btnTables) btnTables.className = activeClass;
    if (typeof renderDashboardTables === 'function') renderDashboardTables();
  } else if (tab === 'staff') {
    if (secStaff) secStaff.classList.remove('hidden');
    if (btnStaff) btnStaff.className = activeClass;
    if (typeof renderStaffDashboard === 'function') renderStaffDashboard();
  } else {
    // repairs (default)
    if (secRepairs) secRepairs.classList.remove('hidden');
    if (btnRepairs) btnRepairs.className = activeClass;
    if (typeof renderTable === 'function') renderTable();
  }
}
window.switchTab = switchTab;

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
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">ไม่พบรายการข้อมูล</td></tr>`;
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
      if (r.date) {
        const reqDate = new Date(r.date);
        if (r.status === 'เสร็จสิ้น') {
          const compDate = r.completedDate ? new Date(r.completedDate) : reqDate;
          const days = Math.max(0, Math.round((compDate - reqDate) / (1000 * 60 * 60 * 24)));
          durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="เสร็จเมื่อ ${r.completedDate || r.date}">⏱️ ${days} วัน</span>`;
        } else {
          // กำลังดำเนินการ / รอดำเนินการ
          const pendingDays = Math.max(0, Math.floor((today - reqDate) / (1000 * 60 * 60 * 24)));
          if (pendingDays >= 14) {
            durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse" title="ค้างซ่อมเกิน 14 วัน!">⚠️ ${pendingDays} วัน</span>`;
          } else if (pendingDays >= 7) {
            durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200" title="ค้างซ่อมเกิน 7 วัน">⏳ ${pendingDays} วัน</span>`;
          } else {
            durationBadge = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">${pendingDays} วัน</span>`;
          }
        }
      }

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
        <td class="py-3 px-4 text-center">
          ${durationBadge}
        </td>
        <td class="py-3 px-4 text-right font-medium text-slate-700">${Number(r.cost).toLocaleString()}</td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="previewWorkOrderSlip(${realIndex})" class="p-1 rounded hover:bg-slate-100 text-indigo-600 hover:text-indigo-800" title="พิมพ์ใบส่งซ่อม">
              <span class="text-sm">🖨️</span>
            </button>
            <button onclick="editRepair(${realIndex})" class="text-xs text-teal-600 hover:text-teal-800 font-medium px-1">แก้ไข</button>
            <button onclick="deleteRepair(${realIndex})" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-1">ลบ</button>
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

function onStatusChange(statusVal) {
  const compDateInput = document.getElementById('formCompletedDate');
  if (!compDateInput) return;
  if (statusVal === 'เสร็จสิ้น') {
    if (!compDateInput.value) {
      compDateInput.value = new Date().toISOString().split('T')[0];
    }
  } else {
    // ถ้าไม่ใช่เสร็จสิ้น และยังไม่ได้ระบุเอง ให้ปล่อยว่างหรือคงไว้
  }
}

function openModal() {
  document.getElementById('repairModal').classList.remove('hidden');
  document.getElementById('modalTitle').innerText = 'บันทึกข้อมูลใบส่งซ่อม';
  document.getElementById('repairForm').reset();
  document.getElementById('editIndex').value = '';

  document.getElementById('formRepairNo').value = generateNextRepairNo();
  document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('formCompletedDate').value = '';
  document.getElementById('formAssignee').value = '';
  document.getElementById('formRequester').value = '';
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
  document.getElementById('formCompletedDate').value = r.completedDate || '';
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
  const repairNo = repairs[idx].repairNo;
  if (!confirm(`คุณต้องการลบใบส่งซ่อม ${repairNo} หรือไม่?\n\n⚠️ ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร`)) return;

  if (window.isFirebaseReady) {
    const ok = await window.deleteRepairFromCloud(repairNo);
    if (!ok) {
      alert('❌ ลบข้อมูลจากฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ');
      return;
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

    const ok = await window.saveRepairToCloud(dataObj);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'บันทึกข้อมูล'; }

    if (!ok) {
      alert('❌ บันทึกไปยังฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง');
      return; // ไม่ปิด modal เพื่อให้ผู้ใช้ลองใหม่ได้
    }

    // สำรองข้อมูลลง LocalStorage ทันที
    const existingIdx = repairs.findIndex(r => r.repairNo === dataObj.repairNo);
    if (existingIdx >= 0) {
      repairs[existingIdx] = dataObj;
    } else {
      repairs.unshift(dataObj);
    }
    saveRepairs(repairs);
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
  renderDashboard();
  renderTable();
};

window.startFirebaseSync = async function() {
  console.log("กำลังดึงข้อมูลล่าสุดจาก Firebase...");

  if (!window.isFirebaseReady) {
    if (typeof window.setSyncStatus === 'function') window.setSyncStatus("offline");
    return;
  }

  if (typeof window.setSyncStatus === 'function') window.setSyncStatus("saving");

  // ── ดึง equipments จาก Firebase ก่อน (source of truth) ──────────────────────
  const cloudEquips = await window.fetchEquipmentsFromCloud();
  equipments = cloudEquips;
  saveEquipments(equipments);
  updateEquipmentDatalist();
  updateDivDatalist();

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
function previewWorkOrderSlip(idx) {
  const r = repairs[idx];
  if (!r) return;

  const contentEl = document.getElementById('printWorkOrderContent');
  const modalEl = document.getElementById('printWorkOrderModal');
  if (!contentEl || !modalEl) return;

  // คำนวณระยะเวลา
  let durationText = 'กำลังดำเนินการ';
  if (r.date) {
    const reqDate = new Date(r.date);
    if (r.status === 'เสร็จสิ้น') {
      const compDate = r.completedDate ? new Date(r.completedDate) : reqDate;
      const days = Math.max(0, Math.round((compDate - reqDate) / (1000 * 60 * 60 * 24)));
      durationText = `${days} วัน (เสร็จสิ้นเมื่อ ${r.completedDate || r.date})`;
    } else {
      const pendingDays = Math.max(0, Math.floor((new Date() - reqDate) / (1000 * 60 * 60 * 24)));
      durationText = `รอดำเนินการมาแล้ว ${pendingDays} วัน`;
    }
  }

  const html = `
    <div class="border-2 border-slate-800 p-6 rounded-lg font-sans text-slate-900 leading-relaxed">
      <!-- ส่วนหัวเอกสาร -->
      <div class="border-b-2 border-slate-800 pb-4 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🏥</span>
            <div>
              <h2 class="text-lg font-bold text-slate-900">โรงพยาบาลพยุหะคีรี</h2>
              <p class="text-xs text-slate-600">กลุ่มงานบริหารทั่วไป / ฝ่ายเทคโนโลยีสารสนเทศและซ่อมบำรุง</p>
            </div>
          </div>
          <div class="text-right">
            <span class="inline-block px-3 py-1 bg-teal-800 text-white font-bold text-sm rounded">ใบส่งซ่อมครุภัณฑ์</span>
            <p class="text-xs font-mono font-bold text-slate-800 mt-1">เลขที่: <span class="text-base text-teal-800 font-bold">${r.repairNo}</span></p>
          </div>
        </div>
      </div>

      <!-- ข้อมูลผู้แจ้ง และวันเวลา -->
      <div class="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-300 mb-4">
        <div>
          <p><span class="font-bold text-slate-700">หน่วยงาน/แผนกที่ส่งซ่อม:</span> ${r.div || '-'}</p>
          <p class="mt-1"><span class="font-bold text-slate-700">ผู้ส่งซ่อม/ผู้แจ้ง:</span> ${r.requester || 'ไม่ระบุ'}</p>
        </div>
        <div>
          <p><span class="font-bold text-slate-700">วันที่แจ้งซ่อม:</span> ${r.date || '-'}</p>
          <p class="mt-1"><span class="font-bold text-slate-700">วันที่ซ่อมเสร็จ:</span> ${r.completedDate ? r.completedDate : '(ยังไม่เสร็จสิ้น)'}</p>
        </div>
      </div>

      <!-- รายละเอียดครุภัณฑ์ -->
      <div class="mb-4">
        <h4 class="text-xs font-bold uppercase text-slate-700 mb-1 border-b border-slate-300 pb-1">รายละเอียดครุภัณฑ์ / อุปกรณ์</h4>
        <div class="grid grid-cols-2 gap-3 text-xs pt-1">
          <p><span class="font-bold">ชื่อครุภัณฑ์:</span> ${r.equipName}</p>
          <p><span class="font-bold">รหัสครุภัณฑ์:</span> <span class="font-mono">${r.equipCode || '-'}</span></p>
          <p><span class="font-bold">ประเภท:</span> ${r.category || '-'}</p>
          <p><span class="font-bold">สถานะงานปัจจุบัน:</span> <span class="font-bold text-teal-800">${r.status}</span></p>
        </div>
      </div>

      <!-- อาการชำรุด -->
      <div class="mb-4">
        <h4 class="text-xs font-bold uppercase text-slate-700 mb-1 border-b border-slate-300 pb-1">อาการชำรุด / ปัญหาที่ได้รับแจ้ง</h4>
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs min-h-[48px]">
          ${r.symptom || '-'}
        </div>
      </div>

      <!-- ผลการตรวจซ่อมและขั้นตอน -->
      <div class="mb-4">
        <h4 class="text-xs font-bold uppercase text-slate-700 mb-1 border-b border-slate-300 pb-1">ผลการดำเนินการซ่อม / อะไหล่ที่เปลี่ยน</h4>
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs min-h-[48px]">
          <p>${r.step || 'อยู่ระหว่างการตรวจสอบและดำเนินการ'}</p>
          <div class="mt-2 pt-2 border-t border-slate-200 flex justify-between font-bold text-xs">
            <span>ระยะเวลาที่ใช้: ${durationText}</span>
            <span class="text-slate-800">ค่าใช้จ่ายรวมทั้งสิ้น: ${Number(r.cost).toLocaleString()} บาท</span>
          </div>
        </div>
      </div>

      <!-- ช่องลงลายมือชื่อ 3 ฝ่าย -->
      <div class="grid grid-cols-3 gap-3 text-center text-xs mt-6 pt-4 border-t-2 border-slate-800">
        <!-- ฝ่าย 1: ผู้ส่งซ่อม -->
        <div class="flex flex-col justify-between h-28 border border-slate-300 p-2 rounded bg-white">
          <p class="font-bold text-slate-700">ผู้ส่งซ่อม / ผู้ส่งมอบเครื่อง</p>
          <div class="border-b border-dashed border-slate-400 mx-4"></div>
          <div>
            <p>ลงชื่อ .....................................................</p>
            <p class="text-[11px] text-slate-500 mt-0.5">(${r.requester || '.....................................................'})</p>
            <p class="text-[10px] text-slate-400">วันที่ ....../....../......</p>
          </div>
        </div>

        <!-- ฝ่าย 2: ช่างผู้ซ่อม -->
        <div class="flex flex-col justify-between h-28 border border-slate-300 p-2 rounded bg-white">
          <p class="font-bold text-slate-700">ช่างซ่อม / ผู้ดำเนินการ</p>
          <div class="border-b border-dashed border-slate-400 mx-4"></div>
          <div>
            <p>ลงชื่อ .....................................................</p>
            <p class="text-[11px] text-slate-500 mt-0.5">(${r.assignee && r.assignee !== 'ยังไม่ระบุ' ? r.assignee : '.....................................................'})</p>
            <p class="text-[10px] text-slate-400">วันที่ ....../....../......</p>
          </div>
        </div>

        <!-- ฝ่าย 3: ผู้ตรวจรับงาน -->
        <div class="flex flex-col justify-between h-28 border border-slate-300 p-2 rounded bg-white">
          <p class="font-bold text-slate-700">ผู้รับมอบเครื่อง / ตรวจรับงาน</p>
          <div class="border-b border-dashed border-slate-400 mx-4"></div>
          <div>
            <p>ลงชื่อ .....................................................</p>
            <p class="text-[11px] text-slate-500 mt-0.5">(.....................................................)</p>
            <p class="text-[10px] text-slate-400">วันที่ ....../....../......</p>
          </div>
        </div>
      </div>

      <!-- ท้ายเอกสาร -->
      <div class="text-[10px] text-slate-400 flex justify-between items-center mt-4 pt-2 border-t border-slate-200">
        <span>ระบบบริหารงานซ่อมแซมครุภัณฑ์และเครื่องมือแพทย์ - รพ.พยุหะคีรี</span>
        <span>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</span>
      </div>
    </div>
  `;

  contentEl.innerHTML = html;

  // เตรียมเนื้อหาสำหรับ Print Zone เฉพาะกิจ
  const printZone = document.getElementById('printWorkOrderOnlyZone');
  if (printZone) {
    printZone.innerHTML = html;
  }

  modalEl.classList.remove('hidden');
}

function closePrintWorkOrderModal() {
  const modalEl = document.getElementById('printWorkOrderModal');
  if (modalEl) modalEl.classList.add('hidden');
}

function executePrintWorkOrder() {
  document.body.classList.add('printing-work-order');
  window.print();
  // คืนค่าหลังปิดหน้าต่างพิมพ์
  setTimeout(() => {
    document.body.classList.remove('printing-work-order');
  }, 500);
}
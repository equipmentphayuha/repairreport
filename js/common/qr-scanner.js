/**
 * js/common/qr-scanner.js
 * จัดการโมดูลสแกน QR Code และ Barcode พัสดุด้วยกล้องมือถือ / แท็บเล็ต / เว็บบราวเซอร์
 */

let html5QrScannerInstance = null;
let currentScannerTargetMode = 'repair'; // 'repair' | 'inventory' | 'repair_form'
let currentCameraFacingMode = 'environment'; // 'environment' (กล้องหลัง) | 'user' (กล้องหน้า)

/**
 * เปิด Modal สแกน QR Code
 * @param {string} targetMode 'repair' (สแกนแล้วเปิดฟอร์มแจ้งซ่อม), 'inventory' (สแกนแล้วค้นหาในตารางพัสดุ), 'repair_form' (สแกนใส่รหัสลงในช่องรหัสครุภัณฑ์)
 */
window.openQrScannerModal = function(targetMode = 'repair') {
  currentScannerTargetMode = targetMode;
  const modal = document.getElementById('qrScannerModal');
  const subtitle = document.getElementById('qrScannerTargetSubtitle');
  const resultText = document.getElementById('qrScannerResultText');
  const loading = document.getElementById('qrScannerLoading');

  if (subtitle) {
    if (targetMode === 'repair') {
      subtitle.innerText = 'สแกน QR / Barcode พัสดุ เพื่อดึงข้อมูลและเปิดใบส่งซ่อมทันที';
    } else if (targetMode === 'inventory') {
      subtitle.innerText = 'สแกน QR / Barcode เพื่อค้นหาตำแหน่งและประวัติในทะเบียนพัสดุ';
    } else {
      subtitle.innerText = 'สแกนเพื่อใส่รหัสครุภัณฑ์ลงในแบบฟอร์มส่งซ่อม';
    }
  }

  if (resultText) resultText.innerText = '- รอการสแกน -';
  if (loading) loading.classList.remove('hidden');
  if (modal) modal.classList.remove('hidden');

  // รอให้ Modal render แล้วเริ่มเปิดกล้อง
  setTimeout(() => {
    startQrCamera();
  }, 200);
};

/**
 * ปิด Modal และหยุดกล้อง
 */
window.closeQrScannerModal = async function() {
  await stopQrCamera();
  const modal = document.getElementById('qrScannerModal');
  if (modal) modal.classList.add('hidden');
};

/**
 * เริ่มทำงานกล้องผ่าน Html5Qrcode
 */
async function startQrCamera() {
  const readerEl = document.getElementById('qrScannerReader');
  const loading = document.getElementById('qrScannerLoading');
  if (!readerEl) return;

  if (typeof Html5Qrcode === 'undefined') {
    alert('ระบบสแกนกำลังโหลด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
    return;
  }

  try {
    if (html5QrScannerInstance) {
      await stopQrCamera();
    }

    html5QrScannerInstance = new Html5Qrcode('qrScannerReader');
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    await html5QrScannerInstance.start(
      { facingMode: currentCameraFacingMode },
      config,
      onQrCodeSuccess,
      onQrCodeFailure
    );

    if (loading) loading.classList.add('hidden');
  } catch (err) {
    console.error('Camera start error:', err);
    if (loading) {
      loading.innerHTML = `
        <span class="text-rose-400 text-xl">⚠️</span>
        <span class="text-rose-200">ไม่สามารถเข้าถึงกล้องได้: ${err.message || 'กรุณาอนุญาตการใช้กล้อง'}</span>
      `;
    }
  }
}

/**
 * ปิดกล้อง
 */
async function stopQrCamera() {
  if (html5QrScannerInstance) {
    try {
      if (html5QrScannerInstance.isScanning) {
        await html5QrScannerInstance.stop();
      }
      await html5QrScannerInstance.clear();
    } catch (e) {
      console.warn('stopQrCamera warn:', e);
    }
    html5QrScannerInstance = null;
  }
}

/**
 * สลับกล้องหน้า / หลัง
 */
window.toggleCameraFacing = async function() {
  currentCameraFacingMode = currentCameraFacingMode === 'environment' ? 'user' : 'environment';
  const loading = document.getElementById('qrScannerLoading');
  if (loading) loading.classList.remove('hidden');
  await startQrCamera();
};

/**
 * เมื่อสแกน QR Code / Barcode สำเร็จ
 */
function onQrCodeSuccess(decodedText, decodedResult) {
  const resultText = document.getElementById('qrScannerResultText');
  if (resultText) resultText.innerText = decodedText;

  // เล่นเสียงบี๊บเบาๆ (ถ้าบราวเซอร์อนุญาต AudioContext)
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (_) {}

  // ปิดกล้องทันทีเพื่อป้องกันสแกนซ้ำ
  window.closeQrScannerModal();

  // ประมวลผลรหัสที่สแกนได้
  handleScannedCode(decodedText.trim());
}

function onQrCodeFailure(error) {
  // ไม่ต้อง log เพื่อไม่ให้ console รก
}

/**
 * จัดการเมื่อได้รหัสจากการสแกน
 */
function handleScannedCode(scannedCode) {
  if (!scannedCode) return;

  // ค้นหารายการพัสดุในระบบ (จาก localStorage ทั้งสองคีย์ หรือจาก window.getParcelEquipmentData)
  let parcelItems = [];
  if (typeof window.getParcelEquipmentData === 'function') {
    parcelItems = window.getParcelEquipmentData() || [];
  }
  if (!parcelItems.length) {
    try {
      const raw1 = localStorage.getItem('hospital_equipments');
      if (raw1) parcelItems = JSON.parse(raw1);
    } catch (_) {}
  }
  if (!parcelItems.length) {
    try {
      const raw2 = localStorage.getItem('hospital_equipments_data');
      if (raw2) parcelItems = JSON.parse(raw2);
    } catch (_) {}
  }

  // เปรียบเทียบรหัส (noid หรือ code หรือ name)
  const s = scannedCode.toLowerCase();
  const matched = parcelItems.find(p => {
    const noid = (p.noid || '').trim().toLowerCase();
    const code = (p.code || '').trim().toLowerCase();
    const name = (p.name || '').trim().toLowerCase();
    return noid === s || code === s || name === s || (noid && (s.includes(noid) || noid.includes(s)));
  });

  if (currentScannerTargetMode === 'inventory') {
    // โหมดค้นหาในทะเบียนพัสดุ
    if (typeof window.switchTab === 'function') {
      window.switchTab('inventory');
    }
    const searchInput = document.getElementById('parcelSearchInput');
    if (searchInput) {
      searchInput.value = matched ? (matched.noid || matched.name) : scannedCode;
      searchInput.dispatchEvent(new Event('input'));
    }
    if (matched) {
      window.openEquipmentPassportModal(matched.id);
    }
  } else if (currentScannerTargetMode === 'repair_form') {
    // โหมดใส่รหัสลงฟอร์ม
    const codeInput = document.getElementById('formEquipCode');
    if (codeInput) {
      codeInput.value = matched ? (matched.noid || matched.code || scannedCode) : scannedCode;
    }
    if (matched && document.getElementById('formEquipName')) {
      document.getElementById('formEquipName').value = matched.name;
    }
    if (matched && matched.div && document.getElementById('formDept')) {
      document.getElementById('formDept').value = matched.div;
    }
  } else {
    // โหมด 'repair': เปิดหน้าต่าง Fast-Track แจ้งซ่อมด่วนทันที!
    openFastTrackRepairModal(matched, scannedCode);
  }
}

/**
 * Fast-Track Quick Repair Functions
 */
window.openFastTrackRepairModal = function(matched, scannedCode) {
  const modal = document.getElementById('fastTrackRepairModal');
  if (!modal) {
    // Fallback ถ้าไม่มี modal ให้เปิด repairModal ปกติ
    if (typeof window.switchTab === 'function') window.switchTab('repairs');
    if (typeof window.openModal === 'function') window.openModal();
    return;
  }

  const profile = window.currentUserProfile || {};
  const requesterName = profile.name || 'เจ้าหน้าที่ผู้แจ้งซ่อม';
  const requesterDept = profile.department || (matched ? matched.div : 'ไม่ระบุแผนก');

  // ตั้งค่าข้อมูลครุภัณฑ์
  const code = matched ? (matched.noid || matched.code || scannedCode) : scannedCode;
  const name = matched ? (matched.name || 'ไม่ระบุชื่อครุภัณฑ์') : `ครุภัณฑ์รหัส ${scannedCode}`;
  const dept = (matched && matched.div) ? matched.div : requesterDept;
  const location = (matched && matched.location) ? matched.location : '-';
  
  // แปลงประเภท
  let category = 'ครุภัณฑ์สำนักงานทั่วไป';
  if (matched && matched.type) {
    const t = matched.type;
    if (t.includes('แพทย์')) category = 'เครื่องมือแพทย์';
    else if (t.includes('คอมพิวเตอร์')) category = 'ระบบคอมพิวเตอร์/เครือข่าย';
    else if (t.includes('ไฟฟ้า') || t.includes('สาธารณูปโภค')) category = 'ระบบสาธารณูปโภค';
  }

  // ระดับความเสี่ยง Criticality Badge
  const riskVal = matched ? (matched.risk || '3') : '3';
  const badgeEl = document.getElementById('ftCriticalityBadge');
  if (badgeEl) {
    if (riskVal === '1' || String(riskVal).includes('วิกฤต') || category === 'เครื่องมือแพทย์') {
      badgeEl.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 bg-rose-500/20 text-rose-700 border border-rose-300 animate-pulse';
      badgeEl.innerHTML = '🔴 วิกฤตช่วยชีวิต (Tier 1)';
    } else if (riskVal === '2' || String(riskVal).includes('สูง')) {
      badgeEl.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 bg-amber-500/20 text-amber-800 border border-amber-300';
      badgeEl.innerHTML = '🟠 สำคัญสูง (Tier 2)';
    } else {
      badgeEl.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 bg-slate-100 text-slate-700 border border-slate-200';
      badgeEl.innerHTML = '🟢 ทั่วไป (Tier 3)';
    }
  }

  document.getElementById('ftEquipCode').innerText = `🆔 ${code}`;
  document.getElementById('ftEquipName').innerText = name;
  document.getElementById('ftDept').innerText = dept;
  document.getElementById('ftLocation').innerText = location;
  document.getElementById('ftCategory').innerText = category;
  document.getElementById('ftRequester').innerText = requesterName;

  document.getElementById('ftHiddenCode').value = code;
  document.getElementById('ftHiddenName').value = name;
  document.getElementById('ftHiddenDept').value = dept;
  document.getElementById('ftHiddenCategory').value = category;
  document.getElementById('ftSymptom').value = '';
  document.getElementById('ftUrgency').value = (riskVal === '1') ? 'ด่วนที่สุด' : 'ปกติ';

  modal.classList.remove('hidden');
  setTimeout(() => {
    document.getElementById('ftSymptom')?.focus();
  }, 100);
};

window.closeFastTrackRepairModal = function() {
  document.getElementById('fastTrackRepairModal')?.classList.add('hidden');
};

window.fillFtSymptom = function(text) {
  const input = document.getElementById('ftSymptom');
  if (!input) return;
  if (!input.value.trim()) {
    input.value = text;
  } else {
    input.value = `${input.value.trim()}, ${text}`;
  }
  input.focus();
};

window.handleFastTrackSubmit = async function(e) {
  e.preventDefault();
  const symptom = document.getElementById('ftSymptom')?.value.trim();
  if (!symptom) return alert('กรุณาระบุอาการชำรุดที่พบ');

  const btn = document.getElementById('ftSubmitBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ <span>กำลังบันทึกส่งซ่อม...</span>';
  }

  const profile = window.currentUserProfile || {};
  const requester = profile.name || 'เจ้าหน้าที่ผู้ส่งซ่อม (QR)';
  const equipCode = document.getElementById('ftHiddenCode').value;
  const equipName = document.getElementById('ftHiddenName').value;
  const dept = document.getElementById('ftHiddenDept').value;
  const category = document.getElementById('ftHiddenCategory').value;
  const urgency = document.getElementById('ftUrgency').value;

  // รันเลขที่ใบซ่อม
  const repairNo = (typeof window.generateNextRepairNo === 'function') 
    ? window.generateNextRepairNo() 
    : ('RP-' + Date.now().toString().slice(-6));

  const todayIso = new Date().toISOString().split('T')[0];

  const dataObj = {
    id: repairNo,
    repairNo: repairNo,
    date: todayIso,
    completedDate: '',
    div: dept,
    requester: requester,
    category: category,
    equipCode: equipCode,
    equipName: equipName,
    symptom: urgency !== 'ปกติ' ? `[${urgency}] ${symptom}` : symptom,
    assignee: 'ยังไม่ระบุ',
    status: 'รอดำเนินการ',
    step: 'รับแจ้งซ่อมด่วนผ่าน QR Code',
    cost: 0
  };

  // บันทึกผ่าน window.saveRepairToCloud
  try {
    if (window.isFirebaseReady && typeof window.saveRepairToCloud === 'function') {
      await window.saveRepairToCloud(dataObj, true);
    }
  } catch (err) {
    console.warn('Fast track cloud sync warn:', err);
  }

  // อัปเดต local repairs
  if (typeof window.repairs !== 'undefined' && Array.isArray(window.repairs)) {
    window.repairs.unshift(dataObj);
    if (typeof window.saveRepairs === 'function') window.saveRepairs(window.repairs);
  }

  // บันทึก Audit Log
  if (typeof window.logAuditAction === 'function') {
    window.logAuditAction('CREATE', 'repair', repairNo, {
      equipName,
      status: dataObj.status,
      via: 'Fast-Track QR Scanner'
    });
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀</span> <span>ส่งแจ้งซ่อมทันที (Submit)</span>';
  }

  window.closeFastTrackRepairModal();
  
  // แจ้งเตือนสำเร็จพร้อมถามว่าต้องการพิมพ์ใบส่งซ่อมทันทีหรือไม่
  const wantPrint = confirm(
    `✅ แจ้งซ่อมสำเร็จเรียบร้อย!\n\n` +
    `📋 เลขที่ใบส่งซ่อม: ${repairNo}\n` +
    `📦 ครุภัณฑ์: ${equipName}\n` +
    `⚠️ อาการ: ${dataObj.symptom}\n\n` +
    `คุณต้องการ "พิมพ์ใบส่งซ่อมตัวจริง" ออกมาแนบกับตัวเครื่องทันทีหรือไม่?`
  );

  // สลับไปหน้ารายการซ่อม
  if (typeof window.switchTab === 'function') {
    window.switchTab('repairs');
  }

  // ถ้าต้องการพิมพ์ ให้เปิดหน้าใบส่งซ่อมทันที
  if (wantPrint) {
    setTimeout(() => {
      if (typeof window.previewWorkOrderSlip === 'function') {
        window.previewWorkOrderSlip(0); // รายการล่าสุดที่เพิ่งเพิ่ม
      }
    }, 200);
  }
};

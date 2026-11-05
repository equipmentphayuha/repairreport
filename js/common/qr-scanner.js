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

  // ค้นหารายการพัสดุในระบบ (จาก localStorage หรือรายการ)
  let parcelItems = [];
  try {
    const raw = localStorage.getItem('hospital_equipments_data');
    if (raw) parcelItems = JSON.parse(raw);
  } catch (_) {}

  // เปรียบเทียบรหัส (noid หรือ code หรือ name)
  const matched = parcelItems.find(p => {
    const noid = (p.noid || '').trim().toLowerCase();
    const code = (p.code || '').trim().toLowerCase();
    const s = scannedCode.toLowerCase();
    return noid === s || code === s || (p.name && p.name.toLowerCase() === s);
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
    alert(`🔍 สแกนสำเร็จ: ${scannedCode}${matched ? ` (พบ: ${matched.name})` : ' (ไม่พบในฐานข้อมูล กำลังค้นหา)'}`);
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
    // โหมด 'repair': เปิดฟอร์มส่งซ่อมพร้อมเติมข้อมูลอัตโนมัติ
    if (typeof window.switchTab === 'function') {
      window.switchTab('repairs');
    }
    if (typeof window.openModal === 'function') {
      window.openModal();
    }

    setTimeout(() => {
      if (matched) {
        if (document.getElementById('formEquipName')) document.getElementById('formEquipName').value = matched.name || '';
        if (document.getElementById('formEquipCode')) document.getElementById('formEquipCode').value = matched.noid || matched.code || scannedCode;
        if (document.getElementById('formDept') && matched.div) document.getElementById('formDept').value = matched.div;
        if (document.getElementById('formCategory') && matched.type) {
          // แมปประเภท
          const catSelect = document.getElementById('formCategory');
          for (let i = 0; i < catSelect.options.length; i++) {
            if (matched.type.includes(catSelect.options[i].value) || catSelect.options[i].value.includes(matched.type)) {
              catSelect.selectedIndex = i;
              break;
            }
          }
        }
        alert(`✅ พบข้อมูลครุภัณฑ์: "${matched.name}"\nระบบได้กรอกข้อมูลลงในฟอร์มส่งซ่อมให้เรียบร้อยแล้ว`);
      } else {
        if (document.getElementById('formEquipCode')) {
          document.getElementById('formEquipCode').value = scannedCode;
        }
        alert(`📷 รหัสที่สแกนได้: "${scannedCode}"\nระบบได้กรอกรหัสลงในช่องรหัสครุภัณฑ์แล้ว กรุณาระบุชื่อและอาการชำรุด`);
      }
    }, 150);
  }
}

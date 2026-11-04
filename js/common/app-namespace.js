/**
 * js/common/app-namespace.js
 * จัดระเบียบ App Namespace ส่วนกลาง (Single Source of Truth)
 * ป้องกัน Window Pollution และ Naming Collision
 */

window.App = window.App || {
  version: '2.1.0',
  common: {},
  repair: {},
  parcel: {},
  audit: {},
  currentUser: {
    id: 'user_anonymous',
    name: 'เจ้าหน้าที่ผู้ใช้งาน',
    role: 'staff'
  }
};

// ฟังก์ชันระบุชื่อผู้ปฏิบัติงานสำหรับ Audit Log
window.App.setCurrentUser = function(name, role = 'staff') {
  if (!name) return;
  window.App.currentUser = {
    id: 'usr_' + Date.now(),
    name: name.trim(),
    role: role
  };
  localStorage.setItem('hospital_current_user', JSON.stringify(window.App.currentUser));
};

// โหลดชื่อผู้ใช้เดิมจาก LocalStorage (ถ้ามี)
try {
  const savedUser = localStorage.getItem('hospital_current_user');
  if (savedUser) {
    window.App.currentUser = JSON.parse(savedUser);
  }
} catch (e) {
  console.warn('Could not load current user from storage:', e);
}

// ระบบโหลดไลบรารีขนาดใหญ่แบบ Dynamic / On-Demand เมื่อมีการกดใช้งานจริง (ช่วยให้เปิดเว็บและล็อกอินได้เร็วขึ้น)
window.loadScriptOnDemand = function(src, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck && typeof window[globalCheck] !== 'undefined') {
      return resolve(window[globalCheck]);
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (globalCheck && typeof window[globalCheck] !== 'undefined') {
        return resolve(window[globalCheck]);
      }
      existing.addEventListener('load', () => resolve(globalCheck ? window[globalCheck] : true));
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(globalCheck ? window[globalCheck] : true);
    s.onerror = (e) => reject(new Error('โหลดสคริปต์ไม่สำเร็จ: ' + src));
    document.head.appendChild(s);
  });
};

window.ensureExportLibraries = async function(types = ['xlsx']) {
  const promises = [];
  if (types.includes('xlsx')) {
    promises.push(window.loadScriptOnDemand('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX'));
  }
  if (types.includes('html2canvas')) {
    promises.push(window.loadScriptOnDemand('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', 'html2canvas'));
  }
  if (types.includes('pptx')) {
    promises.push(window.loadScriptOnDemand('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'JSZip'));
    promises.push(window.loadScriptOnDemand('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'PptxGenJS'));
  }
  await Promise.all(promises);
};

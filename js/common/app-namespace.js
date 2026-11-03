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

/**
 * src/main.js
 * Application Entry Point for Vite Bundle
 */

// 1. นำเข้า CSS ส่วนกลางที่ผ่าน Tailwind JIT / PostCSS
import './styles/main.css';

// 2. นำเข้า Third-party libraries และผูกลง window เพื่อให้โมดูลและฟังก์ชันเดิมใช้งานได้ครบถ้วน
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';
import html2canvas from 'html2canvas';

window.Chart = Chart;
window.XLSX = XLSX;
window.JSZip = JSZip;
window.pptxgen = pptxgen;
window.PptxGenJS = pptxgen;
window.html2canvas = html2canvas;

// 3. กำหนด Single Namespace Window.App
window.App = window.App || {
  version: '2.1.0-vite',
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

window.App.setCurrentUser = function(name, role = 'staff') {
  if (!name) return;
  window.App.currentUser = {
    id: 'usr_' + Date.now(),
    name: name.trim(),
    role: role
  };
  localStorage.setItem('hospital_current_user', JSON.stringify(window.App.currentUser));
};

try {
  const savedUser = localStorage.getItem('hospital_current_user');
  if (savedUser) {
    window.App.currentUser = JSON.parse(savedUser);
  }
} catch (e) {
  console.warn('Could not load current user from storage:', e);
}

console.log('🚀 Vite Modern Application Bundle Initialized (Clean Modular)');

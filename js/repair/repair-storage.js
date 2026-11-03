/**
 * storage.js
 * จัดการการจัดเก็บข้อมูลลงใน LocalStorage (สำรองข้อมูลจาก Firebase)
 * - phayuha_repairs    : ทะเบียนงานส่งซ่อม
 * - phayuha_equipments : ทะเบียนครุภัณฑ์
 * - phayuha_technicians: รายชื่อช่าง (legacy compat)
 * - phayuha_staff      : รายชื่อเจ้าหน้าที่ (ช่างซ่อม + ผู้ส่งซ่อม)
 */

const STORAGE_KEY_REPAIRS      = 'phayuha_repairs';
const STORAGE_KEY_EQUIPMENTS   = 'phayuha_equipments';
const STORAGE_KEY_TECHNICIANS  = 'phayuha_technicians';
const STORAGE_KEY_STAFF        = 'phayuha_staff';

// ─── Repairs ─────────────────────────────────────────────────────────────────

function loadRepairs() {
  const data = localStorage.getItem(STORAGE_KEY_REPAIRS);
  if (!data) return [];           // เริ่มต้นว่างเปล่า — ยึด Firebase เป็นหลัก
  const parsed = JSON.parse(data);
  let migrated = false;
  parsed.forEach(r => {
    if (r.dept && !r.div) { r.div = r.dept; delete r.dept; migrated = true; }
  });
  if (migrated) saveRepairs(parsed);
  return parsed;
}

function saveRepairs(repairsList) {
  localStorage.setItem(STORAGE_KEY_REPAIRS, JSON.stringify(repairsList));
}

// ─── Equipments ──────────────────────────────────────────────────────────────

function loadEquipments() {
  const data = localStorage.getItem(STORAGE_KEY_EQUIPMENTS);
  if (!data) return [];           // เริ่มต้นว่างเปล่า — ยึด Firebase เป็นหลัก
  const parsed = JSON.parse(data);
  let migrated = false;
  parsed.forEach(eq => {
    if (eq.dept && !eq.div) { eq.div = eq.dept; delete eq.dept; migrated = true; }
  });
  if (migrated) saveEquipments(parsed);
  return parsed;
}

function saveEquipments(equipList) {
  localStorage.setItem(STORAGE_KEY_EQUIPMENTS, JSON.stringify(equipList));
}

// ─── Technicians (legacy — ใช้สำหรับ autocomplete ชื่อช่างในฟอร์ม) ──────────

function loadTechnicians() {
  // ดึงชื่อจาก staff ที่มี role = 'technician' เป็นหลัก
  const staffList = loadStaff();
  const techNames = staffList
    .filter(s => s.role === 'technician')
    .map(s => s.name);
  if (techNames.length > 0) return techNames;
  // fallback: legacy key
  const data = localStorage.getItem(STORAGE_KEY_TECHNICIANS);
  return data ? JSON.parse(data) : [];
}

function saveTechnicians(techList) {
  localStorage.setItem(STORAGE_KEY_TECHNICIANS, JSON.stringify(techList));
}

// ─── Staff (รายชื่อเจ้าหน้าที่ทั้งหมด) ──────────────────────────────────────
// แต่ละรายการ: { id, name, role: 'technician'|'requester', dept }

function loadStaff() {
  const data = localStorage.getItem(STORAGE_KEY_STAFF);
  return data ? JSON.parse(data) : [];
}

function saveStaff(staffList) {
  localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(staffList));
}


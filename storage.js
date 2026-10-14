/**
 * storage.js
 * จัดการข้อมูลจำลองและการจัดเก็บลงใน LocalStorage
 * - phayuha_repairs: ทะเบียนงานส่งซ่อม
 * - phayuha_equipments: ทะเบียนครุภัณฑ์
 * - phayuha_technicians: รายชื่อช่าง/ผู้รับผิดชอบซ่อมบำรุง
 */

const STORAGE_KEY_REPAIRS = 'phayuha_repairs';
const STORAGE_KEY_EQUIPMENTS = 'phayuha_equipments';
const STORAGE_KEY_TECHNICIANS = 'phayuha_technicians';

const DEFAULT_TECHNICIANS = [
  "ช่างวิรัช สมบูรณ์",
  "ช่างสมเกียรติ สถิต",
  "นายชูชาติ ระบบสารสนเทศ",
  "ช่างธนพล วิศวกรรม",
  "บริษัทตัวแทนภายนอก"
];

const DEFAULT_REPAIRS = [
  {
    repairNo: "1/2570",
    date: "2026-10-02",
    div: "แผนกอุบัติเหตุฉุกเฉิน (ER)",
    category: "เครื่องมือแพทย์",
    equipCode: "6510-001-0001",
    equipName: "เครื่องกระตุกหัวใจไฟฟ้า (Defibrillator)",
    symptom: "แบตเตอรี่สำรองไม่เก็บประจุ",
    assignee: "ช่างวิรัช สมบูรณ์",
    status: "เสร็จสิ้น",
    step: "เปลี่ยนแบตเตอรี่และ Calibrate เรียบร้อย",
    cost: 6500
  },
  {
    repairNo: "2/2570",
    date: "2026-10-05",
    div: "หอผู้ป่วยใน (IPD)",
    category: "เครื่องมือแพทย์",
    equipCode: "6510-001-0002",
    equipName: "Infusion Pump",
    symptom: "ขึ้นเตือน Error E04 มอเตอร์ติดขัด",
    assignee: "ช่างสมเกียรติ สถิต",
    status: "เสร็จสิ้น",
    step: "ทำความสะอาดเฟืองขับและทดสอบหยดสารน้ำ",
    cost: 1200
  },
  {
    repairNo: "3/2570",
    date: "2026-10-06",
    div: "ศูนย์คอมพิวเตอร์และสารสนเทศ",
    category: "ระบบคอมพิวเตอร์/เครือข่าย",
    equipCode: "7440-002-0001",
    equipName: "Switch 24-Port ตึกอำนวยการ",
    symptom: "พอร์ตแลนดับ เชื่อมต่อ HIS ไม่ได้",
    assignee: "นายชูชาติ ระบบสารสนเทศ",
    status: "กำลังดำเนินการ",
    step: "เปลี่ยนโมดูลแปลงไฟ Power Supply",
    cost: 4200
  }
];

const DEFAULT_EQUIPMENTS = [
  { equipCode: "6510-001-0001", equipName: "เครื่องกระตุกหัวใจไฟฟ้า (Defibrillator)", category: "เครื่องมือแพทย์", div: "แผนกอุบัติเหตุฉุกเฉิน (ER)", brand: "Zoll", serialNo: "DF-2024-991" },
  { equipCode: "6510-001-0002", equipName: "Infusion Pump", category: "เครื่องมือแพทย์", div: "หอผู้ป่วยใน (IPD)", brand: "Terumo", serialNo: "IP-88210" },
  { equipCode: "6510-001-0003", equipName: "เครื่องปั่นเหวี่ยงตกตะกอน (Centrifuge)", category: "เครื่องมือแพทย์", div: "ห้องปฏิบัติการทางการแพทย์ (Lab)", brand: "Hettich", serialNo: "CF-3301" },
  { equipCode: "6510-001-0004", equipName: "เครื่องอัลตราซาวด์บำบัด", category: "เครื่องมือแพทย์", div: "แผนกกายภาพบำบัด", brand: "BTL", serialNo: "US-5542" },
  { equipCode: "7440-002-0001", equipName: "Switch 24-Port ตึกอำนวยการ", category: "ระบบคอมพิวเตอร์/เครือข่าย", div: "ศูนย์คอมพิวเตอร์และสารสนเทศ", brand: "Cisco", serialNo: "CS-990-SW" },
  { equipCode: "5920-003-0001", equipName: "เครื่องกำเนิดไฟฟ้าสำรอง (Generator)", category: "ระบบสาธารณูปโภค", div: "งานซ่อมบำรุงและสาธารณูปโภค", brand: "Cummins", serialNo: "GEN-500KVA" }
];

function loadRepairs() {
  const data = localStorage.getItem(STORAGE_KEY_REPAIRS);
  if (!data) return DEFAULT_REPAIRS;
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

function loadEquipments() {
  const data = localStorage.getItem(STORAGE_KEY_EQUIPMENTS);
  if (!data) return DEFAULT_EQUIPMENTS;
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

function loadTechnicians() {
  const data = localStorage.getItem(STORAGE_KEY_TECHNICIANS);
  return data ? JSON.parse(data) : DEFAULT_TECHNICIANS;
}

function saveTechnicians(techList) {
  localStorage.setItem(STORAGE_KEY_TECHNICIANS, JSON.stringify(techList));
}

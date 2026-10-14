/**
 * js/common/config.js
 * ศูนย์รวมการตั้งค่าระบบ (Configuration Single Source of Truth)
 */

export const firebaseConfig = {
  apiKey: "AIzaSyDbF85T09sAJzUGQdEuIYQ2_U8TISY4wa0",
  authDomain: "equipmentphayuha-e3f3f.firebaseapp.com",
  projectId: "equipmentphayuha-e3f3f",
  storageBucket: "equipmentphayuha-e3f3f.firebasestorage.app",
  messagingSenderId: "494382324661",
  appId: "1:494382324661:web:e876106fc5852acf4bd7fc",
  measurementId: "G-LBX4QLTBQJ"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  !firebaseConfig.projectId.includes("YOUR_PROJECT_ID")
);

// อัตราอายุการใช้งานมาตรฐานตามประเภทครุภัณฑ์ (เกณฑ์ราชการ/กรมบัญชีกลาง)
export const defaultUsefulLifeYears = {
  'ครุภัณฑ์คอมพิวเตอร์': 5,
  'ครุภัณฑ์การแพทย์': 8,
  'ครุภัณฑ์วิทยาศาสตร์': 8,
  'ครุภัณฑ์ไฟฟ้าและวิทยุ': 5,
  'ครุภัณฑ์ยานพาหนะ': 8,
  'ครุภัณฑ์โรงงาน': 8,
  'ครุภัณฑ์สำนักงาน': 8,
  'ครุภัณฑ์โฆษณาและเผยแพร่': 5,
  'ครุภัณฑ์งานบ้านงานครัว': 5,
  'ครุภัณฑ์การเกษตร': 5,
  'ครุภัณฑ์การศึกษา': 5,
  'ครุภัณฑ์อื่นๆ': 5
};

// ค่าเริ่มต้นฟิลด์ข้อมูลทะเบียนพัสดุ
export const defaultParcelFields = [
  { key: 'noid', label: 'Noid', type: 'text', description: 'รหัสครุภัณฑ์หลักของโรงพยาบาล', required: false },
  { key: 'name', label: 'NAME', type: 'text', description: 'ชื่อเรียกของครุภัณฑ์', required: true },
  {
    key: 'div',
    label: 'Div (แผนก)',
    type: 'combo',
    options: [
      'ซ่อมเครื่องมือทั่วไป',
      'ศูนย์เครื่องมือแพทย์',
      'ไม่ระบุแผนก',
      'กลุ่มงานบริหารทั่วไป',
      'กลุ่มงานทันตกรรม',
      'กลุ่มงานรังสี',
      'กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค',
      'กลุ่มงานเทคนิคการแพทย์',
      'กลุ่มงานการพยาบาล',
      'งานการพยาบาลผู้ป่วยนอก (OPD)',
      'งานการพยาบาลผู้ป่วยใน (IPD)',
      'งานการพยาบาลผู้ป่วยคลอด',
      'งานการผู้ป่วยอุบัติเหตุฉุกเฉินและนิติเวช (ER)',
      'งานการพยาบาลหน่วยควบคุมการติดเชื้อและงานจ่ายกลาง',
      'กลุ่มงานบริการด้านปฐมภูมิและองค์รวม',
      'กลุ่มงานจิตเวชและยาเสพติด',
      'กลุ่มงานประกันสุขภาพยุทธศาสตร์',
      'กลุ่มงานดิจิทัล',
      'งานการเงินและบัญชี',
      'กลุ่มงานโภชนศาสตร์',
      'แผนกการแพทย์แผนไทย',
      'กลุ่มงานเวชศาสตร์ฟื้นฟู'
    ],
    description: 'หน่วยงานหรือแผนกที่ครอบครอง (เลือกหรือพิมพ์เอง)',
    required: true
  },
  {
    key: 'type',
    label: 'TYPE (ประเภท)',
    type: 'combo',
    options: [
      'ครุภัณฑ์การแพทย์',
      'ครุภัณฑ์คอมพิวเตอร์',
      'ครุภัณฑ์สำนักงาน',
      'ครุภัณฑ์ยานพาหนะ',
      'ครุภัณฑ์การเกษตร',
      'ครุภัณฑ์การศึกษา',
      'ครุภัณฑ์งานบ้านงานครัว',
      'ครุภัณฑ์ไฟฟ้าและวิทยุ',
      'ครุภัณฑ์โฆษณาและเผยแพร่',
      'ครุภัณฑ์โรงงาน',
      'ครุภัณฑ์วิทยาศาสตร์',
      'ครุภัณฑ์อื่นๆ'
    ],
    description: 'ประเภทครุภัณฑ์ (เลือกหรือพิมพ์เอง)',
    required: false
  },
  { key: 'usefulLife', label: 'อายุใช้งาน (ปี)', type: 'number', description: 'อายุการใช้งานตามเกณฑ์มาตรฐาน (ปี) เพื่อคิดค่าเสื่อม', required: false },
  { key: 'receiveTm', label: 'วันที่ได้มา (Receive Date)', type: 'date', description: 'วันที่รับมอบ/ตรวจรับ (วว/ดด/ปปปป หรือ YYYY-MM-DD)', required: false },
  { key: 'perUnit', label: 'ราคาต่อหน่วย (Cost)', type: 'number', description: 'ราคาจัดซื้อต่อหน่วย (บาท)', required: false },
  { key: 'tmoney', label: 'เงินงบประมาณ', type: 'text', description: 'แหล่งที่มาของเงินงบประมาณ', required: false },
  { key: 'location', label: 'สถานที่ตั้ง/ห้อง', type: 'text', description: 'จุดติดตั้งหรือห้องที่ใช้งานจริง', required: false },
  { key: 'vendor', label: 'บริษัท/ผู้ขาย', type: 'text', description: 'ผู้จำหน่ายหรือตัวแทนจำหน่าย', required: false },
  { key: 'brand', label: 'ยี่ห้อ (Brand)', type: 'text', description: 'ยี่ห้อผู้ผลิต', required: false },
  { key: 'model', label: 'รุ่น (Model)', type: 'text', description: 'รุ่นของเครื่อง', required: false },
  { key: 'serialNo', label: 'Serial Number', type: 'text', description: 'หมายเลขประจำเครื่อง (S/N)', required: false },
  {
    key: 'kind',
    label: 'KIND (ประเภทเครื่องมือ)',
    type: 'combo',
    options: [
      'เครื่องมือช่วยชีวิต',
      'เครื่องมือช่วยวินิจฉัย',
      'เครื่องมือเพื่อการรักษา',
      'เครื่องมือสนับสนุน'
    ],
    description: 'ประเภทเครื่องมือ (เลือกหรือพิมพ์เอง)',
    required: false
  },
  {
    key: 'risk',
    label: 'Risk (ระดับความเสี่ยง)',
    type: 'combo',
    options: ['1', '2', '3'],
    description: 'ระดับความเสี่ยง 1-3 (เลือกหรือพิมพ์เอง)',
    required: false
  },
  { key: 'remark', label: 'หมายเหตุ (สถานะ)', type: 'combo', options: ['พร้อมใช้', 'ไม่พร้อมใช้', 'จำหน่ายแล้ว'], description: 'สถานะความพร้อมใช้งานปัจจุบัน', required: false },
  { key: 'newDate', label: 'New Date', type: 'number', description: 'ปีหรือรอบการลงทะเบียน', required: false },
  { key: 'pasaduId', label: 'Pasadu ID', type: 'text', description: 'เลข RMC เดิม', required: false }
];

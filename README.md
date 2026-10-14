# ระบบครุภัณฑ์ & บริหารจัดการงานซ่อมบำรุง (Hospital Equipment & Maintenance System)
**โรงพยาบาลพยุหะคีรี (Phayuha Khiri Hospital)**

---

## 📌 สถาปัตยกรรมระบบใหม่ (Clean Modular Architecture - v2.0)
ระบบได้รับการจัดระเบียบโครงสร้างใหม่ทั้งหมด (Refactored to Clean Architecture) แยกโมดูลตามหน้าที่ความรับผิดชอบอย่างชัดเจน (Separation of Concerns) และใช้ **Single Source of Truth** สำหรับการเชื่อมต่อ Firebase และการตั้งค่าระบบ:

```
d:\โบ้\ใบส่งซ่อม\
├── index.html                   # ไฟล์หลักหน้าเว็บ รวม UI ทุกแท็บและโมดอล
├── style.css                    # CSS สไตล์ส่วนกลาง, Responsive Utilities, Print Stylesheet
├── README.md                    # เอกสารคู่มือระบบ
│
├── js/                          # 📁 โฟลเดอร์ซอร์สโค้ดหลักของระบบ
│   ├── common/                  # 🌐 ส่วนกลางที่ทุกโมดูลแชร์ร่วมกัน (Shared Services)
│   │   ├── config.js            # กำหนดค่า Firebase, ค่าเริ่มต้นฟิลด์ครุภัณฑ์, อัตราอายุใช้งานค่าเสื่อมราคา
│   │   ├── firebase.js          # Unified Firestore เชื่อมต่อฐานข้อมูลตัวเดียว จัดการ Realtime และ Multi-tab Cache
│   │   └── utils.js             # ยูทิลิตี้แปลงวันที่ พ.ศ./ค.ศ., จัดรูปแบบตัวเลข/เงิน, สูตรคำนวณค่าเสื่อมราคา
│   │
│   ├── repair/                  # 🛠️ กลุ่มงานบริหารจัดการซ่อมบำรุง (Maintenance Module)
│   │   ├── repair-core.js       # ตัวควบคุมหลักงานซ่อม, ตารางรายการ, ฟอร์มบันทึก, ตัวเชื่อมข้ามระบบ
│   │   ├── repair-dashboard.js  # แดชบอร์ดสถิติซ่อม, กราฟ Chart.js, KPI ค่าใช้จ่าย, SLA
│   │   ├── repair-staff.js      # จัดการรายชื่อช่างซ่อมและผู้ส่งซ่อม (Staff Management)
│   │   ├── repair-storage.js    # จัดการ LocalStorage และแคชข้อมูลงานซ่อม
│   │   └── repair-excel.js      # ส่งออก Excel และรายงานนำเสนอ PowerPoint
│   │
│   └── parcel/                  # 📦 กลุ่มทะเบียนพัสดุและค่าเสื่อมราคา (Equipment & Depreciation Module)
│       ├── parcel-core.js       # ฟอร์มลงทะเบียนพัสดุ, ตารางข้อมูล, การ์ดมือถือ, แดชบอร์ดและกราฟครุภัณฑ์
│       └── parcel-excel.js      # ระบบนำเข้า (Smart Import) และส่งออก Excel ทะเบียนพัสดุ
│
├── _legacy_backup/              # 🗄️ ไฟล์สำรองเดิมก่อนจัดระเบียบโครงสร้าง
└── _archive_scripts/            # 🗄️ สคริปต์สำหรับการพัฒนา/ไมเกรชันข้อมูลเดิม
```

---

## 🔗 จุดเชื่อมโยงระหว่างระบบ (Cross-System Workflow)

1. **ส่งซ่อมจากทะเบียนพัสดุในคลิกเดียว (One-Click Repair):**
   - ปุ่ม `🔧 ส่งซ่อมเครื่องนี้` ในตารางพัสดุ, การ์ดมือถือ, และฟอร์มพัสดุจะเรียกฟังก์ชัน `window.createRepairFromParcelItem(id)`
   - ส่งต่อข้อมูลไปยัง `window.fillRepairFormFromParcel(item)` ใน [js/repair/repair-core.js](file:///d:/%E0%B9%82%E0%B8%9A%E0%B9%89/%E0%B9%83%E0%B8%9A%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1/js/repair/repair-core.js) สลับไปแท็บส่งซ่อมและกรอกชื่อ, Noid, แผนก, ประเภทให้อัตโนมัติ

2. **ระบบคำนวณค่าเสื่อมราคา (Straight-Line Depreciation):**
   - สูตรคำนวณส่วนกลางใน [js/common/utils.js](file:///d:/%E0%B9%82%E0%B8%9A%E0%B9%89/%E0%B9%83%E0%B8%9A%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1/js/common/utils.js) ฟังก์ชัน `calculateDepreciation(item)`
   - อิงเกณฑ์กรมบัญชีกลาง คิดมูลค่าซากคงเหลือ 1 บาท เมื่อครบอายุใช้งานตามประเภท

3. **ฐานข้อมูล Cloud Firestore เดียวกัน:**
   - Collection `repairs`: บันทึกใบส่งซ่อม
   - Collection `staff`: บันทึกช่างซ่อมและผู้ส่งซ่อม
   - Collection `hospital_equipments`: บันทึกทะเบียนครุภัณฑ์
   - Collection `settings/field_configurations`: โครงสร้างฟิลด์ครุภัณฑ์ที่กำหนดเอง

---

## 🚀 แนวทางการดูแลรักษาและการแก้ไขในอนาคต (Future Maintenance)

- **ปรับแก้เกณฑ์ค่าเสื่อมราคา / อายุใช้งาน:** แก้ไขที่ [js/common/config.js](file:///d:/%E0%B9%82%E0%B8%9A%E0%B9%89/%E0%B9%83%E0%B8%9A%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1/js/common/config.js) ใน `defaultUsefulLifeYears`
- **ปรับแต่งการเชื่อมต่อ Cloud / Firebase:** แก้ไขที่ [js/common/firebase.js](file:///d:/%E0%B9%82%E0%B8%9A%E0%B9%89/%E0%B9%83%E0%B8%9A%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1/js/common/firebase.js)
- **ปรับแต่งแดชบอร์ดและกราฟ:**
  - แดชบอร์ดงานซ่อมบำรุง: [js/repair/repair-dashboard.js](file:///d:/%E0%B9%82%E0%B8%9A%E0%B9%89/%E0%B9%83%E0%B8%9A%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1/js/repair/repair-dashboard.js)
  - แดชบอร์ดทะเบียนพัสดุ: [js/parcel/parcel-core.js](file:///d:/%E0%B9%82%E0%B8%9A%E0%B9%89/%E0%B9%83%E0%B8%9A%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1/js/parcel/parcel-core.js) (ฟังก์ชัน `renderParcelCharts`)

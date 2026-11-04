# บันทึกประวัติการพัฒนาและปรับปรุงระบบ (SYSTEM_CHANGELOG.md)
**ระบบครุภัณฑ์ & บริหารจัดการงานซ่อมบำรุง — โรงพยาบาลพยุหะคีรี**

เอกสารนี้ใช้สำหรับติดตาม ตรวจสอบ และบันทึกประวัติการปรับปรุงระบบ (Development & Change Log) สำหรับผู้ดูแลระบบและทีมพัฒนา

---

## 📅 [2026-11-04] - Phase 1 & 2 Modernization: Build Tooling, Offline Support & Firestore Optimization

### 📌 ภาพรวมการเปลี่ยนแปลง
- **Git Branch:** `modernize-build-vite`
- **Commits:**
  - `bac1a5f` — *feat: setup Vite bundle and static Tailwind CSS compilation*
  - `9cda08b` — *feat: implement firestore cursor pagination and filtered queries for repairs and equipments*

---

### 1. การปรับปรุงระบบ Build & Bundle (Phase 1)

#### 1.1 ปัญหาเดิมก่อนแก้ไข
- มีการเรียกใช้ Tailwind Play CDN (`https://cdn.tailwindcss.com`) ขนาด ~3.5 MB ทำให้หน้าเว็บต้องคอมไพล์ CSS สดบนเบราว์เซอร์ทุกครั้ง โหลดช้า เกิดอาการกระตุก (FOUC)
- โหลด Library หลักผ่าน External CDN (Chart.js, SheetJS, JSZip, PPTXGenJS, HTML2Canvas) ทำให้เสี่ยงเมื่อโรงพยาบาลมีปัญหาเครือข่าย หรือถูกบล็อกผ่าน Firewall/Intranet
- สคริปต์มีการผสมกันระหว่าง CDN กับ Global Namespace

#### 1.2 รายละเอียดการแก้ไข
1. **ติดตั้งสภาพแวดล้อมเพื่อการพัฒนา:**
   - ติดตั้ง Node.js LTS (v26.13.0) และ npm (v11.20.0) ผ่าน Windows Package Manager (`winget`)
2. **สร้างโปรเจกต์ Vite และย้าย Dependencies เป็น Local Packages:**
   - สร้าง `package.json` ติดตั้ง:
     - `firebase` (^10.8.0)
     - `chart.js` (^4.4.8)
     - `xlsx` (SheetJS v0.20.3)
     - `jszip` (^3.10.1)
     - `pptxgenjs` (^3.12.0)
     - `html2canvas` (^1.4.1)
     - `tailwindcss` (^3.4.17), `postcss`, `autoprefixer`, `vite` (^6.2.0)
3. **การคอมไพล์ Tailwind CSS เป็น Static File:**
   - สร้าง `src/styles/main.css` และ `tailwind.config.js` ทำการ Tree-shaking สไตล์ที่ไม่ได้ใช้งานออก
   - ผลลัพธ์: ขนาด CSS ลดลงเหลือเพียง **55.59 kB** (บีบอัด gzipped เหลือ ~9.4 kB)
4. **สร้าง Application Entry Point (`src/main.js`):**
   - รวมการนำเข้า CSS, Chart.js, XLSX, JSZip, PptxGenJS, HTML2Canvas และส่งต่อไปยัง Global Namespace (`window.App`, `window.Chart`, `window.XLSX` ฯลฯ) เพื่อให้ระบบและฟังก์ชันเดิมทำงานร่วมกันได้อย่างราบรื่น 100%
5. **ปรับแต่ง `index.html`:**
   - ตัดการโหลด Tailwind CDN และ Script CDN ทั้งหมดออก แทนที่ด้วย `<script type="module" src="/src/main.js"></script>`
6. **สร้างไฟล์การตั้งค่าระบบ:**
   - `vite.config.js`: แยก Vendor Chunks เป็นหมวดหมู่ (`vendor_charts`, `vendor_firebase`, `vendor_export`)
   - `.gitignore`: ป้องกันการ Push `node_modules/` และ `dist/` เข้าคลัง Git

---

### 2. การจัดการประสิทธิภาพการสืบค้นข้อมูล Cloud Firestore (Phase 2)

#### 2.1 ปัญหาเดิมก่อนแก้ไข
- ระบบใช้ `onSnapshot(collection(db, "repairs"))` และ `getDocs(collection(db, "equipments"))` โหลดข้อมูลทั้งหมดมาเก็บในหน่วยความจำเบราว์เซอร์
- เมื่อมีครุภัณฑ์และใบซ่อมสะสมหลักพันถึงหมื่นรายการ จะทำให้โควตา Firestore Reads พุ่งสูง และโทรศัพท์มือถือของช่างค้างจาก Memory Exhaustion
- จุดเชื่อมต่อเดิมของครุภัณฑ์ใน `firebase.js` ชี้ไปที่ Collection `equipments` ซึ่งไม่ตรงกับ Collection หลัก `hospital_equipments`

#### 2.2 รายละเอียดการแก้ไขใน `js/common/firebase.js`
1. **เพิ่มการ Import Firestore SDK Query APIs:**
   - นำเข้า `where`, `limit`, `startAfter` เพิ่มเติมจาก `firebase/firestore`
2. **ปรับปรุงฟังก์ชัน `fetchRepairsFromCloud(filters)` & `listenToRepairsRealtime(onDataUpdate, filters)`:**
   - รองรับพารามิเตอร์ `filters: { status, limitCount }`
   - กรองข้อมูลตามสถานะ และจำกัดจำนวนแถวจากระดับ Database Server ได้โดยตรง
3. **เพิ่มระบบแบ่งหน้า Cursor-based Pagination (`fetchRepairsPaged`):**
   - ฟังก์ชัน: `fetchRepairsPaged({ pageSize = 20, lastDoc = null, status = null })`
   - ใช้ `startAfter(lastDoc)` สำหรับการดึงข้อมูลหน้าถัดไปทีละ 20 รายการ คืนค่า `{ list, lastDoc, hasMore }`
4. **เพิ่มระบบแบ่งหน้าสำหรับทะเบียนครุภัณฑ์ (`fetchEquipmentsPaged`):**
   - ฟังก์ชัน: `fetchEquipmentsPaged({ pageSize = 25, lastDoc = null, category = null })`
   - แบ่งหน้าข้อมูลครุภัณฑ์จาก Collection `hospital_equipments` กรองตามประเภทครุภัณฑ์ได้
5. **แก้ไข Collection ให้ถูกต้องตรงกันทั้งระบบ:**
   - เปลี่ยน `fetchEquipmentsFromCloud()` ให้ดึงจากคอลเลกชัน `hospital_equipments` อย่างถูกต้อง

---

### 3. สรุปผลลัพธ์การ Build Production (Verification)

คำสั่ง: `npm run build`
- **Output Directory:** `dist/`
- **ขนาดและไฟล์ที่ได้:**
  - `dist/index.html` (122.47 kB)
  - `dist/assets/index-*.css` (55.59 kB)
  - `dist/assets/index-*.js` (110.78 kB)
  - `dist/assets/vendor_charts-*.js` (209.08 kB)
  - `dist/assets/vendor_firebase-*.js` (329.76 kB)
  - `dist/assets/vendor_export-*.js` (1,090.03 kB)
- **การทดสอบ:** ผ่านการ Build 100% ไม่มีข้อผิดพลาด

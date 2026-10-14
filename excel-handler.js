/**
 * excel-handler.js
 * จัดการการส่งออก (Export) และนำเข้า (Import) ข้อมูลด้วย SheetJS (xlsx)
 * - นำเข้า/ส่งออกประวัติการซ่อมบำรุง
 * - นำเข้าทะเบียนครุภัณฑ์ (Asset Inventory Import)
 */

// ส่งออกข้อมูลตารางการซ่อมบำรุง
function exportToExcel() {
  if (repairs.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  const exportRows = repairs.map(r => ({
    "เลขที่ใบส่งซ่อม": r.repairNo,
    "วันที่แจ้ง": r.date,
    "แผนก/กลุ่มงาน": r.div,
    "ประเภทครุภัณฑ์": r.category,
    "รหัสครุภัณฑ์": r.equipCode || '',
    "ชื่อครุภัณฑ์": r.equipName,
    "อาการชำรุด": r.symptom,
    "ผู้ดำเนินการซ่อม": r.assignee || 'ยังไม่ระบุ',
    "สถานะ": r.status,
    "ขั้นตอนงานล่าสุด": r.step || '',
    "ค่าใช้จ่าย (บาท)": Number(r.cost) || 0
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "รายงานการซ่อมครุภัณฑ์");

  const todayStr = new Date().toISOString().split('T')[0];
  const fileName = `รายงานการซ่อมบำรุง_รพ_พยุหะคีรี_${todayStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

// นำเข้าข้อมูลประวัติงานซ่อมจาก Excel
function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

      if (jsonRows.length === 0) {
        alert('ไม่พบแถวข้อมูลในไฟล์ที่เลือก');
        return;
      }

      let importedCount = 0;
      jsonRows.forEach(row => {
        const repairNo = row['เลขที่ใบส่งซ่อม'] || row['repairNo'] || generateNextRepairNo();
        const equipName = row['ชื่อครุภัณฑ์'] || row['equipName'] || row['รายการครุภัณฑ์'];

        if (equipName) {
          repairs.push({
            repairNo: repairNo,
            date: row['วันที่แจ้ง'] || row['date'] || new Date().toISOString().split('T')[0],
            div: row['แผนก/กลุ่มงาน'] || row['แผนก'] || row['dept'] || 'ไม่ระบุ',
            category: row['ประเภทครุภัณฑ์'] || row['category'] || 'ครุภัณฑ์สำนักงานทั่วไป',
            equipCode: row['รหัสครุภัณฑ์'] || row['equipCode'] || '',
            equipName: equipName,
            symptom: row['อาการชำรุด'] || row['symptom'] || '-',
            assignee: row['ผู้ดำเนินการซ่อม'] || row['ผู้รับผิดชอบ'] || row['assignee'] || 'ยังไม่ระบุ',
            status: row['สถานะ'] || row['status'] || 'รอดำเนินการ',
            step: row['ขั้นตอนงานล่าสุด'] || row['step'] || '-',
            cost: parseFloat(row['ค่าใช้จ่าย (บาท)'] || row['ค่าใช้จ่าย'] || row['cost']) || 0
          });
          importedCount++;
        }
      });

      saveRepairs(repairs);
      renderTable();
      renderDashboard();
      alert(`นำเข้าประวัติงานซ่อมสำเร็จจำนวน ${importedCount} รายการ`);
      event.target.value = '';
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์ กรุณาตรวจสอบรูปแบบตาราง Excel');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// นำเข้าฐานข้อมูลครุภัณฑ์จาก Excel (Master Assets Import)
function handleEquipmentExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

      if (jsonRows.length === 0) {
        alert('ไม่พบแถวข้อมูลครุภัณฑ์ในไฟล์ที่เลือก');
        return;
      }

      let added = 0;
      let updated = 0;

      jsonRows.forEach(row => {
        const code = (row['รหัสครุภัณฑ์'] || row['หมายเลขครุภัณฑ์'] || row['equipCode'] || '').toString().trim();
        const name = (row['ชื่อครุภัณฑ์'] || row['รายการครุภัณฑ์'] || row['equipName'] || '').toString().trim();
        const dept = (row['แผนก'] || row['กลุ่มงาน'] || row['ที่ตั้ง'] || row['dept'] || '').toString().trim();
        const category = (row['ประเภท'] || row['หมวดหมู่'] || row['category'] || 'เครื่องมือแพทย์').toString().trim();
        const brand = (row['ยี่ห้อ/รุ่น'] || row['ยี่ห้อ'] || row['brand'] || '-').toString().trim();
        const serialNo = (row['Serial No'] || row['S/N'] || row['serialNo'] || '-').toString().trim();

        if (name) {
          // หากไม่มีรหัส ให้สร้างรหัสอัตโนมัติ
          const finalCode = code || generateEquipmentCode(category);
          const existIdx = equipments.findIndex(eq => eq.equipCode === finalCode);

          const itemObj = {
            equipCode: finalCode,
            equipName: name,
            category: category,
            div: dept || 'ส่วนกลาง',
            brand: brand,
            serialNo: serialNo
          };

          if (existIdx >= 0) {
            equipments[existIdx] = itemObj;
            updated++;
          } else {
            equipments.push(itemObj);
            added++;
          }
        }
      });

      saveEquipments(equipments);
      updateEquipmentDatalist();
      alert(`นำเข้าทะเบียนครุภัณฑ์สำเร็จ!\nเพิ่มใหม่: ${added} รายการ\nอัปเดตเดิม: ${updated} รายการ`);
      event.target.value = '';
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์ครุภัณฑ์');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

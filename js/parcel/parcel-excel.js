// Excel / CSV Import & Export Module
import { normalizeDepartment, normalizeThaiDate, parseNoidRange } from '../common/utils.js';

let importData = [];       // merged rows from selected sheets
let importHeaders = [];    // headers (from first selected sheet)
let importWorkbook = null; // keep full workbook for sheet switching
let suspiciousRowSkipSet = new Set(); // row indices user confirmed to skip (suspected headers/titles)

export function initImportExport({ getActiveFields, getCurrentData, getFilteredData, isFirebaseConfigured, db, doc, setDoc, writeBatch, equipCollection, addDoc, onImportComplete }) {
    const importModal = document.getElementById('importModal');
    const exportModal = document.getElementById('exportModal');

    // ===== HELPER: SANITIZE SHEET NAME =====
    // Excel sheet name max 31 chars and cannot contain \ / ? * : [ ]
    function sanitizeSheetName(name, fallback = 'Sheet') {
        let clean = String(name || '').replace(/[\\/?*:[\]]/g, '_').trim();
        if (!clean) clean = fallback;
        if (clean.length > 30) clean = clean.substring(0, 30);
        return clean;
    }

    // ===== HELPER: CONVERT ITEMS TO EXCEL ROWS =====
    function itemsToExportFormat(items, activeFields) {
        return items.map(item => {
            const row = {};
            activeFields.forEach(f => {
                row[f.label] = item[f.key] !== undefined ? item[f.key] : (f.key === 'tmoney' && item['money'] !== undefined ? item['money'] : '');
            });
            return row;
        });
    }

    // ===== UPDATE EXPORT MODAL OPTIONS & COUNTS =====
    function updateExportModalState() {
        if (!exportModal) return;
        const allItems = getCurrentData ? getCurrentData() : [];
        const filteredItems = getFilteredData ? getFilteredData() : allItems;
        const activeFields = getActiveFields();

        // Count labels
        const totalCountEl = document.getElementById('exportTotalCountLabel');
        if (totalCountEl) totalCountEl.textContent = `ทั้งหมด ${allItems.length} รายการ`;

        const filteredCountEl = document.getElementById('exportFilteredCountLabel');
        if (filteredCountEl) filteredCountEl.textContent = `ตามตัวกรอง (${filteredItems.length} รายการ)`;

        // Populate Div select
        const divSelect = document.getElementById('exportDivSelect');
        if (divSelect) {
            const curVal = divSelect.value;
            const divSet = new Set();
            const divField = activeFields.find(f => f.key === 'div');
            if (divField && divField.options) divField.options.forEach(opt => divSet.add(opt));
            allItems.forEach(i => { if (i.div && String(i.div).trim()) divSet.add(String(i.div).trim()); });

            divSelect.innerHTML = '<option value="">-- ทุกแผนก --</option>' +
                [...divSet].sort((a, b) => a.localeCompare(b, 'th')).map(d => `<option value="${d}">${d}</option>`).join('');
            divSelect.value = curVal;
        }

        // Populate Type select
        const typeSelect = document.getElementById('exportTypeSelect');
        if (typeSelect) {
            const curVal = typeSelect.value;
            const typeSet = new Set();
            const typeField = activeFields.find(f => f.key === 'type');
            if (typeField && typeField.options) typeField.options.forEach(opt => typeSet.add(opt));
            allItems.forEach(i => { if (i.type && String(i.type).trim()) typeSet.add(String(i.type).trim()); });

            typeSelect.innerHTML = '<option value="">-- ทุกประเภท --</option>' +
                [...typeSet].sort((a, b) => a.localeCompare(b, 'th')).map(t => `<option value="${t}">${t}</option>`).join('');
            typeSelect.value = curVal;
        }

        updateExportSummary();
    }

    function getSelectedExportItems() {
        const allItems = getCurrentData ? getCurrentData() : [];
        const filteredItems = getFilteredData ? getFilteredData() : allItems;
        const scope = document.querySelector('input[name="exportScope"]:checked')?.value || 'all';
        let baseList = (scope === 'filtered') ? [...filteredItems] : [...allItems];

        // Specific custom filter within modal
        const selectedDiv = document.getElementById('exportDivSelect')?.value || '';
        const selectedType = document.getElementById('exportTypeSelect')?.value || '';

        if (selectedDiv) {
            baseList = baseList.filter(i => (i.div || '').trim() === selectedDiv.trim());
        }
        if (selectedType) {
            baseList = baseList.filter(i => (i.type || '').trim() === selectedType.trim());
        }

        return baseList;
    }

    function updateExportSummary() {
        const items = getSelectedExportItems();
        const groupBy = document.querySelector('input[name="exportGroupBy"]:checked')?.value || 'none';
        const outputType = document.querySelector('input[name="exportOutputType"]:checked')?.value || 'sheets';
        const summaryText = document.getElementById('exportSummaryText');
        const groupSummaryText = document.getElementById('exportGroupSummaryText');
        const outputWrap = document.getElementById('exportOutputFormatWrap');

        if (summaryText) summaryText.textContent = `จะส่งออก ${items.length} รายการ`;

        if (groupBy === 'none') {
            if (outputWrap) outputWrap.classList.add('opacity-50', 'pointer-events-none');
            if (groupSummaryText) groupSummaryText.textContent = 'เป็นไฟล์ Excel เดียว (1 Sheet รวม)';
        } else {
            if (outputWrap) outputWrap.classList.remove('opacity-50', 'pointer-events-none');
            // Calculate number of groups
            const groupKey = (groupBy === 'div') ? 'div' : 'type';
            const groupName = (groupBy === 'div') ? 'แผนก' : 'ประเภท';
            const groupSet = new Set(items.map(i => (i[groupKey] || 'ไม่ระบุ').trim() || 'ไม่ระบุ'));
            const numGroups = groupSet.size;

            if (outputType === 'zip') {
                if (groupSummaryText) groupSummaryText.textContent = `แยกตาม${groupName} ${numGroups} กลุ่ม เป็นไฟล์ Zip รวม ${numGroups} ไฟล์ Excel`;
            } else {
                if (groupSummaryText) groupSummaryText.textContent = `แยกตาม${groupName} ${numGroups} กลุ่ม เป็นไฟล์ Excel เดียว มี ${numGroups} Sheets`;
            }
        }
    }

    // Modal trigger & close
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn && exportModal) {
        exportExcelBtn.addEventListener('click', () => {
            const allItems = getCurrentData ? getCurrentData() : [];
            if (allItems.length === 0) return alert('ไม่มีข้อมูลในการส่งออก');
            updateExportModalState();
            exportModal.classList.remove('hidden');
        });
    }

    const closeExportModal = () => {
        if (exportModal) exportModal.classList.add('hidden');
    };
    document.getElementById('closeExportModalBtn')?.addEventListener('click', closeExportModal);
    document.getElementById('closeExportModalBtn2')?.addEventListener('click', closeExportModal);

    // Filter change listeners inside modal
    ['exportScope', 'exportGroupBy', 'exportOutputType'].forEach(name => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.addEventListener('change', updateExportSummary);
        });
    });

    document.getElementById('exportDivSelect')?.addEventListener('change', updateExportSummary);
    document.getElementById('exportTypeSelect')?.addEventListener('change', updateExportSummary);
    document.getElementById('exportResetFilterSelects')?.addEventListener('click', () => {
        const divSel = document.getElementById('exportDivSelect');
        const typeSel = document.getElementById('exportTypeSelect');
        if (divSel) divSel.value = '';
        if (typeSel) typeSel.value = '';
        updateExportSummary();
    });

    // ===== EXECUTE EXPORT (CONFIRM BUTTON) =====
    document.getElementById('confirmExportBtn')?.addEventListener('click', async () => {
        const items = getSelectedExportItems();
        const activeFields = getActiveFields();
        if (items.length === 0) return alert('ไม่มีรายการข้อมูลที่ตรงตามเงื่อนไขที่เลือก');

        const groupBy = document.querySelector('input[name="exportGroupBy"]:checked')?.value || 'none';
        const outputType = document.querySelector('input[name="exportOutputType"]:checked')?.value || 'sheets';
        const confirmBtn = document.getElementById('confirmExportBtn');
        const dateStr = new Date().toISOString().slice(0, 10);

        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span>⏳</span> กำลังส่งออก...';
        }

        try {
            if (typeof window.ensureExportLibraries === 'function') {
                await window.ensureExportLibraries(outputType === 'zip' ? ['xlsx', 'pptx'] : ['xlsx']);
            }
            if (groupBy === 'none') {
                // Option A: Single sheet with all selected items
                const exportFormat = itemsToExportFormat(items, activeFields);
                const worksheet = XLSX.utils.json_to_sheet(exportFormat);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "EquipmentData");
                XLSX.writeFile(workbook, `Hospital_Equipments_${dateStr}.xlsx`);
            } else {
                // Group items by div or type
                const groupKey = (groupBy === 'div') ? 'div' : 'type';
                const groupLabel = (groupBy === 'div') ? 'แผนก' : 'ประเภท';
                const groups = {};

                items.forEach(item => {
                    const gVal = (item[groupKey] || '').toString().trim() || 'ไม่ระบุ';
                    if (!groups[gVal]) groups[gVal] = [];
                    groups[gVal].push(item);
                });

                if (outputType === 'zip') {
                    // Option B: Multiple Excel files packaged into a ZIP archive
                    if (typeof JSZip === 'undefined') {
                        throw new Error('ไม่พบไลบรารี JSZip กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง');
                    }
                    const zip = new JSZip();

                    Object.entries(groups).forEach(([groupName, groupItems]) => {
                        const exportFormat = itemsToExportFormat(groupItems, activeFields);
                        const ws = XLSX.utils.json_to_sheet(exportFormat);
                        const wb = XLSX.utils.book_new();
                        const sheetName = sanitizeSheetName(groupName, 'Data');
                        XLSX.utils.book_append_sheet(wb, ws, sheetName);

                        // Generate binary excel data
                        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                        const safeFileName = sanitizeSheetName(groupName, 'Group') + `_${dateStr}.xlsx`;
                        zip.file(safeFileName, wbout);
                    });

                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(zipBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Hospital_Equipments_แยกตาม${groupLabel}_${dateStr}.zip`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    // Option C: Single Excel workbook with multiple Sheets (1 per group)
                    const workbook = XLSX.utils.book_new();
                    const usedSheetNames = new Set();

                    // Optional: Add summary overview sheet first
                    const summaryRows = Object.entries(groups).map(([gName, gItems]) => ({
                        [groupLabel]: gName,
                        'จำนวนรายการ': gItems.length
                    }));
                    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
                    XLSX.utils.book_append_sheet(workbook, summaryWs, "สรุปรวม");
                    usedSheetNames.add("สรุปรวม");

                    Object.entries(groups).forEach(([groupName, groupItems]) => {
                        const exportFormat = itemsToExportFormat(groupItems, activeFields);
                        const ws = XLSX.utils.json_to_sheet(exportFormat);
                        let sheetTitle = sanitizeSheetName(groupName, 'Group');

                        // Ensure unique sheet title (Excel requires strictly unique sheet names)
                        let counter = 1;
                        let uniqueTitle = sheetTitle;
                        while (usedSheetNames.has(uniqueTitle)) {
                            uniqueTitle = `${sheetTitle.substring(0, 26)}_${counter}`;
                            counter++;
                        }
                        usedSheetNames.add(uniqueTitle);

                        XLSX.utils.book_append_sheet(workbook, ws, uniqueTitle);
                    });

                    XLSX.writeFile(workbook, `Hospital_Equipments_แยกตาม${groupLabel}_${dateStr}.xlsx`);
                }
            }

            closeExportModal();
        } catch (err) {
            console.error('Export Error:', err);
            alert('เกิดข้อผิดพลาดในการส่งออกไฟล์: ' + err.message);
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<span>📥</span> ส่งออกข้อมูลทันที';
            }
        }
    });

    // ===== EXPORT FOR RMC+ (EXACT FORMAT MATCHING EXR11_V2.MDB / RMCPLUS.COM) =====
    function exportToRmcPlusFormat(items) {
        return items.map((item, idx) => {
            const riskVal = item.risk ? (String(item.risk).match(/^[1-3]/) ? Number(String(item.risk).match(/^[1-3]/)[0]) : item.risk) : 3;
            const perUnitVal = item.perUnit !== undefined && item.perUnit !== '' ? Number(String(item.perUnit).replace(/,/g, '')) || 0 : 0;
            
            // แปลงวันที่ RECEIVE: ต้องเป็น DD/MM/YYYY โดย YYYY เป็นปี ค.ศ. ตามข้อกำหนดเป๊ะๆ
            // หากไม่มีวันที่ หรือเป็นข้อความที่ไม่ใช่วันที่ (เช่น "ปี 39", "ธค 41") ให้ปล่อยเป็นค่าว่าง เพื่อไม่ให้ API พัง
            let receiveVal = '';
            const rawDate = String(item.receiveTm || '').trim();
            if (rawDate) {
                const dateMatch = rawDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
                if (dateMatch) {
                    let d = parseInt(dateMatch[1], 10);
                    let m = parseInt(dateMatch[2], 10);
                    let y = parseInt(dateMatch[3], 10);
                    if (y > 2400) y -= 543; // แปลง พ.ศ. เป็น ค.ศ.
                    const dd = String(d).padStart(2, '0');
                    const mm = String(m).padStart(2, '0');
                    receiveVal = `${dd}/${mm}/${y}`;
                } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
                    let y = parseInt(rawDate.slice(0, 4), 10);
                    if (y > 2400) y -= 543;
                    const mm = rawDate.slice(5, 7);
                    const dd = rawDate.slice(8, 10);
                    receiveVal = `${dd}/${mm}/${y}`;
                } else {
                    // หากมีแต่ปีตัวเลข 4 หลัก เช่น 2562 หรือ 2019
                    const yearOnly = rawDate.match(/(\d{4})/);
                    if (yearOnly) {
                        let y = parseInt(yearOnly[1], 10);
                        if (y > 2400) y -= 543;
                        receiveVal = `01/01/${y}`;
                    } else {
                        receiveVal = ''; // ปล่อยว่างถ้าไม่สามารถแปลงเป็นวันที่ที่ถูกต้องได้
                    }
                }
            }

            // แมปสถานะ New Date ให้ตรงตาม Scope RMC+: "ไม่พร้อมใช้", "Recall", "พร้อมใช้", "รอจำหน่าย", "จำหน่าย"
            let newDateStatus = 'พร้อมใช้';
            const rawStatus = String(item.remark || '').trim();
            if (rawStatus.includes('ไม่พร้อม')) newDateStatus = 'ไม่พร้อมใช้';
            else if (rawStatus.includes('รอจำหน่าย')) newDateStatus = 'รอจำหน่าย';
            else if (rawStatus.includes('จำหน่าย')) newDateStatus = 'จำหน่าย';
            else if (rawStatus.toLowerCase().includes('recall')) newDateStatus = 'Recall';
            else newDateStatus = 'พร้อมใช้';

            // ตรวจสอบและแมปประเภทเครื่องมือ (KIND) ตาม Scope: "เครื่องมือช่วยชีวิต", "เครื่องมือช่วยวินิจฉัย", "เครื่องมือเพื่อการรักษา", "เครื่องมือสนับสนุน"
            const typeStr = String(item.type || '').trim();
            const isMedical = typeStr.includes('การแพทย์') || typeStr.includes('แพทย์');
            let kindVal = 'เครื่องมือสนับสนุน';
            if (isMedical) {
                const rawKind = String(item.kind || '').trim();
                if (rawKind.includes('ชีวิต')) kindVal = 'เครื่องมือช่วยชีวิต';
                else if (rawKind.includes('รักษา')) kindVal = 'เครื่องมือเพื่อการรักษา';
                else if (rawKind.includes('วินิจฉัย')) kindVal = 'เครื่องมือช่วยวินิจฉัย';
                else kindVal = 'เครื่องมือช่วยวินิจฉัย';
            } else {
                kindVal = 'เครื่องมือสนับสนุน';
            }

            // ตรวจสอบวิธีการได้มา (TMONEY)
            let tmoneyVal = String(item.tmoney || item.money || 'ประกวดราคา').trim();
            if (!tmoneyVal) tmoneyVal = 'ประกวดราคา';

            // ตรวจสอบประเภทเงิน (KMONEY)
            let kmoneyVal = String(item.kmoney || 'งบประมาณ').trim();
            if (!kmoneyVal) kmoneyVal = 'งบประมาณ';
            
            // ตรวจสอบชื่อ (NAME*) - ต้องมีค่าเสมอตามเงื่อนไข * และแปลงเครื่องหมายดอกจัน (*) เป็น x ทั้งหมด
            let nameVal = String(item.name || '').trim() || String(item.noid || 'ครุภัณฑ์ไม่ระบุชื่อ');
            nameVal = nameVal.replace(/\*/g, 'x');

            // ตรวจสอบแผนก (Div*) - ต้องมีค่าเสมอตามเงื่อนไข *
            const divVal = String(item.div || '').trim() || 'ไม่ระบุแผนก';

            // ตรวจสอบประเภท (TYPE*) - ต้องมีค่าเสมอตามเงื่อนไข *
            const typeVal = String(item.type || '').trim() || 'ครุภัณฑ์อื่นๆ';
            
            // ลำดับคอลัมน์เป๊ะ 16 คอลัมน์ตามไฟล์ตัวอย่าง (ไม่มีคอลัมน์ ID ส่วนเกิน)
            return {
                'Pasadu ID': item.pasaduId || item.code || '',
                'Noid': item.noid || '',
                'NAME': nameVal,
                'Model': item.model || '',
                'SERIAL_NO': item.serialNo || '',
                'COMPANY': item.vendor || item.company || '',
                'TYPE': typeVal,
                'Div': divVal,
                'RECEIVE': receiveVal,
                'TMONEY': tmoneyVal,
                'KMONEY': kmoneyVal,
                'KIND': kindVal,
                'Risk': riskVal,
                'หมายเหตุ': '',
                'New Date': newDateStatus,
                'PERUNIT': perUnitVal
            };
        });
    }

    const exportRmcBtn = document.getElementById('exportRmcBtn');
    if (exportRmcBtn) {
        exportRmcBtn.addEventListener('click', async () => {
            const currentData = getCurrentData();
            if (!currentData || currentData.length === 0) {
                return alert('ไม่มีข้อมูลในการส่งออก');
            }

            if (typeof window.ensureExportLibraries === 'function') {
                await window.ensureExportLibraries(['xlsx']);
            }

            const rmcRows = exportToRmcPlusFormat(currentData);
            const dateStr = new Date().toISOString().slice(0, 10);

            // สร้าง Workbook โดยตั้งชื่อ Sheet เป็น 'Pasadu' ให้ตรงกับ Master Table ของ RMC 100%
            const ws = XLSX.utils.json_to_sheet(rmcRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pasadu");

            // บันทึกเป็นไฟล์ .xlsx ที่ตั้งชื่อตรงตามมาตรฐาน RMC+
            const fileName = `rmc_import_equipments_${dateStr}.xlsx`;
            XLSX.writeFile(wb, fileName);

            alert(`✅ ส่งออกไฟล์สำหรับ RMC+ สำเร็จ!\n\n📁 ชื่อไฟล์: ${fileName}\n📋 จำนวน: ${rmcRows.length} รายการ\n📌 ชื่อตาราง (Sheet): Pasadu\n\nสามารถนำไฟล์นี้ไปนำเข้าในเว็บ https://rmcplus.com/ ได้ทันทีครับ`);
        });
    }

    // ===== CSV EXPORT (FOR ACCESS) =====
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        const currentData = getCurrentData();
        const activeFields = getActiveFields();
        if (currentData.length === 0) return alert('ไม่มีข้อมูลในการส่งออก');

        const headers = activeFields.map(f => `"${f.label}"`).join(',');
        const csvRows = [headers];

        currentData.forEach(item => {
            const row = activeFields.map(f => {
                const val = item[f.key] !== undefined ? item[f.key] : (f.key === 'tmoney' && item['money'] !== undefined ? item['money'] : '');
                return `"${val}"`;
            });
            csvRows.push(row.join(','));
        });

        const blob = new Blob(["\ufeff" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hospital_Equipments_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ===== IMPORT MODAL CONTROLS =====
    function getSelectedSheets() {
        return [...document.querySelectorAll('.sheet-chk:checked')].map(cb => cb.value);
    }

    function loadSheetsIntoImport() {
        const selectedSheets = getSelectedSheets();
        if (selectedSheets.length === 0) {
            importData = [];
            importHeaders = [];
            suspiciousRowSkipSet = new Set();
            document.getElementById('importRowCount').textContent = '0';
            document.getElementById('importMappingTable').innerHTML = '';
            document.getElementById('importPreview').innerHTML = '';
            hideSuspiciousPanel();
            return;
        }

        let allRows = [];
        let firstHeaders = null;

        const headerKeywords = ['วัน/เดือน/ปี', 'วันเดือนปี', 'เลขที่', 'ยี่ห้อ', 'ชนิด', 'แบบขนาด', 'ราคา', 'แหล่งของเงิน', 'ใช้ประจำที่', 'หลักฐาน'];

        selectedSheets.forEach(sheetName => {
            const sheet = importWorkbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
            if (rows.length === 0) return;

            // Gather merge info for this sheet
            const merges = sheet['!merges'] || [];

            // Find actual header row (often row 0 or row 1 if row 0 is a sheet title/banner)
            let headerRowIdx = rows.slice(0, 10).findIndex(r => {
                const text = r.map(c => String(c).trim()).join(' ');
                const matchKeyword = headerKeywords.some(kw => text.includes(kw));
                const nonEmptyCount = r.filter(c => String(c).trim() !== '').length;
                return matchKeyword || nonEmptyCount >= 3;
            });
            if (headerRowIdx === -1) headerRowIdx = 0;

            const headers = (rows[headerRowIdx] || []).map(h => String(h).trim());
            if (!firstHeaders) firstHeaders = headers;

            // Process data rows (after header) with original Excel row index
            for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
                const row = rows[ri];
                // Skip completely empty rows
                if (!row.some(c => String(c).trim() !== '')) continue;

                let targetRow;
                if (JSON.stringify(headers) !== JSON.stringify(firstHeaders)) {
                    targetRow = firstHeaders.map(h => {
                        const idx = headers.indexOf(h);
                        return idx !== -1 ? row[idx] : '';
                    });
                } else {
                    targetRow = [...row];
                }
                targetRow._sourceSheet = sheetName;

                // Store original Excel row index for merge detection
                targetRow._excelRowIdx = ri;

                // Check if this row has merged cells
                const rowMerges = merges.filter(m => m.s.r <= ri && m.e.r >= ri);
                const isMergedRow = rowMerges.some(m => (m.e.c - m.s.c) >= 2 || (m.e.r - m.s.r) >= 1);

                // Check if row has only 1 non-empty value (likely a section title)
                const nonEmptyCells = row.filter(c => String(c).trim() !== '').length;
                const isSingleValueRow = nonEmptyCells <= 1 && nonEmptyCells > 0;

                targetRow._isMerged = isMergedRow;
                targetRow._isSingleValue = isSingleValueRow;
                targetRow._suspicious = isMergedRow || isSingleValueRow;

                allRows.push(targetRow);
            }
        });

        importHeaders = firstHeaders || [];
        importData = allRows;
        suspiciousRowSkipSet = new Set();
        document.getElementById('importRowCount').textContent = importData.length;

        const allRowsWithHeader = [importHeaders, ...importData];
        renderImportMapping();
        renderImportPreview(allRowsWithHeader);
        detectAndShowSuspiciousRows();
    }

    // ===== SUSPICIOUS ROW DETECTION & REVIEW UI =====
    function hideSuspiciousPanel() {
        const panel = document.getElementById('suspiciousRowsPanel');
        if (panel) panel.classList.add('hidden');
    }

    function detectAndShowSuspiciousRows() {
        const suspiciousRows = [];
        importData.forEach((row, idx) => {
            if (row._suspicious) {
                const cellValues = [];
                for (let c = 0; c < (importHeaders.length || row.length); c++) {
                    const val = String(row[c] || '').trim();
                    if (val) cellValues.push(val);
                }
                suspiciousRows.push({
                    importIdx: idx,
                    sheet: row._sourceSheet || '-',
                    isMerged: row._isMerged,
                    isSingleValue: row._isSingleValue,
                    displayText: cellValues.join(' | ') || '(ว่าง)',
                    rowNum: (row._excelRowIdx || 0) + 1
                });
            }
        });

        const panel = document.getElementById('suspiciousRowsPanel');
        if (!panel) return;

        if (suspiciousRows.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        // Default: mark all suspicious rows to be skipped
        suspiciousRows.forEach(sr => suspiciousRowSkipSet.add(sr.importIdx));

        let html = `
            <div class="flex justify-between items-center mb-2">
                <p class="text-xs font-bold text-orange-800">
                    ⚠️ พบ <span class="text-red-600">${suspiciousRows.length}</span> แถวที่น่าสงสัยว่าเป็นหัวข้อ/หัวตาราง
                </p>
                <div class="flex gap-2">
                    <button type="button" id="suspSelectAllSkipBtn" class="text-[11px] bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded border border-red-300">ข้ามทั้งหมด</button>
                    <button type="button" id="suspSelectAllImportBtn" class="text-[11px] bg-green-100 hover:bg-green-200 text-green-700 px-2 py-0.5 rounded border border-green-300">นำเข้าทั้งหมด</button>
                </div>
            </div>
            <p class="text-[11px] text-gray-500 mb-2">แถวที่มีเซลล์ผสาน หรือมีข้อมูลแค่ช่องเดียว มักเป็นหัวข้อแบ่งหมวดในไฟล์ กรุณาตรวจสอบแล้วเลือกว่าจะ "ข้าม" หรือ "นำเข้า"</p>
            <div class="max-h-48 overflow-y-auto border rounded bg-white">
                <table class="w-full text-xs border-collapse">
                    <thead class="bg-orange-100 sticky top-0">
                        <tr>
                            <th class="p-1.5 border text-center w-16">ข้าม?</th>
                            <th class="p-1.5 border text-center w-12">แถว</th>
                            <th class="p-1.5 border text-left">เนื้อหา</th>
                            <th class="p-1.5 border text-center w-20">สาเหตุ</th>
                            <th class="p-1.5 border text-left w-20">Sheet</th>
                        </tr>
                    </thead>
                    <tbody>`;

        suspiciousRows.forEach(sr => {
            const reasonTags = [];
            if (sr.isMerged) reasonTags.push('<span class="bg-yellow-200 text-yellow-800 px-1 rounded">ผสานเซลล์</span>');
            if (sr.isSingleValue) reasonTags.push('<span class="bg-blue-200 text-blue-800 px-1 rounded">ข้อมูลเดียว</span>');
            html += `
                <tr class="hover:bg-orange-50 susp-row" data-susp-idx="${sr.importIdx}">
                    <td class="p-1.5 border text-center">
                        <input type="checkbox" class="susp-skip-chk w-4 h-4 text-red-600 rounded" data-idx="${sr.importIdx}" checked>
                    </td>
                    <td class="p-1.5 border text-center text-gray-500">${sr.rowNum}</td>
                    <td class="p-1.5 border font-medium text-gray-800 max-w-xs truncate" title="${sr.displayText}">${sr.displayText}</td>
                    <td class="p-1.5 border text-center">${reasonTags.join(' ')}</td>
                    <td class="p-1.5 border text-gray-500">${sr.sheet}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;

        panel.innerHTML = html;
        panel.classList.remove('hidden');

        // Event listeners for checkboxes
        panel.querySelectorAll('.susp-skip-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                if (e.target.checked) {
                    suspiciousRowSkipSet.add(idx);
                } else {
                    suspiciousRowSkipSet.delete(idx);
                }
                updateSuspiciousCount();
            });
        });

        // Select all skip / import buttons
        document.getElementById('suspSelectAllSkipBtn').addEventListener('click', () => {
            panel.querySelectorAll('.susp-skip-chk').forEach(chk => {
                chk.checked = true;
                suspiciousRowSkipSet.add(parseInt(chk.dataset.idx));
            });
            updateSuspiciousCount();
        });
        document.getElementById('suspSelectAllImportBtn').addEventListener('click', () => {
            panel.querySelectorAll('.susp-skip-chk').forEach(chk => {
                chk.checked = false;
                suspiciousRowSkipSet.delete(parseInt(chk.dataset.idx));
            });
            updateSuspiciousCount();
        });

        updateSuspiciousCount();
    }

    function updateSuspiciousCount() {
        const countEl = document.getElementById('suspSkipCount');
        if (countEl) {
            countEl.textContent = suspiciousRowSkipSet.size;
        }
    }

    document.getElementById('importExcelFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (typeof XLSX === 'undefined' && typeof window.ensureExportLibraries === 'function') {
            await window.ensureExportLibraries(['xlsx']);
        }

        document.getElementById('importFileName').textContent = file.name;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            importWorkbook = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
            const sheetNames = importWorkbook.SheetNames;

            const wrap = document.getElementById('sheetSelectorWrap');
            const checkboxContainer = document.getElementById('sheetCheckboxes');
            wrap.classList.remove('hidden');
            checkboxContainer.innerHTML = sheetNames.map((name, i) => `
                <label class="flex items-center gap-1 bg-white border border-purple-300 rounded px-2 py-1 text-xs cursor-pointer hover:bg-purple-50 sheet-label">
                    <input type="checkbox" class="sheet-chk" value="${name}" ${i === 0 ? 'checked' : ''}>
                    <span class="font-semibold text-purple-700">${name}</span>
                </label>
            `).join('');

            document.querySelectorAll('.sheet-chk').forEach(cb => {
                cb.addEventListener('change', loadSheetsIntoImport);
            });

            const activeFields = getActiveFields();

            // Populate Global TYPE dropdown
            const typeField = activeFields.find(f => f.key === 'type');
            const globalTypeSelect = document.getElementById('importGlobalType');
            if (globalTypeSelect && typeField && typeField.options) {
                globalTypeSelect.innerHTML = `<option value="">-- ดึงจากคอลัมน์ในไฟล์ หรือเว้นว่าง --</option>` +
                    typeField.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
            }

            // Populate Global DIV dropdown
            const divField = activeFields.find(f => f.key === 'div');
            const globalDivSelect = document.getElementById('importGlobalDiv');
            if (globalDivSelect && divField && divField.options) {
                globalDivSelect.innerHTML = `<option value="">-- ดึงจากคอลัมน์ในไฟล์ หรือเว้นว่าง --</option>` +
                    divField.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
            }

            loadSheetsIntoImport();
            importModal.classList.remove('hidden');
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    });

    document.getElementById('selectAllSheetsBtn').addEventListener('click', () => {
        document.querySelectorAll('.sheet-chk').forEach(cb => cb.checked = true);
        loadSheetsIntoImport();
    });
    document.getElementById('clearAllSheetsBtn').addEventListener('click', () => {
        document.querySelectorAll('.sheet-chk').forEach(cb => cb.checked = false);
        loadSheetsIntoImport();
    });

    function renderImportMapping() {
        const container = document.getElementById('importMappingTable');
        const activeFields = getActiveFields();
        const fieldOptions = `<option value="">-- ข้าม --</option>` +
            activeFields.map(f => `<option value="${f.key}">${f.label}</option>`).join('');

        const autoMatch = (header, samples) => {
            const h = (header || '').toLowerCase().replace(/[\s\-_/\\().*]/g, '');
            const validSamples = samples.filter(s => s !== null && s !== undefined && String(s).trim() !== '').map(s => String(s).trim());

            const headerRules = {
                'receiveTm': ['วันเดือนปี', 'วันที่รับ', 'วันรับ', 'receivetm', 'receivedate', 'date', 'วันที่'],
                'noid': ['เลขที่', 'noid', 'หมายเลขครุภัณฑ์', 'รหัสครุภัณฑ์'],
                'name': ['ยี่ห้อชนิดแบบขนาดและลักษณะ', 'ยี่ห้อชนิด', 'แบบขนาดและลักษณะ', 'ชื่อรายการ', 'รายการครุภัณฑ์', 'ชื่อครุภัณฑ์', 'ชนิด', 'ยี่ห้อ', 'ชื่อ'],
                'perUnit': ['ราคาต่อหน่วย', 'ราคาหน่วย', 'ราคา/หน่วย', 'ราคาจัดซื้อ', 'ราคาทุน', 'perunit', 'ราคา', 'price', 'amount', 'บาท'],
                'kmoney': ['แหล่งของเงิน', 'แหล่งเงิน', 'งบประมาณ', 'kmoney'],
                'location': ['ใช้ประจำที่', 'สถานที่จัดเก็บ', 'สถานที่เก็บ', 'ที่เก็บ', 'ห้องเก็บ', 'จัดเก็บที่', 'ที่ตั้งอุปกรณ์', 'location'],
                'div': ['แผนก', 'หน่วยงาน', 'ฝ่าย', 'กลุ่มงาน', 'div'],
                'pasaduId': ['pasaduid', 'pasadu', 'rmcเดิม', 'เลขrmc', 'rmc'],
                'tmoney': ['วิธีการได้มา', 'วิธีได้มา', 'การได้มา', 'tmoney', 'money'],
                'type': ['ประเภทครุภัณฑ์', 'ประเภทพัสดุ', 'หมวดครุภัณฑ์', 'type'],
                'model': ['model', 'รุ่น', 'โมเดล'],
                'serialNo': ['serialno', 'serial', 'sn', 's/n', 'หมายเลขเครื่อง'],
                'company': ['บริษัท', 'ผู้จำหน่าย', 'ตัวแทน', 'vendor', 'company'],
                'kind': ['ประเภทเครื่องมือ', 'kind'],
                'risk': ['ระดับความเสี่ยง', 'ความเสี่ยง', 'risk'],
                'remark': ['หมายเหตุ', 'สถานะ', 'remark', 'status'],
                'newDate': ['ปีงบประมาณ', 'ปีที่ได้มา', 'ปี', 'newdate']
            };

            for (const [key, keywords] of Object.entries(headerRules)) {
                if (keywords.some(kw => h === kw || h.includes(kw))) return key;
            }

            if (validSamples.length > 0) {
                const dateRegex = /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|(\d{1,2}\s*[-/.]?\s*(ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค))/i;
                if (validSamples.every(s => dateRegex.test(s))) return 'receiveTm';

                const isCurrency = validSamples.every(s => {
                    const clean = s.replace(/,/g, '');
                    return !isNaN(clean) && clean !== '' && Number(clean) > 0;
                });
                if (isCurrency && validSamples.some(s => Number(s.replace(/,/g, '')) >= 100)) return 'perUnit';

                const isHospitalCode = validSamples.every(s => /^[0-9A-Za-z]{1,4}[A-Za-z0-9/_-]{4,}/.test(s) && (s.includes('-') || s.includes('/')));
                if (isHospitalCode) return 'noid';

                const deptCodes = ['lab', 'opd', 'er', 'ipd', 'or', 'x-ray', 'xray', 'pt', 'ward', 'dent', 'supply'];
                if (validSamples.every(s => deptCodes.includes(s.toLowerCase()))) return 'div';

                const budgetKeywords = ['งบ', 'เงิน', 'บริจาค', 'ค่าเสื่อม', 'ประกันสังคม'];
                if (validSamples.some(s => budgetKeywords.some(b => s.includes(b)))) return 'kmoney';
            }

            return '';
        };

        let html = '<table class="w-full text-sm border-collapse"><thead><tr class="bg-gray-100"><th class="p-2 border text-left">คอลัมน์ใน Excel</th><th class="p-2 border text-left">ตัวอย่างข้อมูล</th><th class="p-2 border text-left">จับคู่กับฟิลด์</th></tr></thead><tbody>';
        const assignedFields = new Set();

        importHeaders.forEach((header, i) => {
            const colSamples = importData.slice(0, 5).map(r => r[i] || '');
            const sampleText = colSamples.filter(s => String(s).trim() !== '').slice(0, 3).join(', ');
            let matched = autoMatch(header, colSamples);

            if (matched && assignedFields.has(matched)) {
                matched = '';
            } else if (matched) {
                assignedFields.add(matched);
            }

            html += `<tr class="hover:bg-gray-50">
                <td class="p-2 border font-semibold text-purple-700">${header || `(คอลัมน์ ${i + 1})`}</td>
                <td class="p-2 border text-gray-500 text-xs max-w-xs truncate" title="${sampleText}">${sampleText || '-'}</td>
                <td class="p-2 border"><select id="map_col_${i}" class="w-full border p-1 rounded text-sm bg-white">${fieldOptions}</select></td>
            </tr>`;

            if (matched) {
                setTimeout(() => {
                    const el = document.getElementById(`map_col_${i}`);
                    if (el) el.value = matched;
                }, 50);
            }
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderImportPreview(rows) {
        const previewRows = rows.slice(0, 6);
        let html = '<table class="w-full border-collapse"><thead><tr class="bg-gray-100 sticky top-0">';
        (previewRows[0] || []).forEach(h => {
            html += `<th class="p-1 border text-left whitespace-nowrap">${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        previewRows.slice(1).forEach(row => {
            html += '<tr class="hover:bg-gray-50">';
            row.forEach(cell => { html += `<td class="p-1 border whitespace-nowrap">${cell}</td>`; });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('importPreview').innerHTML = html;
    }

    document.getElementById('closeImportModalBtn').addEventListener('click', () => importModal.classList.add('hidden'));
    document.getElementById('closeImportModalBtn2').addEventListener('click', () => importModal.classList.add('hidden'));

    // ===== RUN IMPORT ACTION =====
    document.getElementById('doImportBtn').addEventListener('click', async () => {
        const skipFirst = document.getElementById('importSkipFirstRow').checked;
        const rowsToImport = importData;
        const activeFields = getActiveFields();

        const mapping = {};
        importHeaders.forEach((_, i) => {
            const sel = document.getElementById(`map_col_${i}`);
            if (sel && sel.value) mapping[i] = sel.value;
        });

        if (Object.keys(mapping).length === 0) {
            alert('กรุณาจับคู่คอลัมน์อย่างน้อย 1 ช่อง');
            return;
        }

        const selectedGlobalType = document.getElementById('importGlobalType') ? document.getElementById('importGlobalType').value.trim() : '';
        const selectedGlobalDiv = document.getElementById('importGlobalDiv') ? document.getElementById('importGlobalDiv').value.trim() : '';
        const dupStrategy = document.getElementById('importDupStrategy') ? document.getElementById('importDupStrategy').value : 'skip';
        const statusMsg = document.getElementById('importStatusMsg');
        const doImportBtn = document.getElementById('doImportBtn');
        const progressContainer = document.getElementById('importProgressContainer');
        const progressBar = document.getElementById('importProgressBar');
        const progressText = document.getElementById('importProgressText');
        const percentText = document.getElementById('importPercent');

        doImportBtn.disabled = true;
        doImportBtn.textContent = 'กำลังนำเข้า...';
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressBar.className = 'bg-purple-600 h-2.5 rounded-full transition-all duration-100';
        progressText.textContent = `กำลังนำเข้า: 0/${rowsToImport.length} (0%)`;
        percentText.textContent = '0%';
        statusMsg.textContent = '';

        let successCount = 0;
        let updateCount = 0;
        let skipDupCount = 0;
        let skipSuspCount = 0;
        let failCount = 0;
        const totalRows = rowsToImport.length;
        const divField = activeFields.find(f => f.key === 'div');
        const divOptions = (divField && divField.options) ? divField.options : [];
        const newImportedItems = [];

        const autoExpandRanges = document.getElementById('importAutoExpandRanges') ? document.getElementById('importAutoExpandRanges').checked : true;

        // Build Noid lookup map and list of existing range items
        const currentDataList = getCurrentData ? getCurrentData() : [];
        const existingNoidMap = new Map();
        const existingRanges = [];

        currentDataList.forEach(item => {
            const rawNoid = String(item.noid || '').trim();
            if (rawNoid) {
                existingNoidMap.set(rawNoid.toLowerCase(), item);
                const rangeParsed = parseNoidRange(rawNoid);
                if (rangeParsed) {
                    existingRanges.push({ item, parsed: rangeParsed });
                }
            }
        });

        // Set to track duplicates within the current import file
        const batchNoidSet = new Set();
        let expandedItemsCount = 0;

        // Batch writing queue for Firebase
        const pendingWrites = [];
        const flushPendingWrites = async () => {
            if (pendingWrites.length === 0) return;
            const toProcess = pendingWrites.splice(0, pendingWrites.length);
            if (isFirebaseConfigured && db && writeBatch) {
                try {
                    const batch = writeBatch(db);
                    toProcess.forEach(op => {
                        if (op.type === 'create') {
                            batch.set(op.docRef, op.data);
                        } else if (op.type === 'update') {
                            batch.set(op.docRef, op.data, { merge: true });
                        }
                    });
                    await batch.commit();
                    toProcess.forEach(op => {
                        if (op.noidKey) existingNoidMap.set(op.noidKey, { id: op.docRef.id, ...op.data });
                        if (op.type === 'create') successCount++;
                        if (op.type === 'update') updateCount++;
                    });
                } catch (err) {
                    console.error('Batch commit error:', err);
                    failCount += toProcess.length;
                }
            }
        };

        for (let i = 0; i < totalRows; i++) {
            const row = rowsToImport[i];
            const currentIdx = i + 1;
            const percent = Math.round((currentIdx / totalRows) * 100);

            progressBar.style.width = `${percent}%`;
            progressText.textContent = `กำลังนำเข้าแถวที่: ${currentIdx} จาก ${totalRows} (${percent}%)`;
            percentText.textContent = `${percent}%`;

            // Skip rows user confirmed as suspicious headers/titles
            if (suspiciousRowSkipSet.has(i)) {
                skipSuspCount++;
                continue;
            }

            const data = { createdAt: new Date().toISOString() };
            Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
                const f = activeFields.find(f => f.key === fieldKey);
                const cellVal = row[colIdx];
                if (f && f.type === 'number') {
                    data[fieldKey] = Number(String(cellVal || '').replace(/,/g, '').trim()) || 0;
                } else if (fieldKey === 'receiveTm') {
                    data[fieldKey] = cellVal !== undefined && cellVal !== null ? cellVal : '';
                } else {
                    data[fieldKey] = String(cellVal || '').trim();
                }
            });

            // Apply department
            if (selectedGlobalDiv) {
                data.div = selectedGlobalDiv;
            } else {
                data.div = normalizeDepartment(data.div, row._sourceSheet, divOptions);
            }

            // Apply global equipment type
            if (selectedGlobalType) {
                data.type = selectedGlobalType;
            }

            // Normalize risk
            if (data.risk) {
                const match = String(data.risk).trim().match(/^[1-3]/);
                if (match) data.risk = match[0];
            }

            // Normalize Thai date
            if (data.receiveTm) {
                data.receiveTm = normalizeThaiDate(data.receiveTm);
            }

            // Filter header rows
            const isHeaderRow = (rowObj, rawRow) => {
                const headerKeywords = ['วัน/เดือน/ปี', 'วันเดือนปี', 'เลขที่', 'ยี่ห้อ ชนิด', 'แบบขนาดและลักษณะ', 'ราคา/หน่วย', 'แหล่งของเงิน', 'ใช้ประจำที่'];
                const rowTexts = Object.values(rowObj).concat(rawRow).map(v => String(v).trim());
                const matchedHeaderCount = headerKeywords.filter(kw => rowTexts.some(t => t.includes(kw))).length;
                if (matchedHeaderCount >= 2) return true;

                const noNoid = !rowObj.noid || String(rowObj.noid).trim() === '';
                const noDate = !rowObj.receiveTm || String(rowObj.receiveTm).trim() === '';
                const noPrice = !rowObj.perUnit || Number(rowObj.perUnit) === 0;
                if (noNoid && noDate && noPrice) return true;

                const filledFields = Object.entries(rowObj).filter(([k, v]) => k !== 'createdAt' && k !== 'div' && v !== '' && v !== 0);
                if (filledFields.length <= 1 && noNoid) return true;

                return false;
            };

            if (isHeaderRow(data, row)) continue;

            const hasAnyValue = Object.entries(data).some(([k, v]) => k !== 'createdAt' && v !== '' && v !== 0);
            if (!hasAnyValue) continue;

            // ===== SMART RANGE HANDLING & DUPLICATE CHECK =====
            const incomingNoid = String(data.noid || '').trim();
            const rangeInfo = parseNoidRange(incomingNoid);

            // Case A: Incoming is a range (e.g. 12-17พห...) and autoExpandRanges is checked
            if (rangeInfo && autoExpandRanges) {
                let anySaved = false;
                for (const singleNoid of rangeInfo.expanded) {
                    const singleKey = singleNoid.toLowerCase();
                    const isDup = existingNoidMap.has(singleKey) || batchNoidSet.has(singleKey);

                    if (isDup) {
                        if (dupStrategy === 'skip') {
                            skipDupCount++;
                            continue;
                        } else if (dupStrategy === 'update') {
                            const existingItem = existingNoidMap.get(singleKey);
                            if (existingItem) {
                                const updatePayload = { ...data, noid: singleNoid };
                                if (isFirebaseConfigured && db && doc && writeBatch && !existingItem.id.startsWith('local_')) {
                                    pendingWrites.push({
                                        type: 'update',
                                        docRef: doc(db, "hospital_equipments", existingItem.id),
                                        data: updatePayload,
                                        noidKey: singleKey
                                    });
                                    anySaved = true;
                                } else {
                                    Object.assign(existingItem, updatePayload);
                                    updateCount++;
                                    anySaved = true;
                                }
                                continue;
                            }
                        }
                    }

                    // Save new expanded item
                    const itemData = { ...data, noid: singleNoid, createdAt: new Date().toISOString() };
                    batchNoidSet.add(singleKey);

                    if (isFirebaseConfigured && db && writeBatch) {
                        pendingWrites.push({
                            type: 'create',
                            docRef: doc(equipCollection),
                            data: itemData,
                            noidKey: singleKey
                        });
                        anySaved = true;
                    } else {
                        itemData.id = 'local_' + Date.now() + '_' + successCount;
                        existingNoidMap.set(singleKey, itemData);
                        newImportedItems.push(itemData);
                        successCount++;
                        anySaved = true;
                    }
                }
                if (anySaved) expandedItemsCount++;
                if (pendingWrites.length >= 400) {
                    await flushPendingWrites();
                }
                continue; // Done with this row
            }

            // Case B: Incoming is a range (e.g. 12-17พห...) but autoExpand is NOT checked
            if (rangeInfo && !autoExpandRanges) {
                // Check if any sub-item in this range already exists
                const overlappingSingle = rangeInfo.expanded.find(subNoid => existingNoidMap.has(subNoid.toLowerCase()) || batchNoidSet.has(subNoid.toLowerCase()));
                const exactMatch = existingNoidMap.has(incomingNoid.toLowerCase()) || batchNoidSet.has(incomingNoid.toLowerCase());

                if (overlappingSingle || exactMatch) {
                    if (dupStrategy === 'skip') {
                        skipDupCount++;
                        continue;
                    }
                }
            }

            // Case C: Single Noid checking (or exact match)
            const itemNoidKey = incomingNoid.toLowerCase();
            let isDuplicate = false;
            let existingItem = null;

            if (itemNoidKey) {
                if (existingNoidMap.has(itemNoidKey)) {
                    isDuplicate = true;
                    existingItem = existingNoidMap.get(itemNoidKey);
                } else if (batchNoidSet.has(itemNoidKey)) {
                    isDuplicate = true;
                } else {
                    // Check if this single Noid falls into any existing range in the database!
                    for (const { item, parsed } of existingRanges) {
                        if (parsed.expanded.some(en => en.toLowerCase() === itemNoidKey)) {
                            isDuplicate = true;
                            existingItem = item;
                            break;
                        }
                    }
                }
            }

            if (isDuplicate) {
                if (dupStrategy === 'skip') {
                    skipDupCount++;
                    continue; // Skip this row
                } else if (dupStrategy === 'update' && existingItem) {
                    if (isFirebaseConfigured && db && doc && writeBatch && !existingItem.id.startsWith('local_')) {
                        pendingWrites.push({
                            type: 'update',
                            docRef: doc(db, "hospital_equipments", existingItem.id),
                            data: data,
                            noidKey: itemNoidKey
                        });
                    } else {
                        Object.assign(existingItem, data);
                        updateCount++;
                    }
                    if (pendingWrites.length >= 400) {
                        await flushPendingWrites();
                    }
                    continue;
                }
            }

            // Record Noid into tracking maps
            if (itemNoidKey) {
                batchNoidSet.add(itemNoidKey);
            }

            // Collect operations for Batch writing
            if (isFirebaseConfigured && db && writeBatch) {
                pendingWrites.push({
                    type: 'create',
                    docRef: doc(equipCollection),
                    data: data,
                    noidKey: itemNoidKey
                });
            } else {
                data.id = 'local_' + Date.now() + '_' + successCount;
                if (itemNoidKey) existingNoidMap.set(itemNoidKey, data);
                newImportedItems.push(data);
                successCount++;
            }

            // Flush batch every 400 items or at the end of loop
            if (pendingWrites.length >= 400) {
                await flushPendingWrites();
            }

            if (i % 20 === 0 || i === totalRows - 1) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // Flush any remaining writes
        if (pendingWrites.length > 0) {
            await flushPendingWrites();
        }

        if (!isFirebaseConfigured) {
            onImportComplete(newImportedItems);
        }

        progressBar.style.width = '100%';
        percentText.textContent = '100%';
        progressBar.className = failCount > 0 ? 'bg-orange-500 h-2.5 rounded-full' : 'bg-green-600 h-2.5 rounded-full';
        progressText.textContent = `เสร็จสิ้น: ${totalRows}/${totalRows} (100%)`;

        doImportBtn.disabled = false;
        doImportBtn.textContent = '📥 นำเข้าข้อมูล';

        let summaryParts = [`✅ นำเข้าสำเร็จ ${successCount} รายการ`];
        if (expandedItemsCount > 0) summaryParts.push(`🔄 กระจายจากช่วง ${expandedItemsCount} แถว`);
        if (updateCount > 0) summaryParts.push(`🔄 อัปเดตทับเดิม ${updateCount} รายการ`);
        if (skipDupCount > 0) summaryParts.push(`🛡️ ข้ามซ้ำ/ช่วงเดิม ${skipDupCount} รายการ`);
        if (skipSuspCount > 0) summaryParts.push(`📋 ข้ามหัวข้อ ${skipSuspCount} แถว`);
        if (failCount > 0) summaryParts.push(`❌ ผิดพลาด ${failCount} แถว`);

        statusMsg.textContent = summaryParts.join(' | ');

        if (successCount > 0 || updateCount > 0) {
            setTimeout(() => {
                importModal.classList.add('hidden');
                progressContainer.classList.add('hidden');
                statusMsg.textContent = '';
            }, 3000);
        }
    });
}

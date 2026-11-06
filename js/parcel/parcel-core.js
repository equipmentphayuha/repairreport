// Main Application Logic for Hospital Equipment Management
import { db, collection, addDoc, getDocs, getDoc, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from '../common/firebase.js';
import { defaultParcelFields as defaultFields, isFirebaseConfigured } from '../common/config.js';
import { parseQuickDate, parseNoidRange, calculateDepreciation, cleanThaiReceiveDate } from '../common/utils.js';
import { initImportExport } from './parcel-excel.js';

const equipCollection = collection(db, "hospital_equipments");
const configDocRef = doc(db, "settings", "field_configurations");

// State
let activeFields = getStoredFields();
let tempFields = [];
let currentData = getStoredData(); // Always load from local storage first (instant & 0 Reads!)
let pendingChanges = getStoredPendingChanges(); // Track IDs of items modified locally
let currentSortField = 'noid';
let currentSortAsc = true;
let editingId = null;
// Helpers to track pending changes in local storage
function getStoredPendingChanges() {
    try {
        const s = localStorage.getItem('pending_sync_ids');
        return s ? new Set(JSON.parse(s)) : new Set();
    } catch (e) {
        return new Set();
    }
}
function savePendingChanges() {
    try {
        localStorage.setItem('pending_sync_ids', JSON.stringify([...pendingChanges]));
        updateSyncBadge();
    } catch (e) {}
}
function markItemPending(id) {
    pendingChanges.add(id);
    savePendingChanges();
}
function updateSyncBadge() {
    const badge = document.getElementById('pendingSyncBadge');
    if (!badge) return;
    if (pendingChanges.size > 0) {
        badge.textContent = pendingChanges.size;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}
// Helper to order fields according to defaultFields specification
function sortFieldsAccordingToDefault(fields) {
    const defaultOrder = defaultFields.map(d => d.key);
    return [...fields].sort((a, b) => {
        let idxA = defaultOrder.indexOf(a.key === 'money' ? 'tmoney' : a.key);
        let idxB = defaultOrder.indexOf(b.key === 'money' ? 'tmoney' : b.key);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
    });
}
// ===== FIELD STORAGE HELPERS =====
function getStoredFields() {
    const saved = localStorage.getItem('field_configurations');
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            let hasChanges = false;
            defaultFields.forEach(def => {
                let idx = parsed.findIndex(f => f.key === def.key || (def.key === 'tmoney' && f.key === 'money'));
                if (idx !== -1) {
                    if (def.key === 'tmoney' && parsed[idx].key === 'money') {
                        parsed[idx].key = 'tmoney';
                        hasChanges = true;
                    }
                    if (parsed[idx].required !== def.required) {
                        parsed[idx].required = def.required;
                        hasChanges = true;
                    }
                    if (def.type === 'select' || def.type === 'combo') {
                        if (parsed[idx].type !== def.type ||
                            !parsed[idx].options ||
                            JSON.stringify(parsed[idx].options) !== JSON.stringify(def.options) ||
                            parsed[idx].label !== def.label) {
                            parsed[idx].type = def.type;
                            parsed[idx].options = [...def.options];
                            parsed[idx].label = def.label;
                            parsed[idx].description = def.description;
                            hasChanges = true;
                        }
                    } else if (parsed[idx].label !== def.label) {
                        parsed[idx].label = def.label;
                        parsed[idx].description = def.description;
                        hasChanges = true;
                    }
                } else {
                    parsed.push({ ...def });
                    hasChanges = true;
                }
            });
            const sorted = sortFieldsAccordingToDefault(parsed);
            if (hasChanges || JSON.stringify(sorted.map(f => f.key)) !== JSON.stringify(parsed.map(f => f.key))) {
                localStorage.setItem('field_configurations', JSON.stringify(sorted));
            }
            return sorted;
        } catch (e) {
            return JSON.parse(JSON.stringify(defaultFields));
        }
    }
    return JSON.parse(JSON.stringify(defaultFields));
}
function getStoredData() {
    try {
        const saved = localStorage.getItem('hospital_equipments');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}
// ===== RENDER DYNAMIC FORM =====
function renderForm() {
    const form = document.getElementById('equipmentForm');
    form.innerHTML = '';
    activeFields.forEach(f => {
        const wrapper = document.createElement('div');
        const labelContainer = document.createElement('div');
        labelContainer.className = "flex items-center gap-1 mb-1";
        const label = document.createElement('label');
        label.className = "block text-sm font-semibold text-gray-700";
        label.innerHTML = `${f.label} ${f.required ? '<span class="text-red-500 font-bold">*</span>' : ''}`;
        labelContainer.appendChild(label);
        if (f.description) {
            const infoSpan = document.createElement('span');
            infoSpan.className = "text-xs bg-gray-200 text-gray-600 rounded-full w-4 h-4 inline-flex items-center justify-center cursor-help";
            infoSpan.title = f.description;
            infoSpan.innerText = "?";
            labelContainer.appendChild(infoSpan);
        }
        wrapper.appendChild(labelContainer);
        let input;
        if (f.type === 'select') {
            input = document.createElement('select');
            input.className = "w-full border p-2 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.innerText = f.required ? `-- เลือก${f.label} * --` : `-- เลือก${f.label} --`;
            input.appendChild(defaultOption);
            (f.options || []).forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.innerText = opt;
                input.appendChild(option);
            });
        } else if (f.type === 'combo') {
            const datalistId = `dl_${f.key}`;
            input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('list', datalistId);
            input.placeholder = f.required ? `พิมพ์หรือเลือก... *` : `พิมพ์หรือเลือก...`;
            input.className = "w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";
            const datalist = document.createElement('datalist');
            datalist.id = datalistId;
            (f.options || []).forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                datalist.appendChild(option);
            });
            wrapper.appendChild(datalist);
        } else {
            input = document.createElement('input');
            input.type = f.type || 'text';
            input.className = "w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";
            if (f.type === 'number') input.step = "any";
        }
        input.id = f.key;
        if (f.required) input.required = true;
        if (f.description) {
            const descText = document.createElement('p');
            descText.className = "text-[11px] text-gray-400 mt-0.5";
            descText.innerText = f.description;
            wrapper.appendChild(input);
            wrapper.appendChild(descText);
        } else {
            wrapper.appendChild(input);
        }
        form.appendChild(wrapper);
    });
    attachNoidChecker();
    attachDateQuickInput();
}
// ===== DATE INPUT FORMATTER =====
function attachDateQuickInput() {
    const dateInput = document.getElementById('receiveTm');
    if (!dateInput) return;
    dateInput.addEventListener('blur', () => {
        const parsed = parseQuickDate(dateInput.value);
        if (parsed) dateInput.value = parsed;
    });
    dateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const parsed = parseQuickDate(dateInput.value);
            if (parsed) dateInput.value = parsed;
        }
    });
}
// ===== NOID DUPLICATE CHECKER =====
function checkNoidDuplicate(value) {
    if (!value || value.trim() === '') return null;
    const normalized = value.trim().toLowerCase();
    const incomingRange = parseNoidRange(value);
    for (const item of currentData) {
        if (editingId && item.id === editingId) continue;
        const existingNoid = (item.noid || '').trim().toLowerCase();
        if (!existingNoid) continue;
        // Exact match
        if (existingNoid === normalized) return item;
        // If incoming value is a range (e.g. 12-17พห...), does it overlap existing item?
        if (incomingRange && incomingRange.expanded.some(en => en.toLowerCase() === existingNoid)) {
            return item;
        }
        // If existing item in DB is a range, does incoming value fall inside it?
        const existingRange = parseNoidRange(item.noid);
        if (existingRange && existingRange.expanded.some(en => en.toLowerCase() === normalized)) {
            return item;
        }
    }
    return null;
}
function attachNoidChecker() {
    const noidInput = document.getElementById('noid');
    if (!noidInput) return;
    let warnEl = document.getElementById('noid_dup_warn');
    if (!warnEl) {
        warnEl = document.createElement('div');
        warnEl.id = 'noid_dup_warn';
        warnEl.className = 'hidden mt-1 p-2 rounded text-xs font-semibold bg-red-50 border border-red-400 text-red-700';
        noidInput.parentNode.insertBefore(warnEl, noidInput.nextSibling);
    }
    noidInput.addEventListener('input', () => {
        const val = noidInput.value;
        const dup = checkNoidDuplicate(val);
        if (dup) {
            const dupName = dup.name || dup.noid || '(ไม่มีชื่อ)';
            const dupDiv  = dup.div  ? ` | แผนก: ${dup.div}`  : '';
            warnEl.innerHTML = `⚠️ รหัส <strong>"${val}"</strong> ซ้ำกับ: <strong>${dupName}</strong>${dupDiv}`;
            warnEl.classList.remove('hidden');
            noidInput.classList.add('border-red-500', 'ring-1', 'ring-red-400');
        } else {
            warnEl.classList.add('hidden');
            noidInput.classList.remove('border-red-500', 'ring-1', 'ring-red-400');
            if (val.trim() !== '') {
                noidInput.classList.add('border-green-500');
            } else {
                noidInput.classList.remove('border-green-500');
            }
        }
    });
    noidInput.addEventListener('change', () => {
        if (!noidInput.value.trim()) {
            noidInput.classList.remove('border-green-500', 'border-red-500', 'ring-1', 'ring-red-400');
        }
    });
}
// ===== TABLE SORTING & RENDERING =====
let searchQuery = '';
let selectedFilterDiv = '';
let selectedFilterType = '';
let mobileViewMode = 'card'; // 'card' or 'table'
// ฟังก์ชันเปรียบเทียบ Noid แบบอัจฉริยะ (แยกชุดรหัสตัวหลัง กับเลขลำดับเครื่องตัวหน้า)
// เช่น '20พห4110-001-0003' vs '21พห4110-001-0003' -> จัดกลุ่ม 'พห4110-001-0003' ให้อยู่ด้วยกัน แล้วเรียง 20, 21
function compareHospitalNoid(strA, strB) {
    const sA = String(strA || '').trim();
    const sB = String(strB || '').trim();
    if (!sA && !sB) return 0;
    if (!sA) return 1;
    if (!sB) return -1;
    // หาเลขลำดับหน้าสุด (ถ้ามี) เช่น "20" ใน "20พห4110-001-0003"
    const matchA = sA.match(/^(\d+)(.*)$/);
    const matchB = sB.match(/^(\d+)(.*)$/);
    if (matchA && matchB) {
        const prefixA = Number(matchA[1]);
        const suffixA = matchA[2];
        const prefixB = Number(matchB[1]);
        const suffixB = matchB[2];
        // ถ้าชุดรหัสตัวหลังเหมือนกัน ให้เปรียบเทียบเลขลำดับตัวหน้า (20, 21, 22...)
        if (suffixA && suffixB && suffixA === suffixB) {
            return prefixA - prefixB;
        }
        // ถ้าชุดรหัสตัวหลังต่างกัน ให้เรียงตามรหัสตัวหลังก่อน เพื่อให้เครื่องชนิดเดียวกันเกาะกลุ่มกัน
        if (suffixA && suffixB) {
            const cmpSuffix = suffixA.localeCompare(suffixB, 'th', { numeric: true, sensitivity: 'base' });
            if (cmpSuffix !== 0) return cmpSuffix;
            return prefixA - prefixB;
        }
    }
    return sA.localeCompare(sB, 'th', { numeric: true, sensitivity: 'base' });
}
// ===== POPULATE FILTER DROPDOWNS =====
function updateFilterDropdownOptions() {
    const divSelect = document.getElementById('filterDivSelect');
    const typeSelect = document.getElementById('filterTypeSelect');
    if (!divSelect || !typeSelect) return;
    // Collect unique Divs from activeFields and currentData
    const divSet = new Set();
    const divField = activeFields.find(f => f.key === 'div');
    if (divField && divField.options) {
        divField.options.forEach(opt => divSet.add(opt));
    }
    currentData.forEach(item => {
        if (item.div && String(item.div).trim()) divSet.add(String(item.div).trim());
    });
    // Collect unique Types from activeFields and currentData
    const typeSet = new Set();
    const typeField = activeFields.find(f => f.key === 'type');
    if (typeField && typeField.options) {
        typeField.options.forEach(opt => typeSet.add(opt));
    }
    currentData.forEach(item => {
        if (item.type && String(item.type).trim()) typeSet.add(String(item.type).trim());
    });
    // Populate Div options
    const curDiv = divSelect.value;
    divSelect.innerHTML = '<option value="">🏢 ทุกแผนก/กลุ่มงาน</option>' +
        [...divSet].sort((a, b) => a.localeCompare(b, 'th')).map(d => `<option value="${d}">${d}</option>`).join('');
    divSelect.value = curDiv;
    // Populate Type options
    const curType = typeSelect.value;
    typeSelect.innerHTML = '<option value="">🏷️ ทุกประเภท</option>' +
        [...typeSet].sort((a, b) => a.localeCompare(b, 'th')).map(t => `<option value="${t}">${t}</option>`).join('');
    typeSelect.value = curType;
    // Toggle reset filter button visibility
    const resetBtn = document.getElementById('resetFilterBtn');
    if (resetBtn) {
        if (selectedFilterDiv || selectedFilterType || searchQuery) {
            resetBtn.classList.remove('hidden');
            resetBtn.classList.add('flex');
        } else {
            resetBtn.classList.add('hidden');
            resetBtn.classList.remove('flex');
        }
    }
}
// ===== TABLE SORTING & RENDERING =====
function getFilteredAndSortedData() {
    let list = [...currentData];

    // จำกัดการมองเห็น: หากเป็นผู้ใช้ทั่วไป (general_user) มองเห็นเฉพาะแผนกของตนเอง
    const profile = window.currentUserProfile;
    if (profile && profile.role === 'general_user' && profile.department) {
        const cleanUserDept = profile.department.replace(/^(กลุ่มงาน|งาน|ฝ่าย)/, '').trim().toLowerCase();
        list = list.filter(item => {
            const itemDiv = (item.div || '').replace(/^(กลุ่มงาน|งาน|ฝ่าย)/, '').trim().toLowerCase();
            return itemDiv === cleanUserDept || itemDiv.includes(cleanUserDept) || cleanUserDept.includes(itemDiv);
        });
    }
    // Filter by Div (แผนก)
    if (selectedFilterDiv) {
        list = list.filter(item => (item.div || '').trim() === selectedFilterDiv);
    }
    // Filter by Type (ประเภทครุภัณฑ์)
    if (selectedFilterType) {
        list = list.filter(item => (item.type || '').trim() === selectedFilterType);
    }
    // Filter by Search text
    if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        list = list.filter(item => {
            return Object.values(item).some(val => {
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(q);
            });
        });
    }
    if (currentSortField) {
        list.sort((a, b) => {
            let valA = a[currentSortField] !== undefined ? a[currentSortField] : '';
            let valB = b[currentSortField] !== undefined ? b[currentSortField] : '';
            let cmp = 0;
            if (currentSortField === 'noid') {
                cmp = compareHospitalNoid(valA, valB);
                if (!currentSortAsc) cmp = -cmp;
            } else {
                const f = activeFields.find(field => field.key === currentSortField);
                if (f && f.type === 'number') {
                    const numA = Number(valA) || 0;
                    const numB = Number(valB) || 0;
                    cmp = currentSortAsc ? numA - numB : numB - numA;
                } else {
                    cmp = currentSortAsc 
                        ? String(valA).localeCompare(String(valB), 'th', { numeric: true, sensitivity: 'base' })
                        : String(valB).localeCompare(String(valA), 'th', { numeric: true, sensitivity: 'base' });
                }
            }
            // ถ้าค่าในฟิลด์หลักเหมือนกัน (cmp === 0) และไม่ใช่การเรียงตาม noid
            // ให้เรียงลำดับรอง (Secondary Sort) ตาม Noid แบบจัดกลุ่มให้อัตโนมัติ
            if (cmp === 0 && currentSortField !== 'noid') {
                return compareHospitalNoid(a.noid, b.noid);
            }
            return cmp;
        });
    }
    return list;
}
window.toggleSort = (fieldKey) => {
    if (currentSortField === fieldKey) {
        currentSortAsc = !currentSortAsc;
    } else {
        currentSortField = fieldKey;
        currentSortAsc = true;
    }
    renderTableHeader();
    renderDataViews();
};
// Column width state (with default sensible widths)
const columnWidths = {
    'noid': 130,
    'name': 220,
    'div': 160,
    'type': 150,
    'location': 150,
    'perUnit': 120,
    'receiveTm': 120
};
// Load saved column widths from localStorage
try {
    const savedWidths = localStorage.getItem('table_col_widths');
    if (savedWidths) Object.assign(columnWidths, JSON.parse(savedWidths));
} catch (e) {}
function renderTableHeader() {
    const thead = document.getElementById('tableHead');
    if (!thead) return;
    thead.innerHTML = '';
    const tr = document.createElement('tr');
    tr.className = 'bg-gray-100 select-none';
    activeFields.forEach((f, colIdx) => {
        const isSorted = currentSortField === f.key;
        const arrow = isSorted ? (currentSortAsc ? ' 🔼' : ' 🔽') : ' ↕️';
        const sortClass = isSorted ? 'text-blue-700 bg-blue-50 font-bold' : 'hover:bg-gray-200';
        const customWidth = columnWidths[f.key] ? `${columnWidths[f.key]}px` : (f.key === 'name' ? '220px' : 'auto');
        const th = document.createElement('th');
        th.className = `resizable-th p-2.5 border font-semibold whitespace-nowrap cursor-pointer ${sortClass} transition-colors`;
        th.style.width = customWidth;
        th.style.minWidth = '80px';
        th.title = `คลิกเพื่อเรียงตาม ${f.label} (ลากขอบขวาเพื่อปรับขนาด)`;
        th.innerHTML = `
            <span class="truncate block pr-2">${f.label} ${f.required ? '<span class="text-red-500">*</span>' : ''}<span class="text-xs ml-1">${arrow}</span></span>
            <div class="resizer-handle" title="ลากเพื่อขยาย/ย่อคอลัมน์"></div>
        `;
        // Click sort on header (prevent when clicking resizer)
        th.addEventListener('click', (e) => {
            if (e.target.classList.contains('resizer-handle')) return;
            window.toggleSort(f.key);
        });
        // Drag to resize column
        const resizer = th.querySelector('.resizer-handle');
        if (resizer) {
            let startX = 0;
            let startWidth = 0;
            const onMouseMove = (e) => {
                const diff = e.clientX - startX;
                const newWidth = Math.max(70, startWidth + diff);
                th.style.width = `${newWidth}px`;
                columnWidths[f.key] = newWidth;
            };
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'default';
                resizer.classList.remove('resizing');
                try {
                    localStorage.setItem('table_col_widths', JSON.stringify(columnWidths));
                } catch (e) {}
            };
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startWidth = th.offsetWidth;
                document.body.style.cursor = 'col-resize';
                resizer.classList.add('resizing');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
        tr.appendChild(th);
    });
    const manageTh = document.createElement('th');
    manageTh.className = 'p-2.5 border text-center whitespace-nowrap min-w-[160px]';
    manageTh.textContent = 'จัดการ';
    tr.appendChild(manageTh);
    thead.appendChild(tr);
}
function renderTableBody() {
    const displayList = getFilteredAndSortedData();
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${activeFields.length + 1}" class="p-8 text-center text-gray-400">
            ${searchQuery ? '🔍 ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีรายการครุภัณฑ์ในระบบ'}
        </td></tr>`;
        return;
    }
    displayList.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = `hover:bg-blue-50/60 border-b cursor-pointer transition-colors duration-150 ${editingId === item.id ? 'bg-blue-100 font-medium' : ''}`;
        tr.title = "คลิกเพื่อดูการ์ดสรุปประวัติครุภัณฑ์";
        
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            window.openEquipmentPassportModal(item.id);
        });
        let rowHtml = '';
        const currentUser = window.currentUserProfile || {};
        const userRole = currentUser.role || 'general_user';
        const canViewFinancials = (userRole === 'admin' || userRole === 'executive' || userRole === 'parcel_staff');

        activeFields.forEach(f => {
            let val = item[f.key] !== undefined ? item[f.key] : (f.key === 'tmoney' && item['money'] !== undefined ? item['money'] : '');
            if (f.key === 'risk' && val) {
                const m = String(val).trim().match(/^[1-3]/);
                if (m) val = m[0];
            }
            let displayVal = val || '-';

            // ซ่อนราคาจัดซื้อสำหรับผู้ใช้ทั่วไป
            if ((f.key === 'perUnit' || f.key === 'tmoney' || f.key === 'money') && !canViewFinancials) {
                displayVal = '<span class="text-slate-400 italic">***</span>';
            } else if (val !== '' && (f.type === 'number' || f.key === 'perUnit')) {
                const n = Number(String(val).replace(/,/g, ''));
                if (!isNaN(n)) displayVal = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
            }

            // แสดง Criticality Tag สวยงามในคอลัมน์ risk
            if (f.key === 'risk' && val) {
                if (val === '1' || String(val).includes('วิกฤต')) {
                    displayVal = '<span class="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px]">🔴 วิกฤต Tier 1</span>';
                } else if (val === '2' || String(val).includes('สูง')) {
                    displayVal = '<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px]">🟠 สำคัญ Tier 2</span>';
                } else {
                    displayVal = '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">🟢 ทั่วไป Tier 3</span>';
                }
            }

            const cellClass = f.key === 'name' ? 'cell-name' : (f.key === 'location' ? 'cell-location' : (f.key === 'div' ? 'cell-div' : (f.key === 'type' ? 'cell-type' : '')));
            
            rowHtml += `<td class="p-2.5 border text-xs whitespace-nowrap ${cellClass}" title="${String(val || '')}">${displayVal}</td>`;
        });
        rowHtml += `
            <td class="p-2.5 border text-center whitespace-nowrap">
                <button onclick="event.stopPropagation(); window.createRepairFromParcelItem('${item.id}')" class="bg-teal-600 text-white px-2 py-1 rounded text-xs hover:bg-teal-700 mr-1 shadow-sm font-medium" title="เปิดใบส่งซ่อมสำหรับครุภัณฑ์นี้">🔧 ส่งซ่อม</button><button onclick="event.stopPropagation(); window.spreadItem('${item.id}')" class="bg-amber-600 text-white px-2 py-1 rounded text-xs hover:bg-amber-700 mr-1 shadow-sm font-medium" title="กระจายข้อมูล (แยก Noid ที่เป็นช่วง เช่น 12-17 ออกเป็นหลายรายการ)">🔄 กระจาย</button>
                <button onclick="event.stopPropagation(); window.duplicateItem('${item.id}')" class="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 mr-1 shadow-sm font-medium" title="ทำซ้ำรายการนี้ (คัดลอกข้อมูลทั้งหมด เพื่อแก้ไขเฉพาะจุด)">📋 ทำซ้ำ</button>
                <button onclick="event.stopPropagation(); window.editItem('${item.id}')" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 mr-1 shadow-sm font-medium">✏️ แก้ไข</button>
                <button onclick="event.stopPropagation(); window.deleteItem('${item.id}')" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 shadow-sm font-medium">🗑 ลบ</button>
            </td>
        `;
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });
}
// ===== MOBILE CARD VIEW RENDERING =====
function renderMobileCards() {
    const container = document.getElementById('mobileCardContainer');
    if (!container) return;
    const displayList = getFilteredAndSortedData();
    container.innerHTML = '';
    if (displayList.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed">
            ${searchQuery ? '🔍 ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีรายการครุภัณฑ์ในระบบ'}
        </div>`;
        return;
    }
    displayList.forEach(item => {
        const isEditing = editingId === item.id;
        const card = document.createElement('div');
        card.className = `mobile-card bg-white border ${isEditing ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer`;
        card.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('summary')) return;
            window.openEquipmentPassportModal(item.id);
        };
        // Essential quick fields
        const name = item.name || '(ไม่มีชื่อรายการ)';
        const noid = item.noid || '-';
        const type = item.type || '-';
        const div = item.div || '-';
        const receiveTm = item.receiveTm || '-';
        let perUnit = '-';
        const currentUser = window.currentUserProfile || {};
        const userRole = currentUser.role || 'general_user';
        const canViewFinancials = (userRole === 'admin' || userRole === 'executive' || userRole === 'parcel_staff');

        if (canViewFinancials) {
            if (item.perUnit !== undefined && item.perUnit !== '') {
                const n = Number(String(item.perUnit).replace(/,/g, ''));
                perUnit = (!isNaN(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : item.perUnit) + ' บาท';
            }
        } else {
            perUnit = '*** สงวนสิทธิ์ ***';
        }
        const location = item.location || '-';
        let fieldsHtml = '';
        // Other fields
        activeFields.forEach(f => {
            if (['name', 'noid', 'type', 'div'].includes(f.key)) return;
            let val = item[f.key];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                if (f.key === 'risk') {
                    const m = String(val).trim().match(/^[1-3]/);
                    if (m) val = m[0];
                }
                let displayVal = val;
                if ((f.key === 'perUnit' || f.key === 'tmoney' || f.key === 'money') && !canViewFinancials) {
                    displayVal = '***';
                } else if (f.type === 'number' || f.key === 'perUnit') {
                    const n = Number(String(val).replace(/,/g, ''));
                    if (!isNaN(n)) displayVal = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
                }
                if (f.key === 'risk' && val) {
                    if (val === '1' || String(val).includes('วิกฤต')) displayVal = '🔴 วิกฤต Tier 1';
                    else if (val === '2' || String(val).includes('สูง')) displayVal = '🟠 สำคัญ Tier 2';
                    else displayVal = '🟢 ทั่วไป Tier 3';
                }
                fieldsHtml += `
                    <div class="flex justify-between text-xs py-0.5 border-b border-gray-100 last:border-b-0">
                        <span class="text-gray-500 font-medium">${f.label}:</span>
                        <span class="text-gray-800 font-medium text-right ml-2">${displayVal}</span>
                    </div>
                `;
            }
        });
        card.innerHTML = `
            <div class="flex justify-between items-start gap-2 mb-2">
                <div class="flex-1">
                    <span class="inline-block bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full mb-1">
                        🆔 ${noid}
                    </span>
                    <h3 class="font-bold text-gray-900 text-sm leading-tight">${name}</h3>
                </div>
                <div class="flex gap-1 shrink-0">
                    <button onclick="window.createRepairFromParcelItem('${item.id}')" class="bg-teal-600 text-white p-2 rounded-lg text-xs hover:bg-teal-700 shadow-sm font-bold" title="เปิดใบส่งซ่อม">🔧</button><button onclick="window.spreadItem('${item.id}')" class="bg-amber-600 text-white p-2 rounded-lg text-xs hover:bg-amber-700 shadow-sm" title="กระจายข้อมูล">
                        🔄
                    </button>
                    <button onclick="window.duplicateItem('${item.id}')" class="bg-indigo-600 text-white p-2 rounded-lg text-xs hover:bg-indigo-700 shadow-sm" title="ทำซ้ำรายการนี้">
                        📋
                    </button>
                    <button onclick="window.editItem('${item.id}')" class="bg-blue-600 text-white p-2 rounded-lg text-xs hover:bg-blue-700 shadow-sm" title="แก้ไข">
                        ✏️
                    </button>
                    <button onclick="window.deleteItem('${item.id}')" class="bg-red-500 text-white p-2 rounded-lg text-xs hover:bg-red-600 shadow-sm" title="ลบ">
                        🗑
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-x-2 gap-y-1 bg-gray-50 rounded-lg p-2.5 mb-2 text-xs">
                <div><span class="text-gray-500">ประเภท:</span> <span class="font-semibold text-gray-700">${type}</span></div>
                <div><span class="text-gray-500">แผนก:</span> <span class="font-semibold text-gray-700">${div}</span></div>
                <div><span class="text-gray-500">วันที่รับ:</span> <span class="font-semibold text-gray-700">${receiveTm}</span></div>
                <div><span class="text-gray-500">ราคา:</span> <span class="font-bold text-emerald-600">${perUnit}</span></div>
                ${location !== '-' ? `<div class="col-span-2"><span class="text-gray-500">สถานที่:</span> <span class="font-semibold text-gray-700">${location}</span></div>` : ''}
            </div>
            ${fieldsHtml ? `
                <details class="text-xs group">
                    <summary class="cursor-pointer text-blue-600 hover:text-blue-800 font-medium py-1 select-none flex items-center gap-1">
                        <span>ดูข้อมูลเพิ่มเติม</span>
                        <span class="group-open:rotate-180 transition-transform text-[10px]">▼</span>
                    </summary>
                    <div class="mt-1.5 pt-1.5 border-t border-gray-100 space-y-1">
                        ${fieldsHtml}
                    </div>
                </details>
            ` : ''}
        `;
        container.appendChild(card);
    });
}
// Chart instances for parcel dashboard
let parcelTypeChartInstance = null;
let parcelDeptChartInstance = null;
let parcelDeprChartInstance = null;
let parcelDashboardDataCache = null;

// Cross-filter state for dashboard
let dashFilterDiv = '';
let dashFilterType = '';

function setDashFilter(type, value) {
    if (type === 'div') {
        dashFilterDiv = (dashFilterDiv === value) ? '' : value;
    } else if (type === 'type') {
        dashFilterType = (dashFilterType === value) ? '' : value;
    }
    renderParcelDashboard();
}
window.setDashFilter = setDashFilter;

function clearParcelDashFilters() {
    dashFilterDiv = '';
    dashFilterType = '';
    renderParcelDashboard();
}
window.clearParcelDashFilters = clearParcelDashFilters;

function goToInventoryWithDashFilters() {
    if (dashFilterDiv) {
        selectedFilterDiv = dashFilterDiv;
        if (filterDivSelect) filterDivSelect.value = dashFilterDiv;
    }
    if (dashFilterType) {
        selectedFilterType = dashFilterType;
        if (filterTypeSelect) filterTypeSelect.value = dashFilterType;
    }
    if (typeof window.switchTab === 'function') {
        window.switchTab('inventory');
    }
}
window.goToInventoryWithDashFilters = goToInventoryWithDashFilters;

function updateDashFilterBar(targetCount, totalBaseCount) {
    const bar = document.getElementById('parcelDashActiveFilterBar');
    const tagsContainer = document.getElementById('parcelDashFilterTags');
    const resetBtn = document.getElementById('parcelDashResetFilterBtn');
    if (!tagsContainer) return;

    const hasFilter = Boolean(dashFilterDiv || dashFilterType);
    if (resetBtn) {
        if (hasFilter) resetBtn.classList.remove('hidden');
        else resetBtn.classList.add('hidden');
    }

    if (!hasFilter) {
        tagsContainer.innerHTML = `
            <span class="bg-teal-500/20 text-teal-200 border border-teal-500/30 text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                <span>🏢</span> ทั้งโรงพยาบาล (ทุกกลุ่มงาน &amp; ทุกประเภท - รวม ${totalBaseCount.toLocaleString()} รายการ)
            </span>
        `;
    } else {
        let tagsHtml = '';
        if (dashFilterDiv) {
            tagsHtml += `
                <span class="bg-blue-500/30 text-blue-200 border border-blue-400/50 text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm">
                    <span>🏢</span> แผนก: <strong class="text-white">${dashFilterDiv}</strong>
                    <button type="button" onclick="window.setDashFilter('div', '${dashFilterDiv.replace(/'/g, "\\'")}')" class="text-blue-300 hover:text-white font-bold ml-1 text-sm leading-none">&times;</button>
                </span>
            `;
        }
        if (dashFilterType) {
            tagsHtml += `
                <span class="bg-purple-500/30 text-purple-200 border border-purple-400/50 text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm">
                    <span>🏷️</span> ประเภท: <strong class="text-white">${dashFilterType}</strong>
                    <button type="button" onclick="window.setDashFilter('type', '${dashFilterType.replace(/'/g, "\\'")}')" class="text-purple-300 hover:text-white font-bold ml-1 text-sm leading-none">&times;</button>
                </span>
            `;
        }
        tagsHtml += `
            <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-lg font-bold">
                ✓ พบ ${targetCount.toLocaleString()} รายการ (${Math.round((targetCount / (totalBaseCount || 1)) * 100)}%)
            </span>
        `;
        tagsContainer.innerHTML = tagsHtml;
    }
}

function renderParcelDashboard() {
    const dashSection = document.getElementById('dashboardSection');
    if (!dashSection) return;

    // ตรวจสอบสิทธิ์ผู้ใช้งาน: หากเป็น general_user ให้จำกัดกลุ่มงานเริ่มต้น
    const profile = window.currentUserProfile;
    const isGeneralUser = profile && profile.role === 'general_user' && profile.department;
    let baseDataset = currentData;
    if (isGeneralUser) {
        const cleanUserDept = profile.department.replace(/^(กลุ่มงาน|งาน|ฝ่าย)/, '').trim().toLowerCase();
        baseDataset = currentData.filter(item => {
            const itemDiv = (item.div || '').replace(/^(กลุ่มงาน|งาน|ฝ่าย)/, '').trim().toLowerCase();
            return itemDiv === cleanUserDept || itemDiv.includes(cleanUserDept) || cleanUserDept.includes(itemDiv);
        });
    }

    // คำนวณ Distribution รวมของ Base dataset (เพื่อแสดงในแถบสัดส่วนและคงรายการทั้งหมดไว้ให้คลิกเลือกได้)
    const baseTypeMap = {};
    const baseDivMap = {};
    baseDataset.forEach(item => {
        const t = (item.type || 'ไม่ระบุประเภท').trim();
        if (!baseTypeMap[t]) baseTypeMap[t] = { count: 0, value: 0 };
        baseTypeMap[t].count++;
        const p = Number(String(item.perUnit || '').replace(/,/g, '')) || 0;
        baseTypeMap[t].value += p;

        const d = (item.div || 'ไม่ระบุแผนก').trim();
        if (!baseDivMap[d]) baseDivMap[d] = { count: 0, value: 0 };
        baseDivMap[d].count++;
        baseDivMap[d].value += p;
    });

    // กรอง Dataset ตามตัวเลือกแดชบอร์ด (Interactive Cross Filter)
    let filteredDataset = baseDataset;
    if (dashFilterDiv) {
        filteredDataset = filteredDataset.filter(i => (i.div || 'ไม่ระบุแผนก').trim() === dashFilterDiv);
    }
    if (dashFilterType) {
        filteredDataset = filteredDataset.filter(i => (i.type || 'ไม่ระบุประเภท').trim() === dashFilterType);
    }

    // อัปเดต Filter Bar
    updateDashFilterBar(filteredDataset.length, baseDataset.length);

    const totalCount = filteredDataset.length;
    let totalValue = 0;
    let totalBookValue = 0;
    let totalAccDepr = 0;
    const typeMap = {};
    const divMap = {};
    filteredDataset.forEach(item => {
        // Price
        const cleanPriceStr = String(item.perUnit || '').replace(/,/g, '');
        const price = Number(cleanPriceStr) || 0;
        totalValue += price;
        // Depreciation & Net Book Value
        const depr = calculateDepreciation(item);
        if (depr.cost > 0) {
            totalBookValue += depr.bookValue;
            totalAccDepr += depr.accDepr;
        }
        // Type
        const t = (item.type || 'ไม่ระบุประเภท').trim();
        if (!typeMap[t]) typeMap[t] = { count: 0, value: 0 };
        typeMap[t].count++;
        typeMap[t].value += price;
        // Div
        const d = (item.div || 'ไม่ระบุแผนก').trim();
        if (!divMap[d]) divMap[d] = { count: 0, value: 0 };
        divMap[d].count++;
        divMap[d].value += price;
    });

    const elTotalCount = document.getElementById('dashTotalCount');
    const elTotalValue = document.getElementById('dashTotalValue');
    const elTotalBookValue = document.getElementById('dashTotalBookValue');
    const elTotalAccDepr = document.getElementById('dashTotalAccDepr');
    const elTypeCount = document.getElementById('dashTypeCount');
    const elDivCount = document.getElementById('dashDivCount');
    if (elTotalCount) elTotalCount.textContent = totalCount.toLocaleString();
    if (elTotalValue) elTotalValue.textContent = totalValue.toLocaleString();
    if (elTotalBookValue) elTotalBookValue.textContent = totalBookValue.toLocaleString();
    if (elTotalAccDepr) elTotalAccDepr.textContent = totalAccDepr.toLocaleString();
    if (elTypeCount) elTypeCount.textContent = Object.keys(typeMap).length.toLocaleString();
    if (elDivCount) elDivCount.textContent = Object.keys(divMap).length.toLocaleString();

    // Render Type Breakdown
    const typeContainer = document.getElementById('dashTypeBreakdown');
    if (typeContainer) {
        // ใช้ baseTypeMap ในการเรียงหัวข้อ เพื่อให้ผู้ใช้สามารถคลิกสลับประเภทอื่นได้เสมอ
        const sortedTypes = Object.entries(baseTypeMap).sort((a, b) => b[1].count - a[1].count);
        if (sortedTypes.length === 0) {
            typeContainer.innerHTML = '<p class="text-gray-400 py-3 text-center">ไม่มีข้อมูล</p>';
        } else {
            typeContainer.innerHTML = sortedTypes.map(([name, baseData]) => {
                // ข้อมูลปัจจุบันภายใต้เงื่อนไข filter
                const activeData = typeMap[name] || { count: 0, value: 0 };
                const pct = totalCount > 0 ? Math.round((activeData.count / totalCount) * 100) : 0;
                const isSelected = dashFilterType === name;
                return `
                    <div onclick="window.setDashFilter('type', '${name.replace(/'/g, "\\'")}')" 
                        class="p-2 rounded-xl transition-all cursor-pointer ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500 font-bold shadow-sm' : 'hover:bg-purple-50/80 bg-slate-50/60'}" 
                        title="${isSelected ? 'คลิกเพื่อยกเลิกตัวกรองนี้' : 'คลิกเพื่อดูสถิติเฉพาะประเภทนี้'}">
                        <div class="flex justify-between items-center text-xs mb-1 font-medium">
                            <span class="text-gray-800 truncate flex items-center gap-1.5" title="${name}">
                                ${isSelected ? '<span class="text-purple-700">✓</span>' : ''}
                                <span>${name}</span>
                            </span>
                            <div class="text-right shrink-0 ml-2">
                                <span class="font-bold ${isSelected ? 'text-purple-800' : 'text-purple-700'}">${activeData.count.toLocaleString()} ชิ้น</span>
                                <span class="text-gray-400 text-[10px] ml-1">(${pct}%)</span>
                                <span class="text-emerald-600 font-semibold ml-1.5">${activeData.value > 0 ? activeData.value.toLocaleString() + ' ฿' : ''}</span>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-purple-600 h-1.5 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render Div Breakdown
    const divContainer = document.getElementById('dashDivBreakdown');
    if (divContainer) {
        // ใช้ baseDivMap ในการเรียงหัวข้อ เพื่อให้ผู้ใช้สามารถคลิกสลับแผนกอื่นได้เสมอ
        const sortedDivs = Object.entries(baseDivMap).sort((a, b) => b[1].count - a[1].count);
        if (sortedDivs.length === 0) {
            divContainer.innerHTML = '<p class="text-gray-400 py-3 text-center">ไม่มีข้อมูล</p>';
        } else {
            divContainer.innerHTML = sortedDivs.map(([name, baseData]) => {
                const activeData = divMap[name] || { count: 0, value: 0 };
                const pct = totalCount > 0 ? Math.round((activeData.count / totalCount) * 100) : 0;
                const isSelected = dashFilterDiv === name;
                return `
                    <div onclick="window.setDashFilter('div', '${name.replace(/'/g, "\\'")}')" 
                        class="p-2 rounded-xl transition-all cursor-pointer ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 font-bold shadow-sm' : 'hover:bg-blue-50/80 bg-slate-50/60'}" 
                        title="${isSelected ? 'คลิกเพื่อยกเลิกตัวกรองนี้' : 'คลิกเพื่อดูสถิติเฉพาะแผนกนี้'}">
                        <div class="flex justify-between items-center text-xs mb-1 font-medium">
                            <span class="text-gray-800 truncate flex items-center gap-1.5" title="${name}">
                                ${isSelected ? '<span class="text-blue-700">✓</span>' : ''}
                                <span>${name}</span>
                            </span>
                            <div class="text-right shrink-0 ml-2">
                                <span class="font-bold ${isSelected ? 'text-blue-800' : 'text-blue-700'}">${activeData.count.toLocaleString()} ชิ้น</span>
                                <span class="text-gray-400 text-[10px] ml-1">(${pct}%)</span>
                                <span class="text-emerald-600 font-semibold ml-1.5">${activeData.value > 0 ? activeData.value.toLocaleString() + ' ฿' : ''}</span>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render Parcel Charts using Chart.js
    if (typeof Chart !== 'undefined') {
        renderParcelCharts(typeMap, divMap, totalBookValue, totalAccDepr);
    }

    // Cache computed stats for image and presentation export
    const sortedTypes = Object.entries(typeMap).sort((a, b) => b[1].count - a[1].count).map(([name, data]) => ({ name, count: data.count, val: data.value }));
    const sortedDivs = Object.entries(divMap).sort((a, b) => b[1].count - a[1].count).map(([name, data]) => ({ name, count: data.count, val: data.value }));
    parcelDashboardDataCache = {
        totalCount,
        totalValue,
        totalBookValue,
        totalAccDepr,
        typeCount: Object.keys(typeMap).length,
        divCount: Object.keys(divMap).length,
        topTypes: sortedTypes.slice(0, 5),
        topDivs: sortedDivs.slice(0, 5)
    };
}
function renderParcelCharts(typeMap, divMap, totalBookValue, totalAccDepr) {
    // 1. Chart: Type Distribution (Doughnut)
    const typeCanvas = document.getElementById('parcelTypeChart');
    if (typeCanvas) {
        const sortedTypes = Object.entries(typeMap).sort((a, b) => b[1].count - a[1].count).slice(0, 8);
        const labels = sortedTypes.map(t => t[0]);
        const data = sortedTypes.map(t => t[1].count);
        const bgColors = [
            '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
            '#ec4899', '#06b6d4', '#6366f1', '#64748b'
        ];
        if (parcelTypeChartInstance) parcelTypeChartInstance.destroy();
        parcelTypeChartInstance = new Chart(typeCanvas, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['ไม่มีข้อมูล'],
                datasets: [{
                    data: data.length ? data : [0],
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Prompt', size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString()} ชิ้น`
                        }
                    }
                }
            }
        });
    }
    // 2. Chart: Top 10 Departments (Horizontal Bar)
    const deptCanvas = document.getElementById('parcelDeptChart');
    if (deptCanvas) {
        const sortedDivs = Object.entries(divMap).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
        const labels = sortedDivs.map(d => d[0].length > 15 ? d[0].substring(0, 14) + '…' : d[0]);
        const data = sortedDivs.map(d => d[1].count);
        if (parcelDeptChartInstance) parcelDeptChartInstance.destroy();
        parcelDeptChartInstance = new Chart(deptCanvas, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['ไม่มีข้อมูล'],
                datasets: [{
                    label: 'จำนวน (ชิ้น)',
                    data: data.length ? data : [0],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { font: { family: 'Prompt', size: 10 } }, beginAtZero: true },
                    y: { ticks: { font: { family: 'Prompt', size: 10 } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` จำนวน: ${ctx.raw.toLocaleString()} ชิ้น`
                        }
                    }
                }
            }
        });
    }
    // 3. Chart: Depreciation & Net Book Value Status (Doughnut)
    const deprCanvas = document.getElementById('parcelDeprChart');
    if (deprCanvas) {
        if (parcelDeprChartInstance) parcelDeprChartInstance.destroy();
        parcelDeprChartInstance = new Chart(deprCanvas, {
            type: 'doughnut',
            data: {
                labels: ['มูลค่าคงเหลือสุทธิ (Book Value)', 'ค่าเสื่อมสะสม (Acc. Depr)'],
                datasets: [{
                    data: [totalBookValue || 0, totalAccDepr || 0],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Prompt', size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString()} บาท`
                        }
                    }
                }
            }
        });
    }
}
function renderDataViews() {
    updateFilterDropdownOptions();
    renderTableBody();
    renderMobileCards();
    renderParcelDashboard();
    // Update total items count (show filtered count if filtering)
    const totalEl = document.getElementById('totalItems');
    if (totalEl) {
        const filteredCount = getFilteredAndSortedData().length;
        const profile = window.currentUserProfile;
        const isGeneralUser = profile && profile.role === 'general_user';
        if (isGeneralUser) {
            totalEl.innerHTML = `${filteredCount} <span class="text-xs text-gray-500 font-normal">รายการ (${profile.department || 'แผนกของคุณ'})</span>`;
        } else if (selectedFilterDiv || selectedFilterType || searchQuery) {
            totalEl.innerHTML = `${filteredCount} <span class="text-xs text-gray-500 font-normal">/ ทั้งหมด ${currentData.length}</span>`;
        } else {
            totalEl.textContent = currentData.length;
        }
    }
window.renderParcelViews = renderDataViews;
}
// ===== MODAL OPEN / CLOSE HANDLERS =====
function openParcelFormModal(isEdit = false) {
    const modal = document.getElementById('parcelFormModal');
    const modalTitle = document.getElementById('parcelModalTitle');
    if (modal) modal.classList.remove('hidden');
    if (modalTitle) {
        modalTitle.textContent = isEdit ? 'แก้ไขข้อมูลครุภัณฑ์' : 'บันทึกข้อมูลครุภัณฑ์ใหม่';
    }
}
function closeParcelFormModal() {
    const modal = document.getElementById('parcelFormModal');
    if (modal) modal.classList.add('hidden');
}
window.openParcelFormModal = (isEdit = false) => {
    if (!isEdit) {
        setEditMode(false);
        const remarkInput = document.getElementById('remark');
        if (remarkInput) remarkInput.value = 'พร้อมใช้งาน';
    }
    openParcelFormModal(isEdit);
};
window.closeParcelFormModal = closeParcelFormModal;

// ===== EDIT & DELETE HANDLERS =====
function setEditMode(on, item = null) {
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const deleteBtn = document.getElementById('deleteCurrentEditBtn');
    const duplicateBtn = document.getElementById('duplicateCurrentBtn');
    const spreadBtn = document.getElementById('spreadCurrentBtn');
    const modal = document.getElementById('parcelFormModal');
    const modalTitle = document.getElementById('parcelModalTitle');

    if (on && item) {
        editingId = item.id;
        if (submitBtn) {
            submitBtn.innerHTML = '💾 <span>อัปเดตข้อมูล (Update)</span>';
            submitBtn.className = 'w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl shadow-md text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5';
        }
        if (modalTitle) modalTitle.textContent = 'แก้ไขข้อมูลครุภัณฑ์: ' + (item.noid || item.name || '');
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        if (duplicateBtn) {
            duplicateBtn.classList.remove('hidden');
            duplicateBtn.classList.add('flex');
        }
        if (spreadBtn) {
            spreadBtn.classList.remove('hidden');
            spreadBtn.classList.add('flex');
        }
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.classList.add('flex');
        }
        activeFields.forEach(f => {
            const el = document.getElementById(f.key);
            if (!el) return;
            const val = item[f.key] !== undefined ? item[f.key] : (f.key === 'tmoney' && item['money'] !== undefined ? item['money'] : '');
            el.value = val;
        });
        if (modal) modal.classList.remove('hidden');
    } else {
        editingId = null;
        if (submitBtn) {
            submitBtn.innerHTML = '💾 <span>บันทึกข้อมูล (Save)</span>';
            submitBtn.className = 'w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl shadow-md text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5';
        }
        if (modalTitle) modalTitle.textContent = 'บันทึกข้อมูลครุภัณฑ์ใหม่';
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (duplicateBtn) {
            duplicateBtn.classList.add('hidden');
            duplicateBtn.classList.remove('flex');
        }
        if (spreadBtn) {
            spreadBtn.classList.add('hidden');
            spreadBtn.classList.remove('flex');
        }
        if (deleteBtn) {
            deleteBtn.classList.add('hidden');
            deleteBtn.classList.remove('flex');
        }
        const formEl = document.getElementById('equipmentForm');
        if (formEl) {
            formEl.reset();
            const remarkInput = document.getElementById('remark');
            if (remarkInput) remarkInput.value = 'พร้อมใช้งาน';
        }
        renderDataViews();
    }
}
window.duplicateItem = (id) => {
    const item = currentData.find(i => i.id === id);
    if (!item) return;
    // Exit edit mode first so we create a NEW item
    setEditMode(false);
    // Populate all fields into the form
    activeFields.forEach(f => {
        const el = document.getElementById(f.key);
        if (!el) return;
        const val = item[f.key] !== undefined ? item[f.key] : (f.key === 'tmoney' && item['money'] !== undefined ? item['money'] : '');
        
        // Clear unique identifier fields so user fills new ones or avoids duplicate error
        if (f.key === 'noid' || f.key === 'serialNo' || f.key === 'pasaduId') {
            el.value = '';
        } else {
            el.value = val;
        }
    });
    const formCard = document.getElementById('equipmentForm').closest('.bg-white');
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus Noid input for user to type the new item's code
    const noidEl = document.getElementById('noid');
    if (noidEl) {
        noidEl.focus();
        noidEl.classList.add('ring-2', 'ring-indigo-400');
        setTimeout(() => noidEl.classList.remove('ring-2', 'ring-indigo-400'), 2500);
    }
    // Friendly hint notice
    const statusMsg = document.getElementById('noid_dup_warn');
    if (statusMsg) {
        statusMsg.innerHTML = `📋 <strong>คัดลอกข้อมูลจาก "${item.name || item.noid}" แล้ว!</strong><br>กรุณากรอกรหัส Noid ใหม่ และปรับเปลี่ยนรายละเอียดที่ต้องการ แล้วกด "บันทึกข้อมูล"`;
        statusMsg.className = 'mt-1 p-2 rounded text-xs font-semibold bg-indigo-50 border border-indigo-400 text-indigo-800';
        statusMsg.classList.remove('hidden');
    }
};
// ===== SPREAD/EXPAND ITEM (กระจายข้อมูล) =====
window.spreadItem = async (id) => {
    const item = currentData.find(i => i.id === id);
    if (!item) return;
    const noid = String(item.noid || '').trim();
    if (!noid) {
        alert('❌ รายการนี้ไม่มีรหัส Noid ไม่สามารถกระจายข้อมูลได้');
        return;
    }
    // Parse range pattern: "12-17พห7110-006-0014" → start=12, end=17, suffix="พห7110-006-0014"
    // Also support: "12-17 พห7110-006-0014" (with space)
    const rangeMatch = noid.match(/^(\d+)\s*-\s*(\d+)\s*(.+)$/);
    let startNum, endNum, suffix;
    if (rangeMatch) {
        // Has range pattern in Noid
        startNum = parseInt(rangeMatch[1], 10);
        endNum = parseInt(rangeMatch[2], 10);
        suffix = rangeMatch[3];
    } else {
        // No range pattern — ask user to input manually
        const input = prompt(
            `🔢 กระจายข้อมูลรายการ: "${item.name || noid}"\n\n` +
            `Noid ปัจจุบัน: ${noid}\n\n` +
            `กรุณาระบุช่วงเลขนำหน้าที่ต้องการกระจาย\nตัวอย่าง: ถ้าพิมพ์ "12-17" จะสร้างรายการ:\n` +
            `  12${noid.replace(/^\d+/, '')}, 13${noid.replace(/^\d+/, '')}, ... 17${noid.replace(/^\d+/, '')}\n\n` +
            `พิมพ์ช่วงตัวเลข (เช่น 12-17):`
        );
        if (!input || !input.trim()) return;
        const manualMatch = input.trim().match(/^(\d+)\s*-\s*(\d+)$/);
        if (!manualMatch) {
            alert('❌ รูปแบบไม่ถูกต้อง กรุณาพิมพ์เป็นช่วง เช่น "12-17"');
            return;
        }
        startNum = parseInt(manualMatch[1], 10);
        endNum = parseInt(manualMatch[2], 10);
        // Extract suffix from current Noid (remove leading digits)
        const suffixMatch = noid.match(/^(\d+)(.+)$/);
        if (suffixMatch) {
            suffix = suffixMatch[2];
        } else {
            suffix = noid; // Use entire Noid as suffix if no leading digits
        }
    }
    if (startNum > endNum) {
        alert('❌ เลขเริ่มต้นต้องน้อยกว่าหรือเท่ากับเลขสิ้นสุด');
        return;
    }
    const totalItems = endNum - startNum + 1;
    if (totalItems > 100) {
        alert('❌ จำนวนรายการมากเกินไป (มากกว่า 100 ชิ้น) กรุณาตรวจสอบตัวเลขอีกครั้ง');
        return;
    }
    if (totalItems <= 1) {
        alert('ℹ️ ช่วงตัวเลขมีแค่ 1 รายการ ไม่จำเป็นต้องกระจาย');
        return;
    }
    // Determine padding width from startNum and endNum
    const maxLen = Math.max(String(startNum).length, String(endNum).length);
    // Generate preview list
    const previewItems = [];
    for (let n = startNum; n <= endNum; n++) {
        const prefix = String(n).padStart(maxLen, '0');
        previewItems.push(`${prefix}${suffix}`);
    }
    const confirmMsg =
        `🔄 กระจายข้อมูล "${item.name || noid}"\n\n` +
        `จะสร้างทั้งหมด ${totalItems} รายการ:\n` +
        previewItems.slice(0, 10).map((p, i) => `  ${i + 1}. ${p}`).join('\n') +
        (previewItems.length > 10 ? `\n  ... และอีก ${previewItems.length - 10} รายการ` : '') +
        `\n\nรายการแรก (${previewItems[0]}) จะอัปเดตจากรายการเดิม\nอีก ${totalItems - 1} รายการจะถูกสร้างใหม่โดยคัดลอกข้อมูลทั้งหมด\n\nยืนยันหรือไม่?`;
    if (!confirm(confirmMsg)) return;
    // Build base data (copy all fields except id)
    const baseData = {};
    activeFields.forEach(f => {
        const val = item[f.key] !== undefined ? item[f.key] : (f.key === 'tmoney' && item['money'] !== undefined ? item['money'] : '');
        if (f.key !== 'pasaduId') { // Clear unique IDs for copies
            baseData[f.key] = val;
        }
    });
    let successCount = 0;
    let failCount = 0;
    for (let n = startNum; n <= endNum; n++) {
        const prefix = String(n).padStart(maxLen, '0');
        const newNoid = `${prefix}${suffix}`;
        if (n === startNum) {
            // Update the original item's Noid
            item.noid = newNoid;
            markItemPending(item.id);
            successCount++;
        } else {
            // Create new item with copied data
            const newData = { ...baseData, id: 'local_' + Date.now() + '_spread_' + n, noid: newNoid, pasaduId: '', serialNo: '', createdAt: new Date().toISOString() };
            currentData.push(newData);
            markItemPending(newData.id);
            successCount++;
        }
    }
    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    document.getElementById('totalItems').innerText = currentData.length;
    renderDataViews();
    setEditMode(false);
    let resultMsg = `✅ กระจายข้อมูลเสร็จสิ้น!\n\n`;
    resultMsg += `สำเร็จ: ${successCount} รายการ`;
    if (failCount > 0) resultMsg += `\n❌ ผิดพลาด: ${failCount} รายการ`;
    alert(resultMsg);
};
window.editItem = (id) => {
    const item = currentData.find(i => i.id === id);
    if (item) {
        setEditMode(true, item);
        renderDataViews();
    }
};
window.deleteItem = async (id) => {
    if (!confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return;
    if (editingId === id) setEditMode(false);
    if (isFirebaseConfigured && !id.startsWith('local_')) {
        try {
            await deleteDoc(doc(db, "hospital_equipments", id));
        } catch (err) {
            console.error(err);
        }
    }
    pendingChanges.delete(id);
    savePendingChanges();
    currentData = currentData.filter(item => item.id !== id);
    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    document.getElementById('totalItems').innerText = currentData.length;
    renderDataViews();
};
// Form submission (Local-First: Save locally instantly, mark for sync)
document.getElementById('equipmentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const noidInput = document.getElementById('noid');
    if (noidInput && noidInput.value.trim() !== '') {
        const dup = checkNoidDuplicate(noidInput.value);
        if (dup) {
            const dupName = dup.name || dup.noid || '(ไม่มีชื่อ)';
            const dupDiv  = dup.div  ? ` แผนก: ${dup.div}` : '';
            alert(`❌ ไม่สามารถบันทึกได้!\n\nรหัส Noid "${noidInput.value}" ซ้ำกับรายการ:\n📌 ${dupName}${dupDiv}\n\nกรุณาแก้ไขรหัสก่อนบันทึก`);
            noidInput.focus();
            return;
        }
    }
    const data = {};
    activeFields.forEach(f => {
        const el = document.getElementById(f.key);
        if (el) {
            data[f.key] = f.type === 'number' ? (Number(el.value) || 0) : el.value;
        }
    });
    if (editingId) {
        const idx = currentData.findIndex(item => item.id === editingId);
        if (idx !== -1) {
            currentData[idx] = { ...currentData[idx], ...data };
            markItemPending(editingId);
            localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
            renderDataViews();
        }
        alert('✅ บันทึกการแก้ไขลงในเครื่องเรียบร้อยแล้ว!\n(สามารถกดปุ่ม "☁️ ส่งขึ้น Cloud" เมื่อต้องการอัปเดต)');
        setEditMode(false);
        closeParcelFormModal();
    } else {
        data.createdAt = new Date().toISOString();
        data.id = 'local_' + Date.now();
        if (!data.remark || data.remark.trim() === '') {
            data.remark = 'พร้อมใช้งาน';
        }
        currentData.unshift(data);
        markItemPending(data.id);
        localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
        document.getElementById('totalItems').innerText = currentData.length;
        renderDataViews();
        alert('✅ บันทึกรายการใหม่ลงในเครื่องเรียบร้อยแล้ว!\n(สามารถกดปุ่ม "☁️ ส่งขึ้น Cloud" เมื่อต้องการอัปเดต)');
        document.getElementById('equipmentForm').reset();
        const remarkInput = document.getElementById('remark');
        if (remarkInput) remarkInput.value = 'พร้อมใช้งาน';
        closeParcelFormModal();
    }
});
// Delete All
document.getElementById('deleteAllBtn').addEventListener('click', async () => {
    if (currentData.length === 0) return alert('ไม่มีรายการข้อมูลให้ลบ');
    const total = currentData.length;
    if (!confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการ "ลบข้อมูลทั้งหมด" (${total} รายการ)?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้!`)) return;
    if (!confirm(`⚠️ ยืนยันอีกครั้ง! ลบข้อมูลทั้งหมด ${total} รายการ ออกจากระบบอย่างถาวร?`)) return;
    setEditMode(false);
    if (isFirebaseConfigured) {
        const btn = document.getElementById('deleteAllBtn');
        btn.disabled = true;
        btn.textContent = 'กำลังลบทั้งหมด...';
        try {
            const chunks = [];
            for (let i = 0; i < currentData.length; i += 450) {
                chunks.push(currentData.slice(i, i + 450));
            }
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(item => {
                    if (!item.id.startsWith('local_')) {
                        batch.delete(doc(db, "hospital_equipments", item.id));
                    }
                });
                await batch.commit();
            }
            alert('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว');
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการลบข้อมูลทั้งหมด: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🗑️ ลบทั้งหมด';
        }
    } else {
        currentData = [];
        localStorage.setItem('hospital_equipments', JSON.stringify([]));
        document.getElementById('totalItems').innerText = '0';
        renderDataViews();
        alert('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว');
    }
});
document.getElementById('resetBtn').addEventListener('click', () => setEditMode(false));
document.getElementById('cancelEditBtn').addEventListener('click', () => setEditMode(false));
document.getElementById('deleteCurrentEditBtn').addEventListener('click', () => {
    if (editingId) window.deleteItem(editingId);
});
const duplicateCurrentBtn = document.getElementById('duplicateCurrentBtn');
if (duplicateCurrentBtn) {
    duplicateCurrentBtn.addEventListener('click', () => {
        if (editingId) {
            window.duplicateItem(editingId);
        }
    });
}
const spreadCurrentBtn = document.getElementById('spreadCurrentBtn');
if (spreadCurrentBtn) {
    spreadCurrentBtn.addEventListener('click', () => {
        if (editingId) {
            window.spreadItem(editingId);
        }
    });
}
// ===== FIELD CONFIGURATION MODAL & BASE URL SETTINGS =====
const configModal = document.getElementById('configModal');

window.getParcelBaseUrl = function() {
    const saved = localStorage.getItem('parcel_qr_base_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
    return window.location.origin + window.location.pathname.replace(/\/$/, '');
};

window.useCurrentHostAsBaseUrl = function() {
    const current = window.location.origin + window.location.pathname.replace(/\/$/, '');
    const input = document.getElementById('configWebBaseUrl');
    if (input) input.value = current;
};

document.getElementById('openConfigModalBtn').addEventListener('click', () => {
    tempFields = JSON.parse(JSON.stringify(activeFields));
    renderConfigList();
    const urlInput = document.getElementById('configWebBaseUrl');
    if (urlInput) {
        urlInput.value = localStorage.getItem('parcel_qr_base_url') || '';
    }
    configModal.classList.remove('hidden');
});
document.getElementById('closeConfigModalBtn').addEventListener('click', () => configModal.classList.add('hidden'));
document.getElementById('newFieldType').addEventListener('change', (e) => {
    const group = document.getElementById('selectOptionGroup');
    if (e.target.value === 'select' || e.target.value === 'combo') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
    }
});
document.getElementById('addNewFieldBtn').addEventListener('click', () => {
    const key = document.getElementById('newFieldKey').value.trim();
    const label = document.getElementById('newFieldLabel').value.trim();
    const type = document.getElementById('newFieldType').value;
    const desc = document.getElementById('newFieldDesc').value.trim();
    const rawOpts = document.getElementById('newFieldOptions').value.trim();
    if (!key || !label) {
        return alert('กรุณากรอกรหัสฟิลด์ (Key) และชื่อฟิลด์ที่แสดง (Label)');
    }
    if (tempFields.some(f => f.key === key)) {
        return alert('รหัสฟิลด์ (Key) นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น');
    }
    const newFieldObj = {
        key: key,
        label: label,
        type: type,
        description: desc,
        required: false
    };
    if (type === 'select' || type === 'combo') {
        newFieldObj.options = rawOpts ? rawOpts.split(',').map(s => s.trim()).filter(Boolean) : ['ตัวเลือก 1', 'ตัวเลือก 2'];
    }
    tempFields.push(newFieldObj);
    document.getElementById('newFieldKey').value = '';
    document.getElementById('newFieldLabel').value = '';
    document.getElementById('newFieldDesc').value = '';
    document.getElementById('newFieldOptions').value = '';
    renderConfigList();
});
function renderConfigList() {
    const container = document.getElementById('configList');
    container.innerHTML = '';
    tempFields.forEach((f, idx) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = "p-3 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-12 gap-2 items-center";
        itemDiv.innerHTML = `
            <div class="md:col-span-3 text-xs font-bold text-gray-600">
                Key: <span class="text-blue-600">${f.key}</span> (${f.type})
                ${f.required ? '<span class="text-red-500 font-bold ml-1">*จำเป็น</span>' : ''}
            </div>
            <div class="md:col-span-4">
                <label class="block text-[11px] font-semibold text-gray-600">ชื่อฟิลด์ที่แสดง (Label)</label>
                <input type="text" id="cfg_label_${idx}" value="${f.label}" class="w-full border p-1.5 rounded text-sm bg-white">
            </div>
            <div class="md:col-span-4">
                <label class="block text-[11px] font-semibold text-gray-600">คำอธิบายเพิ่มเติม (Description)</label>
                <input type="text" id="cfg_desc_${idx}" value="${f.description || ''}" class="w-full border p-1.5 rounded text-sm bg-white">
            </div>
            <div class="md:col-span-1 flex justify-end">
                <button onclick="window.removeTempField(${idx})" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600" title="ลบช่องนี้">ลบ</button>
            </div>
            ${(f.type === 'select' || f.type === 'combo') ? `
            <div class="md:col-span-12 mt-1">
                <label class="block text-[11px] font-semibold text-gray-600">ตัวเลือก (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                <input type="text" id="cfg_options_${idx}" value="${(f.options || []).join(', ')}" class="w-full border p-1.5 rounded text-sm bg-white">
            </div>
            ` : ''}
        `;
        container.appendChild(itemDiv);
    });
}
window.removeTempField = (idx) => {
    if (confirm(`คุณต้องการลบช่อง "${tempFields[idx].label}" ออกใช่หรือไม่?`)) {
        tempFields.splice(idx, 1);
        renderConfigList();
    }
};
document.getElementById('saveConfigBtn').addEventListener('click', async () => {
    tempFields.forEach((f, idx) => {
        const lbl = document.getElementById(`cfg_label_${idx}`);
        const desc = document.getElementById(`cfg_desc_${idx}`);
        const opts = document.getElementById(`cfg_options_${idx}`);
        if (lbl) f.label = lbl.value;
        if (desc) f.description = desc.value;
        if (opts && (f.type === 'select' || f.type === 'combo')) {
            f.options = opts.value.split(',').map(s => s.trim()).filter(Boolean);
        }
    });
    activeFields = JSON.parse(JSON.stringify(tempFields));
    localStorage.setItem('field_configurations', JSON.stringify(activeFields));

    // บันทึก Base URL สำหรับ QR Code
    const baseUrlInput = document.getElementById('configWebBaseUrl');
    if (baseUrlInput) {
        localStorage.setItem('parcel_qr_base_url', baseUrlInput.value.trim());
    }

    renderForm();
    renderTableHeader();
    renderDataViews();
    if (isFirebaseConfigured) {
        try {
            await setDoc(configDocRef, { fields: tempFields });
            alert('บันทึกการปรับแต่งช่องกรอกข้อมูลเรียบร้อยแล้ว!');
        } catch (err) {
            console.error(err);
            alert('บันทึกในเครื่องแล้ว แต่ไม่สามารถบันทึกลง Firebase ได้');
        }
    } else {
        alert('บันทึกการปรับแต่งช่องกรอกข้อมูลเรียบร้อยแล้ว!');
    }
    configModal.classList.add('hidden');
});
document.getElementById('resetDefaultConfigBtn').addEventListener('click', async () => {
    if (confirm('คุณต้องการคืนค่าช่องกรอกข้อมูลทั้งหมดเป็นค่าเริ่มต้นใช่หรือไม่?')) {
        activeFields = JSON.parse(JSON.stringify(defaultFields));
        localStorage.removeItem('field_configurations');
        renderForm();
        renderTableHeader();
        renderDataViews();
        if (isFirebaseConfigured) {
            try {
                await setDoc(configDocRef, { fields: defaultFields });
                alert('คืนค่าเริ่มต้นเรียบร้อยแล้ว');
            } catch (err) {
                console.error(err);
            }
        } else {
            alert('คืนค่าเริ่มต้นเรียบร้อยแล้ว');
        }
        configModal.classList.add('hidden');
    }
});
// ===== SEARCH & MOBILE VIEW TOGGLES =====
const searchInput = document.getElementById('parcelSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (clearSearchBtn) {
            if (searchQuery.trim()) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
        }
        renderDataViews();
    });
}
if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderDataViews();
    });
}
// Filter Dropdowns Listeners
const filterDivSelect = document.getElementById('filterDivSelect');
const filterTypeSelect = document.getElementById('filterTypeSelect');
const resetFilterBtn = document.getElementById('resetFilterBtn');
if (filterDivSelect) {
    filterDivSelect.addEventListener('change', (e) => {
        selectedFilterDiv = e.target.value;
        renderDataViews();
    });
}
if (filterTypeSelect) {
    filterTypeSelect.addEventListener('change', (e) => {
        selectedFilterType = e.target.value;
        renderDataViews();
    });
}
if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
        selectedFilterDiv = '';
        selectedFilterType = '';
        searchQuery = '';
        if (filterDivSelect) filterDivSelect.value = '';
        if (filterTypeSelect) filterTypeSelect.value = '';
        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
        renderDataViews();
    });
}
// Quick filter helpers (callable from dashboard or table)
window.filterByDiv = (divName) => {
    if (selectedFilterDiv === divName) {
        selectedFilterDiv = ''; // Toggle off
    } else {
        selectedFilterDiv = divName;
    }
    if (filterDivSelect) filterDivSelect.value = selectedFilterDiv;
    renderDataViews();
};
window.filterByType = (typeName) => {
    if (selectedFilterType === typeName) {
        selectedFilterType = ''; // Toggle off
    } else {
        selectedFilterType = typeName;
    }
    if (filterTypeSelect) filterTypeSelect.value = selectedFilterType;
    renderDataViews();
};
const viewModeCardBtn = document.getElementById('viewModeCardBtn');
const viewModeTableBtn = document.getElementById('viewModeTableBtn');
const mobileCardContainer = document.getElementById('mobileCardContainer');
const tableContainerWrap = document.getElementById('tableContainerWrap');
if (viewModeCardBtn && viewModeTableBtn) {
    viewModeCardBtn.addEventListener('click', () => {
        mobileViewMode = 'card';
        viewModeCardBtn.className = 'px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-l-lg border border-blue-300';
        viewModeTableBtn.className = 'px-2.5 py-1 text-xs font-medium text-gray-700 bg-white rounded-r-lg border border-gray-300';
        if (mobileCardContainer) mobileCardContainer.classList.remove('hidden');
        if (tableContainerWrap) {
            tableContainerWrap.classList.add('hidden');
            tableContainerWrap.classList.remove('block');
        }
    });
    viewModeTableBtn.addEventListener('click', () => {
        mobileViewMode = 'table';
        viewModeTableBtn.className = 'px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-r-lg border border-blue-300';
        viewModeCardBtn.className = 'px-2.5 py-1 text-xs font-medium text-gray-700 bg-white rounded-l-lg border border-gray-300';
        if (mobileCardContainer) mobileCardContainer.classList.add('hidden');
        if (tableContainerWrap) {
            tableContainerWrap.classList.remove('hidden');
            tableContainerWrap.classList.add('block');
        }
    });
}
// ===== DASHBOARD TOGGLE =====
const toggleDashboardBtn = document.getElementById('toggleDashboardBtn');
const dashboardSection = document.getElementById('dashboardSection');
function openParcelDashboardSection() {
    const sec = document.getElementById('dashboardSection');
    const btn = document.getElementById('toggleDashboardBtn');
    if (sec) sec.classList.remove('hidden');
    if (btn) {
        btn.innerHTML = '✕ <span>ปิดแดชบอร์ด</span>';
        btn.className = 'flex-1 sm:flex-initial bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow text-xs sm:text-sm hover:bg-gray-700 flex items-center justify-center gap-1 font-semibold transition-all';
    }
    if (typeof renderParcelDashboard === 'function') renderParcelDashboard();
}
function closeParcelDashboardSection() {
    const sec = document.getElementById('dashboardSection');
    const btn = document.getElementById('toggleDashboardBtn');
    if (sec) sec.classList.add('hidden');
    if (btn) {
        btn.innerHTML = '📊 <span>สรุปแดชบอร์ด</span>';
        btn.className = 'flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow text-xs sm:text-sm hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-1 font-semibold transition-all';
    }
}
window.openParcelDashboardSection = openParcelDashboardSection;
window.closeParcelDashboardSection = closeParcelDashboardSection;
if (toggleDashboardBtn && dashboardSection) {
    toggleDashboardBtn.addEventListener('click', () => {
        const isHidden = dashboardSection.classList.contains('hidden');
        if (isHidden) {
            openParcelDashboardSection();
        } else {
            closeParcelDashboardSection();
        }
    });
}
// ===== CLOUD SYNC & PULL LOGIC (LOCAL-FIRST / ON-DEMAND) =====
async function pullFromCloud(showNotice = true) {
    if (!isFirebaseConfigured) return alert('ยังไม่ได้ตั้งค่า Firebase');
    const btn = document.getElementById('pullCloudBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ <span>กำลังดึงข้อมูล...</span>';
    }
    try {
        const snapshot = await getDocs(equipCollection);
        const cloudData = [];
        let batchCount = 0;
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            item.id = docSnap.id;
            cloudData.push(item);
            batchCount++;
            if (batchCount % 300 === 0) {
                const totalEl = document.getElementById('totalItems');
                if (totalEl) totalEl.innerText = `กำลังโหลด... ${batchCount} / ${snapshot.size}`;
            }
        });
        // Merge: keep locally created items that haven't been pushed yet
        const pendingItems = currentData.filter(item => pendingChanges.has(item.id) || item.id.startsWith('local_'));
        const cloudIds = new Set(cloudData.map(c => c.id));
        const mergedData = [...cloudData];
        pendingItems.forEach(p => {
            if (!cloudIds.has(p.id)) {
                mergedData.unshift(p);
            }
        });
        currentData = mergedData;
        localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
        renderDataViews();
        if (showNotice) {
            alert(`✅ ดึงข้อมูลจาก Cloud เรียบร้อยแล้ว! (พบ ${cloudData.length} รายการ)`);
        }
    } catch (err) {
        console.error('Pull from Cloud error:', err);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '📥 <span>ดึงจาก Cloud</span>';
        }
    }
}
async function cancelPendingChanges() {
    if (pendingChanges.size === 0) {
        return alert('ไม่มีข้อมูลที่แก้ไขค้างอยู่');
    }
    if (!confirm('❌ ยืนยันยกเลิกการแก้ไขทั้งหมดที่ยังไม่ได้ส่งขึ้น Cloud?\nข้อมูลจะกลับไปเป็นเหมือนบน Cloud ล่าสุดและส่วนที่แก้ไขในเครื่องจะหายไป')) return;
    pendingChanges.clear();
    savePendingChanges();
    // ลบรายการที่เพิ่งสร้างใหม่ในเครื่องออกจาก currentData
    currentData = currentData.filter(item => !item.id.startsWith('local_'));
    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    setEditMode(false);
    // ดึงข้อมูลจาก Cloud มาทับใหม่
    await pullFromCloud(false);
    alert('✅ ยกเลิกการแก้ไขและคืนค่าข้อมูลจาก Cloud เรียบร้อยแล้ว');
}
function openSyncModal() {
    if (!isFirebaseConfigured) return alert('ยังไม่ได้ตั้งค่า Firebase');
    if (pendingChanges.size === 0) {
        return alert('ℹ️ ข้อมูลในเครื่องตรงกับ Cloud แล้ว ไม่มีรายการใหม่ที่รอส่ง');
    }
    const listContainer = document.getElementById('syncItemList');
    listContainer.innerHTML = '';
    
    const itemsToPush = currentData.filter(item => pendingChanges.has(item.id));
    
    itemsToPush.forEach(item => {
        const isNew = item.id.startsWith('local_');
        const badge = isNew ? '<span class="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded ml-1 font-bold">สร้างใหม่</span>' : '<span class="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded ml-1 font-bold">แก้ไข</span>';
        
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 p-2 bg-white border rounded hover:bg-gray-50";
        div.innerHTML = `
            <input type="checkbox" class="sync-item-cb w-4 h-4 text-emerald-600 rounded" value="${item.id}" checked>
            <div class="flex-1 text-sm">
                <span class="font-semibold text-gray-800">${item.name || '(ไม่มีชื่อ)'}</span>
                <span class="text-gray-500 text-xs ml-2">รหัส: ${item.noid || '-'}</span>
                ${badge}
            </div>
        `;
        listContainer.appendChild(div);
    });
    document.getElementById('syncTotalCount').textContent = itemsToPush.length;
    document.getElementById('selectAllSyncBtn').checked = true;
    document.getElementById('syncModal').classList.remove('hidden');
}
async function confirmPushToCloud() {
    const selectedCbs = Array.from(document.querySelectorAll('.sync-item-cb:checked'));
    if (selectedCbs.length === 0) {
        return alert('กรุณาเลือกอย่างน้อย 1 รายการเพื่อส่งขึ้น Cloud');
    }
    
    const selectedIds = selectedCbs.map(cb => cb.value);
    if (!confirm(`☁️ ยืนยันการส่งข้อมูลที่เลือก (${selectedIds.length} รายการ) ขึ้น Cloud?`)) return;
    const btn = document.getElementById('confirmSyncBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ <span>กำลังส่ง...</span>';
    }
    try {
        const itemsToPush = currentData.filter(item => selectedIds.includes(item.id));
        const chunks = [];
        for (let i = 0; i < itemsToPush.length; i += 400) {
            chunks.push(itemsToPush.slice(i, i + 400));
        }
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const isNewLocal = item.id.startsWith('local_');
                // Remove the old local ID from pendingChanges before upgrading it
                if (isNewLocal) {
                    pendingChanges.delete(item.id);
                }
                const docRef = isNewLocal ? doc(equipCollection) : doc(db, "hospital_equipments", item.id);
                if (isNewLocal) {
                    item.id = docRef.id; // Upgrade local ID to real Firebase ID
                } else {
                    pendingChanges.delete(item.id);
                }
                const { ...dataPayload } = item;
                delete dataPayload.id;
                batch.set(docRef, dataPayload, { merge: true });
            });
            await batch.commit();
        }
        savePendingChanges();
        localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
        renderDataViews();
        document.getElementById('syncModal').classList.add('hidden');
        alert(`✅ ส่งข้อมูลขึ้น Cloud สำเร็จทั้งหมด ${itemsToPush.length} รายการ!`);
    } catch (err) {
        console.error('Push to Cloud error:', err);
        alert('เกิดข้อผิดพลาดในการส่งข้อมูลขึ้น Cloud: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '☁️ ส่งขึ้น Cloud';
        }
        updateSyncBadge();
    }
}
// Checkbox select all logic
document.getElementById('selectAllSyncBtn')?.addEventListener('change', (e) => {
    const cbs = document.querySelectorAll('.sync-item-cb');
    cbs.forEach(cb => cb.checked = e.target.checked);
});
// Close modal logic
document.getElementById('closeSyncModalBtn')?.addEventListener('click', () => document.getElementById('syncModal').classList.add('hidden'));
document.getElementById('closeSyncModalBtn2')?.addEventListener('click', () => document.getElementById('syncModal').classList.add('hidden'));
document.getElementById('confirmSyncBtn')?.addEventListener('click', confirmPushToCloud);
// ฟังก์ชันปรับแก้วันที่ได้รับ (RECEIVE) ให้เป็นรูปแบบ วว/ดด/ปปปป (พ.ศ.) มาตรฐาน
async function cleanAllReceiveDates() {
    if (!currentData || currentData.length === 0) {
        return alert('ไม่มีรายการครุภัณฑ์ในระบบ');
    }

    let targetCount = 0;
    currentData.forEach(item => {
        const raw = String(item.receiveTm || '').trim();
        if (raw) {
            const cleaned = cleanThaiReceiveDate(raw);
            if (cleaned && cleaned !== raw) {
                targetCount++;
            }
        }
    });

    if (targetCount === 0) {
        alert('วันที่ได้รับของครุภัณฑ์ทั้งหมดอยู่ในรูปแบบมาตรฐาน วว/ดด/ปปปป เรียบร้อยแล้ว');
        return;
    }

    if (!confirm(`พบรายการที่วันที่ยังไม่ใช่รูปแบบมาตรฐาน วว/ดด/ปปปป จำนวน ${targetCount} รายการ\n(เช่น 'มีค 51' -> '01/03/2551', 'พ.ศ. 2554' -> '01/01/2554', 'ปี 64' -> '01/01/2564', '2558' -> '01/01/2558')\n\nต้องการปรับปรุงวันที่ในฐานข้อมูลทั้งหมดใช่หรือไม่?`)) {
        return;
    }

    let modifiedCount = 0;
    currentData.forEach(item => {
        const raw = String(item.receiveTm || '').trim();
        if (raw) {
            const cleaned = cleanThaiReceiveDate(raw);
            if (cleaned && cleaned !== raw) {
                item.receiveTm = cleaned;
                markItemPending(item.id);
                modifiedCount++;
            }
        }
    });

    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    renderDataViews();

    alert(`✅ ปรับปรุงวันที่ได้รับเป็น วว/ดด/ปปปป ในฐานข้อมูลเรียบร้อยแล้ว (${modifiedCount} รายการ)`);
    if (isFirebaseConfigured && navigator.onLine) {
        triggerBackgroundAutoSync();
    }
}
window.cleanAllReceiveDates = cleanAllReceiveDates;

// ฟังก์ชันแปลงเครื่องหมาย * ในชื่อครุภัณฑ์ทั้งหมดให้เป็น x
async function replaceAsteriskInNames() {
    if (!currentData || currentData.length === 0) {
        return alert('ไม่มีรายการครุภัณฑ์ในระบบ');
    }

    let targetCount = 0;
    currentData.forEach(item => {
        if (item.name && item.name.includes('*')) {
            targetCount++;
        }
    });

    if (targetCount === 0) {
        alert('ไม่พบชื่อครุภัณฑ์ที่มีเครื่องหมาย * ในระบบ');
        return;
    }

    if (!confirm(`พบรายการที่มีเครื่องหมาย * ในชื่อจำนวน ${targetCount} รายการ\n\nต้องการเปลี่ยนเครื่องหมาย * เป็น "x" ทั้งหมดใช่หรือไม่?`)) {
        return;
    }

    let modifiedCount = 0;
    currentData.forEach(item => {
        if (item.name && item.name.includes('*')) {
            item.name = item.name.replace(/\*/g, 'x');
            markItemPending(item.id);
            modifiedCount++;
        }
    });

    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    renderDataViews();

    alert(`✅ เปลี่ยนเครื่องหมาย * เป็น "x" ในชื่อครุภัณฑ์เรียบร้อยแล้ว (${modifiedCount} รายการ)`);
    if (isFirebaseConfigured && navigator.onLine) {
        triggerBackgroundAutoSync();
    }
}
window.replaceAsteriskInNames = replaceAsteriskInNames;

// ปรับข้อมูล: รายการที่ไม่ใช่ครุภัณฑ์การแพทย์ ให้ตั้งค่า KIND เป็น 'เครื่องมือสนับสนุน'
async function setNonMedicalEquipmentsToSupport() {
    if (!currentData || currentData.length === 0) {
        return alert('ไม่มีรายการครุภัณฑ์ในระบบ');
    }

    let targetCount = 0;
    currentData.forEach(item => {
        const type = String(item.type || '').trim();
        const isNotMedical = !type.includes('การแพทย์') && !type.includes('แพทย์');
        if (isNotMedical && item.kind !== 'เครื่องมือสนับสนุน') {
            targetCount++;
        }
    });

    if (targetCount === 0) {
        alert('ครุภัณฑ์ที่ไม่ใช่การแพทย์ทั้งหมด ถูกกำหนดเป็น "เครื่องมือสนับสนุน" เรียบร้อยแล้ว');
        return;
    }

    if (!confirm(`พบครุภัณฑ์ที่ไม่ใช่การแพทย์ ${targetCount} รายการ\n\nต้องการปรับประเภทเครื่องมือ (KIND) ให้เป็น "เครื่องมือสนับสนุน" ทั้งหมดใช่หรือไม่?`)) {
        return;
    }

    let modifiedCount = 0;
    currentData.forEach(item => {
        const type = String(item.type || '').trim();
        const isNotMedical = !type.includes('การแพทย์') && !type.includes('แพทย์');
        if (isNotMedical && item.kind !== 'เครื่องมือสนับสนุน') {
            item.kind = 'เครื่องมือสนับสนุน';
            markItemPending(item.id);
            modifiedCount++;
        }
    });

    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    renderDataViews();

    alert(`✅ ปรับเปลี่ยนประเภทเครื่องมือเป็น "เครื่องมือสนับสนุน" เรียบร้อยแล้ว (${modifiedCount} รายการ)`);
    if (isFirebaseConfigured && navigator.onLine) {
        triggerBackgroundAutoSync();
    }
}
window.setNonMedicalEquipmentsToSupport = setNonMedicalEquipmentsToSupport;

// ปรับสถานะครุภัณฑ์ทั้งหมดเป็น 'พร้อมใช้งาน'
async function setAllEquipmentsToReady() {
    if (!currentData || currentData.length === 0) {
        return alert('ไม่มีรายการครุภัณฑ์ในระบบ');
    }

    const count = currentData.length;
    if (!confirm(`คุณต้องการปรับสถานะครุภัณฑ์ทั้งหมด (${count} รายการ) ให้เป็น "พร้อมใช้งาน" ใช่หรือไม่?`)) {
        return;
    }

    let modifiedCount = 0;
    currentData.forEach(item => {
        if (item.remark !== 'พร้อมใช้งาน') {
            item.remark = 'พร้อมใช้งาน';
            markItemPending(item.id);
            modifiedCount++;
        }
    });

    localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
    renderDataViews();

    if (modifiedCount === 0) {
        alert('ครุภัณฑ์ทั้งหมดมีสถานะเป็น "พร้อมใช้งาน" อยู่แล้ว');
        return;
    }

    alert(`✅ ปรับสถานะครุภัณฑ์เป็น "พร้อมใช้งาน" เรียบร้อยแล้ว (${modifiedCount} รายการ)\n\nระบบจะบันทึกในเครื่องและ Sync ขึ้น Cloud ให้โดยอัตโนมัติ`);
    if (isFirebaseConfigured && navigator.onLine) {
        triggerBackgroundAutoSync();
    }
}
window.setAllEquipmentsToReady = setAllEquipmentsToReady;

// Bind Sync Buttons
document.getElementById('pullCloudBtn')?.addEventListener('click', () => pullFromCloud(true));
document.getElementById('setAllReadyBtn')?.addEventListener('click', setAllEquipmentsToReady);
document.getElementById('setAllSupportBtn')?.addEventListener('click', setNonMedicalEquipmentsToSupport);
document.getElementById('cleanAsteriskBtn')?.addEventListener('click', replaceAsteriskInNames);
document.getElementById('cleanDatesBtn')?.addEventListener('click', cleanAllReceiveDates);
document.getElementById('syncCloudBtn')?.addEventListener('click', openSyncModal);
document.getElementById('cancelCloudSyncBtn')?.addEventListener('click', cancelPendingChanges);

// =========================================================================
// BACKGROUND AUTO-SYNC (อัตโนมัติเมื่อออนไลน์และมีรายการค้าง)
// =========================================================================
let isAutoSyncing = false;

async function triggerBackgroundAutoSync() {
    if (isAutoSyncing || !isFirebaseConfigured || pendingChanges.size === 0) return;
    if (!navigator.onLine) return;

    isAutoSyncing = true;
    console.log(`🔄 กำลัง Auto-Sync ข้อมูลพัสดุ ${pendingChanges.size} รายการขึ้น Cloud อัตโนมัติ...`);
    
    try {
        const itemsToPush = currentData.filter(item => pendingChanges.has(item.id));
        const chunks = [];
        for (let i = 0; i < itemsToPush.length; i += 400) {
            chunks.push(itemsToPush.slice(i, i + 400));
        }
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const isNewLocal = item.id.startsWith('local_');
                if (isNewLocal) {
                    pendingChanges.delete(item.id);
                }
                const docRef = isNewLocal ? doc(equipCollection) : doc(db, "hospital_equipments", item.id);
                if (isNewLocal) {
                    item.id = docRef.id;
                } else {
                    pendingChanges.delete(item.id);
                }
                const { ...dataPayload } = item;
                delete dataPayload.id;
                batch.set(docRef, dataPayload, { merge: true });
            });
            await batch.commit();
        }
        savePendingChanges();
        localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
        updateSyncBadge();
        console.log(`✅ Auto-Sync พัสดุขึ้น Cloud เรียบร้อย (${itemsToPush.length} รายการ)`);
    } catch (err) {
        console.warn('Auto-Sync warning (จะลองใหม่รอบถัดไป):', err);
    } finally {
        isAutoSyncing = false;
    }
}

// เช็ค Auto-Sync ทุก 30 วินาที และเมื่อเน็ตกลับมาต่อติด (Online Event)
setInterval(triggerBackgroundAutoSync, 30000);
window.addEventListener('online', triggerBackgroundAutoSync);
window.triggerBackgroundAutoSync = triggerBackgroundAutoSync;

// Initial UI Render
renderForm();
renderTableHeader();
renderDataViews();
updateSyncBadge();
document.getElementById('totalItems').innerText = currentData.length;
// If local data is completely empty on first run, schedule pull in background
if (isFirebaseConfigured && currentData.length === 0) {
    setTimeout(() => {
        pullFromCloud(false);
    }, 500);
}
// Initialize Import/Export module
initImportExport({
    getActiveFields: () => activeFields,
    getCurrentData: () => currentData,
    getFilteredData: () => getFilteredAndSortedData(),
    isFirebaseConfigured,
    db,
    doc,
    setDoc,
    writeBatch,
    equipCollection,
    addDoc,
    onImportComplete: (newItems) => {
        newItems.forEach(item => {
            currentData.unshift(item);
            markItemPending(item.id);
        });
        localStorage.setItem('hospital_equipments', JSON.stringify(currentData));
        document.getElementById('totalItems').innerText = currentData.length;
        renderDataViews();
        updateSyncBadge();
    }
});
// ─── Bridge: เปิดใบส่งซ่อมจากทะเบียนพัสดุ ──────────────────────────────────
window.createRepairFromParcelItem = function(itemId) {
    const item = currentData.find(i => i.id === itemId);
    if (!item) {
        alert('ไม่พบข้อมูลครุภัณฑ์');
        return;
    }
    // 1. สลับไปแท็บใบส่งซ่อม
    if (typeof window.switchTab === 'function') {
        window.switchTab('repairs');
    }
    // 2. เปิด modal บันทึกใบส่งซ่อม
    if (typeof window.openModal === 'function') {
        window.openModal();
    }
    // 3. กรอกข้อมูลครุภัณฑ์ลงในฟอร์มส่งซ่อมทันที
    setTimeout(() => {
        const equipCodeEl = document.getElementById('formEquipCode');
        const equipNameEl = document.getElementById('formEquipName');
        const deptEl      = document.getElementById('formDept');
        const catEl       = document.getElementById('formCategory');
        if (equipCodeEl) equipCodeEl.value = item.noid || '';
        if (equipNameEl) equipNameEl.value = item.name || '';
        if (deptEl)      deptEl.value = item.div || '';
        if (catEl && item.type) {
            // แมปประเภทครุภัณฑ์ให้เข้ากับตัวเลือก
            const t = item.type;
            if (t.includes('แพทย์')) catEl.value = 'เครื่องมือแพทย์';
            else if (t.includes('คอมพิวเตอร์')) catEl.value = 'ระบบคอมพิวเตอร์/เครือข่าย';
            else if (t.includes('ไฟฟ้า') || t.includes('โรงงาน')) catEl.value = 'ระบบสาธารณูปโภค';
            else catEl.value = 'ครุภัณฑ์สำนักงานทั่วไป';
        }
        const symptomEl = document.getElementById('formSymptom');
        if (symptomEl) symptomEl.focus();
    }, 150);
};
// Expose equipmentData ให้ระบบใบส่งซ่อมดึงไปใช้
window.getParcelEquipmentData = function() {
    return currentData;
};
// ===== ส่งซ่อมจากหน้าฟอร์มกรอกข้อมูล =====
const repairCurrentBtn = document.getElementById('repairCurrentBtn');
if (repairCurrentBtn) {
    repairCurrentBtn.addEventListener('click', () => {
        // ดึงค่าจากฟอร์มกรอกข้อมูลปัจจุบัน (ไม่ว่าจะอยู่ในโหมดแก้ไข หรือกำลังกรอกใหม่)
        const noidVal = document.getElementById('noid')?.value?.trim() || '';
        const nameVal = document.getElementById('name')?.value?.trim() || '';
        const divVal  = document.getElementById('div')?.value?.trim() || '';
        const typeVal = document.getElementById('type')?.value?.trim() || '';
        if (!nameVal && !noidVal) {
            alert('กรุณากรอกชื่อครุภัณฑ์ หรือรหัสครุภัณฑ์ในฟอร์มก่อนกดส่งซ่อม');
            return;
        }
        // 1. สลับไปแท็บใบส่งซ่อม
        if (typeof window.switchTab === 'function') {
            window.switchTab('repairs');
        }
        // 2. เปิด modal บันทึกใบส่งซ่อม
        if (typeof window.openModal === 'function') {
            window.openModal();
        }
        // 3. นำค่าจากฟอร์มพัสดุไปใส่ในฟอร์มใบส่งซ่อมทันที
        setTimeout(() => {
            const equipCodeEl = document.getElementById('formEquipCode');
            const equipNameEl = document.getElementById('formEquipName');
            const deptEl      = document.getElementById('formDept');
            const catEl       = document.getElementById('formCategory');
            if (equipCodeEl) equipCodeEl.value = noidVal;
            if (equipNameEl) equipNameEl.value = nameVal;
            if (deptEl)      deptEl.value = divVal;
            if (catEl && typeVal) {
                if (typeVal.includes('แพทย์')) catEl.value = 'เครื่องมือแพทย์';
                else if (typeVal.includes('คอมพิวเตอร์')) catEl.value = 'ระบบคอมพิวเตอร์/เครือข่าย';
                else if (typeVal.includes('ไฟฟ้า') || typeVal.includes('โรงงาน')) catEl.value = 'ระบบสาธารณูปโภค';
                else catEl.value = 'ครุภัณฑ์สำนักงานทั่วไป';
            }
            const symptomEl = document.getElementById('formSymptom');
            if (symptomEl) symptomEl.focus();
        }, 150);
    });
}

// ===== EXPORT PARCEL DASHBOARD TO IMAGE (PNG) =====
const exportParcelDashImgBtn = document.getElementById('exportParcelDashImgBtn');
if (exportParcelDashImgBtn) {
    exportParcelDashImgBtn.addEventListener('click', async () => {
        const dashSection = document.getElementById('dashboardSection');
        if (!dashSection || dashSection.classList.contains('hidden')) {
            return alert('กรุณาเปิดแดชบอร์ดก่อนส่งออก');
        }
        if (typeof html2canvas === 'undefined') {
            if (typeof window.ensureExportLibraries === 'function') {
                await window.ensureExportLibraries(['html2canvas']);
            }
            if (typeof html2canvas === 'undefined') {
                return alert('ไม่สามารถโหลดไลบรารี html2canvas ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            }
        }
        const origHtml = exportParcelDashImgBtn.innerHTML;
        exportParcelDashImgBtn.disabled = true;
        exportParcelDashImgBtn.innerHTML = '<span>⏳</span> กำลังบันทึกภาพ...';
        try {
            const toolbar = dashSection.querySelector('.bg-slate-50');
            if (toolbar) toolbar.style.display = 'none';
            const canvas = await html2canvas(dashSection, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            if (toolbar) toolbar.style.display = '';
            const dateStr = new Date().toISOString().slice(0, 10);
            const link = document.createElement('a');
            link.download = `Hospital_Equipments_Dashboard_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Export Dashboard Image Error:', err);
            alert('เกิดข้อผิดพลาดในการบันทึกภาพแดชบอร์ด: ' + err.message);
        } finally {
            exportParcelDashImgBtn.disabled = false;
            exportParcelDashImgBtn.innerHTML = origHtml;
        }
    });
}

// ===== EXPORT PARCEL DASHBOARD TO PRESENTATION (PPTX) =====
const exportParcelDashPptBtn = document.getElementById('exportParcelDashPptBtn');
if (exportParcelDashPptBtn) {
    exportParcelDashPptBtn.addEventListener('click', async () => {
        const dashSection = document.getElementById('dashboardSection');
        if (!dashSection || dashSection.classList.contains('hidden')) {
            return alert('กรุณาเปิดแดชบอร์ดก่อนส่งออก');
        }
        if (typeof PptxGenJS === 'undefined') {
            if (typeof window.ensureExportLibraries === 'function') {
                await window.ensureExportLibraries(['pptx']);
            }
            if (typeof PptxGenJS === 'undefined') {
                return alert('ไม่สามารถโหลดไลบรารี PptxGenJS ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            }
        }
        const origHtml = exportParcelDashPptBtn.innerHTML;
        exportParcelDashPptBtn.disabled = true;
        exportParcelDashPptBtn.innerHTML = '<span>⏳</span> กำลังสร้าง PPTX...';
        try {
            const FONT_TH = 'TH SarabunPSK';
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_16x9';
            pptx.author = 'โรงพยาบาลพยุหะคีรี';
            pptx.company = 'โรงพยาบาลพยุหะคีรี';
            pptx.title = 'รายงานสรุปภาพรวมทะเบียนครุภัณฑ์และค่าเสื่อมราคา';
            const dateStr = new Date().toISOString().slice(0, 10);
            const thaiDateText = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
            const stats = parcelDashboardDataCache || {
                totalCount: currentData.length,
                totalValue: 0,
                totalBookValue: 0,
                totalAccDepr: 0,
                typeCount: 0,
                divCount: 0,
                topTypes: [],
                topDivs: []
            };

            function addSlideHeaderFooter(slide, title, category = 'EQUIPMENT MANAGEMENT') {
                slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.1, fill: { color: '0D9488' }, line: { color: '0D9488' } });
                slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.25, w: 2.6, h: 0.32, fill: { color: 'E0F2FE' }, line: { color: 'BAE6FD', width: 0.5 } });
                slide.addText(category, { x: 0.6, y: 0.25, w: 2.6, h: 0.32, fontSize: 11, bold: true, color: '0369A1', align: 'center', fontFace: FONT_TH });
                slide.addText(title, { x: 0.6, y: 0.55, w: 8.8, h: 0.55, fontSize: 20, bold: true, color: '0F172A', fontFace: FONT_TH });
                slide.addShape(pptx.shapes.RECTANGLE, { x: 0.6, y: 5.25, w: 8.8, h: 0.02, fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' } });
                slide.addText('ระบบทะเบียนครุภัณฑ์และซ่อมบำรุง โรงพยาบาลพยุหะคีรี จ.นครสวรรค์', { x: 0.6, y: 5.28, w: 5.5, h: 0.28, fontSize: 11, color: '94A3B8', fontFace: FONT_TH });
                slide.addText(`ข้อมูล ณ วันที่ ${thaiDateText}`, { x: 6.5, y: 5.28, w: 2.9, h: 0.28, fontSize: 11, color: '94A3B8', align: 'right', fontFace: FONT_TH });
            }

            // SLIDE 1: Cover Slide
            const s1 = pptx.addSlide();
            s1.background = { color: '0F172A' };
            s1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.35, h: 5.625, fill: { color: '0D9488' }, line: { color: '0D9488' } });
            s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 0.7, w: 3.8, h: 0.38, fill: { color: '1E293B' }, line: { color: '38BDF8', width: 0.8 } });
            s1.addText('HOSPITAL ASSET & DEPRECIATION REPORT', { x: 0.8, y: 0.7, w: 3.8, h: 0.38, fontSize: 11, bold: true, color: '38BDF8', align: 'center', fontFace: FONT_TH });
            s1.addText('รายงานภาพรวมทะเบียนครุภัณฑ์\nและการประเมินค่าเสื่อมราคา', { x: 0.8, y: 1.25, w: 8.4, h: 1.5, fontSize: 30, bold: true, color: 'FFFFFF', lineSpacing: 36, fontFace: FONT_TH });
            s1.addText('โรงพยาบาลพยุหะคีรี อำเภอพยุหะคีรี จังหวัดนครสวรรค์', { x: 0.8, y: 2.9, w: 8.4, h: 0.45, fontSize: 16, color: '94A3B8', fontFace: FONT_TH });

            const coverHighlights = [
                { title: 'จำนวนครุภัณฑ์ทั้งหมด', val: `${stats.totalCount.toLocaleString()} รายการ`, sub: 'ในระบบทะเบียนพัสดุ', bg: '1E293B', accent: '38BDF8' },
                { title: 'มูลค่าจัดซื้อรวม', val: `${stats.totalValue.toLocaleString()} บาท`, sub: 'ราคาตั้งต้นจัดซื้อ', bg: '1E293B', accent: 'F59E0B' },
                { title: 'มูลค่าคงเหลือสุทธิ (NBV)', val: `${stats.totalBookValue.toLocaleString()} บาท`, sub: `ค่าเสื่อมสะสม ${stats.totalAccDepr.toLocaleString()} บาท`, bg: '1E293B', accent: '10B981' }
            ];
            coverHighlights.forEach((h, i) => {
                const cardX = 0.8 + (i * 2.85);
                s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: cardX, y: 3.65, w: 2.7, h: 1.35, fill: { color: h.bg }, line: { color: h.accent, width: 1 } });
                s1.addText(h.title, { x: cardX + 0.15, y: 3.75, w: 2.4, h: 0.28, fontSize: 13, bold: true, color: 'E2E8F0', fontFace: FONT_TH });
                s1.addText(h.val, { x: cardX + 0.15, y: 4.05, w: 2.4, h: 0.5, fontSize: 18, bold: true, color: 'FFFFFF', fontFace: FONT_TH });
                s1.addText(h.sub, { x: cardX + 0.15, y: 4.6, w: 2.4, h: 0.28, fontSize: 11, color: '94A3B8', fontFace: FONT_TH });
            });

            // SLIDE 2: KPI & Charts
            const s2 = pptx.addSlide();
            s2.background = { color: 'F8FAFC' };
            addSlideHeaderFooter(s2, 'สรุปตัวเลขหลักและสถานะทางการเงิน (KPI & Financial Overview)');
            const kpiCards = [
                { label: 'ครุภัณฑ์ทั้งหมด', val: `${stats.totalCount.toLocaleString()} ชิ้น`, sub: `${stats.typeCount} ประเภท / ${stats.divCount} หน่วยงาน`, border: '3B82F6' },
                { label: 'มูลค่าจัดซื้อรวม', val: `${stats.totalValue.toLocaleString()} บาท`, sub: 'ราคาตั้งต้นจัดซื้อ', border: '64748B' },
                { label: 'มูลค่าคงเหลือสุทธิ', val: `${stats.totalBookValue.toLocaleString()} บาท`, sub: 'Net Book Value', border: '10B981' },
                { label: 'ค่าเสื่อมราคาสะสม', val: `${stats.totalAccDepr.toLocaleString()} บาท`, sub: 'Accumulated Depreciation', border: 'EF4444' }
            ];
            kpiCards.forEach((kpi, idx) => {
                const posX = 0.6 + (idx * 2.25);
                s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: posX, y: 1.15, w: 2.15, h: 1.25, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 } });
                s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: posX + 0.15, y: 1.15, w: 0.5, h: 0.05, fill: { color: kpi.border }, line: { color: kpi.border } });
                s2.addText(kpi.label, { x: posX + 0.15, y: 1.22, w: 1.85, h: 0.28, fontSize: 12, bold: true, color: '64748B', fontFace: FONT_TH });
                s2.addText(kpi.val, { x: posX + 0.15, y: 1.5, w: 1.85, h: 0.45, fontSize: 16, bold: true, color: '0F172A', fontFace: FONT_TH });
                s2.addText(kpi.sub, { x: posX + 0.15, y: 1.95, w: 1.85, h: 0.3, fontSize: 10, color: '94A3B8', fontFace: FONT_TH });
            });
            s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.55, w: 4.8, h: 2.55, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 } });
            s2.addText('สัดส่วนตามประเภทครุภัณฑ์', { x: 0.75, y: 2.62, w: 4.5, h: 0.32, fontSize: 13, bold: true, color: '334155', fontFace: FONT_TH });
            if (parcelTypeChartInstance) {
                s2.addImage({ data: parcelTypeChartInstance.toBase64Image(), x: 0.75, y: 2.95, w: 4.5, h: 2.05 });
            }
            s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 5.6, y: 2.55, w: 3.8, h: 2.55, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 } });
            s2.addText('มูลค่าคงเหลือสุทธิ vs ค่าเสื่อมสะสม', { x: 5.75, y: 2.62, w: 3.5, h: 0.32, fontSize: 13, bold: true, color: '334155', fontFace: FONT_TH });
            if (parcelDeprChartInstance) {
                s2.addImage({ data: parcelDeprChartInstance.toBase64Image(), x: 5.75, y: 2.95, w: 3.5, h: 2.05 });
            }

            // SLIDE 3: Department Breakdown
            const s3 = pptx.addSlide();
            s3.background = { color: 'F8FAFC' };
            addSlideHeaderFooter(s3, 'การถือครองครุภัณฑ์แยกตามแผนกและกลุ่มงาน (Department Analysis)');
            s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.15, w: 5.2, h: 3.95, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 } });
            s3.addText('10 แผนกที่มีจำนวนครุภัณฑ์มากที่สุด', { x: 0.8, y: 1.22, w: 4.8, h: 0.32, fontSize: 14, bold: true, color: '334155', fontFace: FONT_TH });
            if (parcelDeptChartInstance) {
                s3.addImage({ data: parcelDeptChartInstance.toBase64Image(), x: 0.8, y: 1.6, w: 4.8, h: 3.35 });
            }
            s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 6.0, y: 1.15, w: 3.4, h: 3.95, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.8 } });
            s3.addText('อันดับหน่วยงานหลัก', { x: 6.2, y: 1.22, w: 3.0, h: 0.32, fontSize: 14, bold: true, color: '334155', fontFace: FONT_TH });
            if (stats.topDivs && stats.topDivs.length > 0) {
                stats.topDivs.forEach((d, idx) => {
                    const rowY = 1.62 + (idx * 0.65);
                    s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 6.15, y: rowY, w: 3.1, h: 0.58, fill: { color: idx === 0 ? 'F0FDF4' : 'F8FAFC' }, line: { color: idx === 0 ? '86EFAC' : 'E2E8F0', width: 0.8 } });
                    s3.addText(`${idx + 1}. ${d.name}`, { x: 6.25, y: rowY + 0.04, w: 2.9, h: 0.26, fontSize: 12, bold: true, color: '1E293B', fontFace: FONT_TH });
                    s3.addText(`จำนวน: ${d.count} ชิ้น | มูลค่า: ${d.val.toLocaleString()} บาท`, { x: 6.25, y: rowY + 0.3, w: 2.9, h: 0.24, fontSize: 10, color: '64748B', fontFace: FONT_TH });
                });
            }
            const fileName = `Hospital_Equipments_Dashboard_${dateStr}.pptx`;
            pptx.writeFile({ fileName: fileName });
        } catch (err) {
            console.error('Export Dashboard PPTX Error:', err);
            alert('เกิดข้อผิดพลาดในการสร้างสไลด์นำเสนอ: ' + err.message);
        } finally {
            exportParcelDashPptBtn.disabled = false;
            exportParcelDashPptBtn.innerHTML = origHtml;
        }
    });
}


// Namespace App.parcel registration
window.App = window.App || {};
window.App.parcel = {
    getData: () => currentData,
    editItem: (id) => window.editItem(id),
    deleteItem: (id) => window.deleteItem(id),
    createRepair: (id) => window.createRepairFromParcelItem(id),
    spreadItem: (id) => window.spreadItem(id),
    duplicateItem: (id) => window.duplicateItem(id)
};

// =========================================================================
// DIGITAL EQUIPMENT PASSPORT & PROFILE MODAL LOGIC
// =========================================================================

window.openEquipmentPassportModal = function(itemId) {
    const item = currentData.find(d => d.id === itemId);
    if (!item) return;

    const modal = document.getElementById('equipmentPassportModal');
    if (!modal) return;

    const noid = item.noid || '-';
    const name = item.name || '(ไม่มีชื่อรายการ)';
    const div = item.div || '-';
    const type = item.type || '-';
    const location = item.location || '-';
    const perUnitRaw = item.perUnit !== undefined && item.perUnit !== '' ? Number(String(item.perUnit).replace(/,/g, '')) : 0;
    const moneyType = item.tmoney || item.money || '-';
    const risk = item.risk || '-';
    const receiveTm = item.receiveTm || '-';

    // 1. ตั้งค่า Header
    document.getElementById('passportNoidBadge').innerText = `🆔 ${noid}`;
    document.getElementById('passportEquipName').innerText = name;
    document.getElementById('passportDiv').innerText = div;
    document.getElementById('passportType').innerText = type;
    document.getElementById('passportLocation').innerText = location;

    // การควบคุมสิทธิ์ (Data Privacy): ซ่อนราคาและค่าเสื่อมสำหรับ general_user
    const currentUser = window.currentUserProfile || {};
    const userRole = currentUser.role || 'general_user';
    const canViewFinancials = (userRole === 'admin' || userRole === 'executive' || userRole === 'parcel_staff');

    if (canViewFinancials) {
        document.getElementById('passportPerUnit').innerText = perUnitRaw > 0 ? `${perUnitRaw.toLocaleString()} ฿` : '-';
        document.getElementById('passportMoneyType').innerText = moneyType;
    } else {
        document.getElementById('passportPerUnit').innerHTML = '<span class="text-slate-400 font-mono italic">*** สงวนสิทธิ์ ***</span>';
        document.getElementById('passportMoneyType').innerHTML = '<span class="text-slate-400 font-mono italic">*** สงวนสิทธิ์ ***</span>';
    }

    // Criticality / Risk Badge
    const riskStr = String(risk).trim();
    let riskBadgeHtml = `<span class="text-slate-600">🟢 ทั่วไป (Tier 3)</span>`;
    if (riskStr === '1' || riskStr.includes('วิกฤต') || type.includes('แพทย์')) {
        riskBadgeHtml = `<span class="bg-rose-500/20 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-full font-bold animate-pulse">🔴 วิกฤตช่วยชีวิต (Tier 1)</span>`;
    } else if (riskStr === '2' || riskStr.includes('สูง')) {
        riskBadgeHtml = `<span class="bg-amber-500/20 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold">🟠 สำคัญสูง (Tier 2)</span>`;
    }
    document.getElementById('passportRisk').innerHTML = riskBadgeHtml;

    // 2. คำนวณอายุและค่าเสื่อมราคา
    const depr = calculateDepreciation(item);
    document.getElementById('passportReceivedDate').innerText = `วันที่รับ: ${receiveTm}`;
    
    if (depr && depr.ageYears !== undefined) {
        const years = Math.floor(depr.ageYears);
        const months = Math.round((depr.ageYears - years) * 12);
        document.getElementById('passportAgeYears').innerText = years > 0 ? `${years} ปี ${months} ด.` : `${months} เดือน`;
        
        if (canViewFinancials) {
            if (depr.isFullyDepreciated) {
                document.getElementById('passportDeprStatus').innerHTML = `<span class="text-slate-600">ครบเกณฑ์ (1 ฿)</span>`;
                document.getElementById('passportNetBookValue').innerText = `มูลค่าซาก: 1 บาท (ครบ ${depr.usefulYears} ปี)`;
            } else {
                document.getElementById('passportDeprStatus').innerHTML = `<span class="text-emerald-700">คงเหลือ ${depr.remainPct}%</span>`;
                document.getElementById('passportNetBookValue').innerText = `มูลค่าบัญชี: ${depr.bookValue.toLocaleString()} ฿`;
            }
        } else {
            document.getElementById('passportDeprStatus').innerHTML = '<span class="text-slate-400 italic">*** ข้อมูลการเงินสงวนสิทธิ์ ***</span>';
            document.getElementById('passportNetBookValue').innerText = 'เฉพาะผู้บริหารและการเงิน/พัสดุ';
        }
    } else {
        document.getElementById('passportAgeYears').innerText = '-';
        document.getElementById('passportDeprStatus').innerText = '-';
        document.getElementById('passportNetBookValue').innerText = '-';
    }

    // 3. ค้นหาประวัติการซ่อมในระบบ repairs
    let allRepairs = [];
    if (typeof window.repairs !== 'undefined' && Array.isArray(window.repairs)) {
        allRepairs = window.repairs;
    } else {
        try {
            const rawRepairs = localStorage.getItem('hospital_repairs_data');
            if (rawRepairs) allRepairs = JSON.parse(rawRepairs);
        } catch (_) {}
    }

    // จับคู่งานซ่อมจาก noid หรือ code หรือชื่อ
    const matchedRepairs = allRepairs.filter(r => {
        const rCode = (r.equipCode || '').trim().toLowerCase();
        const rName = (r.equipName || '').trim().toLowerCase();
        const rNoid = (item.noid || '').trim().toLowerCase();
        const rCodeItem = (item.code || '').trim().toLowerCase();
        const targetName = name.toLowerCase();

        if (rNoid && rCode && (rCode === rNoid || rCode.includes(rNoid) || rNoid.includes(rCode))) return true;
        if (rCodeItem && rCode && (rCode === rCodeItem || rCode.includes(rCodeItem))) return true;
        if (rName && targetName && (rName === targetName || targetName.includes(rName))) return true;
        return false;
    });

    const repairCount = matchedRepairs.length;
    const totalRepairCost = matchedRepairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

    document.getElementById('passportRepairCount').innerText = `${repairCount} ครั้ง`;
    document.getElementById('passportTotalRepairCost').innerText = `ค่าซ่อมสะสม: ${totalRepairCost.toLocaleString()} ฿`;
    document.getElementById('passportHistoryCountBadge').innerText = `พบ ${repairCount} รายการ`;

    // 4. ประเมินจุดคุ้มทุน / สภาพเครื่อง
    const costRatio = perUnitRaw > 0 ? (totalRepairCost / perUnitRaw) : 0;
    const costRatioPct = Math.round(costRatio * 100);
    document.getElementById('passportCostRatioSub').innerText = perUnitRaw > 0 ? `สัดส่วนค่าซ่อม: ${costRatioPct}% ของราคาซื้อ` : `ค่าซ่อมสะสม: ${totalRepairCost.toLocaleString()} ฿`;

    const healthEl = document.getElementById('passportHealthBadge');
    const evalEl = document.getElementById('passportCostBenefitEval');

    if (costRatio >= 0.7 || repairCount >= 5) {
        healthEl.className = 'bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[11px] font-bold px-2 py-0.5 rounded-full';
        healthEl.innerText = '🔴 ควรแทงจำหน่าย';
        evalEl.innerHTML = `<span class="text-rose-600 font-bold">⛔ ซ่อมไม่คุ้มทุน</span>`;
    } else if (costRatio >= 0.4 || repairCount >= 3) {
        healthEl.className = 'bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold px-2 py-0.5 rounded-full';
        healthEl.innerText = '🟡 เริ่มชำรุดบ่อย';
        evalEl.innerHTML = `<span class="text-amber-700 font-bold">⚠️ เฝ้าระวังงบซ่อม</span>`;
    } else if (repairCount > 0) {
        healthEl.className = 'bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold px-2 py-0.5 rounded-full';
        healthEl.innerText = '🔵 เคยผ่านการซ่อม';
        evalEl.innerHTML = `<span class="text-teal-700 font-bold">🟢 คุ้มค่าพร้อมใช้</span>`;
    } else {
        healthEl.className = 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2 py-0.5 rounded-full';
        healthEl.innerText = '🟢 สภาพสมบูรณ์';
        evalEl.innerHTML = `<span class="text-emerald-700 font-bold">✨ ยังไม่เคยซ่อม</span>`;
    }

    // 5. เรนเดอร์ไทม์ไลน์ประวัติการซ่อม
    const timelineEl = document.getElementById('passportRepairTimeline');
    if (timelineEl) {
        if (matchedRepairs.length === 0) {
            timelineEl.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                    ✨ ครุภัณฑ์รายการนี้ยังไม่เคยมีประวัติการส่งซ่อมในระบบ
                </div>
            `;
        } else {
            let tHtml = '';
            // เรียงลำดับจากใหม่ไปเก่า
            matchedRepairs.slice(0, 10).forEach(r => {
                let statusCls = 'bg-slate-100 text-slate-700';
                if (r.status === 'เสร็จสิ้น') statusCls = 'bg-emerald-100 text-emerald-800';
                else if (r.status === 'กำลังดำเนินการ') statusCls = 'bg-blue-100 text-blue-800';
                else if (r.status === 'รออะไหล่/ช่างภายนอก') statusCls = 'bg-amber-100 text-amber-800';
                else if (r.status === 'จำหน่ายออก') statusCls = 'bg-rose-100 text-rose-800';

                tHtml += `
                    <div class="flex items-start gap-3 p-3 bg-slate-50 hover:bg-teal-50/40 rounded-xl border border-slate-200/80 transition-colors text-xs">
                        <div class="mt-0.5 text-base">🛠️</div>
                        <div class="flex-1 space-y-1">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold font-mono text-teal-800">${r.repairNo || 'ใบซ่อม'}</span>
                                    <span class="text-slate-400 text-[11px]">📅 ${r.date || '-'}</span>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}">${r.status}</span>
                            </div>
                            <div class="text-slate-700 font-medium">${r.symptom || 'ไม่ระบุอาการ'}</div>
                            <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                                <span>👷 ช่าง: ${r.assignee || 'ยังไม่ระบุ'}</span>
                                <span class="font-bold text-slate-700">ค่าใช้จ่าย: ${Number(r.cost || 0).toLocaleString()} ฿</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            timelineEl.innerHTML = tHtml;
        }
    }

    // 6. ปุ่มดำเนินการใน Footer
    const createBtn = document.getElementById('passportCreateRepairBtn');
    if (createBtn) {
        createBtn.onclick = () => {
            closeEquipmentPassportModal();
            window.createRepairFromParcelItem(item.id);
        };
    }

    const printQrBtn = document.getElementById('passportPrintQrBtn');
    if (printQrBtn) {
        printQrBtn.onclick = () => {
            window.openPrintQrStickerModal(item);
        };
    }

    const editBtn = document.getElementById('passportEditBtn');
    if (editBtn) {
        editBtn.onclick = () => {
            closeEquipmentPassportModal();
            window.editItem(item.id);
        };
    }

    modal.classList.remove('hidden');
};

window.closeEquipmentPassportModal = function() {
    document.getElementById('equipmentPassportModal')?.classList.add('hidden');
};

// =========================================================================
// QR CODE STICKER GENERATOR & PRINTING
// =========================================================================
let currentStickerItem = null;

window.openPrintQrStickerModal = function(item) {
    if (!item) return;
    currentStickerItem = item;
    const modal = document.getElementById('printQrStickerModal');
    if (!modal) return;

    const noid = item.noid || '-';
    const name = item.name || '(ไม่มีชื่อรายการ)';
    const div = item.div || '-';
    const risk = item.risk || '3';

    document.getElementById('stickerEquipName').innerText = name;
    document.getElementById('stickerNoid').innerText = `🆔 ${noid}`;
    document.getElementById('stickerDept').innerText = `แผนก: ${div}`;

    // Risk badge
    const badgeEl = document.getElementById('stickerRiskBadge');
    if (badgeEl) {
        const riskStr = String(risk).trim();
        if (riskStr === '1' || riskStr.includes('วิกฤต') || (item.type && item.type.includes('แพทย์'))) {
            badgeEl.className = 'text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200';
            badgeEl.innerText = '🔴 วิกฤต Tier 1';
        } else if (riskStr === '2' || riskStr.includes('สูง')) {
            badgeEl.className = 'text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200';
            badgeEl.innerText = '🟠 สำคัญ Tier 2';
        } else {
            badgeEl.className = 'text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200';
            badgeEl.innerText = '🟢 ทั่วไป Tier 3';
        }
    }

    // สร้าง Deep Link URL สำหรับสแกนผ่าน LINE / กล้องมือถือ
    const baseUrl = (typeof window.getParcelBaseUrl === 'function') ? window.getParcelBaseUrl() : window.location.origin;
    const encodedNoid = encodeURIComponent(noid);
    const deepLinkUrl = `${baseUrl}?scan_noid=${encodedNoid}&action=fast_repair`;

    // Render QR Code ลงในกล่อง
    const qrContainer = document.getElementById('stickerQrCodeBox');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: deepLinkUrl,
                width: 90,
                height: 90,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } else {
            qrContainer.innerHTML = `<span class="text-[10px] text-slate-400">QR Code Error</span>`;
        }
    }

    modal.classList.remove('hidden');
};

window.closePrintQrStickerModal = function() {
    document.getElementById('printQrStickerModal')?.classList.add('hidden');
};

window.printSingleSticker = function() {
    const stickerEl = document.getElementById('singleStickerContainer');
    if (!stickerEl) return;

    // สร้างหน้าต่างพิมพ์เฉพาะสติกเกอร์
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (!printWindow) {
        return alert('กรุณาอนุญาตป๊อปอัป (Pop-up) เพื่อพิมพ์สติกเกอร์');
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>พิมพ์สติกเกอร์ QR Code</title>
            <style>
                @page { size: auto; margin: 5mm; }
                body { font-family: 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 10px; display: flex; justify-content: center; align-items: center; }
                .sticker-box {
                    width: 72mm;
                    border: 2px solid #0f172a;
                    border-radius: 8px;
                    padding: 8px 10px;
                    box-sizing: border-box;
                    background: #fff;
                }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; }
                .h-title { font-size: 11px; font-weight: bold; color: #0f172a; }
                .badge { font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 4px; background: #f1f5f9; }
                .content { display: flex; gap: 8px; align-items: center; }
                .qr-box { width: 85px; height: 85px; flex-shrink: 0; }
                .qr-box img { width: 100%; height: 100%; display: block; }
                .meta { flex: 1; font-size: 10px; line-height: 1.35; color: #1e293b; }
                .name { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
                .noid { font-family: monospace; font-weight: bold; color: #0d9488; }
                .dept { color: #64748b; font-size: 9px; margin-top: 2px; }
                .scan-hint { font-size: 8.5px; font-weight: bold; color: #4338ca; margin-top: 3px; }
            </style>
        </head>
        <body>
            <div class="sticker-box">
                ${stickerEl.innerHTML}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

// =========================================================================
// BATCH QR STICKER PRINTING (A4 SHEET)
// =========================================================================
let batchSelectedIds = new Set();

window.openBatchQrStickerModal = function() {
    const modal = document.getElementById('batchQrStickerModal');
    if (!modal) return;

    // เติมรายชื่อแผนกในตัวกรอง
    const deptSelect = document.getElementById('batchStickerDeptSelect');
    if (deptSelect) {
        const divs = Array.from(new Set(currentData.map(i => (i.div || '').trim()).filter(Boolean))).sort();
        deptSelect.innerHTML = `<option value="">🏢 ทุกกลุ่มงาน / ทุกแผนก (${currentData.length} รายการ)</option>` +
            divs.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    // เลือกรายการเริ่มต้นทั้งหมดตามการกรองปัจจุบัน
    batchSelectedIds = new Set(currentData.map(i => i.id));
    renderBatchStickerList();

    modal.classList.remove('hidden');
};

window.closeBatchQrStickerModal = function() {
    document.getElementById('batchQrStickerModal')?.classList.add('hidden');
};

window.renderBatchStickerList = function() {
    const container = document.getElementById('batchStickerItemsContainer');
    if (!container) return;

    const deptVal = (document.getElementById('batchStickerDeptSelect')?.value || '').trim().toLowerCase();
    const query = (document.getElementById('batchStickerSearchInput')?.value || '').trim().toLowerCase();

    const filtered = currentData.filter(item => {
        const d = (item.div || '').toLowerCase();
        const n = (item.name || '').toLowerCase();
        const noid = (item.noid || '').toLowerCase();
        if (deptVal && d !== deptVal) return false;
        if (query && !n.includes(query) && !noid.includes(query)) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400 text-xs">
                ไม่พบรายการครุภัณฑ์ที่ตรงกับเงื่อนไข
            </div>
        `;
        updateBatchCountSummary();
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isChecked = batchSelectedIds.has(item.id);
        const noid = item.noid || '-';
        const name = item.name || '(ไม่มีชื่อรายการ)';
        const div = item.div || '-';
        const risk = item.risk || '3';
        
        let riskBadge = '<span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">ทั่วไป</span>';
        if (risk === '1' || String(risk).includes('วิกฤต') || (item.type && item.type.includes('แพทย์'))) {
            riskBadge = '<span class="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded">🔴 Tier 1</span>';
        } else if (risk === '2' || String(risk).includes('สูง')) {
            riskBadge = '<span class="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">🟠 Tier 2</span>';
        }

        return `
            <label class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:bg-purple-50/50 transition cursor-pointer ${isChecked ? 'bg-purple-50/80 border-purple-300' : 'bg-white'}">
                <input type="checkbox" onchange="toggleBatchItemCheck('${item.id}', this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-purple-600 rounded">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-800 text-xs truncate">${name}</span>
                        ${riskBadge}
                    </div>
                    <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span class="font-mono font-bold text-teal-800">🆔 ${noid}</span>
                        <span>•</span>
                        <span>🏢 ${div}</span>
                    </div>
                </div>
            </label>
        `;
    }).join('');

    updateBatchCountSummary();
};

window.toggleBatchItemCheck = function(id, isChecked) {
    if (isChecked) batchSelectedIds.add(id);
    else batchSelectedIds.delete(id);
    updateBatchCountSummary();
};

window.selectAllBatchStickers = function(selectAll) {
    const deptVal = (document.getElementById('batchStickerDeptSelect')?.value || '').trim().toLowerCase();
    const query = (document.getElementById('batchStickerSearchInput')?.value || '').trim().toLowerCase();

    const filtered = currentData.filter(item => {
        const d = (item.div || '').toLowerCase();
        const n = (item.name || '').toLowerCase();
        const noid = (item.noid || '').toLowerCase();
        if (deptVal && d !== deptVal) return false;
        if (query && !n.includes(query) && !noid.includes(query)) return false;
        return true;
    });

    if (selectAll) {
        filtered.forEach(i => batchSelectedIds.add(i.id));
    } else {
        filtered.forEach(i => batchSelectedIds.delete(i.id));
    }
    renderBatchStickerList();
};

function updateBatchCountSummary() {
    const countEl = document.getElementById('batchSelectedCount');
    const pagesEl = document.getElementById('batchEstimatedPages');
    const layout = document.getElementById('batchStickerLayoutSelect')?.value || '2x6';
    const perPage = (layout === '3x8') ? 24 : 12;

    const count = batchSelectedIds.size;
    if (countEl) countEl.innerText = count.toLocaleString();
    if (pagesEl) pagesEl.innerText = Math.ceil(count / perPage).toLocaleString();
}

window.executeBatchQrPrint = async function() {
    const selectedItems = currentData.filter(i => batchSelectedIds.has(i.id));
    if (selectedItems.length === 0) {
        return alert('กรุณาเลือกรายการครุภัณฑ์อย่างน้อย 1 รายการเพื่อพิมพ์สติกเกอร์');
    }

    const layout = document.getElementById('batchStickerLayoutSelect')?.value || '2x6';
    const is3x8 = (layout === '3x8');
    const baseUrl = (typeof window.getParcelBaseUrl === 'function') ? window.getParcelBaseUrl() : window.location.origin;

    const btn = document.getElementById('batchPrintBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ กำลังสร้างหน้าพิมพ์...';
    }

    // สร้าง QR Code เป็น Data URI แบบชั่วคราว
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>🖨️</span> <span>เปิดหน้าต่างพิมพ์ชุด A4</span>'; }
        return alert('กรุณาอนุญาตป๊อปอัป (Pop-up) เพื่อพิมพ์สติกเกอร์');
    }

    // สร้าง HTML สติกเกอร์แต่ละชิ้น
    let stickersHtml = '';
    selectedItems.forEach((item, idx) => {
        const noid = item.noid || '-';
        const name = item.name || '(ไม่มีชื่อรายการ)';
        const div = item.div || '-';
        const risk = item.risk || '3';
        const encodedNoid = encodeURIComponent(noid);
        const deepLinkUrl = `${baseUrl}?scan_noid=${encodedNoid}&action=fast_repair`;

        // สร้าง QR code ผ่าน Google Chart API หรือ QRCode.js image
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(deepLinkUrl)}`;

        let riskBadge = '🟢 ทั่วไป';
        if (risk === '1' || String(risk).includes('วิกฤต') || (item.type && item.type.includes('แพทย์'))) {
            riskBadge = '🔴 Tier 1';
        } else if (risk === '2' || String(risk).includes('สูง')) {
            riskBadge = '🟠 Tier 2';
        }

        stickersHtml += `
            <div class="sticker-card">
                <div class="card-header">
                    <span class="hospital-name">🏥 รพ.พยุหะคีรี</span>
                    <span class="risk-pill">${riskBadge}</span>
                </div>
                <div class="card-body">
                    <div class="qr-col">
                        <img src="${qrImgUrl}" alt="QR" class="qr-img" />
                    </div>
                    <div class="info-col">
                        <div class="equip-name">${name}</div>
                        <div class="equip-noid">${noid}</div>
                        <div class="equip-dept">${div}</div>
                        <div class="scan-tag">📲 สแกนส่งซ่อม</div>
                    </div>
                </div>
            </div>
        `;
    });

    const docContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>พิมพ์สติกเกอร์ QR Code (${selectedItems.length} รายการ)</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 8mm 6mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    color: #0f172a;
                }
                .sheet-grid {
                    display: grid;
                    grid-template-columns: ${is3x8 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'};
                    gap: 3.5mm 3mm;
                    page-break-after: always;
                }
                .sticker-card {
                    border: 1.5px solid #1e293b;
                    border-radius: 6px;
                    padding: 5px 6px;
                    background: #fff;
                    height: ${is3x8 ? '33mm' : '44mm'};
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    overflow: hidden;
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 2px;
                    margin-bottom: 3px;
                }
                .hospital-name {
                    font-size: 8.5pt;
                    font-weight: bold;
                    color: #0f172a;
                }
                .risk-pill {
                    font-size: 7pt;
                    font-weight: bold;
                    padding: 1px 4px;
                    border-radius: 3px;
                    background: #f1f5f9;
                }
                .card-body {
                    display: flex;
                    gap: 5px;
                    align-items: center;
                    flex: 1;
                }
                .qr-col {
                    width: ${is3x8 ? '23mm' : '30mm'};
                    height: ${is3x8 ? '23mm' : '30mm'};
                    flex-shrink: 0;
                }
                .qr-img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: contain;
                }
                .info-col {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    line-height: 1.25;
                }
                .equip-name {
                    font-size: ${is3x8 ? '7.5pt' : '9pt'};
                    font-weight: bold;
                    color: #0f172a;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .equip-noid {
                    font-family: monospace;
                    font-size: ${is3x8 ? '7.5pt' : '8.5pt'};
                    font-weight: bold;
                    color: #0d9488;
                    margin: 1px 0;
                    word-break: break-all;
                }
                .equip-dept {
                    font-size: ${is3x8 ? '6.5pt' : '7.5pt'};
                    color: #475569;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .scan-tag {
                    font-size: ${is3x8 ? '6pt' : '7pt'};
                    color: #4338ca;
                    font-weight: bold;
                    margin-top: 1px;
                }
                .no-print-bar {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 10px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 13px;
                }
                .print-btn {
                    background: #7c3aed;
                    color: #fff;
                    border: none;
                    padding: 8px 18px;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                    font-family: inherit;
                }
                @media print {
                    .no-print-bar { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="no-print-bar">
                <div>
                    <strong>🏷️ พร้อมพิมพ์สติกเกอร์ QR Code:</strong> รวม ${selectedItems.length} รายการ (กระดาษ A4)
                </div>
                <button class="print-btn" onclick="window.print()">🖨️ กดพิมพ์หน้านี้ (Print)</button>
            </div>
            <div class="sheet-grid">
                ${stickersHtml}
            </div>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(docContent);
    printWindow.document.close();

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🖨️</span> <span>เปิดหน้าต่างพิมพ์ชุด A4</span>';
    }
};

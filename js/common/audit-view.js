/**
 * js/common/audit-view.js
 * หน้าต่างแสดงประวัติการตรวจสอบย้อนหลัง (Audit Log Viewer UI)
 */

window.openAuditModal = async function() {
  const modal = document.getElementById('auditModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  await renderAuditLogList();
};

window.closeAuditModal = function() {
  const modal = document.getElementById('auditModal');
  if (modal) modal.classList.add('hidden');
};

window.renderAuditLogList = async function() {
  const listEl = document.getElementById('auditLogList');
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="py-8 text-center text-slate-400">
      <span class="inline-block animate-spin text-2xl mb-2">⏳</span>
      <p class="text-xs">กำลังโหลดประวัติการแก้ไขล่าสุดจาก Cloud...</p>
    </div>
  `;

  let logs = [];
  if (window.App && window.App.audit && typeof window.App.audit.fetchLogs === 'function') {
    logs = await window.App.audit.fetchLogs(60);
  } else if (typeof window.fetchAuditLogs === 'function') {
    logs = await window.fetchAuditLogs(60);
  }

  if (!logs || logs.length === 0) {
    listEl.innerHTML = `
      <div class="py-8 text-center text-slate-400">
        <span class="text-2xl mb-2 inline-block">📋</span>
        <p class="text-xs">ยังไม่มีบันทึกประวัติการแก้ไขในระบบ</p>
      </div>
    `;
    return;
  }

  const actionBadges = {
    CREATE: { text: 'เพิ่มข้อมูลใหม่', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    UPDATE: { text: 'แก้ไขข้อมูล', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
    DELETE: { text: 'ลบข้อมูล', bg: 'bg-rose-100 text-rose-800 border-rose-300' }
  };

  const moduleNames = {
    repair: '🛠️ ใบส่งซ่อม',
    parcel: '📦 ครุภัณฑ์/พัสดุ',
    staff: '👷 บุคลากร'
  };

  let html = '';
  logs.forEach(log => {
    const badge = actionBadges[log.action] || { text: log.action, bg: 'bg-slate-100 text-slate-700 border-slate-300' };
    const mod = moduleNames[log.module] || log.module;
    const dateFormatted = log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : '-';
    
    let detailsHtml = '';
    if (log.details && typeof log.details === 'object') {
      const parts = [];
      if (log.details.name) parts.push(`<b>ชื่อ:</b> ${log.details.name}`);
      if (log.details.equipName) parts.push(`<b>รายการ:</b> ${log.details.equipName}`);
      if (log.details.noid) parts.push(`<b>Noid:</b> ${log.details.noid}`);
      if (log.details.div) parts.push(`<b>แผนก:</b> ${log.details.div}`);
      if (log.details.status) parts.push(`<b>สถานะ:</b> <span class="text-teal-700 font-semibold">${log.details.status}</span>`);
      if (log.details.cost !== undefined) parts.push(`<b>ค่าใช้จ่าย:</b> ฿${Number(log.details.cost).toLocaleString()}`);
      if (log.details.previousStatus) parts.push(`<b>(เดิม: ${log.details.previousStatus})</b>`);
      detailsHtml = parts.join(' • ');
    }

    html += `
      <div class="p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition text-xs">
        <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}">${badge.text}</span>
            <span class="font-semibold text-slate-700">${mod}</span>
            <span class="text-slate-500 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">ID: ${log.targetId}</span>
          </div>
          <span class="text-slate-400 text-[11px]">${dateFormatted}</span>
        </div>
        ${detailsHtml ? `<div class="text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">${detailsHtml}</div>` : ''}
        <div class="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
          <span>ผู้ดำเนินการ: <b class="text-slate-700">${log.performedBy || 'เจ้าหน้าที่'}</b> (${log.role || 'staff'})</span>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
};

// อัปเดตชื่อผู้ใช้จาก Dropdown/ปุ่ม
window.setAuditUserPrompt = function() {
  const current = (window.App && window.App.currentUser) ? window.App.currentUser.name : '';
  const name = prompt('กรุณากรอกชื่อ-สกุลของคุณ เพื่อใช้ระบุในประวัติ Audit Log:', current);
  if (name && name.trim()) {
    if (window.App && window.App.setCurrentUser) {
      window.App.setCurrentUser(name.trim());
    }
    const badge = document.getElementById('currentUserDisplay');
    if (badge) badge.textContent = name.trim();
    alert(`✅ บันทึกชื่อผู้ใช้งาน "${name.trim()}" เรียบร้อยแล้ว`);
  }
};

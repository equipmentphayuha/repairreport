/**
 * js/common/auth-guard.js
 * จัดการ Gatekeeper และ Role-Based Access Control UI
 */

window.currentUserProfile = null;

// ซ่อน UI ระบบตั้งแต่เริ่มต้นจนกว่าจะผ่านการยืนยันตัวตน
document.addEventListener("DOMContentLoaded", () => {
  setupAuthUI();
});

function setupAuthUI() {
  const loginModal = document.getElementById("authGatekeeperModal");
  if (!loginModal) return;

  // ตรวจสอบ Auth State
  if (typeof window.onAuthStateChangedHandler === "function") {
    window.onAuthStateChangedHandler((user, profile) => {
      if (user && profile && profile.status === "active") {
        window.currentUserProfile = profile;
        if (window.App && window.App.setCurrentUser) {
          window.App.setCurrentUser(profile.name, profile.role);
        }
        hideGatekeeper();
        applyRolePermissions(profile);
        updateUserHeaderBadge(profile);
        if (typeof window.triggerFirebaseSyncIfAuthorized === "function") {
          window.triggerFirebaseSyncIfAuthorized();
        }

        // รีเฟรชการแสดงผลทะเบียนพัสดุให้กรองตามสิทธิ์ของผู้ใช้ที่เพิ่งเข้าสู่ระบบ
        if (typeof window.renderParcelViews === "function") {
          window.renderParcelViews();
        }

        // หากเป็นผู้ใช้ทั่วไป (general_user) ให้นำทางไปที่แท็บใบส่งซ่อมทันที
        if (profile.role === "general_user") {
          if (typeof window.switchTab === "function") {
            window.switchTab("repairs");
          }
        }
      } else {
        window.currentUserProfile = null;
        showGatekeeper();
      }
    });
  }
}

async function checkInitialAdminSetup() {
  if (typeof window.checkHasAdminUser !== "function") return;
  try {
    const hasAdmin = await window.checkHasAdminUser();
    const banner = document.getElementById("firstAdminSetupBanner");
    if (!hasAdmin && banner) {
      banner.classList.remove("hidden");
    } else if (banner) {
      banner.classList.add("hidden");
    }
  } catch (e) {
    console.warn("checkInitialAdminSetup:", e);
  }
}

function showGatekeeper() {
  const modal = document.getElementById("authGatekeeperModal");
  const appRoot = document.getElementById("appRootContainer");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
  if (appRoot) {
    appRoot.style.display = "none";
  }
}

function hideGatekeeper() {
  const modal = document.getElementById("authGatekeeperModal");
  const appRoot = document.getElementById("appRootContainer");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  if (appRoot) {
    appRoot.style.display = "block";
  }
}

function updateUserHeaderBadge(profile) {
  const container = document.getElementById("userProfileHeaderBadge");
  if (!container) return;

  let roleBadge = "bg-slate-100 text-slate-700";
  let roleTitle = "ผู้ใช้ทั่วไป";
  if (profile.role === "admin") {
    roleBadge = "bg-rose-100 text-rose-800 border-rose-300";
    roleTitle = "ผู้ดูแลระบบ (Admin)";
  } else if (profile.role === "executive") {
    roleBadge = "bg-purple-100 text-purple-800 border-purple-300";
    roleTitle = "ผู้บริหาร (Executive)";
  } else if (profile.role === "technician") {
    roleBadge = "bg-blue-100 text-blue-800 border-blue-300";
    roleTitle = "ช่างซ่อมบำรุง";
  } else if (profile.role === "parcel_staff") {
    roleBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
    roleTitle = "เจ้าหน้าที่พัสดุ";
  }

  container.innerHTML = `
    <div class="flex items-center gap-2 text-xs">
      <div class="text-right hidden sm:block">
        <div class="font-bold text-white leading-tight">${profile.name}</div>
        <div class="text-[10px] text-teal-200">${profile.department || "โรงพยาบาลพยุหะคีรี"}</div>
      </div>
      <span class="px-2 py-0.5 rounded-full border text-[11px] font-semibold ${roleBadge}">${roleTitle}</span>
      <button onclick="handleLogout()" title="ออกจากระบบ" class="bg-teal-800 hover:bg-rose-600 text-white p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1">
        <span>🚪</span> <span class="hidden md:inline">ออก</span>
      </button>
    </div>
  `;
}

function applyRolePermissions(profile) {
  const role = profile.role || "general_user";
  const isAdmin = role === "admin";
  const isExecutive = role === "executive";
  const canViewStats = isAdmin || isExecutive;

  // เมนูกราฟสถิติ (แสดงเฉพาะ Admin และ Executive)
  const chartsWrapper = document.getElementById("chartsMenuWrapper");
  if (chartsWrapper) {
    chartsWrapper.style.display = canViewStats ? "block" : "none";
  }

  // Admin dropdown wrapper (เมนูจัดการ)
  const adminMenuWrapper = document.getElementById("adminMenuWrapper");
  if (adminMenuWrapper) {
    adminMenuWrapper.style.display = isAdmin ? "block" : "none";
  }

  // ปุ่มลบข้อมูล (Delete buttons) - ซ่อนหากไม่ใช่ Admin
  document.querySelectorAll(".btn-admin-only").forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });

  // ปุ่ม Import / Export - ซ่อนสำหรับผู้ใช้ทั่วไป (เปิดให้เฉพาะ Admin, Executive, Technician, Parcel Staff)
  const canImportExport = role === "admin" || role === "executive" || role === "parcel_staff" || role === "technician";
  document.querySelectorAll(".btn-import-export").forEach((el) => {
    el.style.display = canImportExport ? "" : "none";
  });

  // ปุ่มแก้สถานะหรือปิดงานซ่อม
  const isTechOrAdmin = role === "technician" || role === "admin" || role === "parcel_staff";
  document.querySelectorAll(".tech-only-control").forEach((el) => {
    if (!isTechOrAdmin) {
      el.disabled = true;
      el.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      el.disabled = false;
      el.classList.remove("opacity-50", "cursor-not-allowed");
    }
  });
}

// ฟังก์ชันสลับแท็บ เข้าสู่ระบบ / ลงทะเบียน
window.switchAuthTab = function (tab) {
  const loginForm = document.getElementById("loginFormContainer");
  const registerForm = document.getElementById("registerFormContainer");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabRegisterBtn = document.getElementById("tabRegisterBtn");
  const authMsg = document.getElementById("authErrorMessage");
  if (authMsg) authMsg.classList.add("hidden");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLoginBtn.className = "flex-1 py-2 text-center text-xs font-bold border-b-2 border-teal-600 text-teal-700";
    tabRegisterBtn.className = "flex-1 py-2 text-center text-xs font-medium text-slate-500 hover:text-slate-800";
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabRegisterBtn.className = "flex-1 py-2 text-center text-xs font-bold border-b-2 border-teal-600 text-teal-700";
    tabLoginBtn.className = "flex-1 py-2 text-center text-xs font-medium text-slate-500 hover:text-slate-800";
  }
};

// จัดการ Submit เข้าสู่ระบบ
window.handleLoginSubmit = async function (e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;
  const btn = document.getElementById("loginSubmitBtn");
  const errBox = document.getElementById("authErrorMessage");

  try {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ กำลังเข้าสู่ระบบ...</span>`;
    errBox.classList.add("hidden");

    if (typeof window.loginUser === "function") {
      await window.loginUser(email, pass);
    } else {
      throw new Error("ฟังก์ชันเข้าสู่ระบบยังไม่พร้อม");
    }
  } catch (err) {
    console.error("Login Error:", err);
    let msg = err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
      msg = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    } else if (err.code === "auth/operation-not-allowed") {
      msg = "ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Console";
    }
    errBox.innerText = msg;
    errBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🔐 เข้าสู่ระบบ</span>`;
  }
};

// จัดการ Submit ลงทะเบียน
window.handleRegisterSubmit = async function (e) {
  e.preventDefault();
  const name = document.getElementById("regName").value;
  const dept = document.getElementById("regDept").value;
  const role = document.getElementById("regRole").value;
  const email = document.getElementById("regEmail").value;
  const pass = document.getElementById("regPassword").value;
  const btn = document.getElementById("regSubmitBtn");
  const errBox = document.getElementById("authErrorMessage");

  try {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ กำลังส่งคำขอ...</span>`;
    errBox.classList.add("hidden");

    if (typeof window.registerUserRequest === "function") {
      await window.registerUserRequest({
        email,
        password: pass,
        name,
        department: dept,
        role
      });
      alert("✅ ส่งคำขอลงทะเบียนสำเร็จแล้ว!\nกรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติการเข้าใช้งาน");
      switchAuthTab("login");
      document.getElementById("loginEmail").value = email;
      document.getElementById("loginPassword").value = "";
    }
  } catch (err) {
    console.error("Register Error:", err);
    let msg = err.message || "เกิดข้อผิดพลาดในการลงทะเบียน";
    if (err.code === "auth/email-already-in-use") {
      msg = "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ";
    } else if (err.code === "auth/weak-password") {
      msg = "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
    } else if (err.code === "auth/operation-not-allowed") {
      msg = "ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Console";
    }
    errBox.innerText = msg;
    errBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>📝 ส่งคำขอลงทะเบียน</span>`;
  }
};

window.handleLogout = async function () {
  if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
    if (typeof window.logoutUser === "function") {
      await window.logoutUser();
    }
  }
};

// ลงทะเบียน Admin คนแรกผ่าน Setup Mode
window.handleFirstAdminSubmit = async function (e) {
  e.preventDefault();
  const name = document.getElementById("adminBootstrapName").value;
  const dept = document.getElementById("adminBootstrapDept").value;
  const email = document.getElementById("adminBootstrapEmail").value;
  const pass = document.getElementById("adminBootstrapPassword").value;
  const btn = document.getElementById("adminBootstrapSubmitBtn");
  const errBox = document.getElementById("authErrorMessage");

  try {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ กำลังตั้งค่าระบบ...</span>`;
    errBox.classList.add("hidden");

    if (typeof window.bootstrapFirstAdmin === "function") {
      await window.bootstrapFirstAdmin({
        email,
        password: pass,
        name,
        department: dept
      });
      alert("🎉 ตั้งค่าบัญชีผู้ดูแลระบบ (Admin) คนแรกสำเร็จแล้ว!\nกำลังเข้าสู่ระบบ...");
      // Auto login ด้วยแอดมินคนแรกทันที
      await window.loginUser(email, pass);
    }
  } catch (err) {
    console.error("First Admin Bootstrap Error:", err);
    let msg = err.message || "เกิดข้อผิดพลาดในการตั้งค่า Admin";
    if (err.code === "auth/email-already-in-use") {
      msg = "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบด้วยอีเมลนี้";
    } else if (err.code === "auth/weak-password") {
      msg = "รหัสผ่านง่ายเกินไป ต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
    } else if (err.code === "auth/invalid-email") {
      msg = "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลอีกครั้ง";
    } else if (err.code === "auth/operation-not-allowed" || err.message?.includes("CONFIGURATION_NOT_FOUND") || err.message?.includes("OPERATION_NOT_ALLOWED")) {
      msg = "⚠️ ใน Firebase Console ยังไม่ได้เปิดใช้งาน 'Email/Password' Provider กรุณาไปที่ Firebase Console > Authentication > Sign-in method แล้วกดเปิด Enable 'Email/Password'";
    }
    errBox.innerText = msg;
    errBox.classList.remove("hidden");
    alert(msg);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>👑 สร้างบัญชี Admin คนแรก</span>`;
  }
};

window.openFirstAdminModal = function () {
  const modal = document.getElementById("firstAdminSetupModal");
  if (modal) modal.classList.remove("hidden");
};

window.closeFirstAdminModal = function () {
  const modal = document.getElementById("firstAdminSetupModal");
  if (modal) modal.classList.add("hidden");
};
window.openAdminUsersModal = async function () {
  const modal = document.getElementById("adminUsersModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  await renderAdminUsersList();
};

window.closeAdminUsersModal = function () {
  const modal = document.getElementById("adminUsersModal");
  if (modal) modal.classList.add("hidden");
};

window.renderAdminUsersList = async function () {
  const container = document.getElementById("adminUsersListContainer");
  if (!container) return;
  container.innerHTML = `<div class="p-8 text-center text-slate-400">⏳ กำลังโหลดรายชื่อผู้ใช้งาน...</div>`;

  if (typeof window.fetchAllUsers !== "function") return;
  const users = await window.fetchAllUsers();

  if (users.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400">ยังไม่มีผู้ใช้งานในระบบ</div>`;
    return;
  }

  let html = `
    <table class="min-w-full divide-y divide-slate-200 text-xs">
      <thead class="bg-slate-100 font-semibold text-slate-700">
        <tr>
          <th class="px-3 py-2 text-left">ชื่อ-นามสกุล</th>
          <th class="px-3 py-2 text-left">อีเมล</th>
          <th class="px-3 py-2 text-left">แผนก</th>
          <th class="px-3 py-2 text-center">บทบาท</th>
          <th class="px-3 py-2 text-center">สถานะ</th>
          <th class="px-3 py-2 text-center">การจัดการ</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
  `;

  users.forEach((u) => {
    let statusBadge = "bg-amber-100 text-amber-800";
    let statusText = "⏳ รออนุมัติ";
    if (u.status === "active") {
      statusBadge = "bg-emerald-100 text-emerald-800";
      statusText = "✅ อนุมัติแล้ว";
    } else if (u.status === "disabled") {
      statusBadge = "bg-rose-100 text-rose-800";
      statusText = "⛔ ระงับสิทธิ์";
    }

    html += `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2 font-medium text-slate-900">${u.name || "-"}</td>
        <td class="px-3 py-2 text-slate-600">${u.email || "-"}</td>
        <td class="px-3 py-2 text-slate-600">${u.department || "-"}</td>
        <td class="px-3 py-2 text-center">
          <select onchange="updateUserRole('${u.id}', this.value)" class="border rounded px-1.5 py-0.5 text-xs bg-slate-50">
            <option value="general_user" ${u.role === "general_user" ? "selected" : ""}>ผู้ใช้ทั่วไป</option>
            <option value="executive" ${u.role === "executive" ? "selected" : ""}>ผู้บริหาร</option>
            <option value="technician" ${u.role === "technician" ? "selected" : ""}>ช่างซ่อมบำรุง</option>
            <option value="parcel_staff" ${u.role === "parcel_staff" ? "selected" : ""}>พัสดุ</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>ผู้ดูแลระบบ (Admin)</option>
          </select>
        </td>
        <td class="px-3 py-2 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge}">${statusText}</span>
        </td>
        <td class="px-3 py-2 text-center space-x-1">
          ${u.status === "pending_approval"
            ? `<button onclick="approveUser('${u.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[11px] font-semibold">อนุมัติ</button>
               <button onclick="rejectUser('${u.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1 rounded text-[11px]">ปฏิเสธ</button>`
            : u.status === "active"
            ? `<button onclick="toggleUserStatus('${u.id}', 'disabled')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded text-[11px]">ระงับ</button>`
            : `<button onclick="toggleUserStatus('${u.id}', 'active')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[11px]">เปิดใช้งาน</button>`
          }
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
};

window.approveUser = async function (uid) {
  if (confirm("ยืนยันการอนุมัติผู้ใช้งานท่านนี้?")) {
    await window.updateUserStatus(uid, "active");
    await renderAdminUsersList();
  }
};

window.rejectUser = async function (uid) {
  if (confirm("ยืนยันปฏิเสธคำขอนี้?")) {
    await window.updateUserStatus(uid, "rejected");
    await renderAdminUsersList();
  }
};

window.toggleUserStatus = async function (uid, newStatus) {
  await window.updateUserStatus(uid, newStatus);
  await renderAdminUsersList();
};

window.updateUserRole = async function (uid, newRole) {
  await window.updateUserStatus(uid, null, newRole);
  alert("อัปเดตสิทธิ์สำเร็จ");
};


// ============================================================
// Admin Dropdown Menu (แถบเมนูจัดการ)
// ============================================================
window.toggleAdminMenu = function (e) {
  if (e) {
    e.stopPropagation();
  }
  const menu = document.getElementById("adminDropdownMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
};

window.closeAdminMenu = function () {
  const menu = document.getElementById("adminDropdownMenu");
  if (menu) menu.classList.add("hidden");
};

// ปิด dropdown เมื่อคลิกนอก
document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("adminMenuWrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    window.closeAdminMenu();
  }
});


// ============================================================
// Charts Dropdown Menu (แถบเมนูกราฟสถิติ - สำหรับ Admin และ Executive)
// ============================================================
window.toggleChartsMenu = function (e) {
  if (e) {
    e.stopPropagation();
  }
  const menu = document.getElementById("chartsDropdownMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
};

window.closeChartsMenu = function () {
  const menu = document.getElementById("chartsDropdownMenu");
  if (menu) menu.classList.add("hidden");
};

window.selectChartTab = function (tab) {
  window.closeChartsMenu();
  if (typeof window.switchTab === "function") {
    window.switchTab(tab);
  }
};

// ปิด dropdown เมื่อคลิกนอก
document.addEventListener("click", (e) => {
  const chartsWrapper = document.getElementById("chartsMenuWrapper");
  if (chartsWrapper && !chartsWrapper.contains(e.target)) {
    window.closeChartsMenu();
  }
});

/**
 * js/common/auth-guard.js
 * จัดการ Gatekeeper และ Role-Based Access Control UI
 */

window.currentUserProfile = null;

// ซ่อน UI ระบบตั้งแต่เริ่มต้นจนกว่าจะผ่านการยืนยันตัวตน
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupAuthUI();
  });
} else {
  setupAuthUI();
}

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
        // 1. นำทางและเปิดหน้าจอทันที ไม่บล็อก UI
        hideGatekeeper();
        applyRolePermissions(profile);
        updateUserHeaderBadge(profile);

        // หากเป็นผู้ใช้ทั่วไป (general_user) ให้นำทางไปที่แท็บใบส่งซ่อมทันที
        if (profile.role === "general_user") {
          if (typeof window.switchTab === "function") {
            window.switchTab("repairs");
          }
        }

        // 2. เรียกซิงค์ข้อมูลใน Background แบบ Non-blocking
        setTimeout(() => {
          if (typeof window.triggerFirebaseSyncIfAuthorized === "function") {
            window.triggerFirebaseSyncIfAuthorized();
          }
          if (typeof window.renderParcelViews === "function") {
            window.renderParcelViews();
          }

          // 3. Post-Login Redirect: ตรวจสอบว่ามีการสแกน QR ค้างไว้ก่อนล็อกอินหรือไม่
          checkAndExecutePendingScannedQr();
        }, 50);
      } else {
        window.currentUserProfile = null;
        // ตรวจสอบ Deep Link URL จากการสแกน QR ผ่าน LINE/กล้องมือถือ
        const urlParams = new URLSearchParams(window.location.search);
        const scanNoid = urlParams.get('scan_noid');
        const action = urlParams.get('action');

        if (scanNoid) {
          // จำรหัสเครื่องที่สแกนไว้ใน sessionStorage
          sessionStorage.setItem('pending_scan_noid', scanNoid);
          sessionStorage.setItem('pending_scan_action', action || 'fast_repair');

          // แสดงแถบแจ้งเตือนบนหน้าต่างล็อกอิน ให้ผู้ใช้ทราบว่าสแกนเครื่องไหนมา
          const banner = document.getElementById('pendingScannedQrBanner');
          const bannerText = document.getElementById('pendingScannedQrCodeText');
          if (banner && bannerText) {
            bannerText.innerText = scanNoid;
            banner.classList.remove('hidden');
          }
        }

        showGatekeeper();
      }
    });
  }
}

function checkAndExecutePendingScannedQr() {
  const pendingNoid = sessionStorage.getItem('pending_scan_noid');
  const pendingAction = sessionStorage.getItem('pending_scan_action');

  if (pendingNoid) {
    // ล้างค่าที่ค้างออก เพื่อไม่ให้เด้งซ้ำในการรีเฟรชครั้งต่อไป
    sessionStorage.removeItem('pending_scan_noid');
    sessionStorage.removeItem('pending_scan_action');

    // ล้างพารามิเตอร์ URL ใน Address Bar เพื่อความสะอาด
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // สลับไปแท็บส่งซ่อม และเปิดหน้าต่างแจ้งซ่อมของเครื่องนั้นทันที!
    if (typeof window.switchTab === "function") {
      window.switchTab("repairs");
    }

    // รอฐานข้อมูลพร้อมเล็กน้อย แล้วเปิดหน้าต่างส่งซ่อมด่วน
    setTimeout(() => {
      if (typeof window.handleScannedCode === "function") {
        window.handleScannedCode(pendingNoid);
      }
    }, 350);
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
      <div class="text-right hidden sm:block cursor-pointer hover:opacity-90" onclick="openSelfProfileModal()" title="คลิกเพื่อแก้ไขชื่อ / ขอย้ายแผนก">
        <div class="font-bold text-white leading-tight flex items-center justify-end gap-1">
          <span>${profile.name}</span>
          <span class="text-[10px] bg-white/20 px-1 rounded hover:bg-white/30 text-teal-100">✏️</span>
        </div>
        <div class="text-[10px] text-teal-200">
          ${profile.department || "โรงพยาบาลพยุหะคีรี"}
          ${profile.pendingDepartment ? `<span class="text-amber-300 ml-1 font-bold animate-pulse" title="กำลังรอแอดมินอนุมัติย้ายไป: ${profile.pendingDepartment}">⏳ รอย้ายแผนก</span>` : ''}
        </div>
      </div>
      <button onclick="openSelfProfileModal()" class="sm:hidden bg-teal-800 hover:bg-teal-900 text-white p-1 rounded-lg text-xs" title="แก้ไขโปรไฟล์">👤</button>
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
      const res = await window.loginUser(email, pass);
      if (res && res.profile) {
        // ซ่อน Portal ทันทีที่ยืนยันตัวตนสำเร็จ
        hideGatekeeper();
      }
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

window._adminCachedUsers = [];

window.renderAdminUsersList = async function () {
  const container = document.getElementById("adminUsersListContainer");
  if (!container) return;
  container.innerHTML = `<div class="p-8 text-center text-slate-400">⏳ กำลังโหลดรายชื่อผู้ใช้งาน...</div>`;

  if (typeof window.fetchAllUsers !== "function") return;
  const users = await window.fetchAllUsers();
  window._adminCachedUsers = users;

  if (users.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400">ยังไม่มีผู้ใช้งานในระบบ</div>`;
    return;
  }

  let html = `
    <table class="min-w-full divide-y divide-slate-200 text-xs">
      <thead class="bg-slate-100 font-semibold text-slate-700 sticky top-0 z-10">
        <tr>
          <th class="px-3 py-2.5 text-left">ชื่อ-นามสกุล</th>
          <th class="px-3 py-2.5 text-left">อีเมล</th>
          <th class="px-3 py-2.5 text-left">รหัสผ่าน</th>
          <th class="px-3 py-2.5 text-left">กลุ่มงาน / แผนก</th>
          <th class="px-3 py-2.5 text-center">บทบาท</th>
          <th class="px-3 py-2.5 text-center">สถานะ</th>
          <th class="px-3 py-2.5 text-center">การจัดการ</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
  `;

  users.forEach((u, idx) => {
    let statusBadge = "bg-amber-100 text-amber-800";
    let statusText = "⏳ รออนุมัติ";
    if (u.status === "active") {
      statusBadge = "bg-emerald-100 text-emerald-800";
      statusText = "✅ อนุมัติแล้ว";
    } else if (u.status === "disabled") {
      statusBadge = "bg-rose-100 text-rose-800";
      statusText = "⛔ ระงับสิทธิ์";
    }

    // Password display helper
    const userPass = u.password || u.initialPassword || '';
    const hasPass = Boolean(userPass);

    // Department pending request indicator
    let deptDisplay = u.department || "-";
    if (u.pendingDepartment) {
      deptDisplay = `
        <div>
          <span class="text-slate-800 font-medium">${u.department || "-"}</span>
          <div class="mt-1 p-1 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
            <div>ขอย้ายไป: <strong>${u.pendingDepartment}</strong></div>
            <div class="flex gap-1 mt-1">
              <button onclick="handleApproveDept('${u.id}', '${u.pendingDepartment.replace(/'/g, "\\'")}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">อนุมัติย้าย</button>
              <button onclick="handleRejectDept('${u.id}')" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-1.5 py-0.5 rounded text-[10px]">ปฏิเสธ</button>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-3 py-2.5 font-bold text-slate-900">${u.name || "-"}</td>
        <td class="px-3 py-2.5 text-slate-600 font-mono">${u.email || "-"}</td>
        <td class="px-3 py-2.5 text-slate-700">
          <div class="flex items-center gap-1.5">
            <span id="pass_display_${idx}" class="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] select-all tracking-wider text-slate-700">${hasPass ? '••••••••' : '(ยังไม่มีรหัส)'}</span>
            ${hasPass ? `
              <button type="button" onclick="toggleShowPassword('${idx}')" id="pass_btn_${idx}" class="p-1 rounded hover:bg-slate-200 text-sm text-teal-700 hover:text-teal-900 transition-colors cursor-pointer" title="คลิกเพื่อดูรหัสผ่าน">👁️</button>
            ` : `
              <button type="button" onclick="openAdminEditUserModal('${u.id}')" class="text-[10px] text-amber-600 underline hover:text-amber-800" title="คลิกเพื่อตั้งรหัสผ่าน">ตั้งรหัส</button>
            `}
          </div>
        </td>
        <td class="px-3 py-2.5 text-slate-600">${deptDisplay}</td>
        <td class="px-3 py-2.5 text-center">
          <select onchange="updateUserRole('${u.id}', this.value)" class="border rounded px-1.5 py-0.5 text-xs bg-slate-50 font-medium">
            <option value="general_user" ${u.role === "general_user" ? "selected" : ""}>ผู้ใช้ทั่วไป</option>
            <option value="executive" ${u.role === "executive" ? "selected" : ""}>ผู้บริหาร</option>
            <option value="technician" ${u.role === "technician" ? "selected" : ""}>ช่างซ่อมบำรุง</option>
            <option value="parcel_staff" ${u.role === "parcel_staff" ? "selected" : ""}>พัสดุ</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>ผู้ดูแลระบบ (Admin)</option>
          </select>
        </td>
        <td class="px-3 py-2.5 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge}">${statusText}</span>
        </td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap space-x-1">
          <button onclick="openAdminEditUserModal('${u.id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded text-[11px] font-semibold" title="แก้ไขชื่อ, อีเมล, รหัสผ่าน, แผนก">✏️ แก้ไข</button>
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

// สลับการดูรหัสผ่าน
window.toggleShowPassword = function(idx) {
  const el = document.getElementById(`pass_display_${idx}`);
  const btn = document.getElementById(`pass_btn_${idx}`);
  const user = (window._adminCachedUsers || [])[Number(idx)];
  if (!el || !user) return;

  const actualPass = user.password || user.initialPassword || '';
  if (!actualPass) return;

  if (el.textContent === '••••••••') {
    el.textContent = actualPass;
    el.classList.remove('tracking-wider');
    el.classList.add('font-bold', 'text-teal-900', 'bg-teal-50', 'border', 'border-teal-200');
    if (btn) btn.textContent = '🙈';
  } else {
    el.textContent = '••••••••';
    el.classList.add('tracking-wider');
    el.classList.remove('font-bold', 'text-teal-900', 'bg-teal-50', 'border', 'border-teal-200');
    if (btn) btn.textContent = '👁️';
  }
};

// แอดมินอนุมัติ / ปฏิเสธคำขอย้ายแผนก
window.handleApproveDept = async function(uid, approvedDept) {
  if (confirm(`ยืนยันการอนุมัติย้ายไปกลุ่มงาน/แผนก "${approvedDept}" ใช่หรือไม่?`)) {
    if (typeof window.approveDepartmentChange === 'function') {
      await window.approveDepartmentChange(uid, approvedDept);
      alert('✅ อนุมัติย้ายแผนกเรียบร้อยแล้ว');
      renderAdminUsersList();
    }
  }
};

window.handleRejectDept = async function(uid) {
  if (confirm('ยืนยันปฏิเสธคำขอย้ายแผนกนี้?')) {
    if (typeof window.rejectDepartmentChange === 'function') {
      await window.rejectDepartmentChange(uid);
      alert('ปฏิเสธคำขอย้ายแผนกแล้ว');
      renderAdminUsersList();
    }
  }
};

// Modal แอดมินเพิ่มเจ้าหน้าที่ใหม่
window.openAdminCreateUserModal = function() {
  const m = document.getElementById('adminCreateUserModal');
  if (m) {
    document.getElementById('adminCreateUserForm')?.reset();
    m.classList.remove('hidden');
  }
};
window.closeAdminCreateUserModal = function() {
  document.getElementById('adminCreateUserModal')?.classList.add('hidden');
};

window.handleAdminCreateUserSubmit = async function(e) {
  e.preventDefault();
  const name = document.getElementById('adminNewUserName').value.trim();
  const email = document.getElementById('adminNewUserEmail').value.trim();
  const password = document.getElementById('adminNewUserPassword').value.trim();
  const department = document.getElementById('adminNewUserDept').value.trim();
  const role = document.getElementById('adminNewUserRole').value;
  const btn = document.getElementById('adminCreateUserSubmitBtn');

  if (!name || !email || !password || !department) {
    return alert('กรุณากรอกข้อมูลให้ครบทุกช่อง');
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังบันทึก...';
    if (typeof window.adminCreateUser === 'function') {
      await window.adminCreateUser({ email, password, name, department, role });
      alert(`✅ เพิ่มเจ้าหน้าที่ "${name}" เรียบร้อยแล้ว!`);
      closeAdminCreateUserModal();
      renderAdminUsersList();
    }
  } catch (err) {
    console.error('Error creating user:', err);
    alert('เกิดข้อผิดพลาดในการสร้างบัญชี: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 บันทึกเจ้าหน้าที่';
  }
};

// Modal แอดมินแก้ไขข้อมูลเจ้าหน้าที่ (ชื่อ, อีเมล, รหัสผ่าน, แผนก, บทบาท)
window.openAdminEditUserModal = function(uid) {
  const user = (window._adminCachedUsers || []).find(u => u.id === uid);
  if (!user) return alert('ไม่พบข้อมูลผู้ใช้งาน');

  document.getElementById('adminEditUserId').value = user.id;
  document.getElementById('adminEditUserName').value = user.name || '';
  document.getElementById('adminEditUserEmail').value = user.email || '';
  document.getElementById('adminEditUserPassword').value = user.password || user.initialPassword || '';
  document.getElementById('adminEditUserDept').value = user.department || '';
  document.getElementById('adminEditUserRole').value = user.role || 'general_user';

  document.getElementById('adminEditUserModal')?.classList.remove('hidden');
};

window.closeAdminEditUserModal = function() {
  document.getElementById('adminEditUserModal')?.classList.add('hidden');
};

window.handleAdminEditUserSubmit = async function(e) {
  e.preventDefault();
  const uid = document.getElementById('adminEditUserId').value;
  const name = document.getElementById('adminEditUserName').value.trim();
  const email = document.getElementById('adminEditUserEmail').value.trim();
  const password = document.getElementById('adminEditUserPassword').value.trim();
  const department = document.getElementById('adminEditUserDept').value.trim();
  const role = document.getElementById('adminEditUserRole').value;
  const btn = document.getElementById('adminEditUserSubmitBtn');

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังบันทึก...';
    if (typeof window.updateUserData === 'function') {
      const payload = { name, email, department, role };
      if (password) {
        payload.password = password;
        payload.initialPassword = password;
      }
      await window.updateUserData(uid, payload);
      alert('✅ บันทึกการแก้ไขข้อมูลเจ้าหน้าที่เรียบร้อยแล้ว');
      closeAdminEditUserModal();
      renderAdminUsersList();
    }
  } catch (err) {
    console.error('Error editing user:', err);
    alert('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 บันทึกการแก้ไข';
  }
};

// Modal จัดการโปรไฟล์ของเจ้าหน้าที่ตนเอง (เปลี่ยนชื่อทันที / ขอย้ายแผนกรออนุมัติ)
window.openSelfProfileModal = function() {
  const profile = window.currentUserProfile;
  if (!profile) return alert('กรุณาเข้าสู่ระบบก่อน');

  document.getElementById('selfProfileName').value = profile.name || '';
  document.getElementById('selfProfileCurrentDept').value = profile.department || 'ไม่ระบุ';
  document.getElementById('selfProfileNewDept').value = '';

  const pendingNotice = document.getElementById('selfProfilePendingDeptNotice');
  const pendingName = document.getElementById('selfProfilePendingDeptName');
  if (profile.pendingDepartment) {
    pendingNotice?.classList.remove('hidden');
    if (pendingName) pendingName.textContent = profile.pendingDepartment;
  } else {
    pendingNotice?.classList.add('hidden');
  }

  document.getElementById('selfProfileModal')?.classList.remove('hidden');
};

window.closeSelfProfileModal = function() {
  document.getElementById('selfProfileModal')?.classList.add('hidden');
};

window.handleSelfProfileSubmit = async function(e) {
  e.preventDefault();
  const profile = window.currentUserProfile;
  if (!profile || !profile.uid) return alert('ไม่พบข้อมูลโปรไฟล์');

  const newName = document.getElementById('selfProfileName').value.trim();
  const newDept = document.getElementById('selfProfileNewDept').value.trim();
  const btn = document.getElementById('selfProfileSubmitBtn');

  if (!newName) return alert('กรุณากรอกชื่อ-นามสกุล');

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังบันทึก...';
    let msg = [];

    // 1. ถ้าชื่อเปลี่ยน -> อัปเดตและมีผลทันที
    if (newName !== profile.name) {
      if (typeof window.updateUserData === 'function') {
        await window.updateUserData(profile.uid, { name: newName });
        profile.name = newName;
        window.currentUserProfile.name = newName;
        if (window.App && window.App.setCurrentUser) {
          window.App.setCurrentUser(newName, profile.role);
        }
        updateUserHeaderBadge(profile);
        msg.push('✅ แก้ไขชื่อ-นามสกุล เรียบร้อยแล้ว (มีผลทันที)');
      }
    }

    // 2. ถ้ากรอกขอย้ายแผนกใหม่ -> ส่งคำขอย้ายแผนก (รอแอดมินอนุมัติ)
    if (newDept && newDept !== profile.department) {
      if (typeof window.requestDepartmentChange === 'function') {
        await window.requestDepartmentChange(profile.uid, newDept);
        profile.pendingDepartment = newDept;
        window.currentUserProfile.pendingDepartment = newDept;
        updateUserHeaderBadge(profile);
        msg.push(`⏳ ส่งคำขอย้ายไปแผนก "${newDept}" แล้ว (กำลังรอผู้ดูแลระบบอนุมัติ)`);
      }
    }

    if (msg.length === 0) {
      alert('ไม่มีข้อมูลที่เปลี่ยนแปลง');
    } else {
      alert(msg.join('\n'));
    }
    closeSelfProfileModal();
  } catch (err) {
    console.error('Self profile update error:', err);
    alert('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 บันทึกข้อมูล';
  }
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

// ============================================================
// Forgot Password Modal & Logic
// ============================================================
window.openForgotPasswordModal = function() {
  const m = document.getElementById('forgotPasswordModal');
  const alertEl = document.getElementById('forgotPassAlert');
  if (alertEl) alertEl.classList.add('hidden');
  const emailInput = document.getElementById('loginEmail');
  const forgotInput = document.getElementById('forgotPassEmail');
  if (emailInput && forgotInput && emailInput.value) {
    forgotInput.value = emailInput.value;
  }
  if (m) m.classList.remove('hidden');
};

window.closeForgotPasswordModal = function() {
  document.getElementById('forgotPasswordModal')?.classList.add('hidden');
};

window.handleForgotPasswordSubmit = async function(e) {
  e.preventDefault();
  const email = document.getElementById('forgotPassEmail')?.value.trim();
  const btn = document.getElementById('forgotPassSubmitBtn');
  const alertEl = document.getElementById('forgotPassAlert');

  if (!email) return alert('กรุณากรอกอีเมล');

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังส่ง...';
    if (alertEl) alertEl.classList.add('hidden');

    if (typeof window.sendUserPasswordReset === 'function') {
      await window.sendUserPasswordReset(email);
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold leading-relaxed block';
        alertEl.innerHTML = `✅ ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง <strong>${email}</strong> เรียบร้อยแล้ว!<br><span class="text-[11px] font-normal text-emerald-700">กรุณาตรวจสอบใน Inbox หรือโฟลเดอร์ Junk/Spam Mail ของคุณ</span>`;
      }
      setTimeout(() => {
        window.closeForgotPasswordModal();
      }, 4000);
    } else {
      throw new Error('ฟังก์ชันส่งอีเมลรีเซ็ตรหัสผ่านยังไม่พร้อม');
    }
  } catch (err) {
    console.error('Password reset error:', err);
    let msg = err.message || 'ไม่สามารถส่งลิงก์รีเซ็ตได้';
    if (err.code === 'auth/user-not-found') {
      msg = 'ไม่พบบัญชีผู้ใช้งานที่ใช้อีเมลนี้';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    if (alertEl) {
      alertEl.className = 'p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold block';
      alertEl.innerText = '⚠️ ' + msg;
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📨 ส่งลิงก์รีเซ็ต';
  }
};

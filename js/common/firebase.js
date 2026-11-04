/**
 * js/common/firebase.js
 * ศูนย์กลางการเชื่อมต่อ Cloud Firestore ตัวเดียวสำหรับทุกโมดูล (Unified Firestore Service)
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  startAfter
} from "firebase/firestore";

import { firebaseConfig, isFirebaseConfigured } from './config.js';

let app = null;
let db = null;
let auth = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  window.isFirebaseReady = true;
  console.log("✅ Unified Firebase, Firestore & Auth initialized successfully");
} catch (err) {
  console.error("Firebase init warning:", err);
}

export { 
  app, 
  db, 
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  writeBatch, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  limit, 
  startAfter 
};

// ─── SYNC STATUS INDICATOR ───────────────────────────────────────────────────
export function setSyncStatus(state) {
  const el = document.getElementById("syncStatusBadge");
  if (!el) return;
  const states = {
    ok:     { text: "☁️ ซิงค์แล้ว",     cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    saving: { text: "⏳ กำลังบันทึก...", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    error:  { text: "⚠️ ซิงค์ไม่สำเร็จ", cls: "bg-rose-100 text-rose-800 border-rose-200" },
    offline:{ text: "📴 ออฟไลน์",        cls: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const s = states[state] || states.offline;
  el.textContent = s.text;
  el.className = `text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.cls} transition-all whitespace-nowrap`;
}
window.setSyncStatus = setSyncStatus;

// ─── Bridge Functions สำหรับโมดูลงานซ่อม (Repair Module Bridge) ───────────────

export async function fetchRepairsFromCloud(filters = {}) {
  if (!db) return [];
  try {
    let constraints = [];
    if (filters.status && filters.status !== 'all') {
      constraints.push(where("status", "==", filters.status));
    }
    constraints.push(orderBy("date", "desc"));
    if (filters.limitCount && typeof filters.limitCount === 'number') {
      constraints.push(limit(filters.limitCount));
    }

    const q = query(collection(db, "repairs"), ...constraints);
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => list.push(docSnap.data()));
    return list;
  } catch (err) {
    console.error("fetchRepairsFromCloud error:", err);
    return [];
  }
}

export function listenToRepairsRealtime(onDataUpdate, filters = {}) {
  if (!db) return () => {};
  try {
    let constraints = [];
    if (filters.status && filters.status !== 'all') {
      constraints.push(where("status", "==", filters.status));
    }
    constraints.push(orderBy("date", "desc"));
    if (filters.limitCount && typeof filters.limitCount === 'number') {
      constraints.push(limit(filters.limitCount));
    }

    const q = query(collection(db, "repairs"), ...constraints);
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push(docSnap.data()));
      onDataUpdate(list);
    }, (err) => console.error("Realtime repairs error:", err));
  } catch (err) {
    console.error("listenToRepairsRealtime setup error:", err);
    return () => {};
  }
}

/**
 * ดึงรายการซ่อมแบบแบ่งหน้า (Cursor-based Pagination)
 * @param {Object} options { pageSize: 20, lastDoc: DocumentSnapshot|null, status: string|null }
 */
export async function fetchRepairsPaged({ pageSize = 20, lastDoc = null, status = null } = {}) {
  if (!db) return { list: [], lastDoc: null, hasMore: false };
  try {
    let constraints = [];
    if (status && status !== 'all') {
      constraints.push(where("status", "==", status));
    }
    constraints.push(orderBy("date", "desc"));
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    constraints.push(limit(pageSize));

    const q = query(collection(db, "repairs"), ...constraints);
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item._docSnapshot = docSnap;
      list.push(item);
    });
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return {
      list,
      lastDoc: newLastDoc,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (err) {
    console.error("fetchRepairsPaged error:", err);
    return { list: [], lastDoc: null, hasMore: false };
  }
}

export async function saveRepairToCloud(repair, isNew = false) {
  if (!db || !repair) return false;
  let id = repair.id || repair.repairNo;
  if (!id) return false;
  try {
    setSyncStatus("saving");

    // ถ้าเป็นการสร้างใบส่งซ่อมใหม่: ตรวจสอบการชนกันของเลขที่ใบส่งซ่อม (Race Condition Prevention)
    if (isNew) {
      let docId = String(id).replace(/\//g, "_");
      let docRef = doc(db, "repairs", docId);
      let docSnap = await getDoc(docRef);

      // ถ้าพบว่ามีคนบันทึกเลขนี้ไปก่อนหน้าแล้ว ให้คำนวณและรันเลขใหม่ถัดไปทันที
      if (docSnap.exists()) {
        console.warn(`⚠️ [Conflict Detected] เลขที่ใบซ่อม ${id} ซ้ำกับในระบบ กำลังรันเลขใหม่ถัดไป...`);
        const parts = String(id).split('/');
        let seq = parseInt(parts[0], 10) || 1;
        const fy = parts[1] || '';

        // วนลูปหาเลขถัดไปที่ยังว่างอยู่จริงบน Cloud
        while (docSnap.exists()) {
          seq++;
          id = fy ? `${seq}/${fy}` : String(seq);
          docId = String(id).replace(/\//g, "_");
          docRef = doc(db, "repairs", docId);
          docSnap = await getDoc(docRef);
        }

        console.log(`✅ [Resolved] ได้รับเลขที่ใบซ่อมใหม่: ${id}`);
        repair.repairNo = id;
        repair.id = id;
      }

      await setDoc(docRef, repair, { merge: true });
    } else {
      // กรณีเป็นการแก้ไข (Update) ข้อมูลเดิม
      const docId = String(id).replace(/\//g, "_");
      const docRef = doc(db, "repairs", docId);
      await setDoc(docRef, repair, { merge: true });
    }

    setSyncStatus("ok");
    return true;
  } catch (err) {
    console.error("saveRepairToCloud error:", err);
    setSyncStatus("error");
    return false;
  }
}

export async function deleteRepairFromCloud(id) {
  if (!db || !id) return false;
  try {
    setSyncStatus("saving");
    const docId = String(id).replace(/\//g, "_");
    await deleteDoc(doc(db, "repairs", docId));
    setSyncStatus("ok");
    return true;
  } catch (err) {
    console.error("deleteRepairFromCloud error:", err);
    setSyncStatus("error");
    return false;
  }
}

// ─── Bridge Functions สำหรับครุภัณฑ์ (Equipments) ────────────────────────────

export async function fetchEquipmentsFromCloud() {
  if (!db) return [];
  try {
    const snapshot = await getDocs(collection(db, "hospital_equipments"));
    const list = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item.id = docSnap.id;
      list.push(item);
    });
    return list;
  } catch (err) {
    console.error("fetchEquipmentsFromCloud error:", err);
    return [];
  }
}

/**
 * ดึงรายการครุภัณฑ์แบบแบ่งหน้า (Cursor-based Pagination)
 * @param {Object} options { pageSize: 25, lastDoc: DocumentSnapshot|null, category: string|null }
 */
export async function fetchEquipmentsPaged({ pageSize = 25, lastDoc = null, category = null } = {}) {
  if (!db) return { list: [], lastDoc: null, hasMore: false };
  try {
    let constraints = [];
    if (category && category !== 'all') {
      constraints.push(where("type", "==", category));
    }
    constraints.push(orderBy("name", "asc"));
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    constraints.push(limit(pageSize));

    const q = query(collection(db, "hospital_equipments"), ...constraints);
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item.id = docSnap.id;
      item._docSnapshot = docSnap;
      list.push(item);
    });
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return {
      list,
      lastDoc: newLastDoc,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (err) {
    console.error("fetchEquipmentsPaged error:", err);
    return { list: [], lastDoc: null, hasMore: false };
  }
}

// ─── Bridge Functions สำหรับโมดูลช่าง (Staff Module Bridge) ────────────────────

export async function fetchStaffFromCloud() {
  if (!db) return [];
  try {
    const snapshot = await getDocs(collection(db, "staff"));
    const list = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item.id = docSnap.id;
      list.push(item);
    });
    return list;
  } catch (err) {
    console.error("fetchStaffFromCloud error:", err);
    return [];
  }
}

export function listenToStaffRealtime(onDataUpdate) {
  if (!db) return () => {};
  return onSnapshot(collection(db, "staff"), (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item.id = docSnap.id;
      list.push(item);
    });
    onDataUpdate(list);
  }, (err) => console.error("Realtime staff error:", err));
}

export async function saveStaffToCloud(staff) {
  if (!db || !staff || !staff.id) return false;
  try {
    setSyncStatus("saving");
    const docRef = doc(db, "staff", String(staff.id));
    await setDoc(docRef, staff, { merge: true });
    setSyncStatus("ok");
    return true;
  } catch (err) {
    console.error("saveStaffToCloud error:", err);
    setSyncStatus("error");
    return false;
  }
}

export async function deleteStaffFromCloud(id) {
  if (!db || !id) return false;
  try {
    setSyncStatus("saving");
    await deleteDoc(doc(db, "staff", String(id)));
    setSyncStatus("ok");
    return true;
  } catch (err) {
    console.error("deleteStaffFromCloud error:", err);
    setSyncStatus("error");
    return false;
  }
}

// ─── AUDIT LOGGING SYSTEM (ประวัติการแก้ไขย้อนหลัง) ───────────────────────────

export async function logAuditAction(action, module, targetId, details = {}) {
  if (!db) return false;
  try {
    const user = (window.App && window.App.currentUser) 
      ? window.App.currentUser 
      : { name: 'ไม่ระบุผู้ใช้งาน', role: 'guest' };

    const logEntry = {
      action: action,            // 'CREATE', 'UPDATE', 'DELETE'
      module: module,            // 'repair', 'parcel', 'staff'
      targetId: String(targetId || '-'),
      performedBy: user.name || 'เจ้าหน้าที่',
      role: user.role || 'staff',
      timestamp: new Date().toISOString(),
      details: details           // ข้อมูลก่อน/หลัง หรือสรุปการเปลี่ยนแปลง
    };

    await addDoc(collection(db, "audit_logs"), logEntry);
    console.log(`📝 [Audit Log] ${action} ${module}:${targetId} by ${logEntry.performedBy}`);
    return true;
  } catch (err) {
    console.warn("logAuditAction warning:", err);
    return false;
  }
}

export async function fetchAuditLogs(limitCount = 50) {
  if (!db) return [];
  try {
    const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const list = [];
    let count = 0;
    snapshot.forEach(docSnap => {
      if (count < limitCount) {
        list.push({ id: docSnap.id, ...docSnap.data() });
        count++;
      }
    });
    return list;
  } catch (err) {
    console.error("fetchAuditLogs error:", err);
    return [];
  }
}

// ─── AUTHENTICATION & RBAC SERVICE ──────────────────────────────────────────

/**
 * ตรวจสอบว่าระบบมีผู้ดูแลระบบ (Admin) คนแรกแล้วหรือไม่
 */
export async function checkHasAdminUser() {
  if (!db) return false;
  try {
    const q = query(collection(db, "users"), where("role", "==", "admin"), where("status", "==", "active"), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.warn("checkHasAdminUser error:", err);
    return false;
  }
}

/**
 * ลงทะเบียนผู้ดูแลระบบคนแรกของระบบ (First System Admin Bootstrap)
 */
export async function bootstrapFirstAdmin({ email, password, name, department }) {
  if (!auth) throw new Error("Firebase Auth ยังไม่พร้อมใช้งาน");
  const hasAdmin = await checkHasAdminUser();
  if (hasAdmin) {
    throw new Error("ระบบมีผู้ดูแลระบบอยู่แล้ว ไม่สามารถสร้าง Admin หลักซ้ำได้");
  }
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;
  const adminProfile = {
    uid,
    email: email.trim(),
    name: name.trim(),
    department: department.trim() || "ศูนย์คอมพิวเตอร์ / บริหารทั่วไป",
    role: "admin",
    status: "active",
    isFirstAdmin: true,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, "users", uid), adminProfile);
  await logAuditAction({
    action: "bootstrap_first_admin",
    target: "users",
    targetId: uid,
    details: `ลงทะเบียนผู้ดูแลระบบคนแรกของโรงพยาบาล: ${name} (${email})`
  });
  return adminProfile;
}

/**
 * เข้าสู่ระบบด้วย Email & Password
 */
export async function loginUser(email, password) {
  if (!auth) throw new Error("Firebase Auth ยังไม่พร้อมใช้งาน");
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;
  let profile = null;
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      profile = userDoc.data();
    }
  } catch (err) {
    console.warn("Could not read userDoc from firestore, check super admin:", err);
  }

  // Fallback พิเศษสำหรับ Super Admin เริ่มต้นระบบ (phathanbo@gmail.com)
  if (!profile && email.trim().toLowerCase() === "phathanbo@gmail.com") {
    profile = {
      uid,
      email: email.trim(),
      name: "ผู้ดูแลระบบหลัก (Admin)",
      department: "ศูนย์คอมพิวเตอร์และเทคโนโลยีสารสนเทศ",
      role: "admin",
      status: "active",
      isFirstAdmin: true
    };
    // พยายามเซฟลง Firestore เผื่อ Rules ปลดแล้ว
    try {
      await setDoc(doc(db, "users", uid), profile, { merge: true });
    } catch (_) {}
  }

  if (!profile) {
    await signOut(auth);
    throw new Error("ไม่พบข้อมูลสิทธิ์ผู้ใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบ");
  }
  if (profile.status === 'pending_approval') {
    await signOut(auth);
    throw new Error("บัญชีของท่านอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ");
  }
  if (profile.status === 'disabled' || profile.status === 'rejected') {
    await signOut(auth);
    throw new Error("บัญชีของท่านถูกระงับการใช้งาน");
  }
  return { user: cred.user, profile };
}

/**
 * ลงทะเบียนขอเข้าใช้งานระบบ (Self-Registration with Pending Approval)
 */
export async function registerUserRequest({ email, password, name, department, role = 'general_user' }) {
  if (!auth) throw new Error("Firebase Auth ยังไม่พร้อมใช้งาน");
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;
  const newProfile = {
    uid,
    email: email.trim(),
    name: name.trim(),
    department: department.trim(),
    role: role,
    status: 'pending_approval',
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, "users", uid), newProfile);
  // Log audit
  await logAuditAction({
    action: "register_request",
    target: "users",
    targetId: uid,
    details: `ส่งคำขอลงทะเบียน: ${name} (${department}) แผนก/สิทธิ์: ${role}`
  });
  // Sign out ทันทีเพื่อให้รออนุมัติ
  await signOut(auth);
  return newProfile;
}

/**
 * ผู้ดูแลระบบสร้างบัญชีให้เจ้าหน้าที่โดยตรง
 */
export async function adminCreateUser({ email, password, name, department, role = 'general_user' }) {
  // บันทึกคำขอสร้างบัญชีลงใน Firestore เพื่อรอให้ผู้ใช้งานมาเคลม หรือลงทะเบียน
  // หรือสร้าง record ผู้ใช้งานแบบ Active
  const tempId = "user_" + Date.now();
  const profile = {
    email: email.trim(),
    name: name.trim(),
    department: department.trim(),
    role: role,
    status: 'active',
    createdByAdmin: true,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, "users", tempId), profile);
  await logAuditAction({
    action: "admin_create_user",
    target: "users",
    targetId: tempId,
    details: `แอดมินสร้างบัญชี: ${name} (${email}) สิทธิ์: ${role}`
  });
  return profile;
}

/**
 * ดึงรายการผู้ใช้งานทั้งหมด (สำหรับ Admin)
 */
export async function fetchAllUsers() {
  if (!db) return [];
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item.id = docSnap.id;
      list.push(item);
    });
    return list;
  } catch (err) {
    console.error("fetchAllUsers error:", err);
    return [];
  }
}

/**
 * อนุมัติผู้ใช้งาน / เปลี่ยนแปลงสถานะหรือสิทธิ์ (Admin Only)
 */
export async function updateUserStatus(userId, status, role = null) {
  if (!db || !userId) return false;
  try {
    const docRef = doc(db, "users", userId);
    const updateData = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (role) updateData.role = role;
    await updateDoc(docRef, updateData);
    await logAuditAction({
      action: "update_user_status",
      target: "users",
      targetId: userId,
      details: `ปรับสถานะผู้ใช้ ${userId} เป็น ${status}${role ? ' สิทธิ์ ' + role : ''}`
    });
    return true;
  } catch (err) {
    console.error("updateUserStatus error:", err);
    return false;
  }
}

/**
 * ล็อกเอาต์ออกจากระบบ
 */
export async function logoutUser() {
  if (!auth) return;
  await signOut(auth);
  localStorage.removeItem('hospital_current_user');
  window.location.reload();
}

/**
 * เฝ้าติดตามการล็อกอิน
 */
export function onAuthStateChangedHandler(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        let profile = null;
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            profile = userDoc.data();
          }
        } catch (e) {
          console.warn("Could not read user profile from firestore:", e);
        }

        // Fallback พิเศษสำหรับ Super Admin เริ่มต้นระบบ (phathanbo@gmail.com)
        if (!profile && firebaseUser.email && firebaseUser.email.toLowerCase() === "phathanbo@gmail.com") {
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: "ผู้ดูแลระบบหลัก (Admin)",
            department: "ศูนย์คอมพิวเตอร์และเทคโนโลยีสารสนเทศ",
            role: "admin",
            status: "active",
            isFirstAdmin: true
          };
          try {
            await setDoc(doc(db, "users", firebaseUser.uid), profile, { merge: true });
          } catch (_) {}
        }

        if (profile && profile.status === 'active') {
          callback(firebaseUser, profile);
          return;
        }
      } catch (e) {
        console.error("Error reading user profile:", e);
      }
      callback(null, null);
    } else {
      callback(null, null);
    }
  });
}

// ─── NAMESPACE & BACKWARD COMPATIBILITY ─────────────────────────────────────
window.App = window.App || {};
window.App.common = window.App.common || {};
window.App.auth = {
  checkHasAdminUser,
  bootstrapFirstAdmin,
  login: loginUser,
  register: registerUserRequest,
  logout: logoutUser,
  adminCreateUser,
  fetchAllUsers,
  updateUserStatus,
  onAuthStateChanged: onAuthStateChangedHandler
};
window.App.audit = {
  log: logAuditAction,
  fetchLogs: fetchAuditLogs
};

window.App.common.firebase = {
  app,
  db,
  auth,
  setSyncStatus,
  checkHasAdminUser,
  bootstrapFirstAdmin,
  loginUser,
  registerUserRequest,
  logoutUser,
  adminCreateUser,
  fetchAllUsers,
  updateUserStatus,
  onAuthStateChangedHandler,
  fetchRepairsFromCloud,
  fetchRepairsPaged,
  listenToRepairsRealtime,
  saveRepairToCloud,
  deleteRepairFromCloud,
  fetchEquipmentsFromCloud,
  fetchEquipmentsPaged,
  fetchStaffFromCloud,
  listenToStaffRealtime,
  saveStaffToCloud,
  deleteStaffFromCloud,
  logAuditAction,
  fetchAuditLogs
};

// ส่งต่อตัวแปรให้ window เพื่อรองรับฟังก์ชันเดิมในระบบซ่อมบำรุง
window.checkHasAdminUser = checkHasAdminUser;
window.bootstrapFirstAdmin = bootstrapFirstAdmin;
window.loginUser = loginUser;
window.registerUserRequest = registerUserRequest;
window.logoutUser = logoutUser;
window.adminCreateUser = adminCreateUser;
window.fetchAllUsers = fetchAllUsers;
window.updateUserStatus = updateUserStatus;
window.onAuthStateChangedHandler = onAuthStateChangedHandler;

window.logAuditAction = logAuditAction;
window.fetchAuditLogs = fetchAuditLogs;
window.fetchRepairsFromCloud = fetchRepairsFromCloud;
window.fetchRepairsPaged = fetchRepairsPaged;
window.listenToRepairsRealtime = listenToRepairsRealtime;
window.saveRepairToCloud = saveRepairToCloud;
window.deleteRepairFromCloud = deleteRepairFromCloud;

window.fetchEquipmentsFromCloud = fetchEquipmentsFromCloud;
window.fetchEquipmentsPaged = fetchEquipmentsPaged;

window.fetchStaffFromCloud = fetchStaffFromCloud;
window.listenToStaffRealtime = listenToStaffRealtime;
window.saveStaffToCloud = saveStaffToCloud;
window.deleteStaffFromCloud = deleteStaffFromCloud;

// เริ่มต้นซิงค์ Firebase ทันทีเมื่อผู้ใช้ล็อกอินผ่านแล้วเท่านั้น (ป้องกัน Permission Denied ก่อนล็อกอิน)
export function triggerFirebaseSyncIfAuthorized() {
  if (window.isFirebaseReady && window.currentUserProfile) {
    setSyncStatus("ok");
    if (typeof window.startFirebaseSync === 'function') {
      window.startFirebaseSync();
    }
  }
}
window.triggerFirebaseSyncIfAuthorized = triggerFirebaseSyncIfAuthorized;

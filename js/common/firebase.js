/**
 * js/common/firebase.js
 * ศูนย์กลางการเชื่อมต่อ Cloud Firestore ตัวเดียวสำหรับทุกโมดูล (Unified Firestore Service)
 */

import { initializeApp } from "firebase/app";
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

try {
  app = initializeApp(firebaseConfig);
  // ใช้ getFirestore มาตรฐาน เพื่อให้ SDK สลับโปรโตคอล (WebSockets / HTTP) อัตโนมัติ
  // ป้องกันปัญหา experimentalForceLongPolling ค้าง 10s แล้วหลุด 502 / CORS บน Live Server
  db = getFirestore(app);
  window.isFirebaseReady = true;
  console.log("✅ Unified Firebase & Firestore initialized successfully");
} catch (err) {
  console.error("Firebase init warning:", err);
}

export { app, db, collection, doc, getDocs, getDoc, addDoc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy, where, limit, startAfter };

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

export async function saveRepairToCloud(repair) {
  if (!db || !repair) return false;
  const id = repair.id || repair.repairNo;
  if (!id) return false;
  try {
    setSyncStatus("saving");
    const docId = String(id).replace(/\//g, "_");
    const docRef = doc(db, "repairs", docId);
    await setDoc(docRef, repair, { merge: true });
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

// ─── NAMESPACE & BACKWARD COMPATIBILITY ─────────────────────────────────────
window.App = window.App || {};
window.App.common = window.App.common || {};
window.App.audit = {
  log: logAuditAction,
  fetchLogs: fetchAuditLogs
};

window.App.common.firebase = {
  app,
  db,
  setSyncStatus,
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

// เริ่มต้นซิงค์ Firebase ทันทีเมื่อโหลดโมดูลเสร็จ
if (window.isFirebaseReady) {
  setSyncStatus("ok");
  if (typeof window.startFirebaseSync === 'function') {
    window.startFirebaseSync();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof window.startFirebaseSync === 'function') {
        window.startFirebaseSync();
      }
    });
  }
}

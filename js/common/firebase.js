/**
 * js/common/firebase.js
 * ศูนย์กลางการเชื่อมต่อ Cloud Firestore ตัวเดียวสำหรับทุกโมดูล (Unified Firestore Service)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

export { app, db, collection, doc, getDocs, getDoc, addDoc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy };

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

export async function fetchRepairsFromCloud() {
  if (!db) return [];
  try {
    const q = query(collection(db, "repairs"), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => list.push(docSnap.data()));
    return list;
  } catch (err) {
    console.error("fetchRepairsFromCloud error:", err);
    return [];
  }
}

export function listenToRepairsRealtime(onDataUpdate) {
  if (!db) return () => {};
  const q = query(collection(db, "repairs"), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => list.push(docSnap.data()));
    onDataUpdate(list);
  }, (err) => console.error("Realtime repairs error:", err));
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
    const snapshot = await getDocs(collection(db, "equipments"));
    const list = [];
    snapshot.forEach(docSnap => list.push(docSnap.data()));
    return list;
  } catch (err) {
    console.error("fetchEquipmentsFromCloud error:", err);
    return [];
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

// ส่งต่อตัวแปรให้ window เพื่อรองรับฟังก์ชันเดิมในระบบซ่อมบำรุง
window.fetchRepairsFromCloud = fetchRepairsFromCloud;
window.listenToRepairsRealtime = listenToRepairsRealtime;
window.saveRepairToCloud = saveRepairToCloud;
window.deleteRepairFromCloud = deleteRepairFromCloud;

window.fetchEquipmentsFromCloud = fetchEquipmentsFromCloud;

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

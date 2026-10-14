/**
 * js/common/firebase.js
 * ศูนย์กลางการเชื่อมต่อ Cloud Firestore ตัวเดียวสำหรับทุกโมดูล (Unified Firestore Service)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
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
  // ใช้ Multi-tab Local Cache Persistence เพื่อประหยัดโควต้าการอ่านและทำงานได้แม้เน็ตช้า
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  window.isFirebaseReady = true;
  console.log("✅ Unified Firebase & Firestore initialized successfully");
} catch (err) {
  console.error("Firebase init warning:", err);
}

export { app, db, collection, doc, getDocs, getDoc, addDoc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy };

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
  if (!db || !repair || !repair.id) return;
  const docRef = doc(db, "repairs", String(repair.id));
  await setDoc(docRef, repair, { merge: true });
}

export async function deleteRepairFromCloud(id) {
  if (!db || !id) return;
  await deleteDoc(doc(db, "repairs", String(id)));
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
  if (!db || !staff || !staff.id) return;
  const docRef = doc(db, "staff", String(staff.id));
  await setDoc(docRef, staff, { merge: true });
}

export async function deleteStaffFromCloud(id) {
  if (!db || !id) return;
  await deleteDoc(doc(db, "staff", String(id)));
}

// ส่งต่อตัวแปรให้ window เพื่อรองรับฟังก์ชันเดิมในระบบซ่อมบำรุง
window.fetchRepairsFromCloud = fetchRepairsFromCloud;
window.listenToRepairsRealtime = listenToRepairsRealtime;
window.saveRepairToCloud = saveRepairToCloud;
window.deleteRepairFromCloud = deleteRepairFromCloud;

window.fetchStaffFromCloud = fetchStaffFromCloud;
window.listenToStaffRealtime = listenToStaffRealtime;
window.saveStaffToCloud = saveStaffToCloud;
window.deleteStaffFromCloud = deleteStaffFromCloud;

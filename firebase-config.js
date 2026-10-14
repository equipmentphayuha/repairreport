import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore,
  collection, doc,
  getDocs, getDoc,
  addDoc, setDoc, deleteDoc,
  onSnapshot,
  query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbF85T09sAJzUGQdEuIYQ2_U8TISY4wa0",
  authDomain: "equipmentphayuha-e3f3f.firebaseapp.com",
  projectId: "equipmentphayuha-e3f3f",
  storageBucket: "equipmentphayuha-e3f3f.firebasestorage.app",
  messagingSenderId: "494382324661",
  appId: "1:494382324661:web:e876106fc5852acf4bd7fc",
  measurementId: "G-LBX4QLTBQJ"
};

try {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  window.isFirebaseReady = true;

  // ─── READ ────────────────────────────────────────────────────────────────────

  window.fetchRepairsFromCloud = async function() {
    try {
      const q = query(collection(db, "repairs"), orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const cloudRepairs = [];
      snapshot.forEach(doc => { cloudRepairs.push(doc.data()); });
      return cloudRepairs;
    } catch (error) {
      console.error("Error fetching repairs:", error);
      return [];
    }
  };

  window.fetchEquipmentsFromCloud = async function() {
    try {
      const snapshot = await getDocs(collection(db, "equipments"));
      const cloudEquips = [];
      snapshot.forEach(doc => { cloudEquips.push(doc.data()); });
      return cloudEquips;
    } catch (error) {
      console.error("Error fetching equipments:", error);
      return [];
    }
  };

  window.listenToRepairsRealtime = function(onDataUpdate) {
    const q = query(collection(db, "repairs"), orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
      const updatedList = [];
      snapshot.forEach(docSnap => updatedList.push(docSnap.data()));
      onDataUpdate(updatedList);
    }, (error) => {
      console.error("Realtime listen error:", error);
    });
  };

  // ─── WRITE / DELETE (ยึดฐานข้อมูลเป็นหลัก) ──────────────────────────────────

  /**
   * เพิ่มหรืออัปเดตใบส่งซ่อม — ใช้ repairNo เป็น Document ID
   * @param {Object} repairData
   * @returns {Promise<boolean>}
   */
  window.saveRepairToCloud = async function(repairData) {
    try {
      setSyncStatus("saving");
      const docId = repairData.repairNo.replace(/\//g, "_"); // "1/2570" → "1_2570"
      await setDoc(doc(db, "repairs", docId), repairData);
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error("Error saving repair:", error);
      setSyncStatus("error");
      return false;
    }
  };

  /**
   * ลบใบส่งซ่อมออกจาก Firestore
   * @param {string} repairNo  เช่น "1/2570"
   * @returns {Promise<boolean>}
   */
  window.deleteRepairFromCloud = async function(repairNo) {
    try {
      setSyncStatus("saving");
      const docId = repairNo.replace(/\//g, "_");
      await deleteDoc(doc(db, "repairs", docId));
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error("Error deleting repair:", error);
      setSyncStatus("error");
      return false;
    }
  };

  /**
   * เพิ่มหรืออัปเดตครุภัณฑ์ — ใช้ equipCode เป็น Document ID
   * @param {Object} equipData
   * @returns {Promise<boolean>}
   */
  window.saveEquipmentToCloud = async function(equipData) {
    try {
      setSyncStatus("saving");
      const docId = equipData.equipCode.replace(/[^a-zA-Z0-9]/g, "_");
      await setDoc(doc(db, "equipments", docId), equipData);
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error("Error saving equipment:", error);
      setSyncStatus("error");
      return false;
    }
  };

  /**
   * ลบครุภัณฑ์ออกจาก Firestore
   * @param {string} equipCode
   * @returns {Promise<boolean>}
   */
  window.deleteEquipmentFromCloud = async function(equipCode) {
    try {
      setSyncStatus("saving");
      const docId = equipCode.replace(/[^a-zA-Z0-9]/g, "_");
      await deleteDoc(doc(db, "equipments", docId));
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error("Error deleting equipment:", error);
      setSyncStatus("error");
      return false;
    }
  };

  // ─── SYNC STATUS INDICATOR ───────────────────────────────────────────────────

  function setSyncStatus(state) {
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
    el.className = `text-xs font-medium px-2.5 py-1 rounded-full border ${s.cls} transition-all`;
  }

  // ─── STAFF (เจ้าหน้าที่: ช่างซ่อม + ผู้ส่งซ่อม) ──────────────────────────────

  window.fetchStaffFromCloud = async function() {
    try {
      const snapshot = await getDocs(collection(db, "staff"));
      const list = [];
      snapshot.forEach(docSnap => list.push(docSnap.data()));
      return list;
    } catch (error) {
      console.error("Error fetching staff:", error);
      return [];
    }
  };

  /**
   * บันทึก/อัปเดตเจ้าหน้าที่ — ใช้ id เป็น Document ID
   * @param {Object} staffData  { id, name, role, dept }
   */
  window.saveStaffToCloud = async function(staffData) {
    try {
      setSyncStatus("saving");
      await setDoc(doc(db, "staff", staffData.id), staffData);
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error("Error saving staff:", error);
      setSyncStatus("error");
      return false;
    }
  };

  /**
   * ลบเจ้าหน้าที่ออกจาก Firestore
   * @param {string} staffId
   */
  window.deleteStaffFromCloud = async function(staffId) {
    try {
      setSyncStatus("saving");
      await deleteDoc(doc(db, "staff", staffId));
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error("Error deleting staff:", error);
      setSyncStatus("error");
      return false;
    }
  };

  window.listenToStaffRealtime = function(onDataUpdate) {
    return onSnapshot(collection(db, "staff"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push(docSnap.data()));
      onDataUpdate(list);
    }, (error) => {
      console.error("Staff realtime listen error:", error);
    });
  };

  window.setSyncStatus = setSyncStatus;

  console.log("เชื่อมต่อฐานข้อมูล Cloud Firestore สำเร็จ (Modular v9)");

  // เริ่มต้นการซิงค์ข้อมูลหลังจากโหลด Firebase เสร็จสิ้น
  if (typeof window.startFirebaseSync === 'function') {
    window.startFirebaseSync();
  }
} catch (e) {
  console.warn("Firebase Init Error:", e);
}

const fs = require('fs');

// 1. Rewrite firebase-config.js
const firebaseConfigContent = `import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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
    onSnapshot(q, (snapshot) => {
      const updatedList = [];
      snapshot.forEach(doc => updatedList.push(doc.data());
      onDataUpdate(updatedList);
    }, (error) => {
      console.error("Realtime listen error:", error);
    });
  };

  console.log("เชื่อมต่อฐานข้อมูล Cloud Firestore สำเร็จ (Modular v9)");

  // เริ่มต้นการซิงค์ข้อมูลหลังจากโหลด Firebase เสร็จสิ้น
  if (typeof window.startFirebaseSync === 'function') {
    window.startFirebaseSync();
  }
} catch (e) {
  console.warn("Firebase Init Error:", e);
}
`;
fs.writeFileSync('firebase-config.js', firebaseConfigContent);
console.log('firebase-config.js updated');

// 2. Patch index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script src=".*?firebase-app\.js"><\/script>\r?\n\s*<script src=".*?firebase-firestore\.js"><\/script>/, '');
html = html.replace(/<script src="firebase-config\.js"><\/script>/, '<script type="module" src="firebase-config.js"></script>');
fs.writeFileSync('index.html', html);
console.log('index.html updated');

// 3. Patch app.js
let appJs = fs.readFileSync('app.js', 'utf8');
// Replace the window.onload logic
const newOnload = `window.onload = function() {
  repairs = loadRepairs();
  equipments = loadEquipments();
  technicians = loadTechnicians();
  updateEquipmentDatalist();
  renderDashboard();
  renderTable();
};

window.startFirebaseSync = async function() {
  console.log("กำลังดึงข้อมูลล่าสุดจาก Firebase...");
  
  if (!window.isFirebaseReady) return;

  const cloudEquips = await window.fetchEquipmentsFromCloud();
  if (cloudEquips.length > 0) {
    equipments = cloudEquips;
    saveEquipments(equipments);
    updateEquipmentDatalist();
  }

  window.listenToRepairsRealtime((cloudRepairs) => {
    if (cloudRepairs.length > 0) {
      repairs = cloudRepairs;
      saveRepairs(repairs);
      renderDashboard();
      renderTable();
      console.log("ข้อมูลอัปเดตล่าสุดจาก Cloud เรียบร้อยแล้ว");
    }
  });
};`;

appJs = appJs.replace(/window\.onload\s*=\s*async function\(\) \{[\s\S]*?^};\n?/m, newOnload);
// Also patch manualSyncFromCloud to use window.fetchRepairsFromCloud
appJs = appJs.replace(/const cloudRepairs = await fetchRepairsFromCloud\(\);/g, 'const cloudRepairs = await window.fetchRepairsFromCloud();');
appJs = appJs.replace(/const cloudEquips = await fetchEquipmentsFromCloud\(\);/g, 'const cloudEquips = await window.fetchEquipmentsFromCloud();');
fs.writeFileSync('app.js', appJs);
console.log('app.js updated');

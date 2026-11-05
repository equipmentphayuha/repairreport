/**
 * js/common/store.js
 * ศูนย์กลางการจัดการข้อมูล Local Storage & Cache กลาง (Unified Store Service)
 * ป้องกันปัญหาคีย์ซ้ำซ้อน สับสนชื่อตัวแปร และลดการอ่าน/แปลง JSON ซ้ำซาก
 */

const KEYS = {
  REPAIRS: 'phayuha_repairs',
  EQUIPMENTS: 'hospital_equipments',
  STAFF: 'phayuha_staff',
  TECHNICIANS: 'phayuha_technicians',
  FIELD_CONFIG: 'field_configurations',
  QR_BASE_URL: 'parcel_qr_base_url'
};

class AppStore {
  constructor() {
    this._cache = {
      repairs: null,
      equipments: null,
      staff: null
    };
  }

  // --- Equipments / ครุภัณฑ์ ---
  getEquipments() {
    if (this._cache.equipments) return this._cache.equipments;
    try {
      const raw = localStorage.getItem(KEYS.EQUIPMENTS) || localStorage.getItem('hospital_equipments_data');
      this._cache.equipments = raw ? JSON.parse(raw) : [];
    } catch (_) {
      this._cache.equipments = [];
    }
    return this._cache.equipments;
  }

  setEquipments(items) {
    this._cache.equipments = items;
    try {
      const json = JSON.stringify(items);
      localStorage.setItem(KEYS.EQUIPMENTS, json);
      // Synchronize secondary key if any legacy module reads it
      localStorage.setItem('hospital_equipments_data', json);
    } catch (e) {
      console.warn('Storage set error:', e);
    }
  }

  // --- Repairs / ใบส่งซ่อม ---
  getRepairs() {
    if (this._cache.repairs) return this._cache.repairs;
    try {
      const raw = localStorage.getItem(KEYS.REPAIRS) || localStorage.getItem('hospital_repairs_data');
      this._cache.repairs = raw ? JSON.parse(raw) : [];
    } catch (_) {
      this._cache.repairs = [];
    }
    return this._cache.repairs;
  }

  setRepairs(repairs) {
    this._cache.repairs = repairs;
    try {
      const json = JSON.stringify(repairs);
      localStorage.setItem(KEYS.REPAIRS, json);
      localStorage.setItem('hospital_repairs_data', json);
    } catch (e) {
      console.warn('Storage set repairs error:', e);
    }
  }

  // --- Staff & Technicians ---
  getStaff() {
    try {
      const raw = localStorage.getItem(KEYS.STAFF);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  setStaff(staffList) {
    try {
      localStorage.setItem(KEYS.STAFF, JSON.stringify(staffList));
    } catch (_) {}
  }

  // Clear memory cache
  invalidateCache() {
    this._cache.repairs = null;
    this._cache.equipments = null;
    this._cache.staff = null;
  }
}

export const store = new AppStore();
if (typeof window !== 'undefined') {
  window.AppStore = store;
}

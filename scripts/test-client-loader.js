import fs from 'node:fs';

const origHtml = fs.readFileSync('_legacy_backup/index.monolithic.backup.html', 'utf8');
const origIds = [...origHtml.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);

// Read all partials
const authHtml = fs.readFileSync('partials/auth/auth-gatekeeper.html', 'utf8');
const headerHtml = fs.readFileSync('partials/layout/header.html', 'utf8');
const chartsHtml = fs.readFileSync('partials/sections/section-charts.html', 'utf8');
const tablesHtml = fs.readFileSync('partials/sections/section-tables.html', 'utf8');
const repairsHtml = fs.readFileSync('partials/sections/section-repairs.html', 'utf8');
const staffHtml = fs.readFileSync('partials/sections/section-staff.html', 'utf8');
const parcelStatsHtml = fs.readFileSync('partials/sections/section-parcel-stats.html', 'utf8');
const inventoryHtml = fs.readFileSync('partials/sections/section-inventory.html', 'utf8');

const modalFiles = [
  'partials/modals/parcel-form-modal.html',
  'partials/modals/config-modal.html',
  'partials/modals/import-modal.html',
  'partials/modals/sync-modal.html',
  'partials/modals/repair-modal.html',
  'partials/modals/staff-modal.html',
  'partials/modals/print-work-order-modal.html',
  'partials/modals/print-executive-report-modal.html',
  'partials/modals/dept-detail-modal.html',
  'partials/modals/export-modal.html',
  'partials/modals/audit-modal.html',
  'partials/modals/admin-users-modals.html',
  'partials/modals/self-profile-modal.html',
  'partials/modals/forgot-password-modal.html',
  'partials/modals/qr-scanner-modal.html',
  'partials/modals/fast-track-repair-modal.html',
  'partials/modals/executive-one-page-modal.html',
  'partials/modals/qr-sticker-modals.html',
  'partials/modals/equipment-passport-modal.html'
];
const modalsHtml = modalFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const combined = [
  authHtml,
  '<div id="appRootContainer">',
  headerHtml,
  chartsHtml,
  tablesHtml,
  repairsHtml,
  staffHtml,
  parcelStatsHtml,
  inventoryHtml,
  modalsHtml,
  '<datalist id="equipmentsDatalist"></datalist>',
  '<datalist id="divDatalist"></datalist>',
  '<datalist id="requesterDatalist"></datalist>',
  '</div>'
].join('\n');

const combinedIds = [...combined.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);

console.log('Original IDs count: ', origIds.length);
console.log('Combined IDs count: ', combinedIds.length);

const missing = origIds.filter(id => !combinedIds.includes(id));
if (missing.length > 0) {
  console.error('Missing IDs:', missing);
  process.exit(1);
} else {
  console.log('SUCCESS: All 397 element IDs are accounted for!');
}

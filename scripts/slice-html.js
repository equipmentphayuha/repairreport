import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split(/\r?\n/);

// Helper to extract line ranges (1-indexed inclusive)
function getSlice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// Ensure directories exist
const dirs = ['partials/auth', 'partials/layout', 'partials/sections', 'partials/modals'];
for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
}

// Define parts with exact line boundaries
const parts = [
  { file: 'partials/auth/auth-gatekeeper.html', start: 52, end: 208 },
  { file: 'partials/layout/header.html', start: 211, end: 341 },
  { file: 'partials/sections/section-charts.html', start: 344, end: 530 },
  { file: 'partials/sections/section-tables.html', start: 531, end: 698 },
  { file: 'partials/sections/section-repairs.html', start: 699, end: 812 },
  { file: 'partials/sections/section-staff.html', start: 813, end: 993 },
  { file: 'partials/sections/section-parcel-stats.html', start: 994, end: 1139 },

  // Inventory & its internal modals
  { file: 'partials/modals/parcel-form-modal.html', start: 1298, end: 1361 },
  { file: 'partials/modals/config-modal.html', start: 1362, end: 1459 },
  { file: 'partials/modals/import-modal.html', start: 1460, end: 1567 },
  { file: 'partials/modals/sync-modal.html', start: 1568, end: 1598 },

  // Global modals
  { file: 'partials/modals/repair-modal.html', start: 1608, end: 1771 },
  { file: 'partials/modals/staff-modal.html', start: 1772, end: 1807 },
  { file: 'partials/modals/print-work-order-modal.html', start: 1808, end: 1839 },
  { file: 'partials/modals/print-executive-report-modal.html', start: 1840, end: 1868 },
  { file: 'partials/modals/dept-detail-modal.html', start: 1869, end: 1910 },
  { file: 'partials/modals/export-modal.html', start: 1911, end: 2035 },
  { file: 'partials/modals/audit-modal.html', start: 2036, end: 2070 },
  { file: 'partials/modals/admin-users-modals.html', start: 2071, end: 2258 },
  { file: 'partials/modals/self-profile-modal.html', start: 2259, end: 2296 },
  { file: 'partials/modals/forgot-password-modal.html', start: 2297, end: 2325 },
  { file: 'partials/modals/qr-scanner-modal.html', start: 2326, end: 2370 },
  { file: 'partials/modals/fast-track-repair-modal.html', start: 2371, end: 2474 },
  { file: 'partials/modals/executive-one-page-modal.html', start: 2475, end: 2592 },
  { file: 'partials/modals/qr-sticker-modals.html', start: 2593, end: 2743 },
  { file: 'partials/modals/equipment-passport-modal.html', start: 2744, end: 2871 },
];

// Write individual partials
for (const p of parts) {
  const content = getSlice(p.start, p.end);
  fs.writeFileSync(p.file, content, 'utf8');
}

// Section inventory content is lines 1140 to 1297 plus includes for its 4 modals + 1599 to 1601
const sectionInventoryContent = [
  getSlice(1140, 1297),
  '    <!-- #include "partials/modals/parcel-form-modal.html" -->',
  '    <!-- #include "partials/modals/config-modal.html" -->',
  '    <!-- #include "partials/modals/import-modal.html" -->',
  '    <!-- #include "partials/modals/sync-modal.html" -->',
  getSlice(1599, 1601)
].join('\n');
fs.writeFileSync('partials/sections/section-inventory.html', sectionInventoryContent, 'utf8');

// Now construct the modular index.html
const modularHtml = [
  getSlice(1, 51),
  '  <!-- #include "partials/auth/auth-gatekeeper.html" -->',
  '',
  getSlice(209, 210), // <div id="appRootContainer" style="display: none;">
  '  <!-- #include "partials/layout/header.html" -->',
  '',
  getSlice(342, 343), // <main class="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
  '    <!-- #include "partials/sections/section-charts.html" -->',
  '    <!-- #include "partials/sections/section-tables.html" -->',
  '    <!-- #include "partials/sections/section-repairs.html" -->',
  '    <!-- #include "partials/sections/section-staff.html" -->',
  '    <!-- #include "partials/sections/section-parcel-stats.html" -->',
  '    <!-- #include "partials/sections/section-inventory.html" -->',
  getSlice(1602, 1607), // </main> and datalists
  '',
  '  <!-- ================= Application Modals ================= -->',
  '  <!-- #include "partials/modals/repair-modal.html" -->',
  '  <!-- #include "partials/modals/staff-modal.html" -->',
  '  <!-- #include "partials/modals/print-work-order-modal.html" -->',
  '  <!-- #include "partials/modals/print-executive-report-modal.html" -->',
  '  <!-- #include "partials/modals/dept-detail-modal.html" -->',
  '  <!-- #include "partials/modals/export-modal.html" -->',
  '  <!-- #include "partials/modals/audit-modal.html" -->',
  '  <!-- #include "partials/modals/admin-users-modals.html" -->',
  '  <!-- #include "partials/modals/self-profile-modal.html" -->',
  '  <!-- #include "partials/modals/forgot-password-modal.html" -->',
  '  <!-- #include "partials/modals/qr-scanner-modal.html" -->',
  '  <!-- #include "partials/modals/fast-track-repair-modal.html" -->',
  '  <!-- #include "partials/modals/executive-one-page-modal.html" -->',
  '  <!-- #include "partials/modals/qr-sticker-modals.html" -->',
  '  <!-- #include "partials/modals/equipment-passport-modal.html" -->',
  '',
  getSlice(2872, 2888)
].join('\n');

fs.writeFileSync('index.modular.html', modularHtml, 'utf8');
console.log('Successfully generated partials and index.modular.html');

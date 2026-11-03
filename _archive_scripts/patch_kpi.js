const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const kpiHtml = `      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <!-- Card 1 -->
        <div class="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl shadow-lg text-white">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-indigo-100 font-medium">รายการส่งซ่อมทั้งหมด</p>
              <p id="kpi-total-repairs" class="text-3xl font-bold mt-1">0 ครั้ง</p>
            </div>
            <div class="bg-white/20 p-2.5 rounded-xl">
              <span class="text-2xl">📋</span>
            </div>
          </div>
          <div class="mt-4 text-xs bg-white/10 inline-block px-2.5 py-1 rounded-lg backdrop-blur-sm" id="kpi-repair-status-sub">
            เสร็จสิ้น 0 | กำลังซ่อม 0
          </div>
          <div class="absolute -bottom-4 -right-4 opacity-10 text-8xl">⚙️</div>
        </div>

        <!-- Card 2 -->
        <div class="relative overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-600 p-5 rounded-2xl shadow-lg text-white">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-emerald-100 font-medium">ค่าใช้จ่ายสะสมรวม</p>
              <p id="kpi-total-cost" class="text-3xl font-bold mt-1">0 บาท</p>
            </div>
            <div class="bg-white/20 p-2.5 rounded-xl">
              <span class="text-2xl">💰</span>
            </div>
          </div>
          <div class="mt-4 text-xs bg-white/10 inline-block px-2.5 py-1 rounded-lg backdrop-blur-sm">
            งบประมาณซ่อมบำรุงสะสม
          </div>
          <div class="absolute -bottom-4 -right-4 opacity-10 text-8xl">฿</div>
        </div>

        <!-- Card 3 -->
        <div class="relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 p-5 rounded-2xl shadow-lg text-white">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-amber-100 font-medium">แผนกส่งซ่อมสูงสุด</p>
              <p id="kpi-top-dept" class="text-xl font-bold mt-1 truncate max-w-[140px]">-</p>
            </div>
            <div class="bg-white/20 p-2.5 rounded-xl">
              <span class="text-2xl">🏥</span>
            </div>
          </div>
          <div class="mt-4 text-xs bg-white/10 inline-block px-2.5 py-1 rounded-lg backdrop-blur-sm" id="kpi-top-dept-sub">
            0 ครั้ง (0 บาท)
          </div>
          <div class="absolute -bottom-4 -right-4 opacity-10 text-8xl">🏆</div>
        </div>

        <!-- Card 4 -->
        <div class="relative overflow-hidden bg-gradient-to-br from-sky-400 to-blue-600 p-5 rounded-2xl shadow-lg text-white">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-sky-100 font-medium">ครุภัณฑ์ใช้งบสูงสุด</p>
              <p id="kpi-top-equip" class="text-xl font-bold mt-1 truncate max-w-[140px]">-</p>
            </div>
            <div class="bg-white/20 p-2.5 rounded-xl">
              <span class="text-2xl">🔧</span>
            </div>
          </div>
          <div class="mt-4 text-xs bg-white/10 inline-block px-2.5 py-1 rounded-lg backdrop-blur-sm" id="kpi-top-equip-sub">
            งบซ่อม 0 บาท
          </div>
          <div class="absolute -bottom-4 -right-4 opacity-10 text-8xl">📈</div>
        </div>
      </div>`;

html = html.replace(/<!-- KPI Cards -->.*?<\/div>\s*<\/div>\s*<!-- Charts -->/s, kpiHtml + '\n\n      <!-- Charts -->');
fs.writeFileSync('index.html', html);
console.log('KPI Cards redesigned');

const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

const newChartsHtml = `      <!-- Charts -->
      <div class="grid grid-cols-1 gap-6">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-sm font-bold text-slate-700 mb-3">เปรียบเทียบจำนวนครั้งและงบประมาณซ่อมตามช่วงเวลา</h3>
          <div class="relative h-72">
            <canvas id="trendChart"></canvas>
          </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-sm font-bold text-slate-700 mb-3">สัดส่วนค่าใช้จ่ายตามประเภทครุภัณฑ์</h3>
            <div class="relative h-72 w-full">
              <canvas id="categoryChart"></canvas>
            </div>
          </div>
          
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-sm font-bold text-slate-700 mb-3">จำนวนครั้งส่งซ่อมแยกตามแผนก/กลุ่มงาน (Top 10)</h3>
            <div class="relative h-72 w-full">
              <canvas id="deptChart"></canvas>
            </div>
          </div>
        </div>
      </div>`;

html = html.replace(/<!-- Charts -->[\s\S]*?<!-- Export Bar for Tables -->/, newChartsHtml + '\n\n      <!-- Export Bar for Tables -->');
fs.writeFileSync('index.html', html);
console.log('index.html updated with deptChart');


// 2. Update dashboard.js
let appJs = fs.readFileSync('dashboard.js', 'utf8');

// add let deptChartInstance = null;
appJs = appJs.replace(/let categoryChartInstance = null;/, "let categoryChartInstance = null;\nlet deptChartInstance = null;");

// add deptChart logic at the end of renderDashboard
const deptChartLogic = `

  // กราฟจำนวนครั้งแยกตามแผนก (Horizontal Bar)
  const topDepts = cachedSortedDepts.slice(0, 10);
  const deptLabels = topDepts.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);
  const deptCounts = topDepts.map(d => d.count);
  const maxCount = Math.max(...deptCounts, 1); // For scaling

  const ctxDept = document.getElementById('deptChart').getContext('2d');
  if (deptChartInstance) deptChartInstance.destroy();
  
  // Create gradient for bars
  const gradPurple = ctxDept.createLinearGradient(0, 0, 400, 0);
  gradPurple.addColorStop(0, 'rgba(167, 139, 250, 0.8)'); // purple-400
  gradPurple.addColorStop(1, 'rgba(124, 58, 237, 0.8)');  // purple-600

  deptChartInstance = new Chart(ctxDept, {
    type: 'bar',
    data: {
      labels: deptLabels.length > 0 ? deptLabels : ['ยังไม่มีข้อมูล'],
      datasets: [{
        label: 'จำนวนครั้งส่งซ่อม',
        data: deptCounts.length > 0 ? deptCounts : [0],
        backgroundColor: gradPurple,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          titleFont: { family: "'Prompt', sans-serif", size: 13 },
          bodyFont: { family: "'Prompt', sans-serif", size: 12 }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } },
          min: 0,
          max: maxCount + (maxCount * 0.2) // Add some padding to the right
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Prompt', sans-serif", size: 11 } }
        }
      }
    }
  });
} // End of renderDashboard`;

// We need to inject this right before the end of renderDashboard()
appJs = appJs.replace(/    }\n  \}\);\n\}\n\n\/\/ ฟังก์ชันเรนเดอร์ตารางสรุปแบบมี/, deptChartLogic + '\n\n// ฟังก์ชันเรนเดอร์ตารางสรุปแบบมี');
fs.writeFileSync('dashboard.js', appJs);
console.log('dashboard.js updated with deptChart logic');


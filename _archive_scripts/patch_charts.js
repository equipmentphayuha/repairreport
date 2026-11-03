const fs = require('fs');
let s = fs.readFileSync('dashboard.js', 'utf8');

const newChart = `  const ctxTrend = document.getElementById('trendChart').getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();

  // Create Gradients
  const gradBlue = ctxTrend.createLinearGradient(0, 0, 0, 400);
  gradBlue.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // blue-500
  gradBlue.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  const gradGreen = ctxTrend.createLinearGradient(0, 0, 0, 400);
  gradGreen.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // emerald-500
  gradGreen.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  trendChartInstance = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: sortedKeys.length > 0 ? sortedKeys : ['ไม่มีข้อมูล'],
      datasets: [
        {
          label: 'จำนวนครั้งส่งซ่อม (ครั้ง)',
          data: counts,
          borderColor: '#10b981', // emerald-500
          backgroundColor: gradGreen,
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#10b981',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          yAxisID: 'yCount',
          order: 2
        },
        {
          label: 'ค่าใช้จ่ายรวม (บาท)',
          data: costs,
          borderColor: '#3b82f6', // blue-500
          backgroundColor: gradBlue,
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          yAxisID: 'yCost',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Prompt', sans-serif" } }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          titleFont: { family: "'Prompt', sans-serif", size: 13 },
          bodyFont: { family: "'Prompt', sans-serif", size: 12 }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Prompt', sans-serif" } }
        },
        yCount: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'จำนวนครั้ง', font: { family: "'Prompt', sans-serif" } },
          beginAtZero: true,
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { stepSize: 1, font: { family: "'Prompt', sans-serif" } }
        },
        yCost: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'ค่าใช้จ่าย (บาท)', font: { family: "'Prompt', sans-serif" } },
          beginAtZero: true,
          grid: { display: false, drawBorder: false },
          ticks: { font: { family: "'Prompt', sans-serif" } }
        }
      }
    }
  });`;

s = s.replace(/const ctxTrend = document\.getElementById\('trendChart'\)\.getContext\('2d'\);[\s\S]*?trendChartInstance = new Chart\([\s\S]*?\}\);/m, newChart);

// Also let's update categoryChart to be cleaner without borders, like the picture
const newCatChart = `
  const ctxCat = document.getElementById('categoryChart').getContext('2d');
  if (categoryChartInstance) categoryChartInstance.destroy();

  categoryChartInstance = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: catLabels.length > 0 ? catLabels : ['ไม่มีข้อมูล'],
      datasets: [{
        data: catValues.length > 0 ? catValues : [1],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: { 
        legend: { 
          position: 'right',
          labels: { usePointStyle: true, boxWidth: 8, padding: 15, font: { family: "'Prompt', sans-serif", size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          usePointStyle: true
        }
      }
    }
  });`;

s = s.replace(/const ctxCat = document\.getElementById\('categoryChart'\)\.getContext\('2d'\);[\s\S]*?categoryChartInstance = new Chart\([\s\S]*?\}\);/m, newCatChart);

fs.writeFileSync('dashboard.js', s);
console.log('Dashboard charts updated to look like reference');

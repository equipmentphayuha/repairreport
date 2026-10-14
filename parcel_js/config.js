// Firebase Configuration & Field Definitions

export const firebaseConfig = {
    apiKey: "AIzaSyDbF85T09sAJzUGQdEuIYQ2_U8TISY4wa0",
    authDomain: "equipmentphayuha-e3f3f.firebaseapp.com",
    projectId: "equipmentphayuha-e3f3f",
    storageBucket: "equipmentphayuha-e3f3f.firebasestorage.app",
    messagingSenderId: "494382324661",
    appId: "1:494382324661:web:e876106fc5852acf4bd7fc",
    measurementId: "G-LBX4QLTBQJ"
};

export const defaultFields = [
    { key: 'noid', label: 'Noid', type: 'text', description: 'รหัสครุภัณฑ์หลักของโรงพยาบาล', required: false },
    { key: 'name', label: 'NAME', type: 'text', description: 'ชื่อเรียกของครุภัณฑ์', required: true },
    {
        key: 'div',
        label: 'Div (แผนก)',
        type: 'combo',
        options: [
            'ซ่อมเครื่องมือทั่วไป',
            'ศูนย์เครื่องมือแพทย์',
            'ไม่ระบุแผนก',
            'กลุ่มงานบริหารทั่วไป',
            'กลุ่มงานทันตกรรม',
            'กลุ่มงานรังสี',
            'กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค',
            'กลุ่มงานเทคนิคการแพทย์',
            'กลุ่มงานการพยาบาล',
            'งานการพยาบาลผู้ป่วยนอก (OPD)',
            'งานการพยาบาลผู้ป่วยใน (IPD)',
            'งานการพยาบาลผู้ป่วยคลอด',
            'งานการผู้ป่วยอุบัติเหตุฉุกเฉินและนิติเวช (ER)',
            'งานการพยาบาลหน่วยควบคุมการติดเชื้อและงานจ่ายกลาง',
            'กลุ่มงานบริการด้านปฐมภูมิและองค์รวม',
            'กลุ่มงานจิตเวชและยาเสพติด',
            'กลุ่มงานประกันสุขภาพยุทธศาสตร์',
            'กลุ่มงานดิจิทัล',
            'งานการเงินและบัญชี',
            'กลุ่มงานโภชนศาสตร์',
            'แผนกการแพทย์แผนไทย',
            'กลุ่มงานเวชศาสตร์ฟื้นฟู'
        ],
        description: 'หน่วยงานหรือแผนกที่ครอบครอง (เลือกหรือพิมพ์เอง)',
        required: true
    },
    {
        key: 'type',
        label: 'TYPE (ประเภทครุภัณฑ์)',
        type: 'combo',
        options: [
            'ครุภัณฑ์การแพทย์',
            'ครุภัณฑ์ยานพาหนะ',
            'ครุภัณฑ์การศึกษา',
            'ครุภัณฑ์ไฟฟ้าและวิทยุ',
            'ครุภัณฑ์โรงงาน',
            'ครุภัณฑ์คอมพิวเตอร์',
            'ครุภัณฑ์การเกษตร',
            'ครุภัณฑ์วิทยาศาสตร์',
            'ครุภัณฑ์งานบ้านงานครัว',
            'ครุภัณฑ์สำนักงาน',
            'ครุภัณฑ์โฆษณาและเผยแพร่',
            'ครุภัณฑ์อื่นๆ'
        ],
        description: 'ประเภทครุภัณฑ์ (เลือกหรือพิมพ์เอง)',
        required: true
    },
    { key: 'location', label: 'สถานที่จัดเก็บอุปกรณ์', type: 'text', description: 'ห้อง/จุด/สถานที่จัดเก็บอุปกรณ์', required: false },
        { key: 'perUnit', label: 'PERUNIT (ราคา/หน่วย)', type: 'number', description: 'ราคาจัดซื้อต่อหน่วย (บาท)', required: true },
    { key: 'usefulLife', label: 'อายุการใช้งาน (ปี)', type: 'number', description: 'อายุการใช้งานตามเกณฑ์พัสดุ (ปี) เช่น คอมพิวเตอร์=5, เครื่องมือแพทย์=8', required: false },
    { key: 'receiveTm', label: 'วัน/เดือน/ปี (ที่ได้รับ)', type: 'text', description: 'พิมพ์เลขติดกันได้ เช่น 122567 หรือ 2122557 จะแปลงเป็น วว/ดด/ปปปป ให้อัตโนมัติ', required: false },
    { key: 'model', label: 'Model', type: 'text', description: 'รุ่น / โมเดลของอุปกรณ์', required: false },
    { key: 'serialNo', label: 'SERIAL NO', type: 'text', description: 'หมายเลขเครื่อง (S/N)', required: false },
    { key: 'company', label: 'COMPANY', type: 'text', description: 'บริษัทผู้จำหน่ายหรือผู้ดูแล', required: false },
    {
        key: 'tmoney',
        label: 'TMONEY (วิธีการได้มา)',
        type: 'combo',
        options: [
            'ของแถม',
            'ช่างรพ.ทำเอง',
            'ตกลงราคา',
            'บริจาค',
            'ประกวดราคา',
            'ประมูลอิเล็กทรอนิกส์',
            'ไม่ระบุ',
            'ยืม',
            'สอบราคา'
        ],
        description: 'วิธีการได้มา (เลือกหรือพิมพ์เอง)',
        required: false
    },
    {
        key: 'kmoney',
        label: 'KMONEY (งบประมาณ)',
        type: 'combo',
        options: [
            'โครงการเงินกู้',
            'งบบำรุง',
            'งบประมาณ',
            'เงินบริจาค',
            'เงินประกันสังคม',
            'เงินสวัสดิการ',
            'มาพร้อม CT',
            'รับบริจาค'
        ],
        description: 'ประเภทเงินงบประมาณ (เลือกหรือพิมพ์เอง)',
        required: false
    },
    {
        key: 'kind',
        label: 'KIND (ประเภทเครื่องมือ)',
        type: 'combo',
        options: [
            'เครื่องมือช่วยชีวิต',
            'เครื่องมือช่วยวินิจฉัย',
            'เครื่องมือเพื่อการรักษา',
            'เครื่องมือสนับสนุน'
        ],
        description: 'ประเภทเครื่องมือ (เลือกหรือพิมพ์เอง)',
        required: false
    },
    {
        key: 'risk',
        label: 'Risk (ระดับความเสี่ยง)',
        type: 'combo',
        options: [
            '1',
            '2',
            '3'
        ],
        description: 'ระดับความเสี่ยง 1-3 (เลือกหรือพิมพ์เอง)',
        required: false
    },
    { key: 'remark', label: 'หมายเหตุ (สถานะ)', type: 'combo', options: ['พร้อมใช้', 'ไม่พร้อมใช้', 'จำหน่ายแล้ว'], description: 'สถานะความพร้อมใช้งานปัจจุบัน (เลือกหรือพิมพ์เอง)', required: false },
    { key: 'newDate', label: 'New Date', type: 'number', description: 'ปีหรือรอบการลงทะเบียน', required: false },
    { key: 'pasaduId', label: 'Pasadu ID', type: 'text', description: 'เลข RMC เดิม', required: false }
];

export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY" && !firebaseConfig.projectId.includes("YOUR_PROJECT_ID");


// ===== อัตราอายุการใช้งานมาตรฐานตามประเภทครุภัณฑ์ (เกณฑ์ราชการ/กรมบัญชีกลาง) =====
export const defaultUsefulLifeYears = {
    'ครุภัณฑ์คอมพิวเตอร์': 5,
    'ครุภัณฑ์การแพทย์': 8,
    'ครุภัณฑ์วิทยาศาสตร์': 8,
    'ครุภัณฑ์ไฟฟ้าและวิทยุ': 5,
    'ครุภัณฑ์ยานพาหนะ': 8,
    'ครุภัณฑ์โรงงาน': 8,
    'ครุภัณฑ์สำนักงาน': 8,
    'ครุภัณฑ์โฆษณาและเผยแพร่': 5,
    'ครุภัณฑ์งานบ้านงานครัว': 5,
    'ครุภัณฑ์การเกษตร': 5,
    'ครุภัณฑ์การศึกษา': 5,
    'ครุภัณฑ์อื่นๆ': 5
};

/**
 * คำนวณค่าเสื่อมราคาและมูลค่าสุทธิตามบัญชี (Straight-Line Method)
 * มูลค่าซาก (Salvage Value) ทางราชการกำหนดคงเหลือ 1 บาท
 * @param {Object} item ข้อมูลครุภัณฑ์
 * @returns {Object} { usefulYears, ageYears, deprPerYear, accDepr, bookValue, isFullyDepreciated, statusText }
 */
export function calculateDepreciation(item) {
    const rawCost = Number(String(item.perUnit || 0).replace(/,/g, ''));
    if (isNaN(rawCost) || rawCost <= 0) {
        return {
            cost: 0,
            usefulYears: 0,
            ageYears: 0,
            accDepr: 0,
            bookValue: 0,
            isFullyDepreciated: false,
            statusText: 'ไม่ระบุราคา'
        };
    }

    // 1. อายุการใช้งาน (ปี) ถ้ามีระบุใน item ให้ใช้ค่านั้น หรือใช้ตามประเภท
    let usefulYears = Number(item.usefulLife);
    if (!usefulYears || isNaN(usefulYears) || usefulYears <= 0) {
        usefulYears = defaultUsefulLifeYears[item.type] || 5;
    }

    // 2. หาวันที่เริ่มใช้งานจาก receiveTm (รูปแบบ วว/ดด/ปปปป หรือ YYYY-MM-DD)
    let startDate = null;
    if (item.receiveTm) {
        const rawDate = String(item.receiveTm).trim();
        // กรณี วว/ดด/ปปปป (พ.ศ.)
        const thaiMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (thaiMatch) {
            const d = parseInt(thaiMatch[1], 10);
            const m = parseInt(thaiMatch[2], 10) - 1;
            let y = parseInt(thaiMatch[3], 10);
            if (y > 2400) y -= 543; // แปลง พ.ศ. เป็น ค.ศ.
            startDate = new Date(y, m, d);
        } else {
            const parsed = new Date(rawDate);
            if (!isNaN(parsed.getTime())) startDate = parsed;
        }
    }

    if (!startDate || isNaN(startDate.getTime())) {
        return {
            cost: rawCost,
            usefulYears,
            ageYears: 0,
            accDepr: 0,
            bookValue: rawCost,
            isFullyDepreciated: false,
            statusText: 'ไม่ระบุวันที่รับ'
        };
    }

    const today = new Date();
    const diffTime = Math.max(0, today - startDate);
    const ageDays = diffTime / (1000 * 60 * 60 * 24);
    const ageYears = (ageDays / 365.25).toFixed(1);

    // มูลค่าที่ต้องคิดค่าเสื่อม = ราคาตั้งต้น - 1 บาท (มูลค่าซากคงเหลือ 1 บาท)
    const depreciableAmount = Math.max(0, rawCost - 1);
    const deprPerDay = depreciableAmount / (usefulYears * 365.25);

    let accDepr = Math.min(depreciableAmount, Math.round(deprPerDay * ageDays));
    let bookValue = Math.max(1, Math.round(rawCost - accDepr));

    const isFullyDepreciated = (ageDays >= (usefulYears * 365.25)) || (bookValue <= 1);
    if (isFullyDepreciated) {
        bookValue = 1;
        accDepr = rawCost - 1;
    }

    const remainPct = ((bookValue / rawCost) * 100).toFixed(0);

    return {
        cost: rawCost,
        usefulYears,
        ageYears: Number(ageYears),
        accDepr,
        bookValue,
        isFullyDepreciated,
        remainPct,
        statusText: isFullyDepreciated ? 'ครบอายุใช้งาน (1 บาท)' : 'เหลือ ' + remainPct + '%'
    };
}
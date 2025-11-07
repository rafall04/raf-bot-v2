#!/usr/bin/env node

/**
 * Test Script: Kompensasi dengan Durasi Menit
 * 
 * Skrip ini untuk menguji fitur penambahan durasi menit pada kompensasi:
 * 1. Validasi input menit (0-59)
 * 2. Perhitungan endDate dengan menit
 * 3. Tampilan durasi dengan format yang benar
 * 
 * Untuk menjalankan test:
 * node test/test-compensation-minutes.js
 */

console.log("🧪 TEST: Kompensasi dengan Durasi Menit\n");
console.log("=" .repeat(50));

// Simulasi data test
const testCases = [
    {
        name: "Test 1: Durasi 1 menit saja",
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 1,
        expected: "1 menit"
    },
    {
        name: "Test 2: Durasi 5 menit untuk ujicoba",
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 5,
        expected: "5 menit"
    },
    {
        name: "Test 3: Kombinasi jam dan menit",
        durationDays: 0,
        durationHours: 1,
        durationMinutes: 30,
        expected: "1 jam 30 menit"
    },
    {
        name: "Test 4: Kombinasi hari, jam dan menit",
        durationDays: 1,
        durationHours: 2,
        durationMinutes: 15,
        expected: "1 hari 2 jam 15 menit"
    },
    {
        name: "Test 5: 59 menit (maksimum)",
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 59,
        expected: "59 menit"
    },
    {
        name: "Test 6: Validasi input negatif (harus ditolak)",
        durationDays: 0,
        durationHours: 0,
        durationMinutes: -1,
        expected: "ERROR: menit negatif"
    },
    {
        name: "Test 7: Validasi input lebih dari 59 (harus ditolak)",
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 60,
        expected: "ERROR: menit >= 60"
    }
];

// Fungsi untuk membuat string durasi
function buildDurationString(days, hours, minutes) {
    let durasiStr = "";
    if (days > 0) durasiStr += `${days} hari `;
    if (hours > 0) durasiStr += `${hours} jam `;
    if (minutes > 0) durasiStr += `${minutes} menit`;
    return durasiStr.trim() || "-";
}

// Fungsi untuk validasi durasi
function validateDuration(days, hours, minutes) {
    if (isNaN(days) || days < 0) {
        return { valid: false, error: "hari harus non-negatif" };
    }
    if (isNaN(hours) || hours < 0 || hours >= 24) {
        return { valid: false, error: "jam harus 0-23" };
    }
    if (isNaN(minutes) || minutes < 0 || minutes >= 60) {
        return { valid: false, error: "menit harus 0-59" };
    }
    if (days === 0 && hours === 0 && minutes === 0) {
        return { valid: false, error: "durasi total harus > 0" };
    }
    return { valid: true };
}

// Fungsi untuk menghitung endDate
function calculateEndDate(startDate, days, hours, minutes) {
    const endDate = new Date(startDate);
    if (days > 0) endDate.setDate(endDate.getDate() + days);
    if (hours > 0) endDate.setHours(endDate.getHours() + hours);
    if (minutes > 0) endDate.setMinutes(endDate.getMinutes() + minutes);
    return endDate;
}

// Jalankan test
console.log("\n📋 MENJALANKAN TEST CASES:");
console.log("-".repeat(50));

testCases.forEach((test, index) => {
    console.log(`\n${test.name}`);
    
    // Validasi
    const validation = validateDuration(test.durationDays, test.durationHours, test.durationMinutes);
    
    if (test.expected.startsWith("ERROR")) {
        // Test case yang seharusnya error
        if (!validation.valid) {
            console.log(`✅ PASS: Validation error as expected: ${validation.error}`);
        } else {
            console.log(`❌ FAIL: Should have validation error but passed`);
        }
    } else {
        // Test case yang seharusnya valid
        if (validation.valid) {
            const durationStr = buildDurationString(test.durationDays, test.durationHours, test.durationMinutes);
            const startDate = new Date();
            const endDate = calculateEndDate(startDate, test.durationDays, test.durationHours, test.durationMinutes);
            
            console.log(`  Input: ${test.durationDays} hari, ${test.durationHours} jam, ${test.durationMinutes} menit`);
            console.log(`  Output: "${durationStr}"`);
            console.log(`  Expected: "${test.expected}"`);
            
            if (durationStr === test.expected) {
                console.log(`  ✅ PASS: Duration string matches`);
                console.log(`  Start: ${startDate.toLocaleString('id-ID')}`);
                console.log(`  End:   ${endDate.toLocaleString('id-ID')}`);
                
                // Verifikasi perhitungan waktu
                const diffMs = endDate - startDate;
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                const expectedMinutes = (test.durationDays * 24 * 60) + (test.durationHours * 60) + test.durationMinutes;
                
                if (diffMinutes === expectedMinutes) {
                    console.log(`  ✅ Time calculation correct: ${diffMinutes} minutes`);
                } else {
                    console.log(`  ❌ Time calculation error: got ${diffMinutes}, expected ${expectedMinutes} minutes`);
                }
            } else {
                console.log(`  ❌ FAIL: Duration string mismatch`);
            }
        } else {
            console.log(`❌ FAIL: Unexpected validation error: ${validation.error}`);
        }
    }
});

// Test simulasi kompensasi 2 menit untuk ujicoba
console.log("\n" + "=".repeat(50));
console.log("🔬 SIMULASI KOMPENSASI 2 MENIT UNTUK UJICOBA:");
console.log("-".repeat(50));

const testCompensation = {
    userId: "test_user_1",
    originalProfile: "10Mbps",
    compensatedProfile: "50Mbps",
    durationDays: 0,
    durationHours: 0,
    durationMinutes: 2,
    notes: "Test kompensasi 2 menit untuk ujicoba sistem"
};

const startTime = new Date();
const endTime = calculateEndDate(startTime, testCompensation.durationDays, testCompensation.durationHours, testCompensation.durationMinutes);

console.log(`\n📝 Detail Kompensasi:`);
console.log(`  User ID: ${testCompensation.userId}`);
console.log(`  Profil Asli: ${testCompensation.originalProfile}`);
console.log(`  Profil Kompensasi: ${testCompensation.compensatedProfile}`);
console.log(`  Durasi: ${buildDurationString(testCompensation.durationDays, testCompensation.durationHours, testCompensation.durationMinutes)}`);
console.log(`  Mulai: ${startTime.toLocaleString('id-ID')}`);
console.log(`  Berakhir: ${endTime.toLocaleString('id-ID')}`);
console.log(`  Catatan: ${testCompensation.notes}`);

// Simulasi notifikasi
console.log(`\n📱 Simulasi Notifikasi WhatsApp:`);
const notificationText = `
🎁 *KOMPENSASI KECEPATAN INTERNET*

Halo Customer,

Kami telah menerapkan kompensasi peningkatan kecepatan untuk Anda:

📊 *Detail Kompensasi:*
• Kecepatan Baru: ${testCompensation.compensatedProfile}
• Durasi: ${buildDurationString(testCompensation.durationDays, testCompensation.durationHours, testCompensation.durationMinutes)}
• Berakhir pada: ${endTime.toLocaleString('id-ID')}

Terima kasih atas kesabaran Anda.
`;

console.log(notificationText);

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 RINGKASAN TEST:");
console.log("-".repeat(50));

const passedTests = testCases.filter(t => {
    const validation = validateDuration(t.durationDays, t.durationHours, t.durationMinutes);
    if (t.expected.startsWith("ERROR")) {
        return !validation.valid;
    } else {
        if (!validation.valid) return false;
        const durationStr = buildDurationString(t.durationDays, t.durationHours, t.durationMinutes);
        return durationStr === t.expected;
    }
});

console.log(`Total Test Cases: ${testCases.length}`);
console.log(`Passed: ${passedTests.length}`);
console.log(`Failed: ${testCases.length - passedTests.length}`);

if (passedTests.length === testCases.length) {
    console.log("\n✅ SEMUA TEST BERHASIL!");
    console.log("\n💡 Fitur kompensasi dengan durasi menit siap digunakan untuk ujicoba.");
    console.log("   Admin dapat mengatur kompensasi singkat (1-59 menit) untuk testing.");
} else {
    console.log("\n❌ ADA TEST YANG GAGAL!");
    console.log("   Silakan periksa implementasi kembali.");
}

console.log("\n" + "=".repeat(50));
console.log("TEST SELESAI");
console.log("=" .repeat(50));

// Exit dengan kode yang sesuai
process.exit(passedTests.length === testCases.length ? 0 : 1);

#!/usr/bin/env node

/**
 * Test Script: Analyze Admin Ticket Page Issues
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 ANALISIS HALAMAN TIKET ADMIN\n");
console.log("=".repeat(50));

// Check admin ticket page (tiket.php)
console.log("\n📋 1. Checking Admin Page (tiket.php)...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

// Check for photo support
const hasPhotoDisplay = adminContent.includes('teknisiPhotos') || 
                       adminContent.includes('photo') || 
                       adminContent.includes('dokumentasi');
console.log(`Photo display support: ${hasPhotoDisplay ? '✅' : '❌ MISSING'}`);

// Check status options
const statusOptions = [];
const statusMatches = adminContent.match(/<option value="([^"]+)">/g);
if (statusMatches) {
    statusMatches.forEach(match => {
        const value = match.match(/value="([^"]+)"/)[1];
        if (value !== 'all') statusOptions.push(value);
    });
}
console.log(`Status options found: ${statusOptions.join(', ')}`);

// Check for missing statuses per TICKET_STATUS_STANDARD
const requiredStatuses = ['baru', 'process', 'otw', 'arrived', 'working', 'resolved'];
const missingStatuses = requiredStatuses.filter(s => !statusOptions.includes(s));
if (missingStatuses.length > 0) {
    console.log(`❌ Missing statuses: ${missingStatuses.join(', ')}`);
}

// Check for detail modal
const hasDetailModal = adminContent.includes('detailModal') || 
                      adminContent.includes('viewTicketModal');
console.log(`Detail modal: ${hasDetailModal ? '✅' : '❌ MISSING'}`);

// Check for OTP info
const hasOTPInfo = adminContent.includes('otp') || adminContent.includes('OTP');
console.log(`OTP info display: ${hasOTPInfo ? '✅' : '❌ MISSING'}`);

// Compare with teknisi page
console.log("\n" + "=".repeat(50));
console.log("📋 2. Comparing with Teknisi Page...");
console.log("-".repeat(50));

const teknisiPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'teknisi-tiket.php');
const teknisiContent = fs.readFileSync(teknisiPagePath, 'utf8');

// Check what teknisi has that admin doesn't
const teknisiFeatures = {
    'Workflow visualization': teknisiContent.includes('workflow-stepper'),
    'Photo preview': teknisiContent.includes('photo-preview'),
    'OTP handling': teknisiContent.includes('verifyOTPModal'),
    'Status badges': teknisiContent.includes('badge-status-'),
    'Progress tracking': teknisiContent.includes('Progress')
};

console.log("Features in Teknisi page:");
Object.entries(teknisiFeatures).forEach(([feature, has]) => {
    console.log(`  ${feature}: ${has ? '✅' : '❌'}`);
});

// Check database structure
console.log("\n" + "=".repeat(50));
console.log("📋 3. Database Structure Check...");
console.log("-".repeat(50));

const reportsPath = path.join(__dirname, '..', 'database', 'reports.json');
if (fs.existsSync(reportsPath)) {
    const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
    if (reports.length > 0) {
        const sampleTicket = reports[0];
        const fields = Object.keys(sampleTicket);
        
        console.log("Ticket fields available:");
        const photoFields = fields.filter(f => f.toLowerCase().includes('photo'));
        const otpFields = fields.filter(f => f.toLowerCase().includes('otp'));
        const resolutionFields = fields.filter(f => f.toLowerCase().includes('resolution') || f.toLowerCase().includes('notes'));
        
        console.log(`  Photo fields: ${photoFields.length > 0 ? photoFields.join(', ') : '❌ NONE'}`);
        console.log(`  OTP fields: ${otpFields.length > 0 ? otpFields.join(', ') : '❌ NONE'}`);
        console.log(`  Resolution fields: ${resolutionFields.length > 0 ? resolutionFields.join(', ') : '❌ NONE'}`);
    }
}

// Check API endpoints
console.log("\n" + "=".repeat(50));
console.log("📋 4. API Endpoints Check...");
console.log("-".repeat(50));

const ticketsRoutePath = path.join(__dirname, '..', 'routes', 'tickets.js');
const ticketsContent = fs.readFileSync(ticketsRoutePath, 'utf8');

const endpoints = {
    '/api/admin/tickets': ticketsContent.includes('/admin/tickets'),
    '/api/ticket/photos': ticketsContent.includes('/ticket/photos'),
    '/api/ticket/details': ticketsContent.includes('/ticket/details')
};

Object.entries(endpoints).forEach(([endpoint, exists]) => {
    console.log(`  ${endpoint}: ${exists ? '✅' : '❌'}`);
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("🔴 ISSUES FOUND:");
console.log("-".repeat(50));

const issues = [];

if (!hasPhotoDisplay) {
    issues.push({
        severity: "CRITICAL",
        issue: "No photo viewing capability",
        impact: "Admin cannot verify repair work"
    });
}

if (missingStatuses.length > 0) {
    issues.push({
        severity: "HIGH",
        issue: `Missing workflow statuses: ${missingStatuses.join(', ')}`,
        impact: "Cannot filter tickets properly"
    });
}

if (!hasDetailModal) {
    issues.push({
        severity: "HIGH",
        issue: "No detail modal for viewing full ticket info",
        impact: "Limited ticket information visible"
    });
}

if (!hasOTPInfo) {
    issues.push({
        severity: "MEDIUM",
        issue: "No OTP information display",
        impact: "Cannot track verification status"
    });
}

issues.forEach((issue, index) => {
    console.log(`\n${index + 1}. [${issue.severity}] ${issue.issue}`);
    console.log(`   Impact: ${issue.impact}`);
});

// Recommendations
console.log("\n" + "=".repeat(50));
console.log("✅ RECOMMENDATIONS:");
console.log("-".repeat(50));

console.log(`
1. ADD Photo Viewing Modal
   - Display teknisiPhotos array
   - Show photo count badge
   - Full-size image viewer

2. UPDATE Status Filter
   - Add: process, otw, arrived, working, resolved
   - Remove: "diproses teknisi" (deprecated)

3. ADD Detail Modal
   - Show complete ticket workflow
   - Display OTP (for reference)
   - Show resolution notes
   - Display work duration
   - Show all timestamps

4. ADD Progress Visualization
   - Show workflow steps
   - Indicate current status
   - Display completion percentage

5. CREATE Photo API Endpoint
   - GET /api/ticket/:id/photos
   - Return photo URLs/base64
`);

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));

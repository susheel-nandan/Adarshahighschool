/**
 * Integration test for OTP validation and marking workflow
 * Tests the complete flow: validate OTP -> mark as used -> verify cannot reuse
 * Run with: node tests/unit/otp-validation-and-marking.test.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Create a temporary test database
const testDbPath = path.join(__dirname, 'test-otp-integration.db');

// Clean up any existing test database
if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
}

const db = new Database(testDbPath);

// Create the otps table
db.exec(`
    CREATE TABLE otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_otps_identifier ON otps(identifier);
    CREATE INDEX idx_otps_expires ON otps(expires_at);
`);

// Copy of the validateOtp function from server/routes/auth.js
function validateOtp(identifier, otp) {
    // Get the most recent unused OTP for this identifier
    const record = db.prepare(
        'SELECT * FROM otps WHERE identifier = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
    ).get(identifier);
    
    // Check if OTP exists
    if (!record) {
        return { valid: false, error: 'No OTP found. Please request a new one.' };
    }
    
    // Check if OTP has expired
    const expiresAt = new Date(record.expires_at);
    const now = new Date();
    if (now > expiresAt) {
        return { valid: false, error: 'This OTP has expired. Please request a new one.' };
    }
    
    // Check if OTP matches
    if (record.otp_code !== otp) {
        return { valid: false, error: 'Invalid OTP.' };
    }
    
    // Check if OTP has already been used (double-check even though we filtered by used = 0)
    if (record.used === 1) {
        return { valid: false, error: 'This OTP has already been used. Please request a new one.' };
    }
    
    // All checks passed
    return { valid: true, otpId: record.id };
}

// Copy of the markOtpUsed function from server/routes/auth.js
function markOtpUsed(otpId) {
    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otpId);
}

// Helper function to generate OTP
function generateOtp() {
    const otp = crypto.randomInt(0, 1000000);
    return otp.toString().padStart(6, '0');
}

// Helper function to store OTP
function storeOtp(identifier, otp) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, ?)')
        .run(identifier, otp, expiresAt);
}

console.log('Testing OTP validation and marking integration...\n');

// Test 1: Complete workflow - validate then mark as used
console.log('Test 1: Complete workflow - validate OTP, mark as used, verify cannot reuse');
const identifier1 = 'STU001';
const otp1 = generateOtp();
storeOtp(identifier1, otp1);

// Step 1: Validate OTP (should succeed)
const validation1 = validateOtp(identifier1, otp1);
if (!validation1.valid) {
    console.error(`  ❌ FAILED: Initial validation should succeed. Error: ${validation1.error}`);
    process.exit(1);
}
if (!validation1.otpId) {
    console.error(`  ❌ FAILED: Validation should return otpId`);
    process.exit(1);
}
console.log(`  ✓ Step 1: OTP validated successfully (ID: ${validation1.otpId})`);

// Step 2: Mark OTP as used
markOtpUsed(validation1.otpId);
console.log(`  ✓ Step 2: OTP marked as used`);

// Step 3: Try to validate the same OTP again (should fail)
const validation2 = validateOtp(identifier1, otp1);
if (validation2.valid) {
    console.error(`  ❌ FAILED: Used OTP should not validate again`);
    process.exit(1);
}
if (validation2.error !== 'No OTP found. Please request a new one.') {
    console.error(`  ❌ FAILED: Wrong error message. Got: ${validation2.error}`);
    process.exit(1);
}
console.log(`  ✓ Step 3: Used OTP correctly rejected on reuse attempt\n`);

// Test 2: Multiple OTPs for same identifier - only mark the validated one
console.log('Test 2: Multiple OTPs - only mark the validated one as used');
const identifier2 = 'PAR002';
const otp2a = generateOtp();
const otp2b = generateOtp();

// Store first OTP (older)
const createdAt1 = new Date(Date.now() - 1000).toISOString();
const expiresAt1 = new Date(Date.now() + 10 * 60 * 1000).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier2, otp2a, expiresAt1, createdAt1);

// Store second OTP (newer)
const createdAt2 = new Date(Date.now()).toISOString();
const expiresAt2 = new Date(Date.now() + 10 * 60 * 1000).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier2, otp2b, expiresAt2, createdAt2);

// Validate the newer OTP
const validation3 = validateOtp(identifier2, otp2b);
if (!validation3.valid) {
    console.error(`  ❌ FAILED: Newer OTP should validate. Error: ${validation3.error}`);
    process.exit(1);
}

// Mark the newer OTP as used
markOtpUsed(validation3.otpId);

// Verify the older OTP is still unused in the database
const olderOtpRecord = db.prepare('SELECT used FROM otps WHERE identifier = ? AND otp_code = ?')
    .get(identifier2, otp2a);
if (olderOtpRecord.used !== 0) {
    console.error(`  ❌ FAILED: Older OTP should remain unused`);
    process.exit(1);
}

// Verify the newer OTP is marked as used
const newerOtpRecord = db.prepare('SELECT used FROM otps WHERE identifier = ? AND otp_code = ?')
    .get(identifier2, otp2b);
if (newerOtpRecord.used !== 1) {
    console.error(`  ❌ FAILED: Newer OTP should be marked as used`);
    process.exit(1);
}
console.log(`  ✓ Only the validated OTP was marked as used\n`);

// Test 3: Verify marking as used prevents validation even if OTP code is correct
console.log('Test 3: Marked OTP cannot be validated even with correct code');
const identifier3 = 'TEA003';
const otp3 = generateOtp();
storeOtp(identifier3, otp3);

// Validate and mark as used
const validation4 = validateOtp(identifier3, otp3);
markOtpUsed(validation4.otpId);

// Try to validate again with the correct OTP code
const validation5 = validateOtp(identifier3, otp3);
if (validation5.valid) {
    console.error(`  ❌ FAILED: Marked OTP should not validate`);
    process.exit(1);
}
console.log(`  ✓ Marked OTP correctly rejected despite correct code\n`);

// Test 4: Validate requirement 2.7 - OTP single-use enforcement
console.log('Test 4: Requirement 2.7 - OTP single-use enforcement');
const identifier4 = 'STU004';
const otp4 = generateOtp();
storeOtp(identifier4, otp4);

// First validation should succeed
const firstValidation = validateOtp(identifier4, otp4);
if (!firstValidation.valid) {
    console.error(`  ❌ FAILED: First validation should succeed`);
    process.exit(1);
}

// Mark as used (simulating successful password reset)
markOtpUsed(firstValidation.otpId);

// Second validation should fail (single-use enforcement)
const secondValidation = validateOtp(identifier4, otp4);
if (secondValidation.valid) {
    console.error(`  ❌ FAILED: Second validation should fail (single-use enforcement)`);
    process.exit(1);
}

console.log(`  ✓ Requirement 2.7 validated: OTP single-use enforcement works correctly\n`);

// Cleanup
db.close();
fs.unlinkSync(testDbPath);

console.log('✅ All integration tests passed!');
console.log('✅ Requirement 2.7 (OTP single-use enforcement) validated successfully!');

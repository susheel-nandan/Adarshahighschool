/**
 * Unit test for markOtpUsed function
 * Run with: node tests/unit/otp-usage-marking.test.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Create a temporary test database
const testDbPath = path.join(__dirname, 'test-otp-usage-marking.db');

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
    const result = db.prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, ?)')
        .run(identifier, otp, expiresAt);
    return result.lastInsertRowid;
}

console.log('Testing markOtpUsed function...\n');

// Test 1: markOtpUsed should set used flag to 1
console.log('Test 1: markOtpUsed should set used flag to 1');
const identifier1 = 'STU001';
const otp1 = generateOtp();
const otpId1 = storeOtp(identifier1, otp1);

// Verify OTP is initially unused
const beforeMark = db.prepare('SELECT used FROM otps WHERE id = ?').get(otpId1);
if (beforeMark.used !== 0) {
    console.error(`  ❌ FAILED: OTP should initially be unused (used=0), got used=${beforeMark.used}`);
    process.exit(1);
}

// Mark OTP as used
markOtpUsed(otpId1);

// Verify OTP is now marked as used
const afterMark = db.prepare('SELECT used FROM otps WHERE id = ?').get(otpId1);
if (afterMark.used !== 1) {
    console.error(`  ❌ FAILED: OTP should be marked as used (used=1), got used=${afterMark.used}`);
    process.exit(1);
}
console.log(`  ✓ OTP successfully marked as used\n`);

// Test 2: markOtpUsed should be idempotent (calling it twice should not cause errors)
console.log('Test 2: markOtpUsed should be idempotent');
const identifier2 = 'PAR002';
const otp2 = generateOtp();
const otpId2 = storeOtp(identifier2, otp2);

// Mark OTP as used twice
markOtpUsed(otpId2);
markOtpUsed(otpId2);

// Verify OTP is still marked as used (not 2 or any other value)
const result2 = db.prepare('SELECT used FROM otps WHERE id = ?').get(otpId2);
if (result2.used !== 1) {
    console.error(`  ❌ FAILED: OTP should remain used=1 after multiple calls, got used=${result2.used}`);
    process.exit(1);
}
console.log(`  ✓ markOtpUsed is idempotent\n`);

// Test 3: markOtpUsed should only affect the specified OTP
console.log('Test 3: markOtpUsed should only affect the specified OTP');
const identifier3a = 'TEA003';
const identifier3b = 'TEA004';
const otp3a = generateOtp();
const otp3b = generateOtp();
const otpId3a = storeOtp(identifier3a, otp3a);
const otpId3b = storeOtp(identifier3b, otp3b);

// Mark only the first OTP as used
markOtpUsed(otpId3a);

// Verify first OTP is marked as used
const result3a = db.prepare('SELECT used FROM otps WHERE id = ?').get(otpId3a);
if (result3a.used !== 1) {
    console.error(`  ❌ FAILED: First OTP should be marked as used, got used=${result3a.used}`);
    process.exit(1);
}

// Verify second OTP is still unused
const result3b = db.prepare('SELECT used FROM otps WHERE id = ?').get(otpId3b);
if (result3b.used !== 0) {
    console.error(`  ❌ FAILED: Second OTP should remain unused, got used=${result3b.used}`);
    process.exit(1);
}
console.log(`  ✓ markOtpUsed only affects the specified OTP\n`);

// Test 4: markOtpUsed with non-existent ID should not cause errors
console.log('Test 4: markOtpUsed with non-existent ID should not cause errors');
const nonExistentId = 99999;

try {
    markOtpUsed(nonExistentId);
    console.log(`  ✓ markOtpUsed handles non-existent ID gracefully\n`);
} catch (error) {
    console.error(`  ❌ FAILED: markOtpUsed should not throw error for non-existent ID: ${error.message}`);
    process.exit(1);
}

// Test 5: Verify OTP marked as used cannot be validated
console.log('Test 5: Verify OTP marked as used cannot be validated');
const identifier5 = 'STU005';
const otp5 = generateOtp();
const otpId5 = storeOtp(identifier5, otp5);

// Mark OTP as used
markOtpUsed(otpId5);

// Try to retrieve the OTP as if validating (should not find it because used=0 filter)
const validationQuery = db.prepare(
    'SELECT * FROM otps WHERE identifier = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
).get(identifier5);

if (validationQuery !== undefined) {
    console.error(`  ❌ FAILED: Used OTP should not be retrievable by validation query`);
    process.exit(1);
}
console.log(`  ✓ Used OTP is correctly filtered out from validation queries\n`);

// Cleanup
db.close();
fs.unlinkSync(testDbPath);

console.log('✅ All tests passed!');

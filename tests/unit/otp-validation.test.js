/**
 * Unit test for OTP validation function
 * Run with: node tests/unit/otp-validation.test.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Create a temporary test database
const testDbPath = path.join(__dirname, 'test-otp-validation.db');

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

// Helper function to generate OTP
function generateOtp() {
    const otp = crypto.randomInt(0, 1000000);
    return otp.toString().padStart(6, '0');
}

// Helper function to store OTP
function storeOtp(identifier, otp, expiresInMinutes = 10) {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    db.prepare('DELETE FROM otps WHERE identifier = ?').run(identifier);
    db.prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, ?)')
        .run(identifier, otp, expiresAt);
}

console.log('Testing validateOtp function...\n');

// Test 1: Valid OTP should pass validation
console.log('Test 1: Valid OTP should pass validation');
const identifier1 = 'STU001';
const otp1 = generateOtp();
storeOtp(identifier1, otp1);

const result1 = validateOtp(identifier1, otp1);
if (!result1.valid) {
    console.error(`  ❌ FAILED: Valid OTP rejected. Error: ${result1.error}`);
    process.exit(1);
}
if (result1.error) {
    console.error(`  ❌ FAILED: Valid OTP should not have error message`);
    process.exit(1);
}
if (!result1.otpId) {
    console.error(`  ❌ FAILED: Valid OTP should return otpId`);
    process.exit(1);
}
console.log(`  ✓ Valid OTP accepted: ${otp1} with ID: ${result1.otpId}\n`);

// Test 2: Non-existent OTP should fail with appropriate error
console.log('Test 2: Non-existent OTP should fail with appropriate error');
const identifier2 = 'PAR002';
const result2 = validateOtp(identifier2, '123456');

if (result2.valid) {
    console.error('  ❌ FAILED: Non-existent OTP should be rejected');
    process.exit(1);
}
if (result2.error !== 'No OTP found. Please request a new one.') {
    console.error(`  ❌ FAILED: Wrong error message. Got: ${result2.error}`);
    process.exit(1);
}
console.log(`  ✓ Non-existent OTP rejected with correct error\n`);

// Test 3: Incorrect OTP should fail with appropriate error
console.log('Test 3: Incorrect OTP should fail with appropriate error');
const identifier3 = 'TEA003';
const otp3 = generateOtp();
storeOtp(identifier3, otp3);

const wrongOtp = otp3 === '123456' ? '654321' : '123456';
const result3 = validateOtp(identifier3, wrongOtp);

if (result3.valid) {
    console.error('  ❌ FAILED: Incorrect OTP should be rejected');
    process.exit(1);
}
if (result3.error !== 'Invalid OTP.') {
    console.error(`  ❌ FAILED: Wrong error message. Got: ${result3.error}`);
    process.exit(1);
}
console.log(`  ✓ Incorrect OTP rejected with correct error\n`);

// Test 4: Expired OTP should fail with appropriate error
console.log('Test 4: Expired OTP should fail with appropriate error');
const identifier4 = 'STU004';
const otp4 = generateOtp();
// Store OTP that expired 1 minute ago
storeOtp(identifier4, otp4, -1);

const result4 = validateOtp(identifier4, otp4);

if (result4.valid) {
    console.error('  ❌ FAILED: Expired OTP should be rejected');
    process.exit(1);
}
if (result4.error !== 'This OTP has expired. Please request a new one.') {
    console.error(`  ❌ FAILED: Wrong error message. Got: ${result4.error}`);
    process.exit(1);
}
console.log(`  ✓ Expired OTP rejected with correct error\n`);

// Test 5: Used OTP should fail with appropriate error
console.log('Test 5: Used OTP should fail with appropriate error');
const identifier5 = 'PAR005';
const otp5 = generateOtp();
storeOtp(identifier5, otp5);

// Mark OTP as used
db.prepare('UPDATE otps SET used = 1 WHERE identifier = ?').run(identifier5);

const result5 = validateOtp(identifier5, otp5);

if (result5.valid) {
    console.error('  ❌ FAILED: Used OTP should be rejected');
    process.exit(1);
}
if (result5.error !== 'No OTP found. Please request a new one.') {
    console.error(`  ❌ FAILED: Wrong error message. Got: ${result5.error}`);
    process.exit(1);
}
console.log(`  ✓ Used OTP rejected with correct error\n`);

// Test 6: Validation should check most recent OTP when multiple exist
console.log('Test 6: Validation should check most recent OTP');
const identifier6 = 'TEA006';
const otp6a = generateOtp();
// Ensure otp6b is different from otp6a
let otp6b = generateOtp();
while (otp6b === otp6a) {
    otp6b = generateOtp();
}

// Store first OTP with older timestamp
const expiresAt1 = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const createdAt1 = new Date(Date.now() - 1000).toISOString(); // 1 second ago
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier6, otp6a, expiresAt1, createdAt1);

// Store second OTP (more recent)
const expiresAt2 = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const createdAt2 = new Date(Date.now()).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier6, otp6b, expiresAt2, createdAt2);

// Validate with the most recent OTP
const result6a = validateOtp(identifier6, otp6b);
if (!result6a.valid) {
    console.error(`  ❌ FAILED: Most recent OTP should be valid. Error: ${result6a.error}`);
    console.error(`  Expected OTP: ${otp6b}, Older OTP: ${otp6a}`);
    process.exit(1);
}

// Validate with the older OTP (should fail)
const result6b = validateOtp(identifier6, otp6a);
if (result6b.valid) {
    console.error('  ❌ FAILED: Older OTP should be rejected');
    process.exit(1);
}

console.log(`  ✓ Most recent OTP validated correctly\n`);
console.log(`  ✓ Most recent OTP validated correctly\n`);

// Test 7: OTP at exact expiration boundary
console.log('Test 7: OTP at exact expiration boundary');
const identifier7 = 'STU007';
const otp7 = generateOtp();

// Store OTP that expires in exactly 0 milliseconds (edge case)
const expiresAt7 = new Date(Date.now()).toISOString();
db.prepare('DELETE FROM otps WHERE identifier = ?').run(identifier7);
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, ?)')
    .run(identifier7, otp7, expiresAt7);

// Wait a tiny bit to ensure we're past expiration
setTimeout(() => {
    const result7 = validateOtp(identifier7, otp7);
    if (result7.valid) {
        console.error('  ❌ FAILED: OTP at expiration boundary should be rejected');
        process.exit(1);
    }
    if (result7.error !== 'This OTP has expired. Please request a new one.') {
        console.error(`  ❌ FAILED: Wrong error message. Got: ${result7.error}`);
        process.exit(1);
    }
    console.log(`  ✓ OTP at expiration boundary handled correctly\n`);
    
    // Cleanup
    db.close();
    fs.unlinkSync(testDbPath);
    
    console.log('✅ All tests passed!');
}, 10);

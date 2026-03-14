/**
 * Unit test for OTP storage function
 * Run with: node tests/unit/otp-storage.test.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Create a temporary test database
const testDbPath = path.join(__dirname, 'test-otp-storage.db');

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

// Copy of the storeOtp function from server/routes/auth.js
function storeOtp(identifier, otp) {
    // Calculate expiration time: current time + 10 minutes in ISO 8601 format
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    // Invalidate any previous unused OTPs for the same identifier
    db.prepare('DELETE FROM otps WHERE identifier = ?').run(identifier);
    
    // Insert new OTP record
    db.prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?, ?, ?)')
        .run(identifier, otp, expiresAt);
}

// Helper function to generate OTP
function generateOtp() {
    const otp = crypto.randomInt(0, 1000000);
    return otp.toString().padStart(6, '0');
}

console.log('Testing storeOtp function...\n');

// Test 1: Store an OTP and verify it's in the database
console.log('Test 1: Store OTP and verify database record');
const identifier1 = 'STU001';
const otp1 = generateOtp();
storeOtp(identifier1, otp1);

const record1 = db.prepare('SELECT * FROM otps WHERE identifier = ?').get(identifier1);
if (!record1) {
    console.error('  ❌ FAILED: OTP record not found in database');
    process.exit(1);
}
if (record1.otp_code !== otp1) {
    console.error(`  ❌ FAILED: OTP mismatch. Expected ${otp1}, got ${record1.otp_code}`);
    process.exit(1);
}
if (record1.used !== 0) {
    console.error(`  ❌ FAILED: OTP should be unused (0), got ${record1.used}`);
    process.exit(1);
}
console.log(`  ✓ OTP stored correctly: ${otp1}`);
console.log(`  ✓ Identifier: ${record1.identifier}`);
console.log(`  ✓ Used flag: ${record1.used}\n`);

// Test 2: Verify expiration time is 10 minutes from now
console.log('Test 2: Verify expiration time is 10 minutes from now');
const expiresAt = new Date(record1.expires_at);
const now = new Date();
const diffMinutes = (expiresAt - now) / (1000 * 60);

if (diffMinutes < 9.9 || diffMinutes > 10.1) {
    console.error(`  ❌ FAILED: Expiration time is ${diffMinutes.toFixed(2)} minutes from now, expected ~10 minutes`);
    process.exit(1);
}
console.log(`  ✓ Expiration time: ${record1.expires_at}`);
console.log(`  ✓ Time until expiration: ${diffMinutes.toFixed(2)} minutes\n`);

// Test 3: Verify ISO 8601 format
console.log('Test 3: Verify expires_at is in ISO 8601 format');
const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
if (!iso8601Regex.test(record1.expires_at)) {
    console.error(`  ❌ FAILED: expires_at is not in ISO 8601 format: ${record1.expires_at}`);
    process.exit(1);
}
console.log(`  ✓ ISO 8601 format verified: ${record1.expires_at}\n`);

// Test 4: Verify previous OTPs are invalidated
console.log('Test 4: Verify previous OTPs are invalidated when new OTP is stored');
const identifier2 = 'PAR002';
const otp2a = generateOtp();
const otp2b = generateOtp();

// Store first OTP
storeOtp(identifier2, otp2a);
const firstRecord = db.prepare('SELECT * FROM otps WHERE identifier = ?').get(identifier2);
if (!firstRecord || firstRecord.otp_code !== otp2a) {
    console.error('  ❌ FAILED: First OTP not stored correctly');
    process.exit(1);
}
console.log(`  ✓ First OTP stored: ${otp2a}`);

// Store second OTP (should invalidate first)
storeOtp(identifier2, otp2b);
const allRecords = db.prepare('SELECT * FROM otps WHERE identifier = ?').all(identifier2);

if (allRecords.length !== 1) {
    console.error(`  ❌ FAILED: Expected 1 OTP record, found ${allRecords.length}`);
    process.exit(1);
}
if (allRecords[0].otp_code !== otp2b) {
    console.error(`  ❌ FAILED: Expected OTP ${otp2b}, got ${allRecords[0].otp_code}`);
    process.exit(1);
}
console.log(`  ✓ Second OTP stored: ${otp2b}`);
console.log(`  ✓ Previous OTP was invalidated (deleted)\n`);

// Test 5: Verify multiple identifiers can have OTPs simultaneously
console.log('Test 5: Verify multiple identifiers can have OTPs simultaneously');
const identifier3 = 'TEA003';
const otp3 = generateOtp();
storeOtp(identifier3, otp3);

const allOtps = db.prepare('SELECT * FROM otps').all();
if (allOtps.length !== 3) {
    console.error(`  ❌ FAILED: Expected 3 OTP records total, found ${allOtps.length}`);
    process.exit(1);
}

const identifiers = allOtps.map(r => r.identifier);
if (!identifiers.includes(identifier1) || !identifiers.includes(identifier2) || !identifiers.includes(identifier3)) {
    console.error('  ❌ FAILED: Not all identifiers found in database');
    process.exit(1);
}
console.log(`  ✓ Multiple identifiers stored: ${identifiers.join(', ')}`);
console.log(`  ✓ Total OTP records: ${allOtps.length}\n`);

// Cleanup
db.close();
fs.unlinkSync(testDbPath);

console.log('✅ All tests passed!');

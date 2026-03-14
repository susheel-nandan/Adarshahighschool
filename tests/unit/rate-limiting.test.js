/**
 * Unit test for rate limiting function
 * Run with: node tests/unit/rate-limiting.test.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create a temporary test database
const testDbPath = path.join(__dirname, 'test-rate-limiting.db');

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

// Copy of the checkRateLimit function from server/routes/auth.js
function checkRateLimit(identifier) {
    // Get the most recent OTP creation time for this identifier
    const lastOtp = db.prepare(
        'SELECT created_at FROM otps WHERE identifier = ? ORDER BY created_at DESC LIMIT 1'
    ).get(identifier);
    
    // If no previous OTP exists, allow the request
    if (!lastOtp) {
        return { allowed: true };
    }
    
    // Calculate time elapsed since last OTP creation
    const lastCreatedAt = new Date(lastOtp.created_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - lastCreatedAt) / 1000);
    
    // Rate limit: 2 minutes (120 seconds)
    const rateLimitSeconds = 120;
    
    // If less than 2 minutes have passed, deny the request
    if (elapsedSeconds < rateLimitSeconds) {
        const remainingSeconds = rateLimitSeconds - elapsedSeconds;
        return { allowed: false, remainingSeconds };
    }
    
    // More than 2 minutes have passed, allow the request
    return { allowed: true };
}

console.log('Testing checkRateLimit function...\n');

// Test 1: No previous OTP - should allow
console.log('Test 1: No previous OTP exists - should allow request');
const identifier1 = 'STU001';
const result1 = checkRateLimit(identifier1);

if (!result1.allowed) {
    console.error('  ❌ FAILED: Should allow request when no previous OTP exists');
    process.exit(1);
}
if (result1.remainingSeconds !== undefined) {
    console.error('  ❌ FAILED: Should not have remainingSeconds when allowed');
    process.exit(1);
}
console.log('  ✓ Request allowed (no previous OTP)');
console.log(`  ✓ Result: ${JSON.stringify(result1)}\n`);

// Test 2: OTP created just now - should deny
console.log('Test 2: OTP created just now - should deny request');
const identifier2 = 'PAR002';
const now = new Date().toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier2, '123456', now, now);

const result2 = checkRateLimit(identifier2);

if (result2.allowed) {
    console.error('  ❌ FAILED: Should deny request when OTP was just created');
    process.exit(1);
}
if (result2.remainingSeconds === undefined) {
    console.error('  ❌ FAILED: Should have remainingSeconds when denied');
    process.exit(1);
}
if (result2.remainingSeconds < 115 || result2.remainingSeconds > 120) {
    console.error(`  ❌ FAILED: remainingSeconds should be ~120, got ${result2.remainingSeconds}`);
    process.exit(1);
}
console.log('  ✓ Request denied (OTP too recent)');
console.log(`  ✓ Remaining seconds: ${result2.remainingSeconds}\n`);

// Test 3: OTP created 1 minute ago - should deny
console.log('Test 3: OTP created 1 minute ago - should deny request');
const identifier3 = 'TEA003';
const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier3, '654321', oneMinuteAgo, oneMinuteAgo);

const result3 = checkRateLimit(identifier3);

if (result3.allowed) {
    console.error('  ❌ FAILED: Should deny request when OTP was created 1 minute ago');
    process.exit(1);
}
if (result3.remainingSeconds === undefined) {
    console.error('  ❌ FAILED: Should have remainingSeconds when denied');
    process.exit(1);
}
if (result3.remainingSeconds < 55 || result3.remainingSeconds > 65) {
    console.error(`  ❌ FAILED: remainingSeconds should be ~60, got ${result3.remainingSeconds}`);
    process.exit(1);
}
console.log('  ✓ Request denied (1 minute elapsed)');
console.log(`  ✓ Remaining seconds: ${result3.remainingSeconds}\n`);

// Test 4: OTP created exactly 2 minutes ago - should allow
console.log('Test 4: OTP created exactly 2 minutes ago - should allow request');
const identifier4 = 'STU004';
const twoMinutesAgo = new Date(Date.now() - 120 * 1000).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier4, '111111', twoMinutesAgo, twoMinutesAgo);

const result4 = checkRateLimit(identifier4);

if (!result4.allowed) {
    console.error('  ❌ FAILED: Should allow request when 2 minutes have passed');
    process.exit(1);
}
if (result4.remainingSeconds !== undefined) {
    console.error('  ❌ FAILED: Should not have remainingSeconds when allowed');
    process.exit(1);
}
console.log('  ✓ Request allowed (2 minutes elapsed)');
console.log(`  ✓ Result: ${JSON.stringify(result4)}\n`);

// Test 5: OTP created 3 minutes ago - should allow
console.log('Test 5: OTP created 3 minutes ago - should allow request');
const identifier5 = 'PAR005';
const threeMinutesAgo = new Date(Date.now() - 180 * 1000).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier5, '222222', threeMinutesAgo, threeMinutesAgo);

const result5 = checkRateLimit(identifier5);

if (!result5.allowed) {
    console.error('  ❌ FAILED: Should allow request when 3 minutes have passed');
    process.exit(1);
}
if (result5.remainingSeconds !== undefined) {
    console.error('  ❌ FAILED: Should not have remainingSeconds when allowed');
    process.exit(1);
}
console.log('  ✓ Request allowed (3 minutes elapsed)');
console.log(`  ✓ Result: ${JSON.stringify(result5)}\n`);

// Test 6: Multiple OTPs for same identifier - should check most recent
console.log('Test 6: Multiple OTPs for same identifier - should check most recent');
const identifier6 = 'TEA006';
const fiveMinutesAgo = new Date(Date.now() - 300 * 1000).toISOString();
const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

// Insert old OTP
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier6, '333333', fiveMinutesAgo, fiveMinutesAgo);

// Insert recent OTP
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier6, '444444', thirtySecondsAgo, thirtySecondsAgo);

const result6 = checkRateLimit(identifier6);

if (result6.allowed) {
    console.error('  ❌ FAILED: Should deny based on most recent OTP (30 seconds ago)');
    process.exit(1);
}
if (result6.remainingSeconds === undefined) {
    console.error('  ❌ FAILED: Should have remainingSeconds when denied');
    process.exit(1);
}
if (result6.remainingSeconds < 85 || result6.remainingSeconds > 95) {
    console.error(`  ❌ FAILED: remainingSeconds should be ~90, got ${result6.remainingSeconds}`);
    process.exit(1);
}
console.log('  ✓ Request denied (most recent OTP checked)');
console.log(`  ✓ Remaining seconds: ${result6.remainingSeconds}\n`);

// Test 7: Boundary test - 119 seconds ago (should deny)
console.log('Test 7: Boundary test - OTP created 119 seconds ago - should deny');
const identifier7 = 'STU007';
const oneNineteenSecondsAgo = new Date(Date.now() - 119 * 1000).toISOString();
db.prepare('INSERT INTO otps (identifier, otp_code, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(identifier7, '555555', oneNineteenSecondsAgo, oneNineteenSecondsAgo);

const result7 = checkRateLimit(identifier7);

if (result7.allowed) {
    console.error('  ❌ FAILED: Should deny request at 119 seconds (< 120)');
    process.exit(1);
}
if (result7.remainingSeconds !== 1) {
    console.error(`  ❌ FAILED: remainingSeconds should be 1, got ${result7.remainingSeconds}`);
    process.exit(1);
}
console.log('  ✓ Request denied (119 seconds < 120)');
console.log(`  ✓ Remaining seconds: ${result7.remainingSeconds}\n`);

// Cleanup
db.close();
fs.unlinkSync(testDbPath);

console.log('✅ All tests passed!');

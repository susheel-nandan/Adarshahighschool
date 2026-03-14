/**
 * Manual test for OTP generation function
 * Run with: node tests/unit/otp-generation.test.js
 */

const crypto = require('crypto');

// Copy of the generateOtp function from server/routes/auth.js
function generateOtp() {
    const otp = crypto.randomInt(0, 1000000);
    return otp.toString().padStart(6, '0');
}

// Test 1: Generate multiple OTPs and verify they are 6 digits
console.log('Test 1: Verify OTP length is always 6 digits');
for (let i = 0; i < 10; i++) {
    const otp = generateOtp();
    console.log(`  OTP ${i + 1}: ${otp} (length: ${otp.length})`);
    if (otp.length !== 6) {
        console.error(`  ❌ FAILED: OTP length is ${otp.length}, expected 6`);
        process.exit(1);
    }
}
console.log('  ✓ All OTPs have 6 digits\n');

// Test 2: Verify OTPs are numeric
console.log('Test 2: Verify OTPs are numeric');
for (let i = 0; i < 10; i++) {
    const otp = generateOtp();
    if (!/^\d{6}$/.test(otp)) {
        console.error(`  ❌ FAILED: OTP "${otp}" is not a 6-digit numeric string`);
        process.exit(1);
    }
}
console.log('  ✓ All OTPs are numeric\n');

// Test 3: Verify OTPs can start with zeros (testing padding)
console.log('Test 3: Generate many OTPs to check for leading zeros');
const otps = new Set();
let hasLeadingZero = false;
for (let i = 0; i < 1000; i++) {
    const otp = generateOtp();
    otps.add(otp);
    if (otp.startsWith('0')) {
        hasLeadingZero = true;
        console.log(`  Found OTP with leading zero: ${otp}`);
    }
}
if (hasLeadingZero) {
    console.log('  ✓ Padding works correctly (found OTPs with leading zeros)\n');
} else {
    console.log('  ⚠ Warning: No OTPs with leading zeros found in 1000 attempts (statistically unlikely but possible)\n');
}

// Test 4: Verify randomness (no duplicates in reasonable sample)
console.log('Test 4: Verify randomness (uniqueness in sample)');
console.log(`  Generated ${otps.size} unique OTPs out of 1000 attempts`);
if (otps.size < 950) {
    console.error(`  ❌ FAILED: Too many duplicates, only ${otps.size} unique OTPs`);
    process.exit(1);
}
console.log('  ✓ Good randomness (high uniqueness)\n');

console.log('✅ All tests passed!');

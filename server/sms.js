/**
 * sms.js — SMS OTP service for Adarsha High School Portal
 *
 * Supports two providers (configure via .env):
 *   SMS_PROVIDER=fast2sms  → Fast2SMS (India, recommended)
 *   SMS_PROVIDER=twilio    → Twilio (global)
 *
 * Fast2SMS setup:  https://www.fast2sms.com → API → DLT
 * Twilio setup:    https://www.twilio.com/console
 */
require('dotenv').config();
const https = require('https');

const provider = (process.env.SMS_PROVIDER || 'fast2sms').toLowerCase();

// ─── Fast2SMS ─────────────────────────────────────────────────────────────────
async function sendFast2SMS(mobile, otp, name) {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey || apiKey === 'your_fast2sms_api_key') {
        console.log(`[SMS NOT CONFIGURED — Fast2SMS]\nTo: ${mobile}\nOTP: ${otp}`);
        return { sent: false };
    }

    // Clean mobile — remove +91 or 0 prefix, keep 10 digits
    const num = String(mobile).replace(/\D/g, '').replace(/^(91|0)/, '').slice(-10);
    if (num.length !== 10) throw new Error('Invalid mobile number format');

    const message = `${otp} is your OTP for Adarsha High School Portal. Valid for 10 minutes. Do not share with anyone. -Adarsha School`;

    const payload = JSON.stringify({
        route: 'q',          // Quick/transactional route — change to 'dlt' if DLT registered
        message,
        numbers: num,
        flash: 0,
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'www.fast2sms.com',
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.return === true || json.status_code === 200) {
                        console.log(`[SMS ✅] Sent to ${num}`);
                        resolve({ sent: true });
                    } else {
                        console.error('[Fast2SMS error]', json);
                        reject(new Error(json.message || 'Fast2SMS: failed to send'));
                    }
                } catch (e) { reject(new Error('Fast2SMS: invalid response')); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─── Twilio ───────────────────────────────────────────────────────────────────
async function sendTwilio(mobile, otp, name) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from || sid === 'your_twilio_account_sid') {
        console.log(`[SMS NOT CONFIGURED — Twilio]\nTo: ${mobile}\nOTP: ${otp}`);
        return { sent: false };
    }

    const num = String(mobile).replace(/\D/g, '');
    const intlNum = num.startsWith('91') ? `+${num}` : `+91${num.slice(-10)}`;

    const body = `Your OTP for Adarsha High School Portal is ${otp}. Valid for 10 minutes. Do not share.`;
    const payload = new URLSearchParams({ To: intlNum, From: from, Body: body }).toString();
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${sid}/Messages.json`,
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.sid) { console.log(`[SMS ✅] Sent via Twilio to ${intlNum}`); resolve({ sent: true }); }
                    else { console.error('[Twilio error]', json); reject(new Error(json.message || 'Twilio: failed to send')); }
                } catch (e) { reject(new Error('Twilio: invalid response')); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─── Unified send ─────────────────────────────────────────────────────────────
/**
 * Send an OTP via SMS to a mobile number.
 * @param {string} mobile  — 10-digit Indian mobile number
 * @param {string} otp     — 6-digit OTP
 * @param {string} name    — recipient's name
 * @returns {{ sent: boolean }}
 */
async function sendSmsOtp(mobile, otp, name = '') {
    if (!mobile) return { sent: false };
    if (provider === 'twilio') return sendTwilio(mobile, otp, name);
    return sendFast2SMS(mobile, otp, name);
}

const configured = provider === 'twilio'
    ? !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid')
    : !!(process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY !== 'your_fast2sms_api_key');

module.exports = { sendSmsOtp, configured, provider };

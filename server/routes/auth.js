require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sendOtpEmail } = require('../mailer');

// POST /api/auth/signup — DISABLED: accounts created by admin only
router.post('/signup', (req, res) => {
    return res.status(403).json({ error: 'Self-registration is disabled. Please contact the school admin for your login credentials.' });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { role, id, password } = req.body;
    if (!role || !id || !password) return res.status(400).json({ error: 'Missing credentials' });

    let user;
    if (role === 'student') user = db.prepare('SELECT * FROM students WHERE student_id = ?').get(id);
    else if (role === 'parent') user = db.prepare('SELECT * FROM parents  WHERE parent_id  = ?').get(id);
    else if (role === 'admin') user = db.prepare('SELECT * FROM admins   WHERE admin_id   = ?').get(id);
    else if (role === 'teacher') user = db.prepare('SELECT * FROM faculty  WHERE teacher_id = ?').get(id);
    else return res.status(400).json({ error: 'Invalid role' });

    if (!user || !bcrypt.compareSync(password, user.password_hash))
        return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    req.session.role = role;
    req.session.identifier = id;
    if (role === 'teacher') req.session.teacherDbId = user.id;

    const { password_hash, ...safeUser } = user;
    return res.json({ success: true, role, user: safeUser });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ error: 'Missing fields' });

    const table = req.session.role === 'student' ? 'students' : 'parents';
    const col = req.session.role === 'student' ? 'student_id' : 'parent_id';
    const user = db.prepare(`SELECT * FROM ${table} WHERE ${col} = ?`).get(req.session.identifier);

    if (!bcrypt.compareSync(old_password, user.password_hash))
        return res.status(400).json({ error: 'Old password is incorrect' });

    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare(`UPDATE ${table} SET password_hash = ? WHERE ${col} = ?`).run(hash, req.session.identifier);
    res.json({ success: true, message: 'Password changed successfully' });
});

// POST /api/auth/request-otp
router.post('/request-otp', async (req, res) => {
    const { identifier, role } = req.body;
    if (!identifier || !role) return res.status(400).json({ error: 'Missing fields' });

    // ── Resolve user contact info ──────────────────────────────────────────
    let userName, userMobile, userEmail;

    if (role === 'student') {
        // Students: get contact from linked parent
        const row = db.prepare(`
            SELECT s.name as student_name,
                   p.mobile as parent_mobile,
                   p.email  as parent_email,
                   p.name   as parent_name
            FROM students s
            LEFT JOIN parents p ON s.parent_id = p.parent_id
            WHERE s.student_id = ?
        `).get(identifier);
        if (!row) return res.status(404).json({ error: 'Student not found' });
        userName = row.student_name;
        userMobile = row.parent_mobile;
        userEmail = row.parent_email;

    } else if (role === 'parent') {
        const row = db.prepare('SELECT name, mobile, email FROM parents WHERE parent_id = ?').get(identifier);
        if (!row) return res.status(404).json({ error: 'Parent not found' });
        userName = row.name;
        userMobile = row.mobile;
        userEmail = row.email;

    } else {
        return res.status(400).json({ error: 'OTP reset is for students and parents only' });
    }

    if (!userMobile && !userEmail) {
        return res.status(400).json({
            error: 'No mobile or email registered for this account. Contact the school admin.'
        });
    }

    // ── Generate OTP ──────────────────────────────────────────────────────
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare('DELETE FROM otps WHERE identifier = ?').run(identifier);
    db.prepare('INSERT INTO otps (identifier, otp_code, expires_at) VALUES (?,?,?)').run(identifier, otp, expires);

    // ── Send OTP via Email ────────────────────────────────────────────
    try {
        const result = await sendOtpEmail(userEmail, userName, otp, role);
        if (result.sent) {
            const masked = maskEmail(userEmail);
            return res.json({
                success: true,
                message: `OTP sent to ${masked}. Check your inbox (and spam folder). Valid for 10 minutes.`
            });
        } else {
            // Email not configured — show OTP for testing
            console.log(`\n[OTP FALLBACK — ${identifier}]: ${otp}\n`);
            return res.json({
                success: true,
                message: `Email not configured. OTP for testing: ${otp}`
            });
        }
    } catch (err) {
        console.error('Email send error:', err.message);
        return res.json({
            success: true,
            message: `Email sending failed. OTP for testing: ${otp}`
        });
    }
});

// Helpers
function maskEmail(email) {
    if (!email) return '';
    return email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length)) + c);
}

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
    const { identifier, otp, new_password } = req.body;
    if (!identifier || !otp) return res.status(400).json({ error: 'Missing fields' });

    const record = db.prepare('SELECT * FROM otps WHERE identifier = ? AND used = 0').get(identifier);
    if (!record) return res.status(400).json({ error: 'No OTP found. Please request again.' });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'OTP has expired' });
    if (record.otp_code !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(record.id);

    if (new_password) {
        const hash = bcrypt.hashSync(new_password, 10);
        let updated = db.prepare('UPDATE students SET password_hash = ? WHERE student_id = ?').run(hash, identifier);
        if (updated.changes === 0)
            db.prepare('UPDATE parents SET password_hash = ? WHERE parent_id = ?').run(hash, identifier);
        return res.json({ success: true, message: 'Password reset successfully' });
    }

    res.json({ success: true, verified: true });
});

// GET /api/auth/session
router.get('/session', (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, role: req.session.role, identifier: req.session.identifier });
});

module.exports = router;

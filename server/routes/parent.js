const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

function requireParent(req, res, next) {
    if (!req.session.userId || req.session.role !== 'parent')
        return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// ─── Profile ─────────────────────────────────────────────────────────────────
router.get('/profile', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT name, parent_id, mobile, email, student_id FROM parents WHERE parent_id = ?').get(pid);
    if (!parent) return res.status(404).json({ error: 'Not found' });
    const student = db.prepare('SELECT name, dob, student_id, class, section FROM students WHERE student_id = ?').get(parent.student_id);
    res.json({ parent, student });
});

// PUT /api/parent/update-mobile
router.put('/update-mobile', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ error: 'Mobile and OTP required' });

    const record = db.prepare('SELECT * FROM otps WHERE identifier = ? AND used = 0').get(pid);
    if (!record || record.otp_code !== otp || new Date(record.expires_at) < new Date())
        return res.status(400).json({ error: 'Invalid or expired OTP' });

    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(record.id);
    db.prepare('UPDATE parents SET mobile = ? WHERE parent_id = ?').run(mobile, pid);
    res.json({ success: true, message: 'Mobile number updated successfully' });
});

// ─── Student Marks ────────────────────────────────────────────────────────────
router.get('/student-marks', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT student_id FROM parents WHERE parent_id = ?').get(pid);
    if (!parent?.student_id) return res.json({ marks: [], rank: null });

    const sid = parent.student_id;
    const student = db.prepare('SELECT class, section, name FROM students WHERE student_id = ?').get(sid);
    const marks = db.prepare(`
    SELECT m.exam_type, s.name as subject, m.marks_obtained, m.max_marks,
           ROUND(m.marks_obtained * 100.0 / m.max_marks, 1) as percentage
    FROM marks m
    JOIN subjects s ON m.subject_id = s.id
    WHERE m.student_id = ?
    ORDER BY m.exam_type, s.name
  `).all(sid);

    const peerIds = db.prepare('SELECT student_id FROM students WHERE class = ? AND section = ?')
        .all(student.class, student.section).map(r => r.student_id);
    const rankData = peerIds.map(p => {
        const t = db.prepare("SELECT COALESCE(SUM(marks_obtained), 0) as total FROM marks WHERE student_id = ? AND exam_type = 'FA1'").get(p);
        return { pid: p, total: t.total };
    }).sort((a, b) => b.total - a.total);
    const rank = rankData.findIndex(r => r.pid === sid) + 1;

    res.json({ marks, rank, totalStudents: peerIds.length, student });
});

// ─── Timetable ────────────────────────────────────────────────────────────────
router.get('/timetable', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT student_id FROM parents WHERE parent_id = ?').get(pid);
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(parent?.student_id);
    if (!student) return res.json([]);
    const rows = db.prepare(`
    SELECT t.day, t.period, t.start_time, t.end_time,
           s.name as subject, f.name as faculty
    FROM timetable t
    JOIN subjects s ON t.subject_id = s.id
    JOIN faculty f ON t.faculty_id = f.id
    WHERE t.class = ? AND t.section = ?
    ORDER BY CASE t.day WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 END, t.period
  `).all(student.class, student.section);
    res.json(rows);
});

// ─── Calendar ─────────────────────────────────────────────────────────────────
router.get('/calendar', requireParent, (req, res) => {
    const events = db.prepare('SELECT * FROM calendar_events ORDER BY date').all();
    res.json(events);
});

// ─── Faculty ──────────────────────────────────────────────────────────────────
router.get('/faculty', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT student_id FROM parents WHERE parent_id = ?').get(pid);
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(parent?.student_id);
    if (!student) return res.json([]);
    const faculty = db.prepare(`
    SELECT f.id, f.name, f.subject, f.experience, f.mobile, f.email, f.qualification,
           sf.is_class_teacher
    FROM faculty f
    JOIN student_faculty sf ON f.id = sf.faculty_id
    WHERE sf.student_class = ? AND sf.student_section = ?
    ORDER BY sf.is_class_teacher DESC, f.name
  `).all(student.class, student.section);
    res.json(faculty);
});

// ─── Attendance ──────────────────────────────────────────────────────────────
router.get('/attendance', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT student_id FROM parents WHERE parent_id = ?').get(pid);
    if (!parent?.student_id) return res.json({ records: [], stats: {} });
    const sid = parent.student_id;
    const records = db.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC').all(sid);
    const total = records.length;
    const present = records.filter(r => r.status === 'P').length;
    const absent = records.filter(r => r.status === 'A').length;
    const leave = records.filter(r => r.status === 'L').length;
    const percentage = total > 0 ? ((present + leave) / total * 100).toFixed(1) : '0';
    res.json({ records, stats: { total, present, absent, leave, percentage } });
});

// ─── Faculty Directory ────────────────────────────────────────────────────────
router.get('/faculty', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT student_id FROM parents WHERE parent_id = ?').get(pid);
    if (!parent?.student_id) return res.json([]);
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(parent.student_id);
    if (!student) return res.json([]);
    const faculty = db.prepare(`
        SELECT f.id, f.name, f.subject, f.experience, f.mobile, f.email, f.qualification,
               sf.is_class_teacher
        FROM faculty f
        JOIN student_faculty sf ON f.id = sf.faculty_id
        WHERE sf.student_class = ? AND sf.student_section = ?
        ORDER BY sf.is_class_teacher DESC, f.name
    `).all(student.class, student.section);
    res.json(faculty);
});

// ─── Timetable (parent sees child's timetable) ────────────────────────────────
router.get('/timetable', requireParent, (req, res) => {
    const pid = req.session.identifier;
    const parent = db.prepare('SELECT student_id FROM parents WHERE parent_id = ?').get(pid);
    if (!parent?.student_id) return res.json([]);
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(parent.student_id);
    if (!student) return res.json([]);
    const rows = db.prepare(`
        SELECT t.day, t.period, t.start_time, t.end_time,
               s.name as subject, f.name as faculty
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN faculty f ON t.faculty_id = f.id
        WHERE t.class = ? AND t.section = ?
        ORDER BY CASE t.day WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 END, t.period
    `).all(student.class, student.section);
    res.json(rows);
});

module.exports = router;

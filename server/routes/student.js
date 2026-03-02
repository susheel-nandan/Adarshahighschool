const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to check student session
function requireStudent(req, res, next) {
    if (!req.session.userId || req.session.role !== 'student')
        return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// ─── Profile ────────────────────────────────────────────────────────────────
router.get('/profile', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const student = db.prepare('SELECT name, dob, student_id, class, section, parent_id FROM students WHERE student_id = ?').get(sid);
    if (!student) return res.status(404).json({ error: 'Not found' });
    const parent = db.prepare('SELECT name, mobile FROM parents WHERE parent_id = ?').get(student.parent_id);
    res.json({ ...student, parent_name: parent?.name || '', parent_mobile: parent?.mobile || '' });
});

// ─── Marks + Rank ────────────────────────────────────────────────────────────
router.get('/marks', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(sid);

    const marks = db.prepare(`
    SELECT m.exam_type, s.name as subject, m.marks_obtained, m.max_marks,
           ROUND(m.marks_obtained * 100.0 / m.max_marks, 1) as percentage
    FROM marks m
    JOIN subjects s ON m.subject_id = s.id
    WHERE m.student_id = ?
    ORDER BY m.exam_type, s.name
  `).all(sid);

    // Calculate rank from section peers
    const peerIds = db.prepare('SELECT student_id FROM students WHERE class = ? AND section = ?')
        .all(student.class, student.section).map(r => r.student_id);

    const rankData = peerIds.map(pid => {
        const total = db.prepare("SELECT COALESCE(SUM(marks_obtained), 0) as total FROM marks WHERE student_id = ? AND exam_type = 'FA1'").get(pid);
        return { pid, total: total.total };
    }).sort((a, b) => b.total - a.total);

    const rank = rankData.findIndex(r => r.pid === sid) + 1;
    const totalStudents = peerIds.length;

    res.json({ marks, rank, totalStudents, examTypes: [...new Set(marks.map(m => m.exam_type))] });
});

// ─── Timetable ───────────────────────────────────────────────────────────────
router.get('/timetable', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(sid);
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

// ─── Attendance ──────────────────────────────────────────────────────────────
router.get('/attendance', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const records = db.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC').all(sid);
    const total = records.length;
    const present = records.filter(r => r.status === 'P').length;
    const absent = records.filter(r => r.status === 'A').length;
    const leave = records.filter(r => r.status === 'L').length;
    const percentage = total > 0 ? ((present + leave) / total * 100).toFixed(1) : '0';
    res.json({ records, stats: { total, present, absent, leave, percentage } });
});

// ─── Calendar ─────────────────────────────────────────────────────────────────
router.get('/calendar', requireStudent, (req, res) => {
    const events = db.prepare('SELECT * FROM calendar_events ORDER BY date').all();
    res.json(events);
});

// ─── Exam Schedule ────────────────────────────────────────────────────────────
router.get('/exams', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const student = db.prepare('SELECT class FROM students WHERE student_id = ?').get(sid);
    const exams = db.prepare(`
    SELECT e.exam_type, e.exam_date, e.start_time, e.duration_mins, s.name as subject
    FROM exam_schedule e
    JOIN subjects s ON e.subject_id = s.id
    WHERE e.class = ?
    ORDER BY e.exam_date
  `).all(student.class);
    res.json(exams);
});

// ─── Faculty Directory ────────────────────────────────────────────────────────
router.get('/faculty', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const student = db.prepare('SELECT class, section FROM students WHERE student_id = ?').get(sid);
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

// ─── Leave Request ────────────────────────────────────────────────────────────
router.post('/leave', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const { from_date, to_date, reason } = req.body;
    if (!from_date || !to_date || !reason)
        return res.status(400).json({ error: 'All fields are required' });
    db.prepare('INSERT INTO leave_requests (student_id, from_date, to_date, reason) VALUES (?,?,?,?)')
        .run(sid, from_date, to_date, reason);
    res.json({ success: true, message: 'Leave request submitted successfully' });
});

router.get('/leave', requireStudent, (req, res) => {
    const sid = req.session.identifier;
    const requests = db.prepare('SELECT * FROM leave_requests WHERE student_id = ? ORDER BY submitted_at DESC').all(sid);
    res.json(requests);
});

module.exports = router;

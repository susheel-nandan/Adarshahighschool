/**
 * server/routes/teacher.js
 * Teacher portal backend — restricted to the logged-in teacher's subject & assigned classes.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

function requireTeacher(req, res, next) {
    if (!req.session.userId || req.session.role !== 'teacher')
        return res.status(401).json({ error: 'Teacher access required' });
    next();
}

// helper: get faculty row for current session
function getTeacher(req) {
    return db.prepare('SELECT * FROM faculty WHERE id = ?').get(req.session.teacherDbId);
}

// ─── Profile ─────────────────────────────────────────────────────────────────
router.get('/profile', requireTeacher, (req, res) => {
    const t = getTeacher(req);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const { password_hash, ...safe } = t;
    res.json(safe);
});

// ─── Assigned classes ─────────────────────────────────────────────────────────
router.get('/classes', requireTeacher, (req, res) => {
    const rows = db.prepare(`
        SELECT student_class as class, student_section as section, is_class_teacher
        FROM student_faculty
        WHERE faculty_id = ?
        ORDER BY student_class, student_section
    `).all(req.session.teacherDbId);
    res.json(rows);
});

// ─── Students in a class ─────────────────────────────────────────────────────
router.get('/students', requireTeacher, (req, res) => {
    const { class: cls, section } = req.query;
    if (!cls) return res.status(400).json({ error: 'class required' });

    // Verify teacher is assigned to this class
    const assigned = db.prepare(
        'SELECT 1 FROM student_faculty WHERE faculty_id=? AND student_class=? AND student_section=?'
    ).get(req.session.teacherDbId, cls, section || 'A');
    if (!assigned) return res.status(403).json({ error: 'Not assigned to this class' });

    const students = db.prepare(
        'SELECT student_id, name FROM students WHERE class=? AND section=? ORDER BY name'
    ).all(cls, section || 'A');
    res.json(students);
});

// ─── Marks for teacher's subject in a class (class-wide view) ───────────────
router.get('/marks', requireTeacher, (req, res) => {
    const { class: cls, section, exam_type } = req.query;
    if (!cls || !exam_type) return res.status(400).json({ error: 'class and exam_type required' });

    const teacher = getTeacher(req);
    // Find subject_id matching teacher's subject for this class
    const subject = db.prepare(
        'SELECT id, name FROM subjects WHERE class=? AND LOWER(name)=LOWER(?)'
    ).get(cls, teacher.subject);

    // All students in the class with their marks for this subject+exam
    const students = db.prepare(
        'SELECT student_id, name FROM students WHERE class=? AND section=? ORDER BY name'
    ).all(cls, section || 'A');

    const result = students.map(s => {
        const mark = subject ? db.prepare(
            'SELECT marks_obtained, max_marks FROM marks WHERE student_id=? AND subject_id=? AND exam_type=?'
        ).get(s.student_id, subject.id, exam_type) : null;
        return {
            student_id: s.student_id,
            name: s.name,
            marks_obtained: mark?.marks_obtained ?? '',
            max_marks: mark?.max_marks ?? 100,
            subject_id: subject?.id ?? null,
            subject_name: subject?.name ?? teacher.subject,
        };
    });

    res.json({ students: result, subject_id: subject?.id, subject_name: subject?.name ?? teacher.subject });
});

// ─── Bulk save marks (teacher's subject only) ────────────────────────────────
router.post('/marks/bulk', requireTeacher, (req, res) => {
    const { class: cls, section, exam_type, entries } = req.body;
    if (!cls || !exam_type || !entries?.length) return res.status(400).json({ error: 'Missing fields' });

    const teacher = getTeacher(req);
    const subject = db.prepare(
        'SELECT id FROM subjects WHERE class=? AND LOWER(name)=LOWER(?)'
    ).get(cls, teacher.subject);
    if (!subject) return res.status(400).json({ error: `Subject "${teacher.subject}" not found for class ${cls}` });

    // Verify assignment
    const assigned = db.prepare(
        'SELECT 1 FROM student_faculty WHERE faculty_id=? AND student_class=?'
    ).get(req.session.teacherDbId, cls);
    if (!assigned) return res.status(403).json({ error: 'Not assigned to this class' });

    const upsert = db.prepare(`
        INSERT INTO marks (student_id, subject_id, marks_obtained, max_marks, exam_type)
        VALUES (?,?,?,?,?)
        ON CONFLICT(student_id, subject_id, exam_type)
        DO UPDATE SET marks_obtained=excluded.marks_obtained, max_marks=excluded.max_marks
    `);
    // Add unique constraint if missing
    try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_marks_unique ON marks(student_id,subject_id,exam_type)'); } catch (_) { }

    const save = db.transaction(() => {
        for (const e of entries) {
            if (e.marks_obtained === '' || isNaN(parseFloat(e.marks_obtained))) continue;
            upsert.run(e.student_id, subject.id, parseFloat(e.marks_obtained), parseFloat(e.max_marks ?? 100), exam_type);
        }
    });
    save();
    res.json({ success: true, message: `Marks saved for class ${cls}` });
});

// ─── Change own password ─────────────────────────────────────────────────────
router.put('/change-password', requireTeacher, (req, res) => {
    const { old_password, new_password } = req.body;
    const t = getTeacher(req);
    if (!t.password_hash || !bcrypt.compareSync(old_password, t.password_hash))
        return res.status(400).json({ error: 'Current password incorrect' });
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE faculty SET password_hash=? WHERE id=?').run(hash, req.session.teacherDbId);
    res.json({ success: true, message: 'Password updated' });
});

module.exports = router;

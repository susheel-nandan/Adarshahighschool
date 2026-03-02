const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

function requireAdmin(req, res, next) {
    if (!req.session.userId || req.session.role !== 'admin')
        return res.status(401).json({ error: 'Admin access required' });
    next();
}

// ─── Helper: bidirectional parent↔student sync ───────────────────────────────
function syncStudentParent(studentId, parentId) {
    if (studentId && parentId) {
        // Ensure student's parent_id points to this parent
        db.prepare('UPDATE students SET parent_id=? WHERE student_id=? AND (parent_id IS NULL OR parent_id!=?)')
            .run(parentId, studentId, parentId);
        // Ensure parent's student_id points to this student
        db.prepare('UPDATE parents SET student_id=? WHERE parent_id=? AND (student_id IS NULL OR student_id!=?)')
            .run(studentId, parentId, studentId);
    }
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, (req, res) => {
    const students = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    const parents = db.prepare('SELECT COUNT(*) as c FROM parents').get().c;
    const faculty = db.prepare('SELECT COUNT(*) as c FROM faculty').get().c;
    const pendingLeave = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='Pending'").get().c;
    const classes = db.prepare('SELECT DISTINCT class, section FROM students ORDER BY class, section').all();
    res.json({ students, parents, faculty, pendingLeave, classes });
});

// ─── Students ─────────────────────────────────────────────────────────────────
router.get('/students', requireAdmin, (req, res) => {
    const rows = db.prepare(`
        SELECT s.student_id, s.name, s.dob, s.class, s.section, s.parent_id,
               p.name as parent_name, p.mobile as parent_mobile
        FROM students s
        LEFT JOIN parents p ON s.parent_id = p.parent_id
        ORDER BY s.class, s.section, s.name
    `).all();
    res.json(rows);
});

router.get('/students/:sid', requireAdmin, (req, res) => {
    const s = db.prepare(`
        SELECT s.*, p.name as parent_name, p.mobile as parent_mobile,
               p.email as parent_email, p.parent_id as linked_parent_id
        FROM students s LEFT JOIN parents p ON s.parent_id = p.parent_id
        WHERE s.student_id = ?
    `).get(req.params.sid);
    if (!s) return res.status(404).json({ error: 'Student not found' });
    res.json(s);
});

router.put('/students/:sid', requireAdmin, (req, res) => {
    const { name, dob, class: cls, section, parent_id } = req.body;
    const sid = req.params.sid;
    if (!name || !dob || !cls || !section) return res.status(400).json({ error: 'Required fields missing' });
    db.prepare('UPDATE students SET name=?, dob=?, class=?, section=?, parent_id=? WHERE student_id=?')
        .run(name, dob, cls, section, parent_id || null, sid);
    // Auto-link: if parent_id provided, sync parent's student_id
    if (parent_id) syncStudentParent(sid, parent_id);
    res.json({ success: true, message: 'Student updated' });
});

router.put('/students/:sid/credentials', requireAdmin, (req, res) => {
    const { new_id, new_password } = req.body;
    const oldSid = req.params.sid;
    const student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(oldSid);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    try {
        if (new_id && new_id !== oldSid) {
            const exists = db.prepare('SELECT id FROM students WHERE student_id=?').get(new_id);
            if (exists) return res.status(400).json({ error: 'Student ID already in use' });
            db.pragma('foreign_keys = OFF');
            db.transaction(() => {
                db.prepare('UPDATE marks          SET student_id=? WHERE student_id=?').run(new_id, oldSid);
                db.prepare('UPDATE attendance      SET student_id=? WHERE student_id=?').run(new_id, oldSid);
                db.prepare('UPDATE fees            SET student_id=? WHERE student_id=?').run(new_id, oldSid);
                db.prepare('UPDATE leave_requests  SET student_id=? WHERE student_id=?').run(new_id, oldSid);
                db.prepare('UPDATE parents         SET student_id=? WHERE student_id=?').run(new_id, oldSid);
                db.prepare('UPDATE students        SET student_id=? WHERE student_id=?').run(new_id, oldSid);
            })();
            db.pragma('foreign_keys = ON');
        }
        const finalId = (new_id && new_id !== oldSid) ? new_id : oldSid;
        if (new_password) {
            const hash = bcrypt.hashSync(new_password, 10);
            db.prepare('UPDATE students SET password_hash=? WHERE student_id=?').run(hash, finalId);
        }
    } catch (e) { return res.status(500).json({ error: e.message }); }
    res.json({ success: true, message: 'Credentials updated' });
});

router.post('/students', requireAdmin, (req, res) => {
    const { name, dob, student_id, class: cls, section, parent_id, password } = req.body;
    if (!name || !student_id || !password || !cls || !section || !dob)
        return res.status(400).json({ error: 'All fields required' });
    const exists = db.prepare('SELECT id FROM students WHERE student_id=?').get(student_id);
    if (exists) return res.status(400).json({ error: 'Student ID already exists' });
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO students (name, dob, student_id, class, section, parent_id, password_hash) VALUES (?,?,?,?,?,?,?)')
        .run(name, dob, student_id, cls, section, parent_id || null, hash);
    // Auto-link: update parent's student_id
    if (parent_id) syncStudentParent(student_id, parent_id);
    res.json({ success: true, message: 'Student created' });
});

router.delete('/students/:sid', requireAdmin, (req, res) => {
    const sid = req.params.sid;
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
        db.prepare('DELETE FROM marks WHERE student_id=?').run(sid);
        db.prepare('DELETE FROM attendance WHERE student_id=?').run(sid);
        db.prepare('DELETE FROM fees WHERE student_id=?').run(sid);
        db.prepare('DELETE FROM leave_requests WHERE student_id=?').run(sid);
        db.prepare('DELETE FROM students WHERE student_id=?').run(sid);
    })();
    db.pragma('foreign_keys = ON');
    res.json({ success: true, message: 'Student deleted' });
});

// ─── Parents ──────────────────────────────────────────────────────────────────
router.get('/parents', requireAdmin, (req, res) => {
    const rows = db.prepare(`
        SELECT p.*, s.name as student_name, s.class as student_class, s.section as student_section
        FROM parents p LEFT JOIN students s ON p.student_id = s.student_id
        ORDER BY p.name
    `).all();
    res.json(rows);
});

router.put('/parents/:pid', requireAdmin, (req, res) => {
    const { name, mobile, email, student_id } = req.body;
    const pid = req.params.pid;
    if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile required' });
    db.prepare('UPDATE parents SET name=?, mobile=?, email=?, student_id=? WHERE parent_id=?')
        .run(name, mobile, email || null, student_id || null, pid);
    // Auto-link: ensure student points back to this parent
    if (student_id) syncStudentParent(student_id, pid);
    res.json({ success: true, message: 'Parent updated' });
});

router.put('/parents/:pid/credentials', requireAdmin, (req, res) => {
    const { new_id, new_password } = req.body;
    const oldPid = req.params.pid;
    const parent = db.prepare('SELECT * FROM parents WHERE parent_id=?').get(oldPid);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    try {
        if (new_id && new_id !== oldPid) {
            const exists = db.prepare('SELECT id FROM parents WHERE parent_id=?').get(new_id);
            if (exists) return res.status(400).json({ error: 'Parent ID already in use' });
            db.pragma('foreign_keys = OFF');
            db.prepare('UPDATE students SET parent_id=? WHERE parent_id=?').run(new_id, oldPid);
            db.prepare('UPDATE parents SET parent_id=? WHERE parent_id=?').run(new_id, oldPid);
            db.pragma('foreign_keys = ON');
        }
        const finalId = (new_id && new_id !== oldPid) ? new_id : oldPid;
        if (new_password) {
            const hash = bcrypt.hashSync(new_password, 10);
            db.prepare('UPDATE parents SET password_hash=? WHERE parent_id=?').run(hash, finalId);
        }
    } catch (e) { return res.status(500).json({ error: e.message }); }
    res.json({ success: true, message: 'Credentials updated' });
});

router.post('/parents', requireAdmin, (req, res) => {
    const { name, parent_id, mobile, email, student_id, password } = req.body;
    if (!name || !parent_id || !mobile || !password) return res.status(400).json({ error: 'Required fields missing' });
    const exists = db.prepare('SELECT id FROM parents WHERE parent_id=?').get(parent_id);
    if (exists) return res.status(400).json({ error: 'Parent ID already exists' });
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO parents (name, parent_id, mobile, email, password_hash, student_id) VALUES (?,?,?,?,?,?)')
        .run(name, parent_id, mobile, email || null, hash, student_id || null);
    // Auto-link: ensure student points to this parent
    if (student_id) syncStudentParent(student_id, parent_id);
    res.json({ success: true, message: 'Parent created' });
});

// ─── Timetable ────────────────────────────────────────────────────────────────
router.get('/timetable', requireAdmin, (req, res) => {
    const { class: cls, section } = req.query;
    let query = `
        SELECT t.id, t.class, t.section, t.day, t.period, t.start_time, t.end_time,
               s.name as subject, s.id as subject_id, f.name as faculty, f.id as faculty_id
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN faculty f ON t.faculty_id = f.id
    `;
    const params = [];
    if (cls && section) { query += ' WHERE t.class=? AND t.section=?'; params.push(cls, section); }
    query += ` ORDER BY t.class, t.section, CASE t.day WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 END, t.period`;
    res.json(db.prepare(query).all(...params));
});

router.put('/timetable/:id', requireAdmin, (req, res) => {
    const { subject_id, faculty_id, start_time, end_time } = req.body;
    db.prepare('UPDATE timetable SET subject_id=?, faculty_id=?, start_time=?, end_time=? WHERE id=?')
        .run(subject_id, faculty_id, start_time, end_time, req.params.id);
    res.json({ success: true, message: 'Timetable slot updated' });
});

router.post('/timetable', requireAdmin, (req, res) => {
    const { class: cls, section, day, period, subject_id, faculty_id, start_time, end_time } = req.body;
    if (!cls || !section || !day || !period || !subject_id || !faculty_id)
        return res.status(400).json({ error: 'All fields required' });
    const r = db.prepare('INSERT INTO timetable (class, section, day, period, subject_id, faculty_id, start_time, end_time) VALUES (?,?,?,?,?,?,?,?)')
        .run(cls, section, day, period, subject_id, faculty_id, start_time, end_time);
    res.json({ success: true, id: r.lastInsertRowid });
});

router.delete('/timetable/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM timetable WHERE id=?').run(req.params.id);
    res.json({ success: true, message: 'Slot deleted' });
});

// ─── Marks  (view + upsert per student/subject/exam) ─────────────────────────
router.get('/marks/:sid', requireAdmin, (req, res) => {
    const { exam_type } = req.query;
    let query = `
        SELECT m.id, m.exam_type, m.marks_obtained, m.max_marks,
               s.name as subject, s.id as subject_id
        FROM marks m JOIN subjects s ON m.subject_id = s.id
        WHERE m.student_id = ?`;
    const params = [req.params.sid];
    if (exam_type) { query += ' AND m.exam_type=?'; params.push(exam_type); }
    query += ' ORDER BY m.exam_type, s.name';
    res.json(db.prepare(query).all(...params));
});

router.put('/marks/:id', requireAdmin, (req, res) => {
    const { marks_obtained, max_marks, exam_type } = req.body;
    db.prepare('UPDATE marks SET marks_obtained=?, max_marks=?, exam_type=? WHERE id=?')
        .run(marks_obtained, max_marks, exam_type, req.params.id);
    res.json({ success: true });
});

router.post('/marks', requireAdmin, (req, res) => {
    const { student_id, subject_id, marks_obtained, max_marks, exam_type } = req.body;
    if (!student_id || !subject_id || marks_obtained == null || !exam_type)
        return res.status(400).json({ error: 'Fields missing' });
    // Upsert: update existing or insert new
    const existing = db.prepare('SELECT id FROM marks WHERE student_id=? AND subject_id=? AND exam_type=?')
        .get(student_id, subject_id, exam_type);
    if (existing) {
        db.prepare('UPDATE marks SET marks_obtained=?, max_marks=? WHERE id=?')
            .run(marks_obtained, max_marks || 100, existing.id);
        return res.json({ success: true, id: existing.id, updated: true });
    }
    const r = db.prepare('INSERT INTO marks (student_id, subject_id, marks_obtained, max_marks, exam_type) VALUES (?,?,?,?,?)')
        .run(student_id, subject_id, marks_obtained, max_marks || 100, exam_type);
    res.json({ success: true, id: r.lastInsertRowid, updated: false });
});

// Bulk upsert all marks for a student in one exam type
router.post('/marks/bulk', requireAdmin, (req, res) => {
    const { student_id, exam_type, entries } = req.body; // entries: [{subject_id, marks_obtained, max_marks}]
    if (!student_id || !exam_type || !Array.isArray(entries))
        return res.status(400).json({ error: 'student_id, exam_type and entries[] required' });
    db.transaction(() => {
        for (const e of entries) {
            const existing = db.prepare('SELECT id FROM marks WHERE student_id=? AND subject_id=? AND exam_type=?')
                .get(student_id, e.subject_id, exam_type);
            if (existing) {
                db.prepare('UPDATE marks SET marks_obtained=?, max_marks=? WHERE id=?')
                    .run(e.marks_obtained, e.max_marks || 100, existing.id);
            } else {
                db.prepare('INSERT INTO marks (student_id, subject_id, marks_obtained, max_marks, exam_type) VALUES (?,?,?,?,?)')
                    .run(student_id, e.subject_id, e.marks_obtained, e.max_marks || 100, exam_type);
            }
        }
    })();
    res.json({ success: true, message: `${entries.length} marks saved` });
});

// ─── Subjects ────────────────────────────────────────────────────────────────
router.get('/subjects', requireAdmin, (req, res) => {
    const { class: cls } = req.query;
    const rows = cls
        ? db.prepare('SELECT * FROM subjects WHERE class=? ORDER BY name').all(cls)
        : db.prepare('SELECT * FROM subjects ORDER BY class, name').all();
    res.json(rows);
});

router.post('/subjects', requireAdmin, (req, res) => {
    const { name, class: cls } = req.body;
    if (!name || !cls) return res.status(400).json({ error: 'Name and class required' });
    const exists = db.prepare('SELECT id FROM subjects WHERE name=? AND class=?').get(name, cls);
    if (exists) return res.status(400).json({ error: 'Subject already exists for this class' });
    const r = db.prepare('INSERT INTO subjects (name, class) VALUES (?,?)').run(name, cls);
    res.json({ success: true, id: r.lastInsertRowid });
});

router.delete('/subjects/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM marks WHERE subject_id=?').run(req.params.id);
    db.prepare('DELETE FROM timetable WHERE subject_id=?').run(req.params.id);
    db.prepare('DELETE FROM exam_schedule WHERE subject_id=?').run(req.params.id);
    db.prepare('DELETE FROM subjects WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ─── Exam Schedule ────────────────────────────────────────────────────────────
router.get('/exams', requireAdmin, (req, res) => {
    const { class: cls } = req.query;
    let q = `SELECT e.*, s.name as subject_name FROM exam_schedule e JOIN subjects s ON e.subject_id = s.id`;
    if (cls) { q += ' WHERE e.class=?'; }
    q += ' ORDER BY e.exam_date, s.name';
    res.json(cls ? db.prepare(q).all(cls) : db.prepare(q).all());
});

router.post('/exams', requireAdmin, (req, res) => {
    const { class: cls, subject_id, exam_type, exam_date, start_time, duration_mins } = req.body;
    if (!cls || !subject_id || !exam_type || !exam_date || !start_time)
        return res.status(400).json({ error: 'All fields required' });
    const r = db.prepare('INSERT INTO exam_schedule (class, subject_id, exam_type, exam_date, start_time, duration_mins) VALUES (?,?,?,?,?,?)')
        .run(cls, subject_id, exam_type, exam_date, start_time, duration_mins || 180);
    res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/exams/:id', requireAdmin, (req, res) => {
    const { class: cls, subject_id, exam_type, exam_date, start_time, duration_mins } = req.body;
    db.prepare('UPDATE exam_schedule SET class=?, subject_id=?, exam_type=?, exam_date=?, start_time=?, duration_mins=? WHERE id=?')
        .run(cls, subject_id, exam_type, exam_date, start_time, duration_mins || 180, req.params.id);
    res.json({ success: true });
});

router.delete('/exams/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM exam_schedule WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ─── Calendar Events ──────────────────────────────────────────────────────────
router.get('/calendar', requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM calendar_events ORDER BY date').all());
});

router.post('/calendar', requireAdmin, (req, res) => {
    const { title, date, type, description } = req.body;
    if (!title || !date || !type) return res.status(400).json({ error: 'Title, date and type required' });
    const r = db.prepare('INSERT INTO calendar_events (title, date, type, description) VALUES (?,?,?,?)')
        .run(title, date, type, description || null);
    res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/calendar/:id', requireAdmin, (req, res) => {
    const { title, date, type, description } = req.body;
    db.prepare('UPDATE calendar_events SET title=?, date=?, type=?, description=? WHERE id=?')
        .run(title, date, type, description || null, req.params.id);
    res.json({ success: true });
});

router.delete('/calendar/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM calendar_events WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ─── Class-Faculty Assignments ────────────────────────────────────────────────
router.get('/class-faculty', requireAdmin, (req, res) => {
    const { class: cls, section } = req.query;
    let q = `
        SELECT sf.rowid as id, sf.student_class, sf.student_section, sf.faculty_id,
               sf.is_class_teacher, f.name as faculty_name, f.subject as faculty_subject
        FROM student_faculty sf JOIN faculty f ON sf.faculty_id = f.id
    `;
    if (cls && section) q += ` WHERE sf.student_class=? AND sf.student_section=?`;
    q += ' ORDER BY sf.is_class_teacher DESC, f.name';
    const rows = cls && section ? db.prepare(q).all(cls, section) : db.prepare(q).all();
    res.json(rows);
});

router.post('/class-faculty', requireAdmin, (req, res) => {
    const { student_class, student_section, faculty_id, is_class_teacher } = req.body;
    if (!student_class || !student_section || !faculty_id) return res.status(400).json({ error: 'Fields missing' });
    // Only 1 class teacher per class+section
    if (is_class_teacher) {
        db.prepare('UPDATE student_faculty SET is_class_teacher=0 WHERE student_class=? AND student_section=?')
            .run(student_class, student_section);
    }
    const exists = db.prepare('SELECT rowid FROM student_faculty WHERE student_class=? AND student_section=? AND faculty_id=?')
        .get(student_class, student_section, faculty_id);
    if (exists) {
        db.prepare('UPDATE student_faculty SET is_class_teacher=? WHERE rowid=?').run(is_class_teacher ? 1 : 0, exists.rowid);
        return res.json({ success: true, message: 'Assignment updated' });
    }
    db.prepare('INSERT INTO student_faculty (student_class, student_section, faculty_id, is_class_teacher) VALUES (?,?,?,?)')
        .run(student_class, student_section, faculty_id, is_class_teacher ? 1 : 0);
    res.json({ success: true, message: 'Faculty assigned to class' });
});

router.delete('/class-faculty', requireAdmin, (req, res) => {
    const { student_class, student_section, faculty_id } = req.body;
    db.prepare('DELETE FROM student_faculty WHERE student_class=? AND student_section=? AND faculty_id=?')
        .run(student_class, student_section, faculty_id);
    res.json({ success: true });
});

// ─── Attendance ───────────────────────────────────────────────────────────────
router.get('/attendance/:sid', requireAdmin, (req, res) => {
    const records = db.prepare('SELECT * FROM attendance WHERE student_id=? ORDER BY date DESC').all(req.params.sid);
    res.json(records);
});

router.put('/attendance/:id', requireAdmin, (req, res) => {
    const { status } = req.body;
    if (!['P', 'A', 'L'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE attendance SET status=? WHERE id=?').run(status, req.params.id);
    res.json({ success: true });
});

router.post('/attendance', requireAdmin, (req, res) => {
    const { student_id, date, status } = req.body;
    if (!student_id || !date || !['P', 'A', 'L'].includes(status))
        return res.status(400).json({ error: 'student_id, date and valid status required' });
    const exists = db.prepare('SELECT id FROM attendance WHERE student_id=? AND date=?').get(student_id, date);
    if (exists) {
        db.prepare('UPDATE attendance SET status=? WHERE id=?').run(status, exists.id);
        return res.json({ success: true, updated: true });
    }
    const r = db.prepare('INSERT INTO attendance (student_id, date, status) VALUES (?,?,?)').run(student_id, date, status);
    res.json({ success: true, id: r.lastInsertRowid });
});

// ─── Faculty ──────────────────────────────────────────────────────────────────
router.get('/faculty', requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM faculty ORDER BY name').all());
});

router.post('/faculty', requireAdmin, (req, res) => {
    const { name, subject, experience, mobile, email, qualification } = req.body;
    if (!name || !subject || !mobile) return res.status(400).json({ error: 'Required fields missing' });
    const r = db.prepare('INSERT INTO faculty (name, subject, experience, mobile, email, qualification) VALUES (?,?,?,?,?,?)')
        .run(name, subject, experience || 0, mobile, email || null, qualification || null);
    res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/faculty/:id', requireAdmin, (req, res) => {
    const { name, subject, experience, mobile, email, qualification } = req.body;
    if (!name || !subject || !mobile) return res.status(400).json({ error: 'Required fields missing' });
    db.prepare('UPDATE faculty SET name=?, subject=?, experience=?, mobile=?, email=?, qualification=? WHERE id=?')
        .run(name, subject, experience || 0, mobile, email || null, qualification || null, req.params.id);
    res.json({ success: true });
});

router.delete('/faculty/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM student_faculty WHERE faculty_id=?').run(req.params.id);
    db.prepare('DELETE FROM timetable WHERE faculty_id=?').run(req.params.id);
    db.prepare('DELETE FROM faculty WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ─── Leave Requests ───────────────────────────────────────────────────────────
router.get('/leave-requests', requireAdmin, (req, res) => {
    const rows = db.prepare(`
        SELECT l.*, s.name as student_name, s.class, s.section
        FROM leave_requests l JOIN students s ON l.student_id = s.student_id
        ORDER BY l.submitted_at DESC
    `).all();
    res.json(rows);
});

router.put('/leave-requests/:id', requireAdmin, (req, res) => {
    const { status } = req.body;
    if (!['Approved', 'Rejected', 'Pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE leave_requests SET status=? WHERE id=?').run(status, req.params.id);
    res.json({ success: true, message: `Leave request ${status.toLowerCase()}` });
});

// ─── Admin profile ────────────────────────────────────────────────────────────
router.get('/profile', requireAdmin, (req, res) => {
    const aid = req.session.identifier;
    const admin = db.prepare('SELECT admin_id, name FROM admins WHERE admin_id=?').get(aid);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
});

router.put('/profile', requireAdmin, (req, res) => {
    const { current_password, new_password, new_id } = req.body;
    const aid = req.session.identifier;
    const admin = db.prepare('SELECT * FROM admins WHERE admin_id=?').get(aid);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    // Always require current password for security
    if (!current_password || !bcrypt.compareSync(current_password, admin.password_hash))
        return res.status(400).json({ error: 'Current password is incorrect' });

    if (!new_password && !new_id)
        return res.status(400).json({ error: 'Provide a new password or new ID to update' });

    try {
        let finalId = aid;

        // Change ID
        if (new_id && new_id !== aid) {
            const exists = db.prepare('SELECT admin_id FROM admins WHERE admin_id=?').get(new_id);
            if (exists) return res.status(400).json({ error: 'Admin ID already in use' });
            db.prepare('UPDATE admins SET admin_id=? WHERE admin_id=?').run(new_id, aid);
            finalId = new_id;
            // Update session so the user stays logged in with the new ID
            req.session.identifier = new_id;
            req.session.userId = new_id;
        }

        // Change password
        if (new_password) {
            const hash = bcrypt.hashSync(new_password, 10);
            db.prepare('UPDATE admins SET password_hash=? WHERE admin_id=?').run(hash, finalId);
        }

        res.json({ success: true, message: 'Profile updated successfully', new_id: finalId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// \u2500\u2500\u2500 Admin: class-wide marks view \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// GET  /api/admin/marks/class-view?class=8&section=A&subject_id=5&exam_type=FA1
router.get('/marks/class-view', requireAdmin, (req, res) => {
    const { class: cls, section, subject_id, exam_type } = req.query;
    if (!cls || !subject_id || !exam_type) return res.status(400).json({ error: 'class, subject_id, exam_type required' });

    const students = db.prepare(
        'SELECT student_id, name FROM students WHERE class=? AND section=? ORDER BY name'
    ).all(cls, section || 'A');

    const subject = db.prepare('SELECT name FROM subjects WHERE id=?').get(subject_id);

    const result = students.map(s => {
        const mark = db.prepare(
            'SELECT marks_obtained, max_marks FROM marks WHERE student_id=? AND subject_id=? AND exam_type=?'
        ).get(s.student_id, subject_id, exam_type);
        return {
            student_id: s.student_id,
            name: s.name,
            marks_obtained: mark?.marks_obtained ?? '',
            max_marks: mark?.max_marks ?? 100,
        };
    });

    res.json({ students: result, subject_name: subject?.name || '', total: result.length });
});

// POST /api/admin/marks/class-bulk — save marks for a whole class at once
router.post('/marks/class-bulk', requireAdmin, (req, res) => {
    const { subject_id, exam_type, entries } = req.body;
    if (!subject_id || !exam_type || !entries?.length) return res.status(400).json({ error: 'Missing fields' });

    const upsert = db.prepare(`
        INSERT INTO marks (student_id, subject_id, marks_obtained, max_marks, exam_type)
        VALUES (?,?,?,?,?)
        ON CONFLICT(student_id, subject_id, exam_type)
        DO UPDATE SET marks_obtained=excluded.marks_obtained, max_marks=excluded.max_marks
    `);

    const save = db.transaction(() => {
        for (const e of entries) {
            if (e.marks_obtained === '' || isNaN(parseFloat(e.marks_obtained))) continue;
            upsert.run(e.student_id, subject_id, parseFloat(e.marks_obtained), parseFloat(e.max_marks ?? 100), exam_type);
        }
    });
    save();
    res.json({ success: true, message: `Marks saved for ${entries.length} students` });
});

module.exports = router;

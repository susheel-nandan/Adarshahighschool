const bcrypt = require('bcryptjs');
const db = require('./db');

function seed() {
    const studentCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    if (studentCount > 0) {
        console.log('Database already seeded. Skipping.');
        return;
    }

    console.log('Seeding database...');

    // ── Faculty ──────────────────────────────────────────────────────
    const insertFaculty = db.prepare(`INSERT INTO faculty (name, subject, experience, mobile, email, qualification) VALUES (?,?,?,?,?,?)`);
    const facultyData = [
        ['Mrs. Anitha Reddy', 'Mathematics', 14, '9876543210', 'anitha@adarsha.edu', 'M.Sc Mathematics, B.Ed'],
        ['Mr. Suresh Kumar', 'Science', 11, '9876543211', 'suresh@adarsha.edu', 'M.Sc Physics, B.Ed'],
        ['Mrs. Priya Sharma', 'English', 9, '9876543212', 'priya@adarsha.edu', 'M.A English, B.Ed'],
        ['Mr. Ravi Verma', 'Social Studies', 7, '9876543213', 'ravi@adarsha.edu', 'M.A History, B.Ed'],
        ['Mrs. Deepa Nair', 'Hindi', 6, '9876543214', 'deepa@adarsha.edu', 'M.A Hindi, B.Ed'],
        ['Mr. Kiran Babu', 'Telugu', 8, '9876543215', 'kiran@adarsha.edu', 'M.A Telugu, B.Ed'],
        ['Mrs. Latha Krishnan', 'Computer Science', 5, '9876543216', 'latha@adarsha.edu', 'MCA, B.Ed'],
        ['Mr. Vinod Patel', 'Physical Education', 12, '9876543217', 'vinod@adarsha.edu', 'M.P.Ed'],
    ];
    const facultyIds = [];
    for (const f of facultyData) {
        const r = insertFaculty.run(...f);
        facultyIds.push(r.lastInsertRowid);
    }

    // ── Subjects ─────────────────────────────────────────────────────
    const insertSubject = db.prepare(`INSERT INTO subjects (name, class) VALUES (?,?)`);
    const subjectNames = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'Telugu', 'Computer Science'];
    const subjectIdMap = {};
    for (let cls = 6; cls <= 10; cls++) {
        subjectIdMap[cls] = [];
        for (const name of subjectNames) {
            const r = insertSubject.run(name, cls);
            subjectIdMap[cls].push({ id: r.lastInsertRowid, name });
        }
    }

    // ── Parents ───────────────────────────────────────────────────────
    const insertParent = db.prepare(`INSERT INTO parents (name, parent_id, mobile, email, password_hash, student_id) VALUES (?,?,?,?,?,?)`);
    const pwd = bcrypt.hashSync('password123', 10);
    insertParent.run('Mr. Ramesh Nandan', 'PAR001', '9123456789', 'ramesh@gmail.com', pwd, 'STU2024001');
    insertParent.run('Mrs. Kavitha Raj', 'PAR002', '9123456790', 'kavitha@gmail.com', pwd, 'STU2024002');
    insertParent.run('Mr. Siva Prasad', 'PAR003', '9123456791', 'siva@gmail.com', pwd, 'STU2024003');
    insertParent.run('Mrs. Usha Rani', 'PAR004', '9123456792', 'usha@gmail.com', pwd, 'STU2024004');
    insertParent.run('Mr. Balu Krishna', 'PAR005', '9123456793', 'balu@gmail.com', pwd, 'STU2024005');

    // ── Students ──────────────────────────────────────────────────────
    const insertStudent = db.prepare(`INSERT INTO students (name, dob, student_id, class, section, parent_id, password_hash) VALUES (?,?,?,?,?,?,?)`);
    const students = [
        { name: 'Susheel Nandan', dob: '2012-05-15', sid: 'STU2024001', cls: 8, sec: 'A', pid: 'PAR001' },
        { name: 'Priya Kavitha', dob: '2013-08-22', sid: 'STU2024002', cls: 7, sec: 'B', pid: 'PAR002' },
        { name: 'Arjun Siva', dob: '2011-03-10', sid: 'STU2024003', cls: 9, sec: 'A', pid: 'PAR003' },
        { name: 'Divya Usha', dob: '2012-11-30', sid: 'STU2024004', cls: 8, sec: 'A', pid: 'PAR004' },
        { name: 'Karthik Balu', dob: '2010-07-05', sid: 'STU2024005', cls: 10, sec: 'A', pid: 'PAR005' },
        { name: 'Meena Kumari', dob: '2012-01-20', sid: 'STU2024006', cls: 8, sec: 'A', pid: 'PAR001' },
        { name: 'Rahul Sharma', dob: '2012-09-12', sid: 'STU2024007', cls: 8, sec: 'A', pid: 'PAR002' },
    ];
    for (const s of students) {
        insertStudent.run(s.name, s.dob, s.sid, s.cls, s.sec, s.pid, pwd);
    }

    // ── Marks for class 8 students (FA1) ──────────────────────────────
    const insertMark = db.prepare(`INSERT INTO marks (student_id, subject_id, marks_obtained, max_marks, exam_type) VALUES (?,?,?,?,?)`);
    const class8Subjects = subjectIdMap[8];
    const marksData = {
        'STU2024001': [88, 92, 78, 85, 76, 90, 95],
        'STU2024004': [72, 68, 85, 79, 83, 71, 80],
        'STU2024006': [95, 98, 90, 92, 88, 94, 97],
        'STU2024007': [60, 65, 70, 58, 62, 75, 68],
    };
    for (const [sid, scores] of Object.entries(marksData)) {
        for (let i = 0; i < class8Subjects.length; i++) {
            insertMark.run(sid, class8Subjects[i].id, scores[i], 100, 'FA1');
        }
    }
    // SA1 marks too
    const marksDataSA1 = {
        'STU2024001': [82, 88, 74, 80, 72, 86, 91],
        'STU2024004': [68, 64, 80, 75, 78, 67, 76],
        'STU2024006': [91, 94, 86, 88, 84, 90, 93],
        'STU2024007': [55, 60, 65, 52, 58, 70, 63],
    };
    for (const [sid, scores] of Object.entries(marksDataSA1)) {
        for (let i = 0; i < class8Subjects.length; i++) {
            insertMark.run(sid, class8Subjects[i].id, scores[i], 100, 'SA1');
        }
    }

    // Class 9 marks
    const class9Subjects = subjectIdMap[9];
    insertMark.run('STU2024003', class9Subjects[0].id, 79, 100, 'FA1');
    insertMark.run('STU2024003', class9Subjects[1].id, 85, 100, 'FA1');
    insertMark.run('STU2024003', class9Subjects[2].id, 91, 100, 'FA1');
    insertMark.run('STU2024003', class9Subjects[3].id, 74, 100, 'FA1');
    insertMark.run('STU2024003', class9Subjects[4].id, 68, 100, 'FA1');
    insertMark.run('STU2024003', class9Subjects[5].id, 82, 100, 'FA1');
    insertMark.run('STU2024003', class9Subjects[6].id, 88, 100, 'FA1');

    // ── Attendance (last 60 days) ─────────────────────────────────────
    const insertAtt = db.prepare(`INSERT INTO attendance (student_id, date, status) VALUES (?,?,?)`);
    const statuses = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'A', 'P', 'P', 'P', 'L', 'P', 'P'];
    const today = new Date('2026-02-28');
    for (const s of students) {
        for (let d = 60; d >= 1; d--) {
            const dt = new Date(today);
            dt.setDate(dt.getDate() - d);
            const dayOfWeek = dt.getDay();
            if (dayOfWeek === 0) continue; // skip Sunday
            const dateStr = dt.toISOString().split('T')[0];
            const status = statuses[(d + parseInt(s.sid.slice(-1))) % statuses.length];
            insertAtt.run(s.sid, dateStr, status);
        }
    }

    // ── Timetable for Class 8A ────────────────────────────────────────
    const insertTT = db.prepare(`INSERT INTO timetable (class, section, day, period, subject_id, faculty_id, start_time, end_time) VALUES (?,?,?,?,?,?,?,?)`);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const times = [
        ['08:00', '08:45'], ['08:45', '09:30'], ['09:30', '10:15'], ['10:30', '11:15'],
        ['11:15', '12:00'], ['12:00', '12:45'], ['13:30', '14:15'], ['14:15', '15:00']
    ];
    const schedule8A = [
        [0, 1, 2, 3, 4, 5, 6, 0], // Monday    subjectIndices
        [1, 0, 3, 2, 5, 4, 0, 6], // Tuesday
        [2, 1, 0, 4, 3, 5, 6, 0], // Wednesday
        [3, 2, 1, 0, 4, 6, 5, 0], // Thursday
        [4, 3, 2, 1, 0, 5, 6, null], // Friday (PE last)
        [0, 1, 2, 3, null, null, null, null], // Saturday (half day)
    ];
    const peIdx = 7; // Physical Education faculty index (0-based)
    for (let di = 0; di < days.length; di++) {
        for (let p = 0; p < 8; p++) {
            const si = schedule8A[di][p];
            if (si === null) continue;
            const subj = class8Subjects[si % class8Subjects.length];
            const facId = facultyIds[si % facultyIds.length];
            insertTT.run(8, 'A', days[di], p + 1, subj.id, facId, times[p][0], times[p][1]);
        }
    }

    // ── Calendar Events ───────────────────────────────────────────────
    const insertEvent = db.prepare(`INSERT INTO calendar_events (title, date, type, description) VALUES (?,?,?,?)`);
    const events = [
        ['Annual Sports Day', '2026-01-15', 'event', 'Annual sports day celebration'],
        ['Republic Day', '2026-01-26', 'holiday', 'National holiday'],
        ['FA2 Examinations', '2026-02-10', 'exam', 'Formative Assessment 2 begins'],
        ['Parent-Teacher Meet', '2026-02-20', 'meeting', 'PTM for all classes'],
        ['Maha Shivaratri', '2026-02-26', 'holiday', 'National holiday'],
        ['Holi', '2026-03-14', 'holiday', 'Festival holiday'],
        ['SA1 Examinations', '2026-03-20', 'exam', 'Summative Assessment 1 begins'],
        ['Ugadi', '2026-03-30', 'holiday', 'Telugu New Year'],
        ['Summer Vacation Begin', '2026-04-15', 'holiday', 'Last working day before vacation'],
        ['School Reopens', '2026-06-02', 'event', 'New academic session begins'],
        ['Independence Day', '2026-08-15', 'holiday', 'National holiday'],
        ['Teachers Day', '2026-09-05', 'event', 'Celebrating our teachers'],
        ['Gandhi Jayanthi', '2026-10-02', 'holiday', 'National holiday'],
        ['Diwali', '2026-10-20', 'holiday', 'Festival holiday'],
        ['SA2 Examinations', '2026-11-10', 'exam', 'Summative Assessment 2 begins'],
        ['Christmas', '2026-12-25', 'holiday', 'National holiday'],
    ];
    for (const e of events) insertEvent.run(...e);

    // ── Exam Schedule ─────────────────────────────────────────────────
    const insertExam = db.prepare(`INSERT INTO exam_schedule (class, subject_id, exam_type, exam_date, start_time, duration_mins) VALUES (?,?,?,?,?,?)`);
    const sa1Dates = ['2026-03-20', '2026-03-21', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27'];
    for (let cls = 6; cls <= 10; cls++) {
        const subs = subjectIdMap[cls];
        for (let i = 0; i < subs.length && i < sa1Dates.length; i++) {
            insertExam.run(cls, subs[i].id, 'SA1', sa1Dates[i], '09:00', 180);
        }
    }

    // ── Fees ──────────────────────────────────────────────────────────
    const insertFee = db.prepare(`INSERT INTO fees (student_id, description, amount, due_date, paid_date, status, receipt_no) VALUES (?,?,?,?,?,?,?)`);
    for (const s of students) {
        insertFee.run(s.sid, 'Tuition Fee - Q1 2025', 4500, '2025-04-15', '2025-04-10', 'Paid', 'RCP' + s.sid + '001');
        insertFee.run(s.sid, 'Tuition Fee - Q2 2025', 4500, '2025-07-15', '2025-07-12', 'Paid', 'RCP' + s.sid + '002');
        insertFee.run(s.sid, 'Tuition Fee - Q3 2025', 4500, '2025-10-15', '2025-10-09', 'Paid', 'RCP' + s.sid + '003');
        insertFee.run(s.sid, 'Tuition Fee - Q4 2026', 4500, '2026-01-15', null, 'Pending', null);
        insertFee.run(s.sid, 'Annual Fee 2025-26', 2500, '2025-06-30', '2025-06-28', 'Paid', 'RCP' + s.sid + '004');
        insertFee.run(s.sid, 'Exam Fee - SA1', 500, '2026-03-01', null, 'Pending', null);
    }

    // ── Student-Faculty mapping (class 8A) ────────────────────────────
    const insertSF = db.prepare(`INSERT INTO student_faculty (student_class, student_section, faculty_id, is_class_teacher) VALUES (?,?,?,?)`);
    for (let i = 0; i < facultyIds.length; i++) {
        insertSF.run(8, 'A', facultyIds[i], i === 0 ? 1 : 0);
    }

    console.log('✅ Database seeded successfully!');
    console.log('Demo credentials:');
    console.log('  Student: STU2024001 / password123  (Susheel Nandan, Class 8A)');
    console.log('  Parent:  PAR001     / password123  (Mr. Ramesh Nandan)');
    console.log('  Admin:   ADMIN001   / admin123');

}

module.exports = seed;
if (require.main === module) seed();

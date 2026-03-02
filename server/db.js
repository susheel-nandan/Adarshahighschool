const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/adarsha.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dob TEXT NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    class INTEGER NOT NULL,
    section TEXT NOT NULL,
    parent_id TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    student_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    experience INTEGER NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT,
    photo_url TEXT,
    qualification TEXT
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    class INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    marks_obtained REAL NOT NULL,
    max_marks REAL NOT NULL DEFAULT 100,
    exam_type TEXT NOT NULL DEFAULT 'FA1',
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('P','A','L')),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
  );

  CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class INTEGER NOT NULL,
    section TEXT NOT NULL,
    day TEXT NOT NULL,
    period INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    faculty_id INTEGER NOT NULL,
    start_time TEXT,
    end_time TEXT,
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('holiday','event','exam','meeting')),
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS exam_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    exam_type TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_mins INTEGER NOT NULL DEFAULT 180,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    paid_date TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Paid','Pending','Overdue')),
    receipt_no TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
  );

  CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS student_faculty (
    student_class INTEGER NOT NULL,
    student_section TEXT NOT NULL,
    faculty_id INTEGER NOT NULL,
    is_class_teacher INTEGER DEFAULT 0,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
  );
`);

// ─── Migrations: add columns to existing tables ──────────────────────────────
// teacher_id and password_hash for faculty table (if not already present)
['teacher_id TEXT', 'password_hash TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE faculty ADD COLUMN ${col}`); } catch (_) { /* already exists */ }
});
// Unique index on marks for upsert support
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_marks_unique ON marks(student_id,subject_id,exam_type)'); } catch (_) { }

module.exports = db;

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = require('./db');
const seed = require('./seed');
seed();

// Ensure all faculty have teacher_id and password_hash after DB migrations run
(function ensureTeacherCredentials() {
    const bcrypt = require('bcryptjs');
    const defaultPwd = bcrypt.hashSync('teacher123', 10);
    const faculty = db.prepare('SELECT id, teacher_id, password_hash FROM faculty').all();
    const upd = db.prepare('UPDATE faculty SET teacher_id=?, password_hash=? WHERE id=?');
    faculty.forEach(f => {
        const needsId = !f.teacher_id;
        const needsPwd = !f.password_hash;
        if (needsId || needsPwd) {
            upd.run(
                needsId ? `FAC${String(f.id).padStart(3, '0')}` : f.teacher_id,
                needsPwd ? defaultPwd : f.password_hash,
                f.id
            );
        }
    });
    console.log('✅ Teacher credentials ensured');
})();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'adarsha-high-school-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// ── Static Files ─────────────────────────────────────────────────────────────
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/parent', require('./routes/parent'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));

// ── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🎓 Adarsha High School Portal running at http://localhost:${PORT}`);
    console.log('──────────────────────────────────────────────────');
    console.log('Demo Credentials:');
    console.log('  Student → ID: STU2024001  Password: password123');
    console.log('  Parent  → ID: PAR001      Password: password123');
    console.log('  Admin   → ID: ADMIN001    Password: admin123');
    console.log('  Teacher → ID: FAC001      Password: teacher123');
    console.log('──────────────────────────────────────────────────\n');
});


module.exports = app;

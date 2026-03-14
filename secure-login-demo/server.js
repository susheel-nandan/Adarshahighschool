const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware securely configured
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure sessions to keep users logged in securely
app.use(session({
    secret: 'super-secret-key-for-adarsha-school-demo', // In production, use environment variables
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        maxAge: 1000 * 60 * 60 * 2 // 2 hours
    }
}));

// Mock Database
const DUMMY_TEACHER = {
    id: 'T101',
    password: 'password123'
};

const DUMMY_ADMIN = {
    username: 'admin',
    password: 'adminpassword'
};

const ADMIN_TRIGGER_CODE = '#A9821X';

// --- ROUTES ---

// 1. Teacher Login Route
app.post('/api/login/teacher', (req, res) => {
    const { teacherId, password } = req.body;

    // 2. Admin Trigger Check
    if (teacherId === ADMIN_TRIGGER_CODE) {
        return res.json({ success: true, redirect: '/admin-login.html' });
    }

    // Normal Teacher Authentication
    if (teacherId === DUMMY_TEACHER.id && password === DUMMY_TEACHER.password) {
        req.session.isLoggedIn = true;
        req.session.role = 'teacher';
        req.session.userId = teacherId;
        return res.json({ success: true, redirect: '/teacher-dashboard.html' });
    }

    // Invalid credentials
    return res.status(401).json({ success: false, message: 'Invalid Teacher ID or Password' });
});

// 3. Admin Login Route
app.post('/api/login/admin', (req, res) => {
    const { username, password } = req.body;

    // Server-side validation
    if (username === DUMMY_ADMIN.username && password === DUMMY_ADMIN.password) {
        req.session.isLoggedIn = true;
        req.session.role = 'admin';
        return res.json({ success: true, redirect: '/admin-dashboard.html' });
    }

    // Invalid credentials
    return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
});

// Example protected route showing session usage
app.get('/api/dashboard', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    res.json({ message: `Welcome ${req.session.role}`, role: req.session.role });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/teacher-login.html`);
});

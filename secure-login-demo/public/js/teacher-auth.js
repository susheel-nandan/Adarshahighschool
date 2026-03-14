// public/js/teacher-auth.js
document.getElementById('teacherLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const teacherId = document.getElementById('teacherId').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');

    errorDiv.textContent = ''; // Clear previous errors

    try {
        const response = await fetch('/api/login/teacher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Handle valid login or admin trigger redirect
            window.location.href = data.redirect;
        } else {
            // Display error cleanly without exposing sensitive logic
            errorDiv.textContent = data.message || 'Login failed.';
        }
    } catch (error) {
        console.error('Error during teacher login:', error);
        errorDiv.textContent = 'A network error occurred. Please try again.';
    }
});

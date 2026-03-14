// public/js/admin-auth.js
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');

    errorDiv.textContent = ''; // Clear previous errors

    try {
        const response = await fetch('/api/login/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Handle valid admin login
            window.location.href = data.redirect;
        } else {
            // Display error
            errorDiv.textContent = data.message || 'Invalid admin credentials.';
        }
    } catch (error) {
        console.error('Error during admin login:', error);
        errorDiv.textContent = 'A network error occurred. Please try again.';
    }
});

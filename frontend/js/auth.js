// frontend/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authToggle = document.getElementById('auth-toggle');
    const formTitle = document.getElementById('form-title');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('logout-btn');

    const token = localStorage.getItem('accessToken');
    if (token) {
        showDashboard();
    }

    authToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginForm.classList.contains('hidden')) {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            formTitle.textContent = 'Sign in to your account';
            authToggle.innerHTML = `Don't have an account? <a href="#" class="font-medium text-blue-600 hover:text-blue-500">Sign up</a>`;
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            formTitle.textContent = 'Create your account';
            authToggle.innerHTML = `Already have an account? <a href="#" class="font-medium text-blue-600 hover:text-blue-500">Sign in</a>`;
        }
        authError.textContent = '';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = e.target['login-email'].value;
        const password = e.target['login-password'].value;

        try {
            const response = await api.login(email, password);
            if (!response.ok) {
                throw new Error('Login failed. Please check your credentials.');
            }
            const data = await response.json();
            localStorage.setItem('accessToken', data.access_token);
            await fetchAndStoreCurrentUser(data.access_token);
            window.location.reload();
        } catch (error) {
            authError.textContent = error.message;
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = e.target['register-email'].value;
        const password = e.target['register-password'].value;
        const fullName = e.target['register-name'].value;
        const role = e.target['register-role'].value;

        try {
            const response = await api.register(email, password, fullName, role);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Registration failed.');
            }
            const loginResponse = await api.login(email, password);
            const loginData = await loginResponse.json();
            localStorage.setItem('accessToken', loginData.access_token);
            await fetchAndStoreCurrentUser(loginData.access_token);
            window.location.reload();
        } catch (error) {
            authError.textContent = error.message;
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.clear(); // Clear all user data on logout
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        loginForm.reset();
        registerForm.reset();
    });

    async function fetchAndStoreCurrentUser(token) {
        const response = await api.getMe(token);
        if (!response.ok) {
            throw new Error('Could not fetch user profile.');
        }
        const user = await response.json();
        localStorage.setItem('userId', user.id);
        localStorage.setItem('userName', user.full_name);
        // --- Store user role ---
        localStorage.setItem('userRole', user.role);
        // --- Store full user object for dashboard.js ---
        localStorage.setItem('user', JSON.stringify(user));
    }

    function showDashboard() {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        loadDashboardData();
    }
});

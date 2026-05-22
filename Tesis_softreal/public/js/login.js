/**
 * TransitApp - Login Handler
 * Gestiona el formulario de inicio de sesión, validación y redirección por rol.
 */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const loginButton = document.getElementById('loginButton');
    const btnText = loginButton.querySelector('.btn-text');
    const btnLoader = loginButton.querySelector('.btn-loader');

    // --- Mostrar / Ocultar contraseña ---
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        const icon = togglePasswordBtn.querySelector('.material-symbols-rounded');
        icon.textContent = isPassword ? 'visibility' : 'visibility_off';
    });

    // --- Enviar formulario ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const role = document.querySelector('input[name="role"]:checked')?.value;

        // Validación local
        if (!username || !password) {
            showError('Por favor, completa todos los campos.');
            return;
        }

        if (!role) {
            showError('Selecciona un perfil (Coordinador o Conductor).');
            return;
        }

        // Mostrar estado de carga
        setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            // Si la respuesta es un error de red (servidor caído)
            if (!response) {
                throw new Error('No se pudo conectar con el servidor.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al iniciar sesión.');
            }

            // Guardar datos de sesión
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirigir según rol
            if (data.user.role === 'conductor') {
                window.location.href = 'conductor.html';
            } else {
                window.location.href = 'coordinador.html';
            }
        } catch (error) {
            // Si es un error de red (fetch rechazado), mostramos mensaje genérico
            if (error.message === 'Failed to fetch') {
                showError('Error de conexión. Verifica que el servidor esté activo.');
            } else {
                showError(error.message);
            }
        } finally {
            setLoading(false);
        }
    });

    // --- Funciones helper ---
    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorText.textContent = '';
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loginButton.disabled = true;
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            loginButton.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }
});
/**
 * TransitApp - Dashboard del Coordinador
 * Permite crear viajes, ver lista de viajes, asignar conductores y ver estadísticas.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'coordinador') {
        window.location.href = 'login.html';
        return;
    }

    // Elementos del DOM
    const userNameEl = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const viajesTableBody = document.getElementById('viajesTableBody');
    const formCrearViaje = document.getElementById('formCrearViaje');
    const mensajeEl = document.getElementById('mensaje');
    const totalViajesEl = document.getElementById('totalViajes');
    const viajesPendientesEl = document.getElementById('viajesPendientes');
    const viajesAsignadosEl = document.getElementById('viajesAsignados');

    // Configurar headers
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // Mostrar nombre de usuario
    userNameEl.textContent = user.username || 'Coordinador';

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Cargar datos iniciales
    cargarEstadisticas();
    cargarViajes();

    // Crear nuevo viaje
    formCrearViaje.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarMensaje();

        const origen = document.getElementById('origen').value.trim();
        const destino = document.getElementById('destino').value.trim();
        const fecha = document.getElementById('fecha').value;

        if (!origen || !destino || !fecha) {
            mostrarMensaje('error', 'Completa todos los campos del viaje.');
            return;
        }

        try {
            const response = await fetch('/api/viajes', {
                method: 'POST',
                headers,
                body: JSON.stringify({ origen, destino, fecha })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Error al crear viaje.');

            mostrarMensaje('success', '✅ Viaje creado exitosamente.');
            formCrearViaje.reset();
            cargarEstadisticas();
            cargarViajes();
        } catch (error) {
            mostrarMensaje('error', error.message);
        }
    });

    // Cargar estadísticas
    async function cargarEstadisticas() {
        try {
            const response = await fetch('/api/viajes/estadisticas', { headers });
            if (!response.ok) return;
            const stats = await response.json();
            totalViajesEl.textContent = stats.total || 0;
            viajesPendientesEl.textContent = stats.pendientes || 0;
            viajesAsignadosEl.textContent = stats.asignados || 0;
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    }

    // Cargar lista de viajes
    async function cargarViajes() {
        try {
            const response = await fetch('/api/viajes', { headers });
            if (!response.ok) throw new Error('Error al cargar viajes.');

            const viajes = await response.json();
            renderizarViajes(viajes);
        } catch (error) {
            mostrarMensaje('error', error.message);
        }
    }

    function renderizarViajes(viajes) {
        if (viajes.length === 0) {
            viajesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:32px; color: var(--gray-400);">
                        No hay viajes registrados aún.
                    </td>
                </tr>`;
            return;
        }

        viajesTableBody.innerHTML = viajes.map(viaje => {
            const fechaFormateada = new Date(viaje.fecha).toLocaleDateString('es-PE', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            const badgeClass = `badge-${viaje.estado}`;
            const conductorNombre = viaje.conductor_nombre || '—';

            return `
                <tr>
                    <td><strong>#${viaje.id}</strong></td>
                    <td>${escapeHtml(viaje.origen)}</td>
                    <td>${escapeHtml(viaje.destino)}</td>
                    <td>${fechaFormateada}</td>
                    <td><span class="badge ${badgeClass}">${viaje.estado}</span></td>
                    <td>${escapeHtml(conductorNombre)}</td>
                </tr>`;
        }).join('');
    }

    // Utilidades
    function mostrarMensaje(tipo, texto) {
        mensajeEl.className = `message message-${tipo}`;
        mensajeEl.textContent = texto;
        mensajeEl.classList.remove('hidden');
        setTimeout(() => ocultarMensaje(), 5000);
    }

    function ocultarMensaje() {
        mensajeEl.classList.add('hidden');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
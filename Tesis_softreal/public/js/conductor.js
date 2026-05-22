/**
 * SleepShift Transport - Dashboard del Conductor (con sidebar)
 * Versión de desarrollo: NO redirige al login aunque no haya token.
 * ¡No usar en producción sin antes restaurar la verificación!
 */
document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------
    // 1. Verificación de autenticación DESACTIVADA
    // ------------------------------------------------
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Si quieres restaurar la protección, descomenta estas líneas:
    // if (!token || user.role !== 'conductor') {
    //     window.location.href = 'login.html';
    //     return;
    // }

    // ------------------------------------------------
    // 2. Elementos del DOM
    // ------------------------------------------------
    const userNameEl = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const mensajeEl = document.getElementById('mensaje');

    // Sidebar y paneles
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a[data-tab]');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Elementos del Dashboard
    const viajesHoyEl = document.getElementById('viajesHoy');
    const puntuacionActualEl = document.getElementById('puntuacionActual');
    const proximoViajeEl = document.getElementById('proximoViaje');
    const ultimosViajesBody = document.getElementById('ultimosViajesBody');

    // Elementos de Mis Viajes
    const viajesPendientesBody = document.getElementById('viajesPendientesBody');
    const viajesAsignadosBody = document.getElementById('viajesAsignadosBody');
    const sinViajesPendientes = document.getElementById('sinViajesPendientes');
    const sinViajesAsignados = document.getElementById('sinViajesAsignados');

    // Cabeceras para las peticiones (pueden fallar si no hay token)
    const headers = token ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    } : { 'Content-Type': 'application/json' };

    // Mostrar nombre de usuario (si no hay, dejamos "Conductor")
    userNameEl.textContent = user.username || 'Conductor';

    // ------------------------------------------------
    // 3. Logout
    // ------------------------------------------------
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        // Redirigimos al login solo al hacer logout explícito
        window.location.href = 'login.html';
    });

    // ------------------------------------------------
    // 4. Navegación por pestañas
    // ------------------------------------------------
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const tab = link.getAttribute('data-tab');
            tabPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            if (tab === 'dashboard') cargarDashboard();
            else if (tab === 'viajes') cargarViajes();
            // somnolencia lo maneja drowsiness.js
        });
    });

    // Cargar dashboard al iniciar (dará error 401 si no hay token, se muestra vacío)
    cargarDashboard();

    // ------------------------------------------------
    // 5. Actualizar dashboard al cerrar el modal de somnolencia
    // ------------------------------------------------
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('modalResultado');
        if (!modal) return;

        const closeBtn = document.getElementById('modalCloseBtn');
        if (e.target === closeBtn || e.target === modal) {
            setTimeout(() => {
                const dashboardTab = document.getElementById('tab-dashboard');
                if (dashboardTab && dashboardTab.classList.contains('active')) {
                    cargarDashboard();
                }
            }, 200);
        }
    });

    // ------------------------------------------------
    // 6. Funciones de carga de datos
    // ------------------------------------------------
    async function cargarDashboard() {
        try {
            const res = await fetch('/api/conductor/dashboard', { headers });
            if (!res.ok) throw new Error('Error al cargar dashboard');
            const data = await res.json();
            viajesHoyEl.textContent = data.viajesHoy || 0;
            puntuacionActualEl.textContent = data.puntuacionSomnolencia != null ? data.puntuacionSomnolencia : '--';
            proximoViajeEl.textContent = data.proximoViaje || '--';

            if (data.ultimosViajes && data.ultimosViajes.length > 0) {
                ultimosViajesBody.innerHTML = data.ultimosViajes.map(v => `
                    <tr>
                        <td>#${v.id}</td>
                        <td>${escapeHtml(v.origen)}</td>
                        <td>${escapeHtml(v.destino)}</td>
                        <td>${new Date(v.fecha_hora_salida).toLocaleDateString('es-PE')}</td>
                        <td><span class="badge badge-${v.estado}">${v.estado}</span></td>
                    </tr>`).join('');
            } else {
                ultimosViajesBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay viajes recientes.</td></tr>';
            }
        } catch (err) {
            console.error('Dashboard:', err);
        }
    }

    async function cargarViajes() {
        try {
            const res = await fetch('/api/viajes/conductor', { headers });
            if (!res.ok) throw new Error('Error al cargar viajes');
            const data = await res.json();
            renderizarPendientes(data.pendientes || []);
            renderizarAsignados(data.asignados || []);
        } catch (err) {
            mostrarMensaje('error', err.message);
        }
    }

    function renderizarPendientes(viajes) {
        if (viajes.length === 0) {
            sinViajesPendientes.classList.remove('hidden');
            viajesPendientesBody.innerHTML = '';
            return;
        }
        sinViajesPendientes.classList.add('hidden');
        viajesPendientesBody.innerHTML = viajes.map(v => `
            <tr>
                <td>#${v.id}</td>
                <td>${escapeHtml(v.origen)}</td>
                <td>${escapeHtml(v.destino)}</td>
                <td>${new Date(v.fecha_hora_salida).toLocaleDateString('es-PE')}</td>
                <td><button class="btn btn-accent btn-sm" onclick="aceptarViaje(${v.id})">Aceptar</button></td>
            </tr>`).join('');
    }

    function renderizarAsignados(viajes) {
        if (viajes.length === 0) {
            sinViajesAsignados.classList.remove('hidden');
            viajesAsignadosBody.innerHTML = '';
            return;
        }
        sinViajesAsignados.classList.add('hidden');
        viajesAsignadosBody.innerHTML = viajes.map(v => `
            <tr>
                <td>#${v.id}</td>
                <td>${escapeHtml(v.origen)}</td>
                <td>${escapeHtml(v.destino)}</td>
                <td>${new Date(v.fecha_hora_salida).toLocaleDateString('es-PE')}</td>
                <td><span class="badge badge-${v.estado}">${v.estado}</span></td>
            </tr>`).join('');
    }

    // Aceptar viaje (función global)
    window.aceptarViaje = async (viajeId) => {
        if (!token) {
            alert('Debes iniciar sesión para aceptar viajes.');
            return;
        }
        if (!confirm('¿Aceptar este viaje?')) return;
        try {
            const res = await fetch(`/api/viajes/${viajeId}/asignar`, { method: 'PUT', headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al aceptar');
            mostrarMensaje('success', 'Viaje aceptado correctamente.');
            cargarViajes();
        } catch (err) {
            mostrarMensaje('error', err.message);
        }
    };

    // ------------------------------------------------
    // 7. Utilidades
    // ------------------------------------------------
    function mostrarMensaje(tipo, texto) {
        mensajeEl.className = `message message-${tipo}`;
        mensajeEl.textContent = texto;
        mensajeEl.classList.remove('hidden');
        setTimeout(() => mensajeEl.classList.add('hidden'), 4000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
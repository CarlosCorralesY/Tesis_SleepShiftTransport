/**
 * SleepShift Transport - Detector de Somnolencia Mejorado (con depuración y fallback)
 * - Prueba automática de 45 segundos
 * - Métricas en panel lateral: PERCLOS, EAR, MAR, parpadeos, bostezos
 * - Modal final de aptitud y guardado en BD
 */

let faceMesh;
let videoElement;
let canvasElement;
let canvasCtx;
let animationFrameId;
let isRunning = false;

// Parámetros
const ANALYSIS_WINDOW_SEC = 60;
const EAR_THRESHOLD = 0.22;
const MAR_THRESHOLD = 0.7;
const PERCLOS_THRESHOLD = 40;
const SCORE_FACTOR = 2.5;
const TEST_DURATION_SEC = 45;
const UMBRAL_APTITUD = 50;

let frameHistory = [];
let lastAlertTime = 0;

let blinkCount = 0;
let yawnCount = 0;
let wasEyeClosed = false;
let wasMouthOpen = false;

let timerInterval = null;
let secondsRemaining = TEST_DURATION_SEC;

// Últimos valores de métricas
let lastEAR = null;
let lastMAR = null;
let lastPERCLOS = null;

// Índices de landmarks
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const MOUTH     = [61, 291, 13, 14, 78, 308, 87, 317];

/* ------------------------------------------------------------
 * 1. Inicializar FaceMesh
 * ------------------------------------------------------------ */
async function initFaceMesh() {
    if (faceMesh) return;
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onResults);
}

/* ------------------------------------------------------------
 * 2. Iniciar detección y temporizador
 * ------------------------------------------------------------ */
async function startDetection() {
    if (isRunning) return;
    isRunning = true;

    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    canvasCtx = canvasElement.getContext('2d');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        videoElement.play();
    } catch (err) {
        alert('No se pudo acceder a la cámara: ' + err.message);
        isRunning = false;
        return;
    }

    videoElement.addEventListener('loadeddata', () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.height;
        detectFrame();
    });

    resetCounters();
    startTimer();
}

/* ------------------------------------------------------------
 * 3. Bucle de detección
 * ------------------------------------------------------------ */
async function detectFrame() {
    if (!isRunning || !faceMesh || !videoElement) return;
    await faceMesh.send({ image: videoElement });
    animationFrameId = requestAnimationFrame(detectFrame);
}

/* ------------------------------------------------------------
 * 4. Callback de resultados
 * ------------------------------------------------------------ */
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        drawLandmarks(landmarks);

        const earLeft  = calculateEAR(landmarks, LEFT_EYE);
        const earRight = calculateEAR(landmarks, RIGHT_EYE);
        const earAvg   = (earLeft + earRight) / 2;
        const mar      = calculateMAR(landmarks, MOUTH);

        const now = Date.now();
        frameHistory.push({ timestamp: now, ear: earAvg, mar });
        frameHistory = frameHistory.filter(f => now - f.timestamp <= ANALYSIS_WINDOW_SEC * 1000);

        const closedFrames = frameHistory.filter(f => f.ear < EAR_THRESHOLD).length;
        const perclos = frameHistory.length > 0 ? (closedFrames / frameHistory.length) * 100 : 0;
        const score = Math.min(100, Math.round(perclos * SCORE_FACTOR));

        // Guardar últimos valores
        lastEAR = earAvg;
        lastMAR = mar;
        lastPERCLOS = perclos;

        // Detectar parpadeos
        const isClosedNow = earAvg < EAR_THRESHOLD;
        if (wasEyeClosed && !isClosedNow) blinkCount++;
        wasEyeClosed = isClosedNow;

        // Detectar bostezos
        const isMouthOpenNow = mar > MAR_THRESHOLD;
        if (wasMouthOpen && !isMouthOpenNow) yawnCount++;
        wasMouthOpen = isMouthOpenNow;

        updateUI(earAvg, mar, perclos, score, blinkCount, yawnCount);

        if (perclos > PERCLOS_THRESHOLD && now - lastAlertTime > 5000) {
            lastAlertTime = now;
            triggerAlert();
        }
    }

    canvasCtx.restore();
}

/* ------------------------------------------------------------
 * 5. Cálculos geométricos
 * ------------------------------------------------------------ */
function calculateEAR(landmarks, indices) {
    const p1 = landmarks[indices[0]], p2 = landmarks[indices[1]], p3 = landmarks[indices[2]],
          p4 = landmarks[indices[3]], p5 = landmarks[indices[4]], p6 = landmarks[indices[5]];
    const vert1 = euclidean(p2, p6);
    const vert2 = euclidean(p3, p5);
    const horiz = euclidean(p1, p4);
    return (vert1 + vert2) / (2.0 * horiz);
}

function calculateMAR(landmarks, indices) {
    const p1 = landmarks[indices[0]], p2 = landmarks[indices[1]],
          p3 = landmarks[indices[2]], p4 = landmarks[indices[3]];
    return euclidean(p3, p4) / euclidean(p1, p2);
}

function euclidean(p1, p2) {
    return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
}

/* ------------------------------------------------------------
 * 6. Dibujar landmarks
 * ------------------------------------------------------------ */
function drawLandmarks(landmarks) {
    canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    for (const pt of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(pt.x * canvasElement.width, pt.y * canvasElement.height, 1.5, 0, 2*Math.PI);
        canvasCtx.fill();
    }
}

/* ------------------------------------------------------------
 * 7. Actualizar UI
 * ------------------------------------------------------------ */
function updateUI(ear, mar, perclos, score, blinks, yawns) {
    setText('puntajeSomnolencia', score);
    setText('perclosValue', perclos.toFixed(1) + '%');
    setText('earValue', ear.toFixed(3));
    setText('marValue', mar.toFixed(3));
    setText('parpadeosValue', blinks);
    const elapsedSeconds = TEST_DURATION_SEC - secondsRemaining;
    const blinksPerMin = elapsedSeconds > 0 ? Math.round((blinks / elapsedSeconds) * 60) : 0;
    setText('parpadeosPorMin', blinksPerMin + ' por minuto');
    setText('bostezosValue', yawns);

    const estadoEl = document.getElementById('estadoAlerta');
    if (estadoEl) {
        if (perclos > PERCLOS_THRESHOLD) {
            estadoEl.innerHTML = '<span style="color:red;">⚠️ SOMNOLENCIA DETECTADA</span>';
        } else {
            estadoEl.innerHTML = '<span style="color:green;">✅ Alerta</span>';
        }
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/* ------------------------------------------------------------
 * 8. Temporizador
 * ------------------------------------------------------------ */
function startTimer() {
    secondsRemaining = TEST_DURATION_SEC;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        secondsRemaining--;
        updateTimerDisplay();
        if (secondsRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            finalizarPrueba();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('segundosRestantes');
    if (timerEl) timerEl.textContent = secondsRemaining;
}

/* ------------------------------------------------------------
 * 9. Finalizar prueba, guardar en BD y mostrar modal
 * ------------------------------------------------------------ */
async function finalizarPrueba() {
    stopDetection();

    // Obtener puntuación final desde el DOM
    const scoreText = document.getElementById('puntajeSomnolencia')?.textContent;
    const finalScore = scoreText && !isNaN(scoreText) ? parseInt(scoreText) : null;
    const apto = finalScore !== null ? finalScore <= UMBRAL_APTITUD : null;

    // Construir payload
    const payload = {
        puntuacion: finalScore,
        perclos: lastPERCLOS,
        ear: lastEAR,
        mar: lastMAR,
        parpadeos: blinkCount,
        bostezos: yawnCount,
        apto: apto
    };

    console.log('Payload a enviar:', payload);

    // Guardar en backend
    try {
        const token = localStorage.getItem('token');
        if (token) {
            console.log('Enviando fetch a /api/conductor/somnolencia...');
            const res = await fetch('/api/conductor/somnolencia', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json();
                console.error('Error del servidor:', errData);
            } else {
                const data = await res.json();
                console.log('Respuesta del servidor:', data);
            }
        } else {
            console.warn('No hay token en localStorage');
        }
    } catch (err) {
        console.error('Error de red al guardar:', err);
    }

    // Mostrar modal siempre
    mostrarModalResultado(finalScore);
}

/* ------------------------------------------------------------
 * 10. Modal de resultado con fallback a alert
 * ------------------------------------------------------------ */
function mostrarModalResultado(score) {
    console.log('Intentando mostrar modal con score:', score);

    const modal = document.getElementById('modalResultado');
    if (!modal) {
        console.error('No se encontró el modal en el DOM. Usando alert.');
        const mensaje = score !== null
            ? `Puntuación: ${score}. ${score <= UMBRAL_APTITUD ? 'Apto' : 'No apto'} para manejar.`
            : 'Error al obtener la puntuación.';
        alert('Resultado de la prueba:\n' + mensaje);
        return;
    }

    const iconEl = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const scoreEl = document.getElementById('modalScore');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!iconEl || !titleEl || !messageEl || !scoreEl || !closeBtn) {
        console.error('Faltan elementos dentro del modal. Usando alert.');
        const mensaje = score !== null
            ? `Puntuación: ${score}. ${score <= UMBRAL_APTITUD ? 'Apto' : 'No apto'} para manejar.`
            : 'Error al obtener la puntuación.';
        alert('Resultado de la prueba:\n' + mensaje);
        return;
    }

    const esApto = score !== null && score <= UMBRAL_APTITUD;

    iconEl.textContent = esApto ? '✅' : '❌';
    titleEl.textContent = esApto ? '¡Apto para manejar!' : 'No apto para manejar';
    titleEl.style.color = esApto ? 'var(--success)' : 'var(--danger)';
    messageEl.textContent = esApto
        ? 'Tu nivel de alerta es adecuado. Puedes aceptar viajes.'
        : 'Tu nivel de somnolencia es alto. No puedes conducir en este momento.';
    scoreEl.textContent = score !== null ? `${score} pts` : '--';

    modal.classList.add('active');

    closeBtn.onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('active');
    };

    console.log('Modal mostrado correctamente.');
}

/* ------------------------------------------------------------
 * 11. Alerta visual y sonora
 * ------------------------------------------------------------ */
function triggerAlert() {
    const overlay = document.getElementById('alertOverlay');
    if (overlay) {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.display = 'none'; }, 2000);
    }
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) { /* ignorar */ }
}

/* ------------------------------------------------------------
 * 12. Detener la detección
 * ------------------------------------------------------------ */
function stopDetection() {
    isRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
    frameHistory = [];
}

/* ------------------------------------------------------------
 * 13. Reiniciar contadores y variables
 * ------------------------------------------------------------ */
function resetCounters() {
    blinkCount = 0;
    yawnCount = 0;
    wasEyeClosed = false;
    wasMouthOpen = false;
    frameHistory = [];
    lastEAR = null;
    lastMAR = null;
    lastPERCLOS = null;
    setText('parpadeosValue', '0');
    setText('parpadeosPorMin', '0 por minuto');
    setText('bostezosValue', '0');
    setText('puntajeSomnolencia', '--');
    setText('perclosValue', '--');
    setText('earValue', '--');
    setText('marValue', '--');
}

/* ------------------------------------------------------------
 * 14. Eventos de botones
 * ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    const btnIniciar = document.getElementById('btnIniciarPrueba');
    const btnDetener = document.getElementById('btnDetenerPrueba');

    if (btnIniciar) {
        btnIniciar.addEventListener('click', async () => {
            await initFaceMesh();
            resetCounters();
            startDetection();
        });
    }
    if (btnDetener) {
        btnDetener.addEventListener('click', () => {
            finalizarPrueba();
        });
    }
});

window.drowsiness = {
    start: async () => {
        await initFaceMesh();
        resetCounters();
        startDetection();
    },
    stop: finalizarPrueba
};
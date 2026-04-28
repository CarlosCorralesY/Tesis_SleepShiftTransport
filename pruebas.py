import cv2
import numpy as np
import time
from collections import deque

# Cargar clasificadores (siguen siendo necesarios para localizar cara y ojos)
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Parámetros ajustables
OPENNESS_THRESH = 0.15   # Umbral de abertura: por debajo se considera ojo cerrado (0 = cerrado, 1 = abierto)
CLOSED_FRAMES = 3        # Frames consecutivos cerrados para contar parpadeo
WINDOW_SEC = 30          # Ventana para PERCLOS

# Variables globales
blink_count = 0
closed_frames = 0
state_queue = deque()    # (timestamp, estado_cerrado)
prev_time = time.time()

def get_eye_openness(eye_roi):
    """
    Calcula la abertura del ojo basándose en el área de la pupila.
    Retorna un valor entre 0 (totalmente cerrado) y 1 (totalmente abierto).
    """
    h, w = eye_roi.shape[:2]
    if h == 0 or w == 0:
        return 0.0
    
    # 1. Ecualizar el histograma para mejorar contraste
    equalized = cv2.equalizeHist(eye_roi)
    
    # 2. Aplicar desenfoque gaussiano para reducir ruido
    blurred = cv2.GaussianBlur(equalized, (5, 5), 0)
    
    # 3. Umbral adaptativo para separar la pupila (oscura) del resto
    #    El ojo abierto tiene una pupila oscura claramente visible.
    #    El ojo cerrado no tendrá regiones oscuras grandes.
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)
    
    # 4. Encontrar contornos de la región oscura
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0
    
    # 5. Tomar el contorno más grande (asumimos que es la pupila)
    max_contour = max(contours, key=cv2.contourArea)
    pupil_area = cv2.contourArea(max_contour)
    
    # 6. Calcular el área total del ojo (bounding box del ojo)
    eye_area = w * h
    
    # 7. La abertura es la proporción del área de la pupila respecto al área total
    #    Normalizamos con un factor empírico (pupila abierta suele ocupar ~40% del bounding box)
    openness = pupil_area / eye_area
    # Ajustar para que un ojo abierto típico dé ~0.3-0.5 y cerrado ~0.0-0.05
    openness = min(1.0, openness * 3.0)  # Escalamos para tener rango 0-1
    return openness

def draw_eye_roi(frame, eye_roi, x, y, openness):
    """Dibuja el rectángulo del ojo y muestra la abertura numérica."""
    h, w = eye_roi.shape[:2]
    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
    cv2.putText(frame, f"{openness:.2f}", (x, y-5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)

# Inicializar cámara
cap = cv2.VideoCapture(0)
print("Sistema de fatiga mejorado activado. Presiona 'q' para salir.")

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    frame = cv2.flip(frame, 1)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detectar caras
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    eye_state = 0
    openness_avg = 0.0
    
    if len(faces) > 0:
        # Usar la cara más grande
        fx, fy, fw, fh = max(faces, key=lambda r: r[2]*r[3])
        roi_gray = gray[fy:fy+fh, fx:fx+fw]
        roi_color = frame[fy:fy+fh, fx:fx+fw]
        
        # Detectar ojos dentro de la cara
        eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5)
        if len(eyes) >= 2:
            # Ordenar por tamaño y tomar los dos más grandes
            eyes = sorted(eyes, key=lambda e: e[2]*e[3], reverse=True)[:2]
            openness_values = []
            for (ex, ey, ew, eh) in eyes:
                # Extraer la región del ojo
                eye_roi = roi_gray[ey:ey+eh, ex:ex+ew]
                openness = get_eye_openness(eye_roi)
                openness_values.append(openness)
                # Dibujar y mostrar valor
                draw_eye_roi(roi_color, eye_roi, ex, ey, openness)
            openness_avg = sum(openness_values) / len(openness_values)
            
            # Determinar si el ojo está cerrado (umbral más robusto)
            if openness_avg < OPENNESS_THRESH:
                eye_state = 1
                closed_frames += 1
            else:
                if closed_frames >= CLOSED_FRAMES:
                    blink_count += 1
                    print(f"Parpadeo detectado. Total: {blink_count}")
                closed_frames = 0
        else:
            # Si no se ven dos ojos, asumir cerrados (puede mejorar)
            eye_state = 1
            closed_frames += 1
    else:
        closed_frames = 0
    
    # PERCLOS (ventana deslizante)
    now = time.time()
    state_queue.append((now, eye_state))
    while state_queue and (now - state_queue[0][0]) > WINDOW_SEC:
        state_queue.popleft()
    
    total_closed = 0.0
    if len(state_queue) > 1:
        prev_t, prev_s = state_queue[0]
        for t, s in list(state_queue)[1:]:
            if prev_s == 1:
                total_closed += (t - prev_t)
            prev_t, prev_s = t, s
        duration = state_queue[-1][0] - state_queue[0][0]
        perclos = (total_closed / duration) * 100 if duration > 0 else 0.0
    else:
        perclos = 0.0
    
    # FPS
    curr_time = time.time()
    fps = 1 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0
    prev_time = curr_time
    
    # Mostrar métricas en pantalla
    cv2.putText(frame, f"Abertura promedio: {openness_avg:.2f}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    cv2.putText(frame, f"Parpadeos: {blink_count}", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    cv2.putText(frame, f"PERCLOS (30s): {perclos:.1f}%", (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255) if perclos > 20 else (0, 255, 0), 2)
    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 120),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
    
    if perclos > 30:
        cv2.putText(frame, "!! FATIGA !!", (frame.shape[1]//2-80, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
    
    cv2.imshow("Detector de fatiga (exacto, sin MediaPipe)", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print(f"\n--- Resumen final ---\nParpadeos totales: {blink_count}")
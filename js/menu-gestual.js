// Módulo 1: Menú Gestual con MediaPipe Pose
// Detecta si el usuario levanta la mano izquierda o derecha respecto a la nariz.

const CONFIG = {
  HOLD_DURATION: 1500,
  COOLDOWN: 3000
};

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const cardLeft = document.getElementById('card-left');
const cardRight = document.getElementById('card-right');
const progressLeft = document.getElementById('progress-left');
const progressRight = document.getElementById('progress-right');
const camLabel = document.getElementById('cam-label');

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmIcon = document.getElementById('confirm-icon');
const confirmTitle = document.getElementById('confirm-title');
const confirmMsg = document.getElementById('confirm-msg');

const state = {
  holdTarget: null,
  holdStart: 0,
  lastConfirmed: 0
};

function setStatus(text, color = '') {
  statusText.textContent = text;
  statusDot.className = `dot ${color}`;
}

function resetCards() {
  cardLeft.className = 'product-card';
  cardRight.className = 'product-card';
  progressLeft.style.width = '0%';
  progressRight.style.width = '0%';
}

function onResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) {
    resetCards();
    setStatus('No se detecta pose. Ubícate frente a la cámara.', 'amber');
    return;
  }

  const landmarks = results.poseLandmarks;

  const nose = landmarks[0];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  drawLandmarks(landmarks);

  let active = null;

  if (leftWrist.visibility > 0.5 && leftWrist.y < nose.y) {
    active = 'left';
  }

  if (rightWrist.visibility > 0.5 && rightWrist.y < nose.y) {
    active = 'right';
  }

  cardLeft.className = 'product-card' + (active === 'left' ? ' active-left' : '');
  cardRight.className = 'product-card' + (active === 'right' ? ' active-right' : '');

  const now = Date.now();

  if (now - state.lastConfirmed < CONFIG.COOLDOWN) {
    setStatus('Selección confirmada. Espera un momento.', 'green');
    progressLeft.style.width = '0%';
    progressRight.style.width = '0%';
    return;
  }

  if (active) {
    if (active !== state.holdTarget) {
      state.holdTarget = active;
      state.holdStart = now;
    }

    const elapsed = now - state.holdStart;
    const percent = Math.min((elapsed / CONFIG.HOLD_DURATION) * 100, 100);

    progressLeft.style.width = active === 'left' ? `${percent}%` : '0%';
    progressRight.style.width = active === 'right' ? `${percent}%` : '0%';

    const productName = active === 'left' ? 'Laptop' : 'Celular';
    setStatus(`${productName}. Mantén la mano en alto: ${Math.round(percent)}%`, 'green');

    if (elapsed >= CONFIG.HOLD_DURATION) {
      state.lastConfirmed = now;
      state.holdTarget = null;
      state.holdStart = 0;

      progressLeft.style.width = '0%';
      progressRight.style.width = '0%';

      triggerConfirm(active);
    }

    return;
  }

  state.holdTarget = null;
  state.holdStart = 0;
  progressLeft.style.width = '0%';
  progressRight.style.width = '0%';
  setStatus('Listo. Levanta una mano para seleccionar.', 'green');
}

function drawLandmarks(landmarks) {
  const width = canvas.width;
  const height = canvas.height;

  const points = {
    0: { color: '#EF9F27', radius: 6 },
    15: { color: '#378ADD', radius: 8 },
    16: { color: '#1D9E75', radius: 8 },
    11: { color: '#aaaacc', radius: 4 },
    12: { color: '#aaaacc', radius: 4 },
    13: { color: '#aaaacc', radius: 4 },
    14: { color: '#aaaacc', radius: 4 }
  };

  const connections = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16]
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';

  connections.forEach(([a, b]) => {
    const pointA = landmarks[a];
    const pointB = landmarks[b];

    if (pointA.visibility > 0.3 && pointB.visibility > 0.3) {
      ctx.beginPath();
      ctx.moveTo((1 - pointA.x) * width, pointA.y * height);
      ctx.lineTo((1 - pointB.x) * width, pointB.y * height);
      ctx.stroke();
    }
  });

  Object.entries(points).forEach(([index, style]) => {
    const point = landmarks[index];

    if (point && point.visibility > 0.3) {
      ctx.beginPath();
      ctx.arc((1 - point.x) * width, point.y * height, style.radius, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.fill();
    }
  });
}

function triggerConfirm(side) {
  const isLeft = side === 'left';

  confirmIcon.innerHTML = isLeft
    ? '<i class="bi bi-laptop"></i>'
    : '<i class="bi bi-phone"></i>';

  confirmTitle.textContent = isLeft
    ? 'Laptop seleccionada'
    : 'Celular seleccionado';

  confirmMsg.textContent = isLeft
    ? 'Has elegido la UltraBook Pro X1. Un vendedor te atenderá en breve.'
    : 'Has elegido el SmartPhone Z Ultra. Un vendedor te atenderá en breve.';

  confirmOverlay.classList.add('show');
  resetCards();
}

function closeConfirm() {
  confirmOverlay.classList.remove('show');
  state.lastConfirmed = Date.now();
  setStatus('Listo. Levanta una mano para seleccionar.', 'green');
}

async function startDetection() {
  const button = document.getElementById('start-btn');

  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split"></i> Cargando MediaPipe...';
  setStatus('Iniciando MediaPipe Pose...', 'amber');

  const pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  pose.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 280,
    height: 210
  });

  try {
    await camera.start();
    camLabel.textContent = 'Cámara activa';
    setStatus('Listo. Levanta una mano para seleccionar.', 'green');
    button.style.display = 'none';
  } catch (error) {
    console.error(error);
    setStatus('Error al acceder a la cámara.', 'red');
    camLabel.textContent = 'Error de cámara';
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Reintentar';
  }
}
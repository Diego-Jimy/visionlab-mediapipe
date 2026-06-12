// Pizarra Digital Interactiva con MediaPipe Hands
// Cámara oculta, pincel persistente y borrador con gesto de pinza.

const video = document.getElementById('video');

const canvasDraw = document.getElementById('canvas-draw');
const canvasHand = document.getElementById('canvas-hand');

const ctxDraw = canvasDraw.getContext('2d');
const ctxHand = canvasHand.getContext('2d');

const statusText = document.getElementById('status-text');
const modeBadge = document.getElementById('mode-badge');
const camError = document.getElementById('cam-error');

const btnClear = document.getElementById('btn-clear');
const colorPicker = document.getElementById('color-picker');
const brushSizeSelect = document.getElementById('brush-size');
const brushStyleSelect = document.getElementById('brush-style');
const helpCloseBtn = document.getElementById('btn-help-close');

const PINCH_THRESHOLD = 0.055;
const TAP_THRESHOLD = 0.07;
const TAP_COOLDOWN = 900;
const ERASE_RADIUS = 38;
const SMOOTHING = 0.32;

let brushEnabled = false;
let currentMode = 'rest';

let brushColor = colorPicker.value;
let brushSize = Number(brushSizeSelect.value);
let brushStyle = brushStyleSelect.value;

let prevX = null;
let prevY = null;
let smoothX = null;
let smoothY = null;

let tapWasClosed = false;
let lastToggleTime = 0;

colorPicker.addEventListener('change', () => {
  brushColor = colorPicker.value;
});

brushSizeSelect.addEventListener('change', () => {
  brushSize = Number(brushSizeSelect.value);
});

brushStyleSelect.addEventListener('change', () => {
  brushStyle = brushStyleSelect.value;
});

btnClear.addEventListener('click', () => {
  ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
});

if (helpCloseBtn) {
  helpCloseBtn.addEventListener('click', () => {
    document.getElementById('help-card')?.remove();
  });
}

function resizeCanvases() {
  const board = document.querySelector('.board-container');
  const rect = board.getBoundingClientRect();

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (canvasDraw.width !== width) {
    canvasDraw.width = width;
  }

  if (canvasDraw.height !== height) {
    canvasDraw.height = height;
  }

  if (canvasHand.width !== width) {
    canvasHand.width = width;
  }

  if (canvasHand.height !== height) {
    canvasHand.height = height;
  }

  ctxDraw.lineCap = 'round';
  ctxDraw.lineJoin = 'round';
}

window.addEventListener('resize', resizeCanvases);

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.55
});

hands.onResults(onResults);

async function init() {
  try {
    resizeCanvases();

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480
    });

    await camera.start();

    statusText.textContent = 'Pulgar + medio: activar pincel. Índice + pulgar: borrar.';
  } catch (error) {
    console.error(error);
    camError.classList.remove('hidden');
    statusText.textContent = 'Error al iniciar cámara o MediaPipe.';
  }
}

function onResults(results) {
  resizeCanvases();
  ctxHand.clearRect(0, 0, canvasHand.width, canvasHand.height);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    setMode('rest', 'Mano fuera de encuadre.');
    resetStroke();
    resetSmoothing();
    tapWasClosed = false;
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];

  detectBrushToggle(thumbTip, middleTip);

  const eraserDistance = distance(thumbTip, indexTip);
  const isEraser = eraserDistance < PINCH_THRESHOLD;

  const point = getCanvasPoint(indexTip);
  const smoothPoint = smoothPosition(point.x, point.y);

  if (isEraser) {
    setMode('erase', 'Borrador activo.');
    eraseAt(smoothPoint.x, smoothPoint.y);
    resetStroke();
  } else if (brushEnabled) {
    setMode('draw', 'Pincel activo.');
    drawStroke(smoothPoint.x, smoothPoint.y);
  } else {
    setMode('rest', 'Pincel desactivado. Junta pulgar + medio para activar.');
    resetStroke();
  }

  drawCursor(smoothPoint.x, smoothPoint.y);
}

function detectBrushToggle(thumbTip, middleTip) {
  const tapDistance = distance(thumbTip, middleTip);
  const isTapClosed = tapDistance < TAP_THRESHOLD;
  const now = Date.now();

  if (isTapClosed && !tapWasClosed && now - lastToggleTime > TAP_COOLDOWN) {
    brushEnabled = !brushEnabled;
    lastToggleTime = now;
    resetStroke();

    statusText.textContent = brushEnabled
      ? 'Pincel activado.'
      : 'Pincel desactivado.';
  }

  tapWasClosed = isTapClosed;
}

function drawStroke(x, y) {
  if (prevX === null || prevY === null) {
    prevX = x;
    prevY = y;
    return;
  }

  ctxDraw.save();

  ctxDraw.strokeStyle = brushColor;
  ctxDraw.lineWidth = brushSize;

  if (brushStyle === 'laser') {
    ctxDraw.shadowColor = brushColor;
    ctxDraw.shadowBlur = 18;
  }

  if (brushStyle === 'marker') {
    ctxDraw.globalAlpha = 0.65;
    ctxDraw.lineWidth = brushSize + 6;
  }

  ctxDraw.beginPath();
  ctxDraw.moveTo(prevX, prevY);
  ctxDraw.lineTo(x, y);
  ctxDraw.stroke();

  ctxDraw.restore();

  prevX = x;
  prevY = y;
}

function eraseAt(x, y) {
  ctxDraw.save();
  ctxDraw.globalCompositeOperation = 'destination-out';

  ctxDraw.beginPath();
  ctxDraw.arc(x, y, ERASE_RADIUS, 0, Math.PI * 2);
  ctxDraw.fill();

  ctxDraw.restore();
}

function drawCursor(x, y) {
  ctxHand.save();

  if (currentMode === 'erase') {
    ctxHand.strokeStyle = '#ff6b6b';
    ctxHand.lineWidth = 3;
    ctxHand.setLineDash([8, 6]);

    ctxHand.beginPath();
    ctxHand.arc(x, y, ERASE_RADIUS, 0, Math.PI * 2);
    ctxHand.stroke();

    ctxHand.fillStyle = '#ff6b6b';
    ctxHand.font = '24px Segoe UI, sans-serif';
    ctxHand.fillText('⌫', x - 10, y + 8);
  } else {
    const color = brushEnabled ? brushColor : '#9a9aad';

    ctxHand.strokeStyle = color;
    ctxHand.fillStyle = color;
    ctxHand.lineWidth = 3;
    ctxHand.shadowColor = color;
    ctxHand.shadowBlur = brushEnabled ? 16 : 0;

    ctxHand.beginPath();
    ctxHand.arc(x, y, brushSize + 8, 0, Math.PI * 2);
    ctxHand.stroke();

    ctxHand.beginPath();
    ctxHand.arc(x, y, 4, 0, Math.PI * 2);
    ctxHand.fill();
  }

  ctxHand.restore();
}

function setMode(mode, message) {
  currentMode = mode;
  modeBadge.className = `mode-badge ${mode}`;

  if (mode === 'draw') {
    modeBadge.textContent = 'PINCEL';
  } else if (mode === 'erase') {
    modeBadge.textContent = 'BORRADOR';
  } else {
    modeBadge.textContent = 'REPOSO';
  }

  statusText.textContent = message;
}

function smoothPosition(x, y) {
  smoothX = smoothX === null ? x : smoothX + (x - smoothX) * SMOOTHING;
  smoothY = smoothY === null ? y : smoothY + (y - smoothY) * SMOOTHING;

  return {
    x: smoothX,
    y: smoothY
  };
}

function getCanvasPoint(point) {
  return {
    x: (1 - point.x) * canvasDraw.width,
    y: point.y * canvasDraw.height
  };
}

function resetStroke() {
  prevX = null;
  prevY = null;
}

function resetSmoothing() {
  smoothX = null;
  smoothY = null;
}

function distance(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2)
  );
}

init();
// Instrumento Virtual Gestual
// Piano visual a pantalla completa con manos láser y control de volumen por pinza.

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const statusText = document.getElementById('status-text');
const camError = document.getElementById('cam-error');
const keys = document.querySelectorAll('.key');

const volumeFill = document.getElementById('volume-fill');
const volumeValue = document.getElementById('volume-value');
const pinchIndicator = document.getElementById('pinch-indicator');

const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4'];

const PINCH_THRESHOLD = 0.075;
const NOTE_COOLDOWN = 220;

let synth = null;
let toneStarted = false;
let lastNote = null;
let lastNoteTime = 0;
let currentVolume = 50;

document.addEventListener('click', startAudio);

async function startAudio() {
  if (toneStarted) return;

  await Tone.start();

  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: 'triangle'
    },
    envelope: {
      attack: 0.02,
      decay: 0.18,
      sustain: 0.35,
      release: 0.45
    }
  }).toDestination();

  Tone.getDestination().volume.value = -12;

  toneStarted = true;
  statusText.textContent = 'Sonido activado. Toca el piano con tu dedo índice.';
}

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.6
});

hands.onResults(onResults);

async function init() {
  try {
    resizeCanvas();

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480
    });

    await camera.start();

    statusText.textContent = 'Haz clic en la pantalla para activar el sonido.';
  } catch (error) {
    console.error(error);
    camError.classList.remove('hidden');
    statusText.textContent = 'Error al iniciar cámara o MediaPipe.';
  }
}

function onResults(results) {
  resizeCanvas();
  clearVisuals();
  clearKeys();
  pinchIndicator.classList.remove('active');

  const handsLandmarks = results.multiHandLandmarks;

  if (!handsLandmarks || handsLandmarks.length === 0) {
    statusText.textContent = toneStarted
      ? 'Muestra tus manos frente a la cámara.'
      : 'Haz clic en la pantalla para activar el sonido.';
    return;
  }

  handsLandmarks.forEach((landmarks) => {
    const indexFinger = landmarks[8];
    const thumb = landmarks[4];

    const pinchDistance = getDistance(thumb, indexFinger);
    const isPinching = pinchDistance < PINCH_THRESHOLD;

    drawLaserHand(landmarks, isPinching);

    if (isPinching) {
      handleVolume(indexFinger.y);
      pinchIndicator.classList.add('active');
      return;
    }

    handleNote(indexFinger);
  });
}

function handleNote(indexFinger) {
  const point = toCanvasPoint(indexFinger);
  const stageWidth = canvas.width;
  const stageHeight = canvas.height;

  const pianoTouchZone = point.y > stageHeight * 0.15;

  if (!pianoTouchZone) return;

  const zoneIndex = Math.min(
    Math.floor(point.x / (stageWidth / NOTES.length)),
    NOTES.length - 1
  );

  const note = NOTES[zoneIndex];
  const key = keys[zoneIndex];

  if (!key) return;

  key.classList.add('active');
  drawTouchPulse(point.x, point.y, key);

  const now = Date.now();

  if (note !== lastNote || now - lastNoteTime > NOTE_COOLDOWN) {
    lastNote = note;
    lastNoteTime = now;
    playNote(note);
  }
}

function playNote(note) {
  if (!toneStarted || !synth) return;

  synth.triggerAttackRelease(note, '8n');
}

function handleVolume(yNorm) {
  currentVolume = Math.round((1 - yNorm) * 100);
  currentVolume = Math.max(0, Math.min(100, currentVolume));

  const db = -40 + (currentVolume / 100) * 40;
  Tone.getDestination().volume.value = db;

  volumeFill.style.height = `${currentVolume}%`;
  volumeValue.textContent = `${currentVolume}%`;

  if (toneStarted) {
    statusText.textContent = `Volumen: ${currentVolume}%`;
  }
}

function drawLaserHand(landmarks, isPinching) {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20]
  ];

  const color = isPinching ? '#00d4aa' : '#6c63ff';

  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;

  connections.forEach(([start, end]) => {
    const a = toCanvasPoint(landmarks[start]);
    const b = toCanvasPoint(landmarks[end]);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  landmarks.forEach((point, index) => {
    const p = toCanvasPoint(point);
    const isTip = index === 4 || index === 8;

    ctx.beginPath();
    ctx.arc(p.x, p.y, isTip ? 8 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isTip ? '#ffffff' : color;
    ctx.fill();
  });

  ctx.restore();
}

function drawTouchPulse(x, y, key) {
  const color = getComputedStyle(key).getPropertyValue('--col').trim();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.stroke();
  ctx.restore();
}

function clearKeys() {
  keys.forEach((key) => key.classList.remove('active'));
}

function toCanvasPoint(point) {
  return {
    x: (1 - point.x) * canvas.width,
    y: point.y * canvas.height
  };
}

function getDistance(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2)
  );
}

function clearVisuals() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();

  if (canvas.width !== Math.round(rect.width)) {
    canvas.width = Math.round(rect.width);
  }

  if (canvas.height !== Math.round(rect.height)) {
    canvas.height = Math.round(rect.height);
  }
}

window.addEventListener('resize', resizeCanvas);

init();
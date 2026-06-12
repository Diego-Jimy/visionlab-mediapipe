// Módulo 2: Carrusel Coverflow con MediaPipe Pose
// Desplaza el carrusel completo y detecta gestos laterales.

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const statusText = document.getElementById('status-text');
const camError = document.getElementById('cam-error');
const carousel = document.getElementById('carousel');
const cards = document.querySelectorAll('.card-item');

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

let centralIndex = 2;
let cooldown = false;

const COOLDOWN_MS = 600;
const MIN_VISIBILITY = 0.5;
const GESTURE_DISTANCE = 0.18;

function setStatus(message) {
  statusText.textContent = message;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function onResults(results) {
  clearCanvas();

  if (!results.poseLandmarks) {
    setStatus('No se detecta pose. Ubícate frente a la cámara.');
    return;
  }

  const landmarks = results.poseLandmarks;

  const nose = landmarks[0];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  drawPosePoints(landmarks);

  if (!isVisible(nose)) {
    setStatus('Colócate frente a la cámara.');
    return;
  }

  if (cooldown) return;

  const rightHandToLeft =
    isVisible(rightWrist) &&
    rightWrist.x < nose.x - GESTURE_DISTANCE;

  const leftHandToRight =
    isVisible(leftWrist) &&
    leftWrist.x > nose.x + GESTURE_DISTANCE;

  if (rightHandToLeft) {
    moveCarousel(1);
    setStatus('Avanzando a la siguiente imagen.');
    return;
  }

  if (leftHandToRight) {
    moveCarousel(-1);
    setStatus('Retrocediendo a la imagen anterior.');
    return;
  }

  setStatus('Extiende una mano hacia los lados para navegar.');
}

function isVisible(point) {
  return point && point.visibility >= MIN_VISIBILITY;
}

function moveCarousel(direction) {
  const nextIndex = centralIndex + direction;

  if (nextIndex < 0 || nextIndex >= cards.length) {
    setStatus('Límite del carrusel.');
    startCooldown();
    return;
  }

  cards[centralIndex].classList.remove('central');
  centralIndex = nextIndex;
  cards[centralIndex].classList.add('central');

  updateCarouselPosition();
  startCooldown();
}

function updateCarouselPosition() {
  const cardWidth = cards[0].offsetWidth;
  const styles = window.getComputedStyle(carousel);
  const gap = parseFloat(styles.columnGap || styles.gap) || 22;

  const centerIndex = Math.floor(cards.length / 2);
  const offset = (centerIndex - centralIndex) * (cardWidth + gap);

  carousel.style.setProperty('--offset', `${offset}px`);
}

function startCooldown() {
  cooldown = true;

  setTimeout(() => {
    cooldown = false;
    setStatus('Modelo listo. Extiende una mano hacia los lados.');
  }, COOLDOWN_MS);
}

function drawPosePoints(landmarks) {
  const width = canvas.width;
  const height = canvas.height;

  const points = {
    0: { color: '#00d4aa', radius: 6 },
    15: { color: '#6c63ff', radius: 8 },
    16: { color: '#ffcc00', radius: 8 }
  };

  Object.entries(points).forEach(([index, style]) => {
    const point = landmarks[index];

    if (!point || point.visibility < 0.4) return;

    const x = (1 - point.x) * width;
    const y = point.y * height;

    ctx.beginPath();
    ctx.arc(x, y, style.radius, 0, Math.PI * 2);
    ctx.fillStyle = style.color;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
}

async function startDetection() {
  try {
    setStatus('Iniciando MediaPipe Pose...');

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);

    const camera = new Camera(video, {
      onFrame: async () => {
        await pose.send({ image: video });
      },
      width: 320,
      height: 240
    });

    await camera.start();

    updateCarouselPosition();
    setStatus('Modelo listo. Extiende una mano hacia los lados.');
  } catch (error) {
    showError(error);
  }
}

function showError(error) {
  console.error(error);

  camError.classList.remove('hidden');
  setStatus('Error al iniciar cámara o MediaPipe Pose.');
}

if (btnPrev && btnNext) {
  btnPrev.addEventListener('click', () => moveCarousel(-1));
  btnNext.addEventListener('click', () => moveCarousel(1));
}

window.addEventListener('resize', updateCarouselPosition);

startDetection();
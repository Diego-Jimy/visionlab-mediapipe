// ─────────────────────────────────────────────────────────────
//  CAZADOR DE BURBUJAS — videojuego.js
//
//  Nivel 1 · 3 carriles · 30 s
//  Nivel 2 · 4 carriles · 30 s  (más velocidad)
//  Nivel 3 · libre     · 30 s  (burbuja escapada = -1 pto)
//  Game Over si puntos llegan a 0 en nivel 3
//
//  Inicio   : gesto pulgar + medio
//  Colisión : solo dedo medio (punto 12) — 1 bolita por mano
// ─────────────────────────────────────────────────────────────

// ── Referencias DOM ──────────────────────────────────────────
const video           = document.getElementById('video');
const canvas          = document.getElementById('canvas');
const ctx             = canvas.getContext('2d', { desynchronized: true }); // menos latencia
const scoreEl         = document.getElementById('score');
const timerEl         = document.getElementById('timer');
const levelEl         = document.getElementById('level-display');
const camError        = document.getElementById('cam-error');
const loadingEl       = document.getElementById('loading');
const startScreen     = document.getElementById('start-screen');
const countdownScreen = document.getElementById('countdown-screen');
const countdownLevel  = document.getElementById('countdown-level');
const countdownSub    = document.getElementById('countdown-sub');
const countdownNum    = document.getElementById('countdown-num');
const gameoverScreen  = document.getElementById('gameover-screen');
const finalScoreEl    = document.getElementById('final-score');
const btnRestart      = document.getElementById('btn-restart');
const instructions    = document.getElementById('instructions');

// ── Configuración por nivel ───────────────────────────────────
const LEVELS = [
  { id: 1, lanes: 3, minSpd: 1.6, maxSpd: 3.0, interval: 850, penalty: false },
  { id: 2, lanes: 4, minSpd: 2.2, maxSpd: 4.0, interval: 750, penalty: false },
  { id: 3, lanes: 0, minSpd: 2.8, maxSpd: 5.0, interval: 650, penalty: true  },
];
const LEVEL_DURATION  = 30;   // segundos por nivel
const PINCH_THRESHOLD = 0.08; // distancia normalizada pulgar-medio para iniciar
const FINGER_R        = 18;   // radio visual del dedo
const HIT_PAD         = 6;    // tolerancia extra en colisión (px)
const LERP            = 0.28; // suavizado de posición (menor = más suave)
const PERSIST         = 12;   // frames que dura el dedo sin nueva detección
const COOLDOWN_MS     = 130;  // ms mínimo entre colisiones del mismo dedo
const MIN_R           = 24;
const MAX_R           = 56;
const COLORS          = ['#6c63ff','#00d4aa','#ff6b9d','#ffbe3d','#5ee7ff'];

// Textos descriptivos para la cuenta regresiva
const LEVEL_INFO = [
  '',
  '3 carriles · ¡a calentar!',
  '4 carriles · más velocidad',
  'Sin carriles · ¡no dejes escapar ninguna!',
];

// ── Estado global ─────────────────────────────────────────────
let score        = 0;
let bubbles      = [];
let particles    = [];
let laneXs       = [];      // posiciones X de los carriles actuales
let loopRunning  = false;   // el rAF ya arrancó
let paused       = false;   // true durante cuenta regresiva

// Estado del juego: 'waiting' | 'playing' | 'countdown' | 'gameover'
let state        = 'waiting';

let currentLevel = 0;       // índice en LEVELS (0-based)
let levelTimer   = 0;       // segundos restantes en este nivel
let lastSecTs    = 0;       // timestamp del último tick de segundo
let lastSpawn    = 0;       // timestamp del último spawn

// ── Registro de dedos (Map estable, 1 bolita por mano) ────────
const fingerMap = new Map();

function feedFingers(rawList) {
  for (const f of fingerMap.values()) f.fresh = false;

  for (const raw of rawList) {
    if (fingerMap.has(raw.key)) {
      const f = fingerMap.get(raw.key);
      // Interpolación suave → elimina jitter de MediaPipe
      f.x = f.x + (raw.x - f.x) * LERP;
      f.y = f.y + (raw.y - f.y) * LERP;
      f.framesLeft = PERSIST;
      f.fresh      = true;
    } else {
      fingerMap.set(raw.key, {
        x: raw.x, y: raw.y,
        framesLeft: PERSIST,
        lastHit: 0,
        fresh: true,
      });
    }
  }

  // Reducir persistencia de dedos no detectados
  for (const [key, f] of fingerMap) {
    if (!f.fresh) {
      f.framesLeft--;
      if (f.framesLeft <= 0) fingerMap.delete(key);
    }
  }
}

// ── Canvas responsive ─────────────────────────────────────────
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  bubbles = bubbles.filter(b => b.x > 0 && b.x < canvas.width);
  buildLanes();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Carriles ─────────────────────────────────────────────────
// Calcula las posiciones X de los carriles según el nivel actual
function buildLanes() {
  const lvl = LEVELS[currentLevel];
  laneXs = [];
  if (lvl.lanes === 0) return; // nivel 3: sin carriles

  const margin = 60;
  const usable = canvas.width - margin * 2;
  for (let i = 0; i < lvl.lanes; i++) {
    laneXs.push(margin + (usable / (lvl.lanes - 1)) * i);
  }
}

// ── Burbujas ─────────────────────────────────────────────────
function spawnBubble() {
  const lvl = LEVELS[currentLevel];
  const r   = rnd(MIN_R, MAX_R);
  let x;

  if (laneXs.length > 0) {
    // Nivel 1-2: elige un carril al azar
    x = laneXs[Math.floor(Math.random() * laneXs.length)] + rnd(-8, 8);
  } else {
    // Nivel 3: posición libre
    x = rnd(r, canvas.width - r);
  }

  bubbles.push({
    x,
    y:      -r,
    r,
    vy:     rnd(lvl.minSpd, lvl.maxSpd),
    color:  COLORS[Math.floor(Math.random() * COLORS.length)],
    pulse:  Math.random() * Math.PI * 2,
    active: true,
  });
}

function updateBubbles() {
  for (const b of bubbles) {
    b.y    += b.vy;
    b.pulse += 0.045;
  }

  const lvl = LEVELS[currentLevel];

  // Penalización nivel 3: burbuja escapada → -1 punto
  if (lvl.penalty) {
    for (const b of bubbles) {
      if (b.active && b.y - b.r > canvas.height) {
        b.active = false;
        score    = Math.max(0, score - 1);
        updateScoreDisplay();

        // Game Over si score llega a 0
        if (score === 0) {
          triggerGameOver();
          return;
        }
      }
    }
  }

  bubbles = bubbles.filter(b => b.active && b.y - b.r < canvas.height);
}

// ── Colisiones ────────────────────────────────────────────────
function checkCollisions(now) {
  for (const f of fingerMap.values()) {
    if (now - f.lastHit < COOLDOWN_MS) continue;

    for (const b of bubbles) {
      if (!b.active) continue;
      if (Math.hypot(f.x - b.x, f.y - b.y) <= b.r + HIT_PAD) {
        b.active  = false;
        f.lastHit = now;
        score    += 10;
        updateScoreDisplay();
        burst(b.x, b.y, b.color);
        break; // 1 burbuja por dedo por frame
      }
    }
  }
}

function updateScoreDisplay() {
  scoreEl.textContent = score;
  scoreEl.classList.remove('pop');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('pop');
  setTimeout(() => scoreEl.classList.remove('pop'), 150);
}

// ── Partículas ────────────────────────────────────────────────
function burst(x, y, color) {
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = rnd(2.5, 8);
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r:  rnd(2.5, 5.5),
      alpha: 1, color,
    });
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.10;
    p.vx   *= 0.97;
    p.alpha -= 0.030;
  }
  // Limitar a 150 partículas para no saturar el renderer
  particles = particles.filter(p => p.alpha > 0).slice(-150);
}

// ── Temporizador de nivel ─────────────────────────────────────
function tickTimer(ts) {
  if (lastSecTs === 0) { lastSecTs = ts; return; }

  if (ts - lastSecTs >= 1000) {
    lastSecTs = ts;
    levelTimer--;
    timerEl.textContent = levelTimer;

    // Urgencia visual en los últimos 5 segundos
    timerEl.classList.toggle('urgent', levelTimer <= 5);

    if (levelTimer <= 0) {
      timerEl.classList.remove('urgent');
      advanceLevel();
    }
  }
}

// ── Avanzar de nivel ──────────────────────────────────────────
function advanceLevel() {
  if (currentLevel >= LEVELS.length - 1) {
    // Era el último nivel → Game Over (victoria)
    triggerGameOver();
    return;
  }

  paused = true;
  state  = 'countdown';
  bubbles = []; // limpiar pantalla

  currentLevel++;
  buildLanes();

  const lvl = LEVELS[currentLevel];
  countdownLevel.textContent = `¡Nivel ${lvl.id}!`;
  countdownSub.textContent   = LEVEL_INFO[lvl.id];
  levelEl.textContent        = lvl.id;

  countdownScreen.classList.remove('hidden');
  runCountdown(3);
}

function runCountdown(n) {
  if (n <= 0) {
    // Reanudar juego
    countdownScreen.classList.add('hidden');
    paused     = false;
    state      = 'playing';
    levelTimer = LEVEL_DURATION;
    lastSecTs  = 0;
    lastSpawn  = 0;
    timerEl.textContent = levelTimer;
    return;
  }

  countdownNum.textContent = n;
  // Reiniciar animación CSS del número
  countdownNum.style.animation = 'none';
  void countdownNum.offsetWidth;
  countdownNum.style.animation = '';

  setTimeout(() => runCountdown(n - 1), 1000);
}

// ── Game Over ─────────────────────────────────────────────────
function triggerGameOver() {
  state  = 'gameover';
  paused = true;
  bubbles = [];

  finalScoreEl.textContent = score;
  gameoverScreen.classList.remove('hidden');
}

function restartGame() {
  // Reiniciar todo el estado
  score        = 0;
  bubbles      = [];
  particles    = [];
  currentLevel = 0;
  levelTimer   = LEVEL_DURATION;
  lastSecTs    = 0;
  lastSpawn    = 0;
  paused       = false;
  state        = 'playing';

  buildLanes();

  scoreEl.textContent = 0;
  timerEl.textContent = LEVEL_DURATION;
  levelEl.textContent = LEVELS[0].id;
  timerEl.classList.remove('urgent');

  gameoverScreen.classList.add('hidden');
  startScreen.classList.add('hidden');
  instructions.classList.remove('hidden');
}

btnRestart.addEventListener('click', restartGame);

// ── Dibujo ────────────────────────────────────────────────────
function drawBG() {
  ctx.fillStyle = '#050509';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Viñeta radial sutil (sin shadowBlur para mayor rendimiento)
  const g = ctx.createRadialGradient(
    canvas.width * .5, canvas.height * .4, 0,
    canvas.width * .5, canvas.height * .4, canvas.width * .75
  );
  g.addColorStop(0, 'rgba(108,99,255,.08)');
  g.addColorStop(1, 'rgba(0,0,0,.40)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Dibuja líneas verticales de los carriles
function drawLanes() {
  if (laneXs.length === 0) return;

  ctx.save();
  ctx.setLineDash([6, 12]);
  ctx.lineWidth   = 1;
  ctx.strokeStyle = 'rgba(108,99,255,0.22)';

  for (const x of laneXs) {
    ctx.beginPath();
    ctx.moveTo(x, 68);          // empieza debajo del HUD
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // Etiqueta numérica arriba de cada carril
  ctx.fillStyle = 'rgba(108,99,255,0.35)';
  ctx.font      = '600 11px Segoe UI, system-ui';
  ctx.textAlign = 'center';
  for (let i = 0; i < laneXs.length; i++) {
    ctx.fillText(`C${i + 1}`, laneXs[i], 85);
  }

  ctx.restore();
}

function drawBubbles() {
  for (const b of bubbles) {
    const glow = 0.65 + 0.35 * Math.sin(b.pulse);
    ctx.save();

    // Relleno translúcido
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color + '28';
    ctx.fill();

    // Borde brillante — sin shadowBlur, usamos anillos para simular glow
    ctx.lineWidth   = 2.5;
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = glow;
    ctx.stroke();

    // Halo 1
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = b.color + '55';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = glow * 0.6;
    ctx.stroke();

    // Halo 2 (más amplio, muy tenue)
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 9, 0, Math.PI * 2);
    ctx.strokeStyle = b.color + '22';
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = glow * 0.3;
    ctx.stroke();

    // Destello interior
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x - b.r * .26, b.y - b.r * .30, b.r * .20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.50)';
    ctx.fill();

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    // Anillos en vez de shadowBlur para partículas (más rápido)
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = p.color + '55';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();
  }
}

// 1 bolita por mano: solo dedo medio
function drawFingers() {
  for (const f of fingerMap.values()) {
    const alpha = Math.min(1, f.framesLeft / 5);
    ctx.save();

    // Círculo relleno
    ctx.beginPath();
    ctx.arc(f.x, f.y, FINGER_R, 0, Math.PI * 2);
    ctx.fillStyle   = '#00d4aa';
    ctx.globalAlpha = alpha * 0.88;
    ctx.fill();

    // Anillo 1
    ctx.beginPath();
    ctx.arc(f.x, f.y, FINGER_R + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#00d4aa99';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = alpha * 0.5;
    ctx.stroke();

    // Anillo 2
    ctx.beginPath();
    ctx.arc(f.x, f.y, FINGER_R + 13, 0, Math.PI * 2);
    ctx.strokeStyle = '#00d4aa44';
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = alpha * 0.25;
    ctx.stroke();

    ctx.restore();
  }
}

// ── Game Loop ─────────────────────────────────────────────────
function gameLoop(ts) {
  requestAnimationFrame(gameLoop);

  // Si está pausado (cuenta regresiva) solo dibuja el estado congelado
  if (paused) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBG();
    drawLanes();
    drawBubbles();
    drawParticles();
    drawFingers();
    return;
  }

  if (state !== 'playing') return;

  // Spawn de burbuja según intervalo del nivel actual
  const interval = LEVELS[currentLevel].spawnInterval || 750;
  if (ts - lastSpawn > interval) {
    spawnBubble();
    lastSpawn = ts;
  }

  tickTimer(ts);
  updateBubbles();
  updateParticles();
  checkCollisions(ts);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBG();
  drawLanes();
  drawBubbles();
  drawParticles();
  drawFingers();
}

// ── MediaPipe Hands ───────────────────────────────────────────
const hands = new Hands({
  locateFile: f =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`
});

hands.setOptions({
  maxNumHands:            2,
  modelComplexity:        0,      // 0 = más rápido, menos lag
  minDetectionConfidence: 0.70,
  minTrackingConfidence:  0.60,
});

hands.onResults(results => {
  const raw = [];

  if (results.multiHandLandmarks && results.multiHandedness) {
    results.multiHandLandmarks.forEach((lms, i) => {
      const label = results.multiHandedness[i]?.label ?? `H${i}`;

      // Solo dedo medio (punto 12) como colisionador
      const mid = lms[12];
      raw.push({
        key: `${label}_mid`,
        x:   (1 - mid.x) * canvas.width,
        y:   mid.y * canvas.height,
      });

      // Gesto de inicio: pulgar (4) cerca del medio (12)
      if (state === 'waiting') {
        const thumb = lms[4];
        const d     = Math.hypot(thumb.x - mid.x, thumb.y - mid.y);
        if (d < PINCH_THRESHOLD) startGame();
      }
    });
  }

  feedFingers(raw);
});

// ── Iniciar juego ─────────────────────────────────────────────
function startGame() {
  if (state !== 'waiting') return;

  state      = 'playing';
  levelTimer = LEVEL_DURATION;
  lastSecTs  = 0;

  buildLanes();
  levelEl.textContent = LEVELS[currentLevel].id;
  timerEl.textContent = levelTimer;

  startScreen.classList.add('hidden');
  instructions.classList.remove('hidden');
}

// ── Inicialización ────────────────────────────────────────────
async function init() {
  try {
    const camera = new Camera(video, {
      onFrame: async () => { await hands.send({ image: video }); },
      width:  320,   // resolución reducida → menos lag en MediaPipe
      height: 240,
    });

    await camera.start();
    loadingEl.classList.add('hidden');

    if (!loopRunning) {
      loopRunning = true;
      requestAnimationFrame(gameLoop);
    }
  } catch (err) {
    console.error(err);
    loadingEl.classList.add('hidden');
    camError.classList.remove('hidden');
  }
}

// Número aleatorio entre min y max
function rnd(min, max) { return min + Math.random() * (max - min); }

init();
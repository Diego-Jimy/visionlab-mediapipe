// Probador Virtual de Accesorios con MediaPipe Face Mesh
// Catálogo fijo + imagen personalizada + limpieza automática de fondo.

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const camError = document.getElementById('cam-error');
const arLoading = document.getElementById('ar-loading');
const uploadBox = document.getElementById('upload-box');

const catItems = document.querySelectorAll('.catalog-item');
const customUpload = document.getElementById('custom-upload');
const removeCustomBtn = document.getElementById('btn-remove-custom');
const accessoryTypeSelect = document.getElementById('accessory-type');

let selectedModel = 0;
let selectedType = 'glasses';
let customImage = null;
let customImageUrl = null;

const accessoryImages = [new Image(), new Image()];
accessoryImages[0].src = '../assets/images/glasses-0.png';
accessoryImages[1].src = '../assets/images/glasses-1.png';

const ACCESSORY_CONFIG = {
  glasses: {
    anchor: 'nose',
    scale: 0.88,
    offsetX: 0,
    offsetY: -0.13
  },
  hat: {
    anchor: 'forehead',
    scale: 1.35,
    offsetX: 0,
    offsetY: -0.05,
    // El sombrero se ancla por su borde inferior (el ala),
    // no por el centro, para que la copa quede sobre la cabeza
    imageAnchorY: 1
  },
  mask: {
    anchor: 'nose',
    scale: 0.95,
    offsetX: 0,
    offsetY: 0.42
  },
  mustache: {
    anchor: 'nose',
    scale: 0.48,
    offsetX: 0,
    offsetY: 0.28
  }
};

const SMOOTHING = 0.35;

let smoothX = null;
let smoothY = null;
let smoothWidth = null;
let smoothAngle = null;

// Actualiza el texto y color de la barra de estado
function setStatus(message, type = 'normal') {
  statusText.textContent = message;
  statusBar.classList.remove('status-ok', 'status-error');

  if (type === 'ok') statusBar.classList.add('status-ok');
  if (type === 'error') statusBar.classList.add('status-error');
}

// Habilita o deshabilita el boton de quitar imagen subida
function updateRemoveButton() {
  if (removeCustomBtn) {
    removeCustomBtn.disabled = !customImage;
  }
}

// Selección de modelos del catálogo
catItems.forEach((item) => {
  item.addEventListener('click', () => {
    catItems.forEach((button) => button.classList.remove('active'));
    item.classList.add('active');

    selectedModel = Number(item.dataset.model);
    selectedType = item.dataset.type || 'glasses';
    customImage = null;

    if (accessoryTypeSelect) {
      accessoryTypeSelect.value = selectedType;
    }

    clearCustomImage();
    updateRemoveButton();
    setStatus('Modelo de catálogo seleccionado.');
  });
});

// Cambio manual de tipo de accesorio
if (accessoryTypeSelect) {
  accessoryTypeSelect.addEventListener('change', () => {
    selectedType = accessoryTypeSelect.value;
    setStatus(`Tipo de accesorio: ${getTypeLabel(selectedType)}.`);
  });
}

// Carga de imagen personalizada
if (customUpload) {
  customUpload.addEventListener('change', handleCustomUpload);
}

// Quitar imagen personalizada
if (removeCustomBtn) {
  removeCustomBtn.addEventListener('click', () => {
    customImage = null;
    clearCustomImage();

    if (customUpload) {
      customUpload.value = '';
    }

    updateRemoveButton();
    setStatus('Imagen personalizada retirada.');
  });
}

function handleCustomUpload(event) {
  const file = event.target.files[0];
  processUploadedFile(file);
}

// Procesa el archivo subido (input o drag&drop) y limpia su fondo
function processUploadedFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Selecciona una imagen válida.', 'error');
    return;
  }

  clearCustomImage();

  const originalUrl = URL.createObjectURL(file);
  const uploadedImage = new Image();

  uploadedImage.onload = () => {
    const cleanedUrl = removeImageBackground(uploadedImage);

    customImageUrl = cleanedUrl;
    customImage = new Image();

    customImage.onload = () => {
      selectedType = detectTypeFromFileName(file.name);

      if (accessoryTypeSelect) {
        accessoryTypeSelect.value = selectedType;
      }

      updateRemoveButton();
      setStatus(`Imagen cargada y fondo limpiado como ${getTypeLabel(selectedType)}.`, 'ok');
    };

    customImage.src = cleanedUrl;
    URL.revokeObjectURL(originalUrl);
  };

  uploadedImage.src = originalUrl;
  catItems.forEach((button) => button.classList.remove('active'));
}

// Drag & drop sobre la caja de carga
if (uploadBox) {
  uploadBox.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadBox.classList.add('dragover');
  });

  uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('dragover');
  });

  uploadBox.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadBox.classList.remove('dragover');

    const file = event.dataTransfer.files[0];
    processUploadedFile(file);
  });
}

// Quita fondos claros/blancos de la imagen subida
function removeImageBackground(image) {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCanvas.width = image.naturalWidth;
  tempCanvas.height = image.naturalHeight;

  tempCtx.drawImage(image, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const isWhite = r > 225 && g > 225 && b > 225;
    const isLightGray = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 185;

    if (isWhite || isLightGray) {
      data[i + 3] = 0;
    }
  }

  tempCtx.putImageData(imageData, 0, 0);
  return tempCanvas.toDataURL('image/png');
}

// Deduce el tipo de accesorio según el nombre del archivo
function detectTypeFromFileName(fileName) {
  const name = fileName.toLowerCase();

  if (name.includes('sombrero') || name.includes('hat') || name.includes('gorra') || name.includes('cap')) {
    return 'hat';
  }

  if (name.includes('mascarilla') || name.includes('mask') || name.includes('tapaboca')) {
    return 'mask';
  }

  if (name.includes('bigote') || name.includes('mustache') || name.includes('moustache')) {
    return 'mustache';
  }

  return 'glasses';
}

function clearCustomImage() {
  if (customImageUrl) {
    URL.revokeObjectURL(customImageUrl);
    customImageUrl = null;
  }
}

// --- Configuración MediaPipe Face Mesh ---
const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
  }
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.55
});

faceMesh.onResults(onResults);

async function init() {
  try {
    resizeCanvas();

    const camera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 640,
      height: 480
    });

    await camera.start();
    arLoading.classList.add('hidden');
    setStatus('Colócate frente a la cámara.');
  } catch (error) {
    console.error(error);
    arLoading.classList.add('hidden');
    camError.classList.remove('hidden');
    setStatus('Error al iniciar cámara o Face Mesh.', 'error');
  }
}

function onResults(results) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    setStatus('Buscando rostro...');
    resetSmoothing();
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  const points = getFacePoints(landmarks);
  const config = ACCESSORY_CONFIG[selectedType] || ACCESSORY_CONFIG.glasses;

  const anchor = getAnchorPoint(points, config.anchor);
  const faceWidth = getDistance(points.leftTemple, points.rightTemple);

  // Angulo Roll: inclinacion de cabeza entre las dos sienes
  const angle = Math.atan2(
    points.rightTemple.y - points.leftTemple.y,
    points.rightTemple.x - points.leftTemple.x
  );

  const smoothed = smoothTransform(anchor.x, anchor.y, faceWidth, angle);

  drawAccessory(
    smoothed.x,
    smoothed.y,
    smoothed.width,
    smoothed.angle,
    config
  );

  setStatus(`Rostro detectado. Tipo: ${getTypeLabel(selectedType)}.`, 'ok');
}

function getFacePoints(landmarks) {
  return {
    nose: toCanvasPoint(landmarks[6]),
    leftTemple: toCanvasPoint(landmarks[234]),
    rightTemple: toCanvasPoint(landmarks[454]),
    forehead: toCanvasPoint(landmarks[10]),
    chin: toCanvasPoint(landmarks[152]),
    upperLip: toCanvasPoint(landmarks[13])
  };
}

function getAnchorPoint(points, anchorType) {
  if (anchorType === 'forehead') return points.forehead;
  if (anchorType === 'chin') return points.chin;
  if (anchorType === 'upperLip') return points.upperLip;
  return points.nose;
}

// Dibuja el accesorio (imagen del catalogo o subida)
function drawAccessory(x, y, faceWidth, angle, config) {
  const img = customImage || accessoryImages[selectedModel];

  if (!img || !img.complete || img.naturalWidth === 0) {
    drawFallbackGlasses(x, y, faceWidth, angle, config);
    return;
  }

  const aspectRatio = img.naturalWidth / img.naturalHeight;
  const drawWidth = faceWidth * config.scale;
  const drawHeight = drawWidth / aspectRatio;

  const offsetX = config.offsetX * faceWidth;
  const offsetY = config.offsetY * faceWidth;

  // imageAnchorY define que parte de la imagen queda sobre el punto de anclaje:
  // 0.5 = centro (default), 1 = borde inferior, 0 = borde superior
  const anchorY = config.imageAnchorY ?? 0.5;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(offsetX, offsetY);

  ctx.drawImage(
    img,
    -drawWidth / 2,
    -drawHeight * anchorY,
    drawWidth,
    drawHeight
  );

  ctx.restore();
}

// Gafas dibujadas a mano si no hay imagen disponible
function drawFallbackGlasses(x, y, faceWidth, angle, config) {
  const drawWidth = faceWidth * config.scale;
  const lensWidth = drawWidth * 0.28;
  const lensHeight = lensWidth * 0.62;
  const gap = drawWidth * 0.08;

  const offsetX = config.offsetX * faceWidth;
  const offsetY = config.offsetY * faceWidth;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(offsetX, offsetY);

  ctx.lineWidth = 4;
  ctx.strokeStyle = selectedModel === 0 ? '#c8a96e' : '#111111';
  ctx.fillStyle = selectedModel === 0
    ? 'rgba(40, 180, 255, 0.18)'
    : 'rgba(20, 20, 20, 0.35)';

  drawLens(-(lensWidth + gap / 2), -lensHeight / 2, lensWidth, lensHeight);
  drawLens(gap / 2, -lensHeight / 2, lensWidth, lensHeight);

  ctx.beginPath();
  ctx.moveTo(-gap / 2, -lensHeight * 0.15);
  ctx.lineTo(gap / 2, -lensHeight * 0.15);
  ctx.stroke();

  ctx.restore();
}

function drawLens(x, y, width, height) {
  ctx.beginPath();

  if (selectedModel === 0) {
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else {
    drawRoundRect(ctx, x, y, width, height, 12);
  }

  ctx.fill();
  ctx.stroke();
}

function drawRoundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

// Convierte coordenadas normalizadas de MediaPipe a pixeles del canvas.
// El video esta en espejo (CSS scaleX(-1)) y el canvas NO esta en espejo,
// por eso aqui se invierte X para que el accesorio coincida con la cara en pantalla.
function toCanvasPoint(point) {
  return {
    x: (1 - point.x) * canvas.width,
    y: point.y * canvas.height
  };
}

function smoothTransform(x, y, width, angle) {
  smoothX = smoothX === null ? x : smoothX + (x - smoothX) * SMOOTHING;
  smoothY = smoothY === null ? y : smoothY + (y - smoothY) * SMOOTHING;
  smoothWidth = smoothWidth === null ? width : smoothWidth + (width - smoothWidth) * SMOOTHING;
  smoothAngle = smoothAngle === null ? angle : smoothAngle + (angle - smoothAngle) * SMOOTHING;

  return {
    x: smoothX,
    y: smoothY,
    width: smoothWidth,
    angle: smoothAngle
  };
}

function resetSmoothing() {
  smoothX = null;
  smoothY = null;
  smoothWidth = null;
  smoothAngle = null;
}

function getDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getTypeLabel(type) {
  const labels = {
    glasses: 'Gafas',
    hat: 'Sombrero',
    mask: 'Mascarilla',
    mustache: 'Bigote'
  };

  return labels[type] || 'Gafas';
}

window.addEventListener('resize', resizeCanvas);

init();
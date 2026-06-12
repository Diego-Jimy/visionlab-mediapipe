# VisionLab

Galería de 6 módulos de visión artificial e interacción gestual, ejecutados completamente en el navegador.

## Tecnologías

| Módulo | Librería IA |
|--------|------------|
| Menú Gestual | TensorFlow.js + PoseNet |
| Carrusel Coveflow | TensorFlow.js + MoveNet Lightning |
| Instrumento Virtual | MediaPipe Hands + Tone.js |
| Pizarra Digital | MediaPipe Hands |
| Probador Virtual | MediaPipe Face Mesh |
| Cazador de Burbujas | MediaPipe Hands |

## Estructura

```
vision-lab/
├── index.html          # Galería principal
├── style.css           # Estilos de la galería
├── script.js           # Script principal
├── README.md
├── pages/
│   ├── menu-gestual.html
│   ├── carrusel.html
│   ├── instrumento.html
│   ├── pizarra.html
│   ├── probador-ar.html
│   └── videojuego.html
├── css/
│   ├── menu-gestual.css
│   ├── carrusel.css
│   ├── instrumento.css
│   ├── pizarra.css
│   ├── probador-ar.css
│   └── videojuego.css
├── js/
│   ├── menu-gestual.js
│   ├── carrusel.js
│   ├── instrumento.js
│   ├── pizarra.js
│   ├── probador-ar.js
│   └── videojuego.js
└── assets/
    └── images/
        ├── glasses-0.png   ← Tu imagen PNG de gafas Aviador
        └── glasses-1.png   ← Tu imagen PNG de gafas Retro
```

## Instalación

No requiere instalación. Abre con un servidor local:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# VS Code
Instala la extensión "Live Server" y haz clic en "Go Live"
```

Luego abre: `http://localhost:8080`

> **Importante:** El proyecto debe abrirse desde un servidor local (no directamente como archivo). Los modelos de IA no se cargan desde `file://`.

## Módulos

### 1. Menú Gestual
Levanta la mano izquierda sobre la nariz → selecciona Laptop.  
Levanta la mano derecha sobre la nariz → selecciona Celular.

### 2. Carrusel Coveflow
Extiende la mano derecha hacia la izquierda → avanza en el carrusel.  
Extiende la mano izquierda hacia la derecha → retrocede.  
Cooldown de 600ms entre gestos.

### 3. Instrumento Virtual
- Haz clic primero para activar el sonido (requerido por el navegador).
- Mueve el dedo índice horizontalmente → toca notas (Do, Re, Mi, Fa, Sol).
- Haz pinza (pulgar + índice) → controla el volumen con la altura de la mano.

### 4. Pizarra Digital
- Índice extendido → modo dibujo (traza líneas).
- Pinza (pulgar + índice muy juntos) → modo borrador.
- Botón "Limpiar" → borra todo el canvas.

### 5. Probador Virtual de Gafas
Coloca las imágenes PNG en `assets/images/glasses-0.png` y `glasses-1.png`.  
El módulo incluye gafas de respaldo dibujadas con canvas si las imágenes no están disponibles.

### 6. Cazador de Burbujas
Usa los dedos índice y medio de ambas manos para reventar burbujas.  
Cada burbuja reventada suma 10 puntos.

## Notas

- Todos los modelos se cargan desde CDN oficial en el primer uso.
- Requiere permiso de cámara en el navegador.
- Probado en Chrome y Edge (recomendados). Firefox puede tener limitaciones con WebGL.

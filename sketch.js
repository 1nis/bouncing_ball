// --- CONFIGURATION ---
const SCALE = 2; // HD 1080x1920

// Variables physiques
let pos, vel, acc;
let circleRadius = 150 * SCALE;
let ballRadius = 10 * SCALE;
let radiusThreshold = 60 * SCALE;

// Variables Temporelles
let lastGrowthTime = 0;
const growthDelay = 2000;

// Variables Animation & Logique
let rippleCircles = [];
let explosions = [];
let tempCircleRadius = circleRadius;
let shrinking = false;
let circleColor, lastCircleColor;

// Variables Média
let uploadedGifAnim = null;   // Élément DOM du GIF
let uploadedGifStatic = null; // Buffer graphique (p5.Graphics) pour l'image fixe
let uploadedMusic = null;
let isGifLoaded = false;
let isMusicLoaded = false;

// Variables État du Jeu
let simulationStarted = false;
let lastBounceTime = -99999;
const effectDuration = 500;
let volumeGain = 0.5;

// Variables Affichage
let gifDrawWidth = 200 * SCALE;
let gifDrawHeight = 120 * SCALE;

// Enregistrement
let recorder, chunks = [], isRecording = false;

function setup() {
  let cnv = createCanvas(1080, 1920);
  imageMode(CENTER); // Centre les images pour éviter les décalages

  pos = createVector(width / 2 + (30 * SCALE), height / 2 - (30 * SCALE));
  vel = createVector(2 * SCALE, -1 * SCALE);
  acc = createVector(0, 0.2 * SCALE);
  circleColor = color(255, 255, 255);

  setupUI(cnv);
}

function draw() {
  if (!simulationStarted) {
    background(10);
    return;
  }

  background(25, 22, 171); // Bleu Undertale

  updatePhysics();

  drawRipples();
  drawMainCircle();
  drawBall();
  drawExplosions();

  // --- LOGIQUE D'ÉTAT ---
  let timeSinceLastBounce = millis() - lastBounceTime;
  let isActive = (timeSinceLastBounce < effectDuration);

  // GESTION MUSIQUE
  if (uploadedMusic && isMusicLoaded) {
    if (isActive) {
      // ACTIF (Sustain) : On joue en boucle si ce n'est pas déjà le cas
      if (!uploadedMusic.isPlaying()) {
        uploadedMusic.loop();
        uploadedMusic.setVolume(volumeGain);
      }
    } else {
      // INACTIF (Pause) : On met en pause (garde la position de lecture)
      if (uploadedMusic.isPlaying()) {
        uploadedMusic.pause();
      }
    }
  }

  // GESTION AFFICHAGE GIF
  if (isGifLoaded && uploadedGifAnim) {
    let cx = width / 2;
    let cy = height / 2;

    // Sécurité dimensions
    if (!gifDrawWidth) gifDrawWidth = 200 * SCALE;
    if (!gifDrawHeight) gifDrawHeight = 200 * SCALE;

    // Calculer la taille réelle du GIF en fonction du scaling du canvas
    let canvasElement = document.querySelector('canvas');
    let canvasRect = canvasElement.getBoundingClientRect();
    let scaleRatio = canvasRect.height / height;
    let realGifWidth = gifDrawWidth * scaleRatio;
    let realGifHeight = gifDrawHeight * scaleRatio;

    // Appliquer les dimensions au GIF DOM
    uploadedGifAnim.style('width', realGifWidth + 'px');
    uploadedGifAnim.style('height', realGifHeight + 'px');

    if (isActive) {
      // MODE ACTIF : Afficher le GIF DOM animé (visible directement)
      uploadedGifAnim.removeClass('hidden');
    } else {
      // MODE INACTIF : Cacher le GIF DOM et dessiner l'image statique sur le canvas
      uploadedGifAnim.addClass('hidden');
      if (uploadedGifStatic) {
        image(uploadedGifStatic, cx, cy, gifDrawWidth, gifDrawHeight);
      }
    }
  }
}

// --- PHYSIQUE ---
function updatePhysics() {
  vel.add(acc);

  let maxSpeed, minEnergy, growthFactor;
  if (ballRadius > radiusThreshold) {
    vel.mult(1.1);
    maxSpeed = 10 * SCALE;
    minEnergy = 8 * SCALE;
    growthFactor = 6.0 * SCALE;
  } else {
    maxSpeed = 8.5 * SCALE;
    minEnergy = 6 * SCALE;
    growthFactor = 2.5 * SCALE;
  }

  if (vel.mag() > maxSpeed) vel.setMag(maxSpeed);
  pos.add(vel);

  let distToCenter = dist(pos.x, pos.y, width / 2, height / 2);
  if (distToCenter + ballRadius >= circleRadius) {
    handleBounce(minEnergy, growthFactor);
  }

  if (ballRadius >= circleRadius) {
    noLoop();
    if (uploadedMusic) uploadedMusic.stop();
    if (isRecording) stopRecording();
    console.log("Fin.");
  }
}

function handleBounce(minEnergy, growthFactor) {
  let theta = atan2(pos.y - height / 2, pos.x - width / 2);
  let overlap = dist(pos.x, pos.y, width / 2, height / 2) + ballRadius - circleRadius;
  pos.sub(p5.Vector.fromAngle(theta).mult(overlap));
  let normal = p5.Vector.fromAngle(theta).normalize();
  vel.reflect(normal);

  if (vel.mag() < minEnergy) vel.setMag(minEnergy);

  lastCircleColor = circleColor;
  circleColor = color(255, 255, 255);
  rippleCircles.push({ x: width / 2, y: height / 2, radius: circleRadius, color: lastCircleColor });
  tempCircleRadius = circleRadius + (30 * SCALE);
  shrinking = true;

  let currentTime = millis();
  if (currentTime - lastGrowthTime >= growthDelay) {
    if (ballRadius < circleRadius) {
      ballRadius += growthFactor;
      lastGrowthTime = currentTime;
    }
  }

  for (let i = 0; i < 15; i++) {
    explosions.push(new Particle(pos.x, pos.y));
  }

  // --- LOGIQUE DE RESET ---
  let timeSinceLastBounce = millis() - lastBounceTime;

  // Si on vient d'une PAUSE longue (>500ms), c'est un NOUVEAU DÉPART.
  if (timeSinceLastBounce > effectDuration) {
    // 1. Reset Musique (Stop remet le curseur à 0:00)
    if (uploadedMusic && isMusicLoaded) {
      uploadedMusic.stop();
    }
    // 2. Reset GIF (Rechargement de la source pour revenir à la frame 0)
    if (uploadedGifAnim) {
      uploadedGifAnim.elt.src = uploadedGifAnim.elt.src;
    }
  }
  // Sinon (rebonds rapides), on ne fait rien : le flux continue.

  lastBounceTime = millis();
}

// --- UTILITAIRES ---
function drawRipples() {
  noFill(); strokeWeight(3 * SCALE);
  for (let i = rippleCircles.length - 1; i >= 0; i--) {
    stroke(rippleCircles[i].color);
    circle(rippleCircles[i].x, rippleCircles[i].y, rippleCircles[i].radius * 2);
    rippleCircles[i].radius += (2 * SCALE);
    if (rippleCircles[i].radius > (350 * SCALE)) rippleCircles.splice(i, 1);
  }
}
function drawMainCircle() {
  if (shrinking) {
    tempCircleRadius -= (2 * SCALE);
    if (tempCircleRadius <= circleRadius) { tempCircleRadius = circleRadius; shrinking = false; }
  }
  noFill(); stroke(circleColor); strokeWeight(4 * SCALE);
  circle(width / 2, height / 2, tempCircleRadius * 2);
}
function drawBall() {
  fill(circleColor); noStroke(); ellipse(pos.x, pos.y, ballRadius * 2);
}
function drawExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update(); explosions[i].display();
    if (explosions[i].isFinished()) explosions.splice(i, 1);
  }
}

// --- INTERFACE UI ---
function setupUI(cnv) {
  let gifInput = select('#gifInput');
  let audioInput = select('#audioInput');
  let startBtn = select('#startButton');
  let volSlider = select('#volumeSlider');
  let recBtn = select('#recordButton');

  // LOAD GIF
  gifInput.elt.onchange = (e) => {
    if (e.target.files.length > 0) {
      let f = e.target.files[0];
      let url = URL.createObjectURL(f);
      select('#gifStatus').html('Chargement...');

      if (uploadedGifAnim) uploadedGifAnim.remove();

      // 1. Création de l'animation (DOM)
      uploadedGifAnim = createImg(url, '');
      uploadedGifAnim.addClass('source-media');
      uploadedGifAnim.addClass('hidden'); // Caché jusqu'au premier rebond

      // 2. Création de l'image statique (Capture propre)
      // On utilise un élément Image natif pour lire les dimensions
      let tempImg = new Image();
      tempImg.src = url;
      tempImg.onload = function () {
        // Calcul taille
        let ratio = (tempImg.width > 0 && tempImg.height > 0) ? tempImg.width / tempImg.height : 1;
        gifDrawWidth = 350 * SCALE;
        gifDrawHeight = gifDrawWidth / ratio;

        // Création d'un buffer graphique p5 pour stocker l'image fixe (Frame 0)
        uploadedGifStatic = createGraphics(tempImg.width, tempImg.height);
        // On dessine l'image chargée dans ce buffer
        uploadedGifStatic.drawingContext.drawImage(tempImg, 0, 0);

        isGifLoaded = true;
        select('#gifStatus').html('✅ ' + f.name).addClass('ready');
        checkReady();
      };

      tempImg.onerror = function () {
        // En cas d'erreur (rare), on valide quand même pour utiliser l'anim
        isGifLoaded = true;
        gifDrawWidth = 350 * SCALE;
        gifDrawHeight = 350 * SCALE;
        select('#gifStatus').html('⚠ Anim Seule').addClass('ready');
        checkReady();
      };
    }
  };

  // LOAD AUDIO
  audioInput.elt.onchange = (e) => {
    if (e.target.files.length > 0) {
      let f = e.target.files[0];
      select('#audioStatus').html('Chargement...');
      uploadedMusic = loadSound(f, () => {
        isMusicLoaded = true;
        select('#audioStatus').html('✅ ' + f.name).addClass('ready');
        checkReady();
      });
    }
  };

  volSlider.input(() => volumeGain = volSlider.value());

  startBtn.mousePressed(() => {
    select('#overlay').style('opacity', '0');
    setTimeout(() => select('#overlay').hide(), 500);
    simulationStarted = true;
    lastBounceTime = -99999;
  });

  recBtn.mousePressed(() => toggleRecording(cnv.elt, recBtn));
}

function checkReady() {
  if (isGifLoaded && isMusicLoaded) select('#startButton').removeAttribute('disabled');
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(2 * SCALE, 5 * SCALE));
    this.lifetime = 255; this.color = circleColor;
  }
  update() { this.pos.add(this.vel); this.lifetime -= 8; }
  display() { noStroke(); fill(red(this.color), green(this.color), blue(this.color), this.lifetime); ellipse(this.pos.x, this.pos.y, 6 * SCALE); }
  isFinished() { return this.lifetime <= 0; }
}

function toggleRecording(canvas, btn) {
  if (!isRecording) {
    chunks = [];
    let stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'bounce_video.webm'; a.click();
    };
    recorder.start();
    isRecording = true;
    btn.html("⏹ Stop & Save"); btn.addClass('recording');
  } else {
    recorder.stop();
    isRecording = false;
    btn.html("⏺ Enregistrer Vidéo"); btn.removeClass('recording');
  }
}
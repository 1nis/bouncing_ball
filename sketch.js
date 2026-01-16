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
let uploadedGifAnim = null;   // Le GIF animé
let uploadedGifStatic = null; // L'image fixe (Frame 3)
let uploadedMusic = null;
let isGifLoaded = false;
let isMusicLoaded = false;
let gifFrameCanvas = null;

// Variables État du Jeu
let simulationStarted = false;
let lastBounceTime = -99999;
const effectDuration = 500;  // LE SEUIL 500ms
let volumeGain = 0.5;

// Variables Affichage
let gifDrawWidth = 200 * SCALE;
let gifDrawHeight = 120 * SCALE;

// Enregistrement
let recorder, chunks = [], isRecording = false;

function setup() {
  let cnv = createCanvas(1080, 1920);
  imageMode(CENTER); // Important pour centrer parfaitement

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

  // DESSINS
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
      // Si actif et pas en lecture, on lance (Sustain)
      if (!uploadedMusic.isPlaying()) {
        uploadedMusic.loop();
        uploadedMusic.setVolume(volumeGain);
      }
    } else {
      // Si inactif (>500ms), on PAUSE
      if (uploadedMusic.isPlaying()) {
        uploadedMusic.pause();
      }
    }
  }

  // GESTION AFFICHAGE GIF
  if (isGifLoaded) {
    let cx = width / 2;
    let cy = height / 2;

    if (!gifDrawWidth) gifDrawWidth = 200 * SCALE;
    if (!gifDrawHeight) gifDrawHeight = 200 * SCALE;

    if (isActive && uploadedGifAnim) {
      // MODE ACTIF : On dessine le GIF animé
      // Note : On n'utilise plus .show() ici car le CSS s'en charge
      image(uploadedGifAnim, cx, cy, gifDrawWidth, gifDrawHeight);
    } else {
      // MODE INACTIF : On dessine l'image fixe
      // Fallback : si l'image fixe n'existe pas, on met le GIF (mieux que rien)
      let imgToShow = (uploadedGifStatic && uploadedGifStatic.width > 0) ? uploadedGifStatic : uploadedGifAnim;
      if (imgToShow) image(imgToShow, cx, cy, gifDrawWidth, gifDrawHeight);
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

  // Si le temps de pause a dépassé 500ms, c'est un nouveau départ
  if (timeSinceLastBounce > effectDuration) {
    // On remet la musique au début
    if (uploadedMusic && isMusicLoaded) {
      uploadedMusic.stop();
    }
    // On remet le GIF au début (astuce du src)
    if (uploadedGifAnim) {
      uploadedGifAnim.elt.src = uploadedGifAnim.elt.src;
    }
  }

  // Si c'est un rebond rapide (<500ms), on ne fait rien de spécial,
  // la musique continue (Sustain).

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

      // 1. Animation (DOM) - Géré par CSS pour l'invisibilité visuelle
      uploadedGifAnim = createImg(url, '');
      uploadedGifAnim.addClass('source-media');
      // On NE FAIT PLUS .hide() ici, le CSS s'en charge mieux

      // 2. Capture de la frame 3
      let tempImg = document.createElement('img');
      tempImg.src = url;
      tempImg.onload = function () {
        let ratio = (tempImg.width > 0 && tempImg.height > 0) ? tempImg.width / tempImg.height : 1;
        gifDrawWidth = 350 * SCALE;
        gifDrawHeight = gifDrawWidth / ratio;

        gifFrameCanvas = document.createElement('canvas');
        gifFrameCanvas.width = tempImg.width;
        gifFrameCanvas.height = tempImg.height;
        let ctx = gifFrameCanvas.getContext('2d');

        setTimeout(() => {
          ctx.drawImage(tempImg, 0, 0);
          uploadedGifStatic = createImage(gifFrameCanvas.width, gifFrameCanvas.height);
          uploadedGifStatic.drawingContext.drawImage(gifFrameCanvas, 0, 0);

          isGifLoaded = true;
          select('#gifStatus').html('✅ ' + f.name).addClass('ready');
          checkReady();
        }, 300);
      };

      tempImg.onerror = function () {
        isGifLoaded = true;
        gifDrawWidth = 350 * SCALE;
        gifDrawHeight = 350 * SCALE;
        select('#gifStatus').html('⚠ Anim Seule').addClass('ready');
        checkReady();
      }
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
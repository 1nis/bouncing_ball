// --- CONFIGURATION ---
const SCALE = 2; // HD 1080x1920

// Variables physiques
let pos, vel, acc;
let circleRadius = 150 * SCALE;
let ballRadius = 10 * SCALE;
let radiusThreshold = 60 * SCALE;

// Variables Temporelles
let lastGrowthTime = 0;
const growthDelay = 2000; // 2 secondes min entre chaque grossissement

// Variables Animation & Logique
let rippleCircles = [];
let explosions = [];
let tempCircleRadius = circleRadius;
let shrinking = false;
let circleColor, lastCircleColor;

// Variables Média
let uploadedGifAnim = null;   // Le GIF animé
let uploadedGifStatic = null; // L'image fixe (Frame 0)
let uploadedMusic = null;
let isGifLoaded = false;
let isMusicLoaded = false;

// Variables État du Jeu
let simulationStarted = false;
let lastBounceTime = -99999; // Initialisé loin dans le passé
const effectDuration = 500;  // LE SEUIL : 500ms
let volumeGain = 0.5;

// Variables Affichage
let gifDrawWidth = 200 * SCALE;
let gifDrawHeight = 120 * SCALE;

// Enregistrement
let recorder, chunks = [], isRecording = false;

function setup() {
  let cnv = createCanvas(1080, 1920);

  // CORRECTION MAJEURE DE L'AFFICHAGE :
  // On dessine les images par rapport à leur centre. 
  // Cela empêche tout décalage entre le GIF et l'image fixe.
  imageMode(CENTER);

  // Physique
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

  // --- LOGIQUE D'ÉTAT (DANS LA BOUCLE DE JEU) ---

  let timeSinceLastBounce = millis() - lastBounceTime;
  let isActive = (timeSinceLastBounce < effectDuration);

  // GESTION MUSIQUE
  if (uploadedMusic && isMusicLoaded) {
    if (isActive) {
      // CAS 1 : ACTIF (Rebonds rapides ou récents)
      // Si la musique ne joue pas, on la lance. 
      // (Si elle joue déjà, on ne fait rien, elle continue fluide).
      if (!uploadedMusic.isPlaying()) {
        uploadedMusic.loop();
        uploadedMusic.setVolume(volumeGain);
      }
    } else {
      // CAS 2 : INACTIF (Dépassement 500ms) -> PAUSE
      if (uploadedMusic.isPlaying()) {
        uploadedMusic.pause();
      }
    }
  }

  // GESTION AFFICHAGE (VISUEL)
  if (isGifLoaded) {
    // Avec imageMode(CENTER), on place l'image pile au centre du canvas
    let cx = width / 2;
    let cy = height / 2;

    // Sécurité dimensions
    if (!gifDrawWidth) gifDrawWidth = 200 * SCALE;
    if (!gifDrawHeight) gifDrawHeight = 200 * SCALE;

    if (isActive && uploadedGifAnim) {
      // Affiche le GIF qui bouge
      image(uploadedGifAnim, cx, cy, gifDrawWidth, gifDrawHeight);
    } else {
      // Affiche l'image fixe
      // Fallback de sécurité : si l'image fixe n'est pas chargée, on met le GIF quand même pour ne pas avoir d'écran vide
      let imgDesktop = (uploadedGifStatic && uploadedGifStatic.width > 0) ? uploadedGifStatic : uploadedGifAnim;
      image(imgDesktop, cx, cy, gifDrawWidth, gifDrawHeight);
    }
  }
}

// --- PHYSIQUE ET ÉVÉNEMENTS ---

function updatePhysics() {
  vel.add(acc);

  // Paramètres dynamiques
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

  // Détection Collision
  let distToCenter = dist(pos.x, pos.y, width / 2, height / 2);
  if (distToCenter + ballRadius >= circleRadius) {
    handleBounce(minEnergy, growthFactor);
  }

  // Fin
  if (ballRadius >= circleRadius) {
    noLoop();
    if (uploadedMusic) uploadedMusic.stop();
    if (isRecording) stopRecording();
    console.log("Fin.");
  }
}

function handleBounce(minEnergy, growthFactor) {
  // 1. Rebond Physique
  let theta = atan2(pos.y - height / 2, pos.x - width / 2);
  let overlap = dist(pos.x, pos.y, width / 2, height / 2) + ballRadius - circleRadius;
  pos.sub(p5.Vector.fromAngle(theta).mult(overlap));
  let normal = p5.Vector.fromAngle(theta).normalize();
  vel.reflect(normal);

  if (vel.mag() < minEnergy) vel.setMag(minEnergy);

  // 2. Visuels
  lastCircleColor = circleColor;
  circleColor = color(255, 255, 255);
  rippleCircles.push({ x: width / 2, y: height / 2, radius: circleRadius, color: lastCircleColor });
  tempCircleRadius = circleRadius + (30 * SCALE);
  shrinking = true;

  // 3. Croissance (avec délai 2s)
  let currentTime = millis();
  if (currentTime - lastGrowthTime >= growthDelay) {
    if (ballRadius < circleRadius) {
      ballRadius += growthFactor;
      lastGrowthTime = currentTime;
    }
  }

  // 4. Particules
  for (let i = 0; i < 15; i++) {
    explosions.push(new Particle(pos.x, pos.y));
  }

  // --- 5. LOGIQUE DE RESET (VOTRE DEMANDE PRÉCISE) ---

  let timeSinceLastBounce = millis() - lastBounceTime;

  // Règle : "Nouveau rebond après une pause : la musique et le GIF repartent de zéro"
  if (timeSinceLastBounce > effectDuration) {

    // Reset Musique à 0
    if (uploadedMusic && isMusicLoaded) {
      uploadedMusic.stop(); // Le Stop remet la lecture au début (0:00)
    }

    // Reset GIF au début
    if (uploadedGifAnim) {
      uploadedGifAnim.elt.src = uploadedGifAnim.elt.src;
    }
  }

  // Règle : "Rebonds rapides (< 500ms) : On ne coupe rien"
  // -> Dans ce cas (else), on ne fait aucun stop(), donc la musique continue 
  //    là où elle était et le GIF aussi.

  // On met à jour le temps du dernier rebond pour relancer le compteur d'activité
  lastBounceTime = millis();
}

// --- UTILITAIRES DESSIN ---
function drawRipples() {
  noFill(); strokeWeight(3 * SCALE);
  for (let i = rippleCircles.length - 1; i >= 0; i--) {
    stroke(rippleCircles[i].color);
    // circle() dessine centré sur x,y
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

      // 1. Animation (DOM)
      uploadedGifAnim = createImg(url, '');
      uploadedGifAnim.addClass('source-media');

      // 2. Statique (P5 Image)
      uploadedGifStatic = loadImage(url, (img) => {
        isGifLoaded = true;
        let ratio = (img.width > 0 && img.height > 0) ? img.width / img.height : 1;
        gifDrawWidth = 350 * SCALE;
        gifDrawHeight = gifDrawWidth / ratio;
        select('#gifStatus').html('✅ ' + f.name).addClass('ready');
        checkReady();
      }, (err) => {
        // En cas d'erreur de chargement de l'image fixe, on active quand même le GIF
        isGifLoaded = true;
        gifDrawWidth = 350 * SCALE;
        gifDrawHeight = 350 * SCALE;
        console.warn("Image statique non chargée, utilisation anim uniquement");
        select('#gifStatus').html('⚠ Anim Seule').addClass('ready');
        checkReady();
      });
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

// --- PARTICLES ---
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

// --- RECORDER ---
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
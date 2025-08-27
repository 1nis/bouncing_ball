let pos, vel, acc;
let circleRadius = 150;
let ballRadius = 10;
let lastGrowthTime = 0;
let growthDelay = 2000;
let growthFactor = 2.5;
let minEnergy = 5.8;
let maxSpeed = 8;
let circleColor;
let rippleCircles = [];
let tempCircleRadius = circleRadius;
let shrinking = false;
let lastCircleColor;
let gif;
let staticImage;
let gifPlaying = false;
let lastBounceTime = 0;
let gifWidth = 200;
let gifHeight = 120;
let radiusThreshold = 60;
let explosions = [];
let music; // Son pour accompagner le GIF
let musicLoaded = false; // Indique si la musique est chargée
let simulationStarted = false; // Indique si la simulation a commencé
let volumeGain = 0.5;

function preload() {
  // Charger le GIF et l'image statique
  gif = createImg('./video/undertale.gif');
  staticImage = loadImage('./img/undertale.png');
  gif.hide();

  // Charger la musique
  music = loadSound('./audio/zinzin.mp3', () => {
    musicLoaded = true; // Confirmer que la musique est chargée
  });
}

function setup() {
  createCanvas(540, 960);
  pos = createVector(width / 2 + 30, height / 2 - 30);
  vel = createVector(2, -1);
  acc = createVector(0, 0.2);
  circleColor = color(255, 255, 255);
  lastCircleColor = circleColor;
  gif.size(gifWidth, gifHeight);

  // Récupérer les éléments de l'interface
  let startButton = select('#startButton');
  let volumeSlider = select('#volumeSlider');

  startButton.mousePressed(() => {
    if (musicLoaded) {
      simulationStarted = true;
      select('#overlay').hide();
    } else {
      console.log("La musique n'est pas encore chargée.");
    }
  });

  volumeSlider.input(() => {
    setVolume(volumeSlider.value());
  });

  // Définir le volume initial
  setVolume(volumeSlider.value());
}

function draw() {
  if (!simulationStarted) {
    return;
  }

  background(25, 22, 171);

  // Mise à jour de la vélocité avec l'accélération (gravité)
  vel.add(acc);

  // Effets conditionnés par le radiusThreshold
  if (ballRadius > radiusThreshold) {
    vel.mult(1.1);
    growthFactor = 12.0;
    minEnergy = 8;
    maxSpeed = 10;
  } else {
    growthFactor = 2.5;
    minEnergy = 6;
    maxSpeed = 8.5;
  }

  // Limiter la vitesse maximale
  if (vel.mag() > maxSpeed) {
    vel.setMag(maxSpeed);
  }

  // Mise à jour de la position de la balle
  pos.add(vel);

  // Dessiner les cercles concentriques (ondes)
  noFill();
  for (let i = rippleCircles.length - 1; i >= 0; i--) {
    stroke(rippleCircles[i].color);
    strokeWeight(3);
    circle(rippleCircles[i].x, rippleCircles[i].y, rippleCircles[i].radius * 2);
    rippleCircles[i].radius += 2;
    if (rippleCircles[i].radius > 300) {
      rippleCircles.splice(i, 1);
    }
  }

  // Dessiner et animer le cercle principal
  if (shrinking) {
    tempCircleRadius -= 2;
    if (tempCircleRadius <= circleRadius) {
      tempCircleRadius = circleRadius;
      shrinking = false;
    }
  }
  noFill();
  stroke(circleColor);
  strokeWeight(4);
  circle(width / 2, height / 2, tempCircleRadius * 2);

  // Dessiner la balle
  fill(circleColor);
  noStroke();
  ellipse(pos.x, pos.y, ballRadius * 2);

  // Dessiner les explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update();
    explosions[i].display();
    if (explosions[i].isFinished()) {
      explosions.splice(i, 1);
    }
  }

  // Vérification de la collision avec le contour
  let distToCenter = dist(pos.x, pos.y, width / 2, height / 2);
  if (distToCenter + ballRadius >= circleRadius) {
    let theta = atan2(pos.y - height / 2, pos.x - width / 2);
    let overlap = distToCenter + ballRadius - circleRadius;
    pos.sub(p5.Vector.fromAngle(theta).mult(overlap));
    let normal = p5.Vector.fromAngle(theta).normalize();
    vel.reflect(normal);

    // Appliquer une puissance minimale à la vélocité
    if (vel.mag() < minEnergy) {
      vel.setMag(minEnergy);
    }

    // Sauvegarder la couleur actuelle du cercle
    lastCircleColor = circleColor;
    circleColor = color(255, 255, 255);

    rippleCircles.push({
      x: width / 2,
      y: height / 2,
      radius: circleRadius,
      color: lastCircleColor,
    });

    tempCircleRadius = circleRadius + 30;
    shrinking = true;

    let currentTime = millis();
    if (currentTime - lastGrowthTime >= growthDelay) {
      if (ballRadius < circleRadius) {
        ballRadius += growthFactor;
        lastGrowthTime = currentTime;
      }
    } 

    // Lancer le GIF et la musique
    gif.position(width * 1.77 - gifWidth / 2, height / 2 - gifHeight / 2);
    gif.show();
    gifPlaying = true;
    if (!music.isPlaying()) {
      music.loop();
      music.setVolume(volumeGain); // Applique le gain du volume au moment de la lecture
    }

    lastBounceTime = millis();

    // Ajouter une explosion
    for (let i = 0; i < 15; i++) {
      explosions.push(new Particle(pos.x, pos.y));
    }
  }

  if (millis() - lastBounceTime > 500 && gifPlaying) {
    gif.hide();
    gifPlaying = false;
    music.stop();
  }

  if (!gifPlaying) {
    image(
      staticImage,
      width / 2 - gifWidth / 2,
      height / 2 - gifHeight / 2,
      gifWidth,
      gifHeight
    );
  }

  if (ballRadius >= circleRadius) {
    noLoop();
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("", width / 2, height / 2);
  }
}

// Classe pour les particules d'explosion
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(2, 5));
    this.lifetime = 255;
    this.color = color(circleColor);
  }

  update() {
    this.pos.add(this.vel);
    this.lifetime -= 5;
  }

  display() {
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), this.lifetime);
    ellipse(this.pos.x, this.pos.y, 5);
  }

  isFinished() {
    return this.lifetime <= 0;
  }
}

function constrain(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setVolume(newVolume) {
  volumeGain = constrain(newVolume, 0, 1); // Assure que le volume reste entre 0 et 1
  if (music) {
    music.setVolume(volumeGain);
  }
  console.log(`Volume réglé à : ${volumeGain}`);
}
"use strict";
/* ---------- DOM ---------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const closeMenu = document.getElementById("closeMenu");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const scoreText = document.getElementById("scoreText");
const bestText = document.getElementById("bestText");
const gameOverMenu = document.getElementById("gameOverMenu");
const finalScore = document.getElementById("finalScore");
const tryAgain = document.getElementById("tryAgain");
const goHome = document.getElementById("goHome");
const carList = document.getElementById("carList");
const nightToggle = document.getElementById("nightToggle");
const nitroFill = document.getElementById("nitroFill");
const heartsEl = document.getElementById("hearts");
const touchNitro = document.getElementById("touchNitro");
const resetBest = document.getElementById("resetBest");
const volumeRange = document.getElementById("volume");
const nitroPowerRange = document.getElementById("nitroPower");

/* ---------- Game state ---------- */
let w = canvas.width,
  h = canvas.height;
let score = 0;
let bestScore = Number(localStorage.getItem("nfs_best_v2") || 0);
bestText.innerText = bestScore;

let running = false,
  paused = false;
let gameSpeed = 4;
let keys = {};
let enemies = [];
let laneLines = [];
let particles = []; // smoke particles
let cameraShake = { x: 0, y: 0, t: 0, int: 6 };
let selectedCarSrc = localStorage.getItem("nfs_selected_car") || "assets/car1.png";

/* ---------- Audio (basic) ---------- */
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterGain = AudioCtx.createGain();
masterGain.gain.value = Number(volumeRange ? volumeRange.value : 0.7);
masterGain.connect(AudioCtx.destination);

function playCrash() {
  const o = AudioCtx.createOscillator();
  const g = AudioCtx.createGain();
  o.type = "sawtooth";
  o.frequency.value = 100;
  g.gain.value = 0.25;
  o.connect(g);
  g.connect(masterGain);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, AudioCtx.currentTime + 0.6);
  o.stop(AudioCtx.currentTime + 0.65);
}

/* ---------- Player ---------- */
let player = {
  x: w / 2 - 25,
  y: h - 160,
  width: 50,
  height: 100,
  speed: 5,
  nitro: 100,
  hearts: 3,
  boosting: false,
};

/* ---------- Predefined asset lists (structure B) ---------- */
const playerFiles = ["assets/car1.png", "assets/car2.png", "assets/car3.png", "assets/car4.png", "assets/car5.png"];
const enemyFiles = ["assets/enemy1.png", "assets/enemy2.png", "assets/enemy3.png", "assets/enemy4.png"];
const explosionFile = "assets/explosion.png";
const crashSndFile = "assets/crash.mp3";

/* ---------- Load & populate car list (player selection) ---------- */
function buildPlayerList() {
  carList.innerHTML = "";
  playerFiles.forEach((src, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "carItem";
    wrapper.dataset.src = src;
    const img = document.createElement("img");
    img.src = src;
    img.alt = "car" + (idx + 1);
    const nm = document.createElement("div");
    nm.className = "carName";
    nm.innerText = "car" + (idx + 1);
    wrapper.appendChild(img);
    wrapper.appendChild(nm);
    if (src === selectedCarSrc) wrapper.classList.add("selected");
    wrapper.addEventListener("click", () => {
      document.querySelectorAll(".carItem").forEach((x) => x.classList.remove("selected"));
      wrapper.classList.add("selected");
      selectedCarSrc = src;
      localStorage.setItem("nfs_selected_car", selectedCarSrc);
      preloadSelectedCar();
    });
    carList.appendChild(wrapper);
  });
}
buildPlayerList();

/* ---------- Images ---------- */
let carImg = new Image();
function preloadSelectedCar() {
  carImg = new Image();
  carImg.src = selectedCarSrc;
}
preloadSelectedCar();

const enemyImgs = [];
enemyFiles.forEach((src) => {
  const img = new Image();
  img.src = src;
  enemyImgs.push(img);
});

/* ---------- Explosion image (optional sprite) ---------- */
let explosionImg = new Image();
explosionImg.src = explosionFile;

/* ---------- Lane lines ---------- */
for (let i = 0; i < 12; i++) {
  laneLines.push({ x: w / 2 - 5, y: i * 70, width: 10, height: 40 });
}

/* ---------- Spawn enemies ---------- */
let spawnInterval = null;
function startSpawning(rate = 1200) {
  if (spawnInterval) clearInterval(spawnInterval);
  spawnInterval = setInterval(() => {
    if (running && !paused) spawnEnemy();
  }, rate);
}

/* ---------- Spawn enemy function (choose random enemy image) ---------- */
function spawnEnemy() {
  const laneX = [60, 160, 260];
  const idx = Math.floor(Math.random() * laneX.length);
  const imgIdx = Math.floor(Math.random() * enemyImgs.length);
  enemies.push({
    x: laneX[idx],
    y: -120 - Math.random() * 200,
    width: 50,
    height: 100,
    speed: gameSpeed + 1 + Math.random() * 1.2,
    img: enemyImgs[imgIdx],
  });
}

/* ---------- Collision ---------- */
function isColliding(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/* ---------- Particles (smoke) ---------- */
function spawnSmoke(px, py, count = 6) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: px + (Math.random() * 20 - 10),
      y: py + (Math.random() * 8 - 4),
      vx: Math.random() * -0.6 + Math.random() * 0.6,
      vy: Math.random() * -1.2 - 0.4,
      r: Math.random() * 6 + 4,
      life: Math.random() * 0.6 + 0.6,
      alpha: 0.7,
    });
  }
}

/* ---------- Camera shake ---------- */
function shake(intensity = 6, duration = 300) {
  cameraShake.t = duration;
  cameraShake.int = intensity;
}

/* ---------- Render hearts ---------- */
function renderHearts() {
  heartsEl.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const el = document.createElement("div");
    el.className = "heart" + (i < player.hearts ? " full" : "");
    el.innerText = i < player.hearts ? "❤" : " ";
    heartsEl.appendChild(el);
  }
}

/* ---------- Update nitro UI ---------- */
function updateNitroUI() {
  nitroFill.style.width = Math.max(0, Math.min(100, player.nitro)) + "%";
}

/* ---------- Night mode handling ---------- */
function applyNightMode(on) {
  if (on) document.body.classList.add("night");
  else document.body.classList.remove("night");
  localStorage.setItem("nfs_night", on ? "1" : "0");
}
const savedNight = localStorage.getItem("nfs_night") === "1";
nightToggle.checked = savedNight;
applyNightMode(savedNight);

/* ---------- Input handling ---------- */
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (AudioCtx.state === "suspended") AudioCtx.resume();
});
document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

/* touch nitro */
touchNitro.addEventListener("touchstart", () => (keys["Shift"] = true));
touchNitro.addEventListener("touchend", () => (keys["Shift"] = false));

/* ---------- Game loop ---------- */
let lastTS = 0;
function update(ts) {
  if (!running || paused) {
    lastTS = ts;
    requestAnimationFrame(update);
    return;
  }
  if (!lastTS) lastTS = ts;
  const dt = (ts - lastTS) / 1000;
  lastTS = ts;

  // controls
  const left = keys["ArrowLeft"] || keys["a"] || keys["A"];
  const right = keys["ArrowRight"] || keys["d"] || keys["D"];
  const nitroKey = keys["Shift"] || keys["ShiftLeft"] || keys["ShiftRight"];

  // move player
  if (left) player.x -= player.speed * (player.boosting ? 1.6 : 1);
  if (right) player.x += player.speed * (player.boosting ? 1.6 : 1);
  player.x = Math.max(44, Math.min(w - 44 - player.width, player.x));

  // nitro logic (Shift)
  const nitroPower = Number(nitroPowerRange ? nitroPowerRange.value : 1.3);
  if (nitroKey && player.nitro > 6) {
    player.boosting = true;
    player.nitro -= 40 * dt * nitroPower;
    // spawn smoke behind
    spawnSmoke(player.x + player.width / 2, player.y + player.height - 20, 4);
    // small score bonus while boosting
    score += Math.floor(6 * dt * nitroPower);
    // camera micro-shake while boosting
    shake(6 * nitroPower, 80);
  } else {
    player.boosting = false;
    player.nitro = Math.min(100, player.nitro + 18 * dt);
  }
  updateNitroUI();

  // move lane lines (parallax)
  laneLines.forEach((line) => {
    line.y += gameSpeed * (player.boosting ? 1.6 : 1) * dt * 20;
    if (line.y > h) line.y = -50;
  });

  // enemies movement & collisions
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed * dt * 60 * (player.boosting ? 1.1 : 1);
    // off-screen
    if (e.y > h + 120) {
      enemies.splice(i, 1);
      score += 1;
      scoreText.innerText = score;
      gameSpeed += 0.05;
      continue;
    }
    // erratic sideways movement occasionally
    if (Math.random() < 0.01) e.x += (Math.random() < 0.5 ? -1 : 1) * Math.random() * 8;
    // clamp
    e.x = Math.max(44, Math.min(w - 44 - e.width, e.x));
    // collision
    if (isColliding(player, e)) {
      enemies.splice(i, 1);
      playCrash();
      shake(12, 450);
      spawnSmoke(player.x + player.width / 2, player.y + player.height / 2, 16);
      player.hearts--;
      renderHearts();
      if (player.hearts <= 0) {
        endGame();
        return;
      }
    }
  }

  // particles update
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;
    p.alpha -= dt * 0.6;
    p.r += dt * 6;
    if (p.life <= 0 || p.alpha <= 0) particles.splice(i, 1);
  }

  // camera shake decay
  if (cameraShake.t > 0) {
    cameraShake.t -= dt * 1000;
    cameraShake.x = (Math.random() * 2 - 1) * (cameraShake.int || 6);
    cameraShake.y = (Math.random() * 2 - 1) * (cameraShake.int || 6);
    if (cameraShake.t <= 0) {
      cameraShake.x = 0;
      cameraShake.y = 0;
    }
  }

  // draw frame
  draw();

  requestAnimationFrame(update);
}

/* ---------- draw function ---------- */
function draw() {
  // clear
  ctx.clearRect(0, 0, w, h);

  // apply camera shake
  ctx.save();
  ctx.translate(cameraShake.x, cameraShake.y);

  // background / sides
  if (document.body.classList.contains("night")) {
    ctx.fillStyle = "#040405";
  } else {
    ctx.fillStyle = "#0b0b0f";
  }
  ctx.fillRect(0, 0, w, h);
  // side bars
  ctx.fillStyle = "#060606";
  ctx.fillRect(0, 0, 40, h);
  ctx.fillRect(w - 40, 0, 40, h);

  // road
  ctx.fillStyle = document.body.classList.contains("night") ? "#111118" : "#1b1b1f";
  ctx.fillRect(40, 0, w - 80, h);

  // center stripes
  ctx.fillStyle = document.body.classList.contains("night") ? "rgba(255,255,255,0.14)" : "white";
  laneLines.forEach((line) => ctx.fillRect(line.x, line.y, line.width, line.height));

  // draw enemies
  enemies.forEach((e) => {
    if (e.img && e.img.complete && e.img.naturalWidth !== 0) {
      ctx.drawImage(e.img, e.x, e.y, e.width, e.height);
    } else {
      roundRect(ctx, e.x, e.y, e.width, e.height, 8, true, false, "#c64f4f");
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(e.x + 8, e.y + 18, e.width - 16, 20);
    }
  });

  // draw smoke particles behind player
  particles.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = `rgba(60,60,60,${p.alpha})`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // draw car (image)
  if (carImg && carImg.complete && carImg.naturalWidth !== 0) {
    // if night mode, draw headlight cone
    if (document.body.classList.contains("night")) {
      const grad = ctx.createRadialGradient(player.x + player.width / 2, player.y + 20, 10, player.x + player.width / 2, player.y + 200, 200);
      grad.addColorStop(0, "rgba(255,255,220,0.45)");
      grad.addColorStop(1, "rgba(255,255,220,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(player.x + player.width / 2, player.y + 160, 120, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = grad;
      ctx.fillRect(player.x - 60, player.y - 40, player.width + 120, 260);
      ctx.globalAlpha = 1;
    }

    // shadow under car
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(player.x + 8, player.y + player.height - 10, player.width - 16, 8);

    ctx.drawImage(carImg, player.x, player.y, player.width, player.height);
  } else {
    roundRect(ctx, player.x, player.y, player.width, player.height, 8, true, false, "#00e0c6");
  }

  ctx.restore();
}

/* rounded rect helper */
function roundRect(ctx, x, y, w, h, r, fill, stroke, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = color || ctx.fillStyle;
    ctx.fill();
  }
  if (stroke) ctx.stroke();
}

/* ---------- Game control functions ---------- */
function startGame() {
  if (AudioCtx.state === "suspended") AudioCtx.resume();
  running = true;
  paused = false;
  score = 0;
  gameSpeed = 4;
  enemies = [];
  particles = [];
  player.nitro = 100;
  player.hearts = 3;
  scoreText.innerText = score;
  renderHearts();
  updateNitroUI();
  preloadSelectedCar();
  startSpawning(1200);
  lastTS = 0;
  requestAnimationFrame(update);
}

function pauseToggle() {
  paused = !paused;
  pauseBtn.innerText = paused ? "ادامه" : "توقف / ادامه";
}

function endGame() {
  running = false;
  paused = false;
  if (spawnInterval) clearInterval(spawnInterval);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("nfs_best_v2", bestScore);
    bestText.innerText = bestScore;
  }
  finalScore.innerText = `امتیاز: ${score} — رکورد: ${bestScore}`;
  gameOverMenu.classList.add("show");
}

/* ---------- Events ---------- */
menuBtn.addEventListener("click", () => {
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden", "false");
});
closeMenu.addEventListener("click", () => {
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden", "true");
});
startBtn.addEventListener("click", () => {
  sideMenu.classList.remove("open");
  startGame();
});
pauseBtn.addEventListener("click", () => pauseToggle());
restartBtn.addEventListener("click", () => {
  location.reload();
});
tryAgain &&
  tryAgain.addEventListener("click", () => {
    gameOverMenu.classList.remove("show");
    startGame();
  });
goHome &&
  goHome.addEventListener("click", () => {
    gameOverMenu.classList.remove("show");
    sideMenu.classList.add("open");
  });

nightToggle.addEventListener("change", (e) => {
  applyNightMode(e.target.checked);
});
resetBest &&
  resetBest.addEventListener("click", () => {
    localStorage.removeItem("nfs_best_v2");
    bestScore = 0;
    bestText.innerText = 0;
  });

volumeRange &&
  volumeRange.addEventListener("input", () => {
    masterGain.gain.value = Number(volumeRange.value);
  });

/* ---------- Preload selected car ---------- */
function preloadSelectedCar() {
  carImg = new Image();
  carImg.src = selectedCarSrc;
}

/* ---------- Initial setup ---------- */
preloadSelectedCar();
renderHearts();
updateNitroUI();

/* ---------- Start spawn (idle) ---------- */
startSpawning(1200);

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key === "p" || e.key === "P") pauseToggle();
});

/* ---------- Resume AudioCtx on first click (for browsers) ---------- */
document.addEventListener("click", function resumeAudio() {
  if (AudioCtx.state === "suspended") AudioCtx.resume();
  document.removeEventListener("click", resumeAudio);
});
sideMenu.classList.add("open");
sideMenu.setAttribute("aria-hidden", "false");
const touchLeft = document.createElement("div");
const touchRight = document.createElement("div");

touchLeft.id = "touchLeft";
touchRight.id = "touchRight";

touchLeft.style.cssText = "position:absolute;bottom:100px;left:10px;width:80px;height:80px;background:rgba(0,0,0,0.3);border-radius:50%;z-index:10;";
touchRight.style.cssText = "position:absolute;bottom:100px;right:10px;width:80px;height:80px;background:rgba(0,0,0,0.3);border-radius:50%;z-index:10;";

document.body.appendChild(touchLeft);
document.body.appendChild(touchRight);

touchLeft.addEventListener("touchstart", () => (keys["ArrowLeft"] = true));
touchLeft.addEventListener("touchend", () => (keys["ArrowLeft"] = false));

touchRight.addEventListener("touchstart", () => (keys["ArrowRight"] = true));
touchRight.addEventListener("touchend", () => (keys["ArrowRight"] = false));

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const speedEl = document.getElementById("speed");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const speedNeedleEl = document.getElementById("speed-needle");
const endScreenEl = document.getElementById("end-screen");
const endTitleEl = document.getElementById("end-title");
const restartBtn = document.getElementById("restart");

const palette = {
  road1: "#5a5a5a",
  road2: "#4f4f4f",
  rumble1: "#2f2f2f",
  rumble2: "#262626",
  lane: "#f5f5f5",
};

const skyline = [];
const miniMap = {
  points: [],
  minX: 0,
  maxX: 0,
  total: 0,
};

const asphaltPattern = (() => {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 140;
  patternCanvas.height = 140;
  const pctx = patternCanvas.getContext("2d");
  pctx.fillStyle = "#5a5a5a";
  pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * patternCanvas.width;
    const y = Math.random() * patternCanvas.height;
    const size = 1 + Math.random() * 2.2;
    const tone = Math.random() > 0.5 ? "#575757" : "#616161";
    pctx.fillStyle = tone;
    pctx.fillRect(x, y, size, size);
  }
  return ctx.createPattern(patternCanvas, "repeat");
})();

const playerCarImg = new Image();
playerCarImg.src = "CarroReto.png";
let playerCarReady = false;
playerCarImg.onload = () => {
  playerCarReady = true;
};

const playerCarLeftImg = new Image();
playerCarLeftImg.src = "carro-esquerda.png";
let playerCarLeftReady = false;
playerCarLeftImg.onload = () => {
  playerCarLeftReady = true;
};

const playerCarRightImg = new Image();
playerCarRightImg.src = "carro-direita.png";
let playerCarRightReady = false;
playerCarRightImg.onload = () => {
  playerCarRightReady = true;
};

const opponentCarImg = new Image();
opponentCarImg.src = "CarroReto-oponente.png";
let opponentCarReady = false;
opponentCarImg.onload = () => {
  opponentCarReady = true;
};

const state = {
  width: 0,
  height: 0,
  horizon: 0,
  roadMax: 0,
  roadMin: 0,
  playerX: 0,
  speed: 0,
  distance: 0,
  countdown: 3.5,
  collisionTimer: 0,
  shakeTime: 0,
  shakeIntensity: 0,
  playerRect: null,
  itemCooldown: 0,
  lastItemSpawn: 0,
  redSlowTimer: 0,
  overlayTimer: 0,
  flashTimer: 0,
  itemShakeTime: 0,
  raceTime: 0,
  raceDuration: 45,
  finishDistance: 0,
  finishLineZ: null,
  raceFinished: false,
  raceFailed: false,
  outroTime: 0,
  curveSmoothed: 0,
  steerTimer: 0,
  steerDir: 0,
  offRoad: false,
  offRoadAmount: 0,
  offRoadSide: 0,
  dustSpawnTimer: 0,
  keys: new Set(),
};

const config = {
  maxSpeed: 760,
  accel: 340,
  brake: 240,
  decel: 80,
  turnSpeed: 1.0,
  laneCount: 3,
  curveScale: 0.28,
  curveAssist: 0.12,
  centrifugalForce: 0.95,
  curveSmoothSpeed: 1.5,
  stripeLength: 120,
  viewDistance: 5200,
  opponentCount: 4,
  opponentMinSpeed: 60,
  opponentMaxSpeed: 140,
  opponentSpawnGap: 620,
  collisionZ: 190,
  collisionCooldown: 0.7,
  shakeDuration: 0.25,
  shakeStrength: 10,
  itemSpawnGap: 1800,
  itemPickupZ: 90,
  itemPickupX: 0.18,
  overlayDuration: 0.8,
  overlayAlpha: 0.18,
  flashDuration: 0.12,
  flashAlpha: 0.35,
  itemShakeDuration: 0.2,
  itemShakeStrength: 3,
  dustSpawnRate: 70,
  dustMinSpeed: 120,
  dustLife: 0.65,
  dustMax: 160,
  dustMinSize: 2,
  dustMaxSize: 6,
  speedLineCount: 22,
  speedLineLength: 140,
  speedLineWidth: 1.4,
  speedLineAlpha: 0.25,
  confettiCount: 140,
  confettiDuration: 2.8,
  miniMapWidth: 180,
  miniMapHeight: 120,
  finishFadeDistance: 2200,
  outroDuration: 2.8,
  outroRise: 0.7,
  playerHitboxScale: 0.75,
  opponentHitboxScale: 0.75,
  lightSpacing: 900,
  lightOffsetRatio: 0.08,
  lightHeight: 200,
  lightGlowSize: 30,
  steerHoldTime: 0.12,
  finishSpawnZ: 1400,
};

const track = [
  { len: 2000, curve: 0 },
  { len: 2200, curve: 0.7 },
  { len: 1500, curve: 0 },
  { len: 2500, curve: -0.85 },
  { len: 2000, curve: 0.35 },
  { len: 1500, curve: 0 },
];

const totalTrackLen = track.reduce((sum, seg) => sum + seg.len, 0);
state.finishDistance = 70000;

const grassPattern = (() => {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 80;
  patternCanvas.height = 80;
  const pctx = patternCanvas.getContext("2d");
  pctx.fillStyle = "#2f6b32";
  pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

  for (let i = 0; i < 140; i++) {
    const x = Math.random() * patternCanvas.width;
    const y = Math.random() * patternCanvas.height;
    const size = 1 + Math.random() * 2.2;
    pctx.fillStyle = Math.random() > 0.5 ? "#3f8341" : "#2a5f2d";
    pctx.fillRect(x, y, size, size);
  }

  return ctx.createPattern(patternCanvas, "repeat");
})();

const opponents = [];
const sparks = [];
const items = [];
const confetti = [];
const dust = [];
const speedLines = [];
let audioContext = null;

function initOpponents() {
  opponents.length = 0;
  for (let i = 0; i < config.opponentCount; i++) {
    opponents.push(spawnOpponent(900 + i * config.opponentSpawnGap));
  }
}

function spawnOpponent(z) {
  const lane = pickSpawnLane(z);
  return {
    lane,
    lanePos: lane,
    z,
    speed: config.opponentMinSpeed + Math.random() * (config.opponentMaxSpeed - config.opponentMinSpeed),
    color: ["#29a8ff", "#f4a321", "#6bd66b", "#ff4f7b"][Math.floor(Math.random() * 4)],
  };
}

function pickSpawnLane(z) {
  const lanes = Array.from({ length: config.laneCount }, (_, i) => i);
  lanes.sort(() => Math.random() - 0.5);
  for (const lane of lanes) {
    if (isLaneClearAtZ(lane, z, config.opponentSpawnGap * 0.8)) {
      return lane;
    }
  }
  return Math.floor(Math.random() * config.laneCount);
}

function isLaneClearAtZ(lane, z, minGap) {
  for (const other of opponents) {
    if (other.lane !== lane) {
      continue;
    }
    if (Math.abs(other.z - z) < minGap) {
      return false;
    }
  }
  return true;
}

function resize() {
  state.width = canvas.width = window.innerWidth;
  state.height = canvas.height = window.innerHeight;
  state.horizon = Math.floor(state.height * 0.38);
  state.roadMax = state.width * 0.92;
  state.roadMin = state.width * 0.18;
  readPalette();
  buildSkyline();
  buildMiniMap();
  initSpeedLines();
}

function initSpeedLines() {
  speedLines.length = 0;
  for (let i = 0; i < config.speedLineCount; i++) {
    speedLines.push({
      x: Math.random(),
      y: Math.random(),
      w: 0.5 + Math.random() * 0.9,
      l: 0.5 + Math.random() * 0.9,
      a: 0.4 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.4,
    });
  }
}

function buildSkyline() {
  skyline.length = 0;
  let x = -40;
  while (x < state.width + 80) {
    const depth = Math.random();
    const w = 40 + Math.random() * 90;
    const h = 30 + Math.random() * 140;
    skyline.push({
      x,
      w,
      h,
      depth,
      shade: 18 + Math.floor(Math.random() * 20),
      glow: Math.random() < 0.35,
    });
    x += w + 12 + Math.random() * 24;
  }
}

function buildMiniMap() {
  miniMap.points = [];
  miniMap.minX = 0;
  miniMap.maxX = 0;
  miniMap.total = state.finishDistance;

  let x = 0;
  const step = 200;
  for (let d = 0; d <= state.finishDistance; d += step) {
    const curve = getCurve(d % totalTrackLen);
    x += curve * step * 0.08;
    miniMap.points.push({ x, y: d });
    miniMap.minX = Math.min(miniMap.minX, x);
    miniMap.maxX = Math.max(miniMap.maxX, x);
  }
}

function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  palette.road1 = styles.getPropertyValue("--road-1").trim() || palette.road1;
  palette.road2 = styles.getPropertyValue("--road-2").trim() || palette.road2;
  palette.rumble1 = styles.getPropertyValue("--rumble-1").trim() || palette.rumble1;
  palette.rumble2 = styles.getPropertyValue("--rumble-2").trim() || palette.rumble2;
  palette.lane = styles.getPropertyValue("--lane").trim() || palette.lane;
}

function getCurve(distance) {
  let d = distance % totalTrackLen;
  for (const seg of track) {
    if (d <= seg.len) {
      return seg.curve;
    }
    d -= seg.len;
  }
  return 0;
}

function getRoadMetricsAt(z) {
  const curve = state.curveSmoothed;
  const p = 1 - z / config.viewDistance;
  const roadWidth = state.roadMin + p * (state.roadMax - state.roadMin);
  const curveOffset = (1 - p) * (1 - p) * curve * state.width * 0.6;
  const playerOffset = state.playerX * roadWidth * 0.32;
  const center = state.width * 0.5 + curveOffset - playerOffset;
  const laneWidth = (roadWidth * 0.9) / config.laneCount;
  const roadLeft = center - roadWidth * 0.5;
  const roadRight = center + roadWidth * 0.5;
  const laneLeft = roadLeft + roadWidth * 0.05;
  const laneRight = laneLeft + laneWidth * config.laneCount;

  return {
    p,
    roadWidth,
    center,
    laneWidth,
    laneLeft,
    laneRight,
    roadLeft,
    roadRight,
  };
}

function update(dt) {
  if (state.countdown > 0) {
    state.countdown = Math.max(0, state.countdown - dt);
  }

  if (state.itemCooldown > 0) {
    state.itemCooldown = Math.max(0, state.itemCooldown - dt);
  }

  if (state.redSlowTimer > 0) {
    state.redSlowTimer = Math.max(0, state.redSlowTimer - dt);
  }

  if (state.overlayTimer > 0) {
    state.overlayTimer = Math.max(0, state.overlayTimer - dt);
  }

  if (state.flashTimer > 0) {
    state.flashTimer = Math.max(0, state.flashTimer - dt);
  }

  if (state.itemShakeTime > 0) {
    state.itemShakeTime = Math.max(0, state.itemShakeTime - dt);
  }

  const leftHeld = state.keys.has("ArrowLeft");
  const rightHeld = state.keys.has("ArrowRight");
  if (leftHeld && !rightHeld) {
    state.steerDir = -1;
    state.steerTimer = config.steerHoldTime;
  } else if (rightHeld && !leftHeld) {
    state.steerDir = 1;
    state.steerTimer = config.steerHoldTime;
  } else if (state.steerTimer > 0) {
    state.steerTimer = Math.max(0, state.steerTimer - dt);
    if (state.steerTimer === 0) {
      state.steerDir = 0;
    }
  } else {
    state.steerDir = 0;
  }


  const countdownActive = state.countdown > 0;
  const raceLocked = countdownActive || state.raceFailed;
  const accel = state.keys.has("ArrowUp");
  const brake = state.keys.has("ArrowDown");
  const left = state.keys.has("ArrowLeft");
  const right = state.keys.has("ArrowRight");

  if (!raceLocked && accel) {
    state.speed += config.accel * dt;
  } else if (!raceLocked && brake) {
    state.speed -= config.brake * dt;
  } else {
    const sign = state.speed === 0 ? 0 : Math.sign(state.speed);
    state.speed -= sign * config.decel * dt;
  }

  state.speed = Math.max(0, Math.min(config.maxSpeed, state.speed));
  if (state.redSlowTimer > 0) {
    state.speed = Math.min(state.speed, 160);
  }
  if (!countdownActive && !state.raceFinished && !state.raceFailed) {
    state.distance += state.speed * dt * 3.2;
  }

  const turn = (right ? 1 : 0) - (left ? 1 : 0);
  const targetCurve = getCurve(state.distance);
  const smoothStep = Math.min(1, dt * config.curveSmoothSpeed);
  state.curveSmoothed += (targetCurve - state.curveSmoothed) * smoothStep;
  const assist = -state.curveSmoothed * config.curveScale * config.curveAssist;
  const centrifugal = -state.curveSmoothed * (state.speed / config.maxSpeed) * config.centrifugalForce;
  const steer = (countdownActive || state.raceFinished || state.raceFailed) ? 0 : turn * config.turnSpeed * dt;
  state.playerX += steer + assist * dt + centrifugal * dt;
  state.playerX = Math.max(-1, Math.min(1, state.playerX));

  if (state.raceFinished) {
    state.playerX += (0 - state.playerX) * Math.min(1, dt * 0.8);
    state.speed = Math.max(0, state.speed - config.decel * dt * 0.3);
  }
  updatePlayerRect();
  updateOffRoadState();
  updateDust(dt);
  spawnDust(dt, countdownActive);
  updateSpeedLines(dt);

  if (!countdownActive && !state.raceFinished && !state.raceFailed) {
    state.raceTime += dt;
    updateOpponents(dt);
    updateItems(dt);
    updateFinishLine(dt);
  }

  if (state.raceTime >= state.raceDuration && !state.raceFinished) {
    state.raceFailed = true;
  }

  if (state.raceFinished) {
    state.outroTime = Math.min(config.outroDuration, state.outroTime + dt);
  }

  updateConfetti(dt);

  if (state.raceFailed) {
    state.speed = Math.max(0, state.speed - config.decel * dt * 1.2);
  }

  speedEl.textContent = Math.round(state.speed);
  if (speedNeedleEl) {
    const t = Math.max(0, Math.min(1, state.speed / config.maxSpeed));
    const angle = -130 + t * 260;
    speedNeedleEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
  }
  if (timerEl) {
    const remaining = Math.max(0, state.raceDuration - state.raceTime);
    timerEl.textContent = remaining.toFixed(1);
  }
  if (statusEl) {
    statusEl.textContent = state.raceFinished ? "CHEGADA!" : state.raceFailed ? "TEMPO ESGOTADO" : "";
  }

  updateEndScreen();
}

function updateOffRoadState() {
  state.offRoad = false;
  state.offRoadAmount = 0;
  state.offRoadSide = 0;
  if (!state.playerRect) {
    return;
  }
  const { roadLeft, roadRight, roadWidth } = getRoadMetricsAt(0);
  const safeWidth = Math.max(1, roadWidth * 0.2);
  const leftTire = state.playerRect.x + state.playerRect.w * 0.22;
  const rightTire = state.playerRect.x + state.playerRect.w * 0.78;
  let amountLeft = 0;
  let amountRight = 0;
  if (leftTire < roadLeft) {
    amountLeft = (roadLeft - leftTire) / safeWidth;
  }
  if (rightTire > roadRight) {
    amountRight = (rightTire - roadRight) / safeWidth;
  }
  const amount = Math.max(amountLeft, amountRight);
  state.offRoadAmount = Math.min(1, amount);
  if (state.offRoadAmount > 0.02) {
    state.offRoad = true;
    state.offRoadSide = amountLeft > amountRight ? -1 : amountRight > 0 ? 1 : 0;
  }
}

function spawnDust(dt, countdownActive) {
  if (countdownActive || state.raceFinished || state.raceFailed) {
    return;
  }
  if (!state.offRoad || state.speed < config.dustMinSpeed || !state.playerRect) {
    return;
  }
  const rate = config.dustSpawnRate * state.offRoadAmount;
  state.dustSpawnTimer += dt * rate;
  while (state.dustSpawnTimer >= 1) {
    state.dustSpawnTimer -= 1;
    if (dust.length >= config.dustMax) {
      break;
    }
    dust.push(createDustParticle());
  }
}

function createDustParticle() {
  const side = state.offRoadSide || (Math.random() > 0.5 ? 1 : -1);
  const baseX = state.playerRect.x + state.playerRect.w * (side < 0 ? 0.18 : 0.82);
  const baseY = state.playerRect.y + state.playerRect.h * 0.88;
  const life = config.dustLife + Math.random() * 0.3;
  return {
    x: baseX + (Math.random() - 0.5) * 18,
    y: baseY + (Math.random() - 0.5) * 8,
    vx: side * (15 + Math.random() * 25) + (Math.random() - 0.5) * 10,
    vy: 20 + Math.random() * 35,
    size: config.dustMinSize + Math.random() * (config.dustMaxSize - config.dustMinSize),
    life,
    maxLife: life,
  };
}

function updateDust(dt) {
  if (dust.length === 0) {
    return;
  }
  for (let i = dust.length - 1; i >= 0; i--) {
    const p = dust[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 25 * dt;
    if (p.life <= 0) {
      dust.splice(i, 1);
    }
  }
}

function drawDust() {
  if (dust.length === 0) {
    return;
  }
  ctx.save();
  for (const p of dust) {
    const t = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = `rgba(130, 120, 95, ${0.35 * t})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size * 1.1, p.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function updateEndScreen() {
  if (!endScreenEl || !endTitleEl) {
    return;
  }
  if (state.raceFinished) {
    endTitleEl.textContent = "CHEGADA!";
    endScreenEl.classList.add("show", "win");
    endScreenEl.classList.remove("lose");
    endScreenEl.setAttribute("aria-hidden", "false");
    if (confetti.length === 0) {
      spawnConfetti();
    }
  } else if (state.raceFailed) {
    endTitleEl.textContent = "TEMPO ESGOTADO";
    endScreenEl.classList.add("show", "lose");
    endScreenEl.classList.remove("win");
    endScreenEl.setAttribute("aria-hidden", "false");
  } else {
    endScreenEl.classList.remove("show", "win", "lose");
    endScreenEl.setAttribute("aria-hidden", "true");
  }
}

function updateFinishLine(dt) {
  if (state.raceFinished) {
    return;
  }
  state.finishLineZ = state.finishDistance - state.distance;
  if (state.finishLineZ <= 0) {
    state.finishLineZ = 0;
    state.raceFinished = true;
    state.outroTime = 0;
  }
}

function updateItems(dt) {
  const delta = state.speed * dt * 3.2;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.z -= delta;
    item.bobPhase += item.bobSpeed * dt;
    if (item.z < -200) {
      items.splice(i, 1);
    }
  }

  spawnItemsIfNeeded();
  checkItemPickup();
}

function spawnItemsIfNeeded() {
  if (state.distance - state.lastItemSpawn < config.itemSpawnGap) {
    return;
  }
  state.lastItemSpawn = state.distance;
  const z = config.viewDistance * 0.9 + Math.random() * 500;
  items.push(createItem(z));
}

function createItem(z) {
  return {
    z,
    lane: Math.floor(Math.random() * config.laneCount),
    type: Math.random() < 0.35 ? "green" : "red",
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: 1.6 + Math.random() * 1.2,
    bobAmp: 10 + Math.random() * 8,
  };
}

function checkItemPickup() {
  if (state.itemCooldown > 0) {
    return;
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.z > 0 && item.z < config.itemPickupZ) {
      const { roadWidth, center, laneWidth, laneLeft, roadLeft, roadRight } = getRoadMetricsAt(item.z);
      let laneCenter = laneLeft + laneWidth * (item.lane + 0.5);
      const edgeLeft = roadLeft + laneWidth * 0.35;
      const edgeRight = roadRight - laneWidth * 0.35;
      laneCenter = Math.min(edgeRight, Math.max(edgeLeft, laneCenter));
      const itemXNorm = (laneCenter - center) / (roadWidth * 0.5);

      if (Math.abs(state.playerX - itemXNorm) < config.itemPickupX) {
        if (item.type === "red") {
          state.redSlowTimer = 2;
          state.overlayTimer = config.overlayDuration;
          state.flashTimer = config.flashDuration;
          state.itemShakeTime = config.itemShakeDuration;
          state.speed = Math.min(state.speed, 160);
        }
        items.splice(i, 1);
        state.itemCooldown = 0.3;
        break;
      }
    }
  }
}

function updateOpponents(dt) {
  if (state.collisionTimer > 0) {
    state.collisionTimer = Math.max(0, state.collisionTimer - dt);
  }

  if (state.shakeTime > 0) {
    state.shakeTime = Math.max(0, state.shakeTime - dt);
  }

  for (const opponent of opponents) {
    opponent.z -= (state.speed - opponent.speed) * dt * 3.2;
    opponent.lanePos = opponent.lane;

    const ahead = findNearestAhead(opponent);
    if (ahead && ahead.z - opponent.z < 260) {
      opponent.speed = Math.max(config.opponentMinSpeed, opponent.speed - 80 * dt);
    } else {
      const target = config.opponentMinSpeed + Math.random() * (config.opponentMaxSpeed - config.opponentMinSpeed);
      opponent.speed += (target - opponent.speed) * 0.02;
    }

    if (opponent.z < -200) {
      const respawnZ = config.viewDistance * 0.7 + Math.random() * 1200;
      Object.assign(opponent, spawnOpponent(respawnZ));
    }

    if (opponent.z > config.viewDistance * 1.2) {
      opponent.z = config.viewDistance * 1.2;
    }
  }

  checkCollisions();
  updateSparks(dt);
}

function findNearestAhead(opponent) {
  let nearest = null;
  for (const other of opponents) {
    if (other === opponent || other.lane !== opponent.lane) {
      continue;
    }
    if (other.z > opponent.z && (!nearest || other.z < nearest.z)) {
      nearest = other;
    }
  }
  return nearest;
}

function checkCollisions() {
  if (state.collisionTimer > 0) {
    return;
  }
  for (const opponent of opponents) {
    if (opponent.z <= 0 || opponent.z >= config.collisionZ) {
      continue;
    }
    const opponentRect = getOpponentRect(opponent);
    if (!opponentRect || !state.playerRect) {
      continue;
    }
    const playerRect = shrinkRect(state.playerRect, config.playerHitboxScale);
    const hitRect = shrinkRect(opponentRect, config.opponentHitboxScale);

    if (rectsOverlap(playerRect, hitRect)) {
      state.speed = Math.max(0, state.speed * 0.4);
      state.collisionTimer = config.collisionCooldown;
      triggerCollisionEffects();
      break;
    }
  }
}

function getActivePlayerImage() {
  const useLeft = state.steerDir < 0;
  const useRight = state.steerDir > 0;

  if (useLeft && playerCarLeftReady) {
    return playerCarLeftImg;
  }
  if (useRight && playerCarRightReady) {
    return playerCarRightImg;
  }
  return playerCarImg;
}

function getPlayerAspect() {
  const img = getActivePlayerImage();
  if (img && img.naturalHeight) {
    return img.naturalWidth / img.naturalHeight;
  }
  const baseHeight = state.height * 0.12;
  const baseWidth = state.width * 0.08;
  return baseWidth / baseHeight;
}

function updatePlayerRect() {
  let fade = 1;
  if (state.raceFinished) {
    const excess = state.distance - state.finishDistance;
    if (excess > 0) {
      fade = Math.max(0, 1 - excess / config.finishFadeDistance);
    }
  }
  if (fade <= 0) {
    return;
  }

  const baseHeight = state.height * 0.12;
  const aspect = getPlayerAspect();
  const carHeight = baseHeight;
  const carWidth = baseHeight * aspect;
  const x = state.width * 0.5 - carWidth * 0.5 + state.playerX * state.width * 0.08;
  const y = state.height - carHeight - 30;
  state.playerRect = { x, y, w: carWidth, h: carHeight };
}

function getOpponentRect(opponent) {
  if (opponent.z <= 0 || opponent.z > config.viewDistance) {
    return null;
  }
  const { p, roadWidth, laneWidth, laneLeft, roadLeft, roadRight } = getRoadMetricsAt(opponent.z);
  let laneCenter = laneLeft + laneWidth * (opponent.lanePos + 0.5);
  const baseHeight = state.height * 0.12;
  const baseWidth = state.width * 0.08;
  const aspect = opponentCarReady && opponentCarImg.naturalHeight
    ? opponentCarImg.naturalWidth / opponentCarImg.naturalHeight
    : baseWidth / baseHeight;
  const scale = 0.45 + 0.55 * p;
  const carHeight = baseHeight * scale;
  const carWidth = carHeight * aspect;
  const edgeLeft = roadLeft + carWidth * 0.6;
  const edgeRight = roadRight - carWidth * 0.6;
  laneCenter = Math.min(edgeRight, Math.max(edgeLeft, laneCenter));
  const y = state.horizon + p * (state.height - state.horizon) - carHeight * 0.8;
  return { x: laneCenter - carWidth * 0.5, y, w: carWidth, h: carHeight };
}

function shrinkRect(rect, scale) {
  const w = rect.w * scale;
  const h = rect.h * scale;
  return {
    x: rect.x + (rect.w - w) / 2,
    y: rect.y + (rect.h - h) / 2,
    w,
    h,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, state.height);
  grad.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue("--sky-top"));
  grad.addColorStop(0.6, getComputedStyle(document.documentElement).getPropertyValue("--sky-bottom"));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.width, state.height);

  drawSkyline();
}

function drawSkyline() {
  if (skyline.length === 0) {
    return;
  }
  const baseY = state.horizon + 6;
  const progress = Math.min(1, state.distance / state.finishDistance);

  for (const b of skyline) {
    const depthScale = 0.25 + (1 - b.depth) * 0.55;
    const approachBoost = 0.25 + progress * 0.75;
    const scale = depthScale * approachBoost;
    const x = b.x;
    const w = b.w * scale;
    const h = b.h * scale;
    const y = baseY - h - b.depth * 18;
    const shade = Math.round(b.shade + b.depth * 22);
    ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
    ctx.fillRect(x, y, w, h);

    if (b.glow) {
      ctx.fillStyle = "rgba(255, 220, 160, 0.5)";
      ctx.fillRect(x + w * 0.15, y + h * 0.2, w * 0.15, h * 0.08);
      ctx.fillRect(x + w * 0.55, y + h * 0.45, w * 0.12, h * 0.06);
    }
  }
}

function drawGrass() {
  if (!grassPattern) {
    return;
  }
  const offset = (state.distance * 0.18) % 80;
  ctx.save();
  ctx.translate(0, -offset);
  ctx.fillStyle = grassPattern;
  ctx.fillRect(0, state.horizon + offset, state.width, state.height - state.horizon + 80);
  ctx.restore();
}

function drawRoad() {
  const stripes = Math.floor(state.distance / config.stripeLength);
  const curve = state.curveSmoothed;
  const roadNoiseOffset = (state.distance * 0.05) % 140;

  for (let y = state.horizon; y < state.height; y++) {
    const p = (y - state.horizon) / (state.height - state.horizon);
    const roadWidth = state.roadMin + p * (state.roadMax - state.roadMin);
    const rumbleWidth = roadWidth * 0.08;
    const laneWidth = (roadWidth * 0.9) / config.laneCount;
    const roadStroke = 1 + p * 3.6;
    const rumbleStroke = 1 + p * 3.6;

    const curveOffset = (1 - p) * (1 - p) * curve * state.width * 0.6;
    const playerOffset = state.playerX * roadWidth * 0.32;
    const center = state.width * 0.5 + curveOffset - playerOffset;

    const isStripe = ((stripes + Math.floor(y / 8)) % 2) === 0;
    const roadColor = palette.road1;
    const rumbleColor = isStripe ? "#f2f2f2" : "#d54b4b";

    const left = center - roadWidth * 0.5;
    const right = center + roadWidth * 0.5;

    ctx.strokeStyle = rumbleColor;
    ctx.lineWidth = rumbleStroke;
    ctx.beginPath();
    ctx.moveTo(left - rumbleWidth, y);
    ctx.lineTo(left, y);
    ctx.stroke();

    ctx.strokeStyle = rumbleColor;
    ctx.lineWidth = rumbleStroke;
    ctx.beginPath();
    ctx.moveTo(right, y);
    ctx.lineTo(right + rumbleWidth, y);
    ctx.stroke();

    if (asphaltPattern) {
      ctx.save();
      ctx.strokeStyle = asphaltPattern;
      ctx.lineWidth = roadStroke;
      ctx.setTransform(1, 0, 0, 1, 0, -roadNoiseOffset);
      ctx.beginPath();
      ctx.moveTo(left, y + roadNoiseOffset);
      ctx.lineTo(right, y + roadNoiseOffset);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = roadColor;
      ctx.lineWidth = roadStroke;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }



    ctx.lineWidth = 1;
  }
}

function drawRoadDistanceShade() {
  const top = state.horizon;
  const grad = ctx.createLinearGradient(0, top, 0, state.height);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.25)");
  grad.addColorStop(0.5, "rgba(0, 0, 0, 0.08)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, state.width, state.height - top);
}

function drawHaze() {
  const hazeTop = Math.max(0, state.horizon - 80);
  const hazeBottom = state.horizon + 180;
  const grad = ctx.createLinearGradient(0, hazeTop, 0, hazeBottom);
  grad.addColorStop(0, "rgba(20, 26, 48, 0.75)");
  grad.addColorStop(1, "rgba(20, 26, 48, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.width, hazeBottom);
}

function drawLightPoles() {
  const spacing = config.lightSpacing;
  const base = state.distance % spacing;
  for (let z = 0; z < config.viewDistance; z += spacing) {
    const dz = z + (spacing - base);
    if (dz <= 0 || dz > config.viewDistance) {
      continue;
    }
    const { p, roadWidth, roadLeft, roadRight } = getRoadMetricsAt(dz);
    const y = state.horizon + p * (state.height - state.horizon);
    const poleHeight = Math.max(6, config.lightHeight * p);
    const offset = roadWidth * config.lightOffsetRatio;
    const leftX = roadLeft - offset;
    const rightX = roadRight + offset;

    ctx.strokeStyle = "#2b2f3a";
    ctx.lineWidth = Math.max(1, 2.4 * p);
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(leftX, y - poleHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX, y);
    ctx.lineTo(rightX, y - poleHeight);
    ctx.stroke();

    const arm = Math.max(8, 18 * p);
    ctx.lineWidth = Math.max(1, 1.6 * p);
    ctx.beginPath();
    ctx.moveTo(leftX, y - poleHeight);
    ctx.lineTo(leftX + arm, y - poleHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX, y - poleHeight);
    ctx.lineTo(rightX - arm, y - poleHeight);
    ctx.stroke();

    const glow = Math.max(4, config.lightGlowSize * p);
    ctx.fillStyle = "rgba(255, 230, 180, 0.35)";
    ctx.beginPath();
    ctx.arc(leftX + arm, y - poleHeight, glow * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightX - arm, y - poleHeight, glow * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 245, 220, 0.95)";
    ctx.beginPath();
    ctx.arc(leftX + arm, y - poleHeight, Math.max(2, glow * 0.35), 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightX - arm, y - poleHeight, Math.max(2, glow * 0.35), 0, Math.PI * 2);
    ctx.fill();

  }
  ctx.lineWidth = 1;
}

function drawOpponents() {
  for (const opponent of opponents) {
    if (opponent.z <= 0 || opponent.z > config.viewDistance) {
      continue;
    }

    const { p, roadWidth, center, laneWidth, laneLeft, laneRight, roadLeft, roadRight } = getRoadMetricsAt(opponent.z);
    let laneCenter = laneLeft + laneWidth * (opponent.lanePos + 0.5);
    const baseHeight = state.height * 0.12;
    const baseWidth = state.width * 0.08;
    const aspect = opponentCarReady && opponentCarImg.naturalHeight
      ? opponentCarImg.naturalWidth / opponentCarImg.naturalHeight
      : baseWidth / baseHeight;
    const scale = 0.45 + 0.55 * p;
    const carHeight = baseHeight * scale;
    const carWidth = carHeight * aspect;
    const edgeLeft = roadLeft + carWidth * 0.6;
    const edgeRight = roadRight - carWidth * 0.6;
    laneCenter = Math.min(edgeRight, Math.max(edgeLeft, laneCenter));
    const y = state.horizon + p * (state.height - state.horizon) - carHeight * 0.8;
    const shadowAlpha = 0.22 + 0.28 * p;
    drawShadow(laneCenter, y + carHeight * 0.88, carWidth * 0.9, carHeight * 0.22, shadowAlpha);

    if (opponentCarReady) {
      ctx.drawImage(opponentCarImg, laneCenter - carWidth * 0.5, y, carWidth, carHeight);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(laneCenter - carWidth * 0.55, y + carHeight - 8, carWidth * 1.1, 8);

      ctx.fillStyle = opponent.color;
      ctx.fillRect(laneCenter - carWidth * 0.5, y, carWidth, carHeight);

      ctx.fillStyle = "#dff4ff";
      ctx.fillRect(laneCenter - carWidth * 0.3, y + carHeight * 0.15, carWidth * 0.6, carHeight * 0.2);
    }
  }
}

function drawFinishLine() {
  if (state.finishLineZ === null) {
    return;
  }
  if (state.finishLineZ <= 0 || state.finishLineZ > config.viewDistance) {
    return;
  }
  const { p, roadWidth, center, roadLeft, roadRight } = getRoadMetricsAt(state.finishLineZ);
  const y = state.horizon + p * (state.height - state.horizon);
  const stripeHeight = Math.max(6, 26 * p);
  const stripeWidth = roadRight - roadLeft;

  ctx.save();
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(roadLeft, y - stripeHeight, stripeWidth, stripeHeight);

  const blockSize = Math.max(6, stripeHeight * 0.6);
  const blocks = Math.floor(stripeWidth / blockSize);
  for (let i = 0; i < blocks; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#111" : "#f5f5f5";
    ctx.fillRect(roadLeft + i * blockSize, y - stripeHeight, blockSize, stripeHeight);
  }
  ctx.restore();
}

function drawItems() {
  for (const item of items) {
    if (item.z <= 0 || item.z > config.viewDistance) {
      continue;
    }
    const { p, roadWidth, center, laneWidth, laneLeft, roadLeft, roadRight } = getRoadMetricsAt(item.z);
    let laneCenter = laneLeft + laneWidth * (item.lane + 0.5);
    const size = laneWidth * 0.22;
    const edgeLeft = roadLeft + size * 0.7;
    const edgeRight = roadRight - size * 0.7;
    laneCenter = Math.min(edgeRight, Math.max(edgeLeft, laneCenter));
    const bob = Math.sin(item.bobPhase) * item.bobAmp * p;
    const y = state.horizon + p * (state.height - state.horizon) - size * 0.6 - bob;

    ctx.fillStyle = item.type === "green" ? "#3bd16f" : "#ff3d3d";
    ctx.fillRect(laneCenter - size * 0.5, y, size, size);
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(laneCenter - size * 0.18, y + size * 0.18, size * 0.36, size * 0.36);
  }
}

function drawCar() {
  let scale = 1;
  let rise = 0;
  if (state.raceFinished) {
    const t = Math.min(1, state.outroTime / config.outroDuration);
    scale = Math.max(0, 1 - t);
    rise = t * (state.height * config.outroRise);
  }
  if (scale <= 0) {
    return;
  }

  const baseHeight = state.height * 0.12;
  const baseWidth = state.width * 0.08;
  const useLeft = state.steerDir < 0;
  const useRight = state.steerDir > 0;

  let activeImg = playerCarImg;
  let activeReady = playerCarReady;
  if (useLeft && playerCarLeftReady) {
    activeImg = playerCarLeftImg;
    activeReady = playerCarLeftReady;
  } else if (useRight && playerCarRightReady) {
    activeImg = playerCarRightImg;
    activeReady = playerCarRightReady;
  }

  const aspect = activeReady && activeImg.naturalHeight
    ? activeImg.naturalWidth / activeImg.naturalHeight
    : baseWidth / baseHeight;
  const carHeight = baseHeight * scale;
  const carWidth = baseHeight * aspect * scale;
  const x = state.width * 0.5 - carWidth * 0.5 + state.playerX * state.width * 0.08;
  const y = state.height - carHeight - 30 - rise;

  state.playerRect = {
    x,
    y,
    w: carWidth,
    h: carHeight,
  };

  drawShadow(x + carWidth * 0.5, y + carHeight * 0.9, carWidth * 0.95, carHeight * 0.22, 0.35 * scale);

  if (activeReady) {
    ctx.drawImage(activeImg, x, y, carWidth, carHeight);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(x - 6, y + carHeight - 18, carWidth + 12, 18);

    ctx.fillStyle = "#d4232a";
    ctx.fillRect(x, y, carWidth, carHeight);

    ctx.fillStyle = "#7be3ff";
    ctx.fillRect(x + carWidth * 0.18, y + carHeight * 0.15, carWidth * 0.64, carHeight * 0.2);

    ctx.fillStyle = "#222";
    ctx.fillRect(x + carWidth * 0.1, y + carHeight * 0.78, carWidth * 0.18, carHeight * 0.18);
    ctx.fillRect(x + carWidth * 0.72, y + carHeight * 0.78, carWidth * 0.18, carHeight * 0.18);
  }
}

function drawShadow(cx, cy, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCountdown() {
  if (state.countdown <= 0) {
    return;
  }
  const showGo = state.countdown <= 0.6;
  const label = showGo ? "GO!" : String(Math.ceil(state.countdown));
  const pulse = showGo ? 1 + Math.sin(state.countdown * 12) * 0.08 : 1;

  ctx.save();
  ctx.translate(state.width / 2, state.height * 0.35);
  ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = showGo ? "#ffe14d" : "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 8;
  ctx.font = "bold 96px 'Space Grotesk', sans-serif";
  ctx.strokeText(label, 0, 0);
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i];
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vy += 140 * dt;
    if (spark.life <= 0) {
      sparks.splice(i, 1);
    }
  }
}

function drawSparks() {
  if (sparks.length === 0) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const spark of sparks) {
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x, spark.y, 3, 3);
  }
  ctx.restore();
}

function spawnConfetti() {
  confetti.length = 0;
  const colors = ["#ffd65a", "#4bd3ff", "#ff5c7a", "#7dff9e", "#b786ff"];
  for (let i = 0; i < config.confettiCount; i++) {
    confetti.push({
      x: Math.random() * state.width,
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 80,
      vy: 60 + Math.random() * 180,
      size: 4 + Math.random() * 6,
      life: config.confettiDuration,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 6,
    });
  }
}

function updateConfetti(dt) {
  if (confetti.length === 0) {
    return;
  }
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.life -= dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vy += 40 * dt;
    c.rot += c.rotSpeed * dt;
    if (c.life <= 0 || c.y > state.height + 40) {
      confetti.splice(i, 1);
    }
  }
}

function drawConfetti() {
  if (confetti.length === 0) {
    return;
  }
  ctx.save();
  for (const c of confetti) {
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.size * 0.5, -c.size * 0.2, c.size, c.size * 0.4);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
}

function drawSpeedLines() {
  const intensity = Math.max(0, Math.min(1, state.speed / config.maxSpeed));
  if (intensity <= 0.15 || speedLines.length === 0) {
    return;
  }

  const horizonY = state.horizon + 8;
  const bottomY = state.height - 30;
  const spanY = Math.max(1, bottomY - horizonY);
  const baseLength = config.speedLineLength * (0.35 + intensity * 1.6);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  for (const line of speedLines) {
    const p = Math.max(0, Math.min(1, line.y));
    const x = state.width * (0.08 + 0.84 * line.x);
    const y = horizonY + p * spanY;
    const lineLength = baseLength * (0.45 + 1.1 * p) * line.l;
    const lineWidth = config.speedLineWidth * (0.6 + 1.8 * p) * line.w;
    const alpha = config.speedLineAlpha * (0.35 + 0.65 * p) * line.a * intensity;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + lineLength);
    ctx.stroke();
  }
  ctx.restore();
}

function updateSpeedLines(dt) {
  const intensity = Math.max(0, Math.min(1, state.speed / config.maxSpeed));
  if (intensity <= 0.1 || speedLines.length === 0) {
    return;
  }
  const speedFactor = 0.4 + intensity * 2.1;
  for (const line of speedLines) {
    line.y += dt * speedFactor * (0.6 + line.l);
    line.x += dt * state.curveSmoothed * line.drift;
    if (line.y > 1.05) {
      line.y = 0;
      line.x = Math.random();
      line.w = 0.5 + Math.random() * 0.9;
      line.l = 0.5 + Math.random() * 0.9;
      line.a = 0.4 + Math.random() * 0.6;
      line.drift = (Math.random() - 0.5) * 0.4;
    }
    if (line.x < 0.02) {
      line.x = 0.02;
    } else if (line.x > 0.98) {
      line.x = 0.98;
    }
  }
}

function drawMiniMap() {
  if (miniMap.points.length === 0) {
    return;
  }
  const boxW = config.miniMapWidth;
  const boxH = config.miniMapHeight;
  const x0 = state.width - boxW - 16;
  const y0 = 16;

  const spanX = Math.max(1, miniMap.maxX - miniMap.minX);
  const sx = boxW / spanX;
  const sy = boxH / miniMap.total;

  ctx.save();
  ctx.fillStyle = "rgba(10, 12, 20, 0.55)";
  ctx.fillRect(x0, y0, boxW, boxH);
  ctx.strokeStyle = "rgba(200, 210, 230, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  miniMap.points.forEach((pt, index) => {
    const px = x0 + (pt.x - miniMap.minX) * sx;
    const py = y0 + pt.y * sy;
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.stroke();

  const dist = Math.min(state.distance, state.finishDistance);
  let marker = miniMap.points[0];
  for (let i = 1; i < miniMap.points.length; i++) {
    if (miniMap.points[i].y >= dist) {
      marker = miniMap.points[i];
      break;
    }
  }
  const mx = x0 + (marker.x - miniMap.minX) * sx;
  const my = y0 + marker.y * sy;
  ctx.fillStyle = "#ffda5a";
  ctx.beginPath();
  ctx.arc(mx, my, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function triggerCollisionEffects() {
  state.shakeTime = config.shakeDuration;
  state.shakeIntensity = config.shakeStrength;
  spawnSparks();
  playHitSound();
}

function spawnSparks() {
  if (!state.playerRect) {
    return;
  }
  const originX = state.playerRect.x + state.playerRect.w * 0.5;
  const originY = state.playerRect.y + state.playerRect.h * 0.2;
  for (let i = 0; i < 16; i++) {
    sparks.push({
      x: originX + (Math.random() - 0.5) * 16,
      y: originY + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 260,
      vy: -60 - Math.random() * 220,
      life: 0.3 + Math.random() * 0.25,
      color: Math.random() > 0.5 ? "#ffd65a" : "#ff8b2b",
    });
  }
}

function playHitSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "square";
  osc.frequency.value = 160;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  const now = audioContext.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.start(now);
  osc.stop(now + 0.2);
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000 || 0);
  last = ts;

  update(dt);
  let shakeX = 0;
  let shakeY = 0;
  if (state.shakeTime > 0) {
    const power = (state.shakeTime / config.shakeDuration) * state.shakeIntensity;
    shakeX = (Math.random() - 0.5) * power;
    shakeY = (Math.random() - 0.5) * power;
  }
  if (state.itemShakeTime > 0) {
    const power = (state.itemShakeTime / config.itemShakeDuration) * config.itemShakeStrength;
    shakeX += (Math.random() - 0.5) * power;
    shakeY += (Math.random() - 0.5) * power;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawGrass();
  drawRoad();
  drawRoadDistanceShade();
  drawHaze();
  drawLightPoles();
  drawFinishLine();
  drawItems();
  drawOpponents();
  drawDust();
  drawCar();
  drawSparks();
  drawSpeedLines();
  ctx.restore();
  if (state.overlayTimer > 0) {
    const strength = state.overlayTimer / config.overlayDuration;
    ctx.fillStyle = `rgba(8, 10, 16, ${strength * config.overlayAlpha})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  if (state.flashTimer > 0) {
    const strength = state.flashTimer / config.flashDuration;
    ctx.fillStyle = `rgba(255, 255, 255, ${strength * config.flashAlpha})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  drawCountdown();
  drawMiniMap();
  drawConfetti();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => state.keys.add(event.key));
window.addEventListener("keyup", (event) => state.keys.delete(event.key));
window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    resetRace();
  }
});

if (restartBtn) {
  restartBtn.addEventListener("click", () => resetRace());
}

resize();
state.collisionTimer = 0;
initOpponents();
requestAnimationFrame(loop);

function resetRace() {
  state.speed = 0;
  state.distance = 0;
  state.playerX = 0;
  state.countdown = 3.5;
  state.redSlowTimer = 0;
  state.raceTime = 0;
  state.raceDuration = 45;
  state.finishLineZ = state.finishDistance;
  state.raceFinished = false;
  state.raceFailed = false;
  state.itemCooldown = 0;
  state.lastItemSpawn = 0;
  items.length = 0;
  sparks.length = 0;
  confetti.length = 0;
  dust.length = 0;
  state.offRoad = false;
  state.offRoadAmount = 0;
  state.offRoadSide = 0;
  state.dustSpawnTimer = 0;
  initOpponents();
  updateEndScreen();
}

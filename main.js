const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const speedEl = document.getElementById("speed");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

const palette = {
  road1: "#5a5a5a",
  road2: "#4f4f4f",
  rumble1: "#2f2f2f",
  rumble2: "#262626",
  lane: "#f5f5f5",
};

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
  curveSmoothed: 0,
  steerTimer: 0,
  steerDir: 0,
  keys: new Set(),
};

const config = {
  maxSpeed: 260,
  accel: 140,
  brake: 240,
  decel: 80,
  turnSpeed: 0.9,
  laneCount: 3,
  curveScale: 0.28,
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
  itemSpawnGap: 1400,
  itemPickupZ: 90,
  itemPickupX: 0.18,
  overlayDuration: 0.8,
  overlayAlpha: 0.18,
  flashDuration: 0.12,
  flashAlpha: 0.35,
  itemShakeDuration: 0.2,
  itemShakeStrength: 3,
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
state.finishDistance = 25000;

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
  const raceLocked = countdownActive || state.raceFinished || state.raceFailed;
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
  const target = -state.curveSmoothed * config.curveScale;
  const steer = countdownActive ? 0 : turn * config.turnSpeed * dt;
  state.playerX += steer + target * dt;
  state.playerX = Math.max(-1, Math.min(1, state.playerX));

  if (!countdownActive && !state.raceFinished && !state.raceFailed) {
    state.raceTime += dt;
    updateOpponents(dt);
    updateItems(dt);
    updateFinishLine(dt);
  }

  if (state.raceTime >= state.raceDuration && !state.raceFinished) {
    state.raceFailed = true;
  }

  if (state.raceFinished || state.raceFailed) {
    state.speed = Math.max(0, state.speed - config.decel * dt * 1.2);
  }

  speedEl.textContent = Math.round(state.speed);
  if (timerEl) {
    const remaining = Math.max(0, state.raceDuration - state.raceTime);
    timerEl.textContent = remaining.toFixed(1);
  }
  if (statusEl) {
    statusEl.textContent = state.raceFinished ? "CHEGADA!" : state.raceFailed ? "TEMPO ESGOTADO" : "";
  }
}

function updateFinishLine(dt) {
  state.finishLineZ = state.finishDistance - state.distance;
  if (state.finishLineZ <= 0) {
    state.finishLineZ = 0;
    state.raceFinished = true;
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
    if (opponent.z > 0 && opponent.z < config.collisionZ) {
      const { roadWidth, center, laneWidth, laneLeft, laneRight, roadLeft, roadRight } = getRoadMetricsAt(opponent.z);
      let laneCenter = laneLeft + laneWidth * (opponent.lane + 0.5);
      const edgeLeft = roadLeft + laneWidth * 0.4;
      const edgeRight = roadRight - laneWidth * 0.4;
      laneCenter = Math.min(edgeRight, Math.max(edgeLeft, laneCenter));
      const opponentXNorm = (laneCenter - center) / (roadWidth * 0.5);

      if (Math.abs(state.playerX - opponentXNorm) < 0.25) {
        state.speed = Math.max(0, state.speed * 0.4);
        state.collisionTimer = config.collisionCooldown;
        triggerCollisionEffects();
        break;
      }
    }
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, state.height);
  grad.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue("--sky-top"));
  grad.addColorStop(0.6, getComputedStyle(document.documentElement).getPropertyValue("--sky-bottom"));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.width, state.height);
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

  for (let y = state.horizon; y < state.height; y++) {
    const p = (y - state.horizon) / (state.height - state.horizon);
    const roadWidth = state.roadMin + p * (state.roadMax - state.roadMin);
    const rumbleWidth = roadWidth * 0.08;
    const laneWidth = (roadWidth * 0.9) / config.laneCount;

    const curveOffset = (1 - p) * (1 - p) * curve * state.width * 0.6;
    const playerOffset = state.playerX * roadWidth * 0.32;
    const center = state.width * 0.5 + curveOffset - playerOffset;

    const isStripe = ((stripes + Math.floor(y / 8)) % 2) === 0;
    const roadColor = isStripe ? palette.road1 : palette.road2;
    const rumbleColor = isStripe ? palette.rumble1 : palette.rumble2;

    const left = center - roadWidth * 0.5;
    const right = center + roadWidth * 0.5;

    ctx.strokeStyle = rumbleColor;
    ctx.beginPath();
    ctx.moveTo(left - rumbleWidth, y);
    ctx.lineTo(left, y);
    ctx.stroke();

    ctx.strokeStyle = rumbleColor;
    ctx.beginPath();
    ctx.moveTo(right, y);
    ctx.lineTo(right + rumbleWidth, y);
    ctx.stroke();

    ctx.strokeStyle = roadColor;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    ctx.strokeStyle = palette.lane;
    ctx.lineWidth = 5;

    for (let i = 1; i < config.laneCount; i++) {
      const laneX = center - roadWidth * 0.45 + laneWidth * i;
      if (isStripe) {
        ctx.beginPath();
        ctx.moveTo(laneX, y);
        ctx.lineTo(laneX, y + 6);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
  }
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
  const carHeight = baseHeight;
  const carWidth = baseHeight * aspect;
  const x = state.width * 0.5 - carWidth * 0.5 + state.playerX * state.width * 0.08;
  const y = state.height - carHeight - 30;

  state.playerRect = {
    x,
    y,
    w: carWidth,
    h: carHeight,
  };

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
  drawFinishLine();
  drawItems();
  drawOpponents();
  drawCar();
  drawSparks();
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
  initOpponents();
}

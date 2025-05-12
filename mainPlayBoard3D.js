import * as THREE from "three";
import * as CANNON from "cannon-es";

// 씬 + 카메라
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111);
const camera = new THREE.PerspectiveCamera(45, 300 / 200, 0.1, 1000);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("diceCanvas"), alpha: true });
renderer.setSize(600, 400);
renderer.setPixelRatio(window.devicePixelRatio);

// 광원
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(3, 10, 3);
scene.add(light);

// 바닥 (Three + Cannon)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x333, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
const groundBody = new CANNON.Body({ mass: 0 });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

const diceMat = new CANNON.Material("dice");
const groundMat = new CANNON.Material("ground");

const contactMat = new CANNON.ContactMaterial(diceMat, groundMat, {
  restitution: 0.15, // ✔️ 낮을수록 덜 튐 (기본 0.3~0.8 사이가 큼)
  friction: 0.4
});
world.addContactMaterial(contactMat);

//천장
const ceilingBody = new CANNON.Body({ mass: 0 });
ceilingBody.addShape(new CANNON.Plane());
ceilingBody.position.set(0, 7, 0); // y 높이는 카메라 기준
ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0); // 아래를 향하도록
world.addBody(ceilingBody);

const ceilingMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({
    color: 0xff9999,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
  })
);
ceilingMesh.rotation.x = Math.PI / 2;
ceilingMesh.position.y = 7;
scene.add(ceilingMesh);


// 바닥에 적용
groundBody.material = groundMat;
world.addBody(groundBody);

// 울타리 벽 설정
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x00aaff,       // 💙 연한 하늘색
  transparent: true,     // ✅ 반투명 설정
  opacity: 0.4,          // ✅ 투명도 조절
  side: THREE.DoubleSide // 양면 렌더링
});

const wallThickness = 0.2;
const wallHeight = 5;
const arenaSize = 5; // 바닥 반지름

const wallDefs = [
  { x: 0, y: wallHeight / 2, z: -arenaSize, rotY: 0 },           // 뒤
  { x: 0, y: wallHeight / 2, z: arenaSize, rotY: 0 },             // 앞
  { x: -arenaSize, y: wallHeight / 2, z: 0, rotY: Math.PI / 2 }, // 왼쪽
  { x: arenaSize, y: wallHeight / 2, z: 0, rotY: Math.PI / 2 }   // 오른쪽
];

wallDefs.forEach(({ x, y, z, rotY }) => {
  const wallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2 * arenaSize, wallHeight, wallThickness),
    wallMaterial
  );
  wallMesh.position.set(x, y, z);
  wallMesh.rotation.y = rotY;
  scene.add(wallMesh);

  const wallShape = new CANNON.Box(new CANNON.Vec3(arenaSize, wallHeight / 2, wallThickness / 2));
  const wallBody = new CANNON.Body({ mass: 0 });
  wallBody.addShape(wallShape);
  wallBody.position.set(x, y, z);
  wallBody.quaternion.setFromEuler(0, rotY, 0);
  world.addBody(wallBody);
});


// 주사위 재질
// const diceMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
const unicodeDots = ["\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];

const diceMaterials = [
  createUnicodeDiceMaterial(unicodeDots[0]), // 1
  createUnicodeDiceMaterial(unicodeDots[5]), // 6
  createUnicodeDiceMaterial(unicodeDots[2]), // 3
  createUnicodeDiceMaterial(unicodeDots[3]), // 4
  createUnicodeDiceMaterial(unicodeDots[1]), // 2
  createUnicodeDiceMaterial(unicodeDots[4])  // 5
];

// 주사위 생성
const diceSize = 0.9;
const diceMeshes = [];
const diceBodies = [];
const diceResults = [1, 1, 1, 1, 1]; // 1~6 결과 저장용

for (let i = 0; i < 5; i++) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(diceSize, diceSize, diceSize),
    diceMaterials
  );
  scene.add(mesh);

  // 주사위에 적용
  const body = new CANNON.Body({
    mass: 2,
    shape: new CANNON.Box(new CANNON.Vec3(diceSize / 2, diceSize / 2, diceSize / 2)),
    material: diceMat
  });
  world.addBody(body);

  diceMeshes.push(mesh);
  diceBodies.push(body);
}

// 윗면 판별 함수
// ✔️ 이 순서로 주사위 값을 매핑해야 합니다
// [위, 아래, 오른쪽, 왼쪽, 앞, 뒤]
// getTopFaceValue 내부에서 사용
const faceToValue = {
  0: 3,  // +Y → 콘솔 1 → 화면 4
  1: 4,  // -Y → 콘솔 3 → 화면 1*
  2: 1,  // +X → 콘솔 5 → 화면 2
  3: 6,  // -X → 콘솔 6 → 화면 3*
  4: 2,  // +Z → 콘솔 2 → 화면 5
  5: 5   // -Z → 콘솔 4 → 화면 6*
};


const localAxes = [
  new CANNON.Vec3(0, 1, 0),  // 위
  new CANNON.Vec3(0, -1, 0), // 아래
  new CANNON.Vec3(1, 0, 0),  // 오른쪽
  new CANNON.Vec3(-1, 0, 0), // 왼쪽
  new CANNON.Vec3(0, 0, 1),  // 앞
  new CANNON.Vec3(0, 0, -1)  // 뒤
];

function getTopFaceValue(body) {
  const up = new CANNON.Vec3(0, 1, 0);
  const q = body.quaternion;
  let bestDot = -Infinity;
  let bestIndex = -1;

  localAxes.forEach((axis, index) => {
    const worldDir = q.vmult(axis);
    const dot = worldDir.dot(up);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = index;
    }
  });

  return faceToValue[bestIndex]; // 1~6 숫자
}

const faceQuaternions = {
  1: new CANNON.Quaternion().setFromEuler(0, 0, Math.PI/2),          // 1이 위 (Y+)
  2: new CANNON.Quaternion().setFromEuler(-Math.PI/2, 0, 0),     // 2이 위
  3: new CANNON.Quaternion().setFromEuler(0, 0, 0),                // 3이 위
  4: new CANNON.Quaternion().setFromEuler(Math.PI, 0, 0),    // 4이 위
  5: new CANNON.Quaternion().setFromEuler(Math.PI/2, 0, 0),      // 5이 위
  6: new CANNON.Quaternion().setFromEuler(0, 0, -Math.PI/2),          // 6이 위
};

let isRolling = false;

// 굴림
function rollDice() {
  console.log("let's roll");

  if (isRolling) return; // 이미 굴리는 중이면 무시
  isRolling = true;
  disableRollButtons(true); // 버튼 비활성화

  const held = playerStates[currentPlayer].held;

  for (let i = 0; i < 5; i++) {
    const body = diceBodies[i];

    if (held[i]) {
      // 📍 고정된 주사위는 시야 안에, 한쪽에 줄 세움
      const value = diceResults[i]; // 고정된 주사위 눈금
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.position.set(-8, 1, 3-i*1.5); // 시야 안 고정 위치
      body.quaternion.copy(faceQuaternions[value]); // ✔️ 눈금에 맞는 방향으로 회전 설정
      body.type = CANNON.Body.STATIC;
    } else {
      body.type = CANNON.Body.DYNAMIC;
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.position.set(Math.random() * 2 - 1, 5 + i, Math.random() * 2 - 1);
      body.angularVelocity.set(
        Math.random() * 5 + 2,
        Math.random() * 5 + 2,
        Math.random() * 5 + 2
      );
    }
  }

  waitUntilDiceStops().then(() => {
    for (let i = 0; i < 5; i++) {
      if (!held[i]) {
        const val = getTopFaceValue(diceBodies[i]);
        diceResults[i] = val;
      }
    }
    updateDiceToScoreboard();
    console.log("🎲 diceResults:", diceResults);
    isRolling = false;
    disableRollButtons(false); // 버튼 다시 활성화
  });
}

function disableRollButtons(disable) {
  document.querySelectorAll(".roll-button").forEach(btn => {
    btn.disabled = disable || Number(btn.dataset.player) !== currentPlayer;
  });
}

function waitUntilDiceStops(timeout = 5000, threshold = 0.1) {
  return new Promise((resolve) => {
    const start = performance.now();

    function check() {
      const allStopped = diceBodies.every(body => {
        return (
          body.velocity.length() < threshold &&
          body.angularVelocity.length() < threshold
        );
      });

      const elapsed = performance.now() - start;
      if (allStopped || elapsed > timeout) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }

    check();
  });
}


// 애니메이션
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60, clock.getDelta(), 3);

  for (let i = 0; i < 5; i++) {
    diceMeshes[i].position.copy(diceBodies[i].position);
    diceMeshes[i].quaternion.copy(diceBodies[i].quaternion);
  }

  renderer.render(scene, camera);
}
animate();

// 기존 dice[]와 renderDice()에 연결
function updateDiceToScoreboard() {
  const state = playerStates[currentPlayer];
  state.dice = diceResults.slice(); // 깊은 복사

  renderDice(); // Unicode 갱신
  updateScorePreview(currentPlayer);
}





function createUnicodeDiceMaterial(unicodeChar, bgColor = "#ffcc00", textColor = "#000") {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // 유니코드 주사위 눈 텍스트
  ctx.fillStyle = textColor;
  ctx.font = "bold 1000px serif"; // 또는 "Segoe UI Symbol", "Apple Symbols"
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unicodeChar, size / 2, size / 2);

  
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4; // 품질 향상
  texture.minFilter = THREE.LinearFilter; // 부드럽게
  return new THREE.MeshStandardMaterial({ map: texture });
}


// Yacht Dice 전체 점수 항목 포함 + 턴 관리 및 굴림 횟수 제한 + 현재 턴 강조 표시 + 공용 주사위 + 점수판

const diceArea = document.getElementById("diceArea");
const playersArea = document.getElementById("playersArea");
const urlParams = new URLSearchParams(window.location.search);

const players = [];
for (const [key, value] of urlParams.entries()) {
  if (key.startsWith("player")) {
    players.push(value);
  }
}

const scoreCategories = [
  "Aces (1)", "Twos (2)", "Threes (3)", "Fours (4)", "Fives (5)", "Sixes (6)", "Bonus",
  "Choice", "Four of a Kind", "Full House", "Small Straight", "Large Straight", "Yacht"
];

const diceUnicode = ["\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];

const playerStates = players.map(() => ({
  dice: [1, 1, 1, 1, 1],
  held: [false, false, false, false, false],
  scored: {},
  locked: {},
  rollsLeft: 3
}));

let currentPlayer = 0;

function renderDiceArea() {
  // shared-dice만 다시 그리도록 수정
  let display = document.getElementById("shared-dice");
  if (!display) {
    display = document.createElement("div");
    display.className = "dice-display";
    display.id = "shared-dice";
    diceArea.appendChild(display);
  }
  display.innerHTML = "";
  renderDice();
}


function renderDice() {
  const display = document.getElementById("shared-dice");
  const { dice, held } = playerStates[currentPlayer];
  display.innerHTML = "";

  dice.forEach((val, i) => {
    const dieSpan = document.createElement("span");
    dieSpan.textContent = diceUnicode[val - 1];
    dieSpan.className = "die";
    if (held[i]) dieSpan.classList.add("held");

    dieSpan.addEventListener("click", () => {
      if (playerStates[currentPlayer].rollsLeft === 3) return;
      held[i] = !held[i];
      renderDice();
    });

    display.appendChild(dieSpan);
  });
}



function calculateScore(category, dice, playerIndex = currentPlayer) {
  const counts = [0, 0, 0, 0, 0, 0];
  dice.forEach(d => counts[d - 1]++);
  const total = dice.reduce((a, b) => a + b, 0);

  switch (category) {
    case "Aces (1)": return counts[0] * 1;
    case "Twos (2)": return counts[1] * 2;
    case "Threes (3)": return counts[2] * 3;
    case "Fours (4)": return counts[3] * 4;
    case "Fives (5)": return counts[4] * 5;
    case "Sixes (6)": return counts[5] * 6;
    case "Bonus": {
      const state = playerStates[playerIndex];
      let upperTotal = 0;
      ["Aces (1)", "Twos (2)", "Threes (3)", "Fours (4)", "Fives (5)", "Sixes (6)"].forEach(cat => {
        if (state.scored[cat] !== undefined) upperTotal += state.scored[cat];
      });
      return upperTotal >= 63 ? 35 : 0;
    }
    case "Choice": return total;
    case "Four of a Kind": return counts.some(c => c >= 4) ? total : 0;
    case "Full House": return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case "Small Straight": {
      const straights = [
        [1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1]
      ];
      return straights.some(p => p.every((v, i) => v === 0 || counts[i] > 0)) ? 30 : 0;
    }
    case "Large Straight": {
      const l1 = [1, 1, 1, 1, 1, 0];
      const l2 = [0, 1, 1, 1, 1, 1];
      return l1.every((v, i) => v === 0 || counts[i] > 0) || l2.every((v, i) => v === 0 || counts[i] > 0) ? 40 : 0;
    }
    case "Yacht": return counts.includes(5) ? 50 : 0;
    default: return 0;
  }
}

function updateScorePreview(playerIndex) {
  const state = playerStates[playerIndex];
  const dice = state.dice;

  scoreCategories.forEach(category => {
    const cell = document.querySelector(
      `.score-cell[data-player="${playerIndex}"][data-category="${category}"]`
    );
    if (state.locked[category]) return;

    const score = calculateScore(category, dice, playerIndex);
    cell.textContent = score;
    cell.style.color = "#aaa";
  });
}

function updateTotalScore(playerIndex) {
  const scored = playerStates[playerIndex].scored;
  const total = Object.values(scored).reduce((sum, v) => sum + v, 0);
  document.getElementById(`total-score-${playerIndex}`).textContent = total;
}

function updateTurnDisplay() {
  disableRollButtons(isRolling); // 상태에 따라 버튼 갱신
  document.querySelectorAll(".player-block").forEach((block, index) => {
    block.classList.toggle("current-turn", index === currentPlayer);
  });
}

renderDiceArea();

players.forEach((name, index) => {
  const playerBlock = document.createElement("div");
  playerBlock.className = "player-block";

  const scoreDescriptions = {
    "Aces (1)": "1의 눈만 더한 값",
    "Twos (2)": "2의 눈만 더한 값",
    "Threes (3)": "3의 눈만 더한 값",
    "Fours (4)": "4의 눈만 더한 값",
    "Fives (5)": "5의 눈만 더한 값",
    "Sixes (6)": "6의 눈만 더한 값",
    "Bonus": "Aces부터 Sixes까지의 합이 63이상",
    "Choice": "모든 주사위 눈의 합",
    "Four of a Kind": "같은 숫자 4개가 있으면 전체 합",
    "Full House": "3개+2개 세트면 25점",
    "Small Straight": "연속된 숫자 4개 이상이면 30점",
    "Large Straight": "연속된 숫자 5개면 40점",
    "Yacht": "모두 같은 숫자면 50점"
  };

  const scoreRows = scoreCategories.map(category =>
    `<tr><td title="${scoreDescriptions[category]}">${category}</td><td class="score-cell" data-player="${index}" data-category="${category}" title="${scoreDescriptions[category]}">-</td></tr>`
  ).join("");

  const totalScoreRow = `
    <tr class="total-row">
      <td><strong>총점</strong></td>
      <td id="total-score-${index}" class="score-total">0</td>
    </tr>`;

  playerBlock.innerHTML = `
    <h2>플레이어 ${index + 1}: ${name}</h2>
    <button class="roll-button" data-player="${index}">🎲 주사위 굴리기 (남은 횟수: <span id="rolls-left-${index}">3</span>)</button>
    <table class="score-table">
      <thead><tr><th>항목</th><th>점수</th></tr></thead>
      <tbody>${scoreRows}${totalScoreRow}</tbody>
    </table>`;

  playersArea.appendChild(playerBlock);
});

updateTurnDisplay();

const resetButton = document.createElement("button");
resetButton.textContent = "🔄 처음부터 다시 시작";
resetButton.className = "roll-button";
resetButton.style.margin = "2rem auto";
resetButton.style.display = "block";
resetButton.onclick = () => {
  if (confirm("정말 처음부터 다시 시작하시겠습니까?")) {
    document.body.classList.add("fade-out");
    setTimeout(() => {
      window.location.href = window.location.pathname + window.location.search;
    }, 500);
  }
};
document.body.appendChild(resetButton);

document.querySelectorAll(".score-cell").forEach(cell => {
  cell.addEventListener("click", () => {
    const playerIndex = Number(cell.dataset.player);
    const category = cell.dataset.category;
    const state = playerStates[playerIndex];

    if (
      playerIndex !== currentPlayer ||
      state.locked[category] ||
      state.rollsLeft === 3 ||
      category === "Bonus" // 🔒 Bonus는 수동 확정 방지
    ) return;

    if (playerIndex !== currentPlayer || state.locked[category] || state.rollsLeft === 3) return;

    const score = calculateScore(category, state.dice);
    state.scored[category] = score;
    state.locked[category] = true;

    cell.textContent = score;
    cell.classList.add("score-flash");
    setTimeout(() => cell.classList.remove("score-flash"), 600);
    cell.style.color = "white";
    cell.style.fontWeight = "bold";

    // ✅ Bonus 자동 확정 (오직 Aces~Sixes가 모두 채워졌을 때만)
    if (!state.locked["Bonus"]) {
        const upperCategories = [
          "Aces (1)", "Twos (2)", "Threes (3)",
          "Fours (4)", "Fives (5)", "Sixes (6)"
        ];

        const allUpperLocked = upperCategories.every(cat => state.locked[cat]);

        if (allUpperLocked) {
          let upperTotal = upperCategories.reduce((sum, cat) => sum + (state.scored[cat] || 0), 0);
          const bonusScore = upperTotal >= 63 ? 35 : 0;

          state.scored["Bonus"] = bonusScore;
          state.locked["Bonus"] = true;

          const bonusCell = document.querySelector(`.score-cell[data-player="${playerIndex}"][data-category="Bonus"]`);
          if (bonusCell) {
            bonusCell.textContent = bonusScore;
            bonusCell.style.color = "white";
            bonusCell.style.fontWeight = "bold";
            bonusCell.classList.add("score-flash");
            setTimeout(() => bonusCell.classList.remove("score-flash"), 600);
          }
        }
      }


    updateTotalScore(playerIndex);

    state.rollsLeft = 3;
    state.held = [false, false, false, false, false];
    document.getElementById(`rolls-left-${playerIndex}`).textContent = 3;

    currentPlayer = (currentPlayer + 1) % players.length;
    updateTurnDisplay();
    renderDice();
  });
});

// 주사위 굴림 버튼 → rollDice 호출
document.querySelectorAll(".roll-button").forEach(button => {
  button.addEventListener("click", () => {
    const playerIndex = Number(button.dataset.player);
    if (playerIndex !== currentPlayer || playerStates[playerIndex].rollsLeft <= 0) return;

    playerStates[playerIndex].rollsLeft--;
    document.getElementById(`rolls-left-${playerIndex}`).textContent = playerStates[playerIndex].rollsLeft;

    rollDice(); // 실제 Cannon.js 기반 굴림
  });
});

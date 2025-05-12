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
  const display = document.createElement("div");
  display.className = "dice-display";
  display.id = "shared-dice";
  diceArea.innerHTML = "";
  diceArea.appendChild(display);
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
    };
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
  document.querySelectorAll(".roll-button").forEach(btn => {
    btn.disabled = Number(btn.dataset.player) !== currentPlayer;
  });

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

document.querySelectorAll(".roll-button").forEach(button => {
  button.addEventListener("click", async () => {
    const playerIndex = Number(button.dataset.player);
    const state = playerStates[playerIndex];

    if (playerIndex !== currentPlayer || state.rollsLeft <= 0) return;

    for (let t = 0; t < 5; t++) {
      const tempDice = state.dice.map((val, i) =>
        state.held[i] ? val : Math.floor(Math.random() * 6) + 1
      );
      const display = document.getElementById("shared-dice");
      display.innerHTML = "";
      tempDice.forEach((val, i) => {
        const dieSpan = document.createElement("span");
        dieSpan.textContent = diceUnicode[val - 1];
        dieSpan.className = "die animating";
        if (state.held[i]) dieSpan.classList.add("held");
        display.appendChild(dieSpan);
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    state.dice = state.dice.map((val, i) =>
      state.held[i] ? val : Math.floor(Math.random() * 6) + 1
    );
    state.rollsLeft--;
    document.getElementById(`rolls-left-${playerIndex}`).textContent = state.rollsLeft;

    renderDice();
    updateScorePreview(playerIndex);
  });
});

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
let playerCount = 1;

document.getElementById("addPlayerBtn").addEventListener("click", () => {
  playerCount++;
  const input = document.createElement("input");
  input.type = "text";
  input.name = `player${playerCount}`;
  input.placeholder = `Player ${playerCount} 이름`;
  input.required = true;
  document.getElementById("playerInputs").appendChild(input);
});

document.getElementById("startBtn").addEventListener("click", () => {
  const form = document.getElementById("playerForm");
  const formData = new FormData(form);
  const params = new URLSearchParams(formData).toString();
  window.location.href = `mainPlayBoard.html?${params}`;
});

document.getElementById("start3DBtn").addEventListener("click", () => {
  const form = document.getElementById("playerForm");
  const formData = new FormData(form);
  const params = new URLSearchParams(formData).toString();
  window.location.href = `mainPlayBoard3D.html?${params}`;
});
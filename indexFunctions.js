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

document.getElementById("playerForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const params = new URLSearchParams(formData).toString();
  window.location.href = `mainPlayBoard.html?${params}`;
});

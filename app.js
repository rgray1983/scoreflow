const state = {
  homeScore: 0,
  awayScore: 0,
  homeSets: 0,
  awaySets: 0,
  setNumber: 1,
  winBy: 2,
  setsToWin: 2,
  history: [],
  lastAlert: "",
  homeColor: "#d62828",
  awayColor: "#1565c0",
  confettiRunning: false,
  confettiAnimation: null
};

const COLORS = [
  { name: "Red", value: "#d62828" },
  { name: "Orange", value: "#f97316" },
  { name: "Gold", value: "#fbbf24" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#1565c0" },
  { name: "Purple", value: "#7e22ce" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
  { name: "Black", value: "#111827" }
];

const $ = (id) => document.getElementById(id);
const els = {
  matchTitle: $("matchTitle"),
  titleInput: $("titleInput"),
  homeName: $("homeName"),
  awayName: $("awayName"),
  homeNameSetting: $("homeNameSetting"),
  awayNameSetting: $("awayNameSetting"),
  homeScoreBtn: $("homeScoreBtn"),
  awayScoreBtn: $("awayScoreBtn"),
  homeSets: $("homeSets"),
  awaySets: $("awaySets"),
  homeSetDots: $("homeSetDots"),
  awaySetDots: $("awaySetDots"),
  setNumber: $("setNumber"),
  raceTo: $("raceTo"),
  alertBanner: $("alertBanner"),
  settingsDialog: $("settingsDialog"),
  toast: $("toast"),
  homeLogoInput: $("homeLogoInput"),
  awayLogoInput: $("awayLogoInput"),
  homeLogo: $("homeLogo"),
  awayLogo: $("awayLogo"),
  homeInitial: $("homeInitial"),
  awayInitial: $("awayInitial"),
  homeSwatches: $("homeSwatches"),
  awaySwatches: $("awaySwatches"),
  winnerOverlay: $("winnerOverlay"),
  winnerText: $("winnerText")
};

function teamName(team) {
  return (team === "home" ? els.homeName.value : els.awayName.value).trim() || (team === "home" ? "Blazers" : "Visitor");
}

function otherTeam(team) {
  return team === "home" ? "away" : "home";
}

function pointsToWinForCurrentSet() {
  return state.setNumber >= 3 ? 15 : 25;
}

function snapshot() {
  state.history.push(JSON.stringify({
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homeSets: state.homeSets,
    awaySets: state.awaySets,
    setNumber: state.setNumber,
    lastAlert: state.lastAlert
  }));
  if (state.history.length > 80) state.history.shift();
}

function toast(message, hot = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("hot", hot);
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

function renderSetDots(container, won) {
  container.innerHTML = "";
  for (let i = 1; i <= state.setsToWin; i++) {
    const dot = document.createElement("span");
    dot.className = `set-dot${i <= won ? " won" : ""}`;
    container.appendChild(dot);
  }
}

function render() {
  const target = pointsToWinForCurrentSet();
  els.homeScoreBtn.textContent = state.homeScore;
  els.awayScoreBtn.textContent = state.awayScore;
  els.homeSets.textContent = state.homeSets;
  els.awaySets.textContent = state.awaySets;
  els.setNumber.textContent = state.setNumber;
  els.raceTo.textContent = target;
  els.homeInitial.textContent = teamName("home").charAt(0).toUpperCase();
  els.awayInitial.textContent = teamName("away").charAt(0).toUpperCase();

  renderSetDots(els.homeSetDots, state.homeSets);
  renderSetDots(els.awaySetDots, state.awaySets);
  updateAlertBanner();
}

function updateAlertBanner() {
  const target = pointsToWinForCurrentSet();
  const homePoint = isPointOpportunity("home");
  const awayPoint = isPointOpportunity("away");
  els.alertBanner.classList.toggle("hot", homePoint || awayPoint);

  if (homePoint) {
    els.alertBanner.textContent = state.homeSets === state.setsToWin - 1 ? "Match Point" : "Set Point";
  } else if (awayPoint) {
    els.alertBanner.textContent = state.awaySets === state.setsToWin - 1 ? "Match Point" : "Set Point";
  } else {
    els.alertBanner.textContent = `Race to ${target}`;
  }
}

function scoreOf(team) {
  return state[`${team}Score`];
}

function setScore(team, value) {
  state[`${team}Score`] = Math.max(0, value);
}

function hasWonSet(team) {
  const target = pointsToWinForCurrentSet();
  const own = scoreOf(team);
  const opp = scoreOf(otherTeam(team));
  return own >= target && own - opp >= state.winBy;
}

function isPointOpportunity(team) {
  const target = pointsToWinForCurrentSet();
  const own = scoreOf(team);
  const opp = scoreOf(otherTeam(team));
  const pointNeeded = Math.max(target, opp + state.winBy);
  return own === pointNeeded - 1;
}

function point(team) {
  if (state.homeSets >= state.setsToWin || state.awaySets >= state.setsToWin) return;
  snapshot();
  setScore(team, scoreOf(team) + 1);
  render();
  checkMilestones(team);
}

function subtract(team) {
  if (scoreOf(team) <= 0) return;
  snapshot();
  setScore(team, scoreOf(team) - 1);
  state.lastAlert = "";
  render();
}

function checkMilestones(team) {
  if (hasWonSet(team)) {
    winSet(team);
    return;
  }

  if (isPointOpportunity(team)) {
    const possibleMatch = state[`${team}Sets`] === state.setsToWin - 1;
    const msg = possibleMatch ? `MATCH POINT — ${teamName(team)}!` : `SET POINT — ${teamName(team)}!`;
    if (state.lastAlert !== msg) {
      state.lastAlert = msg;
      toast(msg, true);
      pulseCenter();
    }
  }
}

function winSet(team) {
  state[`${team}Sets`] += 1;
  const wonMatch = state[`${team}Sets`] >= state.setsToWin;
  render();

  if (wonMatch) {
    showWinner(team);
    return;
  }

  toast(`${teamName(team)} wins Set ${state.setNumber}!`, true);
  startTimedConfetti(1600);
  setTimeout(() => {
    state.setNumber += 1;
    state.homeScore = 0;
    state.awayScore = 0;
    state.lastAlert = "";
    render();
  }, 1100);
}

function newSet() {
  if (state.setNumber >= 3) {
    toast("Best 2 of 3 only has three sets", true);
    return;
  }
  snapshot();
  state.homeScore = 0;
  state.awayScore = 0;
  state.setNumber += 1;
  state.lastAlert = "";
  render();
  toast(`Set ${state.setNumber} ready`);
}

function newMatch() {
  const ok = confirm("Start a new match? This clears scores and sets.");
  if (!ok) return;
  snapshot();
  state.homeScore = 0;
  state.awayScore = 0;
  state.homeSets = 0;
  state.awaySets = 0;
  state.setNumber = 1;
  state.lastAlert = "";
  stopConfetti();
  hideWinner();
  render();
  toast("New match ready");
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    toast("Nothing to undo");
    return;
  }
  Object.assign(state, JSON.parse(previous));
  stopConfetti();
  hideWinner();
  render();
  toast("Undone");
}

function saveSettings() {
  els.matchTitle.textContent = els.titleInput.value.trim() || "Game Night";
  els.homeName.value = els.homeNameSetting.value.trim() || "Blazers";
  els.awayName.value = els.awayNameSetting.value.trim() || "Visitor";
  state.lastAlert = "";
  render();
  toast("Setup saved");
}

function openSettings() {
  els.titleInput.value = els.matchTitle.textContent;
  els.homeNameSetting.value = els.homeName.value;
  els.awayNameSetting.value = els.awayName.value;
  els.settingsDialog.showModal();
}

function handleLogo(input, img, picker) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    img.src = reader.result;
    picker.classList.add("has-logo");
  };
  reader.readAsDataURL(file);
}

function toggleFullscreen() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

function pulseCenter() {
  els.alertBanner.animate([
    { transform: "scale(1)", filter: "brightness(1)" },
    { transform: "scale(1.08)", filter: "brightness(1.7)" },
    { transform: "scale(1)", filter: "brightness(1)" }
  ], { duration: 620, easing: "ease-out" });
}

function buildSwatches(container, team) {
  container.innerHTML = "";
  COLORS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.title = color.name;
    button.style.background = color.value;
    button.dataset.value = color.value;
    button.addEventListener("click", () => setTeamColor(team, color.value));
    container.appendChild(button);
  });
}

function setTeamColor(team, value) {
  state[`${team}Color`] = value;
  document.documentElement.style.setProperty(team === "home" ? "--home" : "--away", value);
  document.querySelectorAll(`#${team}Swatches .swatch`).forEach((swatch) => {
    swatch.classList.toggle("selected", swatch.dataset.value.toLowerCase() === value.toLowerCase());
  });
}

function resizeCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startConfetti() {
  const canvas = $("confettiCanvas");
  const ctx = canvas.getContext("2d");
  resizeCanvas(canvas, ctx);

  const colors = [state.homeColor, state.awayColor, "#ffd166", "#ffffff", "#ff3b30"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight,
    size: 5 + Math.random() * 9,
    speed: 1.7 + Math.random() * 4.2,
    drift: -1.5 + Math.random() * 3,
    spin: Math.random() * Math.PI,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  state.confettiRunning = true;
  cancelAnimationFrame(state.confettiAnimation);

  function draw() {
    if (!state.confettiRunning) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      return;
    }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pieces.forEach((p) => {
      p.y += p.speed;
      p.x += p.drift;
      p.spin += 0.12;
      if (p.y > window.innerHeight + 30) {
        p.y = -30;
        p.x = Math.random() * window.innerWidth;
      }
      if (p.x < -30) p.x = window.innerWidth + 30;
      if (p.x > window.innerWidth + 30) p.x = -30;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
    });
    state.confettiAnimation = requestAnimationFrame(draw);
  }
  draw();
}

function stopConfetti() {
  state.confettiRunning = false;
  cancelAnimationFrame(state.confettiAnimation);
  const canvas = $("confettiCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function startTimedConfetti(ms) {
  startConfetti();
  clearTimeout(startTimedConfetti.timer);
  startTimedConfetti.timer = setTimeout(stopConfetti, ms);
}

function showWinner(team) {
  els.winnerText.textContent = `${teamName(team)} Wins!`;
  document.body.classList.add("celebrating");
  els.winnerOverlay.classList.add("show");
  startConfetti();
}

function hideWinner() {
  els.winnerOverlay.classList.remove("show");
  document.body.classList.remove("celebrating");
}

function closeWinner() {
  hideWinner();
  stopConfetti();
}

$("homePlus").addEventListener("click", () => point("home"));
$("awayPlus").addEventListener("click", () => point("away"));
$("homeScoreBtn").addEventListener("click", () => point("home"));
$("awayScoreBtn").addEventListener("click", () => point("away"));
$("homeMinus").addEventListener("click", () => subtract("home"));
$("awayMinus").addEventListener("click", () => subtract("away"));
$("undoBtn").addEventListener("click", undo);
$("newSetBtn").addEventListener("click", newSet);
$("newMatchBtn").addEventListener("click", newMatch);
$("settingsBtn").addEventListener("click", openSettings);
$("fullscreenBtn").addEventListener("click", toggleFullscreen);
$("saveSettingsBtn").addEventListener("click", saveSettings);
els.homeLogoInput.addEventListener("change", () => handleLogo(els.homeLogoInput, els.homeLogo, els.homeLogoInput.closest(".logo-picker")));
els.awayLogoInput.addEventListener("change", () => handleLogo(els.awayLogoInput, els.awayLogo, els.awayLogoInput.closest(".logo-picker")));
els.homeName.addEventListener("input", render);
els.awayName.addEventListener("input", render);
els.winnerOverlay.addEventListener("click", closeWinner);
els.winnerOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") closeWinner();
});
window.addEventListener("resize", () => {
  if (state.confettiRunning) startConfetti();
});

buildSwatches(els.homeSwatches, "home");
buildSwatches(els.awaySwatches, "away");
setTeamColor("home", state.homeColor);
setTeamColor("away", state.awayColor);
render();

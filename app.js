import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const GAME_ID_FROM_URL = params.get("game");
const MODE_FROM_URL = params.get("mode") || "scorer";
const isViewer = MODE_FROM_URL === "view";

const state = {
  homeScore: 0,
  awayScore: 0,
  homeSets: 0,
  awaySets: 0,
  setNumber: 1,
  winBy: 2,
  setsToWin: 2,
  matchFormat: "club",
  matchSets: 3,
  history: [],
  lastAlert: "",
  homeColor: "#d62828",
  awayColor: "#1565c0",
  matchTitle: "Game Night",
  homeName: "Team 1",
  awayName: "Team 2",
  winner: "",
  setFlashTeam: "",
  setFlashId: 0,
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
  app: $("app"),
  matchTitle: $("matchTitle"),
  liveStatus: $("liveStatus"),
  titleInput: $("titleInput"),
  homeName: $("homeName"),
  awayName: $("awayName"),
  homeNameSetting: $("homeNameSetting"),
  awayNameSetting: $("awayNameSetting"),
  matchFormatSetting: $("matchFormatSetting"),
  matchPill: $("matchPill"),
  homeScoreBtn: $("homeScoreBtn"),
  awayScoreBtn: $("awayScoreBtn"),
  homeSetWinBadge: $("homeSetWinBadge"),
  awaySetWinBadge: $("awaySetWinBadge"),
  homeSets: $("homeSets"),
  awaySets: $("awaySets"),
  homeSetDots: $("homeSetDots"),
  awaySetDots: $("awaySetDots"),
  setNumber: $("setNumber"),
  raceTo: $("raceTo"),
  alertBanner: $("alertBanner"),
  settingsDialog: $("settingsDialog"),
  shareDialog: $("shareDialog"),
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
  winnerText: $("winnerText"),
  viewerLink: $("viewerLink"),
  nativeShareBtn: $("nativeShareBtn"),
  firebaseNote: $("firebaseNote")
};

let db = null;
let liveGameId = GAME_ID_FROM_URL || "";
let unsubscribeLive = null;
let applyingRemote = false;
let liveReady = false;
let remoteTimer = null;

function hasFirebaseConfig() {
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.appId);
}

function initFirebase() {
  if (!hasFirebaseConfig()) return false;
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function publicState() {
  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homeSets: state.homeSets,
    awaySets: state.awaySets,
    setNumber: state.setNumber,
    winBy: state.winBy,
    setsToWin: state.setsToWin,
    matchFormat: state.matchFormat,
    matchSets: state.matchSets,
    lastAlert: state.lastAlert,
    homeColor: state.homeColor,
    awayColor: state.awayColor,
    matchTitle: state.matchTitle,
    homeName: state.homeName,
    awayName: state.awayName,
    winner: state.winner,
    setFlashTeam: state.setFlashTeam,
    setFlashId: state.setFlashId
  };
}

function applyState(next) {
  const incomingFlashId = Number(next.setFlashId ?? 0);
  const incomingFlashTeam = next.setFlashTeam || "";
  const shouldFlashSetWinner = incomingFlashId && incomingFlashId !== state.setFlashId;

  Object.assign(state, {
    homeScore: Number(next.homeScore ?? 0),
    awayScore: Number(next.awayScore ?? 0),
    homeSets: Number(next.homeSets ?? 0),
    awaySets: Number(next.awaySets ?? 0),
    setNumber: Number(next.setNumber ?? 1),
    winBy: Number(next.winBy ?? 2),
    setsToWin: Number(next.setsToWin ?? 2),
    matchFormat: next.matchFormat || (Number(next.setsToWin ?? 2) === 3 ? "highschool" : "club"),
    matchSets: Number(next.matchSets ?? (Number(next.setsToWin ?? 2) === 3 ? 5 : 3)),
    lastAlert: next.lastAlert ?? "",
    homeColor: next.homeColor || "#d62828",
    awayColor: next.awayColor || "#1565c0",
    matchTitle: next.matchTitle || "Game Night",
    homeName: next.homeName || "Team 1",
    awayName: next.awayName || "Team 2",
    winner: next.winner || "",
    setFlashTeam: incomingFlashTeam,
    setFlashId: incomingFlashId
  });
  setTeamColor("home", state.homeColor, false);
  setTeamColor("away", state.awayColor, false);
  render();
  if (shouldFlashSetWinner) triggerSetWinBadge(incomingFlashTeam);
  if (state.winner) showWinner(state.winner, false);
  else hideWinner();
}

function liveDocRef() {
  return doc(db, "volleyballGames", liveGameId);
}

function buildViewerLink(gameId = liveGameId) {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  return `${cleanUrl}?game=${encodeURIComponent(gameId)}&mode=view`;
}

function buildScorerLink(gameId = liveGameId) {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  return `${cleanUrl}?game=${encodeURIComponent(gameId)}&mode=scorer`;
}

async function createLiveGame() {
  if (!db) {
    els.firebaseNote.textContent = "Live sharing needs Firebase connected first. Fill in firebase-config.js, then push again.";
    toast("Firebase config needed", true);
    return;
  }

  if (!liveGameId) {
    liveGameId = `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  await setDoc(liveDocRef(), {
    ...publicState(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }, { merge: true });

  els.viewerLink.value = buildViewerLink();
  els.firebaseNote.textContent = "Live game created. Share the viewer link with family.";
  window.history.replaceState({}, "", buildScorerLink());
  await startLiveListener();
  toast("Live game created");
}

function queueRemoteUpdate() {
  // Push every scorer change to Firestore. Use setDoc(..., merge:true) instead
  // of updateDoc so a live game can recover even if the document was not fully ready yet.
  if (!db || !liveGameId || isViewer || applyingRemote) return;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(pushRemoteUpdate, 120);
}

async function pushRemoteUpdate() {
  if (!db || !liveGameId || isViewer || applyingRemote) return;
  try {
    await setDoc(liveDocRef(), {
      ...publicState(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true });
    liveReady = true;
    els.liveStatus.textContent = "Live Scorer Mode · Synced";
  } catch (error) {
    console.error(error);
    els.liveStatus.textContent = "Live sync failed";
    toast("Live update failed", true);
  }
}

async function startLiveListener() {
  if (!db || !liveGameId) return;
  unsubscribeLive?.();
  const ref = liveDocRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    if (isViewer) {
      els.liveStatus.textContent = "Game not found";
      toast("Game link not found", true);
      return;
    }
    await setDoc(ref, { ...publicState(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  els.viewerLink.value = buildViewerLink();
  liveReady = true;
  els.liveStatus.textContent = isViewer ? "Live Viewer Mode" : "Live Scorer Mode";
  document.body.classList.toggle("viewer-mode", isViewer);

  unsubscribeLive = onSnapshot(ref, (documentSnap) => {
    if (!documentSnap.exists()) return;
    applyingRemote = true;
    applyState(documentSnap.data());
    applyingRemote = false;
    liveReady = true;
    els.liveStatus.textContent = isViewer ? "Live Viewer Mode · Updated" : "Live Scorer Mode · Connected";
  }, (error) => {
    console.error(error);
    els.liveStatus.textContent = "Live connection error";
    toast("Live connection error", true);
  });
}

function teamName(team) {
  return (team === "home" ? state.homeName : state.awayName).trim() || (team === "home" ? "Team 1" : "Team 2");
}

function otherTeam(team) {
  return team === "home" ? "away" : "home";
}

function pointsToWinForCurrentSet() {
  return state.setNumber >= state.matchSets ? 15 : 25;
}

function matchLabel() {
  return state.matchFormat === "highschool" ? "High School · Best 3 of 5" : "Club · Best 2 of 3";
}

function applyMatchFormat(format) {
  state.matchFormat = format === "highschool" ? "highschool" : "club";
  state.matchSets = state.matchFormat === "highschool" ? 5 : 3;
  state.setsToWin = state.matchFormat === "highschool" ? 3 : 2;

  if (state.setNumber > state.matchSets) state.setNumber = state.matchSets;
  if (state.homeSets > state.setsToWin) state.homeSets = state.setsToWin;
  if (state.awaySets > state.setsToWin) state.awaySets = state.setsToWin;
}

function snapshot() {
  state.history.push(JSON.stringify(publicState()));
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
  els.matchTitle.textContent = state.matchTitle;
  els.titleInput.value = state.matchTitle;
  els.homeName.value = state.homeName;
  els.awayName.value = state.awayName;
  els.homeNameSetting.value = state.homeName;
  els.awayNameSetting.value = state.awayName;
  els.matchFormatSetting.value = state.matchFormat;
  els.matchPill.textContent = matchLabel();
  els.homeScoreBtn.textContent = state.homeScore;
  els.awayScoreBtn.textContent = state.awayScore;
  els.homeSets.textContent = state.homeSets;
  els.awaySets.textContent = state.awaySets;
  els.setNumber.textContent = state.setNumber;
  if (els.raceTo) els.raceTo.textContent = target;
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
    els.alertBanner.textContent = `Race ${target}`;
  }
}

function scoreOf(team) { return state[`${team}Score`]; }
function setScore(team, value) { state[`${team}Score`] = Math.max(0, value); }

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
  if (isViewer) return;
  if (state.homeSets >= state.setsToWin || state.awaySets >= state.setsToWin) return;
  snapshot();
  setScore(team, scoreOf(team) + 1);
  render();
  checkMilestones(team);
  queueRemoteUpdate();
}

function subtract(team) {
  if (isViewer || scoreOf(team) <= 0) return;
  snapshot();
  setScore(team, scoreOf(team) - 1);
  state.lastAlert = "";
  state.winner = "";
  state.setFlashTeam = "";
  state.setFlashId = 0;
  render();
  queueRemoteUpdate();
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
  state.setFlashTeam = team;
  state.setFlashId = Date.now();
  const wonMatch = state[`${team}Sets`] >= state.setsToWin;
  render();
  triggerSetWinBadge(team);

  if (wonMatch) {
    state.winner = team;
    showWinner(team, true);
    queueRemoteUpdate();
    return;
  }

  toast(`${teamName(team)} wins Set ${state.setNumber}!`, true);
  startTimedConfetti(1600);
  queueRemoteUpdate();
  setTimeout(() => {
    if (state.winner) return;
    state.setNumber += 1;
    state.homeScore = 0;
    state.awayScore = 0;
    state.lastAlert = "";
    render();
    queueRemoteUpdate();
  }, 1100);
}

function newSet() {
  if (isViewer) return;
  if (state.setNumber >= state.matchSets) {
    toast(`${matchLabel()} only has ${state.matchSets} sets`, true);
    return;
  }
  snapshot();
  state.homeScore = 0;
  state.awayScore = 0;
  state.setNumber += 1;
  state.lastAlert = "";
  state.winner = "";
  render();
  queueRemoteUpdate();
  toast(`Set ${state.setNumber} ready`);
}

function newMatch() {
  if (isViewer) return;
  const ok = confirm("Start a new match? This clears scores and sets.");
  if (!ok) return;
  snapshot();
  state.homeScore = 0;
  state.awayScore = 0;
  state.homeSets = 0;
  state.awaySets = 0;
  state.setNumber = 1;
  state.lastAlert = "";
  state.winner = "";
  state.setFlashTeam = "";
  state.setFlashId = 0;
  stopConfetti();
  hideWinner();
  render();
  queueRemoteUpdate();
  toast("New match ready");
}

function undo() {
  if (isViewer) return;
  const previous = state.history.pop();
  if (!previous) {
    toast("Nothing to undo");
    return;
  }
  applyState(JSON.parse(previous));
  stopConfetti();
  hideWinner();
  queueRemoteUpdate();
  toast("Undone");
}

function saveSettings() {
  if (isViewer) return;
  const nextFormat = els.matchFormatSetting.value;
  const formatChanged = nextFormat !== state.matchFormat;

  state.matchTitle = els.titleInput.value.trim() || "Game Night";
  state.homeName = els.homeNameSetting.value.trim() || "Team 1";
  state.awayName = els.awayNameSetting.value.trim() || "Team 2";

  if (formatChanged && (state.homeScore || state.awayScore || state.homeSets || state.awaySets)) {
    const ok = confirm("Changing match format will reset the current match. Continue?");
    if (!ok) return;
    state.homeScore = 0;
    state.awayScore = 0;
    state.homeSets = 0;
    state.awaySets = 0;
    state.setNumber = 1;
    state.winner = "";
    state.setFlashTeam = "";
    state.setFlashId = 0;
    hideWinner();
    stopConfetti();
  }

  applyMatchFormat(nextFormat);
  state.lastAlert = "";
  render();
  queueRemoteUpdate();
  toast("Setup saved");
}

function openSettings() {
  if (isViewer) return;
  els.titleInput.value = state.matchTitle;
  els.homeNameSetting.value = state.homeName;
  els.awayNameSetting.value = state.awayName;
  els.matchFormatSetting.value = state.matchFormat;
  els.matchPill.textContent = matchLabel();
  els.settingsDialog.showModal();
}

function openShare() {
  els.viewerLink.value = liveGameId ? buildViewerLink() : "";
  els.firebaseNote.textContent = hasFirebaseConfig()
    ? (liveGameId ? "This is your read-only viewer link." : "Create a live game to get a viewer link.")
    : "Live sharing needs Firebase connected first. Fill in firebase-config.js.";
  els.shareDialog.showModal();
}

async function copyViewerLink() {
  if (!els.viewerLink.value) {
    toast("Create a live game first", true);
    return;
  }
  await navigator.clipboard.writeText(els.viewerLink.value);
  toast("Viewer link copied");
}

async function shareViewerLink() {
  if (!els.viewerLink.value) {
    toast("Create a live game first", true);
    return;
  }

  const shareData = {
    title: "ScoreFlow Live Score",
    text: "Follow the live score here:",
    url: els.viewerLink.value
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      toast("Share screen opened");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
    }
  }

  await navigator.clipboard.writeText(els.viewerLink.value);
  toast("Sharing not supported here — link copied");
}

function handleLogo(input, img, picker) {
  if (isViewer) return;
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

function setTeamColor(team, value, shouldSync = true) {
  if (isViewer && shouldSync) return;
  state[`${team}Color`] = value;
  document.documentElement.style.setProperty(team === "home" ? "--home" : "--away", value);
  document.querySelectorAll(`#${team}Swatches .swatch`).forEach((swatch) => {
    swatch.classList.toggle("selected", swatch.dataset.value.toLowerCase() === value.toLowerCase());
  });
  if (shouldSync) queueRemoteUpdate();
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

function triggerSetWinBadge(team) {
  const badge = team === "home" ? els.homeSetWinBadge : els.awaySetWinBadge;
  if (!badge) return;
  badge.classList.remove("show");
  void badge.offsetWidth;
  badge.classList.add("show");
  clearTimeout(badge.hideTimer);
  badge.hideTimer = setTimeout(() => badge.classList.remove("show"), 3000);
}

function showWinner(team, sync = false) {
  els.winnerText.textContent = `${teamName(team)} Wins!`;
  document.body.classList.add("celebrating");
  els.winnerOverlay.classList.add("show");
  startConfetti();
  if (sync) queueRemoteUpdate();
}

function hideWinner() {
  els.winnerOverlay.classList.remove("show");
  document.body.classList.remove("celebrating");
}

function closeWinner() {
  hideWinner();
  stopConfetti();
}

function updateNameFromInline(team) {
  if (isViewer) return;
  state[`${team}Name`] = (team === "home" ? els.homeName.value : els.awayName.value).trim() || (team === "home" ? "Team 1" : "Team 2");
  state.lastAlert = "";
  render();
  queueRemoteUpdate();
}

function wireEvents() {
  $("homePlus").addEventListener("click", () => point("home"));
  $("awayPlus").addEventListener("click", () => point("away"));
  $("homeScoreBtn").addEventListener("click", () => point("home"));
  $("awayScoreBtn").addEventListener("click", () => point("away"));
  $("homeMinus").addEventListener("click", () => subtract("home"));
  $("awayMinus").addEventListener("click", () => subtract("away"));
  $("undoBtn").addEventListener("click", undo);
  $("newSetBtn").addEventListener("click", newSet);
  $("newMatchBtn").addEventListener("click", newMatch);
  $("shareBtn").addEventListener("click", openShare);
  $("settingsBtn").addEventListener("click", openSettings);
  $("fullscreenBtn").addEventListener("click", toggleFullscreen);
  $("saveSettingsBtn").addEventListener("click", saveSettings);
  $("createLiveBtn").addEventListener("click", createLiveGame);
  $("copyLinkBtn").addEventListener("click", copyViewerLink);
  els.nativeShareBtn?.addEventListener("click", shareViewerLink);
  els.homeLogoInput.addEventListener("change", () => handleLogo(els.homeLogoInput, els.homeLogo, els.homeLogoInput.closest(".logo-picker")));
  els.awayLogoInput.addEventListener("change", () => handleLogo(els.awayLogoInput, els.awayLogo, els.awayLogoInput.closest(".logo-picker")));
  els.homeName.addEventListener("change", () => updateNameFromInline("home"));
  els.awayName.addEventListener("change", () => updateNameFromInline("away"));
  els.winnerOverlay.addEventListener("click", closeWinner);
  els.winnerOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") closeWinner();
  });
  window.addEventListener("resize", () => {
    if (state.confettiRunning) startConfetti();
  });
}

function applyViewerMode() {
  if (!isViewer) return;
  document.body.classList.add("viewer-mode");
  document.querySelectorAll("button, input").forEach((el) => {
    if (el.id === "fullscreenBtn") return;
    el.disabled = true;
  });
  els.settingsDialog?.close?.();
  els.shareDialog?.close?.();
}

async function boot() {
  buildSwatches(els.homeSwatches, "home");
  buildSwatches(els.awaySwatches, "away");
  wireEvents();
  setTeamColor("home", state.homeColor, false);
  setTeamColor("away", state.awayColor, false);
  applyMatchFormat(state.matchFormat);
  render();

  if (initFirebase()) {
    els.liveStatus.textContent = liveGameId ? "Connecting Live Game..." : "Offline Practice Mode";
    if (liveGameId) await startLiveListener();
  } else {
    els.liveStatus.textContent = "Offline Practice Mode";
  }
  applyViewerMode();
}

boot();

// ─── Real-time Mouse Dynamics & Affect Engine ────────────────────────────────
let mockArousal = -0.5;
let mockValence = 0.6;
let currentSpeed = 0;
let lastMouseX = null, lastMouseY = null, lastMouseTime = null;
let lastDx = 0, lastDy = 0;
let jerkScore = 0;
const recentSpeeds = [];
let audioUnlocked = false;

// Track library across the 4 emotion quadrants
const MOOD_TRACKS = {
  excited_happy: {
    title: "One More Time",
    artist: "Daft Punk",
    videoId: "FGBhQbmPwH8",
    description: "High Energy • Positive Affect"
  },
  stressed_anxious: {
    title: "Smells Like Teen Spirit",
    artist: "Nirvana",
    videoId: "hTWKbfoikeg",
    description: "High Energy • Urgent/Tense Affect"
  },
  calm_relaxed: {
    title: "Banana Pancakes",
    artist: "Jack Johnson",
    videoId: "OzqKKyMPxQo",
    description: "Low Energy • Warm/Positive Affect"
  },
  mellow_melancholy: {
    title: "Yesterday",
    artist: "The Beatles",
    videoId: "wM0IdWY0aYU",
    description: "Low Energy • Reflective Affect"
  }
};

// ─── Real-time Browser Cursor Kinematics ──────────────────────────────────────
window.addEventListener("mousemove", (e) => {
  const now = Date.now();
  if (lastMouseX !== null && lastMouseTime !== null) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dt = (now - lastMouseTime) / 1000;
    
    if (dt > 0.005) {
      const instSpeed = Math.hypot(dx, dy) / dt;
      currentSpeed = instSpeed;
      recentSpeeds.push({ t: now, speed: instSpeed });

      // Compute directional jerk (erratic movement vs smooth movement)
      const angleChange = Math.abs(Math.atan2(dy, dx) - Math.atan2(lastDy, lastDx));
      if (angleChange > 1.2 && instSpeed > 300) {
        jerkScore = Math.min(1.0, jerkScore + 0.15);
      } else {
        jerkScore = Math.max(0, jerkScore - 0.02);
      }

      lastDx = dx;
      lastDy = dy;
    }
  }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  lastMouseTime = now;
});

// Click dynamics boost arousal momentarily
window.addEventListener("click", () => {
  mockArousal = Math.min(1.0, mockArousal + 0.12);
  unlockAudio();
});

// ─── Affect Inference Loop (50 Hz / 20ms) ────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  // Keep rolling window of last 2.5 seconds
  while (recentSpeeds.length && now - recentSpeeds[0].t > 2500) {
    recentSpeeds.shift();
  }

  if (recentSpeeds.length > 0) {
    const avgSpeed = recentSpeeds.reduce((acc, x) => acc + x.speed, 0) / recentSpeeds.length;
    
    // Target Arousal: 0 px/s -> -0.9 (Very Calm), 1000+ px/s -> +0.95 (High Energy)
    const targetArousal = Math.min(1, Math.max(-1, (avgSpeed / 450) - 1));
    mockArousal = mockArousal * 0.88 + targetArousal * 0.12;

    // Target Valence: Smooth movement -> positive (+0.7), erratic/jerky -> negative (-0.6)
    const targetValence = jerkScore > 0.45 ? -0.55 : (mockArousal > 0.6 ? 0.35 : 0.65);
    mockValence = mockValence * 0.90 + targetValence * 0.10;
  } else {
    // Idle decay toward restful calm state
    mockArousal = mockArousal * 0.97 + (-0.75) * 0.03;
    mockValence = mockValence * 0.98 + (0.5) * 0.02;
    currentSpeed = currentSpeed * 0.8;
  }

  // Update speed UI bar & live stats
  const speedElem = document.getElementById("speed-indicator");
  const meterElem = document.getElementById("speed-meter-fill");
  if (speedElem && meterElem) {
    const displaySpeed = Math.round(currentSpeed);
    speedElem.innerText = `${displaySpeed} px/s`;
    const fillPercent = Math.min(100, Math.round((displaySpeed / 900) * 100));
    meterElem.style.width = `${fillPercent}%`;
  }
}, 50);

// ─── Determine Mood Category ──────────────────────────────────────────────────
function getMoodCategory(arousal, valence) {
  if (arousal >= 0.0) {
    return valence >= 0.0 ? "excited_happy" : "stressed_anxious";
  } else {
    return valence >= 0.0 ? "calm_relaxed" : "mellow_melancholy";
  }
}

// ─── Tauri IPC / Browser Fallback Bridge ──────────────────────────────────────
let currentProvider = "youtube";
let activeVideoId = null;
let currentTrackKey = null;

const { invoke } = window.__TAURI__?.core || {
  invoke: async (cmd) => {
    if (cmd === "get_current_state") {
      const moodKey = getMoodCategory(mockArousal, mockValence);
      const track = MOOD_TRACKS[moodKey];
      return {
        valence: mockValence,
        arousal: mockArousal,
        track_title: track.title,
        track_artist: track.artist,
        track_provider_id: track.videoId,
        provider: currentProvider,
        mood_key: moodKey
      };
    }
    return {};
  }
};

// ─── YouTube Embedded Player Controller ───────────────────────────────────────
function playYouTubeAudio(videoId, autoStart = true) {
  if (!videoId) return;
  const container = document.getElementById("yt-player-container");
  if (!container) return;

  const autoplayParam = autoStart && audioUnlocked ? 1 : 0;
  container.innerHTML = `
    <iframe width="100%" height="160"
      src="https://www.youtube.com/embed/${videoId}?autoplay=${autoplayParam}&mute=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
      title="MoodTrace Audio"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      style="border: none; border-radius: 10px; width: 100%;">
    </iframe>
  `;
  activeVideoId = videoId;
}

// ─── State Polling & Dynamic Music Dispatcher ─────────────────────────────────
let lastTitle = "";
let stableMoodCount = 0;
let candidateMood = null;

async function pollState() {
  try {
    const s = await invoke("get_current_state");
    const { valence, arousal, track_title, track_artist, track_provider_id, provider } = s;

    // ── 1. Update Coordinates Readout ──
    const coordElem = document.getElementById("mood-coordinates");
    if (coordElem) {
      coordElem.innerText = `Valence: ${(+valence).toFixed(2)}   Arousal: ${(+arousal).toFixed(2)}`;
    }

    // ── 2. Determine Mood Label ──
    let label = "Neutral";
    if (arousal > 0.25 && valence > 0.1) label = "Excited & Energized";
    else if (arousal > 0.25 && valence <= 0.1) label = "Stressed & Intense";
    else if (arousal <= 0.25 && valence > 0.1) label = "Calm & Relaxed";
    else label = "Mellow & Reflective";
    
    const labelElem = document.getElementById("mood-label");
    if (labelElem) labelElem.innerText = label;

    // ── 3. Smooth 2D Russell Plane Dot ──
    const dot = document.getElementById("inferred-dot");
    if (dot) {
      // 0..250px plane bounds
      const leftPx = Math.min(240, Math.max(8, ((+valence + 1) / 2) * 248));
      const topPx  = Math.min(240, Math.max(8, ((1 - +arousal) / 2) * 248));
      dot.style.left = `${leftPx}px`;
      dot.style.top  = `${topPx}px`;
    }

    // ── 4. Dynamic Track Selection & Auto-Play ──
    if (track_title && track_title !== lastTitle) {
      lastTitle = track_title;
      const titleElem = document.getElementById("track-title");
      const artistElem = document.getElementById("track-artist");
      const artGlow = document.getElementById("track-art-glow");

      if (titleElem) titleElem.innerText = track_title;
      if (artistElem) artistElem.innerText = track_artist || "—";

      if (artGlow) artGlow.classList.add("playing");

      if (provider === "youtube" && track_provider_id) {
        playYouTubeAudio(track_provider_id, true);
      }
    }

    // ── 5. Provider Sync ──
    if (provider && provider !== currentProvider) syncProviderUI(provider);

    // ── 6. Velocity Samples Counter ──
    const countElem = document.getElementById("events-count");
    if (countElem) countElem.innerText = recentSpeeds.length;

  } catch (err) {
    console.error("pollState error:", err);
  }
}

// ─── Provider UI Sync ─────────────────────────────────────────────────────────
function syncProviderUI(provider) {
  currentProvider = provider;
  const btnYt = document.getElementById("btn-yt");
  const btnSpot = document.getElementById("btn-spot");
  if (btnYt) btnYt.classList.toggle("active", provider === "youtube");
  if (btnSpot) btnSpot.classList.toggle("active", provider === "spotify");
}

// ─── Audio Permission Unlocker ───────────────────────────────────────────────
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const banner = document.getElementById("audio-activation-banner");
  if (banner) {
    banner.style.background = "rgba(0, 255, 170, 0.15)";
    banner.style.borderColor = "rgba(0, 255, 170, 0.4)";
    const text = document.getElementById("audio-banner-text");
    if (text) text.innerText = "✨ Live Tracking & Audio Active — Move mouse fast/slow to change music!";
    const btn = document.getElementById("btn-enable-audio");
    if (btn) btn.style.display = "none";
  }

  const hint = document.getElementById("player-status-hint");
  if (hint) hint.innerText = "🔊 Audio Active • Auto-matching to mouse speed";

  if (activeVideoId) {
    playYouTubeAudio(activeVideoId, true);
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  // Audio activation listeners
  const banner = document.getElementById("audio-activation-banner");
  if (banner) banner.addEventListener("click", unlockAudio);
  
  const enableBtn = document.getElementById("btn-enable-audio");
  if (enableBtn) enableBtn.addEventListener("click", unlockAudio);

  // Affect Grid popup button
  const gridBtn = document.getElementById("btn-open-grid");
  if (gridBtn) {
    gridBtn.addEventListener("click", async () => {
      try {
        await invoke("trigger_affect_grid");
      } catch {
        window.open("popup.html", "_blank", "width=420,height=450");
      }
    });
  }

  // Provider toggle switches
  async function switchProvider(name) {
    try { await invoke("set_provider", { provider: name }); } catch {}
    syncProviderUI(name);
  }
  const btnYt = document.getElementById("btn-yt");
  const btnSpot = document.getElementById("btn-spot");
  if (btnYt) btnYt.addEventListener("click", () => switchProvider("youtube"));
  if (btnSpot) btnSpot.addEventListener("click", () => switchProvider("spotify"));

  // Click spinning disc to trigger audio
  const artGlow = document.getElementById("track-art-glow");
  if (artGlow) {
    artGlow.addEventListener("click", () => {
      unlockAudio();
      if (activeVideoId) playYouTubeAudio(activeVideoId, true);
    });
  }

  // Any initial click on body unlocks audio
  document.body.addEventListener("click", unlockAudio, { once: false });

  // Initial poll and recurring timer
  pollState();
  setInterval(pollState, 400);
});

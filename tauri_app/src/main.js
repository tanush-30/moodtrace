// ─── Real-time Mouse Dynamics & Affect Engine ────────────────────────────────
let mockArousal = -0.5;
let mockValence = 0.6;
let currentSpeed = 0;
let lastMouseX = null, lastMouseY = null, lastMouseTime = null;
let lastDx = 0, lastDy = 0;
let jerkScore = 0;
const recentSpeeds = [];
let audioUnlocked = false;
let manualCalibrationUntil = 0; // Timestamp to hold manual override

// Track library across the 4 emotion quadrants (YouTube + Spotify IDs)
const MOOD_TRACKS = {
  excited_happy: {
    title: "One More Time",
    artist: "Daft Punk",
    videoId: "FGBhQbmPwH8",
    spotifyId: "0DiWol3AO6WpXZgp0EGl82",
    description: "High Energy • Positive Affect"
  },
  stressed_anxious: {
    title: "Smells Like Teen Spirit",
    artist: "Nirvana",
    videoId: "hTWKbfoikeg",
    spotifyId: "5N5k9ndv5i4QecR6zgM2gO",
    description: "High Energy • Urgent/Tense Affect"
  },
  calm_relaxed: {
    title: "Banana Pancakes",
    artist: "Jack Johnson",
    videoId: "OzqKKyMPxQo",
    spotifyId: "451GXMSSMw0YsMu9h52j1J",
    description: "Low Energy • Warm/Positive Affect"
  },
  mellow_melancholy: {
    title: "Yesterday",
    artist: "The Beatles",
    videoId: "wM0IdWY0aYU",
    spotifyId: "3BQHpFgAp4l80e1XslIj6q",
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
  if (Date.now() > manualCalibrationUntil) {
    mockArousal = Math.min(1.0, mockArousal + 0.10);
  }
  unlockAudio();
});

// ─── Affect Inference Loop (50 Hz / 20ms) ────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  
  // Prune history
  while (recentSpeeds.length && now - recentSpeeds[0].t > 2500) {
    recentSpeeds.shift();
  }

  // If under manual calibration lock, don't overwrite with mouse decay immediately
  if (now > manualCalibrationUntil) {
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
let activeSpotifyId = null;
let lastTitle = "";

const { invoke } = window.__TAURI__?.core || {
  invoke: async (cmd, args) => {
    if (cmd === "get_current_state") {
      const moodKey = getMoodCategory(mockArousal, mockValence);
      const track = MOOD_TRACKS[moodKey];
      return {
        valence: mockValence,
        arousal: mockArousal,
        track_title: track.title,
        track_artist: track.artist,
        track_provider_id: currentProvider === "spotify" ? track.spotifyId : track.videoId,
        youtube_id: track.videoId,
        spotify_id: track.spotifyId,
        provider: currentProvider,
        mood_key: moodKey
      };
    }
    if (cmd === "submit_label" && args) {
      mockValence = args.valence;
      mockArousal = args.arousal;
      manualCalibrationUntil = Date.now() + 8000; // Hold for 8 seconds
      return { ok: true };
    }
    if (cmd === "set_provider" && args) {
      currentProvider = args.provider;
      return { ok: true };
    }
    return {};
  }
};

// ─── Embedded Music Players (YouTube & Spotify) ───────────────────────────────
function renderPlayer(trackInfo) {
  const ytContainer = document.getElementById("yt-player-container");
  const spotContainer = document.getElementById("spotify-player-container");
  if (!ytContainer || !spotContainer) return;

  const moodKey = getMoodCategory(mockArousal, mockValence);
  const track = MOOD_TRACKS[moodKey] || trackInfo;
  
  if (currentProvider === "youtube") {
    ytContainer.style.display = "block";
    spotContainer.style.display = "none";
    
    if (track.videoId && track.videoId !== activeVideoId) {
      const autoplayParam = audioUnlocked ? 1 : 0;
      ytContainer.innerHTML = `
        <iframe width="100%" height="160"
          src="https://www.youtube.com/embed/${track.videoId}?autoplay=${autoplayParam}&mute=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
          title="MoodTrace YouTube Audio"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style="border: none; border-radius: 10px; width: 100%;">
        </iframe>
      `;
      activeVideoId = track.videoId;
    }
  } else {
    // Spotify Provider
    ytContainer.style.display = "none";
    spotContainer.style.display = "block";
    
    if (track.spotifyId && track.spotifyId !== activeSpotifyId) {
      spotContainer.innerHTML = `
        <iframe style="border-radius:12px; width:100%; border:none;"
          src="https://open.spotify.com/embed/track/${track.spotifyId}?utm_source=generator&theme=0"
          width="100%" height="152"
          allowfullscreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy">
        </iframe>
      `;
      activeSpotifyId = track.spotifyId;
    }
  }
}

// ─── State Polling & Dynamic UI Dispatcher ─────────────────────────────────────
async function pollState() {
  try {
    const s = await invoke("get_current_state");
    const { valence, arousal, track_title, track_artist, provider } = s;

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
      const leftPx = Math.min(240, Math.max(8, ((+valence + 1) / 2) * 248));
      const topPx  = Math.min(240, Math.max(8, ((1 - +arousal) / 2) * 248));
      dot.style.left = `${leftPx}px`;
      dot.style.top  = `${topPx}px`;
    }

    // ── 4. Dynamic Track Selection & Auto-Play ──
    const moodKey = getMoodCategory(arousal, valence);
    const track = MOOD_TRACKS[moodKey];
    
    if (track.title !== lastTitle) {
      lastTitle = track.title;
      const titleElem = document.getElementById("track-title");
      const artistElem = document.getElementById("track-artist");
      const artGlow = document.getElementById("track-art-glow");

      if (titleElem) titleElem.innerText = track.title;
      if (artistElem) artistElem.innerText = track.artist || "—";
      if (artGlow) artGlow.classList.add("playing");

      renderPlayer(track);
    }

    // ── 5. Provider Sync ──
    if (provider && provider !== currentProvider) {
      syncProviderUI(provider);
      renderPlayer(track);
    }

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

  const moodKey = getMoodCategory(mockArousal, mockValence);
  renderPlayer(MOOD_TRACKS[moodKey]);
}

// ─── Modal Affect Grid Manager ────────────────────────────────────────────────
function setupAffectGridModal() {
  const modal = document.getElementById("affect-grid-modal");
  const openBtn = document.getElementById("btn-open-grid");
  const closeBtn = document.getElementById("btn-close-modal");
  const grid = document.getElementById("modal-affect-grid");
  const marker = document.getElementById("modal-grid-marker");
  const readout = document.getElementById("modal-coords-readout");

  if (!modal || !openBtn || !grid) return;

  function openModal() {
    modal.style.display = "flex";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") closeModal();
  });

  // Grid Hover Tracking
  grid.addEventListener("mouseenter", () => {
    if (marker) marker.style.display = "block";
  });
  grid.addEventListener("mouseleave", () => {
    if (marker) marker.style.display = "none";
    if (readout) readout.innerText = "Hover over the grid to choose coordinates";
  });
  
  grid.addEventListener("mousemove", (e) => {
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (marker) {
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
    }

    const hoverV = ((x / rect.width) * 2 - 1).toFixed(2);
    const hoverA = (1 - (y / rect.height) * 2).toFixed(2);
    
    let hoverLabel = "Neutral";
    if (hoverA > 0.2 && hoverV > 0.1) hoverLabel = "Excited & Happy";
    else if (hoverA > 0.2 && hoverV <= 0.1) hoverLabel = "Stressed & Intense";
    else if (hoverA <= 0.2 && hoverV > 0.1) hoverLabel = "Calm & Relaxed";
    else hoverLabel = "Mellow & Reflective";

    if (readout) {
      readout.innerText = `[${hoverLabel}]  Valence: ${hoverV}, Arousal: ${hoverA}`;
    }
  });

  // Grid Click Calibration
  grid.addEventListener("click", async (e) => {
    const rect = grid.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedValence = parseFloat(((clickX / rect.width) * 2.0 - 1.0).toFixed(4));
    const clickedArousal = parseFloat((1.0 - (clickY / rect.height) * 2.0).toFixed(4));

    mockValence = clickedValence;
    mockArousal = clickedArousal;
    manualCalibrationUntil = Date.now() + 10000; // Hold user calibration for 10s

    try {
      await invoke("submit_label", { valence: clickedValence, arousal: clickedArousal });
    } catch {}

    closeModal();
    unlockAudio();
    pollState();

    let moodName = "Neutral";
    if (clickedArousal > 0.2 && clickedValence > 0.1) moodName = "Excited & Happy";
    else if (clickedArousal > 0.2 && clickedValence <= 0.1) moodName = "Stressed & Intense";
    else if (clickedArousal <= 0.2 && clickedValence > 0.1) moodName = "Calm & Relaxed";
    else moodName = "Mellow & Reflective";

    showToast(`✨ Calibrated to [${moodName}] — Valence: ${clickedValence.toFixed(2)}, Arousal: ${clickedArousal.toFixed(2)}`);
  });
}

// ─── Floating Toast Notification ─────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.innerText = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(154, 77, 255, 0.95);
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 10px 22px;
    border-radius: 30px;
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.6), 0 0 15px rgba(154, 77, 255, 0.5);
    z-index: 99999;
    opacity: 1;
    transition: opacity 0.35s ease, transform 0.35s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

// ─── Initialization ──────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  // Audio activation listeners
  const banner = document.getElementById("audio-activation-banner");
  if (banner) banner.addEventListener("click", unlockAudio);
  
  const enableBtn = document.getElementById("btn-enable-audio");
  if (enableBtn) enableBtn.addEventListener("click", unlockAudio);

  // Affect Grid Modal setup
  setupAffectGridModal();

  // Provider toggle switches
  async function switchProvider(name) {
    try { await invoke("set_provider", { provider: name }); } catch {}
    syncProviderUI(name);
    activeVideoId = null;
    activeSpotifyId = null;
    const moodKey = getMoodCategory(mockArousal, mockValence);
    renderPlayer(MOOD_TRACKS[moodKey]);
    showToast(`Switched music platform to ${name === "spotify" ? "Spotify" : "YouTube"}`);
  }

  const btnYt = document.getElementById("btn-yt");
  const btnSpot = document.getElementById("btn-spot");
  if (btnYt) btnYt.addEventListener("click", () => switchProvider("youtube"));
  if (btnSpot) btnSpot.addEventListener("click", () => switchProvider("spotify"));

  // Click spinning disc to trigger audio / unmute
  const artGlow = document.getElementById("track-art-glow");
  if (artGlow) {
    artGlow.addEventListener("click", () => {
      unlockAudio();
      const moodKey = getMoodCategory(mockArousal, mockValence);
      renderPlayer(MOOD_TRACKS[moodKey]);
    });
  }

  // Any initial click on body unlocks audio
  document.body.addEventListener("click", unlockAudio, { once: false });

  // Initial poll and recurring timer
  pollState();
  setInterval(pollState, 400);
});

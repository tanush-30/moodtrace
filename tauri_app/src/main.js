// ─── Browser-side mock mouse tracking ────────────────────────────────────────
let mockArousal = -0.6;
let mockValence  =  0.5;
let lastMouseX = null, lastMouseY = null, lastMouseTime = null;
const recentSpeeds = [];

window.addEventListener("mousemove", (e) => {
  const now = Date.now();
  if (lastMouseX !== null) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dt = (now - lastMouseTime) / 1000;
    if (dt > 0) recentSpeeds.push({ t: now, speed: Math.hypot(dx, dy) / dt });
  }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  lastMouseTime = now;
});

// Update mock coordinates every 200 ms based on recent mouse speed
setInterval(() => {
  const now = Date.now();
  // Prune events older than 3 s
  while (recentSpeeds.length && now - recentSpeeds[0].t > 3000) recentSpeeds.shift();

  if (recentSpeeds.length) {
    const avg = recentSpeeds.reduce((s, x) => s + x.speed, 0) / recentSpeeds.length;
    // 0 px/s → -1.0 (calm), 1200 px/s → +1.0 (energised)
    const target = Math.min(1, Math.max(-1, avg / 600 - 1));
    mockArousal = mockArousal * 0.85 + target * 0.15;
  } else {
    // Idle: slowly drift toward calm
    mockArousal = mockArousal * 0.97 + (-0.8) * 0.03;
  }
  // Valence loosely follows arousal with a positive bias when calm
  const targetValence = mockArousal > 0.3 ? -0.2 : 0.65;
  mockValence = mockValence * 0.93 + targetValence * 0.07;
}, 200);

// ─── Tauri IPC / browser fallback ────────────────────────────────────────────
let currentProvider = "youtube";
let activeVideoId   = null;

const { invoke } = window.__TAURI__?.core || {
  invoke: async (cmd) => {
    if (cmd === "get_current_state") {
      // Map mock arousal to matching song + video ID
      let title, artist, videoId;
      if (mockArousal > 0.35) {
        title = "Smells Like Teen Spirit"; artist = "Nirvana"; videoId = "hTWKbfoikeg";
      } else if (mockArousal > -0.25) {
        title = "Banana Pancakes"; artist = "Jack Johnson"; videoId = "OzqKKyMPxQo";
      } else {
        title = "Yesterday"; artist = "The Beatles"; videoId = "wM0IdWY0aYU";
      }
      return { valence: mockValence, arousal: mockArousal,
               track_title: title, track_artist: artist,
               track_provider_id: videoId, provider: currentProvider };
    }
    return {};
  }
};

// ─── YouTube player ───────────────────────────────────────────────────────────
function playYouTubeAudio(videoId) {
  if (!videoId) return;
  const container = document.getElementById("yt-player-container");
  container.innerHTML =
    `<iframe width="280" height="158"
       src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&enablejsapi=1"
       allow="autoplay; encrypted-media"
       allowfullscreen
       style="border:none;border-radius:10px;"></iframe>`;
  activeVideoId = videoId;
}

// ─── State polling ────────────────────────────────────────────────────────────
let lastTitle = "";

async function pollState() {
  try {
    const s = await invoke("get_current_state");
    const { valence, arousal, track_title, track_artist, track_provider_id, provider } = s;

    // ── Coordinates ──
    document.getElementById("mood-coordinates").innerText =
      `Valence: ${(+valence).toFixed(2)}  Arousal: ${(+arousal).toFixed(2)}`;

    // ── Mood label ──
    let label = "Neutral";
    if      (arousal >  0.4 && valence >  0.3) label = "Excited & Happy";
    else if (arousal >  0.4 && valence < -0.3) label = "Stressed & Anxious";
    else if (arousal < -0.4 && valence >  0.3) label = "Calm & Relaxed";
    else if (arousal < -0.4 && valence < -0.3) label = "Bored & Depressed";
    else if (arousal >  0.4)                   label = "Energized";
    else if (arousal < -0.4)                   label = "Mellow";
    else if (valence >  0.3)                   label = "Content";
    else if (valence < -0.3)                   label = "Uncomfortable";
    document.getElementById("mood-label").innerText = label;

    // ── 2D plane dot ──
    const dot = document.getElementById("inferred-dot");
    dot.style.left = `${Math.min(250, Math.max(0, (valence + 1) * 125))}px`;
    dot.style.top  = `${Math.min(250, Math.max(0, (1 - arousal) * 125))}px`;

    // ── Track metadata & player ──
    if (track_title && track_title !== lastTitle) {
      lastTitle = track_title;
      document.getElementById("track-title").innerText  = track_title;
      document.getElementById("track-artist").innerText = track_artist || "—";

      const artGlow = document.getElementById("track-art-glow");
      if (track_title !== "No Track Active") {
        artGlow.classList.add("playing");
        if (provider === "youtube" && track_provider_id) {
          playYouTubeAudio(track_provider_id);
        }
      } else {
        artGlow.classList.remove("playing");
      }
    }

    // ── Provider sync ──
    if (provider && provider !== currentProvider) syncProviderUI(provider);

    // ── Events counter (mock) ──
    document.getElementById("events-count").innerText = recentSpeeds.length;

  } catch (err) {
    console.error("pollState error:", err);
  }
}

// ─── Provider UI sync ─────────────────────────────────────────────────────────
function syncProviderUI(provider) {
  currentProvider = provider;
  document.getElementById("btn-yt").classList.toggle("active", provider === "youtube");
  document.getElementById("btn-spot").classList.toggle("active", provider === "spotify");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {

  // Summon Affect Grid
  document.getElementById("btn-open-grid").addEventListener("click", async () => {
    try { await invoke("trigger_affect_grid"); }
    catch { /* browser: open popup in new tab for demo */ window.open("popup.html", "_blank", "width=420,height=450"); }
  });

  // Provider toggle
  async function switchProvider(name) {
    try { await invoke("set_provider", { provider: name }); }
    catch { /* ignore in browser mode */ }
    syncProviderUI(name);
  }
  document.getElementById("btn-yt").addEventListener("click",   () => switchProvider("youtube"));
  document.getElementById("btn-spot").addEventListener("click", () => switchProvider("spotify"));

  // Click disc → force-play / unmute current track
  document.getElementById("track-art-glow").addEventListener("click", () => {
    if (activeVideoId) playYouTubeAudio(activeVideoId);
  });

  // Poll every second
  pollState();
  setInterval(pollState, 1000);
});

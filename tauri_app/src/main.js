// ─── MoodTrace — Real Audio Player via iTunes Preview API ────────────────────
// Uses iTunes Search API (free, no auth, no CORS) to fetch and play
// genuine 30-second MP3 previews of the displayed Telugu & Hindi songs.

// ─── Affect State ─────────────────────────────────────────────────────────────
let mockArousal = 0.5;
let mockValence = 0.5;
let currentSpeed = 0;
let lastMouseX = null, lastMouseY = null, lastMouseTime = null;
let lastDx = 0, lastDy = 0;
let jerkScore = 0;
const recentSpeeds = [];
let manualCalibrationUntil = 0;

// ─── Audio Player State ───────────────────────────────────────────────────────
let audioEl = null;           // Single shared <audio> element
let isPlaying = false;
let masterVolume = 0.85;
let previewCache = {};        // { "Song Title|Artist": previewUrl }
let currentTrackKey = "";     // currently playing track key
let isFetching = false;

// ─── Mood Song Library ────────────────────────────────────────────────────────
// iTunes search terms that reliably return preview URLs
const DEFAULT_MOOD_LIBRARY = {
  excited_happy: {
    activeIndex: 0,
    songs: [
      { id: "te_eh1", title: "Naatu Naatu", artist: "Rahul Sipligunj",      itunesQuery: "Naatu Naatu RRR" },
      { id: "hi_eh1", title: "Tauba Tauba",  artist: "Karan Aujla",          itunesQuery: "Tauba Tauba Bad Newz" },
      { id: "te_eh2", title: "Kurchi Madathapetti", artist: "Thaman S",      itunesQuery: "Kurchi Madathapetti" },
      { id: "hi_eh2", title: "Chaleya",      artist: "Arijit Singh",         itunesQuery: "Chaleya Jawan Arijit Singh" },
      { id: "te_eh3", title: "Ramuloo Ramulaa", artist: "Anurag Kulkarni",   itunesQuery: "Ramuloo Ramulaa" }
    ]
  },
  stressed_anxious: {
    activeIndex: 0,
    songs: [
      { id: "hi_sa1", title: "Arjan Vailly", artist: "Bhupinder Babbal",     itunesQuery: "Arjan Vailly Animal" },
      { id: "te_sa1", title: "Hukum",        artist: "Anirudh Ravichander",  itunesQuery: "Hukum Anirudh Jailer" },
      { id: "te_sa2", title: "Fear Song",    artist: "Anirudh Ravichander",  itunesQuery: "Fear Song Devara Anirudh" },
      { id: "te_sa3", title: "Badass",       artist: "Anirudh Ravichander",  itunesQuery: "Badass Leo Anirudh" },
      { id: "hi_sa2", title: "Zinda Banda",  artist: "Anirudh Ravichander",  itunesQuery: "Zinda Banda Jawan" }
    ]
  },
  calm_relaxed: {
    activeIndex: 0,
    songs: [
      { id: "te_cr1", title: "Samajavaragamana", artist: "Sid Sriram",       itunesQuery: "Samajavaragamana Sid Sriram" },
      { id: "hi_cr1", title: "Kesariya",     artist: "Arijit Singh",         itunesQuery: "Kesariya Brahmastra Arijit Singh" },
      { id: "te_cr2", title: "Chuttamalle",  artist: "Shilpa Rao",           itunesQuery: "Chuttamalle Devara" },
      { id: "hi_cr2", title: "Heeriye",      artist: "Jasleen Royal",        itunesQuery: "Heeriye Arijit Singh Jasleen Royal" },
      { id: "te_cr3", title: "Inkem Inkem",  artist: "Sid Sriram",           itunesQuery: "Inkem Inkem Sid Sriram" }
    ]
  },
  mellow_melancholy: {
    activeIndex: 0,
    songs: [
      { id: "hi_mm1", title: "O Maahi",      artist: "Arijit Singh",         itunesQuery: "O Maahi Dunki Arijit Singh" },
      { id: "te_mm1", title: "Adiga Adiga",  artist: "Sid Sriram",           itunesQuery: "Adiga Adiga Ninnu Kori" },
      { id: "hi_mm2", title: "Satranga",     artist: "Arijit Singh",         itunesQuery: "Satranga Animal Arijit Singh" },
      { id: "te_mm2", title: "Urike Urike",  artist: "Sid Sriram",           itunesQuery: "Urike Urike HIT 2" },
      { id: "hi_mm3", title: "Agar Tum Saath Ho", artist: "Arijit Singh",    itunesQuery: "Agar Tum Saath Ho Arijit Singh" }
    ]
  }
};

function loadLibrary() {
  try {
    const saved = localStorage.getItem("moodtrace_library_v13");
    if (saved) return { ...DEFAULT_MOOD_LIBRARY, ...JSON.parse(saved) };
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_MOOD_LIBRARY));
}
function saveLibrary() {
  try { localStorage.setItem("moodtrace_library_v13", JSON.stringify(moodLibrary)); } catch (e) {}
}
let moodLibrary = loadLibrary();

function getMoodCategory(arousal, valence) {
  if (arousal >= 0.0) return valence >= 0.0 ? "excited_happy" : "stressed_anxious";
  return valence >= 0.0 ? "calm_relaxed" : "mellow_melancholy";
}

function getActiveSong(moodKey) {
  const group = moodLibrary[moodKey] || moodLibrary["excited_happy"];
  const idx = Math.max(0, Math.min(group.activeIndex, group.songs.length - 1));
  return group.songs[idx];
}

// ─── iTunes Preview Fetcher ───────────────────────────────────────────────────
// The iTunes Search API is free, CORS-enabled, no key needed.
// Returns 30-second MP3 preview URLs for millions of songs.
async function fetchPreviewUrl(song) {
  const cacheKey = song.id;
  if (previewCache[cacheKey]) return previewCache[cacheKey];

  const query = encodeURIComponent(song.itunesQuery || `${song.title} ${song.artist}`);
  const url = `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=3&country=in`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("iTunes API error");
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Pick result with a previewUrl (30-sec MP3)
      const track = data.results.find(r => r.previewUrl) || data.results[0];
      if (track && track.previewUrl) {
        previewCache[cacheKey] = track.previewUrl;
        return track.previewUrl;
      }
    }
  } catch (err) {
    console.warn("iTunes fetch failed for", song.title, err);
  }

  // Fallback: try alternate query without extra keywords
  try {
    const q2 = encodeURIComponent(song.title);
    const res2 = await fetch(`https://itunes.apple.com/search?term=${q2}&media=music&entity=song&limit=5&country=in`);
    const data2 = await res2.json();
    if (data2.results) {
      const track = data2.results.find(r => r.previewUrl);
      if (track) {
        previewCache[cacheKey] = track.previewUrl;
        return track.previewUrl;
      }
    }
  } catch {}

  return null;
}

// ─── Audio Element Setup ──────────────────────────────────────────────────────
function getAudioEl() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.crossOrigin = "anonymous";
    audioEl.volume = masterVolume;
    audioEl.preload = "auto";

    audioEl.addEventListener("playing", () => {
      updatePlayState(true);
      showToast(`▶ Now Playing: ${document.getElementById("deck-song-title")?.innerText || "Track"}`);
    });

    audioEl.addEventListener("pause", () => {
      if (!audioEl.ended) updatePlayState(false);
    });

    audioEl.addEventListener("ended", () => {
      // Auto-advance to next track when preview ends
      cycleTrack("next", false);
    });

    audioEl.addEventListener("error", (e) => {
      console.error("Audio error", e);
      setDeckStatus("⚠ Preview unavailable — trying next song...", "#ffaa44");
      setTimeout(() => cycleTrack("next", false), 1200);
    });

    audioEl.addEventListener("waiting", () => {
      setDeckStatus("⏳ Loading preview...", "#aab0c4");
    });

    audioEl.addEventListener("canplay", () => {
      setDeckStatus("● AUDIO READY", "#00ffaa");
    });
  }
  return audioEl;
}

function updatePlayState(playing) {
  isPlaying = playing;
  const playBtn = document.getElementById("btn-play-pause");
  const artGlow = document.getElementById("track-art-glow");
  const soundStatus = document.getElementById("sound-engine-status");
  const liveBadge = document.getElementById("deck-live-badge");

  if (playBtn) playBtn.innerText = playing ? "⏸" : "▶";
  if (artGlow) artGlow.classList.toggle("playing", playing);
  if (soundStatus) soundStatus.innerText = playing ? "🟢 Audio Playing" : "⏸ Paused";
  if (liveBadge) {
    liveBadge.innerText = playing ? "● PLAYING" : "⏸ PAUSED";
    liveBadge.style.color = playing ? "#00ffaa" : "#ff9944";
  }

  // Animate waveform bars only when playing
  const waveBars = document.querySelectorAll(".deck-wave-bar");
  waveBars.forEach(bar => {
    bar.style.animationPlayState = playing ? "running" : "paused";
  });
}

function setDeckStatus(msg, color = "#aab0c4") {
  const liveBadge = document.getElementById("deck-live-badge");
  if (liveBadge) {
    liveBadge.innerText = msg;
    liveBadge.style.color = color;
  }
}

// ─── Core Play Function ───────────────────────────────────────────────────────
async function playSong(song, moodKey) {
  if (isFetching) return;

  const trackKey = song.id;
  const audio = getAudioEl();

  // Update UI immediately
  renderPlayer(song, moodKey);
  setDeckStatus("⏳ Fetching preview...", "#aab0c4");

  isFetching = true;
  const previewUrl = await fetchPreviewUrl(song);
  isFetching = false;

  if (!previewUrl) {
    setDeckStatus("⚠ No preview — click Spotify/YT to listen", "#ffaa44");
    showToast(`⚠ No preview found for "${song.title}"`);
    return;
  }

  // Only update src if different track
  if (currentTrackKey !== trackKey) {
    currentTrackKey = trackKey;
    audio.pause();
    audio.src = previewUrl;
    audio.currentTime = 0;
  }

  audio.volume = masterVolume;

  try {
    await audio.play();
    isPlaying = true;
  } catch (err) {
    console.error("Playback error:", err);
    if (err.name === "NotAllowedError") {
      setDeckStatus("🔒 Click ▶ to start audio", "#ffaa44");
      showToast("🔒 Browser blocked autoplay — press ▶ to play");
    } else {
      setDeckStatus("⚠ Playback error — trying next...", "#ff4466");
      setTimeout(() => cycleTrack("next", false), 1200);
    }
  }
}

// ─── Player UI Renderer ────────────────────────────────────────────────────────
function renderPlayer(song, moodKey) {
  if (!moodKey) moodKey = getMoodCategory(mockArousal, mockValence);

  const titleElem    = document.getElementById("deck-song-title");
  const artistElem   = document.getElementById("deck-song-artist");
  const moodBadge    = document.getElementById("deck-mood-badge");
  const spotLink     = document.getElementById("deck-spotify-link");
  const ytLink       = document.getElementById("deck-yt-link");
  const trackTitle   = document.getElementById("track-title");
  const trackArtist  = document.getElementById("track-artist");

  const moodLabels = {
    excited_happy:    "⚡ Excited & Happy",
    stressed_anxious: "⚡ Stressed & Intense",
    calm_relaxed:     "🌿 Calm & Relaxed",
    mellow_melancholy:"🌿 Mellow & Reflective"
  };

  if (titleElem)  titleElem.innerText  = song.title;
  if (artistElem) artistElem.innerText = song.artist;
  if (trackTitle)  trackTitle.innerText  = song.title;
  if (trackArtist) trackArtist.innerText = song.artist;
  if (moodBadge)  moodBadge.innerHTML  = `Mood: <b style="color:#fff;">${moodLabels[moodKey] || moodKey}</b>`;

  const searchTerm = encodeURIComponent(`${song.title} ${song.artist}`);
  if (spotLink) spotLink.href = `https://open.spotify.com/search/${searchTerm}`;
  if (ytLink)   ytLink.href   = `https://www.youtube.com/results?search_query=${searchTerm}`;

  // Update platform label
  const platformLabel = document.getElementById("deck-platform-label");
  if (platformLabel) platformLabel.innerText = "iTunes Preview • 30-sec Real Audio";
}

// ─── Playback Controls ────────────────────────────────────────────────────────
async function startPlayback() {
  const moodKey = getMoodCategory(mockArousal, mockValence);
  const song = getActiveSong(moodKey);
  await playSong(song, moodKey);
}

function togglePlayPause() {
  const audio = getAudioEl();

  if (!isPlaying) {
    if (audio.src && audio.src !== window.location.href) {
      // Resume existing track
      audio.play().catch(() => startPlayback());
    } else {
      // Start fresh
      startPlayback();
    }
  } else {
    audio.pause();
  }
}

function stopTrack() {
  const audio = getAudioEl();
  audio.pause();
  audio.currentTime = 0;
  currentTrackKey = "";
  updatePlayState(false);
  setDeckStatus("⏹ Stopped", "#aab0c4");
  showToast("⏹ Music Stopped");
}

async function cycleTrack(direction, userInitiated = true) {
  const moodKey = getMoodCategory(mockArousal, mockValence);
  const group = moodLibrary[moodKey];
  if (!group || !group.songs.length) return;

  if (direction === "next") {
    group.activeIndex = (group.activeIndex + 1) % group.songs.length;
  } else {
    group.activeIndex = (group.activeIndex - 1 + group.songs.length) % group.songs.length;
  }
  saveLibrary();

  currentTrackKey = ""; // Force reload
  const song = getActiveSong(moodKey);

  if (userInitiated) {
    showToast(`⏭ ${song.title}`);
    await playSong(song, moodKey);
  } else {
    // Auto-advance (from ended event or error)
    if (isPlaying || userInitiated) {
      await playSong(song, moodKey);
    } else {
      renderPlayer(song, moodKey);
    }
  }
}

// ─── Mouse Kinematics ──────────────────────────────────────────────────────────
window.addEventListener("mousemove", (e) => {
  const now = Date.now();
  if (lastMouseX !== null) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dt = (now - lastMouseTime) / 1000;
    if (dt > 0.005) {
      const instSpeed = Math.hypot(dx, dy) / dt;
      currentSpeed = instSpeed;
      recentSpeeds.push({ t: now, speed: instSpeed });
      const angleChange = Math.abs(Math.atan2(dy, dx) - Math.atan2(lastDy, lastDx));
      if (angleChange > 1.2 && instSpeed > 300) jerkScore = Math.min(1.0, jerkScore + 0.15);
      else jerkScore = Math.max(0, jerkScore - 0.02);
      lastDx = dx; lastDy = dy;
    }
  }
  lastMouseX = e.clientX; lastMouseY = e.clientY; lastMouseTime = now;
});

// ─── Affect Inference (50 Hz) ─────────────────────────────────────────────────
let lastMoodKey = "";
setInterval(() => {
  const now = Date.now();
  while (recentSpeeds.length && now - recentSpeeds[0].t > 2500) recentSpeeds.shift();

  if (now > manualCalibrationUntil) {
    if (recentSpeeds.length > 0) {
      const avgSpeed = recentSpeeds.reduce((a, x) => a + x.speed, 0) / recentSpeeds.length;
      const targetArousal = Math.min(1, Math.max(-1, (avgSpeed / 450) - 1));
      mockArousal = mockArousal * 0.88 + targetArousal * 0.12;
      const targetValence = jerkScore > 0.45 ? -0.55 : (mockArousal > 0.0 ? 0.35 : 0.65);
      mockValence = mockValence * 0.90 + targetValence * 0.10;
    } else {
      mockArousal = mockArousal * 0.97 + (-0.75) * 0.03;
      mockValence = mockValence * 0.98 + (0.5) * 0.02;
      currentSpeed *= 0.8;
    }
  }

  // Auto-switch song if mood quadrant changed
  const newMoodKey = getMoodCategory(mockArousal, mockValence);
  if (newMoodKey !== lastMoodKey && isPlaying && !isFetching) {
    lastMoodKey = newMoodKey;
    const song = getActiveSong(newMoodKey);
    currentTrackKey = ""; // Force src update
    playSong(song, newMoodKey);
  }

  // Update speed meter UI
  const speedElem = document.getElementById("speed-indicator");
  const meterElem = document.getElementById("speed-meter-fill");
  if (speedElem) speedElem.innerText = `${Math.round(currentSpeed)} px/s`;
  if (meterElem) meterElem.style.width = `${Math.min(100, Math.round((currentSpeed / 900) * 100))}%`;
}, 50);

// ─── State Polling (400 ms) ────────────────────────────────────────────────────
const { invoke } = window.__TAURI__?.core || {
  invoke: async (cmd, args) => {
    if (cmd === "get_current_state") {
      const moodKey = getMoodCategory(mockArousal, mockValence);
      const song = getActiveSong(moodKey);
      return { valence: mockValence, arousal: mockArousal, mood_key: moodKey,
               track_title: song.title, track_artist: song.artist };
    }
    if (cmd === "submit_label" && args) {
      mockValence = args.valence; mockArousal = args.arousal;
      manualCalibrationUntil = Date.now() + 10000;
      return { ok: true };
    }
    return {};
  }
};

async function pollState() {
  try {
    const s = await invoke("get_current_state");
    const { valence, arousal } = s;

    const coordElem = document.getElementById("mood-coordinates");
    if (coordElem) coordElem.innerText = `Valence: ${(+valence).toFixed(2)}   Arousal: ${(+arousal).toFixed(2)}`;

    const moodKey = getMoodCategory(+arousal, +valence);
    const labels = {
      excited_happy: "⚡ Excited & Energized (Naatu / Tauba)",
      stressed_anxious: "⚡ Stressed & Intense (Arjan / Hukum)",
      calm_relaxed: "🌿 Calm & Relaxed (Samajavaragamana)",
      mellow_melancholy: "🌿 Mellow & Reflective (O Maahi / Adiga)"
    };
    const labelElem = document.getElementById("mood-label");
    if (labelElem) labelElem.innerText = labels[moodKey] || moodKey;

    const dot = document.getElementById("inferred-dot");
    if (dot) {
      dot.style.left = `${Math.min(240, Math.max(8, ((+valence + 1) / 2) * 248))}px`;
      dot.style.top  = `${Math.min(240, Math.max(8, ((1 - +arousal) / 2) * 248))}px`;
    }

    const countElem = document.getElementById("events-count");
    if (countElem) countElem.innerText = recentSpeeds.length;
  } catch {}
}

// ─── Affect Grid Modal ────────────────────────────────────────────────────────
function setupAffectGridModal() {
  const modal    = document.getElementById("affect-grid-modal");
  const openBtn  = document.getElementById("btn-open-grid");
  const closeBtn = document.getElementById("btn-close-modal");
  const grid     = document.getElementById("modal-affect-grid");
  const marker   = document.getElementById("modal-grid-marker");
  const readout  = document.getElementById("modal-coords-readout");
  if (!modal || !grid) return;

  openBtn?.addEventListener("click", () => { modal.style.display = "flex"; });
  closeBtn?.addEventListener("click", () => { modal.style.display = "none"; });
  modal.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });
  window.addEventListener("keydown", e => { if (e.key === "Escape") modal.style.display = "none"; });

  grid.addEventListener("mousemove", e => {
    const r = grid.getBoundingClientRect();
    const hv = ((e.clientX - r.left) / r.width * 2 - 1).toFixed(2);
    const ha = (1 - (e.clientY - r.top) / r.height * 2).toFixed(2);
    if (marker) { marker.style.display = "block"; marker.style.left = `${e.clientX - r.left}px`; marker.style.top = `${e.clientY - r.top}px`; }
    const moods = { "1": "Excited & Happy", "-1": "Stressed & Intense", "0-1": "Calm", "0-0": "Mellow" };
    let lbl = ha > 0.2 && hv > 0.1 ? "Excited & Happy (Naatu / Tauba)" :
              ha > 0.2 && hv <= 0.1 ? "Stressed (Arjan / Hukum)" :
              ha <= 0.2 && hv > 0.1 ? "Calm (Samajavaragamana)" : "Mellow (O Maahi)";
    if (readout) readout.innerText = `[${lbl}]  V: ${hv}, A: ${ha}`;
  });

  grid.addEventListener("mouseleave", () => { if (marker) marker.style.display = "none"; });

  grid.addEventListener("click", async e => {
    const r = grid.getBoundingClientRect();
    mockValence = parseFloat(((e.clientX - r.left) / r.width * 2 - 1).toFixed(4));
    mockArousal = parseFloat((1 - (e.clientY - r.top) / r.height * 2).toFixed(4));
    manualCalibrationUntil = Date.now() + 12000;
    modal.style.display = "none";
    lastMoodKey = "";
    const moodKey = getMoodCategory(mockArousal, mockValence);
    const song = getActiveSong(moodKey);
    currentTrackKey = "";
    await playSong(song, moodKey);
    showToast(`🎯 Mood calibrated → ${moodKey.replace(/_/g, " ").toUpperCase()}`);
  });
}

// ─── Library Modal ────────────────────────────────────────────────────────────
let selectedLibTab = "excited_happy";

function setupLibraryModal() {
  const modal = document.getElementById("library-modal");
  if (!modal) return;

  document.getElementById("btn-open-library")?.addEventListener("click", () => { renderLibrarySongs(); modal.style.display = "flex"; });
  document.getElementById("btn-open-library-action")?.addEventListener("click", () => { renderLibrarySongs(); modal.style.display = "flex"; });
  document.getElementById("btn-close-library")?.addEventListener("click", () => { modal.style.display = "none"; });
  modal.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });

  document.querySelectorAll(".lib-tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".lib-tab-btn").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      selectedLibTab = tab.getAttribute("data-mood");
      renderLibrarySongs();
    });
  });

  document.getElementById("btn-save-new-song")?.addEventListener("click", () => {
    const title  = document.getElementById("new-song-title")?.value.trim();
    const artist = document.getElementById("new-song-artist")?.value.trim() || "Artist";
    const mood   = document.getElementById("new-song-mood")?.value || "excited_happy";
    if (!title) { showToast("⚠ Enter a song title"); return; }

    const song = { id: "custom_" + Date.now(), title, artist, itunesQuery: `${title} ${artist}`, isCustom: true };
    if (!moodLibrary[mood]) moodLibrary[mood] = { activeIndex: 0, songs: [] };
    moodLibrary[mood].songs.push(song);
    moodLibrary[mood].activeIndex = moodLibrary[mood].songs.length - 1;
    saveLibrary();

    document.getElementById("new-song-title").value = "";
    document.getElementById("new-song-artist").value = "";
    selectedLibTab = mood;
    document.querySelectorAll(".lib-tab-btn").forEach(t => t.classList.toggle("active", t.getAttribute("data-mood") === mood));
    renderLibrarySongs();
    showToast(`⭐ Added "${title}" to library!`);
  });

  document.getElementById("btn-reset-library")?.addEventListener("click", () => {
    moodLibrary = JSON.parse(JSON.stringify(DEFAULT_MOOD_LIBRARY));
    previewCache = {};
    saveLibrary();
    renderLibrarySongs();
    showToast("↺ Library reset to trending songs");
  });
}

function renderLibrarySongs() {
  const container = document.getElementById("library-song-list");
  if (!container) return;
  const group = moodLibrary[selectedLibTab] || { activeIndex: 0, songs: [] };
  container.innerHTML = "";

  if (!group.songs.length) {
    container.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:12px;font-size:0.8rem;">No songs yet.</p>`;
    return;
  }

  group.songs.forEach((song, idx) => {
    const isActive = idx === group.activeIndex;
    const card = document.createElement("div");
    card.className = `song-item-card ${isActive ? "is-active" : ""}`;
    card.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:2px;max-width:65%;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:700;font-size:0.88rem;color:#fff;">${song.title}</span>
          ${isActive ? `<span class="song-active-badge">Playing</span>` : ""}
        </div>
        <span style="font-size:0.75rem;color:var(--text-secondary);">${song.artist}</span>
      </div>
      <div class="song-actions">
        <button class="btn-select-song" data-index="${idx}">${isActive ? "✔ Active" : "▶ Play"}</button>
        ${song.isCustom ? `<button class="btn-delete-song" data-index="${idx}">🗑</button>` : ""}
      </div>
    `;

    card.querySelector(".btn-select-song").addEventListener("click", async () => {
      group.activeIndex = idx;
      saveLibrary();
      currentTrackKey = "";
      lastMoodKey = "";
      document.getElementById("library-modal").style.display = "none";
      await playSong(song, selectedLibTab);
      renderLibrarySongs();
    });

    card.querySelector(".btn-delete-song")?.addEventListener("click", () => {
      group.songs.splice(idx, 1);
      if (group.activeIndex >= group.songs.length) group.activeIndex = Math.max(0, group.songs.length - 1);
      saveLibrary();
      renderLibrarySongs();
    });

    container.appendChild(card);
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  document.querySelector(".toast-notification")?.remove();
  const t = document.createElement("div");
  t.className = "toast-notification";
  t.innerText = msg;
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:rgba(154,77,255,0.95);color:#fff;font-family:'Outfit',sans-serif;
    font-size:0.85rem;font-weight:600;padding:10px 22px;border-radius:30px;
    box-shadow:0 6px 25px rgba(0,0,0,0.6),0 0 15px rgba(154,77,255,0.5);
    z-index:99999;transition:opacity 0.35s ease,transform 0.35s ease;`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(10px)"; setTimeout(() => t.remove(), 400); }, 2800);
}

// ─── Provider Switch ──────────────────────────────────────────────────────────
function syncProviderUI(name) {
  document.getElementById("btn-yt")?.classList.toggle("active", name === "youtube");
  document.getElementById("btn-spot")?.classList.toggle("active", name === "spotify");
}

// ─── Volume ────────────────────────────────────────────────────────────────────
function setVolume(val) {
  masterVolume = val;
  if (audioEl) audioEl.volume = masterVolume;
}

// ─── Initialize ───────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  // Create audio element early
  getAudioEl();

  // Waveform CSS animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes barBounce {
      0%,100% { height: 8px; }
      50% { height: 26px; }
    }
    .deck-wave-bar {
      animation: barBounce 0.6s ease-in-out infinite;
      animation-play-state: paused;
    }
    .deck-wave-bar:nth-child(1) { animation-delay: 0s; }
    .deck-wave-bar:nth-child(2) { animation-delay: 0.15s; }
    .deck-wave-bar:nth-child(3) { animation-delay: 0.3s; }
    .deck-wave-bar:nth-child(4) { animation-delay: 0.45s; }
    .deck-wave-bar:nth-child(5) { animation-delay: 0.6s; }
  `;
  document.head.appendChild(style);

  // Playback buttons
  document.getElementById("btn-play-pause")?.addEventListener("click", togglePlayPause);
  document.getElementById("btn-stop-track")?.addEventListener("click", stopTrack);
  document.getElementById("btn-prev-track")?.addEventListener("click", () => cycleTrack("prev", true));
  document.getElementById("btn-next-track")?.addEventListener("click", () => cycleTrack("next", true));

  // Volume slider
  const volSlider = document.getElementById("volume-slider");
  const volReadout = document.getElementById("volume-readout");
  volSlider?.addEventListener("input", e => {
    setVolume(e.target.value / 100);
    if (volReadout) volReadout.innerText = `${e.target.value}%`;
  });

  // Quick Mood Dropdown
  document.getElementById("quick-mood-select")?.addEventListener("change", async e => {
    const m = e.target.value;
    const coords = { excited_happy: [0.75, 0.65], stressed_anxious: [0.75, -0.55], calm_relaxed: [-0.65, 0.65], mellow_melancholy: [-0.65, -0.55] };
    [mockArousal, mockValence] = coords[m] || [0, 0];
    manualCalibrationUntil = Date.now() + 12000;
    lastMoodKey = "";
    currentTrackKey = "";
    const song = getActiveSong(m);
    await playSong(song, m);
    showToast(`✨ Mood: ${m.replace(/_/g, " ").toUpperCase()}`);
  });

  // Provider buttons (just updates search links)
  document.getElementById("btn-yt")?.addEventListener("click", () => { syncProviderUI("youtube"); });
  document.getElementById("btn-spot")?.addEventListener("click", () => { syncProviderUI("spotify"); });

  // Enable Audio banner / artwork click
  const banner = document.getElementById("audio-activation-banner");
  banner?.addEventListener("click", togglePlayPause);
  document.getElementById("btn-enable-audio")?.addEventListener("click", togglePlayPause);
  document.getElementById("track-art-glow")?.addEventListener("click", togglePlayPause);

  // Modals
  setupAffectGridModal();
  setupLibraryModal();

  // Init display
  lastMoodKey = getMoodCategory(mockArousal, mockValence);
  const song = getActiveSong(lastMoodKey);
  renderPlayer(song, lastMoodKey);

  // Start polling
  pollState();
  setInterval(pollState, 500);
});

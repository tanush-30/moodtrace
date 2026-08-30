// ─── Real-time Mouse Dynamics & Affect Engine ────────────────────────────────
let mockArousal = -0.5;
let mockValence = 0.6;
let currentSpeed = 0;
let lastMouseX = null, lastMouseY = null, lastMouseTime = null;
let lastDx = 0, lastDy = 0;
let jerkScore = 0;
const recentSpeeds = [];
let audioUnlocked = false;
let isPlaying = true;
let manualCalibrationUntil = 0; // Timestamp to hold manual override

// Default Curated Playlist Library with 100% Verified Global Spotify & YouTube IDs
const DEFAULT_MOOD_LIBRARY = {
  excited_happy: {
    activeIndex: 0,
    songs: [
      { id: "eh1", title: "Blinding Lights", artist: "The Weeknd", videoId: "4NRXx6U8ABQ", spotifyId: "0VjIjW4GlUZAMYd2vXMi3b" },
      { id: "eh2", title: "Happy", artist: "Pharrell Williams", videoId: "ZbZSe6N_BXs", spotifyId: "60nZcImufyMA1MKQY3dcCH" },
      { id: "eh3", title: "Shape of You", artist: "Ed Sheeran", videoId: "JGwWNGJdvx8", spotifyId: "7qiZfU4dY1lWllzX7mPBI3" },
      { id: "eh4", title: "Get Lucky", artist: "Daft Punk ft. Pharrell", videoId: "5NV6Rdv1a3I", spotifyId: "2Foc5Q5nqNiosCNqttzHof" }
    ]
  },
  stressed_anxious: {
    activeIndex: 0,
    songs: [
      { id: "sa1", title: "Smells Like Teen Spirit", artist: "Nirvana", videoId: "hTWKbfoikeg", spotifyId: "4Cee0ZdPWHiHGEsNqKhnz8" },
      { id: "sa2", title: "In the End", artist: "Linkin Park", videoId: "eVTXPUF4Oz4", spotifyId: "60a0Rd6pj0RH42bNsA9J1W" },
      { id: "sa3", title: "Chop Suey!", artist: "System Of A Down", videoId: "CSvFpBOmb80", spotifyId: "2DlHlPMa4M97k0xYADujVg" },
      { id: "sa4", title: "Believer", artist: "Imagine Dragons", videoId: "7wtfhZwyrcc", spotifyId: "0pqnGHJpmpxLKifKRmU6WP" }
    ]
  },
  calm_relaxed: {
    activeIndex: 0,
    songs: [
      { id: "cr1", title: "Sunflower", artist: "Post Malone & Swae Lee", videoId: "ApXoWvfEYVU", spotifyId: "3KkXRkHbMCARz0aVfEt68P" },
      { id: "cr2", title: "Banana Pancakes", artist: "Jack Johnson", videoId: "OzqKKyMPxQo", spotifyId: "451GXMSSMw0YsMu9h52j1J" },
      { id: "cr3", title: "Ocean Eyes", artist: "Billie Eilish", videoId: "viimfQi_pUw", spotifyId: "7hDVMDvtR3zg3Qju71B9gq" },
      { id: "cr4", title: "Riptide", artist: "Vance Joy", videoId: "uJ_1HMAGb4k", spotifyId: "7yq4QjY5Ag8pqpH8R1B51r" }
    ]
  },
  mellow_melancholy: {
    activeIndex: 0,
    songs: [
      { id: "mm1", title: "Yesterday", artist: "The Beatles", videoId: "wM0IdWY0aYU", spotifyId: "3BQHpFgAp4l80e1XslIj6q" },
      { id: "mm2", title: "Someone Like You", artist: "Adele", videoId: "hLQl3WQQoQ0", spotifyId: "1zwMYTA5nlNjZxYrvBB2io" },
      { id: "mm3", title: "Someone You Loved", artist: "Lewis Capaldi", videoId: "zABLecsR5UE", spotifyId: "7qEHsqek33rTcFNT9PFqLf" },
      { id: "mm4", title: "drivers license", artist: "Olivia Rodrigo", videoId: "ZmDBbnmKpqQ", spotifyId: "5wANPM4fQCJwkGd4rN57mH" }
    ]
  }
};

// Clean Spotify URI / URL into pure 22-char track ID or full embed path
function cleanSpotifyId(input) {
  if (!input) return "0VjIjW4GlUZAMYd2vXMi3b";
  input = String(input).trim();
  
  // Check for playlist / album / track URL
  const trackMatch = input.match(/(?:track\/|spotify:track:)([a-zA-Z0-9]{22})/);
  if (trackMatch) return trackMatch[1];

  const playlistMatch = input.match(/(?:playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})/);
  if (playlistMatch) return playlistMatch[1];
  
  // Clean query strings
  input = input.split("?")[0].split("/").pop().replace("spotify:track:", "");
  return input || "0VjIjW4GlUZAMYd2vXMi3b";
}

// Load or initialize user library from localStorage
function loadLibrary() {
  try {
    const saved = localStorage.getItem("moodtrace_user_library_v3");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_MOOD_LIBRARY, ...parsed };
    }
  } catch (e) {
    console.error("Could not load library from storage", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_MOOD_LIBRARY));
}

function saveLibrary() {
  try {
    localStorage.setItem("moodtrace_user_library_v3", JSON.stringify(moodLibrary));
  } catch (e) {}
}

let moodLibrary = loadLibrary();

// Helper to get active song for a mood
function getActiveSongForMood(moodKey) {
  const group = moodLibrary[moodKey] || moodLibrary["calm_relaxed"];
  const idx = Math.max(0, Math.min(group.activeIndex, group.songs.length - 1));
  return group.songs[idx] || DEFAULT_MOOD_LIBRARY[moodKey].songs[0];
}

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

      // Compute directional jerk
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
  
  while (recentSpeeds.length && now - recentSpeeds[0].t > 2500) {
    recentSpeeds.shift();
  }

  if (now > manualCalibrationUntil) {
    if (recentSpeeds.length > 0) {
      const avgSpeed = recentSpeeds.reduce((acc, x) => acc + x.speed, 0) / recentSpeeds.length;
      
      const targetArousal = Math.min(1, Math.max(-1, (avgSpeed / 450) - 1));
      mockArousal = mockArousal * 0.88 + targetArousal * 0.12;

      const targetValence = jerkScore > 0.45 ? -0.55 : (mockArousal > 0.6 ? 0.35 : 0.65);
      mockValence = mockValence * 0.90 + targetValence * 0.10;
    } else {
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
      const track = getActiveSongForMood(moodKey);
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
      manualCalibrationUntil = Date.now() + 8000;
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
  const track = trackInfo || getActiveSongForMood(moodKey);
  
  if (currentProvider === "youtube") {
    ytContainer.style.display = "block";
    spotContainer.style.display = "none";
    
    if (track.videoId && (track.videoId !== activeVideoId || !isPlaying)) {
      const autoplayParam = audioUnlocked && isPlaying ? 1 : 0;
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
    
    const cleanId = cleanSpotifyId(track.spotifyId);
    if (cleanId !== activeSpotifyId || spotContainer.innerHTML === "") {
      spotContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 14px; border: 1px solid rgba(29, 185, 84, 0.25);">
          <iframe style="border-radius: 10px; width: 100%; border: none;"
            src="https://open.spotify.com/embed/track/${cleanId}?utm_source=generator"
            width="100%" height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy">
          </iframe>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1db954">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span style="font-size: 0.75rem; font-weight: 700; color: #1db954;">Spotify Live Active</span>
            </div>
            <a href="https://open.spotify.com/track/${cleanId}" target="_blank" rel="noopener noreferrer" style="font-size: 0.72rem; color: #1db954; background: rgba(29, 185, 84, 0.15); border: 1px solid rgba(29, 185, 84, 0.35); padding: 4px 10px; border-radius: 6px; text-decoration: none; font-weight: 700; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
              <span>Open in Spotify Web ↗</span>
            </a>
          </div>
        </div>
      `;
      activeSpotifyId = cleanId;
    }
  }
}

// ─── State Polling & Dynamic UI Dispatcher ─────────────────────────────────────
async function pollState() {
  try {
    const s = await invoke("get_current_state");
    const { valence, arousal, provider } = s;

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
    const track = getActiveSongForMood(moodKey);
    
    if (track.title !== lastTitle) {
      lastTitle = track.title;
      const titleElem = document.getElementById("track-title");
      const artistElem = document.getElementById("track-artist");
      const artGlow = document.getElementById("track-art-glow");

      if (titleElem) titleElem.innerText = track.title;
      if (artistElem) artistElem.innerText = track.artist || "—";
      if (artGlow) {
        if (isPlaying) artGlow.classList.add("playing");
        else artGlow.classList.remove("playing");
      }

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
  renderPlayer(getActiveSongForMood(moodKey));
}

// ─── Playback Controls: Next, Prev, Play/Pause ────────────────────────────────
function cycleTrack(direction) {
  unlockAudio();
  const moodKey = getMoodCategory(mockArousal, mockValence);
  const group = moodLibrary[moodKey];
  if (!group || !group.songs.length) return;

  if (direction === "next") {
    group.activeIndex = (group.activeIndex + 1) % group.songs.length;
  } else {
    group.activeIndex = (group.activeIndex - 1 + group.songs.length) % group.songs.length;
  }
  saveLibrary();
  
  const track = getActiveSongForMood(moodKey);
  lastTitle = ""; // Force re-render
  activeVideoId = null;
  activeSpotifyId = null;
  pollState();
  showToast(`Switched track to "${track.title}" (${track.artist})`);
}

function togglePlayPause() {
  unlockAudio();
  isPlaying = !isPlaying;
  const playBtn = document.getElementById("btn-play-pause");
  const artGlow = document.getElementById("track-art-glow");
  
  if (playBtn) playBtn.innerText = isPlaying ? "⏸" : "▶";
  if (artGlow) {
    if (isPlaying) artGlow.classList.add("playing");
    else artGlow.classList.remove("playing");
  }

  const moodKey = getMoodCategory(mockArousal, mockValence);
  const track = getActiveSongForMood(moodKey);

  if (isPlaying) {
    activeVideoId = null; // Re-trigger autoplay
    renderPlayer(track);
    showToast("▶ Music Resumed");
  } else {
    const ytContainer = document.getElementById("yt-player-container");
    if (ytContainer && currentProvider === "youtube") {
      ytContainer.innerHTML = "";
      activeVideoId = null;
    }
    showToast("⏸ Music Paused");
  }
}

// ─── Modal: Affect Grid Manager ───────────────────────────────────────────────
function setupAffectGridModal() {
  const modal = document.getElementById("affect-grid-modal");
  const openBtn = document.getElementById("btn-open-grid");
  const closeBtn = document.getElementById("btn-close-modal");
  const grid = document.getElementById("modal-affect-grid");
  const marker = document.getElementById("modal-grid-marker");
  const readout = document.getElementById("modal-coords-readout");

  if (!modal || !openBtn || !grid) return;

  function openModal() { modal.style.display = "flex"; }
  function closeModal() { modal.style.display = "none"; }

  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") closeModal();
  });

  grid.addEventListener("mouseenter", () => { if (marker) marker.style.display = "block"; });
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

  grid.addEventListener("click", async (e) => {
    const rect = grid.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedValence = parseFloat(((clickX / rect.width) * 2.0 - 1.0).toFixed(4));
    const clickedArousal = parseFloat((1.0 - (clickY / rect.height) * 2.0).toFixed(4));

    mockValence = clickedValence;
    mockArousal = clickedArousal;
    manualCalibrationUntil = Date.now() + 10000;

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

// ─── Modal: Mood Songs & Favorites Library Manager ────────────────────────────
let selectedLibTabMood = "excited_happy";

function setupLibraryModal() {
  const modal = document.getElementById("library-modal");
  const openBtn = document.getElementById("btn-open-library");
  const openBtn2 = document.getElementById("btn-open-library-action");
  const closeBtn = document.getElementById("btn-close-library");
  const tabs = document.querySelectorAll(".lib-tab-btn");
  const saveNewSongBtn = document.getElementById("btn-save-new-song");

  if (!modal) return;

  function openLibrary() {
    renderLibrarySongsList();
    modal.style.display = "flex";
  }

  function closeLibrary() {
    modal.style.display = "none";
  }

  if (openBtn) openBtn.addEventListener("click", openLibrary);
  if (openBtn2) openBtn2.addEventListener("click", openLibrary);
  if (closeBtn) closeBtn.addEventListener("click", closeLibrary);

  modal.addEventListener("click", (e) => { if (e.target === modal) closeLibrary(); });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") closeLibrary();
  });

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      selectedLibTabMood = tab.getAttribute("data-mood");
      renderLibrarySongsList();
    });
  });

  // Add new song submit handler
  if (saveNewSongBtn) {
    saveNewSongBtn.addEventListener("click", () => {
      const titleInput = document.getElementById("new-song-title");
      const artistInput = document.getElementById("new-song-artist");
      const ytInput = document.getElementById("new-song-yt");
      const spotInput = document.getElementById("new-song-spotify");
      const moodSelect = document.getElementById("new-song-mood");

      const title = titleInput.value.trim();
      const artist = artistInput.value.trim() || "Unknown Artist";
      let videoId = ytInput.value.trim();
      let spotifyId = spotInput.value.trim();
      const targetMood = moodSelect.value;

      if (!title || !videoId) {
        showToast("⚠️ Please provide at least Song Title and YouTube Video ID/Link");
        return;
      }

      // Extract YouTube Video ID if a full URL was provided
      const ytMatch = videoId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch) videoId = ytMatch[1];

      // Extract Spotify Track ID if provided
      spotifyId = spotifyId ? cleanSpotifyId(spotifyId) : "0DiWol3AO6WpXZgp0EGl82";

      const newSong = {
        id: "custom_" + Date.now(),
        title,
        artist,
        videoId,
        spotifyId: spotifyId,
        isCustom: true
      };

      if (!moodLibrary[targetMood]) {
        moodLibrary[targetMood] = { activeIndex: 0, songs: [] };
      }

      moodLibrary[targetMood].songs.push(newSong);
      moodLibrary[targetMood].activeIndex = moodLibrary[targetMood].songs.length - 1; // Auto select
      saveLibrary();

      // Clear inputs
      titleInput.value = "";
      artistInput.value = "";
      ytInput.value = "";
      spotInput.value = "";

      selectedLibTabMood = targetMood;
      tabs.forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-mood") === targetMood);
      });

      renderLibrarySongsList();
      lastTitle = ""; // Trigger update if current mood
      pollState();
      showToast(`⭐ Added "${title}" to your ${targetMood.replace('_', ' ')} library!`);
    });
  }

  // Reset to defaults handler
  const resetBtn = document.getElementById("btn-reset-library");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      moodLibrary = JSON.parse(JSON.stringify(DEFAULT_MOOD_LIBRARY));
      saveLibrary();
      renderLibrarySongsList();
      lastTitle = "";
      activeVideoId = null;
      activeSpotifyId = null;
      pollState();
      showToast("↺ Library reset to verified Spotify tracks!");
    });
  }
}

function renderLibrarySongsList() {
  const container = document.getElementById("library-song-list");
  if (!container) return;

  const group = moodLibrary[selectedLibTabMood] || { activeIndex: 0, songs: [] };
  container.innerHTML = "";

  if (group.songs.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:12px;">No songs in this playlist yet.</p>`;
    return;
  }

  group.songs.forEach((song, idx) => {
    const isActive = idx === group.activeIndex;
    const card = document.createElement("div");
    card.className = `song-item-card ${isActive ? "is-active" : ""}`;
    
    card.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:2px; max-width:65%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; font-size:0.88rem; color:#fff;">${song.title}</span>
          ${isActive ? `<span class="song-active-badge">Active</span>` : ""}
        </div>
        <span style="font-size:0.75rem; color:var(--text-secondary);">${song.artist}</span>
      </div>
      <div class="song-actions">
        <button class="btn-select-song" data-index="${idx}">${isActive ? "Selected" : "Set Active"}</button>
        ${song.isCustom ? `<button class="btn-delete-song" data-index="${idx}" title="Delete Custom Song">🗑</button>` : ""}
      </div>
    `;

    // Click handler to set active song
    const selectBtn = card.querySelector(".btn-select-song");
    selectBtn.addEventListener("click", () => {
      group.activeIndex = idx;
      saveLibrary();
      renderLibrarySongsList();
      lastTitle = "";
      activeVideoId = null;
      activeSpotifyId = null;
      pollState();
      showToast(`⭐ Active song for ${selectedLibTabMood.replace('_', ' ')} set to "${song.title}"`);
    });

    // Delete custom song handler
    const delBtn = card.querySelector(".btn-delete-song");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        group.songs.splice(idx, 1);
        if (group.activeIndex >= group.songs.length) {
          group.activeIndex = Math.max(0, group.songs.length - 1);
        }
        saveLibrary();
        renderLibrarySongsList();
        pollState();
        showToast("Deleted custom song.");
      });
    }

    container.appendChild(card);
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

  // Affect Grid Modal & Library Modal setup
  setupAffectGridModal();
  setupLibraryModal();

  // Playback Control Buttons
  const btnPrev = document.getElementById("btn-prev-track");
  const btnPlay = document.getElementById("btn-play-pause");
  const btnNext = document.getElementById("btn-next-track");

  if (btnPrev) btnPrev.addEventListener("click", () => cycleTrack("prev"));
  if (btnNext) btnNext.addEventListener("click", () => cycleTrack("next"));
  if (btnPlay) btnPlay.addEventListener("click", togglePlayPause);

  // Provider toggle switches
  async function switchProvider(name) {
    try { await invoke("set_provider", { provider: name }); } catch {}
    syncProviderUI(name);
    activeVideoId = null;
    activeSpotifyId = null;
    const moodKey = getMoodCategory(mockArousal, mockValence);
    renderPlayer(getActiveSongForMood(moodKey));
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
      togglePlayPause();
    });
  }

  // Any initial click on body unlocks audio
  document.body.addEventListener("click", unlockAudio, { once: false });

  // Initial poll and recurring timer
  pollState();
  setInterval(pollState, 400);
});

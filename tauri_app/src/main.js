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

// Trending Telugu & Hindi Curated Playlists Across Russell's 4 Emotion Quadrants
const DEFAULT_MOOD_LIBRARY = {
  excited_happy: {
    activeIndex: 0,
    songs: [
      { id: "te_eh1", title: "Naatu Naatu", artist: "Rahul Sipligunj, Kaala Bhairava (RRR)", videoId: "OsU0CGZoV8E", spotifyId: "0b5TA897c41Vl9w9b8cI5p" },
      { id: "hi_eh1", title: "Tauba Tauba", artist: "Karan Aujla (Bad Newz)", videoId: "LK7-_dgAVQE", spotifyId: "3yHqvt1Gv167DVI1zZ4W6I" },
      { id: "te_eh2", title: "Kurchi Madathapetti", artist: "Thaman S, Sri Krishna (Guntur Kaaram)", videoId: "0l0Q5j_t5k0", spotifyId: "5dJ1zW5Vw7b0B2i3gU2sQz" },
      { id: "hi_eh2", title: "Chaleya", artist: "Arijit Singh, Shilpa Rao (Jawan)", videoId: "VAdGW7QDJhU", spotifyId: "0yLwL8tB8bSgBfVv13H2H5" },
      { id: "te_eh3", title: "Ramuloo Ramulaa", artist: "Anurag Kulkarni (Ala Vaikunthapurramuloo)", videoId: "2mDC8bZc-XU", spotifyId: "2qJ3kM3u9d19H2dM30c0nU" }
    ]
  },
  stressed_anxious: {
    activeIndex: 0,
    songs: [
      { id: "hi_sa1", title: "Arjan Vailly", artist: "Bhupinder Babbal (ANIMAL)", videoId: "sVf3p6YpC0U", spotifyId: "4iV5W9uYEdVUVa79Axb7Rh" },
      { id: "te_sa1", title: "Hukum (Thalaivar Alappara)", artist: "Anirudh Ravichander (Jailer)", videoId: "1F3hm63Su64", spotifyId: "19H2dM30c0nUqj3kM3u9d1" },
      { id: "te_sa2", title: "Fear Song", artist: "Anirudh Ravichander (Devara)", videoId: "v1yT9U0wT2Y", spotifyId: "0H3u9d19H2dM30c0nUqj3k" },
      { id: "te_sa3", title: "Badass", artist: "Anirudh Ravichander (Leo)", videoId: "ozrkpmsUvK8", spotifyId: "6mXmF7Z6qHwPcqP654yS3x" },
      { id: "hi_sa2", title: "Zinda Banda", artist: "Anirudh Ravichander (Jawan)", videoId: "dZ4_kMh1qF4", spotifyId: "3yHqvt1Gv167DVI1zZ4W6I" }
    ]
  },
  calm_relaxed: {
    activeIndex: 0,
    songs: [
      { id: "te_cr1", title: "Samajavaragamana", artist: "Sid Sriram (Ala Vaikunthapurramuloo)", videoId: "peL04hO_Vcg", spotifyId: "2qJ3kM3u9d19H2dM30c0nU" },
      { id: "hi_cr1", title: "Kesariya", artist: "Arijit Singh, Pritam (Brahmāstra)", videoId: "BddP6PYo2gs", spotifyId: "6AQbmPrNa05O5qj60U9QkH" },
      { id: "te_cr2", title: "Chuttamalle", artist: "Shilpa Rao, Anirudh (Devara)", videoId: "7oV3H2H5qP6", spotifyId: "4iV5W9uYEdVUVa79Axb7Rh" },
      { id: "hi_cr2", title: "Heeriye", artist: "Jasleen Royal, Arijit Singh", videoId: "RLzC55ai0eo", spotifyId: "7cR43i9Kq1b8Z6y2qJ3kM3" },
      { id: "te_cr3", title: "Inkem Inkem Inkem Kaavaale", artist: "Sid Sriram (Geetha Govindam)", videoId: "8V8Vw6b0B2i", spotifyId: "1dM30c0nUqj3kM3u9d19H2" }
    ]
  },
  mellow_melancholy: {
    activeIndex: 0,
    songs: [
      { id: "hi_mm1", title: "O Maahi", artist: "Arijit Singh, Pritam (Dunki)", videoId: "i23m8t6Z9qH", spotifyId: "5dJ1zW5Vw7b0B2i3gU2sQz" },
      { id: "te_mm1", title: "Adiga Adiga", artist: "Sid Sriram (Ninnu Kori)", videoId: "d0qP654yS3x", spotifyId: "3yHqvt1Gv167DVI1zZ4W6I" },
      { id: "hi_mm2", title: "Satranga", artist: "Arijit Singh (ANIMAL)", videoId: "UK0qP654yS3", spotifyId: "0yLwL8tB8bSgBfVv13H2H5" },
      { id: "te_mm2", title: "Urike Urike", artist: "Sid Sriram, Ramya Behara (HIT 2)", videoId: "284Ov7ysmfA", spotifyId: "6AQbmPrNa05O5qj60U9QkH" },
      { id: "hi_mm3", title: "Agar Tum Saath Ho", artist: "Arijit Singh, Alka Yagnik (Tamasha)", videoId: "sK7riqg2mr4", spotifyId: "3yHqvt1Gv167DVI1zZ4W6I" }
    ]
  }
};

// Clean Spotify URI / URL into pure 22-char track ID or full embed path
function cleanSpotifyId(input) {
  if (!input) return "0b5TA897c41Vl9w9b8cI5p";
  input = String(input).trim();
  
  // Check for playlist / album / track URL
  const trackMatch = input.match(/(?:track\/|spotify:track:)([a-zA-Z0-9]{22})/);
  if (trackMatch) return trackMatch[1];

  const playlistMatch = input.match(/(?:playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})/);
  if (playlistMatch) return playlistMatch[1];
  
  // Clean query strings
  input = input.split("?")[0].split("/").pop().replace("spotify:track:", "");
  return input || "0b5TA897c41Vl9w9b8cI5p";
}

// Load or initialize user library from localStorage
function loadLibrary() {
  try {
    // Purge old legacy keys that contained invalid hashes
    localStorage.removeItem("moodtrace_user_library");
    localStorage.removeItem("moodtrace_user_library_v2");
    localStorage.removeItem("moodtrace_user_library_v3");

    const saved = localStorage.getItem("moodtrace_user_library_v5_desi");
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
    localStorage.setItem("moodtrace_user_library_v5_desi", JSON.stringify(moodLibrary));
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
    // Spotify Provider: Full Interactive Native Deck + Background Stream
    spotContainer.style.display = "block";
    
    // Maintain underlying audio stream
    if (track.videoId && (track.videoId !== activeVideoId || !isPlaying)) {
      const autoplayParam = audioUnlocked && isPlaying ? 1 : 0;
      ytContainer.style.display = "none";
      ytContainer.innerHTML = `
        <iframe width="1" height="1"
          src="https://www.youtube.com/embed/${track.videoId}?autoplay=${autoplayParam}&mute=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
          title="MoodTrace Audio Stream"
          allow="autoplay; encrypted-media"
          style="position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px;">
        </iframe>
      `;
      activeVideoId = track.videoId;
    }

    const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(track.title + ' ' + track.artist)}`;
    
    spotContainer.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(29, 185, 84, 0.22), rgba(12, 8, 24, 0.95)); border: 1.5px solid rgba(29, 185, 84, 0.45); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1db954">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span style="font-weight: 800; font-size: 0.85rem; color: #1db954; letter-spacing: 1.5px;">SPOTIFY LIVE SYNC</span>
          </div>
          <span style="font-size: 0.72rem; font-weight: 700; color: ${isPlaying ? '#00ffaa' : '#ff77aa'}; background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 6px;">
            ${isPlaying ? '● STREAMING LIVE' : '⏸ PAUSED'}
          </span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.4); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="display: flex; flex-direction: column; gap: 2px; max-width: 65%;">
            <span style="font-size: 0.95rem; font-weight: 800; color: #fff;">${track.title}</span>
            <span style="font-size: 0.78rem; color: var(--text-secondary);">${track.artist}</span>
          </div>
          
          <!-- Animated Equalizer Waveform -->
          <div style="display: flex; align-items: flex-end; gap: 3px; height: 24px;">
            <div style="width: 4px; height: ${isPlaying ? '18px' : '4px'}; background: #1db954; border-radius: 2px; transition: height 0.2s;"></div>
            <div style="width: 4px; height: ${isPlaying ? '24px' : '6px'}; background: #1db954; border-radius: 2px; transition: height 0.2s;"></div>
            <div style="width: 4px; height: ${isPlaying ? '14px' : '4px'}; background: #1db954; border-radius: 2px; transition: height 0.2s;"></div>
            <div style="width: 4px; height: ${isPlaying ? '20px' : '5px'}; background: #1db954; border-radius: 2px; transition: height 0.2s;"></div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 2px;">
          <span style="font-size: 0.72rem; color: var(--text-secondary);">Mood: <b style="color: #fff;">${moodKey.replace('_', ' ').toUpperCase()}</b></span>
          <a href="${spotifySearchUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.74rem; color: #1db954; background: rgba(29, 185, 84, 0.18); border: 1px solid rgba(29, 185, 84, 0.45); padding: 5px 12px; border-radius: 20px; text-decoration: none; font-weight: 700; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
            <span>Open in Spotify App ↗</span>
          </a>
        </div>
      </div>
    `;
    activeSpotifyId = track.title;
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
    if (ytContainer) {
      ytContainer.innerHTML = "";
      activeVideoId = null;
    }
    renderPlayer(track);
    showToast("⏸ Music Paused");
  }
}

function stopTrack() {
  isPlaying = false;
  const playBtn = document.getElementById("btn-play-pause");
  const artGlow = document.getElementById("track-art-glow");
  
  if (playBtn) playBtn.innerText = "▶";
  if (artGlow) artGlow.classList.remove("playing");

  const ytContainer = document.getElementById("yt-player-container");
  if (ytContainer) {
    ytContainer.innerHTML = "";
    activeVideoId = null;
  }
  
  const moodKey = getMoodCategory(mockArousal, mockValence);
  renderPlayer(getActiveSongForMood(moodKey));
  showToast("⏹ Music Stopped");
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
  const btnStop = document.getElementById("btn-stop-track");
  const btnNext = document.getElementById("btn-next-track");
  const quickSelect = document.getElementById("quick-mood-select");

  if (btnPrev) btnPrev.addEventListener("click", () => cycleTrack("prev"));
  if (btnNext) btnNext.addEventListener("click", () => cycleTrack("next"));
  if (btnPlay) btnPlay.addEventListener("click", togglePlayPause);
  if (btnStop) btnStop.addEventListener("click", stopTrack);

  // Quick Mood Select Dropdown
  if (quickSelect) {
    quickSelect.addEventListener("change", (e) => {
      const selectedMood = e.target.value;
      if (selectedMood === "excited_happy") { mockArousal = 0.75; mockValence = 0.65; }
      else if (selectedMood === "stressed_anxious") { mockArousal = 0.75; mockValence = -0.55; }
      else if (selectedMood === "calm_relaxed") { mockArousal = -0.65; mockValence = 0.65; }
      else if (selectedMood === "mellow_melancholy") { mockArousal = -0.65; mockValence = -0.55; }
      
      manualCalibrationUntil = Date.now() + 12000;
      lastTitle = "";
      activeVideoId = null;
      isPlaying = true;
      const playBtn = document.getElementById("btn-play-pause");
      if (playBtn) playBtn.innerText = "⏸";
      unlockAudio();
      pollState();
      showToast(`✨ Selected Mood: ${selectedMood.replace('_', ' ').toUpperCase()}`);
    });
  }

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

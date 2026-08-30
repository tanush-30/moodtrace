// ─── Real-time Mouse Dynamics & Affect Engine ────────────────────────────────
let mockArousal = 0.6;
let mockValence = 0.5;
let currentSpeed = 0;
let lastMouseX = null, lastMouseY = null, lastMouseTime = null;
let lastDx = 0, lastDy = 0;
let jerkScore = 0;
const recentSpeeds = [];
let audioUnlocked = false;
let isPlaying = false;
let masterVolume = 0.85;
let manualCalibrationUntil = 0;

// Curated Telugu & Hindi Songs Mapped to the 4 Mood Quadrants
const DEFAULT_MOOD_LIBRARY = {
  excited_happy: {
    activeIndex: 0,
    songs: [
      { id: "te_eh1", title: "Naatu Naatu", artist: "Rahul Sipligunj, Kaala Bhairava (RRR)" },
      { id: "hi_eh1", title: "Tauba Tauba", artist: "Karan Aujla (Bad Newz)" },
      { id: "te_eh2", title: "Kurchi Madathapetti", artist: "Thaman S, Sri Krishna (Guntur Kaaram)" },
      { id: "hi_eh2", title: "Chaleya", artist: "Arijit Singh, Shilpa Rao (Jawan)" },
      { id: "te_eh3", title: "Ramuloo Ramulaa", artist: "Anurag Kulkarni (Ala Vaikunthapurramuloo)" }
    ]
  },
  stressed_anxious: {
    activeIndex: 0,
    songs: [
      { id: "hi_sa1", title: "Arjan Vailly", artist: "Bhupinder Babbal (ANIMAL)" },
      { id: "te_sa1", title: "Hukum (Thalaivar Alappara)", artist: "Anirudh Ravichander (Jailer)" },
      { id: "te_sa2", title: "Fear Song", artist: "Anirudh Ravichander (Devara)" },
      { id: "te_sa3", title: "Badass", artist: "Anirudh Ravichander (Leo)" },
      { id: "hi_sa2", title: "Zinda Banda", artist: "Anirudh Ravichander (Jawan)" }
    ]
  },
  calm_relaxed: {
    activeIndex: 0,
    songs: [
      { id: "te_cr1", title: "Samajavaragamana", artist: "Sid Sriram (Ala Vaikunthapurramuloo)" },
      { id: "hi_cr1", title: "Kesariya", artist: "Arijit Singh, Pritam (Brahmāstra)" },
      { id: "te_cr2", title: "Chuttamalle", artist: "Shilpa Rao, Anirudh (Devara)" },
      { id: "hi_cr2", title: "Heeriye", artist: "Jasleen Royal, Arijit Singh" },
      { id: "te_cr3", title: "Inkem Inkem Inkem Kaavaale", artist: "Sid Sriram (Geetha Govindam)" }
    ]
  },
  mellow_melancholy: {
    activeIndex: 0,
    songs: [
      { id: "hi_mm1", title: "O Maahi", artist: "Arijit Singh, Pritam (Dunki)" },
      { id: "te_mm1", title: "Adiga Adiga", artist: "Sid Sriram (Ninnu Kori)" },
      { id: "hi_mm2", title: "Satranga", artist: "Arijit Singh (ANIMAL)" },
      { id: "te_mm2", title: "Urike Urike", artist: "Sid Sriram, Ramya Behara (HIT 2)" },
      { id: "hi_mm3", title: "Agar Tum Saath Ho", artist: "Arijit Singh, Alka Yagnik (Tamasha)" }
    ]
  }
};

function loadLibrary() {
  try {
    const saved = localStorage.getItem("moodtrace_pure_audio_library_v11");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_MOOD_LIBRARY, ...parsed };
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_MOOD_LIBRARY));
}

function saveLibrary() {
  try {
    localStorage.setItem("moodtrace_pure_audio_library_v11", JSON.stringify(moodLibrary));
  } catch (e) {}
}

let moodLibrary = loadLibrary();

function getActiveSongForMood(moodKey) {
  const group = moodLibrary[moodKey] || moodLibrary["excited_happy"];
  const idx = Math.max(0, Math.min(group.activeIndex, group.songs.length - 1));
  return group.songs[idx] || DEFAULT_MOOD_LIBRARY[moodKey].songs[0];
}

// ─── Pure Web Audio API Generative Music Engine (100% Guaranteed Sound) ───────
let audioCtx = null;
let masterGain = null;
let synthInterval = null;
let currentStep = 0;

function initAudioEngine() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(masterVolume * 0.45, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => {
        if (isPlaying) startMelodyLoop();
      });
    } else if (audioCtx.state === "running" && isPlaying) {
      startMelodyLoop();
    }
  } catch (e) {
    console.error("AudioContext init error", e);
  }
}

// Musical note synthesizer
function playTone(freq, duration = 0.35, waveType = "sine", gainVal = 0.25) {
  if (!audioCtx || audioCtx.state === "suspended" || !isPlaying) return;
  try {
    const osc = audioCtx.createOscillator();
    const noteGain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, now);

    noteGain.gain.setValueAtTime(0.001, now);
    noteGain.gain.linearRampToValueAtTime(gainVal, now + 0.05);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {}
}

function startMelodyLoop() {
  if (synthInterval) clearInterval(synthInterval);

  synthInterval = setInterval(() => {
    if (!audioCtx || audioCtx.state === "suspended" || !isPlaying) return;

    const moodKey = getMoodCategory(mockArousal, mockValence);
    currentStep = (currentStep + 1) % 16;

    // Animate visualizer bars in sync with beats
    const waveBars = document.querySelectorAll(".deck-wave-bar");
    waveBars.forEach((bar, i) => {
      const h = 8 + Math.floor(Math.random() * 22);
      bar.style.height = `${h}px`;
    });

    if (moodKey === "excited_happy") {
      // High-energy fast folk / dance scale (C Major / Naatu Naatu tempo)
      const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
      const note = scale[currentStep % scale.length];
      playTone(note, 0.28, "triangle", 0.30);
      if (currentStep % 2 === 0) playTone(130.81, 0.18, "sawtooth", 0.25); // Bass beat
    } 
    else if (moodKey === "stressed_anxious") {
      // Rapid intense heavy bass staccato (Arjan Vailly / Hukum tempo)
      const bassNotes = [110.00, 116.54, 130.81, 146.83];
      const note = bassNotes[currentStep % bassNotes.length];
      playTone(note, 0.22, "sawtooth", 0.35);
      if (currentStep % 4 === 0) playTone(82.41, 0.35, "square", 0.30);
    } 
    else if (moodKey === "calm_relaxed") {
      // Gentle soothing acoustic / flute meditation (Samajavaragamana tempo)
      const ragaNotes = [216.00, 243.00, 272.00, 324.00, 364.00, 432.00];
      if (currentStep % 2 === 0) {
        const note = ragaNotes[(currentStep / 2) % ragaNotes.length];
        playTone(note, 0.90, "sine", 0.22);
        playTone(note * 0.5, 1.20, "sine", 0.15); // Warm drone
      }
    } 
    else {
      // Mellow reflective soulful chords (O Maahi / Adiga Adiga tempo)
      const minorScale = [220.00, 246.94, 261.63, 293.66, 329.63];
      if (currentStep % 2 === 0) {
        const note = minorScale[(currentStep / 2) % minorScale.length];
        playTone(note, 0.85, "sine", 0.25);
      }
    }
  }, 240);
}

// ─── Real-time Cursor Kinematics ─────────────────────────────────────────────
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

window.addEventListener("click", () => {
  if (Date.now() > manualCalibrationUntil) {
    mockArousal = Math.min(1.0, mockArousal + 0.10);
  }
  unlockAudio();
});

// ─── Affect Inference Loop (50 Hz) ───────────────────────────────────────────
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

  const speedElem = document.getElementById("speed-indicator");
  const meterElem = document.getElementById("speed-meter-fill");
  if (speedElem && meterElem) {
    const displaySpeed = Math.round(currentSpeed);
    speedElem.innerText = `${displaySpeed} px/s`;
    const fillPercent = Math.min(100, Math.round((displaySpeed / 900) * 100));
    meterElem.style.width = `${fillPercent}%`;
  }
}, 50);

function getMoodCategory(arousal, valence) {
  if (arousal >= 0.0) {
    return valence >= 0.0 ? "excited_happy" : "stressed_anxious";
  } else {
    return valence >= 0.0 ? "calm_relaxed" : "mellow_melancholy";
  }
}

// ─── Tauri IPC / Fallback Bridge ──────────────────────────────────────────────
let currentProvider = "youtube";
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
        track_provider_id: track.title,
        youtube_id: track.title,
        provider: currentProvider,
        mood_key: moodKey
      };
    }
    if (cmd === "submit_label" && args) {
      mockValence = args.valence;
      mockArousal = args.arousal;
      manualCalibrationUntil = Date.now() + 10000;
      return { ok: true };
    }
    if (cmd === "set_provider" && args) {
      currentProvider = args.provider;
      return { ok: true };
    }
    return {};
  }
};

// ─── Live Music Player Deck Renderer (100% Pure Audio) ────────────────────────
function renderPlayer(trackInfo) {
  const moodKey = getMoodCategory(mockArousal, mockValence);
  const track = trackInfo || getActiveSongForMood(moodKey);

  const titleElem = document.getElementById("deck-song-title");
  const artistElem = document.getElementById("deck-song-artist");
  const moodBadge = document.getElementById("deck-mood-badge");
  const spotLink = document.getElementById("deck-spotify-link");
  const ytLink = document.getElementById("deck-yt-link");
  const platformLabel = document.getElementById("deck-platform-label");
  const liveBadge = document.getElementById("deck-live-badge");

  if (titleElem) titleElem.innerText = track.title;
  if (artistElem) artistElem.innerText = track.artist;
  if (moodBadge) moodBadge.innerHTML = `Mood: <b style="color:#fff;">${moodKey.replace('_', ' ').toUpperCase()}</b>`;

  if (spotLink) spotLink.href = `https://open.spotify.com/search/${encodeURIComponent(track.title + ' ' + track.artist)}`;
  if (ytLink) ytLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(track.title + ' ' + track.artist)}`;

  if (platformLabel) {
    platformLabel.innerText = currentProvider === "spotify" ? "SPOTIFY AUDIO ENGINE" : "YOUTUBE AUDIO ENGINE";
  }

  if (liveBadge) {
    liveBadge.innerText = isPlaying ? "● AUDIO PLAYING LIVE" : "⏸ AUDIO PAUSED";
    liveBadge.style.color = isPlaying ? "#00ffaa" : "#ff77aa";
  }
}

// ─── State Polling ───────────────────────────────────────────────────────────
async function pollState() {
  try {
    const s = await invoke("get_current_state");
    const { valence, arousal, provider } = s;

    const coordElem = document.getElementById("mood-coordinates");
    if (coordElem) {
      coordElem.innerText = `Valence: ${(+valence).toFixed(2)}   Arousal: ${(+arousal).toFixed(2)}`;
    }

    let label = "Neutral";
    if (arousal > 0.25 && valence > 0.1) label = "Excited & Energized (Naatu / Tauba)";
    else if (arousal > 0.25 && valence <= 0.1) label = "Stressed & Intense (Arjan / Hukum)";
    else if (arousal <= 0.25 && valence > 0.1) label = "Calm & Relaxed (Samajavaragamana)";
    else label = "Mellow & Reflective (O Maahi / Adiga)";
    
    const labelElem = document.getElementById("mood-label");
    if (labelElem) labelElem.innerText = label;

    const dot = document.getElementById("inferred-dot");
    if (dot) {
      const leftPx = Math.min(240, Math.max(8, ((+valence + 1) / 2) * 248));
      const topPx  = Math.min(240, Math.max(8, ((1 - +arousal) / 2) * 248));
      dot.style.left = `${leftPx}px`;
      dot.style.top  = `${topPx}px`;
    }

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

    if (provider && provider !== currentProvider) {
      syncProviderUI(provider);
      renderPlayer(track);
    }

    const countElem = document.getElementById("events-count");
    if (countElem) countElem.innerText = recentSpeeds.length;

  } catch (err) {
    console.error("pollState error:", err);
  }
}

function syncProviderUI(provider) {
  currentProvider = provider;
  const btnYt = document.getElementById("btn-yt");
  const btnSpot = document.getElementById("btn-spot");
  if (btnYt) btnYt.classList.toggle("active", provider === "youtube");
  if (btnSpot) btnSpot.classList.toggle("active", provider === "spotify");
}

function unlockAudio() {
  // Only start playing if not already started
  if (!isPlaying) {
    isPlaying = true;
    const playBtn = document.getElementById("btn-play-pause");
    if (playBtn) playBtn.innerText = "⏸";
    const artGlow = document.getElementById("track-art-glow");
    if (artGlow) artGlow.classList.add("playing");
  }

  initAudioEngine();

  if (audioUnlocked) return;
  audioUnlocked = true;

  const banner = document.getElementById("audio-activation-banner");
  if (banner) {
    banner.style.background = "rgba(0, 255, 170, 0.15)";
    banner.style.borderColor = "rgba(0, 255, 170, 0.4)";
    const text = document.getElementById("audio-banner-text");
    if (text) text.innerText = "✨ Live Audio Active — Moving cursor dynamically shifts mood & music!";
    const btn = document.getElementById("btn-enable-audio");
    if (btn) btn.style.display = "none";
  }

  const hint = document.getElementById("player-status-hint");
  if (hint) hint.innerText = "🔊 Audio Active • Auto-matching to mouse speed";

  const soundStatus = document.getElementById("sound-engine-status");
  if (soundStatus) soundStatus.innerText = "🟢 Audio Playing Live";

  const moodKey = getMoodCategory(mockArousal, mockValence);
  renderPlayer(getActiveSongForMood(moodKey));
}

// ─── Playback Controls ────────────────────────────────────────────────────────
function cycleTrack(direction) {
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
  lastTitle = "";
  if (!isPlaying) {
    isPlaying = true;
    const playBtn = document.getElementById("btn-play-pause");
    if (playBtn) playBtn.innerText = "⏸";
  }
  unlockAudio();
  pollState();
  showToast(`Switched track to "${track.title}" (${track.artist})`);
}

function togglePlayPause() {
  isPlaying = !isPlaying;
  const playBtn = document.getElementById("btn-play-pause");
  const artGlow = document.getElementById("track-art-glow");
  const soundStatus = document.getElementById("sound-engine-status");
  
  if (playBtn) playBtn.innerText = isPlaying ? "⏸" : "▶";
  if (artGlow) {
    if (isPlaying) artGlow.classList.add("playing");
    else artGlow.classList.remove("playing");
  }

  if (soundStatus) {
    soundStatus.innerText = isPlaying ? "🟢 Audio Playing Live" : "⏸ Audio Paused";
  }

  if (isPlaying) {
    // Start or resume audio engine
    if (!audioCtx) {
      unlockAudio(); // creates context and starts loop
    } else {
      audioCtx.resume().then(() => startMelodyLoop());
    }
  } else {
    // Pause audio engine
    if (synthInterval) { clearInterval(synthInterval); synthInterval = null; }
    if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
  }

  const moodKey = getMoodCategory(mockArousal, mockValence);
  renderPlayer(getActiveSongForMood(moodKey));
  showToast(isPlaying ? "▶ Music Playing" : "⏸ Music Paused");
}

function stopTrack() {
  isPlaying = false;
  if (synthInterval) { clearInterval(synthInterval); synthInterval = null; }
  if (audioCtx && audioCtx.state === "running") audioCtx.suspend();

  const playBtn = document.getElementById("btn-play-pause");
  const artGlow = document.getElementById("track-art-glow");
  const soundStatus = document.getElementById("sound-engine-status");
  
  if (playBtn) playBtn.innerText = "▶";
  if (artGlow) artGlow.classList.remove("playing");
  if (soundStatus) soundStatus.innerText = "⏹ Audio Stopped";

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
    if (hoverA > 0.2 && hoverV > 0.1) hoverLabel = "Excited & Happy (Naatu / Tauba)";
    else if (hoverA > 0.2 && hoverV <= 0.1) hoverLabel = "Stressed & Intense (Arjan / Hukum)";
    else if (hoverA <= 0.2 && hoverV > 0.1) hoverLabel = "Calm & Relaxed (Samajavaragamana)";
    else hoverLabel = "Mellow & Reflective (O Maahi / Adiga)";

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

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      selectedLibTabMood = tab.getAttribute("data-mood");
      renderLibrarySongsList();
    });
  });

  if (saveNewSongBtn) {
    saveNewSongBtn.addEventListener("click", () => {
      const titleInput = document.getElementById("new-song-title");
      const artistInput = document.getElementById("new-song-artist");
      const moodSelect = document.getElementById("new-song-mood");

      const title = titleInput.value.trim();
      const artist = artistInput.value.trim() || "Telugu / Hindi Artist";
      const targetMood = moodSelect.value;

      if (!title) {
        showToast("⚠️ Please provide Song Title");
        return;
      }

      const newSong = {
        id: "custom_" + Date.now(),
        title,
        artist,
        isCustom: true
      };

      if (!moodLibrary[targetMood]) {
        moodLibrary[targetMood] = { activeIndex: 0, songs: [] };
      }

      moodLibrary[targetMood].songs.push(newSong);
      moodLibrary[targetMood].activeIndex = moodLibrary[targetMood].songs.length - 1;
      saveLibrary();

      titleInput.value = "";
      artistInput.value = "";

      selectedLibTabMood = targetMood;
      tabs.forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-mood") === targetMood);
      });

      renderLibrarySongsList();
      lastTitle = "";
      pollState();
      showToast(`⭐ Added "${title}" to ${targetMood.replace('_', ' ')} playlist!`);
    });
  }

  const resetBtn = document.getElementById("btn-reset-library");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      moodLibrary = JSON.parse(JSON.stringify(DEFAULT_MOOD_LIBRARY));
      saveLibrary();
      renderLibrarySongsList();
      lastTitle = "";
      pollState();
      showToast("↺ Library reset to trending Telugu & Hindi songs!");
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

    const selectBtn = card.querySelector(".btn-select-song");
    selectBtn.addEventListener("click", () => {
      group.activeIndex = idx;
      saveLibrary();
      renderLibrarySongsList();
      lastTitle = "";
      isPlaying = true;
      const playBtn = document.getElementById("btn-play-pause");
      if (playBtn) playBtn.innerText = "⏸";
      pollState();
      showToast(`⭐ Active track set to "${song.title}"`);
    });

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
  const banner = document.getElementById("audio-activation-banner");
  if (banner) banner.addEventListener("click", unlockAudio);
  
  const enableBtn = document.getElementById("btn-enable-audio");
  if (enableBtn) enableBtn.addEventListener("click", unlockAudio);

  setupAffectGridModal();
  setupLibraryModal();

  // Playback Control Buttons
  const btnPrev = document.getElementById("btn-prev-track");
  const btnPlay = document.getElementById("btn-play-pause");
  const btnStop = document.getElementById("btn-stop-track");
  const btnNext = document.getElementById("btn-next-track");
  const quickSelect = document.getElementById("quick-mood-select");
  const volumeSlider = document.getElementById("volume-slider");
  const volumeReadout = document.getElementById("volume-readout");

  if (btnPrev) btnPrev.addEventListener("click", () => cycleTrack("prev"));
  if (btnNext) btnNext.addEventListener("click", () => cycleTrack("next"));
  if (btnPlay) btnPlay.addEventListener("click", togglePlayPause);
  if (btnStop) btnStop.addEventListener("click", stopTrack);

  // Volume slider
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      masterVolume = e.target.value / 100;
      if (volumeReadout) volumeReadout.innerText = `${e.target.value}%`;
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(masterVolume * 0.45, audioCtx.currentTime);
      }
    });
  }

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
    const moodKey = getMoodCategory(mockArousal, mockValence);
    renderPlayer(getActiveSongForMood(moodKey));
    showToast(`Switched platform link to ${name === "spotify" ? "Spotify" : "YouTube"}`);
  }

  const btnYt = document.getElementById("btn-yt");
  const btnSpot = document.getElementById("btn-spot");
  if (btnYt) btnYt.addEventListener("click", () => switchProvider("youtube"));
  if (btnSpot) btnSpot.addEventListener("click", () => switchProvider("spotify"));

  const artGlow = document.getElementById("track-art-glow");
  if (artGlow) {
    artGlow.addEventListener("click", () => {
      unlockAudio();
      togglePlayPause();
    });
  }

  document.body.addEventListener("click", unlockAudio, { once: false });

  pollState();
  setInterval(pollState, 400);
});

// Moodtrace — Acoustic Affect & Biometric Soundscape Studio Engine

let invoke = null;
if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
  invoke = window.__TAURI__.core.invoke;
} else if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
  invoke = window.__TAURI_INTERNALS__.invoke;
}

// Browser Preview Mock Fallback
if (!invoke) {
  console.warn("Tauri IPC not detected. Running in browser simulation mode.");
  invoke = async (cmd, args = {}) => {
    if (cmd === 'get_current_state') {
      return {
        arousal: -0.42,
        valence: 0.65,
        tracking_enabled: true,
        inference_interval_sec: 1,
        popup_interval_min: 10,
        window_duration_sec: 35,
        mean_speed: 380.0,
        mean_acceleration: 145.0,
        click_rate: 0.5,
        idle_ratio: 0.12,
        event_count: 920
      };
    }
    if (cmd === 'get_telemetry_stats') {
      return { raw_events_count: 724659, labels_count: 163 };
    }
    return true;
  };
}

// =============================================================================
// Comprehensive Soundscape Library (12 Unique Moods & Distinct Instruments)
// =============================================================================
const MOOD_LIBRARY = {
  // --- CALM & PEACEFUL (High Valence, Low Arousal) ---
  zen: {
    id: 'zen',
    category: 'calm',
    badge: 'CALM & PEACEFUL',
    name: 'Zen Ambient Solitude',
    artist: 'Acoustic Grand Piano & Forest Wind',
    emoji: '🌿',
    accentColor: '#10b981',
    aura: 'radial-gradient(circle at 40% 30%, rgba(6, 95, 70, 0.38) 0%, rgba(16, 185, 129, 0.22) 35%, rgba(6, 182, 212, 0.12) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'zen'
  },
  ocean: {
    id: 'ocean',
    category: 'calm',
    badge: 'CALM & TRANQUIL',
    name: 'Ocean Waves & Ethereal Harp',
    artist: 'Rhythmic Coastal Surf & Plucked Harp',
    emoji: '🌊',
    accentColor: '#0ea5e9',
    aura: 'radial-gradient(circle at 40% 30%, rgba(14, 165, 233, 0.38) 0%, rgba(6, 182, 212, 0.24) 35%, rgba(16, 185, 129, 0.14) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'ocean'
  },
  meditation: {
    id: 'meditation',
    category: 'calm',
    badge: 'MEDITATION & TRANSCENDENCE',
    name: 'Deep 432Hz Singing Bowls',
    artist: 'Tibetan Resonances & OM Drone',
    emoji: '🧘',
    accentColor: '#14b8a6',
    aura: 'radial-gradient(circle at 40% 30%, rgba(20, 184, 166, 0.38) 0%, rgba(6, 95, 70, 0.25) 35%, rgba(99, 102, 241, 0.12) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'meditation'
  },

  // --- UPBEAT & ENERGIZED (High Valence, High Arousal) ---
  chillhop: {
    id: 'chillhop',
    category: 'upbeat',
    badge: 'HIGH ENERGY & HAPPY',
    name: 'Sunshine Chillhop Beats',
    artist: 'Lo-Fi Beats, Snare & Rhodes Chords',
    emoji: '⚡',
    accentColor: '#f59e0b',
    aura: 'radial-gradient(circle at 40% 30%, rgba(245, 158, 11, 0.38) 0%, rgba(244, 63, 94, 0.28) 35%, rgba(139, 92, 246, 0.2) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'chillhop'
  },
  sunrise: {
    id: 'sunrise',
    category: 'upbeat',
    badge: 'OPTIMISM & SUNSHINE',
    name: 'Golden Sunrise Acoustic',
    artist: 'Plucked Acoustic Guitar & Bright Melody',
    emoji: '🌅',
    accentColor: '#f97316',
    aura: 'radial-gradient(circle at 40% 30%, rgba(249, 115, 22, 0.38) 0%, rgba(245, 158, 11, 0.28) 35%, rgba(236, 72, 153, 0.18) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'sunrise'
  },
  chiptune: {
    id: 'chiptune',
    category: 'upbeat',
    badge: 'RETRO ARCADE & ADRENALINE',
    name: '8-Bit Retro Neon Pulse',
    artist: 'Pixel Synth Lead & Arcade Pulse',
    emoji: '🎮',
    accentColor: '#ec4899',
    aura: 'radial-gradient(circle at 40% 30%, rgba(236, 72, 153, 0.38) 0%, rgba(139, 92, 246, 0.28) 35%, rgba(6, 182, 212, 0.18) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'chiptune'
  },

  // --- INTENSE FOCUS & FLOW (Low Valence, High Arousal) ---
  cyber: {
    id: 'cyber',
    category: 'focus',
    badge: 'INTENSE FOCUS & FLOW',
    name: 'Cyber Synthwave Pulse',
    artist: 'Heavy Analog Synthwave Bass & Drive',
    emoji: '🎧',
    accentColor: '#8b5cf6',
    aura: 'radial-gradient(circle at 40% 30%, rgba(99, 102, 241, 0.38) 0%, rgba(139, 92, 246, 0.28) 35%, rgba(6, 182, 212, 0.16) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'cyber'
  },
  codeflow: {
    id: 'codeflow',
    category: 'focus',
    badge: 'HYPERFOCUS & MINIMAL TECHNO',
    name: 'Dark Code Flow Velocity',
    artist: 'Driving Sub-Kick & Rapid Hi-Hats',
    emoji: '🔥',
    accentColor: '#6366f1',
    aura: 'radial-gradient(circle at 40% 30%, rgba(99, 102, 241, 0.42) 0%, rgba(79, 70, 229, 0.3) 35%, rgba(244, 63, 94, 0.16) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'codeflow'
  },
  space: {
    id: 'space',
    category: 'focus',
    badge: 'DEEP SPACE ASTRAL SYNTH',
    name: 'Cosmic Nebula Horizon',
    artist: 'Zero-G Harmonic Ambient Space Drone',
    emoji: '🌌',
    accentColor: '#3b82f6',
    aura: 'radial-gradient(circle at 40% 30%, rgba(59, 130, 246, 0.42) 0%, rgba(99, 102, 241, 0.28) 35%, rgba(139, 92, 246, 0.16) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'space'
  },

  // --- CALM & REFLECTIVE (Low Valence, Low Arousal) ---
  rain_piano: {
    id: 'rain_piano',
    category: 'melancholy',
    badge: 'CALM & REFLECTIVE',
    name: 'Midnight Rain & Reflective Piano',
    artist: 'Nocturnal Rainfall & Grand Piano',
    emoji: '🌧️',
    accentColor: '#06b6d4',
    aura: 'radial-gradient(circle at 40% 30%, rgba(30, 27, 75, 0.48) 0%, rgba(49, 46, 129, 0.32) 35%, rgba(6, 182, 212, 0.14) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'rain_piano'
  },
  cello: {
    id: 'cello',
    category: 'melancholy',
    badge: 'DEEP STRINGS & RAIN',
    name: 'Nocturnal Cello Meditation',
    artist: 'Formant Bowed Cello & Strings',
    emoji: '🎻',
    accentColor: '#64748b',
    aura: 'radial-gradient(circle at 40% 30%, rgba(51, 65, 85, 0.48) 0%, rgba(30, 41, 59, 0.35) 35%, rgba(6, 182, 212, 0.12) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'cello'
  },
  campfire: {
    id: 'campfire',
    category: 'melancholy',
    badge: 'CAMPFIRE & NOCTURNE',
    name: 'Midnight Embers & Guitar',
    artist: 'Crackling Fireplace & Acoustic Guitar',
    emoji: '🌲',
    accentColor: '#d97706',
    aura: 'radial-gradient(circle at 40% 30%, rgba(180, 83, 9, 0.42) 0%, rgba(120, 53, 15, 0.3) 35%, rgba(30, 27, 75, 0.2) 60%, rgba(7, 9, 14, 0.98) 85%)',
    synthType: 'campfire'
  }
};

// =============================================================================
// Custom 4-Quadrant Assignment System
// =============================================================================
const DEFAULT_ASSIGNMENTS = {
  tl: 'cyber',       // Top-Left (High Arousal, Low Valence)
  tr: 'chillhop',    // Top-Right (High Arousal, High Valence)
  bl: 'rain_piano',  // Bottom-Left (Low Arousal, Low Valence)
  br: 'zen'          // Bottom-Right (Low Arousal, High Valence)
};

const PRESETS = {
  studio: { tl: 'cyber', tr: 'chillhop', bl: 'rain_piano', br: 'zen' },
  lofi: { tl: 'codeflow', tr: 'sunrise', bl: 'campfire', br: 'ocean' },
  nature: { tl: 'space', tr: 'sunrise', bl: 'rain_piano', br: 'meditation' },
  cyber: { tl: 'cyber', tr: 'chiptune', bl: 'cello', br: 'zen' }
};

let userQuadrantAssignments = { ...DEFAULT_ASSIGNMENTS };

try {
  const saved = localStorage.getItem('moodtrace_user_quadrants');
  if (saved) {
    userQuadrantAssignments = { ...DEFAULT_ASSIGNMENTS, ...JSON.parse(saved) };
  }
} catch (_) {}

let currentActiveTrackId = userQuadrantAssignments.br;
let isAudioPlaying = false;
let autoMoodSync = true;
let isTrackingActive = true;

// -----------------------------------------------------------------------------
// Smooth Physics Interpolation (Lerp Target & Display Variables)
// -----------------------------------------------------------------------------
let targetValence = 0.6;
let targetArousal = -0.4;
let displayValence = 0.6;
let displayArousal = -0.4;

let targetSpeed = 0.0;
let targetAccel = 0.0;
let targetClicks = 0.0;
let displaySpeed = 0.0;
let displayAccel = 0.0;
let displayClicks = 0.0;

let masterVolume = 0.75;

// -----------------------------------------------------------------------------
// DOM References
// -----------------------------------------------------------------------------
const dynamicAura = document.getElementById('dynamic-aura');
const harmonicOrb = document.getElementById('harmonic-orb');
const valValence = document.getElementById('val-valence');
const valArousal = document.getElementById('val-arousal');
const vibeBadgeTitle = document.getElementById('vibe-badge-title');
const vibeBadgeIcon = document.getElementById('vibe-badge-icon');

const vinylDisc = document.getElementById('vinyl-disc');
const nowPlayingGenre = document.getElementById('now-playing-genre');
const nowPlayingTitle = document.getElementById('now-playing-title');
const nowPlayingArtist = document.getElementById('now-playing-artist');
const svgPlayIcon = document.getElementById('svg-play-icon');
const svgPauseIcon = document.getElementById('svg-pause-icon');
const sliderVolume = document.getElementById('slider-volume');
const chkStudioSync = document.getElementById('chk-studio-sync');

const barFillSpeed = document.getElementById('bar-fill-speed');
const meterValSpeed = document.getElementById('meter-val-speed');
const barFillAccel = document.getElementById('bar-fill-accel');
const meterValAccel = document.getElementById('meter-val-accel');
const barFillClicks = document.getElementById('bar-fill-clicks');
const meterValClicks = document.getElementById('meter-val-clicks');

const statusLivePill = document.getElementById('status-live-pill');
const statusLiveText = document.getElementById('status-live-text');
const btnPauseTracking = document.getElementById('btn-pause-tracking');
const btnTrackIcon = document.getElementById('btn-track-icon');
const btnTrackText = document.getElementById('btn-track-text');

// Quadrant labels on Harmonic Matrix
const lblTlTitle = document.getElementById('lbl-tl-title');
const lblTlDesc = document.getElementById('lbl-tl-desc');
const lblTrTitle = document.getElementById('lbl-tr-title');
const lblTrDesc = document.getElementById('lbl-tr-desc');
const lblBlTitle = document.getElementById('lbl-bl-title');
const lblBlDesc = document.getElementById('lbl-bl-desc');
const lblBrTitle = document.getElementById('lbl-br-title');
const lblBrDesc = document.getElementById('lbl-br-desc');

// Modal Elements
const modalCustomizer = document.getElementById('modal-quadrant-customizer');
const btnOpenCustomizer = document.getElementById('btn-open-quadrant-customizer');
const btnCloseCustomizer = document.getElementById('btn-close-customizer');
const btnCancelCustomizer = document.getElementById('btn-cancel-customizer');
const btnApplyCustomizer = document.getElementById('btn-apply-custom-quadrants');
const selQuadTl = document.getElementById('sel-quad-tl');
const selQuadTr = document.getElementById('sel-quad-tr');
const selQuadBl = document.getElementById('sel-quad-bl');
const selQuadBr = document.getElementById('sel-quad-br');

// -----------------------------------------------------------------------------
// Update Quadrant Display Cards on Harmonic Matrix
// -----------------------------------------------------------------------------
function refreshMatrixQuadrantDisplays() {
  const mTl = MOOD_LIBRARY[userQuadrantAssignments.tl] || MOOD_LIBRARY.cyber;
  const mTr = MOOD_LIBRARY[userQuadrantAssignments.tr] || MOOD_LIBRARY.chillhop;
  const mBl = MOOD_LIBRARY[userQuadrantAssignments.bl] || MOOD_LIBRARY.rain_piano;
  const mBr = MOOD_LIBRARY[userQuadrantAssignments.br] || MOOD_LIBRARY.zen;

  if (lblTlTitle) lblTlTitle.textContent = `${mTl.emoji} ${mTl.name}`;
  if (lblTlDesc) lblTlDesc.textContent = `${mTl.badge} • ${mTl.artist}`;

  if (lblTrTitle) lblTrTitle.textContent = `${mTr.emoji} ${mTr.name}`;
  if (lblTrDesc) lblTrDesc.textContent = `${mTr.badge} • ${mTr.artist}`;

  if (lblBlTitle) lblBlTitle.textContent = `${mBl.emoji} ${mBl.name}`;
  if (lblBlDesc) lblBlDesc.textContent = `${mBl.badge} • ${mBl.artist}`;

  if (lblBrTitle) lblBrTitle.textContent = `${mBr.emoji} ${mBr.name}`;
  if (lblBrDesc) lblBrDesc.textContent = `${mBr.badge} • ${mBr.artist}`;
}

// -----------------------------------------------------------------------------
// Modal & Customizer Logic
// -----------------------------------------------------------------------------
function populateCustomizerDropdowns() {
  const populate = (selectElem, selectedKey) => {
    selectElem.innerHTML = '';
    Object.values(MOOD_LIBRARY).forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.emoji} ${m.name} (${m.badge})`;
      if (m.id === selectedKey) opt.selected = true;
      selectElem.appendChild(opt);
    });
  };

  populate(selQuadTl, userQuadrantAssignments.tl);
  populate(selQuadTr, userQuadrantAssignments.tr);
  populate(selQuadBl, userQuadrantAssignments.bl);
  populate(selQuadBr, userQuadrantAssignments.br);
}

btnOpenCustomizer?.addEventListener('click', () => {
  populateCustomizerDropdowns();
  modalCustomizer.classList.add('open');
});

btnCloseCustomizer?.addEventListener('click', () => {
  modalCustomizer.classList.remove('open');
});
btnCancelCustomizer?.addEventListener('click', () => {
  modalCustomizer.classList.remove('open');
});

// Apply Custom 4 Moods
btnApplyCustomizer?.addEventListener('click', () => {
  userQuadrantAssignments = {
    tl: selQuadTl.value,
    tr: selQuadTr.value,
    bl: selQuadBl.value,
    br: selQuadBr.value
  };

  try {
    localStorage.setItem('moodtrace_user_quadrants', JSON.stringify(userQuadrantAssignments));
  } catch (_) {}

  refreshMatrixQuadrantDisplays();
  modalCustomizer.classList.remove('open');

  const activeQuad = determineTargetQuadrantKey(targetValence, targetArousal);
  const targetTrackId = userQuadrantAssignments[activeQuad];
  activateMoodTrack(targetTrackId, isAudioPlaying);
});

// Preset Buttons inside Modal
document.querySelectorAll('.btn-preset-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    const pKey = btn.dataset.preset;
    if (PRESETS[pKey]) {
      const p = PRESETS[pKey];
      selQuadTl.value = p.tl;
      selQuadTr.value = p.tr;
      selQuadBl.value = p.bl;
      selQuadBr.value = p.br;
    }
  });
});

// -----------------------------------------------------------------------------
// Sound Library Grid Render & Filter (12 Albums)
// -----------------------------------------------------------------------------
function renderLibraryGrid(filter = 'all') {
  const grid = document.getElementById('full-library-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.values(MOOD_LIBRARY).forEach((m) => {
    if (filter !== 'all' && m.category !== filter) return;

    const card = document.createElement('div');
    card.className = `album-station-card ${m.id === currentActiveTrackId ? 'active' : ''}`;
    card.dataset.station = m.id;

    card.innerHTML = `
      <div class="album-art-box" style="background: ${m.accentColor}22; border: 1px solid ${m.accentColor}44;">
        <span class="album-emoji">${m.emoji}</span>
      </div>
      <div class="album-info">
        <span class="album-badge" style="color: ${m.accentColor};">${m.badge}</span>
        <h4>${m.name}</h4>
        <p>${m.artist}</p>
      </div>
      <button class="btn-play-station" data-track="${m.id}">▶ Play</button>
    `;

    card.addEventListener('click', () => {
      activateMoodTrack(m.id, true);
    });

    const playBtn = card.querySelector('.btn-play-station');
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      activateMoodTrack(m.id, true);
    });

    grid.appendChild(card);
  });
}

document.querySelectorAll('.filter-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderLibraryGrid(btn.dataset.filter);
  });
});

// -----------------------------------------------------------------------------
// Navigation Tabs
// -----------------------------------------------------------------------------
document.querySelectorAll('.dock-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dock-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach((v) => v.classList.remove('active'));

    btn.classList.add('active');
    const targetView = document.getElementById(btn.dataset.tab);
    if (targetView) targetView.classList.add('active');

    if (btn.dataset.tab === 'tab-stations') {
      renderLibraryGrid();
    }
    if (btn.dataset.tab === 'tab-config') {
      loadTelemetryCounters();
    }
  });
});

// -----------------------------------------------------------------------------
// Window Actions (Tray & Terminate)
// -----------------------------------------------------------------------------
document.getElementById('btn-minimize-to-tray')?.addEventListener('click', () => {
  invoke('hide_to_tray').catch(console.error);
});
document.getElementById('btn-dock-to-tray')?.addEventListener('click', () => {
  invoke('hide_to_tray').catch(console.error);
});
document.getElementById('btn-open-self-report')?.addEventListener('click', () => {
  invoke('trigger_affect_grid').catch(console.error);
});
document.getElementById('btn-terminate-app')?.addEventListener('click', () => {
  invoke('quit_app').catch(console.error);
});

// -----------------------------------------------------------------------------
// Tracking Toggle
// -----------------------------------------------------------------------------
btnPauseTracking?.addEventListener('click', async () => {
  try {
    const newState = !isTrackingActive;
    await invoke('set_tracking', { enabled: newState });
    isTrackingActive = newState;
    applyTrackingState(newState);
  } catch (err) {
    console.error('Failed to set tracking state:', err);
  }
});

function applyTrackingState(active) {
  if (active) {
    statusLivePill.className = 'live-pill active';
    statusLiveText.textContent = 'MONITORING';
    btnTrackIcon.textContent = '⏸';
    btnTrackText.textContent = 'Pause Sensor';
  } else {
    statusLivePill.className = 'live-pill paused';
    statusLiveText.textContent = 'PAUSED';
    btnTrackIcon.textContent = '▶';
    btnTrackText.textContent = 'Resume Sensor';
  }
}

// =============================================================================
// Physical Acoustic & Musical Modeling Engine
// =============================================================================
let audioCtx = null;
let activeNodes = [];
let synthGainNode = null;
let playbackLoopTimer = null;

async function ensureAudioContextRunning() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

['click', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, () => {
    ensureAudioContextRunning();
  }, { once: false });
});

function stopAllProceduralAudio() {
  if (playbackLoopTimer) {
    clearInterval(playbackLoopTimer);
    playbackLoopTimer = null;
  }
  activeNodes.forEach((node) => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (_) {}
  });
  activeNodes = [];
}

// Noise Generator for Nature Ambience
function createNoiseBuffer(ctx, type = 'pink') {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    } else if (type === 'crackling') {
      data[i] = (Math.random() > 0.995 ? (Math.random() * 0.7 - 0.35) : (white * 0.012));
    } else {
      data[i] = white * 0.04;
    }
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// -----------------------------------------------------------------------------
// Realistic Physical Acoustic Instruments
// -----------------------------------------------------------------------------

// 1. Acoustic Grand Piano Note (Multi-Harmonic String Struck Physics)
function playAcousticPianoNote(ctx, freq, duration, targetNode, velocity = 0.12) {
  const harmonics = [1.0, 2.01, 3.02, 4.04];
  const weights = [1.0, 0.45, 0.20, 0.08];

  harmonics.forEach((h, idx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = freq * h;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, ctx.currentTime);

    // Struck hammer strike + exponential string decay
    const peakGain = velocity * weights[idx];
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(g);
    g.connect(targetNode);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    activeNodes.push(osc, g);
  });
}

// 2. Plucked Acoustic Guitar / Harp Note (Karplus-Strong Pluck Resonance)
function playPluckedGuitarNote(ctx, freq, duration, targetNode, gainLevel = 0.1) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const noteGain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  // Dynamic lowpass string damping
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 5.0, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(freq * 0.8, ctx.currentTime + duration * 0.8);

  noteGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  noteGain.gain.linearRampToValueAtTime(gainLevel, ctx.currentTime + 0.005);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(targetNode);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
  activeNodes.push(osc, filter, noteGain);
}

// 3. Formant Bowed Cello Note (Multi-Formant Wooden Body Resonance)
function playBowedCelloNote(ctx, freq, duration, targetNode, gainLevel = 0.09) {
  const osc = ctx.createOscillator();
  const bodyFilter = ctx.createBiquadFilter();
  const noteGain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  // Natural cello pitch vibrato
  const vibrato = ctx.createOscillator();
  const vibGain = ctx.createGain();
  vibrato.frequency.setValueAtTime(5.2, ctx.currentTime);
  vibGain.gain.setValueAtTime(freq * 0.015, ctx.currentTime);
  vibrato.connect(vibGain);
  vibGain.connect(osc.frequency);
  vibrato.start();
  activeNodes.push(vibrato, vibGain);

  // Cello wooden body formant resonance
  bodyFilter.type = 'bandpass';
  bodyFilter.frequency.setValueAtTime(520, ctx.currentTime);
  bodyFilter.Q.setValueAtTime(2.5, ctx.currentTime);

  noteGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  noteGain.gain.linearRampToValueAtTime(gainLevel, ctx.currentTime + 0.8);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(bodyFilter);
  bodyFilter.connect(noteGain);
  noteGain.connect(targetNode);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
  activeNodes.push(osc, bodyFilter, noteGain);
}

// 4. Lo-Fi Hip Hop Drum Beats (Sub-Kick & Snare)
function playLofiDrumHit(ctx, isSnare, targetNode) {
  if (isSnare) {
    const noise = createNoiseBuffer(ctx, 'white');
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

    noise.connect(filter);
    filter.connect(g);
    g.connect(targetNode);
    noise.start();
    noise.stop(ctx.currentTime + 0.18);
    activeNodes.push(noise, filter, g);
  } else {
    // Warm sub kick
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.15);

    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

    osc.connect(g);
    g.connect(targetNode);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    activeNodes.push(osc, g);
  }
}

// -----------------------------------------------------------------------------
// Launch Dedicated Musical Soundscape
// -----------------------------------------------------------------------------
async function launchMoodSynthesizer(synthType) {
  await ensureAudioContextRunning();
  stopAllProceduralAudio();

  synthGainNode = audioCtx.createGain();
  synthGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  synthGainNode.connect(audioCtx.destination);

  switch (synthType) {
    // ---------------------------------------------------------
    // 1. ZEN: Authentic Grand Piano & Nature Breeze
    // ---------------------------------------------------------
    case 'zen': {
      const zenChords = [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7
        [220.00, 261.63, 329.63, 440.00], // Am7
        [174.61, 261.63, 329.63, 392.00], // Fmaj7
        [196.00, 246.94, 293.66, 392.00]  // G6
      ];
      let step = 0;
      const playZen = () => {
        if (!isAudioPlaying) return;
        zenChords[step].forEach((f, idx) => {
          setTimeout(() => {
            playAcousticPianoNote(audioCtx, f, 4.5, synthGainNode, 0.09);
          }, idx * 140);
        });
        step = (step + 1) % zenChords.length;
      };
      playZen();
      playbackLoopTimer = setInterval(playZen, 4200);
      break;
    }

    // ---------------------------------------------------------
    // 2. OCEAN: Coastal Surf Wash & Plucked Harp
    // ---------------------------------------------------------
    case 'ocean': {
      const noise = createNoiseBuffer(audioCtx, 'pink');
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, audioCtx.currentTime);

      const surfGain = audioCtx.createGain();
      surfGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      noise.connect(filter);
      filter.connect(surfGain);
      surfGain.connect(synthGainNode);
      noise.start();
      activeNodes.push(noise, filter, surfGain);

      const harpNotes = [293.66, 369.99, 440.00, 554.37, 587.33, 739.99];
      let harpIdx = 0;
      const playHarp = () => {
        if (!isAudioPlaying) return;
        filter.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 1.8);
        filter.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 4.2);

        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            const f = harpNotes[(harpIdx + i) % harpNotes.length];
            playPluckedGuitarNote(audioCtx, f, 3.2, synthGainNode, 0.08);
          }, i * 220);
        }
        harpIdx = (harpIdx + 2) % harpNotes.length;
      };
      playHarp();
      playbackLoopTimer = setInterval(playHarp, 4400);
      break;
    }

    // ---------------------------------------------------------
    // 3. MEDITATION: 432Hz Tibetan Singing Bowls & OM Drone
    // ---------------------------------------------------------
    case 'meditation': {
      const freqs = [108.0, 216.0, 432.0, 864.0];
      freqs.forEach((f, idx) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(0.06 / (idx + 1), audioCtx.currentTime);

        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.setValueAtTime(0.12 + idx * 0.04, audioCtx.currentTime);
        lfoGain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);
        lfo.start();
        activeNodes.push(lfo, lfoGain);

        osc.connect(g);
        g.connect(synthGainNode);
        osc.start();
        activeNodes.push(osc, g);
      });

      const triggerBowl = () => {
        if (!isAudioPlaying) return;
        playAcousticPianoNote(audioCtx, 576.0, 7.0, synthGainNode, 0.08);
      };
      triggerBowl();
      playbackLoopTimer = setInterval(triggerBowl, 7500);
      break;
    }

    // ---------------------------------------------------------
    // 4. CHILLHOP: Genuine Lo-Fi Beats & Jazzy Rhodes Chords
    // ---------------------------------------------------------
    case 'chillhop': {
      const chillChords = [
        [311.13, 392.00, 466.16, 587.33], // Ebmaj9
        [261.63, 311.13, 392.00, 466.16], // Cm7
        [207.65, 261.63, 311.13, 392.00], // Abmaj7
        [233.08, 293.66, 349.23, 440.00]  // Bb9
      ];
      let beat = 0;
      const playChillhop = () => {
        if (!isAudioPlaying) return;
        const chordIdx = Math.floor(beat / 4) % chillChords.length;

        // Rhodes chord on beat 0
        if (beat % 4 === 0) {
          chillChords[chordIdx].forEach((f) => {
            playAcousticPianoNote(audioCtx, f, 2.2, synthGainNode, 0.07);
          });
        }

        // Lo-fi Kick on beats 0 & 2, Snare on beats 1 & 3
        if (beat % 2 === 0) {
          playLofiDrumHit(audioCtx, false, synthGainNode);
        } else {
          playLofiDrumHit(audioCtx, true, synthGainNode);
        }

        beat = (beat + 1) % 16;
      };
      playChillhop();
      playbackLoopTimer = setInterval(playChillhop, 620);
      break;
    }

    // ---------------------------------------------------------
    // 5. SUNRISE: Plucked Acoustic Guitar Melodies
    // ---------------------------------------------------------
    case 'sunrise': {
      const guitarProgression = [
        [196.00, 246.94, 293.66, 392.00], // G
        [185.00, 246.94, 293.66, 369.99], // D/F#
        [164.81, 246.94, 329.63, 392.00], // Em7
        [130.81, 261.63, 329.63, 392.00]  // Cadd9
      ];
      let bar = 0;
      const playSunrise = () => {
        if (!isAudioPlaying) return;
        const chord = guitarProgression[bar];
        chord.forEach((note, idx) => {
          setTimeout(() => {
            playPluckedGuitarNote(audioCtx, note, 1.8, synthGainNode, 0.09);
          }, idx * 160);
        });
        bar = (bar + 1) % guitarProgression.length;
      };
      playSunrise();
      playbackLoopTimer = setInterval(playSunrise, 2200);
      break;
    }

    // ---------------------------------------------------------
    // 6. CHIPTUNE: 8-Bit Arcade Fast Pixel Lead
    // ---------------------------------------------------------
    case 'chiptune': {
      const chipNotes = [
        261.63, 329.63, 392.00, 523.25,
        196.00, 246.94, 293.66, 392.00,
        220.00, 261.63, 329.63, 440.00,
        174.61, 220.00, 261.63, 349.23
      ];
      let step = 0;
      const playChip = () => {
        if (!isAudioPlaying) return;
        const f = chipNotes[step];
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(0.04, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
        osc.connect(g);
        g.connect(synthGainNode);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        activeNodes.push(osc, g);
        step = (step + 1) % chipNotes.length;
      };
      playChip();
      playbackLoopTimer = setInterval(playChip, 180);
      break;
    }

    // ---------------------------------------------------------
    // 7. CYBER: Heavy Synthwave Analog Bassline
    // ---------------------------------------------------------
    case 'cyber': {
      const cyberBass = [110.0, 110.0, 130.81, 146.83, 98.0, 110.0];
      let step = 0;
      const playCyber = () => {
        if (!isAudioPlaying) return;
        const f = cyberBass[step];
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const g = audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(f, audioCtx.currentTime);
        osc2.frequency.setValueAtTime(f * 1.006, audioCtx.currentTime); // Analog detune

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.6);
        filter.Q.setValueAtTime(4.0, audioCtx.currentTime);

        g.gain.setValueAtTime(0.12, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.65);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(g);
        g.connect(synthGainNode);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.65);
        osc2.stop(audioCtx.currentTime + 0.65);
        activeNodes.push(osc1, osc2, filter, g);

        step = (step + 1) % cyberBass.length;
      };
      playCyber();
      playbackLoopTimer = setInterval(playCyber, 680);
      break;
    }

    // ---------------------------------------------------------
    // 8. CODEFLOW: Hyperfocus Minimal Techno Cadence
    // ---------------------------------------------------------
    case 'codeflow': {
      let beat = 0;
      const playTechno = () => {
        if (!isAudioPlaying) return;
        // Deep sub kick on every quarter beat
        playLofiDrumHit(audioCtx, false, synthGainNode);

        // Crisp 16th-note closed hi-hat
        setTimeout(() => {
          playLofiDrumHit(audioCtx, true, synthGainNode);
        }, 220);

        beat++;
      };
      playTechno();
      playbackLoopTimer = setInterval(playTechno, 440);
      break;
    }

    // ---------------------------------------------------------
    // 9. SPACE: Zero-G Astral Atmospheric Synth Pads
    // ---------------------------------------------------------
    case 'space': {
      const spaceChords = [
        [130.81, 196.00, 277.18, 329.63, 493.88], // Cmaj7#11
        [103.83, 155.56, 207.65, 311.13, 415.30], // Abmaj9
        [155.56, 233.08, 311.13, 349.23, 466.16]  // Ebmaj7
      ];
      let step = 0;
      const playSpace = () => {
        if (!isAudioPlaying) return;
        spaceChords[step].forEach((f) => {
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, audioCtx.currentTime);
          g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
          g.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 1.8);
          g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 6.0);
          osc.connect(g);
          g.connect(synthGainNode);
          osc.start();
          osc.stop(audioCtx.currentTime + 6.0);
          activeNodes.push(osc, g);
        });
        step = (step + 1) % spaceChords.length;
      };
      playSpace();
      playbackLoopTimer = setInterval(playSpace, 5500);
      break;
    }

    // ---------------------------------------------------------
    // 10. RAIN PIANO: Real Rainfall & Contemplative Grand Piano
    // ---------------------------------------------------------
    case 'rain_piano': {
      const rain = createNoiseBuffer(audioCtx, 'pink');
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, audioCtx.currentTime);

      const rainG = audioCtx.createGain();
      rainG.gain.setValueAtTime(0.18, audioCtx.currentTime);
      rain.connect(filter);
      filter.connect(rainG);
      rainG.connect(synthGainNode);
      rain.start();
      activeNodes.push(rain, filter, rainG);

      const minorPianoChords = [
        [146.83, 220.00, 261.63, 329.63], // Dmin9
        [116.54, 174.61, 233.08, 293.66], // Bbmaj7
        [98.00, 146.83, 196.00, 261.63],  // Gmin11
        [130.81, 196.00, 261.63, 329.63]  // Cadd9
      ];
      let step = 0;
      const playRainPiano = () => {
        if (!isAudioPlaying) return;
        minorPianoChords[step].forEach((f, idx) => {
          setTimeout(() => {
            playAcousticPianoNote(audioCtx, f, 4.8, synthGainNode, 0.095);
          }, idx * 120);
        });
        step = (step + 1) % minorPianoChords.length;
      };
      playRainPiano();
      playbackLoopTimer = setInterval(playRainPiano, 4400);
      break;
    }

    // ---------------------------------------------------------
    // 11. CELLO: Formant Bowed Strings & Rain Droplets
    // ---------------------------------------------------------
    case 'cello': {
      const celloChords = [
        [110.00, 164.81, 220.00], // Am
        [87.31, 130.81, 174.61],  // F
        [73.42, 110.00, 146.83],  // Dm
        [82.41, 123.47, 164.81]   // E7
      ];
      let step = 0;
      const playCello = () => {
        if (!isAudioPlaying) return;
        celloChords[step].forEach((f) => {
          playBowedCelloNote(audioCtx, f, 4.2, synthGainNode, 0.085);
        });
        step = (step + 1) % celloChords.length;
      };
      playCello();
      playbackLoopTimer = setInterval(playCello, 4200);
      break;
    }

    // ---------------------------------------------------------
    // 12. CAMPFIRE: Crackling Embers & Fingerpicked Guitar
    // ---------------------------------------------------------
    case 'campfire': {
      const crackle = createNoiseBuffer(audioCtx, 'crackling');
      const crackleG = audioCtx.createGain();
      crackleG.gain.setValueAtTime(0.22, audioCtx.currentTime);
      crackle.connect(crackleG);
      crackleG.connect(synthGainNode);
      crackle.start();
      activeNodes.push(crackle, crackleG);

      const campfireChords = [
        [164.81, 246.94, 329.63, 392.00], // Em
        [130.81, 261.63, 329.63, 392.00], // Cmaj7
        [110.00, 220.00, 261.63, 329.63], // Am7
        [123.47, 246.94, 293.66, 369.99]  // B7
      ];
      let bar = 0;
      const playCampfire = () => {
        if (!isAudioPlaying) return;
        const notes = campfireChords[bar];
        notes.forEach((f, idx) => {
          setTimeout(() => {
            playPluckedGuitarNote(audioCtx, f, 2.4, synthGainNode, 0.085);
          }, idx * 150);
        });
        bar = (bar + 1) % campfireChords.length;
      };
      playCampfire();
      playbackLoopTimer = setInterval(playCampfire, 3200);
      break;
    }
  }
}

// -----------------------------------------------------------------------------
// Playback & Track Switcher Handler
// -----------------------------------------------------------------------------
function activateMoodTrack(trackId, startPlaying = false) {
  const m = MOOD_LIBRARY[trackId] || MOOD_LIBRARY.zen;
  currentActiveTrackId = trackId;

  // Update theme colors & aura
  document.documentElement.style.setProperty('--current-accent', m.accentColor);
  document.documentElement.style.setProperty('--current-glow', `${m.accentColor}44`);
  if (dynamicAura) {
    dynamicAura.style.background = m.aura;
  }

  // Update hero vinyl meta
  nowPlayingGenre.textContent = m.badge;
  nowPlayingTitle.textContent = m.name;
  nowPlayingArtist.textContent = m.artist;
  vibeBadgeIcon.textContent = m.emoji;
  vibeBadgeTitle.textContent = m.badge.replace('&', '•');

  // Highlight active cards in library grid
  document.querySelectorAll('.album-station-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.station === trackId);
  });

  if (startPlaying || isAudioPlaying) {
    isAudioPlaying = true;
    setPlaybackState(true);
    launchMoodSynthesizer(m.synthType);
  }
}

function setPlaybackState(playing) {
  isAudioPlaying = playing;
  if (playing) {
    svgPlayIcon.style.display = 'none';
    svgPauseIcon.style.display = 'block';
    vinylDisc.classList.add('spinning');
  } else {
    svgPlayIcon.style.display = 'block';
    svgPauseIcon.style.display = 'none';
    vinylDisc.classList.remove('spinning');
    stopAllProceduralAudio();
  }
}

document.getElementById('btn-audio-toggle')?.addEventListener('click', async () => {
  await ensureAudioContextRunning();
  if (isAudioPlaying) {
    setPlaybackState(false);
  } else {
    activateMoodTrack(currentActiveTrackId, true);
  }
});

sliderVolume?.addEventListener('input', (e) => {
  masterVolume = parseFloat(e.target.value) / 100;
  if (synthGainNode && audioCtx) {
    synthGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  }
});

chkStudioSync?.addEventListener('change', (e) => {
  autoMoodSync = e.target.checked;
});

// -----------------------------------------------------------------------------
// Live Affect & 4-Quadrant Dynamic Routing
// -----------------------------------------------------------------------------
function determineTargetQuadrantKey(valence, arousal) {
  if (arousal >= 0 && valence >= 0) return 'tr'; // Top-Right
  if (arousal >= 0 && valence < 0) return 'tl'; // Top-Left
  if (arousal < 0 && valence < 0) return 'bl';  // Bottom-Left
  return 'br';                                  // Bottom-Right
}

async function syncLiveStudioState() {
  try {
    const state = await invoke('get_current_state');
    if (!state) return;

    const { valence, arousal, tracking_enabled, mean_speed, mean_acceleration, click_rate } = state;

    isTrackingActive = tracking_enabled;
    applyTrackingState(tracking_enabled);

    // Set targets for 60fps smooth interpolation
    targetValence = valence;
    targetArousal = arousal;
    targetSpeed = mean_speed || 0;
    targetAccel = mean_acceleration || 0;
    targetClicks = click_rate || 0;

    // Dynamic auto-sync with user's configured 4 quadrants
    if (autoMoodSync) {
      const activeQuad = determineTargetQuadrantKey(targetValence, targetArousal);
      const targetTrackId = userQuadrantAssignments[activeQuad] || DEFAULT_ASSIGNMENTS[activeQuad];
      if (targetTrackId !== currentActiveTrackId) {
        activateMoodTrack(targetTrackId, isAudioPlaying);
      }
    }

  } catch (err) {
    console.error('Studio sync error:', err);
  }
}

// -----------------------------------------------------------------------------
// 60 FPS Fluid Linear Interpolation (Lerp) Render Loop
// -----------------------------------------------------------------------------
function renderFluidFrame() {
  displayValence += (targetValence - displayValence) * 0.14;
  displayArousal += (targetArousal - displayArousal) * 0.14;
  displaySpeed += (targetSpeed - displaySpeed) * 0.18;
  displayAccel += (targetAccel - displayAccel) * 0.18;
  displayClicks += (targetClicks - displayClicks) * 0.18;

  // Update 2D Plane Coordinate Orb (Valence: X, Arousal: Y)
  const xPct = ((displayValence + 1.0) / 2.0) * 100;
  const yPct = ((1.0 - (displayArousal + 1.0) / 2.0)) * 100;

  if (harmonicOrb) {
    harmonicOrb.style.left = `${Math.max(6, Math.min(94, xPct))}%`;
    harmonicOrb.style.top = `${Math.max(6, Math.min(94, yPct))}%`;
  }

  // Telemetry display values
  if (valValence) valValence.textContent = (displayValence >= 0 ? '+' : '') + displayValence.toFixed(2);
  if (valArousal) valArousal.textContent = (displayArousal >= 0 ? '+' : '') + displayArousal.toFixed(2);

  // Update DJ Mixer dynamic meters
  if (meterValSpeed) meterValSpeed.textContent = `${Math.round(displaySpeed)} px/s`;
  if (barFillSpeed) barFillSpeed.style.width = `${Math.min(100, (displaySpeed / 1200) * 100)}%`;

  if (meterValAccel) meterValAccel.textContent = `${Math.round(displayAccel)} px/s²`;
  if (barFillAccel) barFillAccel.style.width = `${Math.min(100, (displayAccel / 2400) * 100)}%`;

  if (meterValClicks) meterValClicks.textContent = `${displayClicks.toFixed(1)} /s`;
  if (barFillClicks) barFillClicks.style.width = `${Math.min(100, (displayClicks / 2.0) * 100)}%`;

  requestAnimationFrame(renderFluidFrame);
}

// -----------------------------------------------------------------------------
// Engine Settings Form
// -----------------------------------------------------------------------------
document.getElementById('btn-save-config')?.addEventListener('click', async () => {
  const inferenceSec = parseInt(document.getElementById('cfg-inference-rate').value, 10);
  const windowSec = parseInt(document.getElementById('cfg-feature-window').value, 10);
  const popupMin = parseInt(document.getElementById('cfg-popup-interval').value, 10);

  try {
    await invoke('update_settings', {
      inferenceSec,
      popupMin,
      windowSec
    });

    const btn = document.getElementById('btn-save-config');
    const oldLabel = btn.textContent;
    btn.textContent = '✓ Engine Preferences Saved';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    setTimeout(() => {
      btn.textContent = oldLabel;
      btn.style.background = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to save preferences:', err);
  }
});

async function loadTelemetryCounters() {
  try {
    const data = await invoke('get_telemetry_stats');
    if (data) {
      document.getElementById('stat-count-events').textContent = (data.raw_events_count || 0).toLocaleString();
      document.getElementById('stat-count-labels').textContent = (data.labels_count || 0).toLocaleString();
    }
  } catch (err) {
    console.error('Failed to load telemetry stats:', err);
  }
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------
refreshMatrixQuadrantDisplays();
renderLibraryGrid('all');
activateMoodTrack(currentActiveTrackId, false);
setInterval(syncLiveStudioState, 500); // 500ms high-precision sync
syncLiveStudioState();
requestAnimationFrame(renderFluidFrame); // 60 FPS fluid rendering loop

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

// -----------------------------------------------------------------------------
// Soundscape Stations Dataset (Royalty-Free Ambient Mood Streams)
// -----------------------------------------------------------------------------
const STATIONS = {
  calm: {
    id: 'calm',
    badge: 'CALM & RELAXED',
    name: 'Zen Ambient Solitude',
    artist: 'Acoustic Piano & Nature Drone',
    emoji: '🌿',
    accentColor: '#10b981',
    aura: 'radial-gradient(circle at 40% 30%, rgba(6, 95, 70, 0.38) 0%, rgba(16, 185, 129, 0.22) 35%, rgba(6, 182, 212, 0.12) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3'
  },
  upbeat: {
    id: 'upbeat',
    badge: 'HIGH ENERGY & HAPPY',
    name: 'Sunshine Chillhop Beats',
    artist: 'Vibrant Lo-Fi & Melodic Synth',
    emoji: '⚡',
    accentColor: '#f59e0b',
    aura: 'radial-gradient(circle at 40% 30%, rgba(245, 158, 11, 0.38) 0%, rgba(244, 63, 94, 0.28) 35%, rgba(139, 92, 246, 0.2) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3'
  },
  focus: {
    id: 'focus',
    badge: 'INTENSE FOCUS & FLOW',
    name: 'Cyber Synthwave Pulse',
    artist: 'Deep Driving Bassline & Beats',
    emoji: '🎧',
    accentColor: '#8b5cf6',
    aura: 'radial-gradient(circle at 40% 30%, rgba(99, 102, 241, 0.38) 0%, rgba(139, 92, 246, 0.28) 35%, rgba(6, 182, 212, 0.16) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7314a51e60.mp3?filename=chill-abstract-intention-12099.mp3'
  },
  melancholy: {
    id: 'melancholy',
    badge: 'CALM & REFLECTIVE',
    name: 'Binaural Rain & Space Drone',
    artist: 'Soft Rainfall & Atmospheric Drone',
    emoji: '🌧️',
    accentColor: '#06b6d4',
    aura: 'radial-gradient(circle at 40% 30%, rgba(30, 27, 75, 0.48) 0%, rgba(49, 46, 129, 0.32) 35%, rgba(6, 182, 212, 0.14) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=soft-rain-ambient-111154.mp3'
  }
};

let currentStation = 'calm';
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

const audioPlayer = new Audio();
audioPlayer.loop = true;
audioPlayer.volume = 0.7;

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

// -----------------------------------------------------------------------------
// Music & Ambient Audio Player Controls
// -----------------------------------------------------------------------------
function activateStation(stationKey, startPlaying = false) {
  const st = STATIONS[stationKey];
  if (!st) return;

  currentStation = stationKey;

  // Update theme colors & background aura
  document.documentElement.style.setProperty('--current-accent', st.accentColor);
  document.documentElement.style.setProperty('--current-glow', `${st.accentColor}44`);
  if (dynamicAura) {
    dynamicAura.style.background = st.aura;
  }

  // Update hero vinyl meta
  nowPlayingGenre.textContent = st.badge;
  nowPlayingTitle.textContent = st.name;
  nowPlayingArtist.textContent = st.artist;
  vibeBadgeIcon.textContent = st.emoji;
  vibeBadgeTitle.textContent = st.badge.replace('&', '•');

  // Highlight album catalog card
  document.querySelectorAll('.album-station-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.station === stationKey);
  });

  if (startPlaying || isAudioPlaying) {
    audioPlayer.src = st.url;
    audioPlayer.play().then(() => {
      setPlaybackState(true);
    }).catch((err) => {
      console.warn('Audio stream fallback triggered:', err);
      startProceduralSynthTone();
    });
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
  }
}

document.getElementById('btn-audio-toggle')?.addEventListener('click', () => {
  if (isAudioPlaying) {
    audioPlayer.pause();
    setPlaybackState(false);
  } else {
    activateStation(currentStation, true);
  }
});

sliderVolume?.addEventListener('input', (e) => {
  audioPlayer.volume = parseFloat(e.target.value) / 100;
});

chkStudioSync?.addEventListener('change', (e) => {
  autoMoodSync = e.target.checked;
});

// Stations Catalog Play Buttons
document.querySelectorAll('.btn-play-station').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const target = btn.dataset.station;
    activateStation(target, true);
  });
});

document.querySelectorAll('.album-station-card').forEach((card) => {
  card.addEventListener('click', () => {
    activateStation(card.dataset.station, true);
  });
});

// Procedural Synth Soundscape Fallback
let webAudioCtx = null;
function startProceduralSynthTone() {
  try {
    if (!webAudioCtx) {
      webAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = webAudioCtx.createOscillator();
    const gain = webAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, webAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, webAudioCtx.currentTime);
    osc.connect(gain);
    gain.connect(webAudioCtx.destination);
    osc.start();
    setPlaybackState(true);
  } catch (e) {
    console.error('Web Audio Synth error:', e);
  }
}

// -----------------------------------------------------------------------------
// Live Affect & Kinematics Sync Loop
// -----------------------------------------------------------------------------
function mapMoodToStation(valence, arousal) {
  if (arousal >= 0 && valence >= 0) return 'upbeat';
  if (arousal >= 0 && valence < 0) return 'focus';
  if (arousal < 0 && valence >= 0) return 'calm';
  return 'melancholy';
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

    // Dynamic auto-sync with station vibes
    if (autoMoodSync) {
      const targetKey = mapMoodToStation(targetValence, targetArousal);
      if (targetKey !== currentStation) {
        activateStation(targetKey, isAudioPlaying);
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
  // Smoothly glide position: 14% delta per frame
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
activateStation('calm', false);
setInterval(syncLiveStudioState, 500); // 500ms sync loop for high responsiveness
syncLiveStudioState();
requestAnimationFrame(renderFluidFrame); // 60 FPS fluid rendering loop

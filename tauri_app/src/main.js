// Moodtrace — Windows Background Dashboard & Ambient Audio Engine

let invoke = null;
if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
  invoke = window.__TAURI__.core.invoke;
} else if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
  invoke = window.__TAURI_INTERNALS__.invoke;
}

// Fallback mock invoke for pure browser preview
if (!invoke) {
  console.warn("Tauri invoke not detected. Initializing browser emulation mode.");
  invoke = async (cmd, args = {}) => {
    if (cmd === 'get_current_state') {
      return {
        arousal: -0.45,
        valence: 0.65,
        tracking_enabled: true,
        inference_interval_sec: 5,
        popup_interval_min: 10,
        window_duration_sec: 45,
        mean_speed: 342.5,
        mean_acceleration: 120.0,
        click_rate: 0.4,
        idle_ratio: 0.15,
        event_count: 850
      };
    }
    if (cmd === 'get_telemetry_stats') {
      return { raw_events_count: 724659, labels_count: 163 };
    }
    return true;
  };
}

// -----------------------------------------------------------------------------
// Ambient Sound Engine (Public streams & generative ambient fallback)
// -----------------------------------------------------------------------------
const STATIONS = {
  calm: {
    id: 'calm',
    name: '🌿 Calm & Peaceful Ambient',
    desc: 'Soothing acoustic & nature soundscape calibrated to low arousal and high valence',
    // Public Creative Commons ambient audio stream / direct MP3
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3'
  },
  upbeat: {
    id: 'upbeat',
    name: '⚡ Upbeat & Energized Chillhop',
    desc: 'Lively uplifting beats calibrated to high arousal and high valence',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3'
  },
  focus: {
    id: 'focus',
    name: '🎧 Deep Focus & Rhythm',
    desc: 'Driving steady pulse calibrated to high arousal and lower valence',
    url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7314a51e60.mp3?filename=chill-abstract-intention-12099.mp3'
  },
  melancholy: {
    id: 'melancholy',
    name: '🌧️ Rain & Ambient Drone',
    desc: 'Gentle rain and soft drone calibrated to low arousal and low valence',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=soft-rain-ambient-111154.mp3'
  }
};

let currentStation = 'calm';
let isAudioPlaying = false;
let autoMoodSync = true;
let audioPlayer = new Audio();
audioPlayer.loop = true;
audioPlayer.volume = 0.7;

// -----------------------------------------------------------------------------
// UI State & DOM References
// -----------------------------------------------------------------------------
let isTrackingActive = true;
let currentArousal = -0.4;
let currentValence = 0.6;

// Elements
const affectDot = document.getElementById('affect-dot');
const primaryMoodText = document.getElementById('primary-mood-text');
const coordinatesReadout = document.getElementById('coordinates-readout');
const trackingBadge = document.getElementById('tracking-badge');
const headerStatusDot = document.getElementById('header-status-dot');

const metricSpeed = document.getElementById('metric-speed');
const meterSpeed = document.getElementById('meter-speed');
const metricAccel = document.getElementById('metric-accel');
const meterAccel = document.getElementById('meter-accel');
const metricClicks = document.getElementById('metric-clicks');
const meterClicks = document.getElementById('meter-clicks');
const metricIdle = document.getElementById('metric-idle');
const meterIdle = document.getElementById('meter-idle');

const btnToggleTracking = document.getElementById('btn-toggle-tracking');
const btnTrackingIcon = document.getElementById('btn-tracking-icon');
const btnTrackingText = document.getElementById('btn-tracking-text');

const btnPlayPause = document.getElementById('btn-ambient-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const audioStatusLabel = document.getElementById('audio-status-label');
const audioEqualizer = document.getElementById('audio-equalizer');
const ambientVolume = document.getElementById('ambient-volume');
const chkAutoMoodSync = document.getElementById('chk-auto-mood-sync');
const ambientStationTitle = document.getElementById('ambient-station-title');
const ambientStationDesc = document.getElementById('ambient-station-desc');

// -----------------------------------------------------------------------------
// Navigation Tabs
// -----------------------------------------------------------------------------
document.querySelectorAll('.nav-tab').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

    tabBtn.classList.add('active');
    const targetPane = document.getElementById(tabBtn.dataset.tab);
    if (targetPane) targetPane.classList.add('active');

    if (tabBtn.dataset.tab === 'tab-settings') {
      loadTelemetryStats();
    }
  });
});

// -----------------------------------------------------------------------------
// Window Actions (Tray & Quit)
// -----------------------------------------------------------------------------
document.getElementById('btn-hide-tray')?.addEventListener('click', () => {
  invoke('hide_to_tray').catch(console.error);
});
document.getElementById('btn-minimize-tray')?.addEventListener('click', () => {
  invoke('hide_to_tray').catch(console.error);
});
document.getElementById('btn-quit-app')?.addEventListener('click', () => {
  invoke('quit_app').catch(console.error);
});
document.getElementById('btn-trigger-self-report')?.addEventListener('click', () => {
  invoke('trigger_affect_grid').catch(console.error);
});

// -----------------------------------------------------------------------------
// Tracking Toggle
// -----------------------------------------------------------------------------
btnToggleTracking?.addEventListener('click', async () => {
  try {
    const newState = !isTrackingActive;
    await invoke('set_tracking', { enabled: newState });
    isTrackingActive = newState;
    updateTrackingUI(newState);
  } catch (err) {
    console.error('Failed to toggle tracking:', err);
  }
});

function updateTrackingUI(active) {
  if (active) {
    trackingBadge.textContent = 'Active';
    trackingBadge.className = 'badge';
    headerStatusDot.className = 'status-indicator active';
    btnTrackingIcon.textContent = '⏸';
    btnTrackingText.textContent = 'Pause Tracking';
  } else {
    trackingBadge.textContent = 'Paused';
    trackingBadge.className = 'badge paused';
    headerStatusDot.className = 'status-indicator paused';
    btnTrackingIcon.textContent = '▶';
    btnTrackingText.textContent = 'Resume Tracking';
  }
}

// -----------------------------------------------------------------------------
// Settings Form
// -----------------------------------------------------------------------------
document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
  const inferenceSec = parseInt(document.getElementById('setting-inference-interval').value, 10);
  const windowSec = parseInt(document.getElementById('setting-window-size').value, 10);
  const popupMin = parseInt(document.getElementById('setting-popup-interval').value, 10);

  try {
    await invoke('update_settings', {
      inferenceSec,
      popupMin,
      windowSec
    });
    const saveBtn = document.getElementById('btn-save-settings');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Preferences Saved';
    saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to update settings:', err);
  }
});

async function loadTelemetryStats() {
  try {
    const stats = await invoke('get_telemetry_stats');
    if (stats) {
      document.getElementById('stats-raw-events').textContent = (stats.raw_events_count || 0).toLocaleString();
      document.getElementById('stats-labels').textContent = (stats.labels_count || 0).toLocaleString();
    }
  } catch (err) {
    console.error('Failed to load telemetry stats:', err);
  }
}

// -----------------------------------------------------------------------------
// Ambient Audio Player Logic
// -----------------------------------------------------------------------------
function selectStation(stationKey, userInitiated = false) {
  if (!STATIONS[stationKey]) return;
  currentStation = stationKey;

  // Update station card highlight
  document.querySelectorAll('.station-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.station === stationKey);
  });

  const st = STATIONS[stationKey];
  ambientStationTitle.textContent = st.name;
  ambientStationDesc.textContent = st.desc;

  if (isAudioPlaying) {
    audioPlayer.src = st.url;
    audioPlayer.play().catch((e) => console.warn('Autoplay prevented:', e));
    audioStatusLabel.textContent = `Playing: ${st.name}`;
  } else {
    audioStatusLabel.textContent = `Selected: ${st.name}`;
  }

  if (userInitiated) {
    // If user clicked manually, uncheck auto-sync temporarily or keep checked
  }
}

document.querySelectorAll('.station-card').forEach((card) => {
  card.addEventListener('click', () => {
    selectStation(card.dataset.station, true);
  });
});

chkAutoMoodSync?.addEventListener('change', (e) => {
  autoMoodSync = e.target.checked;
});

btnPlayPause?.addEventListener('click', () => {
  if (isAudioPlaying) {
    audioPlayer.pause();
    isAudioPlaying = false;
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    audioEqualizer.classList.remove('playing');
    audioStatusLabel.textContent = 'Paused';
  } else {
    audioPlayer.src = STATIONS[currentStation].url;
    audioPlayer.play().then(() => {
      isAudioPlaying = true;
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      audioEqualizer.classList.add('playing');
      audioStatusLabel.textContent = `Playing: ${STATIONS[currentStation].name}`;
    }).catch((err) => {
      console.warn('Audio playback error:', err);
      // Generate soothing synthesized procedural tone fallback if URL blocked
      startProceduralAmbientSynth();
    });
  }
});

ambientVolume?.addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value) / 100;
  audioPlayer.volume = vol;
});

// Fallback procedural Web Audio synthesizer
let synthCtx = null;
function startProceduralAmbientSynth() {
  try {
    if (!synthCtx) {
      synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = synthCtx.createOscillator();
    const gain = synthCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, synthCtx.currentTime); // A3
    gain.gain.setValueAtTime(0.05, synthCtx.currentTime);
    osc.connect(gain);
    gain.connect(synthCtx.destination);
    osc.start();
    isAudioPlaying = true;
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    audioEqualizer.classList.add('playing');
    audioStatusLabel.textContent = 'Procedural Ambient Generator Active';
  } catch (e) {
    console.error(e);
  }
}

// -----------------------------------------------------------------------------
// Live Monitoring Polling Loop
// -----------------------------------------------------------------------------
function determineMoodTitle(valence, arousal) {
  if (arousal >= 0 && valence >= 0) return '⚡ Upbeat & Energetic';
  if (arousal >= 0 && valence < 0) return '🎧 High Focus & Intense';
  if (arousal < 0 && valence >= 0) return '🌿 Calm & Relaxed';
  return '🌧️ Melancholy & Low Energy';
}

function determineTargetStation(valence, arousal) {
  if (arousal >= 0 && valence >= 0) return 'upbeat';
  if (arousal >= 0 && valence < 0) return 'focus';
  if (arousal < 0 && valence >= 0) return 'calm';
  return 'melancholy';
}

async function updateLiveState() {
  try {
    const data = await invoke('get_current_state');
    if (!data) return;

    currentArousal = data.arousal;
    currentValence = data.valence;
    isTrackingActive = data.tracking_enabled;

    updateTrackingUI(isTrackingActive);

    // Update 2D Plane Coordinate Dot (Valence = X [-1, 1], Arousal = Y [-1, 1])
    const xPct = ((currentValence + 1.0) / 2.0) * 100;
    const yPct = ((1.0 - (currentArousal + 1.0) / 2.0)) * 100;

    affectDot.style.left = `${Math.max(5, Math.min(95, xPct))}%`;
    affectDot.style.top = `${Math.max(5, Math.min(95, yPct))}%`;

    // Coordinates text
    const vStr = (currentValence >= 0 ? '+' : '') + currentValence.toFixed(2);
    const aStr = (currentArousal >= 0 ? '+' : '') + currentArousal.toFixed(2);
    coordinatesReadout.textContent = `Valence: ${vStr} • Arousal: ${aStr}`;
    primaryMoodText.textContent = determineMoodTitle(currentValence, currentArousal);

    // Auto-sync ambient music if enabled
    if (autoMoodSync) {
      const targetStation = determineTargetStation(currentValence, currentArousal);
      if (targetStation !== currentStation) {
        selectStation(targetStation, false);
      }
    }

    // Kinematics metrics
    const speed = data.mean_speed || 0;
    const accel = data.mean_acceleration || 0;
    const clicks = data.click_rate || 0;
    const idle = data.idle_ratio || 0;

    metricSpeed.textContent = `${Math.round(speed)} px/s`;
    meterSpeed.style.width = `${Math.min(100, (speed / 1500) * 100)}%`;

    metricAccel.textContent = `${Math.round(accel)} px/s²`;
    meterAccel.style.width = `${Math.min(100, (accel / 3000) * 100)}%`;

    metricClicks.textContent = `${clicks.toFixed(1)} /s`;
    meterClicks.style.width = `${Math.min(100, (clicks / 2.0) * 100)}%`;

    metricIdle.textContent = `${Math.round(idle * 100)}% idle`;
    meterIdle.style.width = `${Math.min(100, idle * 100)}%`;

  } catch (err) {
    console.error('Error fetching live state:', err);
  }
}

// Initial calls & interval loop
selectStation('calm');
setInterval(updateLiveState, 1000);
updateLiveState();

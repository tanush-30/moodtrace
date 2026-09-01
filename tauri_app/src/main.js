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
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3',
    synthType: 'calm_chords'
  },
  upbeat: {
    id: 'upbeat',
    badge: 'HIGH ENERGY & HAPPY',
    name: 'Sunshine Chillhop Beats',
    artist: 'Vibrant Lo-Fi & Melodic Synth',
    emoji: '⚡',
    accentColor: '#f59e0b',
    aura: 'radial-gradient(circle at 40% 30%, rgba(245, 158, 11, 0.38) 0%, rgba(244, 63, 94, 0.28) 35%, rgba(139, 92, 246, 0.2) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3',
    synthType: 'upbeat_pulse'
  },
  focus: {
    id: 'focus',
    badge: 'INTENSE FOCUS & FLOW',
    name: 'Cyber Synthwave Pulse',
    artist: 'Deep Driving Bassline & Beats',
    emoji: '🎧',
    accentColor: '#8b5cf6',
    aura: 'radial-gradient(circle at 40% 30%, rgba(99, 102, 241, 0.38) 0%, rgba(139, 92, 246, 0.28) 35%, rgba(6, 182, 212, 0.16) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7314a51e60.mp3?filename=chill-abstract-intention-12099.mp3',
    synthType: 'focus_bass'
  },
  melancholy: {
    id: 'melancholy',
    badge: 'CALM & REFLECTIVE',
    name: 'Midnight Rain & Reflective Piano',
    artist: 'Contemplative Piano & Soft Rainfall',
    emoji: '🌧️',
    accentColor: '#06b6d4',
    aura: 'radial-gradient(circle at 40% 30%, rgba(30, 27, 75, 0.48) 0%, rgba(49, 46, 129, 0.32) 35%, rgba(6, 182, 212, 0.14) 60%, rgba(7, 9, 14, 0.98) 85%)',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=piano-moment-11035.mp3',
    synthType: 'rain_piano'
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

let masterVolume = 0.7;
const audioPlayer = new Audio();
audioPlayer.loop = true;
audioPlayer.volume = masterVolume;

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
// Web Audio Ambient Multi-Layer Soundscape Synthesizer
// -----------------------------------------------------------------------------
let audioCtx = null;
let activeNodes = [];
let rainBufferNode = null;
let synthGainNode = null;
let chordIntervalTimer = null;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function stopProceduralSoundscape() {
  if (chordIntervalTimer) {
    clearInterval(chordIntervalTimer);
    chordIntervalTimer = null;
  }
  activeNodes.forEach((node) => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (_) {}
  });
  activeNodes = [];
}

// Generates an authentic, soft, pink-noise nocturnal rain soundscape
function createRainNoiseNode(ctx, masterGain) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
    b6 = white * 0.115926;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  // Rain lowpass filter (soothing mellow patter)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, ctx.currentTime);

  const rainGain = ctx.createGain();
  rainGain.gain.setValueAtTime(0.18, ctx.currentTime);

  noise.connect(filter);
  filter.connect(rainGain);
  rainGain.connect(masterGain);

  noise.start();
  activeNodes.push(noise, filter, rainGain);
}

// Plays a gentle, reflective piano / acoustic harmonic chord progression
function playHarmonicPad(ctx, freqs, duration, masterGain, waveType = 'sine', gainLevel = 0.06) {
  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Soft attack and lingering release
    noteGain.gain.setValueAtTime(0.001, ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(gainLevel, ctx.currentTime + 1.2);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    activeNodes.push(osc, noteGain);
  });
}

function startProceduralStation(stationType) {
  initAudioContext();
  stopProceduralSoundscape();

  synthGainNode = audioCtx.createGain();
  synthGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  synthGainNode.connect(audioCtx.destination);

  if (stationType === 'rain_piano') {
    // 1. Soft nocturnal rainfall
    createRainNoiseNode(audioCtx, synthGainNode);

    // 2. Contemplative Reflective Piano Chord Progressions (D min 9, Bb maj 7, G min 9, F maj 7)
    const reflectiveChords = [
      [146.83, 220.00, 261.63, 329.63, 440.00], // D3, A3, C4, E4, A4 (Dmin9)
      [116.54, 174.61, 233.08, 293.66, 349.23], // Bb2, F3, Bb3, D4, F4 (Bbmaj7)
      [98.00, 146.83, 196.00, 261.63, 349.23],  // G2, D3, G3, C4, F4 (Gmin11)
      [130.81, 196.00, 261.63, 329.63, 392.00]  // C3, G3, C4, E4, G4 (Cadd9)
    ];

    let chordIdx = 0;
    const triggerChord = () => {
      if (!isAudioPlaying) return;
      playHarmonicPad(audioCtx, reflectiveChords[chordIdx], 5.5, synthGainNode, 'sine', 0.05);
      chordIdx = (chordIdx + 1) % reflectiveChords.length;
    };

    triggerChord();
    chordIntervalTimer = setInterval(triggerChord, 4800);

  } else if (stationType === 'calm_chords') {
    // Warm Rhodes Zen Progressions (Cmaj9, Am9, Fmaj9, G6)
    const zenChords = [
      [130.81, 196.00, 246.94, 293.66, 392.00], // Cmaj9
      [110.00, 164.81, 220.00, 261.63, 329.63], // Am9
      [87.31, 130.81, 174.61, 220.00, 261.63],  // Fmaj9
      [98.00, 146.83, 196.00, 246.94, 293.66]   // G6
    ];
    let chordIdx = 0;
    const triggerZen = () => {
      if (!isAudioPlaying) return;
      playHarmonicPad(audioCtx, zenChords[chordIdx], 6.0, synthGainNode, 'triangle', 0.045);
      chordIdx = (chordIdx + 1) % zenChords.length;
    };
    triggerZen();
    chordIntervalTimer = setInterval(triggerZen, 5200);

  } else if (stationType === 'upbeat_pulse') {
    // Upbeat Lo-Fi Chillhop Chords (Ebmaj9, Cm7, Abmaj7, Bb9)
    const upbeatChords = [
      [155.56, 233.08, 293.66, 349.23, 440.00],
      [130.81, 196.00, 233.08, 293.66, 392.00],
      [103.83, 155.56, 207.65, 261.63, 311.13],
      [116.54, 174.61, 233.08, 293.66, 349.23]
    ];
    let chordIdx = 0;
    const triggerUpbeat = () => {
      if (!isAudioPlaying) return;
      playHarmonicPad(audioCtx, upbeatChords[chordIdx], 3.5, synthGainNode, 'triangle', 0.05);
      chordIdx = (chordIdx + 1) % upbeatChords.length;
    };
    triggerUpbeat();
    chordIntervalTimer = setInterval(triggerUpbeat, 3200);

  } else {
    // Focus Bassline & Sweep
    const bassline = [110.0, 110.0, 130.81, 146.83, 98.0, 110.0];
    let noteIdx = 0;
    const triggerFocus = () => {
      if (!isAudioPlaying) return;
      playHarmonicPad(audioCtx, [bassline[noteIdx], bassline[noteIdx] * 2], 2.0, synthGainNode, 'sawtooth', 0.035);
      noteIdx = (noteIdx + 1) % bassline.length;
    };
    triggerFocus();
    chordIntervalTimer = setInterval(triggerFocus, 1800);
  }
}

// -----------------------------------------------------------------------------
// Music Station Switcher & Playback Handler
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
    isAudioPlaying = true;
    setPlaybackState(true);

    // Try HTML5 streaming first, seamlessly launch procedural soundscape if stream blocked
    audioPlayer.src = st.url;
    audioPlayer.play().then(() => {
      stopProceduralSoundscape();
    }).catch((err) => {
      console.log(`Launching dedicated procedural ambient soundscape for ${st.name}:`, err.message || err);
      startProceduralStation(st.synthType);
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
    stopProceduralSoundscape();
  }
}

document.getElementById('btn-audio-toggle')?.addEventListener('click', () => {
  if (isAudioPlaying) {
    audioPlayer.pause();
    stopProceduralSoundscape();
    setPlaybackState(false);
  } else {
    activateStation(currentStation, true);
  }
});

sliderVolume?.addEventListener('input', (e) => {
  masterVolume = parseFloat(e.target.value) / 100;
  audioPlayer.volume = masterVolume;
  if (synthGainNode && audioCtx) {
    synthGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  }
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

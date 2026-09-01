import math, os, wave, struct, random

SAMPLE_RATE = 44100
OUT_DIR = "tauri_app/src/assets/audio"
os.makedirs(OUT_DIR, exist_ok=True)

def write_wav(filename, left_chan, right_chan):
    total = min(len(left_chan), len(right_chan))
    filepath = os.path.join(OUT_DIR, filename)
    with wave.open(filepath, 'w') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        
        raw = bytearray()
        for i in range(total):
            l = max(-1.0, min(1.0, left_chan[i]))
            r = max(-1.0, min(1.0, right_chan[i]))
            raw.extend(struct.pack('<hh', int(l * 32767.0), int(r * 32767.0)))
        f.writeframes(raw)
    print(f"Generated {filename} ({os.path.getsize(filepath)} bytes)")

# -----------------------------------------------------------------------------
# 1. ZEN AMBIENT SOLITUDE (Peaceful Acoustic Piano & Nature Breeze)
# -----------------------------------------------------------------------------
def make_zen(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # Chords: Cmaj9, Am9, Fmaj9, G6
    chords = [
        [261.63, 329.63, 392.00, 493.88, 587.33],
        [220.00, 261.63, 329.63, 440.00, 493.88],
        [174.61, 261.63, 329.63, 392.00, 440.00],
        [196.00, 246.94, 293.66, 392.00, 440.00]
    ]

    chord_dur = duration / len(chords)
    for c_idx, chord in enumerate(chords):
        c_start = int(c_idx * chord_dur * SAMPLE_RATE)
        for n_idx, freq in enumerate(chord):
            n_start = c_start + int(n_idx * 0.18 * SAMPLE_RATE)
            for t_idx in range(int(3.8 * SAMPLE_RATE)):
                idx = n_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                env = math.exp(-t * 0.9) * (1.0 - math.exp(-t * 40.0))
                # Acoustic piano harmonics
                sample = (math.sin(2*math.pi*freq*t) * 0.5 +
                          math.sin(4*math.pi*freq*t) * 0.25 +
                          math.sin(6*math.pi*freq*t) * 0.1) * env * 0.18
                pan = 0.3 + (n_idx / len(chord)) * 0.4
                L[idx] += sample * (1.0 - pan)
                R[idx] += sample * pan

    # Soft breeze
    b = 0.0
    for i in range(total):
        w = (random.random() * 2.0 - 1.0)
        b = b * 0.992 + w * 0.008
        L[i] += b * 0.04
        R[i] += b * 0.04

    write_wav("zen.wav", L, R)

# -----------------------------------------------------------------------------
# 2. OCEAN WAVES & ETHEREAL HARP (Coastal Surf & Harp Plucks)
# -----------------------------------------------------------------------------
def make_ocean(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # Swelling Ocean Surf Noise
    b0, b1 = 0.0, 0.0
    for i in range(total):
        t = i / SAMPLE_RATE
        surf_swell = 0.5 + 0.5 * math.sin(2 * math.pi * 0.2 * t)
        w1 = random.random() * 2.0 - 1.0
        w2 = random.random() * 2.0 - 1.0
        b0 = b0 * 0.985 + w1 * 0.015
        b1 = b1 * 0.985 + w2 * 0.015
        L[i] += b0 * (0.05 + 0.14 * surf_swell)
        R[i] += b1 * (0.05 + 0.14 * (1.0 - surf_swell * 0.3))

    # Shimmering Harp Arpeggios (Dmaj9)
    harp_notes = [293.66, 369.99, 440.00, 554.37, 587.33, 739.99]
    for rep in range(int(duration / 2.5)):
        start = int(rep * 2.5 * SAMPLE_RATE)
        for n_idx, freq in enumerate(harp_notes):
            n_start = start + int(n_idx * 0.15 * SAMPLE_RATE)
            for t_idx in range(int(2.2 * SAMPLE_RATE)):
                idx = n_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                env = math.exp(-t * 1.8) * (1.0 - math.exp(-t * 80.0))
                # Plucked harp tone
                sample = (math.sin(2*math.pi*freq*t) + math.sin(4*math.pi*freq*t)*0.3) * env * 0.15
                pan = 0.2 + (n_idx / len(harp_notes)) * 0.6
                L[idx] += sample * (1.0 - pan)
                R[idx] += sample * pan

    write_wav("ocean.wav", L, R)

# -----------------------------------------------------------------------------
# 3. DEEP 432Hz MEDITATION (Tibetan Singing Bowls & OM Drone)
# -----------------------------------------------------------------------------
def make_meditation(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # 432Hz OM drone with binaural beating
    freqs = [108.0, 216.0, 432.0, 864.0]
    for i in range(total):
        t = i / SAMPLE_RATE
        for idx, f in enumerate(freqs):
            w = 0.08 / (idx + 1)
            beat_l = math.sin(2*math.pi*(f - 0.2)*t) * w
            beat_r = math.sin(2*math.pi*(f + 0.2)*t) * w
            L[i] += beat_l
            R[i] += beat_r

    # Singing bowl chimes
    for strike in range(int(duration / 6.0)):
        start = int(strike * 6.0 * SAMPLE_RATE)
        freq = 576.0
        for t_idx in range(int(5.5 * SAMPLE_RATE)):
            idx = start + t_idx
            if idx >= total: break
            t = t_idx / SAMPLE_RATE
            env = math.exp(-t * 0.5)
            s = math.sin(2*math.pi*freq*t) * env * 0.18
            L[idx] += s * 0.5
            R[idx] += s * 0.5

    write_wav("meditation.wav", L, R)

# -----------------------------------------------------------------------------
# 4. CHILLHOP BEATS (Lo-Fi Hip Hop Drums & Rhodes Chords)
# -----------------------------------------------------------------------------
def make_chillhop(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # 85 BPM Lo-Fi Drum Beat (Beat = 0.705s)
    beat_dur = 60.0 / 85.0
    num_beats = int(duration / beat_dur)

    # Rhodes Chords: Ebmaj9, Cm7, Abmaj7, Bb9
    chords = [
        [311.13, 392.00, 466.16, 587.33],
        [261.63, 311.13, 392.00, 466.16],
        [207.65, 261.63, 311.13, 392.00],
        [233.08, 293.66, 349.23, 440.00]
    ]

    for b in range(num_beats):
        b_start = int(b * beat_dur * SAMPLE_RATE)
        
        # Chord every 4 beats
        if b % 4 == 0:
            c_idx = (b // 4) % len(chords)
            for freq in chords[c_idx]:
                for t_idx in range(int(2.4 * SAMPLE_RATE)):
                    idx = b_start + t_idx
                    if idx >= total: break
                    t = t_idx / SAMPLE_RATE
                    # Mellow Rhodes with tremolo
                    trem = 1.0 + 0.15 * math.sin(2*math.pi*4.0*t)
                    env = math.exp(-t * 1.1) * (1.0 - math.exp(-t * 50.0))
                    s = (math.sin(2*math.pi*freq*t) + 0.2*math.sin(4*math.pi*freq*t)) * env * trem * 0.11
                    L[idx] += s * 0.5
                    R[idx] += s * 0.5

        # Sub Kick on beats 0 & 2
        if b % 2 == 0:
            for t_idx in range(int(0.25 * SAMPLE_RATE)):
                idx = b_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                f = 110.0 * math.exp(-t * 22.0) + 45.0
                env = math.exp(-t * 12.0)
                s = math.sin(2*math.pi*f*t) * env * 0.35
                L[idx] += s
                R[idx] += s

        # Lo-Fi Snare on beats 1 & 3
        if b % 2 == 1:
            for t_idx in range(int(0.2 * SAMPLE_RATE)):
                idx = b_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                w = (random.random() * 2.0 - 1.0) * math.exp(-t * 18.0) * 0.22
                s = math.sin(2*math.pi*180.0*t) * math.exp(-t * 25.0) * 0.15 + w
                L[idx] += s
                R[idx] += s

    # Subtle vinyl crackle
    for i in range(total):
        if random.random() > 0.998:
            pop = (random.random() * 2.0 - 1.0) * 0.08
            L[i] += pop
            R[i] += pop

    write_wav("chillhop.wav", L, R)

# -----------------------------------------------------------------------------
# 5. GOLDEN SUNRISE ACOUSTIC (Uplifting Fingerpicked Folk Guitar)
# -----------------------------------------------------------------------------
def make_sunrise(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # G, D/F#, Em7, Cadd9
    riffs = [
        [196.00, 246.94, 293.66, 392.00, 493.88],
        [185.00, 246.94, 293.66, 369.99, 440.00],
        [164.81, 246.94, 329.63, 392.00, 493.88],
        [130.81, 261.63, 329.63, 392.00, 523.25]
    ]

    riff_dur = 2.4
    num_riffs = int(duration / riff_dur)
    for r in range(num_riffs):
        r_start = int(r * riff_dur * SAMPLE_RATE)
        chord = riffs[r % len(riffs)]
        for n_idx, freq in enumerate(chord):
            n_start = r_start + int(n_idx * 0.18 * SAMPLE_RATE)
            for t_idx in range(int(1.8 * SAMPLE_RATE)):
                idx = n_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                env = math.exp(-t * 2.2) * (1.0 - math.exp(-t * 100.0))
                # Acoustic guitar harmonics
                s = (math.sin(2*math.pi*freq*t) + 0.4*math.sin(4*math.pi*freq*t) + 0.2*math.sin(6*math.pi*freq*t)) * env * 0.16
                pan = 0.25 + (n_idx / len(chord)) * 0.5
                L[idx] += s * (1.0 - pan)
                R[idx] += s * pan

    write_wav("sunrise.wav", L, R)

# -----------------------------------------------------------------------------
# 6. 8-BIT RETRO ARCADE (Chiptune Pulse & Gaming Arps)
# -----------------------------------------------------------------------------
def make_chiptune(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # 140 BPM (16th note = 0.107s)
    step_dur = 0.107
    notes = [
        261.63, 329.63, 392.00, 523.25,
        196.00, 246.94, 293.66, 392.00,
        220.00, 261.63, 329.63, 440.00,
        174.61, 220.00, 261.63, 349.23
    ]
    bass_notes = [130.81, 98.00, 110.00, 87.31]

    num_steps = int(duration / step_dur)
    for s in range(num_steps):
        s_start = int(s * step_dur * SAMPLE_RATE)
        freq = notes[s % len(notes)]
        
        for t_idx in range(int(0.095 * SAMPLE_RATE)):
            idx = s_start + t_idx
            if idx >= total: break
            t = t_idx / SAMPLE_RATE
            # Pure 8-bit square wave
            sq = 0.08 if math.sin(2*math.pi*freq*t) >= 0 else -0.08
            L[idx] += sq * 0.8
            R[idx] += sq * 0.8

        # 8-bit Bass on quarter beats
        if s % 4 == 0:
            b_freq = bass_notes[(s // 4) % len(bass_notes)]
            for t_idx in range(int(0.35 * SAMPLE_RATE)):
                idx = s_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                triangle = (2.0 / math.pi) * math.asin(math.sin(2*math.pi*b_freq*t)) * 0.14
                L[idx] += triangle
                R[idx] += triangle

    write_wav("chiptune.wav", L, R)

# -----------------------------------------------------------------------------
# 7. CYBER SYNTHWAVE (Analog Detuned Sawtooth Bassline & Drive)
# -----------------------------------------------------------------------------
def make_cyber(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # 120 BPM Synthwave Pulse (0.5s beat)
    bassline = [110.0, 110.0, 130.81, 146.83, 98.0, 110.0, 130.81, 146.83]
    beat_dur = 0.35
    num_beats = int(duration / beat_dur)

    for b in range(num_beats):
        b_start = int(b * beat_dur * SAMPLE_RATE)
        freq = bassline[b % len(bassline)]
        for t_idx in range(int(0.32 * SAMPLE_RATE)):
            idx = b_start + t_idx
            if idx >= total: break
            t = t_idx / SAMPLE_RATE
            env = math.exp(-t * 4.5)
            # Detuned dual analog saw
            saw_l = (2.0 * ((freq * t) % 1.0) - 1.0) * env * 0.18
            saw_r = (2.0 * ((freq * 1.008 * t) % 1.0) - 1.0) * env * 0.18
            L[idx] += saw_l
            R[idx] += saw_r

    write_wav("cyber.wav", L, R)

# -----------------------------------------------------------------------------
# 8. DARK CODE FLOW (Minimal Driving Techno Cadence)
# -----------------------------------------------------------------------------
def make_codeflow(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # 128 BPM (Beat = 0.468s)
    beat_dur = 60.0 / 128.0
    num_beats = int(duration / beat_dur)

    for b in range(num_beats):
        b_start = int(b * beat_dur * SAMPLE_RATE)

        # Deep 909 Sub-Kick
        for t_idx in range(int(0.22 * SAMPLE_RATE)):
            idx = b_start + t_idx
            if idx >= total: break
            t = t_idx / SAMPLE_RATE
            f = 130.0 * math.exp(-t * 28.0) + 40.0
            env = math.exp(-t * 14.0)
            s = math.sin(2*math.pi*f*t) * env * 0.4
            L[idx] += s
            R[idx] += s

        # Closed Hi-Hat on off-beats
        hh_start = b_start + int(0.234 * SAMPLE_RATE)
        for t_idx in range(int(0.06 * SAMPLE_RATE)):
            idx = hh_start + t_idx
            if idx >= total: break
            t = t_idx / SAMPLE_RATE
            w = (random.random() * 2.0 - 1.0) * math.exp(-t * 45.0) * 0.12
            L[idx] += w
            R[idx] += w

    write_wav("codeflow.wav", L, R)

# -----------------------------------------------------------------------------
# 9. COSMIC NEBULA HORIZON (Zero-G Atmospheric Space Pads)
# -----------------------------------------------------------------------------
def make_space(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # Ethereal Complex Pads: Cmaj7#11, Abmaj9, Ebmaj7
    chords = [
        [130.81, 196.00, 277.18, 329.63, 493.88],
        [103.83, 155.56, 207.65, 311.13, 415.30],
        [155.56, 233.08, 311.13, 349.23, 466.16]
    ]

    chord_dur = duration / len(chords)
    for c_idx, chord in enumerate(chords):
        c_start = int(c_idx * chord_dur * SAMPLE_RATE)
        for freq in chord:
            for t_idx in range(int(7.0 * SAMPLE_RATE)):
                idx = c_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                env = math.sin(math.pi * min(1.0, t / 6.0))
                # Slow sweeping space pad
                s_l = math.sin(2*math.pi*freq*t + math.sin(2*math.pi*0.1*t)) * env * 0.08
                s_r = math.sin(2*math.pi*freq*1.004*t) * env * 0.08
                L[idx] += s_l
                R[idx] += s_r

    write_wav("space.wav", L, R)

# -----------------------------------------------------------------------------
# 10. MIDNIGHT RAIN & PIANO (Nocturnal Rain & Minor Grand Piano)
# -----------------------------------------------------------------------------
def make_rain_piano(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # Continuous Rainfall Noise Texture
    b = 0.0
    for i in range(total):
        w = (random.random() * 2.0 - 1.0)
        b = b * 0.98 + w * 0.02
        L[i] += b * 0.14
        R[i] += b * 0.14

    # Contemplative Minor Piano: Dmin9, Bbmaj7, Gmin11, Cadd9
    chords = [
        [146.83, 220.00, 261.63, 329.63, 440.00],
        [116.54, 174.61, 233.08, 293.66, 349.23],
        [98.00, 146.83, 196.00, 261.63, 349.23],
        [130.81, 196.00, 261.63, 329.63, 392.00]
    ]

    chord_dur = duration / len(chords)
    for c_idx, chord in enumerate(chords):
        c_start = int(c_idx * chord_dur * SAMPLE_RATE)
        for n_idx, freq in enumerate(chord):
            n_start = c_start + int(n_idx * 0.16 * SAMPLE_RATE)
            for t_idx in range(int(3.8 * SAMPLE_RATE)):
                idx = n_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                env = math.exp(-t * 0.8) * (1.0 - math.exp(-t * 50.0))
                s = (math.sin(2*math.pi*freq*t)*0.6 + math.sin(4*math.pi*freq*t)*0.3) * env * 0.17
                pan = 0.3 + (n_idx / len(chord)) * 0.4
                L[idx] += s * (1.0 - pan)
                R[idx] += s * pan

    write_wav("rain_piano.wav", L, R)

# -----------------------------------------------------------------------------
# 11. NOCTURNAL CELLO (Wooden Formant Bowed Strings)
# -----------------------------------------------------------------------------
def make_cello(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # Am, F, Dm, E7
    chords = [
        [110.00, 164.81, 220.00, 261.63],
        [87.31, 130.81, 174.61, 220.00],
        [73.42, 110.00, 146.83, 220.00],
        [82.41, 123.47, 164.81, 246.94]
    ]

    chord_dur = duration / len(chords)
    for c_idx, chord in enumerate(chords):
        c_start = int(c_idx * chord_dur * SAMPLE_RATE)
        for freq in chord:
            for t_idx in range(int(4.8 * SAMPLE_RATE)):
                idx = c_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                vib = math.sin(2*math.pi*5.2*t) * (freq * 0.015)
                f_vib = freq + vib
                env = math.sin(math.pi * min(1.0, t / 4.4))
                # Bowed cello harmonic spectrum
                s = (math.sin(2*math.pi*f_vib*t) + 0.4*math.sin(4*math.pi*f_vib*t) + 0.2*math.sin(6*math.pi*f_vib*t)) * env * 0.14
                L[idx] += s * 0.5
                R[idx] += s * 0.5

    write_wav("cello.wav", L, R)

# -----------------------------------------------------------------------------
# 12. CAMPFIRE & GUITAR (Crackling Embers & Folk Nocturne)
# -----------------------------------------------------------------------------
def make_campfire(duration=20.0):
    total = int(SAMPLE_RATE * duration)
    L = [0.0] * total
    R = [0.0] * total

    # Crackling Fireplace Texture
    for i in range(total):
        if random.random() > 0.995:
            pop = (random.random() * 2.0 - 1.0) * 0.16
            L[i] += pop
            R[i] += pop

    # Intimate Fingerstyle Guitar: Em, Cmaj7, Am7, B7
    chords = [
        [164.81, 246.94, 329.63, 392.00],
        [130.81, 261.63, 329.63, 392.00],
        [110.00, 220.00, 261.63, 329.63],
        [123.47, 246.94, 293.66, 369.99]
    ]

    chord_dur = duration / len(chords)
    for c_idx, chord in enumerate(chords):
        c_start = int(c_idx * chord_dur * SAMPLE_RATE)
        for n_idx, freq in enumerate(chord):
            n_start = c_start + int(n_idx * 0.18 * SAMPLE_RATE)
            for t_idx in range(int(2.4 * SAMPLE_RATE)):
                idx = n_start + t_idx
                if idx >= total: break
                t = t_idx / SAMPLE_RATE
                env = math.exp(-t * 2.0) * (1.0 - math.exp(-t * 60.0))
                s = (math.sin(2*math.pi*freq*t) + 0.3*math.sin(4*math.pi*freq*t)) * env * 0.15
                pan = 0.3 + (n_idx / len(chord)) * 0.4
                L[idx] += s * (1.0 - pan)
                R[idx] += s * pan

    write_wav("campfire.wav", L, R)

if __name__ == "__main__":
    print("Generating 12 distinct studio-quality soundscapes...")
    make_zen()
    make_ocean()
    make_meditation()
    make_chillhop()
    make_sunrise()
    make_chiptune()
    make_cyber()
    make_codeflow()
    make_space()
    make_rain_piano()
    make_cello()
    make_campfire()
    print("All 12 unique soundscapes generated successfully!")

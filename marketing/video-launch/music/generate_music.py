import wave
import math
import struct
import random

SAMPLE_RATE = 44100
DURATION = 67  # 67 seconds
NUM_SAMPLES = SAMPLE_RATE * DURATION

# Scale frequencies (F minor pentatonic)
FREQS = {
    'F1': 43.65, 'Ab1': 51.91, 'Bb1': 58.27, 'C2': 65.41,
    'Db2': 73.42, 'F2': 87.31, 'Ab2': 103.83, 'Bb2': 116.54,
    'C3': 130.81, 'Eb3': 155.56, 'F3': 174.61, 'G3': 196.00,
    'Ab3': 207.65, 'Bb3': 233.08, 'C4': 261.63, 'Eb4': 311.13,
    'F4': 349.23, 'G4': 392.00, 'Ab4': 415.30, 'Bb4': 466.16,
    'C5': 523.25, 'Eb5': 622.25, 'F5': 698.46, 'Ab5': 830.61,
    'Bb5': 932.33, 'C6': 1046.50, 'Eb6': 1244.51, 'F6': 1396.91
}

# Chords progression (Fm9 -> DbM9 -> Bbm9 -> Csus4 -> Fm9 -> DbM9 -> Bbm9 -> Fm9)
# Each chord lasts about 8.375 seconds
CHORDS = [
    ['F1', 'Ab2', 'C3', 'Eb3', 'G3', 'C4'],      # Fm9
    ['Db2', 'F2', 'Ab2', 'C3', 'Eb3', 'Ab3'],     # DbM9
    ['Bb1', 'Db2', 'F2', 'Ab2', 'C3', 'F3'],      # Bbm9
    ['C2', 'F2', 'G2', 'Bb2', 'D3', 'G3'],        # Csus4/C7
    ['F1', 'Ab2', 'C3', 'Eb3', 'G3', 'C4'],      # Fm9
    ['Db2', 'F2', 'Ab2', 'C3', 'Eb3', 'Ab3'],     # DbM9
    ['Bb1', 'Db2', 'F2', 'Ab2', 'C3', 'F3'],      # Bbm9
    ['F1', 'Ab2', 'C3', 'Eb3', 'G3', 'C4']       # Fm9
]

CHORD_DURATION = DURATION / len(CHORDS)

def get_chord_notes(t):
    chord_idx = int(t / CHORD_DURATION)
    if chord_idx >= len(CHORDS):
        chord_idx = len(CHORDS) - 1
    return CHORDS[chord_idx]

def main():
    print("Sintetizando música ambient premium...")
    
    # Initialize audio buffer
    buffer = [0.0] * NUM_SAMPLES
    
    # Generate background pad chords
    print("  -> Generando acordes analógicos...")
    for i in range(NUM_SAMPLES):
        t = i / SAMPLE_RATE
        
        # Determine current chord and next chord for crossfading
        chord_idx = int(t / CHORD_DURATION)
        next_chord_idx = min(chord_idx + 1, len(CHORDS) - 1)
        
        # Crossfade factor
        chord_time = t % CHORD_DURATION
        crossfade_width = 1.5 # 1.5 seconds crossfade
        
        notes1 = CHORDS[chord_idx]
        notes2 = CHORDS[next_chord_idx]
        
        val = 0.0
        
        # Synthesize voices for chord 1
        for idx, note in enumerate(notes1):
            freq = FREQS.get(note, 100.0)
            # Add subtle detune for warm analog feel
            detune = 1.003 if idx % 2 == 0 else 0.997
            
            # Layer sine and triangle waves
            wave1 = math.sin(2 * math.pi * freq * t)
            wave2 = (t % (1.0 / (freq * detune))) * (freq * detune) * 2.0 - 1.0 # Sawtooth/Triangle approximation
            
            amp = 0.08 if freq < 100 else 0.04
            val += (wave1 * 0.7 + wave2 * 0.3) * amp
            
        # If in crossfade, blend with next chord
        if chord_time > (CHORD_DURATION - crossfade_width) and chord_idx < len(CHORDS) - 1:
            fade_progress = (chord_time - (CHORD_DURATION - crossfade_width)) / crossfade_width
            val2 = 0.0
            for idx, note in enumerate(notes2):
                freq = FREQS.get(note, 100.0)
                detune = 1.003 if idx % 2 == 0 else 0.997
                wave1 = math.sin(2 * math.pi * freq * t)
                wave2 = (t % (1.0 / (freq * detune))) * (freq * detune) * 2.0 - 1.0
                amp = 0.08 if freq < 100 else 0.04
                val2 += (wave1 * 0.7 + wave2 * 0.3) * amp
            
            val = val * (1.0 - fade_progress) + val2 * fade_progress

        # Low-pass filter approximation (moving average) to make the pad dark and warm
        buffer[i] = val

    # Generate random sparkling chimes (Fm pentatonic high notes)
    print("  -> Añadiendo campanas brillantes...")
    chime_notes = ['F5', 'Ab5', 'Bb5', 'C6', 'Eb6', 'F6']
    
    # Deterministic chime triggers (every 2.2 seconds on average)
    random.seed(42)
    next_chime_t = 1.0
    while next_chime_t < DURATION - 2.0:
        note = random.choice(chime_notes)
        freq = FREQS[note]
        trigger_sample = int(next_chime_t * SAMPLE_RATE)
        
        # Chime duration (exponential decay)
        chime_len = int(SAMPLE_RATE * 3.0)
        for j in range(chime_len):
            idx = trigger_sample + j
            if idx >= NUM_SAMPLES:
                break
            chime_t = j / SAMPLE_RATE
            envelope = math.exp(-chime_t * 3.5) # Fast decay
            
            # Clean bell sine wave with harmonics
            chime_val = (
                math.sin(2 * math.pi * freq * chime_t) * 1.0 +
                math.sin(2 * math.pi * freq * 2 * chime_t) * 0.4 +
                math.sin(2 * math.pi * freq * 3 * chime_t) * 0.15
            )
            buffer[idx] += chime_val * envelope * 0.07
            
        next_chime_t += random.uniform(1.8, 3.2)

    # Apply global feedback delay (reverb/echo effect)
    print("  -> Aplicando delay y reverb espacial...")
    delay_time = 0.45  # 450ms delay
    delay_samples = int(delay_time * SAMPLE_RATE)
    feedback = 0.48
    
    for i in range(NUM_SAMPLES):
        if i >= delay_samples:
            # Feed back delayed signal + original signal
            buffer[i] += buffer[i - delay_samples] * feedback

    # Master Limiter / Normalization
    print("  -> Normalizando audio a -1dB...")
    max_val = max(abs(x) for x in buffer)
    if max_val > 0:
        scale = 0.89 / max_val
        buffer = [x * scale for x in buffer]
        
    # Write to WAV
    output_path = "/Users/juanpablogarcia/Desktop/red/marketing/video-launch/music/consejos-music.wav"
    print(f"  -> Guardando archivo WAV en {output_path}...")
    
    with wave.open(output_path, 'wb') as wav_file:
        # Mono, 16-bit PCM, 44100Hz
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        
        for sample in buffer:
            # Convert float to 16-bit signed integer
            val_int = int(sample * 32767)
            wav_file.writeframes(struct.pack('<h', val_int))
            
    print("¡Música generada con éxito!")

if __name__ == "__main__":
    main()

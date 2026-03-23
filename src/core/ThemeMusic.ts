import type { MapTheme } from './GridMap';

// Procedural music generator — creates unique ambient battle loops per theme
// Uses Web Audio API oscillators, filters, and scheduled note patterns

interface ThemeConfig {
  scale: number[];       // frequencies in Hz
  tempo: number;         // ms per beat
  waveType: OscillatorType;
  bassType: OscillatorType;
  padType: OscillatorType;
  volume: number;
  bassVolume: number;
  padVolume: number;
  filterFreq: number;    // low-pass filter cutoff
  pattern: number[];     // scale indices for melody pattern
  bassPattern: number[]; // scale indices for bass
  padChord: number[];    // scale indices for pad chord
  swing: number;         // timing offset for swing feel (0-0.3)
  reverbDecay: number;   // reverb amount
}

const THEME_CONFIGS: Record<string, ThemeConfig> = {
  prairie: {
    scale: [262, 294, 330, 392, 440, 524],  // C major pentatonic
    tempo: 400,
    waveType: 'triangle',
    bassType: 'sine',
    padType: 'sine',
    volume: 0.06,
    bassVolume: 0.08,
    padVolume: 0.03,
    filterFreq: 2000,
    pattern: [0, 2, 4, 3, 2, 0, 1, 3],
    bassPattern: [0, 0, 3, 3, 4, 4, 2, 0],
    padChord: [0, 2, 4],
    swing: 0,
    reverbDecay: 0.3,
  },
  forest: {
    scale: [220, 262, 294, 330, 392, 440],  // A minor pentatonic
    tempo: 500,
    waveType: 'sine',
    bassType: 'triangle',
    padType: 'sine',
    volume: 0.05,
    bassVolume: 0.07,
    padVolume: 0.04,
    filterFreq: 1200,
    pattern: [0, 4, 2, 5, 3, 1, 2, 4],
    bassPattern: [0, 0, 2, 2, 3, 3, 1, 0],
    padChord: [0, 2, 4],
    swing: 0.15,
    reverbDecay: 0.6,
  },
  mountain: {
    scale: [196, 220, 262, 294, 330, 392],  // G mixolydian feel
    tempo: 550,
    waveType: 'triangle',
    bassType: 'sine',
    padType: 'triangle',
    volume: 0.06,
    bassVolume: 0.09,
    padVolume: 0.04,
    filterFreq: 1800,
    pattern: [0, 2, 4, 5, 4, 2, 3, 1],
    bassPattern: [0, 0, 0, 2, 4, 4, 2, 0],
    padChord: [0, 2, 4],
    swing: 0,
    reverbDecay: 0.8,
  },
  abyss: {
    scale: [147, 156, 175, 196, 208, 233],  // D Phrygian (dark)
    tempo: 650,
    waveType: 'sawtooth',
    bassType: 'sawtooth',
    padType: 'sine',
    volume: 0.04,
    bassVolume: 0.1,
    padVolume: 0.05,
    filterFreq: 800,
    pattern: [0, 1, 3, 2, 0, 4, 1, 3],
    bassPattern: [0, 0, 1, 1, 0, 0, 3, 1],
    padChord: [0, 1, 3],
    swing: 0.1,
    reverbDecay: 1.2,
  },
  chaos: {
    scale: [233, 247, 277, 311, 330, 370],  // Bb diminished feel
    tempo: 300,
    waveType: 'sawtooth',
    bassType: 'square',
    padType: 'sawtooth',
    volume: 0.05,
    bassVolume: 0.08,
    padVolume: 0.03,
    filterFreq: 1500,
    pattern: [0, 3, 1, 5, 2, 4, 0, 5],
    bassPattern: [0, 0, 2, 2, 1, 1, 3, 0],
    padChord: [0, 1, 4],
    swing: 0.05,
    reverbDecay: 0.2,
  },
  desert: {
    scale: [220, 233, 277, 294, 330, 370],  // A Phrygian dominant (Arabic)
    tempo: 420,
    waveType: 'triangle',
    bassType: 'sine',
    padType: 'triangle',
    volume: 0.06,
    bassVolume: 0.07,
    padVolume: 0.03,
    filterFreq: 1600,
    pattern: [0, 1, 2, 4, 5, 3, 2, 0],
    bassPattern: [0, 0, 2, 2, 0, 0, 1, 0],
    padChord: [0, 2, 4],
    swing: 0.2,
    reverbDecay: 0.5,
  },
  cave: {
    scale: [131, 147, 165, 175, 196, 220],  // C natural minor low
    tempo: 700,
    waveType: 'sine',
    bassType: 'sine',
    padType: 'sine',
    volume: 0.04,
    bassVolume: 0.1,
    padVolume: 0.05,
    filterFreq: 600,
    pattern: [0, 3, 1, 4, 2, 0, 3, 5],
    bassPattern: [0, 0, 0, 2, 0, 0, 3, 0],
    padChord: [0, 2, 3],
    swing: 0,
    reverbDecay: 1.5,
  },
  jungle: {
    scale: [262, 294, 330, 349, 392, 440],  // C major with percussion feel
    tempo: 320,
    waveType: 'square',
    bassType: 'triangle',
    padType: 'sine',
    volume: 0.04,
    bassVolume: 0.08,
    padVolume: 0.02,
    filterFreq: 2200,
    pattern: [0, 2, 4, 2, 5, 3, 1, 4],
    bassPattern: [0, 0, 3, 0, 4, 0, 2, 0],
    padChord: [0, 2, 4],
    swing: 0.25,
    reverbDecay: 0.4,
  },
};

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

// Simple convolution-free reverb using feedback delay
function createReverb(ctx: AudioContext, decay: number): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1;

  const delays = [0.03, 0.05, 0.08, 0.12];
  input.connect(dry);
  dry.connect(output);

  for (const delayTime of delays) {
    const delay = ctx.createDelay(0.2);
    delay.delayTime.value = delayTime;
    const feedback = ctx.createGain();
    feedback.gain.value = Math.min(decay * 0.3, 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(filter);
    filter.connect(output);
    filter.connect(delay); // feedback loop
  }

  return { input, output };
}

export class ThemeMusic {
  private activeNodes: { osc?: OscillatorNode; gain?: GainNode }[] = [];
  private loopTimers: number[] = [];
  private currentTheme: string | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;

  play(theme: MapTheme): void {
    if (this.currentTheme === theme && this.isPlaying) return;
    this.stop();

    const config = THEME_CONFIGS[theme];
    if (!config) return;

    this.currentTheme = theme;
    this.isPlaying = true;

    try {
      const ctx = getCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.5;

      // Create reverb
      const reverb = createReverb(ctx, config.reverbDecay);
      reverb.output.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Low-pass filter for overall tone
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = config.filterFreq;
      masterFilter.connect(reverb.input);

      // Start the three layers
      this.startMelody(ctx, config, masterFilter);
      this.startBass(ctx, config, masterFilter);
      this.startPad(ctx, config, masterFilter);
      this.startPercussion(ctx, config, masterFilter);
    } catch {
      // Audio not available
    }
  }

  private startMelody(ctx: AudioContext, config: ThemeConfig, dest: AudioNode): void {
    const patternLength = config.pattern.length;
    let noteIndex = 0;

    const playNote = () => {
      if (!this.isPlaying) return;

      const scaleIdx = config.pattern[noteIndex % patternLength];
      const freq = config.scale[scaleIdx];

      // Occasionally skip notes for breathing room
      if (Math.random() > 0.2) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteDuration = config.tempo / 1000 * 0.7;

        osc.type = config.waveType;
        osc.frequency.value = freq;
        // Add slight vibrato
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 1.005, ctx.currentTime + noteDuration * 0.5);
        osc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + noteDuration);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(config.volume, ctx.currentTime + 0.02);
        gain.gain.setValueAtTime(config.volume, ctx.currentTime + noteDuration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noteDuration);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + noteDuration);

        this.activeNodes.push({ osc, gain });
      }

      noteIndex++;
      const swing = noteIndex % 2 === 0 ? config.swing * config.tempo : 0;
      const timer = window.setTimeout(playNote, config.tempo + swing);
      this.loopTimers.push(timer);
    };

    playNote();
  }

  private startBass(ctx: AudioContext, config: ThemeConfig, dest: AudioNode): void {
    const patternLength = config.bassPattern.length;
    let noteIndex = 0;
    const bassTempo = config.tempo * 2; // bass plays at half speed

    const playBass = () => {
      if (!this.isPlaying) return;

      const scaleIdx = config.bassPattern[noteIndex % patternLength];
      const freq = config.scale[scaleIdx] / 2; // one octave lower
      const noteDuration = bassTempo / 1000 * 0.8;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = config.bassType;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(config.bassVolume, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(config.bassVolume, ctx.currentTime + noteDuration * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noteDuration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + noteDuration);

      this.activeNodes.push({ osc, gain });

      noteIndex++;
      const timer = window.setTimeout(playBass, bassTempo);
      this.loopTimers.push(timer);
    };

    playBass();
  }

  private startPad(ctx: AudioContext, config: ThemeConfig, dest: AudioNode): void {
    const chordDuration = config.tempo * config.pattern.length / 1000; // full pattern cycle
    let chordIndex = 0;

    const playChord = () => {
      if (!this.isPlaying) return;

      // Shift chord root every cycle
      const rootShift = [0, 2, 3, 0][chordIndex % 4];

      for (const idx of config.padChord) {
        const scaleIdx = (idx + rootShift) % config.scale.length;
        const freq = config.scale[scaleIdx] / 2;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = config.padType;
        osc.frequency.value = freq;

        // Slow fade in/out for ambient pad
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(config.padVolume, ctx.currentTime + chordDuration * 0.3);
        gain.gain.setValueAtTime(config.padVolume, ctx.currentTime + chordDuration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + chordDuration * 0.95);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + chordDuration);

        this.activeNodes.push({ osc, gain });
      }

      chordIndex++;
      const timer = window.setTimeout(playChord, chordDuration * 1000);
      this.loopTimers.push(timer);
    };

    playChord();
  }

  private startPercussion(ctx: AudioContext, config: ThemeConfig, dest: AudioNode): void {
    let beatIndex = 0;
    const beatTempo = config.tempo / 2;

    const playBeat = () => {
      if (!this.isPlaying) return;

      const isKick = beatIndex % 4 === 0;
      const isHihat = beatIndex % 2 === 0;
      const isSnare = beatIndex % 4 === 2;

      // Kick drum (low thump)
      if (isKick) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(config.bassVolume * 0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
        this.activeNodes.push({ osc, gain });
      }

      // Snare (noise burst) - only on some themes
      if (isSnare && config.tempo < 600) {
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        noiseGain.gain.setValueAtTime(config.volume * 0.6, ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(dest);
        noise.start(ctx.currentTime);
        this.activeNodes.push({ gain: noiseGain });
      }

      // Hi-hat (high noise tick)
      if (isHihat && Math.random() > 0.3) {
        const bufferSize = ctx.sampleRate * 0.02;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.15;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        const hihatFilter = ctx.createBiquadFilter();
        hihatFilter.type = 'highpass';
        hihatFilter.frequency.value = 4000;
        noiseGain.gain.setValueAtTime(config.volume * 0.3, ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        noise.connect(hihatFilter);
        hihatFilter.connect(noiseGain);
        noiseGain.connect(dest);
        noise.start(ctx.currentTime);
        this.activeNodes.push({ gain: noiseGain });
      }

      beatIndex++;
      const swing = beatIndex % 2 === 1 ? config.swing * beatTempo : 0;
      const timer = window.setTimeout(playBeat, beatTempo + swing);
      this.loopTimers.push(timer);
    };

    playBeat();
  }

  stop(): void {
    this.isPlaying = false;
    this.currentTheme = null;

    // Clear all timers
    for (const timer of this.loopTimers) {
      clearTimeout(timer);
    }
    this.loopTimers = [];

    // Fade out and disconnect nodes
    try {
      const ctx = audioCtx;
      if (ctx && this.masterGain) {
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        setTimeout(() => {
          this.masterGain?.disconnect();
          this.masterGain = null;
        }, 400);
      }
    } catch {
      // ignore
    }

    this.activeNodes = [];
  }

  isActive(): boolean {
    return this.isPlaying;
  }

  getCurrentTheme(): string | null {
    return this.currentTheme;
  }
}

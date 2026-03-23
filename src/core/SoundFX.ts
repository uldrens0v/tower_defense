let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  freqEnd: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
): void {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

// Throttle to prevent sound distortion when many hits happen at once
let lastEnemyHitTime = 0;
const ENEMY_HIT_COOLDOWN = 80; // ms between enemy hit sounds

export const SoundFX = {
  wallHit(): void {
    playTone(80, 40, 0.3, 0.4);
  },

  enemyHit(): void {
    const now = performance.now();
    if (now - lastEnemyHitTime < ENEMY_HIT_COOLDOWN) return;
    lastEnemyHitTime = now;
    playTone(400, 200, 0.08, 0.12, 'square');
  },

  waveComplete(): void {
    playTone(440, 880, 0.4, 0.3);
  },

  towerUpgrade(): void {
    playTone(300, 600, 0.2, 0.25);
  },
};

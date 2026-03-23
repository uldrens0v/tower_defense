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

let lastTowerPlaceTime = 0;
const TOWER_PLACE_COOLDOWN = 100;

let lastUltActivateTime = 0;
const ULT_ACTIVATE_COOLDOWN = 150;

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
    // Rising triumphant arpeggio
    playTone(440, 880, 0.3, 0.25);
    setTimeout(() => playTone(554, 1108, 0.25, 0.2), 120);
    setTimeout(() => playTone(659, 1318, 0.3, 0.25), 240);
  },

  towerUpgrade(): void {
    playTone(300, 600, 0.2, 0.25);
    setTimeout(() => playTone(450, 900, 0.15, 0.18), 100);
  },

  towerPlace(): void {
    const now = performance.now();
    if (now - lastTowerPlaceTime < TOWER_PLACE_COOLDOWN) return;
    lastTowerPlaceTime = now;
    playTone(200, 400, 0.12, 0.2);
  },

  towerSell(): void {
    playTone(400, 150, 0.2, 0.2, 'sawtooth');
  },

  ultimateActivate(): void {
    const now = performance.now();
    if (now - lastUltActivateTime < ULT_ACTIVATE_COOLDOWN) return;
    lastUltActivateTime = now;
    playTone(300, 900, 0.3, 0.2);
    setTimeout(() => playTone(500, 1200, 0.2, 0.15), 80);
  },

  enemyReachEnd(): void {
    playTone(150, 60, 0.4, 0.35, 'sawtooth');
  },

  goldEarned(): void {
    playTone(800, 1200, 0.08, 0.08, 'triangle');
  },
};

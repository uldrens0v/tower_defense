import Phaser from 'phaser';
import { gameConfig } from './core/GameConfig';

// ── Prevent all default mobile behaviors ──
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });

// Prevent ALL touch scrolling (pull-to-refresh, overscroll, etc.)
document.addEventListener('touchmove', e => {
  e.preventDefault();
}, { passive: false });

// Prevent double-tap zoom
let lastTap = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

// Prevent context menu on long press
document.addEventListener('contextmenu', e => e.preventDefault());

// ── Create game ──
const game = new Phaser.Game(gameConfig);

// ── Handle resize ──
function refreshScale() {
  if (!game?.scale) return;
  game.scale.refresh();
}

window.addEventListener('resize', refreshScale);
window.addEventListener('orientationchange', () => {
  setTimeout(refreshScale, 100);
  setTimeout(refreshScale, 300);
  setTimeout(refreshScale, 600);
});

// Ensure sizing after game is ready
game.events.once('ready', () => {
  refreshScale();
  setTimeout(refreshScale, 200);
});

// ── Auto-fullscreen on first touch (mobile) ──
function tryFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) return;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if ((el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
    (el as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
  }
}

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.addEventListener('touchstart', function onFirstTouch() {
    tryFullscreen();
    setTimeout(refreshScale, 500);
    document.removeEventListener('touchstart', onFirstTouch);
  }, { once: true });
}

// ── Device detection ─────────────────────────────────────────────────────────
// Supports ?mobile=1 URL param to force mobile layout while testing on desktop.
const _urlForce  = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('mobile') === '1';
const _hasTouch  = typeof window !== 'undefined'
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const IS_MOBILE: boolean = _urlForce || _hasTouch;

// ── Grid (always fixed) ───────────────────────────────────────────────────────
export const GRID_COLS = 32;
export const GRID_ROWS = 18;

// ── Tile & canvas ─────────────────────────────────────────────────────────────
export const TILE_SIZE    = IS_MOBILE ? 24 : 32;
export const GAME_WIDTH   = IS_MOBILE ? 900 : 1200;
export const GAME_HEIGHT  = IS_MOBILE ? 520 : 660;

// ── Layout offsets ────────────────────────────────────────────────────────────
// Mobile: map is centred (no left side-panel). Desktop: 176 px left panel.
export const MAP_OFFSET_X = IS_MOBILE
  ? Math.floor((GAME_WIDTH - GRID_COLS * TILE_SIZE) / 2)   // 66 px
  : 176;

export const MAP_OFFSET_Y = IS_MOBILE ? 36 : 40;

// ── Derived map dimensions ────────────────────────────────────────────────────
export const MAP_WIDTH  = GRID_COLS * TILE_SIZE;   // 768 mobile / 1024 desktop
export const MAP_HEIGHT = GRID_ROWS * TILE_SIZE;   // 432 mobile / 576 desktop

// ── Bottom bar ────────────────────────────────────────────────────────────────
// Centre Y of the bottom-bar button row
export const BOTTOM_BAR_Y = MAP_OFFSET_Y + MAP_HEIGHT + (IS_MOBILE ? 26 : 22);

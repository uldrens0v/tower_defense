export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 660;
export const TILE_SIZE = 32;

/** Horizontal offset where the map starts (right of the left side panel) */
export const MAP_OFFSET_X = 176;

/** Vertical offset where the map/scenario starts (below the top HUD bar) */
export const MAP_OFFSET_Y = 40;

/** Map area dimensions (the actual playable grid) */
export const MAP_WIDTH = 1024;   // 32 cols × 32px
export const MAP_HEIGHT = 576;   // 18 rows × 32px

/** Y position for bottom bar buttons (below the map) */
export const BOTTOM_BAR_Y = MAP_OFFSET_Y + MAP_HEIGHT + 22; // 638

export const GRID_COLS = MAP_WIDTH / TILE_SIZE;
export const GRID_ROWS = MAP_HEIGHT / TILE_SIZE;

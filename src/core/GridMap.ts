import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y } from './Constants';

export const TileType = {
  PATH: 0,
  BUILDABLE: 1,
  WALL: 2,
  DECORATION: 3,
  SPAWN: 4,
  EXIT: 5,
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

export type MapTheme = 'prairie' | 'forest' | 'mountain' | 'abyss' | 'chaos' | 'desert' | 'cave' | 'jungle';

export interface LevelData {
  id: string;
  name: string;
  theme?: MapTheme;
  cols: number;
  rows: number;
  tiles: number[][];
  spawnPoints: { x: number; y: number }[];
  exitPoint: { x: number; y: number };
  waves: WaveData[];
}

export interface WaveData {
  waveNumber: number;
  enemies: WaveEnemy[];
  spawnDelay: number;
  timeBetweenSpawns: number;
}

export interface WaveEnemy {
  enemyId: string;
  count: number;
  spawnPointIndex: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

export class GridMap {
  readonly cols: number;
  readonly rows: number;
  private tiles: TileType[][];
  private levelData: LevelData;

  constructor(levelData: LevelData) {
    this.levelData = levelData;
    this.cols = levelData.cols;
    this.rows = levelData.rows;
    this.tiles = levelData.tiles.map(row => [...row] as TileType[]);
  }

  getTheme(): MapTheme {
    return this.levelData.theme ?? 'prairie';
  }

  getTile(x: number, y: number): TileType {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return TileType.WALL;
    return this.tiles[y][x];
  }

  setTile(x: number, y: number, type: TileType): void {
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
      this.tiles[y][x] = type;
    }
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    return tile === TileType.PATH || tile === TileType.SPAWN || tile === TileType.EXIT;
  }

  isBuildable(x: number, y: number): boolean {
    return this.getTile(x, y) === TileType.BUILDABLE;
  }

  worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor((worldX - MAP_OFFSET_X) / TILE_SIZE),
      y: Math.floor((worldY - MAP_OFFSET_Y) / TILE_SIZE),
    };
  }

  gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * TILE_SIZE + TILE_SIZE / 2 + MAP_OFFSET_X,
      y: gridY * TILE_SIZE + TILE_SIZE / 2 + MAP_OFFSET_Y,
    };
  }

  getSpawnPoints(): { x: number; y: number }[] {
    return this.levelData.spawnPoints;
  }

  getExitPoint(): { x: number; y: number } {
    return this.levelData.exitPoint;
  }

  getWaves(): WaveData[] {
    return this.levelData.waves;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] | null {
    if (!this.isWalkable(endX, endY) && this.getTile(endX, endY) !== TileType.EXIT) {
      return null;
    }

    const openSet: AStarNode[] = [];
    const closedSet = new Set<string>();
    const key = (x: number, y: number) => `${x},${y}`;

    const startNode: AStarNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, endX, endY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];

    while (openSet.length > 0) {
      // Find node with lowest f
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openSet[lowestIdx];

      if (current.x === endX && current.y === endY) {
        // Reconstruct path
        const path: { x: number; y: number }[] = [];
        let node: AStarNode | null = current;
        while (node) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      openSet.splice(lowestIdx, 1);
      closedSet.add(key(current.x, current.y));

      for (const { dx, dy } of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = key(nx, ny);

        if (closedSet.has(nKey)) continue;
        if (!this.isWalkable(nx, ny) && !(nx === endX && ny === endY)) continue;

        const g = current.g + 1;
        const existingIdx = openSet.findIndex(n => n.x === nx && n.y === ny);

        if (existingIdx === -1) {
          const h = this.heuristic(nx, ny, endX, endY);
          openSet.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
        } else if (g < openSet[existingIdx].g) {
          openSet[existingIdx].g = g;
          openSet[existingIdx].f = g + openSet[existingIdx].h;
          openSet[existingIdx].parent = current;
        }
      }
    }

    return null;
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}

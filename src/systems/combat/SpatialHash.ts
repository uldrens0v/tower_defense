export interface SpatialEntity {
  id: string;
  worldX: number;
  worldY: number;
}

export class SpatialHash<T extends SpatialEntity> {
  private cellSize: number;
  private cells: Map<string, T[]> = new Map();

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  private key(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(entity: T): void {
    const k = this.key(entity.worldX, entity.worldY);
    if (!this.cells.has(k)) {
      this.cells.set(k, []);
    }
    this.cells.get(k)!.push(entity);
  }

  insertAll(entities: T[]): void {
    this.clear();
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  findNearest(x: number, y: number, maxRange: number, filter?: (entity: T) => boolean): T | null {
    const cellRange = Math.ceil(maxRange / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    let nearest: T | null = null;
    let nearestDist = maxRange * maxRange;

    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        const k = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(k);
        if (!cell) continue;

        for (const entity of cell) {
          if (filter && !filter(entity)) continue;
          const ex = entity.worldX - x;
          const ey = entity.worldY - y;
          const distSq = ex * ex + ey * ey;
          if (distSq < nearestDist) {
            nearestDist = distSq;
            nearest = entity;
          }
        }
      }
    }

    return nearest;
  }

  findInRange(x: number, y: number, range: number, filter?: (entity: T) => boolean): T[] {
    const results: T[] = [];
    const cellRange = Math.ceil(range / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const rangeSq = range * range;

    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        const k = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(k);
        if (!cell) continue;

        for (const entity of cell) {
          if (filter && !filter(entity)) continue;
          const ex = entity.worldX - x;
          const ey = entity.worldY - y;
          if (ex * ex + ey * ey <= rangeSq) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }
}

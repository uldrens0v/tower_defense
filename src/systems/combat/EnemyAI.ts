import type { EnemyInstance } from '../../entities/enemies/EnemyData';
import { TILE_SIZE } from '../../core/Constants';
import { eventBus } from '../../core/EventBus';

const SEPARATION_DIST = TILE_SIZE * 0.8;

export class EnemyAI {
  update(
    deltaMs: number,
    enemies: EnemyInstance[],
  ): void {
    const deltaSec = deltaMs / 1000;

    for (const enemy of enemies) {
      if (enemy.currentHP <= 0) continue;
      this.followPath(enemy, deltaSec, enemies);
    }
  }

  private followPath(enemy: EnemyInstance, deltaSec: number, allEnemies: EnemyInstance[]): void {
    if (enemy.pathIndex >= enemy.path.length) {
      if (enemy.currentHP > 0) {
        eventBus.emit('enemy:reached_end', enemy);
        enemy.currentHP = 0;
      }
      return;
    }

    const target = enemy.path[enemy.pathIndex];
    const targetWorldX = target.x * TILE_SIZE + TILE_SIZE / 2;
    const targetWorldY = target.y * TILE_SIZE + TILE_SIZE / 2;

    const dx = targetWorldX - enemy.worldX;
    const dy = targetWorldY - enemy.worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      // Snap to tile center to prevent corner-cutting diagonals
      enemy.worldX = targetWorldX;
      enemy.worldY = targetWorldY;
      enemy.pathIndex++;
      return;
    }

    let speed = enemy.data.moveSpeed * TILE_SIZE;

    // Separation: slow down if too close to enemy ahead
    for (const other of allEnemies) {
      if (other === enemy || other.currentHP <= 0) continue;
      const ox = other.worldX - enemy.worldX;
      const oy = other.worldY - enemy.worldY;
      const oDist = Math.sqrt(ox * ox + oy * oy);
      if (oDist < SEPARATION_DIST && oDist > 0) {
        // Only slow if the other enemy is ahead on the path
        if (other.pathIndex >= enemy.pathIndex) {
          speed *= 0.3;
          break;
        }
      }
    }

    enemy.worldX += (dx / dist) * speed * deltaSec;
    enemy.worldY += (dy / dist) * speed * deltaSec;
  }
}

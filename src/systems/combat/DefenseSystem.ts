import type { TowerData, TowerInstance } from '../../entities/towers/TowerEntity';
import { canTargetEnemy, getTowerEffectiveDamage } from '../../entities/towers/TowerEntity';
import type { EnemyInstance } from '../../entities/enemies/EnemyData';
import { GridMap } from '../../core/GridMap';
import { TILE_SIZE } from '../../core/Constants';
import { eventBus } from '../../core/EventBus';

let _projIdCounter = 0;
export function nextProjId(): string { return `p${++_projIdCounter}`; }

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetId: string;
  damage: number;
  speed: number;
  aoeRadius: number;
  towerId: string;
  sprite?: Phaser.GameObjects.Sprite;
}

export class DefenseSystem {
  private towers: Map<string, TowerInstance> = new Map();
  private projectiles: Projectile[] = [];
  private gridMap: GridMap;

  constructor(gridMap: GridMap) {
    this.gridMap = gridMap;
  }

  placeTower(data: TowerData, gridX: number, gridY: number): TowerInstance | null {
    if (!this.gridMap.isBuildable(gridX, gridY)) return null;

    const key = `${gridX},${gridY}`;
    if (this.towers.has(key)) return null;

    const world = this.gridMap.gridToWorld(gridX, gridY);
    const tower: TowerInstance = {
      data,
      gridX,
      gridY,
      worldX: world.x,
      worldY: world.y,
      currentCooldown: 0,
      level: 1,
    };

    this.towers.set(key, tower);
    eventBus.emit('tower:placed', tower);
    return tower;
  }

  removeTower(gridX: number, gridY: number): boolean {
    const key = `${gridX},${gridY}`;
    const tower = this.towers.get(key);
    if (!tower) return false;
    this.towers.delete(key);
    eventBus.emit('tower:removed', tower);
    return true;
  }

  update(deltaMs: number, enemies: EnemyInstance[]): void {
    const deltaSec = deltaMs / 1000;

    // Update tower cooldowns and fire
    for (const tower of this.towers.values()) {
      tower.currentCooldown -= deltaSec;
      if (tower.currentCooldown <= 0) {
        const target = this.findTarget(tower, enemies);
        if (target) {
          this.fireProjectile(tower, target);
          const effectiveSpeed = tower.data.attackSpeed * (1 + (tower.level - 1) * 0.05);
          tower.currentCooldown = 1 / effectiveSpeed;
        }
      }
    }

    // Update projectiles
    this.updateProjectiles(deltaSec, enemies);
  }

  private findTarget(tower: TowerInstance, enemies: EnemyInstance[]): EnemyInstance | null {
    let closest: EnemyInstance | null = null;
    let closestDist = Infinity;
    const rangePixels = tower.data.range * TILE_SIZE;

    for (const enemy of enemies) {
      if (enemy.currentHP <= 0) continue;
      if (!canTargetEnemy(tower.data.targetType, enemy.data.isAerial)) continue;

      const dx = enemy.worldX - tower.worldX;
      const dy = enemy.worldY - tower.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= rangePixels && dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
  }

  private fireProjectile(tower: TowerInstance, target: EnemyInstance): void {
    const damage = getTowerEffectiveDamage(tower, target.data.isAerial);
    if (damage <= 0) return;

    const proj: Projectile = {
      id: nextProjId(),
      x: tower.worldX,
      y: tower.worldY,
      targetId: target.id,
      damage,
      speed: tower.data.projectileSpeed * TILE_SIZE,
      aoeRadius: tower.data.aoeRadius * TILE_SIZE,
      towerId: tower.data.id,
    };

    this.projectiles.push(proj);
    eventBus.emit('projectile:fired', proj);
  }

  private updateProjectiles(deltaSec: number, enemies: EnemyInstance[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const target = enemies.find(e => e.id === proj.targetId);

      if (!target || target.currentHP <= 0) {
        this.projectiles.splice(i, 1);
        eventBus.emit('projectile:removed', proj);
        continue;
      }

      const dx = target.worldX - proj.x;
      const dy = target.worldY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8) {
        // Hit
        if (proj.aoeRadius > 0) {
          for (const enemy of enemies) {
            if (enemy.currentHP <= 0) continue;
            const edx = enemy.worldX - proj.x;
            const edy = enemy.worldY - proj.y;
            if (Math.sqrt(edx * edx + edy * edy) <= proj.aoeRadius) {
              this.damageEnemy(enemy, proj.damage);
            }
          }
        } else {
          this.damageEnemy(target, proj.damage);
        }
        this.projectiles.splice(i, 1);
        eventBus.emit('projectile:hit', proj);
      } else {
        const moveX = (dx / dist) * proj.speed * deltaSec;
        const moveY = (dy / dist) * proj.speed * deltaSec;
        proj.x += moveX;
        proj.y += moveY;
      }
    }
  }

  private damageEnemy(enemy: EnemyInstance, damage: number): void {
    const actualDamage = Math.max(1, damage - enemy.data.defense);
    enemy.currentHP -= actualDamage;
    eventBus.emit('enemy:damaged', enemy, actualDamage);

    if (enemy.currentHP <= 0) {
      enemy.currentHP = 0;
      eventBus.emit('enemy:killed', enemy);
    }
  }

  getTowers(): TowerInstance[] {
    return Array.from(this.towers.values());
  }

  getProjectiles(): Projectile[] {
    return [...this.projectiles];
  }
}

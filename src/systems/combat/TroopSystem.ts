import type { CharacterInstance } from '../../entities/characters/CharacterData';
import type { EnemyInstance } from '../../entities/enemies/EnemyData';
import { TILE_SIZE } from '../../core/Constants';
import { eventBus } from '../../core/EventBus';

export type TroopState = 'idle' | 'patrol' | 'attacking' | 'returning';

export interface TroopInstance {
  id: string;
  character: CharacterInstance;
  homeGridX: number;
  homeGridY: number;
  homeWorldX: number;
  homeWorldY: number;
  worldX: number;
  worldY: number;
  state: TroopState;
  currentCooldown: number;
  targetEnemyId: string | null;
  sprite?: Phaser.GameObjects.Sprite;
  isOnTower: boolean;
}

export interface TroopProjectile {
  x: number;
  y: number;
  targetId: string;
  damage: number;
  speed: number;
  troopId: string;
}

export class TroopSystem {
  private troops: Map<string, TroopInstance> = new Map();
  private projectiles: TroopProjectile[] = [];

  placeTroop(
    character: CharacterInstance,
    gridX: number,
    gridY: number,
    worldX: number,
    worldY: number,
    isOnTower: boolean,
  ): TroopInstance | null {
    // Each character can only be placed once
    if (this.troops.has(character.data.id)) return null;

    const troop: TroopInstance = {
      id: character.data.id,
      character,
      homeGridX: gridX,
      homeGridY: gridY,
      homeWorldX: worldX,
      homeWorldY: worldY,
      worldX,
      worldY,
      state: 'idle',
      currentCooldown: 0,
      targetEnemyId: null,
      isOnTower,
    };

    this.troops.set(character.data.id, troop);
    eventBus.emit('troop:placed', troop);
    return troop;
  }

  isCharacterPlaced(characterId: string): boolean {
    return this.troops.has(characterId);
  }

  update(deltaMs: number, enemies: EnemyInstance[]): void {
    const deltaSec = deltaMs / 1000;

    for (const troop of this.troops.values()) {
      troop.currentCooldown -= deltaSec;
      this.updateAI(troop, deltaSec, enemies);
      this.tryAttack(troop, enemies);
    }

    this.updateProjectiles(deltaSec, enemies);
  }

  private isMelee(troop: TroopInstance): boolean {
    return troop.character.getFinalStats().range <= 2;
  }

  private getAttackRange(troop: TroopInstance): number {
    return troop.character.getFinalStats().range * TILE_SIZE;
  }

  private getPatrolRange(troop: TroopInstance): number {
    return (troop.character.getFinalStats().range + 2) * TILE_SIZE;
  }

  private getMoveSpeed(troop: TroopInstance): number {
    return troop.character.getFinalStats().moveSpeed * TILE_SIZE;
  }

  private distTo(troop: TroopInstance, ex: number, ey: number): number {
    const dx = ex - troop.worldX;
    const dy = ey - troop.worldY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private distFromHome(troop: TroopInstance): number {
    const dx = troop.homeWorldX - troop.worldX;
    const dy = troop.homeWorldY - troop.worldY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private findClosestEnemy(troop: TroopInstance, enemies: EnemyInstance[], maxRange: number): EnemyInstance | null {
    let closest: EnemyInstance | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.currentHP <= 0) continue;
      const dist = this.distTo(troop, enemy.worldX, enemy.worldY);
      // Measure from HOME position for consistent targeting
      const dxHome = enemy.worldX - troop.homeWorldX;
      const dyHome = enemy.worldY - troop.homeWorldY;
      const distFromHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
      if (distFromHome <= maxRange && dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
  }

  private getTarget(troop: TroopInstance, enemies: EnemyInstance[]): EnemyInstance | null {
    if (troop.targetEnemyId) {
      const t = enemies.find(e => e.id === troop.targetEnemyId && e.currentHP > 0);
      if (t) return t;
      troop.targetEnemyId = null;
    }
    return null;
  }

  private updateAI(troop: TroopInstance, deltaSec: number, enemies: EnemyInstance[]): void {
    const melee = this.isMelee(troop);
    const attackRange = this.getAttackRange(troop);
    const patrolRange = this.getPatrolRange(troop);
    const speed = this.getMoveSpeed(troop);

    switch (troop.state) {
      case 'idle': {
        // Look for enemies
        const enemy = this.findClosestEnemy(troop, enemies, patrolRange);
        if (!enemy) break;

        troop.targetEnemyId = enemy.id;
        const dist = this.distTo(troop, enemy.worldX, enemy.worldY);

        if (dist <= attackRange) {
          troop.state = 'attacking';
        } else if (melee) {
          troop.state = 'patrol';
        } else {
          // Ranged: wait at home until in attack range
          const enemyFromHome = Math.sqrt(
            (enemy.worldX - troop.homeWorldX) ** 2 + (enemy.worldY - troop.homeWorldY) ** 2
          );
          if (enemyFromHome <= attackRange) {
            troop.state = 'attacking';
          }
        }
        break;
      }

      case 'patrol': {
        const target = this.getTarget(troop, enemies);
        if (!target) {
          troop.state = 'returning';
          break;
        }

        // Check if target left patrol range (from home)
        const dxHome = target.worldX - troop.homeWorldX;
        const dyHome = target.worldY - troop.homeWorldY;
        const distFromHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
        if (distFromHome > patrolRange) {
          troop.state = 'returning';
          troop.targetEnemyId = null;
          break;
        }

        const dist = this.distTo(troop, target.worldX, target.worldY);
        if (dist <= attackRange) {
          troop.state = 'attacking';
          break;
        }

        // Move toward target (melee only)
        if (melee) {
          this.moveToward(troop, target.worldX, target.worldY, speed, deltaSec);
        }
        break;
      }

      case 'attacking': {
        const target = this.getTarget(troop, enemies);
        if (!target) {
          troop.state = 'returning';
          break;
        }

        const dist = this.distTo(troop, target.worldX, target.worldY);

        if (melee) {
          // Move toward target if not in range
          if (dist > attackRange * 0.8) {
            this.moveToward(troop, target.worldX, target.worldY, speed, deltaSec);
          }

          // Check if target escaped patrol range
          const dxHome = target.worldX - troop.homeWorldX;
          const dyHome = target.worldY - troop.homeWorldY;
          const distFromHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
          if (distFromHome > patrolRange) {
            troop.state = 'returning';
            troop.targetEnemyId = null;
          }
        } else {
          // Ranged: check if target left range (from home)
          const dxHome = target.worldX - troop.homeWorldX;
          const dyHome = target.worldY - troop.homeWorldY;
          const distFromHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
          if (distFromHome > attackRange) {
            troop.state = 'idle';
            troop.targetEnemyId = null;
          }
        }
        break;
      }

      case 'returning': {
        const homeDist = this.distFromHome(troop);
        if (homeDist < 4) {
          troop.worldX = troop.homeWorldX;
          troop.worldY = troop.homeWorldY;
          troop.state = 'idle';
          break;
        }

        this.moveToward(troop, troop.homeWorldX, troop.homeWorldY, speed, deltaSec);

        // While returning, check if enemies appeared nearby
        const nearby = this.findClosestEnemy(troop, enemies, patrolRange);
        if (nearby && melee) {
          const dist = this.distTo(troop, nearby.worldX, nearby.worldY);
          if (dist <= attackRange) {
            troop.targetEnemyId = nearby.id;
            troop.state = 'attacking';
          }
        }
        break;
      }
    }
  }

  private moveToward(troop: TroopInstance, tx: number, ty: number, speed: number, deltaSec: number): void {
    const dx = tx - troop.worldX;
    const dy = ty - troop.worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const step = speed * deltaSec;
    if (step >= dist) {
      troop.worldX = tx;
      troop.worldY = ty;
    } else {
      troop.worldX += (dx / dist) * step;
      troop.worldY += (dy / dist) * step;
    }
  }

  private tryAttack(troop: TroopInstance, enemies: EnemyInstance[]): void {
    if (troop.state !== 'attacking' || troop.currentCooldown > 0) return;

    const target = this.getTarget(troop, enemies);
    if (!target) return;

    const stats = troop.character.getFinalStats();
    const melee = this.isMelee(troop);

    // Calculate damage with passive skill bonus
    let damage = stats.attack;
    const passive = troop.character.data.passiveSkill;
    if (passive) {
      const eff = passive.effect;
      if (eff.allStats) damage *= (1 + eff.allStats);
      if (eff.critChance && Math.random() < eff.critChance) damage *= 2;
      if (eff.firstStrikeCrit && troop.currentCooldown <= -10) damage *= 3; // first attack bonus
      if (eff.burnDamage) damage *= 1.15; // simplified burn
      if (eff.channeling && Math.random() < 0.33) damage *= eff.channeling;
      if (eff.aerialDamage && target.data.isAerial) damage *= (1 + eff.aerialDamage);
    }

    const finalDamage = Math.max(1, Math.floor(damage) - target.data.defense);

    if (melee) {
      // Direct damage
      target.currentHP -= finalDamage;
      eventBus.emit('enemy:damaged', target, finalDamage);
      eventBus.emit('troop:meleeHit', target.worldX, target.worldY, troop.character.data.type);
      if (target.currentHP <= 0) {
        target.currentHP = 0;
        eventBus.emit('enemy:killed', target);
      }
    } else {
      // Fire projectile
      this.projectiles.push({
        x: troop.worldX,
        y: troop.worldY,
        targetId: target.id,
        damage: finalDamage,
        speed: 18 * TILE_SIZE,
        troopId: troop.id,
      });
    }

    troop.currentCooldown = 1 / stats.attackSpeed;
  }

  private updateProjectiles(deltaSec: number, enemies: EnemyInstance[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const target = enemies.find(e => e.id === proj.targetId);

      if (!target || target.currentHP <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const dx = target.worldX - proj.x;
      const dy = target.worldY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8) {
        target.currentHP -= proj.damage;
        eventBus.emit('enemy:damaged', target, proj.damage);
        if (target.currentHP <= 0) {
          target.currentHP = 0;
          eventBus.emit('enemy:killed', target);
        }
        this.projectiles.splice(i, 1);
      } else {
        proj.x += (dx / dist) * proj.speed * deltaSec;
        proj.y += (dy / dist) * proj.speed * deltaSec;
      }
    }
  }

  getTroops(): TroopInstance[] {
    return Array.from(this.troops.values());
  }

  getProjectiles(): TroopProjectile[] {
    return [...this.projectiles];
  }

  clearAll(): void {
    this.troops.clear();
    this.projectiles = [];
  }
}

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
  // Ultimate ability tracking
  ultimateCharge: number;   // damage accumulated
  ultimateActive: boolean;  // currently using ultimate
  ultimateTimer: number;    // remaining duration for buff-type ults
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
      ultimateCharge: 0,
      ultimateActive: false,
      ultimateTimer: 0,
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
      this.updateUltimate(troop, deltaSec, enemies);
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

    // Ultimate buff multipliers
    if (troop.ultimateActive) {
      const charId = troop.character.data.id;
      if (charId === 'char_dragon_knight') {
        damage *= 2; // +100% damage during Furia Draconiana
      } else if (charId === 'char_overlord') {
        damage *= 1.5; // +50% from own Grito de Guerra
      } else {
        // Any troop buffed by Overlord's warcry
        damage *= 1.5;
      }
    }

    const finalDamage = Math.max(1, Math.floor(damage) - target.data.defense);

    // Charge ultimate with damage dealt
    troop.ultimateCharge += finalDamage;

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

  // Damage required to activate ultimate (low for testing)
  private static readonly ULT_CHARGE_COST = 30;

  /** Required damage to fill ultimate bar */
  getUltChargeCost(): number { return TroopSystem.ULT_CHARGE_COST; }

  /** Reset ultimate charges at the start of each new round */
  resetUltimateCharges(): void {
    for (const troop of this.troops.values()) {
      troop.ultimateCharge = 0;
      troop.ultimateActive = false;
      troop.ultimateTimer = 0;
    }
  }

  /** Get current ultimate charge info for all troops (for UI) */
  getUltimateCharges(): Map<string, { charge: number; cooldown: number; active: boolean; canUnlock: boolean }> {
    const result = new Map<string, { charge: number; cooldown: number; active: boolean; canUnlock: boolean }>();
    const cost = TroopSystem.ULT_CHARGE_COST;
    for (const troop of this.troops.values()) {
      result.set(troop.id, {
        charge: troop.ultimateCharge,
        cooldown: cost,
        active: troop.ultimateActive,
        canUnlock: true,
      });
    }
    return result;
  }

  private updateUltimate(troop: TroopInstance, deltaSec: number, enemies: EnemyInstance[]): void {
    // Tick down active buff-type ultimates
    if (troop.ultimateActive && troop.ultimateTimer > 0) {
      troop.ultimateTimer -= deltaSec;
      if (troop.ultimateTimer <= 0) {
        troop.ultimateActive = false;
        troop.ultimateTimer = 0;
        eventBus.emit('ultimate:ended', { troopId: troop.id, charId: troop.character.data.id });
      }
    }

    // Check if charged enough to activate
    const cost = TroopSystem.ULT_CHARGE_COST;
    if (troop.ultimateCharge < cost) return;

    // Need a nearby enemy to trigger
    const patrolRange = this.getPatrolRange(troop);
    const hasNearby = enemies.some(e => {
      if (e.currentHP <= 0) return false;
      const dx = e.worldX - troop.homeWorldX;
      const dy = e.worldY - troop.homeWorldY;
      return Math.sqrt(dx * dx + dy * dy) <= patrolRange;
    });
    if (!hasNearby) return;

    // Activate! Reset charge
    troop.ultimateCharge -= cost;
    this.activateUltimate(troop, enemies);
  }

  private damageEnemiesInArea(x: number, y: number, radius: number, damage: number, enemies: EnemyInstance[]): number {
    let hits = 0;
    for (const enemy of enemies) {
      if (enemy.currentHP <= 0) continue;
      const dx = enemy.worldX - x;
      const dy = enemy.worldY - y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        enemy.currentHP -= damage;
        eventBus.emit('enemy:damaged', enemy, damage);
        if (enemy.currentHP <= 0) {
          enemy.currentHP = 0;
          eventBus.emit('enemy:killed', enemy);
        }
        hits++;
      }
    }
    return hits;
  }

  private activateUltimate(troop: TroopInstance, enemies: EnemyInstance[]): void {
    const charId = troop.character.data.id;
    const stats = troop.character.getFinalStats();
    const atkDmg = Math.floor(stats.attack * 3);
    const range = stats.range * TILE_SIZE;

    // ── Each character has a unique ability ──

    switch (charId) {
      // ─── COMMON ───

      case 'char_soldier': {
        // Golpe Furioso: heavy melee strike on nearest + stun effect
        const target = this.findClosestEnemy(troop, enemies, range);
        if (target && target.currentHP > 0) {
          const dmg = atkDmg * 2;
          target.currentHP -= dmg;
          eventBus.emit('enemy:damaged', target, dmg);
          if (target.currentHP <= 0) { target.currentHP = 0; eventBus.emit('enemy:killed', target); }
        }
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'soldier_fury',
          x: troop.worldX, y: troop.worldY, radius: range,
        });
        break;
      }

      case 'char_archer': {
        // Lluvia de Flechas: fires arrows hitting all enemies in range
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 1.5, atkDmg, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'archer_rain',
          x: troop.worldX, y: troop.worldY, radius: range * 1.5,
        });
        break;
      }

      case 'char_guard': {
        // Muro de Hierro: massive defense buff, small AoE taunt/damage
        troop.ultimateActive = true;
        troop.ultimateTimer = 5;
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range, Math.floor(atkDmg * 0.5), enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'guard_wall',
          x: troop.worldX, y: troop.worldY, radius: range,
        });
        break;
      }

      case 'char_scout': {
        // Emboscada: dash to furthest enemy in range, deal big damage
        const target = this.findClosestEnemy(troop, enemies, range * 2);
        if (target && target.currentHP > 0) {
          const dmg = atkDmg * 3;
          target.currentHP -= dmg;
          eventBus.emit('enemy:damaged', target, dmg);
          if (target.currentHP <= 0) { target.currentHP = 0; eventBus.emit('enemy:killed', target); }
        }
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'scout_ambush',
          x: troop.worldX, y: troop.worldY, radius: range * 2,
          targetX: target?.worldX ?? troop.worldX, targetY: target?.worldY ?? troop.worldY,
        });
        break;
      }

      case 'char_militia': {
        // Furia del Pueblo: attack speed burst + AoE slash
        troop.ultimateActive = true;
        troop.ultimateTimer = 4;
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 1.2, atkDmg, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'militia_frenzy',
          x: troop.worldX, y: troop.worldY, radius: range * 1.2,
        });
        break;
      }

      case 'char_healer_basic': {
        // Bendición Menor: heals all allies (restores enemy HP as "heal aura" visual, actually buffs troops)
        troop.ultimateActive = true;
        troop.ultimateTimer = 5;
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'healer_bless',
          x: troop.worldX, y: troop.worldY, radius: range * 2,
        });
        break;
      }

      case 'char_spearman': {
        // Carga de Lanza: piercing line attack through enemies
        const target = this.findClosestEnemy(troop, enemies, range * 2);
        if (target) {
          const dx = target.worldX - troop.worldX;
          const dy = target.worldY - troop.worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const nx = dx / dist; const ny = dy / dist;
            const lineRange = range * 2;
            for (const enemy of enemies) {
              if (enemy.currentHP <= 0) continue;
              const ex = enemy.worldX - troop.worldX;
              const ey = enemy.worldY - troop.worldY;
              const proj = ex * nx + ey * ny;
              if (proj < 0 || proj > lineRange) continue;
              const perpDist = Math.abs(ex * ny - ey * nx);
              if (perpDist <= TILE_SIZE * 0.8) {
                enemy.currentHP -= atkDmg * 2;
                eventBus.emit('enemy:damaged', enemy, atkDmg * 2);
                if (enemy.currentHP <= 0) { enemy.currentHP = 0; eventBus.emit('enemy:killed', enemy); }
              }
            }
            eventBus.emit('ultimate:activated', {
              troopId: troop.id, charId, type: 'spearman_charge',
              x: troop.worldX, y: troop.worldY, radius: lineRange,
              targetX: troop.worldX + nx * lineRange, targetY: troop.worldY + ny * lineRange,
            });
          }
        }
        break;
      }

      case 'char_lookout': {
        // Señal Luminosa: marks all enemies, dealing damage and revealing
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 2, atkDmg, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'lookout_flare',
          x: troop.worldX, y: troop.worldY, radius: range * 2,
        });
        break;
      }

      // ─── UNCOMMON ───

      case 'char_knight': {
        // Carga de Caballero: rushes forward, heavy AoE damage
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 1.5, atkDmg * 2, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'knight_charge',
          x: troop.worldX, y: troop.worldY, radius: range * 1.5,
        });
        break;
      }

      case 'char_mage': {
        // Tormenta Arcana: AoE magic storm
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 1.5, atkDmg * 2, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'mage_storm',
          x: troop.worldX, y: troop.worldY, radius: range * 1.5,
        });
        break;
      }

      case 'char_ranger': {
        // Disparo Perforante: line shot through all enemies
        const target = this.findClosestEnemy(troop, enemies, range * 2);
        if (target) {
          const dx = target.worldX - troop.worldX;
          const dy = target.worldY - troop.worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const nx = dx / dist; const ny = dy / dist;
            const lineRange = range * 2.5;
            for (const enemy of enemies) {
              if (enemy.currentHP <= 0) continue;
              const ex = enemy.worldX - troop.worldX;
              const ey = enemy.worldY - troop.worldY;
              const proj = ex * nx + ey * ny;
              if (proj < 0 || proj > lineRange) continue;
              if (Math.abs(ex * ny - ey * nx) <= TILE_SIZE) {
                enemy.currentHP -= atkDmg * 2;
                eventBus.emit('enemy:damaged', enemy, atkDmg * 2);
                if (enemy.currentHP <= 0) { enemy.currentHP = 0; eventBus.emit('enemy:killed', enemy); }
              }
            }
            eventBus.emit('ultimate:activated', {
              troopId: troop.id, charId, type: 'ranger_pierce',
              x: troop.worldX, y: troop.worldY, radius: lineRange,
              targetX: troop.worldX + nx * lineRange, targetY: troop.worldY + ny * lineRange,
            });
          }
        }
        break;
      }

      case 'char_priest': {
        // Santuario: healing aura + damages nearby undead/enemies slightly
        troop.ultimateActive = true;
        troop.ultimateTimer = 6;
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 1.5, Math.floor(atkDmg * 0.8), enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'priest_sanctuary',
          x: troop.worldX, y: troop.worldY, radius: range * 1.5,
        });
        break;
      }

      case 'char_hawk_rider': {
        // Picada Aérea: dive bomb on target area
        const target = this.findClosestEnemy(troop, enemies, range * 2);
        const tx = target ? target.worldX : troop.worldX;
        const ty = target ? target.worldY : troop.worldY;
        this.damageEnemiesInArea(tx, ty, TILE_SIZE * 2.5, atkDmg * 2, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'hawk_dive',
          x: troop.worldX, y: troop.worldY, radius: TILE_SIZE * 2.5,
          targetX: tx, targetY: ty,
        });
        break;
      }

      // ─── RARE ───

      case 'char_paladin': {
        // Juicio Divino: AoE holy damage
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 2, atkDmg * 3, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'paladin_judgment',
          x: troop.worldX, y: troop.worldY, radius: range * 2,
        });
        break;
      }

      case 'char_assassin': {
        // Danza de Cuchillas: 8 rapid strikes on nearby enemies
        const nearby = enemies.filter(e => {
          if (e.currentHP <= 0) return false;
          const dx = e.worldX - troop.worldX;
          const dy = e.worldY - troop.worldY;
          return Math.sqrt(dx * dx + dy * dy) <= range * 1.5;
        });
        for (let i = 0; i < 8; i++) {
          if (nearby.length === 0) break;
          const t = nearby[i % nearby.length];
          if (t.currentHP <= 0) continue;
          const dmg = Math.floor(atkDmg * 0.8);
          t.currentHP -= dmg;
          eventBus.emit('enemy:damaged', t, dmg);
          if (t.currentHP <= 0) { t.currentHP = 0; eventBus.emit('enemy:killed', t); }
        }
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'assassin_blades',
          x: troop.worldX, y: troop.worldY, radius: range * 1.5,
        });
        break;
      }

      case 'char_archmage': {
        // Meteoro: meteor at target location
        const target = this.findClosestEnemy(troop, enemies, range * 2);
        const tx = target ? target.worldX : troop.worldX;
        const ty = target ? target.worldY : troop.worldY;
        this.damageEnemiesInArea(tx, ty, TILE_SIZE * 3, atkDmg * 4, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'archmage_meteor',
          x: tx, y: ty - 200, radius: TILE_SIZE * 3,
          targetX: tx, targetY: ty,
        });
        break;
      }

      // ─── EPIC ───

      case 'char_dragon_knight': {
        // Furia Draconiana: transform, +100% stats
        troop.ultimateActive = true;
        troop.ultimateTimer = 8;
        this.damageEnemiesInArea(troop.worldX, troop.worldY, TILE_SIZE * 3, atkDmg * 2, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'dragon_fury',
          x: troop.worldX, y: troop.worldY, radius: TILE_SIZE * 3, duration: 8,
        });
        break;
      }

      case 'char_seraph': {
        // Lluvia de Luz: piercing ray
        const target = this.findClosestEnemy(troop, enemies, range * 2);
        if (target) {
          const dx = target.worldX - troop.worldX;
          const dy = target.worldY - troop.worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const nx = dx / dist; const ny = dy / dist;
            const rayLen = range * 2;
            for (const enemy of enemies) {
              if (enemy.currentHP <= 0) continue;
              const ex = enemy.worldX - troop.worldX;
              const ey = enemy.worldY - troop.worldY;
              const proj = ex * nx + ey * ny;
              if (proj < 0 || proj > rayLen) continue;
              if (Math.abs(ex * ny - ey * nx) <= TILE_SIZE) {
                enemy.currentHP -= atkDmg * 3;
                eventBus.emit('enemy:damaged', enemy, atkDmg * 3);
                if (enemy.currentHP <= 0) { enemy.currentHP = 0; eventBus.emit('enemy:killed', enemy); }
              }
            }
            eventBus.emit('ultimate:activated', {
              troopId: troop.id, charId, type: 'seraph_ray',
              x: troop.worldX, y: troop.worldY, radius: rayLen,
              targetX: troop.worldX + nx * rayLen, targetY: troop.worldY + ny * rayLen,
            });
          }
        }
        break;
      }

      // ─── LEGENDARY ───

      case 'char_overlord': {
        // Grito de Guerra: buff all troops
        troop.ultimateActive = true;
        troop.ultimateTimer = 8;
        for (const ally of this.troops.values()) {
          ally.ultimateActive = true;
          ally.ultimateTimer = Math.max(ally.ultimateTimer, 8);
        }
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'overlord_warcry',
          x: troop.worldX, y: troop.worldY, radius: TILE_SIZE * 8, duration: 8,
        });
        break;
      }

      // ─── MYTHIC ───

      case 'char_phoenix': {
        // Supernova: massive explosion
        this.damageEnemiesInArea(troop.worldX, troop.worldY, TILE_SIZE * 6, atkDmg * 5, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'phoenix_supernova',
          x: troop.worldX, y: troop.worldY, radius: TILE_SIZE * 6,
        });
        break;
      }

      // ─── FALLBACK for any other character ───

      default: {
        // Explosión genérica
        this.damageEnemiesInArea(troop.worldX, troop.worldY, range * 1.5, atkDmg * 2, enemies);
        eventBus.emit('ultimate:activated', {
          troopId: troop.id, charId, type: 'generic_aoe',
          x: troop.worldX, y: troop.worldY, radius: range * 1.5,
        });
        break;
      }
    }
  }

  clearAll(): void {
    this.troops.clear();
    this.projectiles = [];
  }
}

export const TargetType = {
  GROUND: 'ground',
  AERIAL: 'aerial',
  BOTH: 'both',
} as const;

export type TargetType = (typeof TargetType)[keyof typeof TargetType];

export interface TowerData {
  id: string;
  name: string;
  targetType: TargetType;
  damage: number;
  attackSpeed: number;
  range: number;
  cost: number;
  projectileSpeed: number;
  aoeRadius: number;
  description: string;
}

export interface TowerInstance {
  data: TowerData;
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;
  currentCooldown: number;
  level: number;
  sprite?: Phaser.GameObjects.Sprite;
}

const BOTH_PENALTY = 0.7;

export function getTowerEffectiveDamage(tower: TowerInstance, targetIsAerial: boolean): number {
  const baseDamage = tower.data.damage * (1 + (tower.level - 1) * 0.15);

  if (tower.data.targetType === TargetType.BOTH) {
    return baseDamage * BOTH_PENALTY;
  }

  // Strict type check: ground tower can't hit aerial and vice versa
  if (tower.data.targetType === TargetType.GROUND && targetIsAerial) return 0;
  if (tower.data.targetType === TargetType.AERIAL && !targetIsAerial) return 0;

  return baseDamage;
}

export function canTargetEnemy(towerTargetType: TargetType, enemyIsAerial: boolean): boolean {
  if (towerTargetType === TargetType.BOTH) return true;
  if (towerTargetType === TargetType.GROUND && !enemyIsAerial) return true;
  if (towerTargetType === TargetType.AERIAL && enemyIsAerial) return true;
  return false;
}

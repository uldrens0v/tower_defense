export const EnemyType = {
  GROUND: 'ground',
  AERIAL: 'aerial',
  MIXED: 'mixed',
} as const;

export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

export interface EnemyData {
  id: string;
  name: string;
  enemyType: EnemyType;
  isAerial: boolean;
  hp: number;
  attack: number;
  defense: number;
  attackSpeed: number;
  moveSpeed: number;
  xpReward: number;
  goldReward: number;
  description: string;
}

export interface EnemyInstance {
  id: string;
  data: EnemyData;
  currentHP: number;
  worldX: number;
  worldY: number;
  pathIndex: number;
  path: { x: number; y: number }[];
  targetId: string | null;
  attackCooldown: number;
  sprite?: Phaser.GameObjects.Sprite;
}

export function createEnemyInstance(
  data: EnemyData,
  startX: number,
  startY: number,
  path: { x: number; y: number }[]
): EnemyInstance {
  return {
    id: `enemy_${data.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    data,
    currentHP: data.hp,
    worldX: startX,
    worldY: startY,
    pathIndex: 0,
    path,
    targetId: null,
    attackCooldown: 0,
  };
}

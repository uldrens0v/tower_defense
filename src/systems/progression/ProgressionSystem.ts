import type { CharacterInstance } from '../../entities/characters/CharacterData';
import { RARITY_CONFIG, type RarityTier } from '../rng/RaritySystem';
import { eventBus } from '../../core/EventBus';

export const EvolutionStage = {
  BASE: 0,
  STAGE_1: 1,
  STAGE_2: 2,
  STAGE_3: 3,
  STAGE_4: 4,
} as const;

export type EvolutionStage = (typeof EvolutionStage)[keyof typeof EvolutionStage];

const HP_GROWTH_BY_RARITY: Record<RarityTier, number> = {
  common: 8,
  uncommon: 12,
  rare: 18,
  epic: 28,
  legendary: 45,
  mythic: 80,
  unique: 150,
};

export class ProgressionSystem {
  private xpCurve: number[] = [];

  constructor() {
    this.precomputeXPCurve(100);
  }

  private precomputeXPCurve(maxLevel: number): void {
    this.xpCurve = [0]; // Level 0 doesn't exist
    for (let level = 1; level <= maxLevel; level++) {
      this.xpCurve.push(Math.floor(100 * Math.pow(level, 1.5)));
    }
  }

  getXPForLevel(level: number): number {
    if (level < 1 || level >= this.xpCurve.length) return Infinity;
    return this.xpCurve[level];
  }

  getTotalXPToLevel(targetLevel: number): number {
    let total = 0;
    for (let i = 1; i < targetLevel && i < this.xpCurve.length; i++) {
      total += this.xpCurve[i];
    }
    return total;
  }

  addXP(character: CharacterInstance, amount: number): { leveled: boolean; levelsGained: number; newStage: EvolutionStage | null } {
    const prevLevel = character.level;
    const prevStage = this.getEvolutionStage(character);
    const leveled = character.addXP(amount);
    const levelsGained = character.level - prevLevel;

    let newStage: EvolutionStage | null = null;
    if (leveled) {
      const currentStage = this.getEvolutionStage(character);
      if (currentStage !== prevStage) {
        newStage = currentStage;
        eventBus.emit('character:evolved', character, newStage);
      }

      eventBus.emit('character:levelup', character, levelsGained);

      // Check if ultimate unlocked at this level
      if (character.canUnlockUltimate()) {
        eventBus.emit('ultimate:unlocked', character);
      }
    }

    return { leveled, levelsGained, newStage };
  }

  getEvolutionStage(character: CharacterInstance): EvolutionStage {
    const maxLevel = character.maxLevel;
    const level = character.level;
    const progress = level / maxLevel;

    if (progress >= 1.0) return EvolutionStage.STAGE_4;
    if (progress >= 0.75) return EvolutionStage.STAGE_3;
    if (progress >= 0.50) return EvolutionStage.STAGE_2;
    if (progress >= 0.25) return EvolutionStage.STAGE_1;
    return EvolutionStage.BASE;
  }

  getHPGrowth(rarity: RarityTier): number {
    return HP_GROWTH_BY_RARITY[rarity] ?? HP_GROWTH_BY_RARITY.common;
  }

  getLevelProgress(character: CharacterInstance): {
    currentLevel: number;
    maxLevel: number;
    currentXP: number;
    xpToNext: number;
    totalProgress: number;
    stage: EvolutionStage;
  } {
    return {
      currentLevel: character.level,
      maxLevel: character.maxLevel,
      currentXP: character.currentXP,
      xpToNext: character.xpToNextLevel(),
      totalProgress: character.level / character.maxLevel,
      stage: this.getEvolutionStage(character),
    };
  }

  getStatPreview(character: CharacterInstance, targetLevel: number): {
    current: Record<string, number>;
    atTarget: Record<string, number>;
    diff: Record<string, number>;
  } {
    const currentStats = character.getFinalStats();
    const savedLevel = character.level;
    character.level = Math.min(targetLevel, character.maxLevel);
    const targetStats = character.getFinalStats();
    character.level = savedLevel;

    const current: Record<string, number> = { ...currentStats };
    const atTarget: Record<string, number> = { ...targetStats };
    const diff: Record<string, number> = {};

    for (const key of Object.keys(current)) {
      diff[key] = atTarget[key] - current[key];
    }

    return { current, atTarget, diff };
  }

  getRarityConfig(rarity: RarityTier) {
    return RARITY_CONFIG[rarity];
  }
}

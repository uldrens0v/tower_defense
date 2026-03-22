import { RarityTier, RARITY_CONFIG } from '../../systems/rng/RaritySystem';

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  attackSpeed: number;
  range: number;
  moveSpeed: number;
}

export interface UltimateSkill {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  damage: number;
  aoeRadius: number;
  minLevel: number;
}

export interface PassiveSkill {
  id: string;
  name: string;
  description: string;
  effect: Record<string, number>;
}

export type CharacterType = 'ground' | 'aerial' | 'support' | 'commander';

export interface CharacterData {
  id: string;
  name: string;
  rarity: RarityTier;
  baseStats: BaseStats;
  statGrowthPerLevel: BaseStats;
  type: CharacterType;
  requiredEquipment: string[];
  ultimateSkill?: UltimateSkill;
  passiveSkill?: PassiveSkill;
  maxLevel: number;
}

export interface EquippedItem {
  itemId: string;
  buffActive: boolean;
}

export interface CharacterSaveData {
  characterId: string;
  level: number;
  currentXP: number;
  equipment: EquippedItem[];
}

export class CharacterInstance {
  readonly data: CharacterData;
  level: number;
  currentXP: number;
  equipment: EquippedItem[];

  constructor(data: CharacterData, level = 1, currentXP = 0, equipment: EquippedItem[] = []) {
    this.data = data;
    this.level = level;
    this.currentXP = currentXP;
    this.equipment = equipment;
  }

  get maxLevel(): number {
    return this.data.maxLevel;
  }

  getFinalStats(): BaseStats {
    const rarityMult = RARITY_CONFIG[this.data.rarity].statMultiplier;
    const equipMult = this.getEquipmentMultiplier();
    const base = this.data.baseStats;
    const growth = this.data.statGrowthPerLevel;

    const calc = (stat: keyof BaseStats): number =>
      (base[stat] + growth[stat] * this.level) * rarityMult * equipMult;

    return {
      hp: Math.floor(calc('hp')),
      attack: Math.floor(calc('attack')),
      defense: Math.floor(calc('defense')),
      attackSpeed: parseFloat(calc('attackSpeed').toFixed(2)),
      range: Math.floor(calc('range')),
      moveSpeed: parseFloat(calc('moveSpeed').toFixed(2)),
    };
  }

  private getEquipmentMultiplier(): number {
    let mult = 1.0;
    for (const eq of this.equipment) {
      if (eq.buffActive) {
        mult += 0.05; // Each active buff adds 5%
      }
    }
    return mult;
  }

  canUnlockUltimate(): boolean {
    const ult = this.data.ultimateSkill;
    if (!ult) return false;
    if (this.level < ult.minLevel) return false;

    // All required equipment must be equipped with buff active
    const equippedIds = new Set(
      this.equipment.filter(e => e.buffActive).map(e => e.itemId)
    );
    return this.data.requiredEquipment.every(id => equippedIds.has(id));
  }

  addXP(amount: number): boolean {
    if (this.level >= this.maxLevel) return false;
    this.currentXP += amount;
    let leveled = false;

    while (this.currentXP >= this.xpToNextLevel() && this.level < this.maxLevel) {
      this.currentXP -= this.xpToNextLevel();
      this.level++;
      leveled = true;
    }

    if (this.level >= this.maxLevel) {
      this.currentXP = 0;
    }

    return leveled;
  }

  xpToNextLevel(): number {
    // Exponential curve: 100 * level^1.5
    return Math.floor(100 * Math.pow(this.level, 1.5));
  }

  equipItem(itemId: string, buffActive = true): void {
    const existing = this.equipment.find(e => e.itemId === itemId);
    if (existing) {
      existing.buffActive = buffActive;
    } else {
      this.equipment.push({ itemId, buffActive });
    }
  }

  unequipItem(itemId: string): void {
    this.equipment = this.equipment.filter(e => e.itemId !== itemId);
  }

  serialize(): CharacterSaveData {
    return {
      characterId: this.data.id,
      level: this.level,
      currentXP: this.currentXP,
      equipment: [...this.equipment],
    };
  }

  static deserialize(saveData: CharacterSaveData, characterDB: Map<string, CharacterData>): CharacterInstance | null {
    const data = characterDB.get(saveData.characterId);
    if (!data) return null;
    return new CharacterInstance(data, saveData.level, saveData.currentXP, saveData.equipment);
  }
}

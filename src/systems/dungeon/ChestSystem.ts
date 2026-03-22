import { RarityTier, SeededRNG } from '../rng/RaritySystem';
import { eventBus } from '../../core/EventBus';

export const ChestType = {
  WOOD: 'wood',
  IRON: 'iron',
  GOLD: 'gold',
  CRYSTAL: 'crystal',
  RAINBOW: 'rainbow',
} as const;

export type ChestType = (typeof ChestType)[keyof typeof ChestType];

interface ChestConfig {
  label: string;
  itemCount: { min: number; max: number };
  maxRarity: RarityTier;
  characterChance: number;
  color: number;
}

const CHEST_CONFIGS: Record<ChestType, ChestConfig> = {
  [ChestType.WOOD]: {
    label: 'Cofre de Madera',
    itemCount: { min: 1, max: 1 },
    maxRarity: RarityTier.UNCOMMON,
    characterChance: 0,
    color: 0x8b6914,
  },
  [ChestType.IRON]: {
    label: 'Cofre de Hierro',
    itemCount: { min: 1, max: 2 },
    maxRarity: RarityTier.RARE,
    characterChance: 0,
    color: 0xaaaaaa,
  },
  [ChestType.GOLD]: {
    label: 'Cofre de Oro',
    itemCount: { min: 2, max: 2 },
    maxRarity: RarityTier.EPIC,
    characterChance: 0.15,
    color: 0xffcc00,
  },
  [ChestType.CRYSTAL]: {
    label: 'Cofre de Cristal',
    itemCount: { min: 2, max: 3 },
    maxRarity: RarityTier.LEGENDARY,
    characterChance: 0.3,
    color: 0x88ddff,
  },
  [ChestType.RAINBOW]: {
    label: 'Cofre Arcoíris',
    itemCount: { min: 2, max: 3 },
    maxRarity: RarityTier.UNIQUE,
    characterChance: 0.5,
    color: 0xff88ff,
  },
};

const RARITY_ORDER: RarityTier[] = [
  RarityTier.COMMON,
  RarityTier.UNCOMMON,
  RarityTier.RARE,
  RarityTier.EPIC,
  RarityTier.LEGENDARY,
  RarityTier.MYTHIC,
  RarityTier.UNIQUE,
];

export interface LootDrop {
  type: 'item' | 'character';
  rarity: RarityTier;
  id: string;
}

export interface ChestResult {
  chestType: ChestType;
  drops: LootDrop[];
  includesCharacter: boolean;
}

const STORAGE_KEY = 'td_rpg_drop_history';

export class ChestSystem {
  private rng: SeededRNG;
  private dropHistory: LootDrop[] = [];

  constructor(seed?: number) {
    this.rng = new SeededRNG(seed);
    this.loadHistory();
  }

  rollChestType(isRainbowEligible: boolean): ChestType {
    if (isRainbowEligible && this.rng.next() < 1 / 500) {
      return ChestType.RAINBOW;
    }

    const roll = this.rng.next();
    if (roll < 0.40) return ChestType.WOOD;
    if (roll < 0.70) return ChestType.IRON;
    if (roll < 0.88) return ChestType.GOLD;
    return ChestType.CRYSTAL;
  }

  openChest(chestType: ChestType): ChestResult {
    const config = CHEST_CONFIGS[chestType];
    const itemCount = this.rng.nextInt(config.itemCount.min, config.itemCount.max);
    const drops: LootDrop[] = [];
    let includesCharacter = false;

    for (let i = 0; i < itemCount; i++) {
      const rarity = this.rollItemRarity(config.maxRarity, chestType);
      drops.push({
        type: 'item',
        rarity,
        id: `item_${rarity}_${Date.now()}_${this.rng.nextInt(0, 9999)}`,
      });
    }

    // Character roll
    if (this.rng.next() < config.characterChance) {
      const rarity = this.rollItemRarity(config.maxRarity, chestType);
      drops.push({
        type: 'character',
        rarity,
        id: '', // Filled by GameScene with a real character ID
      });
      includesCharacter = true;
    }

    const result: ChestResult = { chestType, drops, includesCharacter };

    // Save to history
    this.dropHistory.push(...drops);
    this.saveHistory();
    eventBus.emit('chest:opened', result);

    return result;
  }

  private rollItemRarity(maxRarity: RarityTier, chestType: ChestType): RarityTier {
    const maxIdx = RARITY_ORDER.indexOf(maxRarity);
    const guaranteedMinIdx = chestType === ChestType.RAINBOW ? RARITY_ORDER.indexOf(RarityTier.EPIC) : 0;

    // Weighted roll favoring lower rarities
    const weights = RARITY_ORDER.slice(0, maxIdx + 1).map((_, i) => {
      if (i < guaranteedMinIdx) return 0;
      return Math.pow(0.4, i);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = this.rng.next() * totalWeight;

    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return RARITY_ORDER[i];
    }

    return RARITY_ORDER[guaranteedMinIdx];
  }

  getDropHistory(): LootDrop[] {
    return [...this.dropHistory];
  }

  getChestConfig(type: ChestType): ChestConfig {
    return CHEST_CONFIGS[type];
  }

  private saveHistory(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dropHistory));
  }

  private loadHistory(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.dropHistory = JSON.parse(raw);
      } catch {
        this.dropHistory = [];
      }
    }
  }
}

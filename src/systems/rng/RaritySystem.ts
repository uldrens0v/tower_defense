export const RarityTier = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
  MYTHIC: 'mythic',
  UNIQUE: 'unique',
} as const;

export type RarityTier = (typeof RarityTier)[keyof typeof RarityTier];

export const RARITY_CONFIG: Record<RarityTier, {
  dropRate: number;
  color: number;
  colorHex: string;
  statMultiplier: number;
  maxLevel: number;
  label: string;
}> = {
  [RarityTier.COMMON]: {
    dropRate: 0.60,
    color: 0x888888,
    colorHex: '#888888',
    statMultiplier: 1.0,
    maxLevel: 30,
    label: 'Común',
  },
  [RarityTier.UNCOMMON]: {
    dropRate: 0.25,
    color: 0x44cc44,
    colorHex: '#44cc44',
    statMultiplier: 1.3,
    maxLevel: 40,
    label: 'Poco Común',
  },
  [RarityTier.RARE]: {
    dropRate: 0.10,
    color: 0x4488ff,
    colorHex: '#4488ff',
    statMultiplier: 1.7,
    maxLevel: 50,
    label: 'Raro',
  },
  [RarityTier.EPIC]: {
    dropRate: 0.04,
    color: 0xaa44ff,
    colorHex: '#aa44ff',
    statMultiplier: 2.5,
    maxLevel: 60,
    label: 'Épico',
  },
  [RarityTier.LEGENDARY]: {
    dropRate: 0.009,
    color: 0xff8800,
    colorHex: '#ff8800',
    statMultiplier: 4.0,
    maxLevel: 75,
    label: 'Legendario',
  },
  [RarityTier.MYTHIC]: {
    dropRate: 0.00099,
    color: 0xff2222,
    colorHex: '#ff2222',
    statMultiplier: 7.0,
    maxLevel: 90,
    label: 'Mítico',
  },
  [RarityTier.UNIQUE]: {
    dropRate: 0.000001,
    color: 0xffffff,
    colorHex: '#ffffff',
    statMultiplier: 15.0,
    maxLevel: 100,
    label: 'Único',
  },
};

// Seeded RNG (Mulberry32)
export class SeededRNG {
  private state: number;

  constructor(seed?: number) {
    this.state = seed ?? (Date.now() ^ (Math.random() * 0xffffffff));
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

const UNIQUE_CHANCE = 1 / 1_000_000;

// Normal tiers ordered by rarity (excluding UNIQUE which has separate roll)
const NORMAL_TIERS: RarityTier[] = [
  RarityTier.MYTHIC,
  RarityTier.LEGENDARY,
  RarityTier.EPIC,
  RarityTier.RARE,
  RarityTier.UNCOMMON,
  RarityTier.COMMON,
];

// Precomputed cumulative thresholds for normal roll (excluding Unique's probability)
const NORMAL_TOTAL = NORMAL_TIERS.reduce((sum, tier) => sum + RARITY_CONFIG[tier].dropRate, 0);
const CUMULATIVE_THRESHOLDS: { tier: RarityTier; threshold: number }[] = [];
{
  let cumulative = 0;
  for (const tier of NORMAL_TIERS) {
    cumulative += RARITY_CONFIG[tier].dropRate / NORMAL_TOTAL;
    CUMULATIVE_THRESHOLDS.push({ tier, threshold: cumulative });
  }
}

export class RaritySystem {
  private rng: SeededRNG;

  constructor(seed?: number) {
    this.rng = new SeededRNG(seed);
  }

  rollRarity(): RarityTier {
    // Step 1: Separate roll for Unique (1 in 1,000,000)
    if (this.rng.next() < UNIQUE_CHANCE) {
      return RarityTier.UNIQUE;
    }

    // Step 2: Normal weighted roll among remaining tiers
    const roll = this.rng.next();
    for (const { tier, threshold } of CUMULATIVE_THRESHOLDS) {
      if (roll < threshold) {
        return tier;
      }
    }

    return RarityTier.COMMON;
  }

  getRNG(): SeededRNG {
    return this.rng;
  }
}

export const raritySystem = new RaritySystem();

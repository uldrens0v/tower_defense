import type { CharacterData, CharacterSaveData } from './CharacterData';
import { CharacterInstance } from './CharacterData';
import { RaritySystem, RarityTier } from '../../systems/rng/RaritySystem';
import { eventBus } from '../../core/EventBus';

const STORAGE_KEY = 'td_rpg_characters';

export class CharacterManager {
  private characterDB: Map<string, CharacterData> = new Map();
  private charactersByRarity: Map<RarityTier, CharacterData[]> = new Map();
  private ownedCharacters: Map<string, CharacterInstance> = new Map();
  private raritySystem: RaritySystem;

  constructor(seed?: number) {
    this.raritySystem = new RaritySystem(seed);
    for (const tier of Object.values(RarityTier)) {
      this.charactersByRarity.set(tier, []);
    }
  }

  loadCharacterDatabase(characters: CharacterData[]): void {
    this.characterDB.clear();
    for (const tier of Object.values(RarityTier)) {
      this.charactersByRarity.set(tier, []);
    }

    for (const char of characters) {
      this.characterDB.set(char.id, char);
      this.charactersByRarity.get(char.rarity)!.push(char);
    }
  }

  rollCharacter(): CharacterData | null {
    const rarity = this.raritySystem.rollRarity();
    const pool = this.charactersByRarity.get(rarity);

    if (!pool || pool.length === 0) {
      // Unique tier generates procedurally if no pool exists
      if (rarity === RarityTier.UNIQUE) {
        return this.generateUniqueCharacter();
      }
      return null;
    }

    const rng = this.raritySystem.getRNG();
    const index = rng.nextInt(0, pool.length - 1);
    return pool[index];
  }

  private generateUniqueCharacter(): CharacterData {
    const rng = this.raritySystem.getRNG();
    const names = ['Azrael', 'Kronos', 'Ethereal', 'Void Walker', 'Primordial'];
    const name = names[rng.nextInt(0, names.length - 1)];

    return {
      id: `unique_${Date.now()}`,
      name: `${name} the Unbound`,
      rarity: RarityTier.UNIQUE,
      baseStats: {
        hp: 500 + rng.nextInt(0, 200),
        attack: 80 + rng.nextInt(0, 40),
        defense: 60 + rng.nextInt(0, 30),
        attackSpeed: 1.5 + rng.next() * 0.5,
        range: 5 + rng.nextInt(0, 3),
        moveSpeed: 2.0 + rng.next(),
      },
      statGrowthPerLevel: {
        hp: 150,
        attack: 20,
        defense: 15,
        attackSpeed: 0.02,
        range: 0.1,
        moveSpeed: 0.03,
      },
      type: 'ground',
      requiredEquipment: [],
      ultimateSkill: {
        id: `ult_unique_${Date.now()}`,
        name: 'Cataclysm',
        description: 'Rompe las reglas del juego',
        cooldown: 120,
        damage: 9999,
        aoeRadius: 10,
        minLevel: 80,
      },
      passiveSkill: {
        id: `passive_unique_${Date.now()}`,
        name: 'Aura of Chaos',
        description: 'Todos los aliados ganan stats aleatorios',
        effect: { allStats: 0.15 },
      },
      maxLevel: 100,
    };
  }

  addOwnedCharacter(data: CharacterData): CharacterInstance {
    const instance = new CharacterInstance(data);
    this.ownedCharacters.set(data.id, instance);
    eventBus.emit('character:obtained', instance);
    this.save();
    return instance;
  }

  getOwnedCharacter(id: string): CharacterInstance | undefined {
    return this.ownedCharacters.get(id);
  }

  getAllOwned(): CharacterInstance[] {
    return Array.from(this.ownedCharacters.values());
  }

  getCharacterData(id: string): CharacterData | undefined {
    return this.characterDB.get(id);
  }

  getAllCharacterData(): CharacterData[] {
    return Array.from(this.characterDB.values());
  }

  save(): void {
    const data: CharacterSaveData[] = this.getAllOwned().map(c => c.serialize());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const saveData: CharacterSaveData[] = JSON.parse(raw);
      this.ownedCharacters.clear();
      for (const sd of saveData) {
        const instance = CharacterInstance.deserialize(sd, this.characterDB);
        if (instance) {
          this.ownedCharacters.set(sd.characterId, instance);
        }
      }
    } catch {
      console.warn('Failed to load character save data');
    }
  }
}

import type { RarityTier } from '../rng/RaritySystem';
import type { CharacterInstance } from '../../entities/characters/CharacterData';
import { eventBus } from '../../core/EventBus';

export interface ItemData {
  id: string;
  name: string;
  rarity: RarityTier;
  linkedCharacterId?: string;
  statsBonus: Partial<{
    hp: number;
    attack: number;
    defense: number;
    attackSpeed: number;
    range: number;
    moveSpeed: number;
  }>;
  buffDescription: string;
}

const STORAGE_KEY = 'td_rpg_inventory';

export class EquipmentSystem {
  private itemDB: Map<string, ItemData> = new Map();
  private inventory: Map<string, ItemData> = new Map();

  loadItemDatabase(items: ItemData[]): void {
    this.itemDB.clear();
    for (const item of items) {
      this.itemDB.set(item.id, item);
    }
  }

  addToInventory(item: ItemData): void {
    this.inventory.set(item.id, item);
    eventBus.emit('item:obtained', item);
    this.save();
  }

  removeFromInventory(itemId: string): void {
    this.inventory.delete(itemId);
    this.save();
  }

  getInventory(): ItemData[] {
    return Array.from(this.inventory.values());
  }

  getItemData(id: string): ItemData | undefined {
    return this.itemDB.get(id) ?? this.inventory.get(id);
  }

  equipToCharacter(character: CharacterInstance, itemId: string): boolean {
    const item = this.inventory.get(itemId) ?? this.itemDB.get(itemId);
    if (!item) return false;

    const isLinked = item.linkedCharacterId === character.data.id;
    character.equipItem(itemId, isLinked);

    eventBus.emit('equipment:changed', character, item);

    if (character.canUnlockUltimate()) {
      eventBus.emit('ultimate:unlocked', character);
    }

    this.save();
    return true;
  }

  unequipFromCharacter(character: CharacterInstance, itemId: string): void {
    character.unequipItem(itemId);
    eventBus.emit('equipment:changed', character, null);
    this.save();
  }

  checkUltimateProgress(character: CharacterInstance): {
    hasAllEquipment: boolean;
    hasMinLevel: boolean;
    equippedCount: number;
    requiredCount: number;
  } {
    const required = character.data.requiredEquipment;
    const equippedIds = new Set(
      character.equipment.filter(e => e.buffActive).map(e => e.itemId)
    );

    const equippedCount = required.filter(id => equippedIds.has(id)).length;
    const ult = character.data.ultimateSkill;

    return {
      hasAllEquipment: equippedCount >= required.length,
      hasMinLevel: ult ? character.level >= ult.minLevel : false,
      equippedCount,
      requiredCount: required.length,
    };
  }

  getLinkedItems(characterId: string): ItemData[] {
    return Array.from(this.itemDB.values()).filter(
      item => item.linkedCharacterId === characterId
    );
  }

  save(): void {
    const data = Array.from(this.inventory.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const items: ItemData[] = JSON.parse(raw);
      this.inventory.clear();
      for (const item of items) {
        this.inventory.set(item.id, item);
      }
    } catch {
      console.warn('Failed to load inventory');
    }
  }
}

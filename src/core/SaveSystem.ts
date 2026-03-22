import { eventBus } from './EventBus';

export interface GameSaveData {
  currentLevelIndex: number;
  gold: number;
  crystals: number;
  wallHP: number;
  currentWave: number;
  totalEnemiesKilled: number;
  totalRolls: number;
  rarestDrop: string;
  playTimeSeconds: number;
  timestamp: number;
}

const SAVE_KEY = 'td_rpg_save';

export class SaveSystem {
  private data: GameSaveData;
  private playStartTime: number;

  constructor() {
    this.playStartTime = Date.now();
    this.data = {
      currentLevelIndex: 0,
      gold: 1000,
      crystals: 0,
      wallHP: 100,
      currentWave: 0,
      totalEnemiesKilled: 0,
      totalRolls: 0,
      rarestDrop: 'common',
      playTimeSeconds: 0,
      timestamp: Date.now(),
    };
  }

  save(): void {
    this.data.playTimeSeconds += (Date.now() - this.playStartTime) / 1000;
    this.playStartTime = Date.now();
    this.data.timestamp = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    eventBus.emit('game:saved');
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    try {
      this.data = JSON.parse(raw);
      this.playStartTime = Date.now();
      eventBus.emit('game:loaded');
      return true;
    } catch {
      return false;
    }
  }

  getData(): GameSaveData {
    return this.data;
  }

  updateData(partial: Partial<GameSaveData>): void {
    Object.assign(this.data, partial);
  }

  getPlayTime(): number {
    return this.data.playTimeSeconds + (Date.now() - this.playStartTime) / 1000;
  }

  clearSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}

import { eventBus } from '../../core/EventBus';
import { TILE_SIZE } from '../../core/Constants';

export const FormationType = {
  WEDGE: 'wedge',
  V_INVERTED: 'v_inverted',
  BARRIER: 'barrier',
  CIRCLE: 'circle',
  DISPERSION: 'dispersion',
} as const;

export type FormationType = (typeof FormationType)[keyof typeof FormationType];

interface FormationConfig {
  label: string;
  description: string;
  buffs: Record<string, number>;
  debuffs: Record<string, number>;
  getPositions: (centerX: number, centerY: number, unitCount: number) => { x: number; y: number }[];
}

const FORMATION_CONFIGS: Record<FormationType, FormationConfig> = {
  [FormationType.WEDGE]: {
    label: 'Cuña (▽)',
    description: 'Triángulo apuntando al frente',
    buffs: { attack: 0.20 },
    debuffs: { defense: -0.15 },
    getPositions: (cx, cy, count) => {
      const positions: { x: number; y: number }[] = [];
      positions.push({ x: cx, y: cy - TILE_SIZE });
      let row = 1;
      let placed = 1;
      while (placed < count) {
        for (let col = -row; col <= row && placed < count; col += 2) {
          positions.push({ x: cx + col * TILE_SIZE, y: cy + row * TILE_SIZE });
          placed++;
        }
        row++;
      }
      return positions;
    },
  },
  [FormationType.V_INVERTED]: {
    label: 'V invertida (^)',
    description: 'Flanqueo con centro abierto',
    buffs: { attack: 0.10, aoe: 0.15 },
    debuffs: {},
    getPositions: (cx, cy, count) => {
      const positions: { x: number; y: number }[] = [];
      const half = Math.ceil(count / 2);
      for (let i = 0; i < half; i++) {
        positions.push({ x: cx - (i + 1) * TILE_SIZE, y: cy + i * TILE_SIZE });
      }
      for (let i = 0; i < count - half; i++) {
        positions.push({ x: cx + (i + 1) * TILE_SIZE, y: cy + i * TILE_SIZE });
      }
      return positions;
    },
  },
  [FormationType.BARRIER]: {
    label: 'Barrera (━)',
    description: 'Línea horizontal defensiva',
    buffs: { defense: 0.40 },
    debuffs: { attackSpeed: -0.20 },
    getPositions: (cx, cy, count) => {
      const positions: { x: number; y: number }[] = [];
      const startX = cx - Math.floor(count / 2) * TILE_SIZE;
      for (let i = 0; i < count; i++) {
        positions.push({ x: startX + i * TILE_SIZE, y: cy });
      }
      return positions;
    },
  },
  [FormationType.CIRCLE]: {
    label: 'Círculo (○)',
    description: 'Defensa 360° alrededor de un punto',
    buffs: { defense: 0.15 },
    debuffs: {},
    getPositions: (cx, cy, count) => {
      const positions: { x: number; y: number }[] = [];
      const radius = TILE_SIZE * 2;
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        positions.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      }
      return positions;
    },
  },
  [FormationType.DISPERSION]: {
    label: 'Dispersión',
    description: 'Máxima separación, reduce daño AoE',
    buffs: { aoeResist: 0.50 },
    debuffs: { attack: -0.10 },
    getPositions: (cx, cy, count) => {
      const positions: { x: number; y: number }[] = [];
      const spread = TILE_SIZE * 3;
      const cols = Math.ceil(Math.sqrt(count));
      const startX = cx - Math.floor(cols / 2) * spread;
      const startY = cy - Math.floor(cols / 2) * spread;
      for (let i = 0; i < count; i++) {
        positions.push({
          x: startX + (i % cols) * spread,
          y: startY + Math.floor(i / cols) * spread,
        });
      }
      return positions;
    },
  },
};

export interface CommanderUnit {
  id: string;
  worldX: number;
  worldY: number;
  isAlive: boolean;
}

export class CommanderSystem {
  private currentFormation: FormationType | null = null;
  private commander: CommanderUnit | null = null;
  private changeCooldown = 0;
  private readonly COOLDOWN_DURATION = 30; // seconds

  setCommander(commander: CommanderUnit): void {
    this.commander = commander;
  }

  getCommander(): CommanderUnit | null {
    return this.commander;
  }

  isCommanderAlive(): boolean {
    return this.commander !== null && this.commander.isAlive;
  }

  getCurrentFormation(): FormationType | null {
    return this.currentFormation;
  }

  canChangeFormation(): boolean {
    return this.isCommanderAlive() && this.changeCooldown <= 0;
  }

  getCooldownRemaining(): number {
    return Math.max(0, this.changeCooldown);
  }

  activateFormation(
    type: FormationType,
    units: { id: string; worldX: number; worldY: number }[]
  ): { id: string; targetX: number; targetY: number }[] | null {
    if (!this.canChangeFormation()) return null;
    if (!this.commander) return null;

    const config = FORMATION_CONFIGS[type];
    const positions = config.getPositions(this.commander.worldX, this.commander.worldY, units.length);

    this.currentFormation = type;
    this.changeCooldown = this.COOLDOWN_DURATION;

    const result = units.map((unit, i) => ({
      id: unit.id,
      targetX: positions[i]?.x ?? unit.worldX,
      targetY: positions[i]?.y ?? unit.worldY,
    }));

    eventBus.emit('formation:activated', type, result);
    return result;
  }

  getFormationBuffs(): Record<string, number> {
    if (!this.currentFormation) return {};
    const config = FORMATION_CONFIGS[this.currentFormation];
    return { ...config.buffs, ...config.debuffs };
  }

  getFormationConfig(type: FormationType): FormationConfig {
    return FORMATION_CONFIGS[type];
  }

  getAllFormations(): { type: FormationType; config: FormationConfig }[] {
    return (Object.keys(FORMATION_CONFIGS) as FormationType[]).map(type => ({
      type,
      config: FORMATION_CONFIGS[type],
    }));
  }

  update(deltaMs: number): void {
    if (this.changeCooldown > 0) {
      this.changeCooldown -= deltaMs / 1000;
    }
  }

  onCommanderDeath(): void {
    if (this.commander) {
      this.commander.isAlive = false;
    }
    // Formation persists until next wave even if commander dies
    eventBus.emit('commander:died');
  }

  resetForNewWave(): void {
    this.changeCooldown = 0;
  }
}

import Phaser from 'phaser';
import { MAP_OFFSET_X, MAP_OFFSET_Y, MAP_HEIGHT } from '../core/Constants';
import type { TroopInstance } from '../systems/combat/TroopSystem';

const PANEL_W = MAP_OFFSET_X - 4;
const PANEL_X = 2;
const PANEL_Y = MAP_OFFSET_Y;
const PANEL_H = MAP_HEIGHT;
const CELL_SIZE = 52;
const COLS = 3;
const PADDING = 6;
const BAR_H = 5;

export class TroopSidePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cellContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private highlightArrow: Phaser.GameObjects.Container | null = null;
  private highlightTimer: Phaser.Time.TimerEvent | null = null;
  private ultChargeCost = 30;
  private bg: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(99);

    // Panel background
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x0d0d1a, 0.85);
    this.bg.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    this.bg.lineStyle(1, 0x333355);
    this.bg.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    this.container.add(this.bg);

    // Title
    const title = scene.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 8, 'TROPAS', {
      fontSize: '10px', color: '#8888aa', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);
  }

  setUltChargeCost(cost: number): void {
    this.ultChargeCost = cost;
  }

  update(troops: TroopInstance[], ultCharges: Map<string, { charge: number; cooldown: number; active: boolean; canUnlock: boolean }>): void {
    // Remove cells for troops that no longer exist
    for (const [id, cell] of this.cellContainers) {
      if (!troops.find(t => t.id === id)) {
        cell.destroy();
        this.cellContainers.delete(id);
      }
    }

    const startY = PANEL_Y + 24;
    const cellTotal = CELL_SIZE + PADDING;
    const gridStartX = PANEL_X + (PANEL_W - COLS * cellTotal + PADDING) / 2;

    troops.forEach((troop, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = gridStartX + col * cellTotal + CELL_SIZE / 2;
      const cy = startY + row * cellTotal + CELL_SIZE / 2;

      let cell = this.cellContainers.get(troop.id);
      if (!cell) {
        cell = this.createTroopCell(troop, cx, cy);
        this.cellContainers.set(troop.id, cell);
      }

      // Update position
      cell.setPosition(cx, cy);

      // Update ult charge bar
      const ultData = ultCharges.get(troop.id);
      const charge = ultData?.charge ?? troop.ultimateCharge;
      const pct = Math.min(charge / this.ultChargeCost, 1);
      const active = ultData?.active ?? troop.ultimateActive;
      this.updateCellBar(cell, pct, active);

      // Update state indicator (active = attacking)
      const isActive = troop.state === 'attacking' || troop.state === 'patrol';
      this.updateCellState(cell, isActive);
    });

    // Show/hide empty state
    if (troops.length === 0) {
      if (!this.container.getData('emptyText')) {
        const emptyText = this.scene.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H / 2, 'Sin tropas\ncolocadas', {
          fontSize: '10px', color: '#555566', fontFamily: 'monospace', align: 'center',
        }).setOrigin(0.5);
        this.container.add(emptyText);
        this.container.setData('emptyText', emptyText);
      }
    } else {
      const emptyText = this.container.getData('emptyText') as Phaser.GameObjects.Text | undefined;
      if (emptyText) {
        emptyText.destroy();
        this.container.setData('emptyText', undefined);
      }
    }
  }

  private createTroopCell(troop: TroopInstance, _cx: number, _cy: number): Phaser.GameObjects.Container {
    const cell = this.scene.add.container(0, 0).setDepth(100);

    // Cell background
    const bg = this.scene.add.graphics();
    const rarityColor = this.getRarityColor(troop.character.data.rarity);
    bg.fillStyle(0x1a1a2e, 0.9);
    bg.fillRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    bg.lineStyle(1, rarityColor, 0.6);
    bg.strokeRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    cell.add(bg);
    cell.setData('bg', bg);

    // Troop sprite
    const charId = troop.character.data.id;
    const spriteKey = this.scene.textures.exists(charId)
      ? charId : 'character-placeholder';
    const sprite = this.scene.add.sprite(0, -4, spriteKey).setScale(0.8);
    if (this.scene.anims.exists(charId + '_idle')) {
      sprite.play(charId + '_idle');
    }
    cell.add(sprite);

    // Name label (truncated)
    const name = troop.character.data.name.slice(0, 5);
    const nameText = this.scene.add.text(0, -CELL_SIZE / 2 + 2, name, {
      fontSize: '7px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    cell.add(nameText);

    // Ult charge bar background
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x222233);
    barBg.fillRect(-CELL_SIZE / 2 + 2, CELL_SIZE / 2 - BAR_H - 2, CELL_SIZE - 4, BAR_H);
    cell.add(barBg);

    // Ult charge bar fill
    const barFill = this.scene.add.graphics();
    cell.add(barFill);
    cell.setData('barFill', barFill);

    // HP bar (thin, above ult bar)
    const hpBar = this.scene.add.graphics();
    cell.add(hpBar);
    cell.setData('hpBar', hpBar);

    // Interactive — hover to highlight troop on map
    const hitArea = this.scene.add.rectangle(0, 0, CELL_SIZE, CELL_SIZE).setInteractive().setAlpha(0.01);
    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x2a2a4e, 0.95);
      bg.fillRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      bg.lineStyle(2, 0xaa66ff, 0.9);
      bg.strokeRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      this.highlightTroopOnMap(troop);
    });
    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x1a1a2e, 0.9);
      bg.fillRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      bg.lineStyle(1, rarityColor, 0.6);
      bg.strokeRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    });
    cell.add(hitArea);

    this.container.add(cell);
    return cell;
  }

  private updateCellBar(cell: Phaser.GameObjects.Container, pct: number, active: boolean): void {
    const barFill = cell.getData('barFill') as Phaser.GameObjects.Graphics;
    if (!barFill) return;
    barFill.clear();

    const barW = CELL_SIZE - 4;
    const barX = -CELL_SIZE / 2 + 2;
    const barY = CELL_SIZE / 2 - BAR_H - 2;

    if (active) {
      // Glowing gold when active
      barFill.fillStyle(0xffdd44);
      barFill.fillRect(barX, barY, barW, BAR_H);
    } else {
      const color = pct >= 1 ? 0x44ff44 : 0x4488ff;
      barFill.fillStyle(color);
      barFill.fillRect(barX, barY, barW * pct, BAR_H);
    }
  }

  private updateCellState(cell: Phaser.GameObjects.Container, isActive: boolean): void {
    const stateGfx = cell.getData('hpBar') as Phaser.GameObjects.Graphics;
    if (!stateGfx) return;
    stateGfx.clear();

    // Small state indicator dot
    const dotX = CELL_SIZE / 2 - 6;
    const dotY = -CELL_SIZE / 2 + 6;
    const color = isActive ? 0xff4444 : 0x44cc44;
    stateGfx.fillStyle(color, 0.8);
    stateGfx.fillCircle(dotX, dotY, 3);
  }

  private highlightTroopOnMap(troop: TroopInstance): void {
    this.clearHighlight();

    const wx = troop.worldX;
    const wy = troop.worldY;

    this.highlightArrow = this.scene.add.container(wx, wy - 40).setDepth(300);

    // Purple arrow pointing down
    const arrow = this.scene.add.graphics();
    arrow.fillStyle(0xaa44ff, 0.9);
    // Arrow body
    arrow.fillRect(-3, -16, 6, 16);
    // Arrow head
    arrow.fillTriangle(-8, 0, 8, 0, 0, 10);
    this.highlightArrow.add(arrow);

    // Glow ring around troop
    const ring = this.scene.add.graphics();
    ring.lineStyle(2, 0xaa44ff, 0.8);
    ring.strokeCircle(0, 40, 18);
    this.highlightArrow.add(ring);

    // Label
    const label = this.scene.add.text(0, -22, troop.character.data.name, {
      fontSize: '9px', color: '#cc88ff', fontFamily: 'monospace',
      backgroundColor: '#1a0a2e', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1);
    this.highlightArrow.add(label);

    // Bobbing animation
    this.scene.tweens.add({
      targets: this.highlightArrow,
      y: wy - 46,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Auto-remove after 2 seconds
    this.highlightTimer = this.scene.time.delayedCall(2000, () => {
      this.clearHighlight();
    });
  }

  private clearHighlight(): void {
    if (this.highlightArrow) {
      this.highlightArrow.destroy();
      this.highlightArrow = null;
    }
    if (this.highlightTimer) {
      this.highlightTimer.destroy();
      this.highlightTimer = null;
    }
  }

  private getRarityColor(rarity: string): number {
    switch (rarity) {
      case 'legendary': return 0xffaa00;
      case 'epic': return 0xaa44ff;
      case 'rare': return 0x4488ff;
      case 'uncommon': return 0x44cc44;
      default: return 0x888888;
    }
  }

  hide(): void {
    this.container.setVisible(false);
    this.clearHighlight();
  }

  show(): void {
    this.container.setVisible(true);
  }

  /** Clear all troop cells (e.g. on level change) */
  reset(): void {
    this.clearHighlight();
    for (const cell of this.cellContainers.values()) {
      cell.destroy();
    }
    this.cellContainers.clear();
    // Remove empty text if present
    const emptyText = this.container.getData('emptyText') as Phaser.GameObjects.Text | undefined;
    if (emptyText) {
      emptyText.destroy();
      this.container.setData('emptyText', undefined);
    }
  }

  destroy(): void {
    this.clearHighlight();
    this.container.destroy();
    this.cellContainers.clear();
  }
}

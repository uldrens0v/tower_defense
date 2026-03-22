import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';
import type { DungeonData, DungeonRoom } from '../systems/dungeon/DungeonGenerator';
import { RoomType } from '../systems/dungeon/DungeonGenerator';
import { eventBus } from '../core/EventBus';

const ROOM_COLORS: Record<RoomType, number> = {
  [RoomType.COMBAT]: 0xcc4444,
  [RoomType.CHEST]: 0xffcc00,
  [RoomType.ELITE]: 0xaa44ff,
  [RoomType.BOSS]: 0xff2222,
  [RoomType.REST]: 0x44cc44,
};

const ROOM_LABELS: Record<RoomType, string> = {
  [RoomType.COMBAT]: 'Combate',
  [RoomType.CHEST]: 'Cofre',
  [RoomType.ELITE]: 'Élite',
  [RoomType.BOSS]: 'Jefe',
  [RoomType.REST]: 'Descanso',
};

const ROOM_ICONS: Record<RoomType, string> = {
  [RoomType.COMBAT]: '⚔',
  [RoomType.CHEST]: '📦',
  [RoomType.ELITE]: '💀',
  [RoomType.BOSS]: '👹',
  [RoomType.REST]: '🏕',
};

export class DungeonUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  dungeonData: DungeonData | null = null;
  private readonly SCALE = 12;
  private readonly OFFSET_X = 100;
  private readonly OFFSET_Y = 80;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(260).setVisible(false);
  }

  show(dungeon: DungeonData): void {
    this.dungeonData = dungeon;
    this.render();
  }

  private render(): void {
    const dungeon = this.dungeonData!;
    this.container.removeAll(true);

    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, 15, `Calabozo — Dificultad ${dungeon.difficulty}`, {
      fontSize: '20px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Legend
    const legendY = 42;
    const legendTypes: RoomType[] = ['combat', 'chest', 'elite', 'boss', 'rest'];
    const legendStartX = GAME_WIDTH / 2 - legendTypes.length * 65;
    legendTypes.forEach((type, i) => {
      const lx = legendStartX + i * 130;
      const lg = this.scene.add.graphics();
      lg.fillStyle(ROOM_COLORS[type], 0.8);
      lg.fillRect(lx, legendY, 10, 10);
      this.container.add(lg);
      const lt = this.scene.add.text(lx + 14, legendY, ROOM_LABELS[type], {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      });
      this.container.add(lt);
    });

    // Draw connections
    const graphics = this.scene.add.graphics();
    for (const room of dungeon.rooms) {
      for (const connId of room.connections) {
        const conn = dungeon.rooms[connId];
        if (conn) {
          const x1 = this.OFFSET_X + (room.x + room.width / 2) * this.SCALE;
          const y1 = this.OFFSET_Y + (room.y + room.height / 2) * this.SCALE;
          const x2 = this.OFFSET_X + (conn.x + conn.width / 2) * this.SCALE;
          const y2 = this.OFFSET_Y + (conn.y + conn.height / 2) * this.SCALE;

          // Highlight path if both rooms cleared or one is accessible
          const bothCleared = room.cleared && conn.cleared;
          const oneAccessible = this.isAccessible(room, dungeon) || this.isAccessible(conn, dungeon);
          graphics.lineStyle(2, bothCleared ? 0x44aa44 : oneAccessible ? 0x888888 : 0x444444);
          graphics.lineBetween(x1, y1, x2, y2);
        }
      }
    }
    this.container.add(graphics);

    // Draw rooms
    for (const room of dungeon.rooms) {
      this.drawRoom(room, dungeon);
    }

    // Info text
    const clearedCount = dungeon.rooms.filter(r => r.cleared).length;
    const infoText = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, `Salas exploradas: ${clearedCount} / ${dungeon.rooms.length}`, {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(infoText);

    // Back button
    const backBtn = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '[ Volver ]', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#444444', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive();
    backBtn.on('pointerover', () => backBtn.setStroke('#ffff44', 2));
    backBtn.on('pointerout', () => backBtn.setStroke('', 0));
    backBtn.on('pointerdown', () => this.hide());
    this.container.add(backBtn);

    this.container.setVisible(true);
  }

  /** A room is accessible if it's the start (room 0) or connected to a cleared room */
  private isAccessible(room: DungeonRoom, dungeon: DungeonData): boolean {
    if (room.id === 0) return true;
    return room.connections.some(connId => dungeon.rooms[connId]?.cleared);
  }

  private drawRoom(room: DungeonRoom, dungeon: DungeonData): void {
    const x = this.OFFSET_X + room.x * this.SCALE;
    const y = this.OFFSET_Y + room.y * this.SCALE;
    const w = room.width * this.SCALE;
    const h = room.height * this.SCALE;
    const color = ROOM_COLORS[room.type];
    const accessible = this.isAccessible(room, dungeon) && !room.cleared;

    const g = this.scene.add.graphics();

    if (room.cleared) {
      g.fillStyle(0x333333, 0.5);
      g.fillRect(x, y, w, h);
      g.lineStyle(1, 0x44aa44, 0.6);
      g.strokeRect(x, y, w, h);
    } else if (accessible) {
      g.fillStyle(color, 0.8);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRect(x, y, w, h);
    } else {
      g.fillStyle(color, 0.2);
      g.fillRect(x, y, w, h);
      g.lineStyle(1, 0x555555, 0.4);
      g.strokeRect(x, y, w, h);
    }
    this.container.add(g);

    // Icon + label
    const icon = ROOM_ICONS[room.type];
    const labelColor = room.cleared ? '#666666' : accessible ? '#ffffff' : '#666666';
    const label = this.scene.add.text(x + w / 2, y + h / 2 - 6, icon, {
      fontSize: '14px', color: labelColor, fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(label);

    const nameLabel = this.scene.add.text(x + w / 2, y + h / 2 + 10, room.cleared ? 'Limpia' : ROOM_LABELS[room.type], {
      fontSize: '8px', color: labelColor, fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(nameLabel);

    // Interactive only if accessible and not cleared
    if (accessible) {
      const hitArea = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h).setInteractive();
      hitArea.setAlpha(0.01);
      hitArea.on('pointerover', () => {
        g.clear();
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0xffff44, 1);
        g.strokeRect(x, y, w, h);
      });
      hitArea.on('pointerout', () => {
        g.clear();
        g.fillStyle(color, 0.8);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRect(x, y, w, h);
      });
      hitArea.on('pointerdown', () => {
        eventBus.emit('dungeon:enterRoom', room);
        // Re-render to update visuals
        this.scene.time.delayedCall(100, () => {
          if (this.container.visible) this.render();
        });
      });
      this.container.add(hitArea);
    }
  }

  hide(): void {
    this.container.setVisible(false);
    eventBus.emit('dungeon:exit');
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

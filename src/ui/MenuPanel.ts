import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';
import { eventBus } from '../core/EventBus';

export class MenuPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setVisible(false);
    this.buildPanel();

    // ESC to toggle
    scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.visible) this.hide();
      else this.show();
    });
  }

  private buildPanel(): void {
    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Panel background
    const panelX = GAME_WIDTH / 2 - 200;
    const panelY = 60;
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRect(panelX, panelY, 400, 400);
    panel.lineStyle(2, 0x44aa44);
    panel.strokeRect(panelX, panelY, 400, 400);
    this.container.add(panel);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, panelY + 20, 'Descanso entre Olas', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Buttons
    const buttons = [
      { text: 'Entrar al Calabozo', event: 'menu:dungeon', y: panelY + 80 },
      { text: 'Mejorar Torres', event: 'menu:upgrade_towers', y: panelY + 140 },
      { text: 'Inventario', event: 'menu:inventory', y: panelY + 200 },
      { text: 'Colección', event: 'menu:collection', y: panelY + 260 },
      { text: 'Continuar', event: 'menu:continue', y: panelY + 340 },
    ];

    for (const btn of buttons) {
      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(0x333355, 0.9);
      btnBg.fillRect(panelX + 40, btn.y, 320, 40);
      this.container.add(btnBg);

      const btnText = this.scene.add.text(GAME_WIDTH / 2, btn.y + 20, btn.text, {
        fontSize: '16px', color: '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive();

      btnText.on('pointerover', () => btnText.setColor('#ffffff'));
      btnText.on('pointerout', () => btnText.setColor('#cccccc'));
      btnText.on('pointerdown', () => {
        eventBus.emit(btn.event);
        if (btn.event === 'menu:continue') this.hide();
      });

      this.container.add(btnText);
    }
  }

  show(): void {
    this.visible = true;
    this.container.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

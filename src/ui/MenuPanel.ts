import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';
import { eventBus } from '../core/EventBus';

interface MenuButton {
  text: string;
  event: string;
  y: number;
  disabledCheck?: () => boolean;
}

export class MenuPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private buttonElements: {
    bg: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    hit: Phaser.GameObjects.Rectangle;
    btn: MenuButton;
  }[] = [];

  // External state checks — set by GameScene
  hasTowers: () => boolean = () => false;
  isRoundActive: () => boolean = () => false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setVisible(false);
    this.buildPanel();

    // ESC to toggle
    scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.visible) this.hide();
      else eventBus.emit('menu:escPressed');
    });
  }

  private buildPanel(): void {
    // Full opaque overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x0d0d1a, 1);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );
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
    const buttons: MenuButton[] = [
      { text: 'Entrar al Calabozo', event: 'menu:dungeon', y: panelY + 80, disabledCheck: () => this.isRoundActive() },
      { text: 'Mejorar Torres', event: 'menu:upgrade_towers', y: panelY + 140, disabledCheck: () => !this.hasTowers() },
      { text: 'Inventario', event: 'menu:inventory', y: panelY + 200, disabledCheck: () => true },
      { text: 'Colección', event: 'menu:collection', y: panelY + 260 },
      { text: 'Continuar', event: 'menu:continue', y: panelY + 340 },
    ];

    for (const btn of buttons) {
      const btnBg = this.scene.add.graphics();
      this.container.add(btnBg);

      const btnText = this.scene.add.text(GAME_WIDTH / 2, btn.y + 20, btn.text, {
        fontSize: '16px', color: '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.container.add(btnText);

      const hit = this.scene.add.rectangle(GAME_WIDTH / 2, btn.y + 20, 320, 40)
        .setInteractive().setAlpha(0.01);

      hit.on('pointerover', () => {
        const disabled = btn.disabledCheck?.() ?? false;
        if (disabled) return;
        btnText.setColor('#ffffff');
        btnText.setStroke('#ffff44', 2);
      });
      hit.on('pointerout', () => {
        const disabled = btn.disabledCheck?.() ?? false;
        if (disabled) {
          btnText.setColor('#555555');
          btnText.setStroke('', 0);
        } else {
          btnText.setColor('#cccccc');
          btnText.setStroke('', 0);
        }
      });
      hit.on('pointerdown', () => {
        const disabled = btn.disabledCheck?.() ?? false;
        if (disabled) return;

        if (btn.event === 'menu:continue') {
          this.hide(); // emits game:resume
        } else {
          // Hide panel without resuming — submenu handles resume on close
          this.visible = false;
          this.container.setVisible(false);
        }
        eventBus.emit(btn.event);
      });
      this.container.add(hit);

      this.buttonElements.push({ bg: btnBg, text: btnText, hit, btn });
    }
  }

  /** Refresh button states (enabled/disabled) each time the panel opens */
  private refreshButtons(): void {
    const panelX = GAME_WIDTH / 2 - 200;
    for (const el of this.buttonElements) {
      const disabled = el.btn.disabledCheck?.() ?? false;
      el.bg.clear();
      if (disabled) {
        el.bg.fillStyle(0x222233, 0.6);
        el.bg.fillRect(panelX + 40, el.btn.y, 320, 40);
        el.text.setColor('#555555');
      } else {
        el.bg.fillStyle(0x333355, 0.9);
        el.bg.fillRect(panelX + 40, el.btn.y, 320, 40);
        el.text.setColor('#cccccc');
      }
    }
  }

  show(): void {
    this.visible = true;
    this.refreshButtons();
    this.container.setVisible(true);
    eventBus.emit('game:pause');
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
    eventBus.emit('game:resume');
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

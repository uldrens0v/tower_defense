import Phaser from 'phaser';
import { GAME_WIDTH } from '../core/Constants';
import { eventBus } from '../core/EventBus';

export class HUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private wallHPBar: Phaser.GameObjects.Graphics;
  private wallHPText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private crystalText: Phaser.GameObjects.Text;
  private formationBtn: Phaser.GameObjects.Text | null = null;
  private characterPortraits: Phaser.GameObjects.Container;

  private wallHP = 100;
  private wallMaxHP = 100;
  private currentWave = 0;
  private gold = 0;
  private crystals = 0;
  waveTimer = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(100);

    // Top bar background
    const topBar = scene.add.graphics();
    topBar.fillStyle(0x000000, 0.7);
    topBar.fillRect(0, 0, GAME_WIDTH, 40);
    this.container.add(topBar);

    // Wall HP bar
    this.wallHPBar = scene.add.graphics();
    this.container.add(this.wallHPBar);

    this.wallHPText = scene.add.text(GAME_WIDTH / 2, 12, 'Muralla: 100/100', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(this.wallHPText);

    // Wave info
    this.waveText = scene.add.text(10, 8, 'Ola: 0', {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
    });
    this.container.add(this.waveText);

    this.timerText = scene.add.text(10, 24, '', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
    });
    this.container.add(this.timerText);

    // Resources
    this.goldText = scene.add.text(GAME_WIDTH - 150, 8, 'Oro: 0', {
      fontSize: '13px', color: '#ffcc00', fontFamily: 'monospace',
    });
    this.container.add(this.goldText);

    this.crystalText = scene.add.text(GAME_WIDTH - 150, 24, 'Cristales: 0', {
      fontSize: '13px', color: '#88ddff', fontFamily: 'monospace',
    });
    this.container.add(this.crystalText);

    // Character portraits container (bottom left)
    this.characterPortraits = scene.add.container(10, 540).setDepth(100);

    this.drawWallHP();
    this.setupEvents();
  }

  private setupEvents(): void {
    eventBus.on('wall:damaged', (_hp: unknown, _maxHp: unknown) => {
      this.wallHP = _hp as number;
      this.wallMaxHP = _maxHp as number;
      this.drawWallHP();
    });

    eventBus.on('wave:start', (wave: unknown) => {
      this.currentWave = wave as number;
      this.waveText.setText(`Ola: ${this.currentWave}`);
    });

    eventBus.on('resources:update', (gold: unknown, crystals: unknown) => {
      this.gold = gold as number;
      this.crystals = crystals as number;
      this.goldText.setText(`Oro: ${this.gold}`);
      this.crystalText.setText(`Cristales: ${this.crystals}`);
    });
  }

  showFormationButton(onPress: () => void): void {
    if (this.formationBtn) return;
    this.formationBtn = this.scene.add.text(GAME_WIDTH - 40, 50, '[F]', {
      fontSize: '16px', color: '#44ff44', fontFamily: 'monospace',
      backgroundColor: '#333333', padding: { x: 8, y: 4 },
    }).setInteractive().setDepth(100);

    this.formationBtn.on('pointerdown', onPress);
  }

  hideFormationButton(): void {
    if (this.formationBtn) {
      this.formationBtn.destroy();
      this.formationBtn = null;
    }
  }

  updateTimer(seconds: number): void {
    this.waveTimer = seconds;
    if (seconds > 0) {
      this.timerText.setText(`Siguiente ola: ${Math.ceil(seconds)}s`);
    } else {
      this.timerText.setText('');
    }
  }

  updateCharacterPortraits(characters: { name: string; hp: number; maxHP: number; rarity: string }[]): void {
    this.characterPortraits.removeAll(true);

    characters.forEach((char, i) => {
      const x = i * 70;
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x333333, 0.8);
      bg.fillRect(x, -30, 60, 28);

      const hpPct = char.hp / char.maxHP;
      const hpBar = this.scene.add.graphics();
      hpBar.fillStyle(hpPct > 0.3 ? 0x44cc44 : 0xff4444);
      hpBar.fillRect(x + 2, -10, 56 * hpPct, 6);

      const nameText = this.scene.add.text(x + 30, -25, char.name.slice(0, 6), {
        fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);

      this.characterPortraits.add([bg, hpBar, nameText]);
    });
  }

  private drawWallHP(): void {
    this.wallHPBar.clear();
    const barWidth = 200;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const pct = this.wallHP / this.wallMaxHP;

    // Background
    this.wallHPBar.fillStyle(0x333333);
    this.wallHPBar.fillRect(barX, 28, barWidth, 8);

    // HP fill
    const color = pct > 0.5 ? 0x44cc44 : pct > 0.2 ? 0xffaa00 : 0xff2222;
    this.wallHPBar.fillStyle(color);
    this.wallHPBar.fillRect(barX, 28, barWidth * pct, 8);

    this.wallHPText.setText(`Muralla: ${this.wallHP}/${this.wallMaxHP}`);
  }

  destroy(): void {
    this.container.destroy();
    this.characterPortraits.destroy();
    if (this.formationBtn) this.formationBtn.destroy();
  }
}

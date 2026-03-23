import Phaser from 'phaser';
import { GAME_WIDTH, MAP_OFFSET_Y, MAP_HEIGHT } from '../core/Constants';
import { eventBus } from '../core/EventBus';

export interface WaveEnemyCount {
  enemyId: string;
  name: string;
  total: number;
  alive: number;
}

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

  // Wave tooltip
  private waveTooltip: Phaser.GameObjects.Container | null = null;
  private waveEnemyCounts: WaveEnemyCount[] = [];
  private totalWaves = 0;

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

    // Wall HP bar (positioned between start button and resources)
    this.wallHPBar = scene.add.graphics();
    this.container.add(this.wallHPBar);

    this.wallHPText = scene.add.text(720, 8, '🏰 100/100', {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(this.wallHPText);

    // Wave info (left side, replaces old "Ola: N")
    this.waveText = scene.add.text(10, 8, 'Ronda 0', {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
      backgroundColor: '#00000000', padding: { x: 4, y: 2 },
    }).setInteractive();
    this.container.add(this.waveText);

    // Hover for wave tooltip
    this.waveText.on('pointerover', () => {
      this.waveText.setStroke('#ffff44', 2);
      this.showWaveTooltip();
    });
    this.waveText.on('pointerout', () => {
      this.waveText.setStroke('', 0);
      this.hideWaveTooltip();
    });

    this.timerText = scene.add.text(10, 26, '', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    });
    this.container.add(this.timerText);

    // Resources
    this.goldText = scene.add.text(GAME_WIDTH - 150, 8, '💰 0', {
      fontSize: '13px', color: '#ffcc00', fontFamily: 'monospace',
    });
    this.container.add(this.goldText);

    this.crystalText = scene.add.text(GAME_WIDTH - 150, 24, '💎 0', {
      fontSize: '13px', color: '#88ddff', fontFamily: 'monospace',
    });
    this.container.add(this.crystalText);

    // Character portraits container (bottom bar area, below the map)
    this.characterPortraits = scene.add.container(10, MAP_OFFSET_Y + MAP_HEIGHT + 40).setDepth(100);

    this.drawWallHP();
    this.setupEvents();
  }

  private setupEvents(): void {
    eventBus.on('wall:damaged', (_hp: unknown, _maxHp: unknown) => {
      const prevHP = this.wallHP;
      this.wallHP = _hp as number;
      this.wallMaxHP = _maxHp as number;
      this.drawWallHP();
      // Flash red when damaged
      if (this.wallHP < prevHP) {
        this.wallHPText.setColor('#ff4444');
        this.scene.time.delayedCall(300, () => {
          this.wallHPText.setColor('#ffffff');
        });
      }
    });

    eventBus.on('wave:start', (wave: unknown) => {
      this.currentWave = wave as number;
      this.waveText.setText(`Ronda ${this.currentWave}/${this.totalWaves}`);
    });

    eventBus.on('resources:update', (gold: unknown, crystals: unknown) => {
      this.gold = gold as number;
      this.crystals = crystals as number;
      this.goldText.setText(`💰 ${this.gold}`);
      this.crystalText.setText(`💎 ${this.crystals}`);
    });
  }

  setTotalWaves(total: number): void {
    this.totalWaves = total;
    this.currentWave = 0;
    this.waveText.setText(`Ronda 0/${this.totalWaves}`);
  }

  setWaveEnemies(enemies: WaveEnemyCount[]): void {
    this.waveEnemyCounts = enemies;
    // Update tooltip if visible
    if (this.waveTooltip) {
      this.hideWaveTooltip();
      this.showWaveTooltip();
    }
  }

  onEnemyKilled(enemyId: string): void {
    const entry = this.waveEnemyCounts.find(e => e.enemyId === enemyId);
    if (entry && entry.alive > 0) {
      entry.alive--;
      // Update tooltip if visible
      if (this.waveTooltip) {
        this.hideWaveTooltip();
        this.showWaveTooltip();
      }
    }
  }

  private showWaveTooltip(): void {
    this.hideWaveTooltip();

    const alive = this.waveEnemyCounts.filter(e => e.alive > 0);
    if (alive.length === 0 && this.waveEnemyCounts.length === 0) return;

    this.waveTooltip = this.scene.add.container(0, 0).setDepth(210);

    const tooltipX = 10;
    const tooltipY = 42;
    const rowH = 28;
    const tooltipW = 180;
    const padding = 6;

    const rows = alive.length > 0 ? alive : [{ enemyId: '', name: 'Sin enemigos', total: 0, alive: 0 }];
    const tooltipH = rows.length * rowH + padding * 2;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x111122, 0.95);
    bg.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
    bg.lineStyle(2, 0xffcc00);
    bg.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);
    this.waveTooltip.add(bg);

    rows.forEach((entry, i) => {
      const ry = tooltipY + padding + i * rowH;

      if (entry.enemyId) {
        // Enemy sprite
        const spriteKey = this.scene.textures.exists(entry.enemyId) ? entry.enemyId : 'character-placeholder';
        const sprite = this.scene.add.sprite(tooltipX + 16, ry + rowH / 2, spriteKey)
          .setScale(0.6).setDepth(211);
        if (this.scene.anims.exists(entry.enemyId + '_walk')) {
          sprite.play(entry.enemyId + '_walk');
        }
        this.waveTooltip!.add(sprite);

        // Name + count
        const countColor = entry.alive <= 0 ? '#444444' : '#ffffff';
        const txt = this.scene.add.text(tooltipX + 34, ry + rowH / 2, `${entry.name} x${entry.alive}`, {
          fontSize: '13px', color: countColor, fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        this.waveTooltip!.add(txt);
      } else {
        const txt = this.scene.add.text(tooltipX + tooltipW / 2, ry + rowH / 2, entry.name, {
          fontSize: '13px', color: '#888888', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.waveTooltip!.add(txt);
      }
    });
  }

  private hideWaveTooltip(): void {
    if (this.waveTooltip) {
      this.waveTooltip.destroy();
      this.waveTooltip = null;
    }
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
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);

      this.characterPortraits.add([bg, hpBar, nameText]);
    });
  }

  private drawWallHP(): void {
    this.wallHPBar.clear();
    const barWidth = 140;
    const barX = 720 - barWidth / 2;
    const pct = this.wallHP / this.wallMaxHP;

    // Background
    this.wallHPBar.fillStyle(0x333333);
    this.wallHPBar.fillRect(barX, 24, barWidth, 8);

    // HP fill
    const color = pct > 0.5 ? 0x44cc44 : pct > 0.2 ? 0xffaa00 : 0xff2222;
    this.wallHPBar.fillStyle(color);
    this.wallHPBar.fillRect(barX, 24, barWidth * pct, 8);

    this.wallHPText.setText(`🏰 ${this.wallHP}/${this.wallMaxHP}`);
  }

  hide(): void {
    this.container.setVisible(false);
    this.characterPortraits.setVisible(false);
    if (this.formationBtn) this.formationBtn.setVisible(false);
    this.hideWaveTooltip();
  }

  show(): void {
    this.container.setVisible(true);
    this.characterPortraits.setVisible(true);
    if (this.formationBtn) this.formationBtn.setVisible(true);
  }

  destroy(): void {
    this.container.destroy();
    this.characterPortraits.destroy();
    if (this.formationBtn) this.formationBtn.destroy();
  }
}

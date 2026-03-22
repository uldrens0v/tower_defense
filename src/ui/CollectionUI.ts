import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';
import type { CharacterData } from '../entities/characters/CharacterData';
import type { CharacterInstance } from '../entities/characters/CharacterData';
import { RARITY_CONFIG, type RarityTier } from '../systems/rng/RaritySystem';
import { eventBus } from '../core/EventBus';

export class CollectionUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private detailContainer: Phaser.GameObjects.Container | null = null;

  private ultimateProgress: Map<string, number> = new Map();
  private ownedInstances: Map<string, CharacterInstance> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(260).setVisible(false);
  }

  show(
    allCharacters: CharacterData[],
    ownedIds: Set<string>,
    ultimateProgress: Map<string, number>,
    ownedInstances?: Map<string, CharacterInstance>,
  ): void {
    this.container.removeAll(true);
    if (this.detailContainer) {
      this.detailContainer.destroy();
      this.detailContainer = null;
    }

    this.ultimateProgress = ultimateProgress;
    this.ownedInstances = ownedInstances ?? new Map();

    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.9);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, 12, 'Colección de Personajes', {
      fontSize: '20px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Stats summary
    const totalOwned = allCharacters.filter(c => ownedIds.has(c.id)).length;
    const summary = this.scene.add.text(GAME_WIDTH / 2, 36, `${totalOwned} / ${allCharacters.length} personajes desbloqueados`, {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(summary);

    // Sort by rarity
    const rarityOrder: RarityTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'];
    const sorted = [...allCharacters].sort((a, b) =>
      rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
    );

    // Character list (left side, scrollable grid)
    const listX = 20;
    const listY = 58;
    const cardW = 130;
    const cardH = 50;
    const cols = 3;
    const gap = 6;

    sorted.forEach((char, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = listX + col * (cardW + gap);
      const y = listY + row * (cardH + gap);
      const owned = ownedIds.has(char.id);
      const config = RARITY_CONFIG[char.rarity];

      // Card bg
      const g = this.scene.add.graphics();
      g.fillStyle(owned ? 0x1a1a3a : 0x111111, 0.95);
      g.fillRect(x, y, cardW, cardH);
      g.lineStyle(2, owned ? config.color : 0x333333);
      g.strokeRect(x, y, cardW, cardH);
      this.container.add(g);

      // Rarity indicator bar at top
      const rarBar = this.scene.add.graphics();
      rarBar.fillStyle(config.color, owned ? 0.8 : 0.2);
      rarBar.fillRect(x + 2, y + 2, cardW - 4, 3);
      this.container.add(rarBar);

      // Name
      const name = this.scene.add.text(x + cardW / 2, y + 16, owned ? char.name : '???', {
        fontSize: '13px',
        color: owned ? '#ffffff' : '#555555',
        fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      this.container.add(name);

      // Rarity + type
      const typeLabels: Record<string, string> = { ground: 'Tierra', aerial: 'Aéreo', support: 'Soporte', commander: 'Comandante' };
      const subLabel = this.scene.add.text(x + cardW / 2, y + 30, owned ? `${config.label} · ${typeLabels[char.type] ?? char.type}` : config.label, {
        fontSize: '8px', color: config.colorHex, fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      this.container.add(subLabel);

      // Click to show detail
      if (owned) {
        const hitArea = this.scene.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH)
          .setInteractive().setAlpha(0.01);
        hitArea.on('pointerdown', () => this.showDetail(char));
        hitArea.on('pointerover', () => {
          g.clear();
          g.fillStyle(0x2a2a5a, 0.95);
          g.fillRect(x, y, cardW, cardH);
          g.lineStyle(2, 0xffffff);
          g.strokeRect(x, y, cardW, cardH);
        });
        hitArea.on('pointerout', () => {
          g.clear();
          g.fillStyle(0x1a1a3a, 0.95);
          g.fillRect(x, y, cardW, cardH);
          g.lineStyle(2, config.color);
          g.strokeRect(x, y, cardW, cardH);
        });
        this.container.add(hitArea);
      }
    });

    // Close button
    const closeBtn = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 25, '[ ESC / Cerrar ]', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#222222', padding: { x: 15, y: 6 },
    }).setOrigin(0.5).setInteractive();
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    // Hint text
    const hint = this.scene.add.text(640, 300, 'Selecciona un personaje\npara ver sus detalles', {
      fontSize: '14px', color: '#555555', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);
    this.container.add(hint);

    // ESC to close
    this.scene.input.keyboard?.once('keydown-ESC', () => {
      if (this.container.visible) this.hide();
    });

    this.container.setVisible(true);
  }

  private showDetail(char: CharacterData): void {
    if (this.detailContainer) {
      this.detailContainer.destroy();
    }

    this.detailContainer = this.scene.add.container(0, 0).setDepth(261);

    const panelX = 440;
    const panelY = 55;
    const panelW = 560;
    const panelH = 470;
    const config = RARITY_CONFIG[char.rarity];

    const dc = this.detailContainer;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x12122a, 0.98);
    bg.fillRect(panelX, panelY, panelW, panelH);
    bg.lineStyle(2, config.color);
    bg.strokeRect(panelX, panelY, panelW, panelH);
    dc.add(bg);

    // Rarity bar top
    const topBar = this.scene.add.graphics();
    topBar.fillStyle(config.color, 0.6);
    topBar.fillRect(panelX, panelY, panelW, 4);
    dc.add(topBar);
    const cx = panelX + panelW / 2;
    let ty = panelY + 14;

    // Character sprite
    const spriteKey = this.scene.textures.exists(char.id) ? char.id : `troop_${char.type}`;
    const charSprite = this.scene.add.sprite(cx, ty + 20, spriteKey).setScale(1.5).setDepth(262);
    dc.add(charSprite);
    ty += 46;

    // Name
    const nameText = this.scene.add.text(cx, ty, char.name, {
      fontSize: '18px', color: config.colorHex, fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    dc.add(nameText);
    ty += 22;

    // Rarity + type
    const typeLabels: Record<string, string> = { ground: 'Tierra', aerial: 'Aéreo', support: 'Soporte', commander: 'Comandante' };
    const subText = this.scene.add.text(cx, ty, `${config.label} · ${typeLabels[char.type] ?? char.type}`, {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    dc.add(subText);
    ty += 20;

    // Get instance for level info
    const instance = this.ownedInstances.get(char.id);

    // Level & XP
    if (instance) {
      const lvlText = `Nivel ${instance.level} / ${char.maxLevel}`;
      const xpText = instance.level < char.maxLevel
        ? `XP: ${instance.currentXP} / ${instance.xpToNextLevel()}`
        : 'Nivel Máximo';
      const levelLine = this.scene.add.text(cx, ty, `${lvlText}  ·  ${xpText}`, {
        fontSize: '14px', color: '#88cc88', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      dc.add(levelLine);
      ty += 16;

      // XP bar
      if (instance.level < char.maxLevel) {
        const barW = 200;
        const barH = 6;
        const barX = cx - barW / 2;
        const xpPct = instance.currentXP / instance.xpToNextLevel();
        const xpBar = this.scene.add.graphics();
        xpBar.fillStyle(0x333333);
        xpBar.fillRect(barX, ty, barW, barH);
        xpBar.fillStyle(0x44cc44);
        xpBar.fillRect(barX, ty, barW * xpPct, barH);
        dc.add(xpBar);
        ty += 14;
      }
    }

    ty += 6;

    // ── Stats ──
    const statsTitle = this.scene.add.text(panelX + 20, ty, '── Estadísticas Base ──', {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
    });
    dc.add(statsTitle);
    ty += 18;

    const stats = instance ? instance.getFinalStats() : char.baseStats;
    const statsLabel = instance ? '(con nivel y equipo)' : '(base)';

    const statRows: [string, string, keyof typeof stats][] = [
      ['❤', 'HP', 'hp'],
      ['🗡', 'Ataque', 'attack'],
      ['🛡', 'Defensa', 'defense'],
      ['⚡', 'Vel.Atq', 'attackSpeed'],
      ['◎', 'Rango', 'range'],
      ['👢', 'Vel.Mov', 'moveSpeed'],
    ];

    // Two columns of stats
    const col1X = panelX + 30;
    const col2X = panelX + panelW / 2 + 10;

    const labelInfo = this.scene.add.text(panelX + panelW - 20, ty - 2, statsLabel, {
      fontSize: '8px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(1, 0);
    dc.add(labelInfo);

    statRows.forEach(([icon, label, key], i) => {
      const sx = i < 3 ? col1X : col2X;
      const sy = ty + (i % 3) * 18;
      const val = typeof stats[key] === 'number'
        ? (Number.isInteger(stats[key]) ? stats[key].toString() : (stats[key] as number).toFixed(2))
        : String(stats[key]);

      const iconText = this.scene.add.text(sx, sy, icon, {
        fontSize: '14px', fontFamily: 'monospace',
      });
      dc.add(iconText);
      const statLine = this.scene.add.text(sx + 18, sy, `${label}: ${val}`, {
        fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
      });
      dc.add(statLine);
    });
    ty += 3 * 18 + 10;

    // ── Growth per level ──
    const growthTitle = this.scene.add.text(panelX + 20, ty, '── Crecimiento por Nivel ──', {
      fontSize: '14px', color: '#88aaff', fontFamily: 'monospace',
    });
    dc.add(growthTitle);
    ty += 18;

    const growth = char.statGrowthPerLevel;
    const growthStr = [
      `HP +${growth.hp}`,
      `ATK +${growth.attack}`,
      `DEF +${growth.defense}`,
      `VelAtk +${growth.attackSpeed}`,
      `Rango +${growth.range}`,
      `Vel +${growth.moveSpeed}`,
    ].join('  ·  ');

    const growthLine = this.scene.add.text(panelX + 30, ty, growthStr, {
      fontSize: '12px', color: '#8888aa', fontFamily: 'monospace',
      wordWrap: { width: panelW - 60 },
    });
    dc.add(growthLine);
    ty += 24;

    // ── Passive Skill ──
    if (char.passiveSkill) {
      const passiveTitle = this.scene.add.text(panelX + 20, ty, '── Habilidad Pasiva ──', {
        fontSize: '14px', color: '#44ffaa', fontFamily: 'monospace',
      });
      dc.add(passiveTitle);
      ty += 18;

      const passiveLine = this.scene.add.text(panelX + 30, ty, `${char.passiveSkill.name}: ${char.passiveSkill.description}`, {
        fontSize: '13px', color: '#aaddcc', fontFamily: 'monospace',
        wordWrap: { width: panelW - 60 },
      });
      dc.add(passiveLine);
      ty += 24;
    }

    // ── Ultimate Skill ──
    if (char.ultimateSkill) {
      const ultTitle = this.scene.add.text(panelX + 20, ty, '── Habilidad Definitiva ──', {
        fontSize: '14px', color: '#ff8844', fontFamily: 'monospace',
      });
      dc.add(ultTitle);
      ty += 18;

      const ult = char.ultimateSkill;
      const ultInfo = [
        `${ult.name}: ${ult.description}`,
        `Daño: ${ult.damage}  ·  Radio: ${ult.aoeRadius}  ·  CD: ${ult.cooldown}s  ·  Nivel mín: ${ult.minLevel}`,
      ].join('\n');

      const ultLine = this.scene.add.text(panelX + 30, ty, ultInfo, {
        fontSize: '13px', color: '#ddaa88', fontFamily: 'monospace',
        wordWrap: { width: panelW - 60 },
      });
      dc.add(ultLine);
      ty += 36;

      // Ultimate progress bar
      const progress = this.ultimateProgress.get(char.id) ?? 0;
      if (char.requiredEquipment.length > 0) {
        const reqLabel = this.scene.add.text(panelX + 30, ty, `Equipo requerido: ${char.requiredEquipment.length} piezas (${Math.floor(progress * 100)}%)`, {
          fontSize: '12px', color: '#aa8866', fontFamily: 'monospace',
        });
        dc.add(reqLabel);
        ty += 14;

        const barW = panelW - 80;
        const progressBar = this.scene.add.graphics();
        progressBar.fillStyle(0x333333);
        progressBar.fillRect(panelX + 30, ty, barW, 8);
        progressBar.fillStyle(progress >= 1 ? 0x44ff44 : 0xff8800);
        progressBar.fillRect(panelX + 30, ty, barW * progress, 8);
        progressBar.lineStyle(1, 0x555555);
        progressBar.strokeRect(panelX + 30, ty, barW, 8);
        dc.add(progressBar);
        ty += 16;
      }
    }

    // ── Equipment ──
    if (instance && instance.equipment.length > 0) {
      const eqTitle = this.scene.add.text(panelX + 20, ty, '── Equipo Actual ──', {
        fontSize: '14px', color: '#ccaa44', fontFamily: 'monospace',
      });
      dc.add(eqTitle);
      ty += 18;

      for (const eq of instance.equipment) {
        const icon = eq.buffActive ? '✦' : '○';
        const color = eq.buffActive ? '#ffdd44' : '#666666';
        const eqLine = this.scene.add.text(panelX + 30, ty, `${icon} ${eq.itemId} ${eq.buffActive ? '(activo)' : '(inactivo)'}`, {
          fontSize: '13px', color, fontFamily: 'monospace',
        });
        dc.add(eqLine);
        ty += 14;
      }
    }

    // Multiplier info
    ty = panelY + panelH - 22;
    const multText = this.scene.add.text(cx, ty, `Multiplicador de rareza: x${config.statMultiplier.toFixed(1)}`, {
      fontSize: '12px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    dc.add(multText);
  }

  hide(): void {
    this.container.setVisible(false);
    if (this.detailContainer) {
      this.detailContainer.destroy();
      this.detailContainer = null;
    }
    eventBus.emit('collection:closed');
  }

  destroy(): void {
    this.container.destroy();
    if (this.detailContainer) {
      this.detailContainer.destroy();
    }
  }
}

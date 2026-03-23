import Phaser from 'phaser';
import { eventBus } from '../core/EventBus';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, MAP_OFFSET_X, MAP_OFFSET_Y, MAP_HEIGHT, BOTTOM_BAR_Y } from '../core/Constants';
import { GridMap, TileType } from '../core/GridMap';
import type { LevelData } from '../core/GridMap';
import { SaveSystem } from '../core/SaveSystem';
import { ThemeMusic } from '../core/ThemeMusic';
import { CharacterManager } from '../entities/characters/CharacterManager';
import type { EnemyData, EnemyInstance } from '../entities/enemies/EnemyData';
import { createEnemyInstance } from '../entities/enemies/EnemyData';
import { DefenseSystem } from '../systems/combat/DefenseSystem';
import { EnemyAI } from '../systems/combat/EnemyAI';
import { DungeonGenerator } from '../systems/dungeon/DungeonGenerator';
import type { DungeonData } from '../systems/dungeon/DungeonGenerator';
import { ChestSystem } from '../systems/dungeon/ChestSystem';
import { EquipmentSystem } from '../systems/dungeon/EquipmentSystem';
import type { ItemData } from '../systems/dungeon/EquipmentSystem';
import { CommanderSystem } from '../systems/commander/CommanderSystem';
import { ProgressionSystem } from '../systems/progression/ProgressionSystem';
import { HUD } from '../ui/HUD';
import { TroopSidePanel } from '../ui/TroopSidePanel';
import { MenuPanel } from '../ui/MenuPanel';
import { DungeonUI } from '../ui/DungeonUI';
import { CollectionUI } from '../ui/CollectionUI';
import type { TowerData } from '../entities/towers/TowerEntity';
import { TargetType } from '../entities/towers/TowerEntity';
import { SoundFX } from '../core/SoundFX';
import { MathChallenge, TypingChallenge, MemoryChallenge } from '../ui/DungeonChallenges';
import { TroopSystem } from '../systems/combat/TroopSystem';
import { TutorialPanel } from '../ui/TutorialPanel';

import levelsData from '../data/levels.json';
import charactersData from '../data/characters.json';
import enemiesData from '../data/enemies.json';
import itemsData from '../data/items.json';

type GameState = 'preparing' | 'playing' | 'between_waves' | 'dungeon' | 'game_over' | 'victory';

const AVAILABLE_TOWERS: TowerData[] = [
  { id: 'tower_arrow', name: 'Torre de Flechas', targetType: TargetType.GROUND, damage: 25, attackSpeed: 1.4, range: 4, cost: 50, projectileSpeed: 22, aoeRadius: 0, description: 'Daño rápido a terrestres' },
  { id: 'tower_cannon', name: 'Cañón', targetType: TargetType.GROUND, damage: 60, attackSpeed: 0.5, range: 3, cost: 80, projectileSpeed: 14, aoeRadius: 1.5, description: 'Daño AoE a terrestres' },
  { id: 'tower_antiair', name: 'Balista Aérea', targetType: TargetType.AERIAL, damage: 35, attackSpeed: 1.0, range: 5, cost: 70, projectileSpeed: 24, aoeRadius: 0, description: 'Solo ataca aéreos' },
  { id: 'tower_magic', name: 'Torre Arcana', targetType: TargetType.BOTH, damage: 30, attackSpeed: 0.9, range: 4, cost: 100, projectileSpeed: 16, aoeRadius: 1, description: 'Ataca todo' },
];

export class GameScene extends Phaser.Scene {
  // Systems
  private saveSystem!: SaveSystem;
  private characterManager!: CharacterManager;
  private defenseSystem!: DefenseSystem;
  private enemyAI!: EnemyAI;
  private dungeonGenerator!: DungeonGenerator;
  private currentDungeon: DungeonData | null = null;
  private currentDungeonLevel = -1;
  private chestSystem!: ChestSystem;
  private equipmentSystem!: EquipmentSystem;
  private commanderSystem!: CommanderSystem;
  private progressionSystem!: ProgressionSystem;

  // Map
  private gridMap!: GridMap;
  private tileSprites: Phaser.GameObjects.Sprite[] = [];

  // Game state
  private gameState: GameState = 'playing';
  private currentLevelIndex = 0;
  private currentWaveIndex = 0;
  private gold = 1000;
  private crystals = 0;
  private wallHP = 100;
  private wallMaxHP = 100;

  // Enemies
  private activeEnemies: EnemyInstance[] = [];
  private enemySprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private enemyDB: Map<string, EnemyData> = new Map();
  private spawnQueue: { enemyId: string; spawnPoint: { x: number; y: number } }[] = [];
  private spawnTimer = 0;
  private spawnInterval = 800;

  // Tower placement
  private selectedTowerIndex = -1;
  private towerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private projectileSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private inputZones: Phaser.GameObjects.Zone[] = [];

  // UI
  private hud!: HUD;
  private troopSidePanel!: TroopSidePanel;
  private menuPanel!: MenuPanel;
  private dungeonUI!: DungeonUI;
  private collectionUI!: CollectionUI;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private bottomBarContainers: Phaser.GameObjects.Container[] = []; // all bottom bar UI
  private menuBtn: Phaser.GameObjects.Text | null = null;
  private enemyHPBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private enemyHPTexts: Map<string, Phaser.GameObjects.Text> = new Map();

  // Preparation phase UI
  private startWaveBtn: Phaser.GameObjects.Text | null = null;

  // Range toggle
  private showRanges = false;
  private rangeGraphics: Phaser.GameObjects.Graphics | null = null;
  private rangeToggleBtn: Phaser.GameObjects.Text | null = null;

  // Game over UI
  private gameOverContainer: Phaser.GameObjects.Container | null = null;

  // Pause state
  private gamePaused = false;
  private tutorialActive = true;
  private inSubmenu = false;
  private autoplay = false;
  private autoplayBtn: Phaser.GameObjects.Text | null = null;

  // Speed control
  private speedMultiplier = 1;
  private speedBtn: Phaser.GameObjects.Text | null = null;

  // Placement preview
  private previewSprite: Phaser.GameObjects.Sprite | null = null;
  private previewRangeGraphics: Phaser.GameObjects.Graphics | null = null;
  private hoverRangeGraphics: Phaser.GameObjects.Graphics | null = null;

  // Music
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  private themeMusic: ThemeMusic = new ThemeMusic();

  // Troop system
  private troopSystem!: TroopSystem;
  private selectedCharacterId: string | null = null;
  private troopSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private troopProjectileGraphics: Phaser.GameObjects.Graphics | null = null;
  private troopDropdownContainer: Phaser.GameObjects.Container | null = null;
  private troopDropdownPage = 0;
  private troopTooltip: Phaser.GameObjects.Container | null = null;
  private troopTooltipTimer: Phaser.Time.TimerEvent | null = null;
  private towerTooltip: Phaser.GameObjects.Container | null = null;
  private towerTooltipTimer: Phaser.Time.TimerEvent | null = null;

  // Troop projectile sprites
  private troopProjSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  // Melee hit particles
  private hitParticles: { sprite: Phaser.GameObjects.Sprite; life: number }[] = [];

  // VFX particles (trails, impacts, death effects)
  private vfxParticles: {
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number;
    color: number; size: number;
    type: 'trail' | 'impact' | 'death' | 'slash';
  }[] = [];
  private vfxGraphics: Phaser.GameObjects.Graphics | null = null;
  // Projectile trail history
  private projTrails: Map<string, { x: number; y: number }[]> = new Map();
  // Impact rings
  private impactRings: { x: number; y: number; radius: number; maxRadius: number; life: number; color: number }[] = [];
  // Ultimate VFX
  private ultimateEffects: {
    type: string; x: number; y: number; life: number; maxLife: number;
    radius: number; color: number; targetX?: number; targetY?: number;
  }[] = [];
  // Persistent glow on troops with active buff ultimates
  private ultimateGlows: Map<string, { color: number }> = new Map();
  // Ultimate charge bar graphics
  private ultChargeGraphics: Phaser.GameObjects.Graphics | null = null;

  // Floating damage/gold texts
  private floatingTexts: { text: Phaser.GameObjects.Text; life: number; vy: number }[] = [];

  // Kill counter per wave
  private waveKills = 0;
  private waveKillText: Phaser.GameObjects.Text | null = null;

  // Level name display
  private levelNameText: Phaser.GameObjects.Text | null = null;

  // Projectile texture per character
  private static readonly CHAR_PROJ_MAP: Record<string, string> = {
    char_archer: 'proj_arrow',
    char_scout: 'proj_arrow',
    char_mage: 'proj_fire',
    char_ranger: 'proj_bolt',
    char_archmage: 'proj_magic',
    char_healer_basic: 'proj_sting',
    char_priest: 'proj_frost',
    char_lookout: 'proj_holy',
    char_hawk_rider: 'proj_iron',
    char_seraph: 'proj_holy',
    char_phoenix: 'proj_energy',
  };

  // Hit particle per character type
  private static readonly TYPE_HIT_MAP: Record<string, string> = {
    ground: 'hit_sparkle',
    aerial: 'hit_frost',
    support: 'hit_sparkle2',
    commander: 'hit_explosion',
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    try {
      this.initSystems();
      this.drawExteriorBars();
      this.loadLevel(this.currentLevelIndex);
      this.createUI();
      this.setupInput();
      this.setupEventListeners();

      // Show tutorial before starting the game
      this.tutorialActive = true;
      new TutorialPanel(this, () => {
        this.tutorialActive = false;
        this.enterPreparationPhase(0);
        eventBus.emit('game:ready');
      });

      // Keyboard shortcuts
      this.input.keyboard?.on('keydown-SPACE', () => {
        if (this.gamePaused || this.menuPanel.isVisible() || this.inSubmenu) return;
        if (this.gameState === 'preparing') {
          this.playSfx('sfx_click');
          this.startWave(this.currentWaveIndex);
        }
      });
      this.input.keyboard?.on('keydown-A', () => {
        if (this.gamePaused || this.inSubmenu) return;
        this.autoplay = !this.autoplay;
        this.playSfx('sfx_click');
        this.updateAutoplayBtn();
      });
      this.input.keyboard?.on('keydown-S', () => {
        if (this.gamePaused || this.inSubmenu) return;
        this.playSfx('sfx_click');
        this.speedMultiplier = this.speedMultiplier === 1 ? 3 : 1;
        this.updateSpeedBtnVisual();
      });
      // Number keys 1-4 select towers
      for (let i = 0; i < 4; i++) {
        this.input.keyboard?.on(`keydown-${i + 1}`, () => {
          if (this.gamePaused || this.menuPanel.isVisible() || this.inSubmenu) return;
          this.playSfx('sfx_click');
          this.selectedTowerIndex = this.selectedTowerIndex === i ? -1 : i;
          this.selectedCharacterId = null;
          this.hideTroopDropdown();
          this.updateTowerButtonHighlights();
        });
      }

      console.log('[TD] GameScene create() completed successfully. State:', this.gameState);
    } catch (e) {
      console.error('[TD] Error in create():', e);
    }
  }

  private initSystems(): void {
    this.saveSystem = new SaveSystem();
    this.characterManager = new CharacterManager();
    this.dungeonGenerator = new DungeonGenerator();
    this.chestSystem = new ChestSystem();
    this.equipmentSystem = new EquipmentSystem();
    this.commanderSystem = new CommanderSystem();
    this.progressionSystem = new ProgressionSystem();
    this.enemyAI = new EnemyAI();

    // Load databases
    this.characterManager.loadCharacterDatabase(charactersData as never[]);
    this.equipmentSystem.loadItemDatabase(itemsData as ItemData[]);

    for (const enemy of enemiesData) {
      this.enemyDB.set(enemy.id, enemy as EnemyData);
    }

    // Load save if exists (only load persistent stats, NOT level progress)
    if (this.saveSystem.load()) {
      const data = this.saveSystem.getData();
      // Always start at level 0 on page reload so all levels are playable
      this.currentLevelIndex = 0;
      this.crystals = data.crystals;
      this.gold = 1000;
      this.wallHP = this.wallMaxHP;
    }
    // Reset saved level index to 0
    this.saveSystem.updateData({ currentLevelIndex: 0, currentWave: 0 });

    this.characterManager.load();
    this.equipmentSystem.load();

    // Unlock all characters for testing
    for (const char of this.characterManager.getAllCharacterData()) {
      if (!this.characterManager.getOwnedCharacter(char.id)) {
        this.characterManager.addOwnedCharacter(char);
      }
    }

    console.log('[TD] Systems initialized. Level:', this.currentLevelIndex, 'Gold:', this.gold, 'WallHP:', this.wallHP);
  }

  private loadLevel(levelIndex: number): void {
    // Clean up old sprites
    for (const sprite of this.tileSprites) sprite.destroy();
    this.tileSprites = [];

    // Reset troop side panel for the new level
    if (this.troopSidePanel) this.troopSidePanel.reset();

    const levelData = levelsData[levelIndex] as LevelData;
    this.gridMap = new GridMap(levelData);
    this.defenseSystem = new DefenseSystem(this.gridMap);
    this.troopSystem = new TroopSystem();

    // Render tiles
    for (let y = 0; y < this.gridMap.rows; y++) {
      for (let x = 0; x < this.gridMap.cols; x++) {
        const tile = this.gridMap.getTile(x, y);
        const theme = this.gridMap.getTheme();
        const suffix = theme !== 'prairie' ? `-${theme}` : '';
        let textureKey = 'tile-buildable' + suffix;
        if (tile === TileType.PATH || tile === TileType.SPAWN || tile === TileType.EXIT) textureKey = 'tile-path' + suffix;
        else if (tile === TileType.WALL) textureKey = 'tile-wall' + suffix;
        else if (tile === TileType.DECORATION) textureKey = 'tile-decoration' + suffix;
        // Fallback to default if themed texture doesn't exist
        if (!this.textures.exists(textureKey)) {
          textureKey = textureKey.replace(suffix, '');
        }

        const world = this.gridMap.gridToWorld(x, y);
        const sprite = this.add.sprite(world.x, world.y, textureKey).setDepth(0);
        this.tileSprites.push(sprite);
      }
    }

    // Render wall sprite at exit point
    const exitPt = this.gridMap.getExitPoint();
    const exitWorld = this.gridMap.gridToWorld(exitPt.x, exitPt.y);
    const wallSprite = this.add.sprite(exitWorld.x, exitWorld.y, 'wall_gate').setDepth(2);
    this.tileSprites.push(wallSprite);

    // Show level name
    this.showLevelName();
  }

  private isTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /** Draw dark bars at top and bottom, outside the map area */
  private drawExteriorBars(): void {
    const bars = this.add.graphics().setDepth(50);
    // Top bar background (HUD area)
    bars.fillStyle(0x0a0a1a, 1);
    bars.fillRect(0, 0, GAME_WIDTH, MAP_OFFSET_Y);
    // Bottom bar background (buttons area)
    bars.fillStyle(0x0a0a1a, 1);
    bars.fillRect(0, MAP_OFFSET_Y + MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT - MAP_OFFSET_Y - MAP_HEIGHT);
    // Thin border lines separating bars from map
    bars.lineStyle(1, 0x333344, 0.8);
    bars.lineBetween(0, MAP_OFFSET_Y, GAME_WIDTH, MAP_OFFSET_Y);
    bars.lineBetween(0, MAP_OFFSET_Y + MAP_HEIGHT, GAME_WIDTH, MAP_OFFSET_Y + MAP_HEIGHT);
  }

  private createUI(): void {
    this.hud = new HUD(this);
    this.troopSidePanel = new TroopSidePanel(this);
    this.troopSidePanel.setUltChargeCost(this.troopSystem.getUltChargeCost());
    this.menuPanel = new MenuPanel(this);
    this.menuPanel.hasTowers = () => this.defenseSystem.getTowers().length > 0;
    this.menuPanel.isRoundActive = () => this.gameState === 'playing';
    this.dungeonUI = new DungeonUI(this);
    this.collectionUI = new CollectionUI(this);

    // Autoplay button (always visible in top bar)
    this.updateAutoplayBtn();

    const touch = this.isTouch();

    // Menu button (☰) - replaces ESC key
    const menuBtnSize = touch ? '22px' : '18px';
    this.menuBtn = this.add.text(GAME_WIDTH - 30, 14, '☰', {
      fontSize: menuBtnSize, color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#222233', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(250).setInteractive();
    this.menuBtn.on('pointerdown', () => {
      if (this.tutorialActive || this.inSubmenu) return;
      this.playSfx('sfx_click');
      if (this.menuPanel.isVisible()) this.menuPanel.hide();
      else if (this.gameState !== 'game_over' && this.gameState !== 'victory' && this.gameState !== 'dungeon') {
        this.menuPanel.show();
      }
    });
    this.menuBtn.on('pointerover', () => this.menuBtn?.setStroke('#ffff44', 2));
    this.menuBtn.on('pointerout', () => this.menuBtn?.setStroke('', 0));

    // Troop button (left of tower buttons)
    this.createTroopButton();

    // Tower selection buttons at bottom
    const btnH = touch ? 36 : 30;
    const btnW = touch ? 110 : 100;
    const fontSize = touch ? '10px' : '9px';
    const btnY = BOTTOM_BAR_Y; // stick to bottom edge
    const btnSpacing = touch ? 118 : 120;
    const btnStartX = (touch ? 190 : 200) + MAP_OFFSET_X;

    AVAILABLE_TOWERS.forEach((tower, i) => {
      const btnX = btnStartX + i * btnSpacing;
      const container = this.add.container(btnX, btnY).setDepth(100);

      const bg = this.add.graphics();
      bg.fillStyle(0x333333, 0.9);
      bg.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
      container.add(bg);

      const txt = this.add.text(0, 0, `${tower.name}\n$${tower.cost}`, {
        fontSize, color: '#ffffff', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5);
      container.add(txt);

      const border = this.add.graphics();
      container.add(border);

      const hitArea = this.add.rectangle(0, 0, btnW, btnH).setInteractive();
      hitArea.setAlpha(0.01);
      hitArea.on('pointerdown', () => {
        if (this.menuPanel.isVisible()) return;
        this.playSfx('sfx_click');
        this.selectedTowerIndex = this.selectedTowerIndex === i ? -1 : i;
        this.selectedCharacterId = null; // deselect troop
        this.hideTroopDropdown();
        this.updateTowerButtonHighlights();
      });
      hitArea.on('pointerover', () => {
        border.clear();
        border.lineStyle(2, 0x888888);
        border.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
        if (!touch) {
          this.hideTowerTooltip();
          this.towerTooltipTimer = this.time.delayedCall(1500, () => {
            this.showTowerTooltip(i, btnX, btnY - btnH / 2);
          });
        }
      });
      hitArea.on('pointerout', () => {
        border.clear();
        if (!touch) this.hideTowerTooltip();
      });
      container.add(hitArea);
      this.towerButtons.push(container);
    });

    this.createRangeToggleButton();
    this.createSpeedButton();
    this.updateResources();
  }

  private setupInput(): void {
    // Destroy old input zones
    for (const z of this.inputZones) z.destroy();
    this.inputZones = [];

    // Make all buildable tiles interactive for tower placement
    for (let y = 0; y < this.gridMap.rows; y++) {
      for (let x = 0; x < this.gridMap.cols; x++) {
        if (this.gridMap.isBuildable(x, y)) {
          const world = this.gridMap.gridToWorld(x, y);
          const zone = this.add.zone(world.x, world.y, TILE_SIZE, TILE_SIZE)
            .setInteractive()
            .setDepth(1);

          // Preview on hover
          zone.on('pointerover', () => {
            this.showPlacementPreview(world.x, world.y, this.towerSprites.has(`${x},${y}`));
            // Show range on hover for placed units (when global ranges are off)
            if (!this.showRanges) {
              this.showHoverRange(x, y);
            }
          });
          zone.on('pointerout', () => {
            this.clearPlacementPreview();
            this.clearHoverRange();
          });

          zone.on('pointerdown', (_pointer: Phaser.Input.Pointer) => {
            // Right-click: sell tower/troop or cancel selection
            if (_pointer.rightButtonDown()) {
              if (this.towerSprites.has(`${x},${y}`)) {
                this.sellTowerAt(x, y);
              } else if (this.troopSystem) {
                const troop = this.troopSystem.getTroops().find(t => t.homeGridX === x && t.homeGridY === y);
                if (troop) {
                  this.troopSystem.removeTroop(troop.id);
                  const sprite = this.troopSprites.get(troop.id);
                  if (sprite) { sprite.destroy(); this.troopSprites.delete(troop.id); }
                  this.clearHoverRange();
                  SoundFX.towerSell();
                }
              }
              return;
            }
            if (this.gameState !== 'playing' && this.gameState !== 'preparing') return;
            if (this.menuPanel.isVisible()) return;

            // Troop placement
            if (this.selectedCharacterId) {
              const charInst = this.characterManager.getOwnedCharacter(this.selectedCharacterId);
              if (!charInst) return;
              const hasTower = this.towerSprites.has(`${x},${y}`);
              const placed = this.troopSystem.placeTroop(charInst, x, y, world.x, world.y, hasTower);
              if (placed) {
                const textureKey = this.textures.exists(charInst.data.id) ? charInst.data.id : `troop_${charInst.data.type}`;
                const sprite = this.add.sprite(placed.worldX, placed.worldY, textureKey).setDepth(12);
                if (hasTower) sprite.setScale(0.7);
                this.troopSprites.set(charInst.data.id, sprite);
                placed.sprite = sprite;
                this.selectedCharacterId = null;
                this.clearPlacementPreview();
                this.playSfx('sfx_place');
              }
              return;
            }

            if (this.selectedTowerIndex < 0) return;

            const tower = AVAILABLE_TOWERS[this.selectedTowerIndex];
            if (this.gold < tower.cost) {
              return;
            }

            const placed = this.defenseSystem.placeTower(tower, x, y);
            if (placed) {
              // Apply global type level to newly placed tower
              placed.level = this.getTowerTypeLevel(tower.id);
              this.gold -= tower.cost;
              this.updateResources();

              const sprite = this.add.sprite(placed.worldX, placed.worldY, tower.id).setDepth(5);
              this.towerSprites.set(`${x},${y}`, sprite);
              placed.sprite = sprite;
              this.applyTowerLevelVisual(sprite, placed.level, tower.id);

              this.selectedTowerIndex = -1;
              this.updateTowerButtonHighlights();
              this.clearPlacementPreview();
              this.playSfx('sfx_place');
              SoundFX.towerPlace();
            } else {
              console.log('[TD] Cannot place tower at', x, y, '(already occupied?)');
            }
          });
        }
      }
    }

    // Right-click cancels tower/troop selection
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.selectedTowerIndex >= 0 || this.selectedCharacterId) {
          this.selectedTowerIndex = -1;
          this.selectedCharacterId = null;
          this.updateTowerButtonHighlights();
          this.clearPlacementPreview();
          this.hideTroopDropdown();
        }
      }
    });

    // Prevent browser context menu on the game canvas
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private setupEventListeners(): void {
    // Melee hit particles
    eventBus.on('troop:meleeHit', (...args: unknown[]) => {
      this.spawnMeleeHitParticle(args[0] as number, args[1] as number, args[2] as string);
    });

    eventBus.on('enemy:killed', (enemy: unknown) => {
      const e = enemy as EnemyInstance;
      this.gold += e.data.goldReward;
      this.waveKills++;
      this.updateWaveKillText();

      // Floating gold text
      this.spawnFloatingText(e.worldX, e.worldY - 10, `+${e.data.goldReward}g`, '#ffcc00');
      SoundFX.goldEarned();

      // Update HUD wave enemy counter
      this.hud.onEnemyKilled(e.data.id);

      // Award XP to all owned characters
      for (const char of this.characterManager.getAllOwned()) {
        this.progressionSystem.addXP(char, e.data.xpReward);
      }

      this.updateResources();
      this.saveSystem.updateData({
        totalEnemiesKilled: (this.saveSystem.getData().totalEnemiesKilled ?? 0) + 1,
      });
    });

    eventBus.on('enemy:damaged', (...args: unknown[]) => {
      SoundFX.enemyHit();
      // Floating damage number
      const enemy = args[0] as EnemyInstance;
      const dmg = args[1] as number;
      if (enemy && dmg) {
        this.spawnFloatingText(
          enemy.worldX + (Math.random() - 0.5) * 12,
          enemy.worldY - 16,
          `-${dmg}`,
          dmg >= 20 ? '#ff4444' : '#ffaa66',
          dmg >= 20 ? '12px' : '9px'
        );
      }
    });

    // Ultimate ability VFX + sound
    eventBus.on('ultimate:activated', (data: unknown) => {
      SoundFX.ultimateActivate();
      this.spawnUltimateVFX(data as {
        troopId: string; charId: string; type: string;
        x: number; y: number; radius: number;
        targetX?: number; targetY?: number; duration?: number;
      });
    });

    eventBus.on('ultimate:ended', (data: unknown) => {
      const d = data as { troopId: string };
      this.ultimateGlows.delete(d.troopId);
    });

    eventBus.on('enemy:reached_end', (_enemy: unknown) => {
      this.wallHP -= 10;
      if (this.wallHP < 0) this.wallHP = 0;
      SoundFX.enemyReachEnd();
      eventBus.emit('wall:damaged', this.wallHP, this.wallMaxHP);

      // Screen shake
      this.cameras.main.shake(200, 0.008);

      // Red flash on wall
      const e = _enemy as EnemyInstance;
      this.spawnFloatingText(e.worldX, e.worldY - 6, '-10 HP', '#ff2222', '14px');

      if (this.wallHP <= 0) {
        this.cameras.main.shake(500, 0.02);
        this.gameState = 'game_over';
        this.showGameOver();
      }
    });

    eventBus.on('menu:dungeon', () => {
      this.inSubmenu = true;
      // Persist dungeon per level: only generate a new one when level changes
      if (!this.currentDungeon || this.currentDungeonLevel !== this.currentLevelIndex) {
        this.currentDungeon = this.dungeonGenerator.generate(this.currentLevelIndex + 1);
        this.currentDungeonLevel = this.currentLevelIndex;
      }
      this.dungeonUI.show(this.currentDungeon);
      this.gameState = 'dungeon';
      this.playMusic('music_dungeon');
    });

    eventBus.on('dungeon:enterRoom', (room: unknown) => {
      const r = room as { type: string; id: number; cleared: boolean };
      if (r.cleared) return;
      r.cleared = true;

      switch (r.type) {
        case 'rest':
          // Heal wall
          this.wallHP = Math.min(this.wallHP + 20, this.wallMaxHP);
          this.showDungeonReward('🏕 Descanso', ['Muralla +20 HP', `HP: ${this.wallHP}/${this.wallMaxHP}`]);
          eventBus.emit('wall:damaged', this.wallHP, this.wallMaxHP);
          break;

        case 'combat': {
          const goldReward = 50 + this.currentWaveIndex * 15;
          new MemoryChallenge(this, 1, (success, challenge) => {
            if (success) {
              this.gold += goldReward;
              this.updateResources();
              challenge.showResult('⚔ Victoria', [`+${goldReward} Oro`]);
            } else {
              this.wallHP = Math.max(0, this.wallHP - 25);
              eventBus.emit('wall:damaged', { current: this.wallHP, max: this.wallMaxHP });
              challenge.showResult('⚔ Derrota', ['La muralla recibe 25 de daño']);
              if (this.wallHP <= 0) {
                this.time.delayedCall(2600, () => this.showGameOver());
              }
            }
          });
          break;
        }

        case 'elite': {
          const eliteGold = 100 + this.currentWaveIndex * 20;
          new MemoryChallenge(this, 3, (success, challenge) => {
            if (success) {
              this.gold += eliteGold;
              this.updateResources();
              const charResult = this.tryRollCharacter();
              const lines = [`+${eliteGold} Oro`];
              if (charResult) lines.push(`¡Nuevo: ${charResult}!`);
              challenge.showResult('💀 Victoria Élite', lines);
            } else {
              this.wallHP = Math.max(0, this.wallHP - 25);
              eventBus.emit('wall:damaged', { current: this.wallHP, max: this.wallMaxHP });
              challenge.showResult('💀 Derrota', ['La muralla recibe 25 de daño']);
              if (this.wallHP <= 0) {
                this.time.delayedCall(2600, () => this.showGameOver());
              }
            }
          });
          break;
        }

        case 'boss': {
          // Typing challenge
          new TypingChallenge(this, (success, challenge) => {
            if (success) {
              this.playSfx('sfx_boss_win', 0.25);
              const bossGold = 200 + this.currentWaveIndex * 30;
              this.gold += bossGold;
              this.updateResources();
              const bossChar = this.tryRollCharacter(true);
              const bLines = [`+${bossGold} Oro`];
              if (bossChar) bLines.push(`¡Nuevo: ${bossChar}!`);
              else bLines.push('(ya tienes todos los personajes)');
              challenge.showResult('👹 Jefe derrotado', bLines);
            } else {
              // Boss defeat: stop all music and play long defeat music (no loop)
              this.stopMusic();
              this.playMusic('music_boss_defeat', false);
              this.gameState = 'game_over';
              challenge.showResult('👹 Derrota', ['El jefe te ha vencido...'], 2500);
              this.time.delayedCall(2600, () => this.showGameOver());
            }
          });
          break;
        }

        case 'chest': {
          // Math challenge before opening
          new MathChallenge(this, this.currentWaveIndex + 1, (success, challenge) => {
            if (success) {
              this.playSfx('sfx_chest_open', 0.4);
              const chestType = this.chestSystem.rollChestType(true);
              const result = this.chestSystem.openChest(chestType);
              this.processChestResultInPlace(result, challenge);
            } else {
              this.playSfx('sfx_chest_fail', 0.35);
              this.wallHP -= 10;
              if (this.wallHP < 0) this.wallHP = 0;
              eventBus.emit('wall:damaged', this.wallHP, this.wallMaxHP);
              challenge.showResult('📦 Cofre cerrado', ['Respuesta incorrecta', 'Muralla -10 HP']);
              if (this.wallHP <= 0) {
                this.gameState = 'game_over';
                this.showGameOver();
              }
            }
          });
          break;
        }
      }
    });

    eventBus.on('dungeon:exit', () => {
      this.inSubmenu = false;
      this.gameState = 'preparing';
      this.playMusic('music_menu');
      eventBus.emit('game:resume');
    });

    eventBus.on('menu:upgrade_towers', () => {
      this.inSubmenu = true;
      this.showUpgradeUI();
    });

    eventBus.on('menu:continue', () => {
      // If already playing, just resume (don't start a new wave)
      if (this.gameState === 'playing') return;
      if (this.gameState === 'preparing') {
        this.startWave(this.currentWaveIndex);
      }
    });

    eventBus.on('menu:collection', () => {
      this.inSubmenu = true;
      const ownedIds = new Set(this.characterManager.getAllOwned().map(c => c.data.id));
      const ultProgress = new Map<string, number>();
      const ownedInstances = new Map<string, import('../entities/characters/CharacterData').CharacterInstance>();
      for (const char of this.characterManager.getAllOwned()) {
        const progress = this.equipmentSystem.checkUltimateProgress(char);
        if (progress.requiredCount > 0) {
          ultProgress.set(char.data.id, progress.equippedCount / progress.requiredCount);
        }
        ownedInstances.set(char.data.id, char);
      }
      const ultCharges = this.troopSystem ? this.troopSystem.getUltimateCharges() : new Map();
      this.collectionUI.show(this.characterManager.getAllCharacterData(), ownedIds, ultProgress, ownedInstances, ultCharges);
    });

    eventBus.on('collection:closed', () => {
      this.inSubmenu = false;
      eventBus.emit('game:resume');
    });

    // Pause / Resume
    eventBus.on('game:pause', () => {
      this.gamePaused = true;
      this.physics.pause();
      this.sound.pauseAll();
      this.hideScenario();
      this.hideGameUI();
    });
    eventBus.on('menu:escPressed', () => {
      if (this.tutorialActive) return;
      if (this.inSubmenu) return;
      if (this.gameState === 'dungeon') return;
      if (this.gameState === 'game_over' || this.gameState === 'victory') return;
      this.menuPanel.show();
    });
    eventBus.on('game:resume', () => {
      this.gamePaused = false;
      this.physics.resume();
      this.sound.resumeAll();
      this.showScenario();
      this.showGameUI();
    });
  }

  /** Hide the game scenario (tiles, towers, troops, enemies, projectiles, HP bars) */
  private hideScenario(): void {
    for (const s of this.tileSprites) s.setVisible(false);
    for (const s of this.towerSprites.values()) s.setVisible(false);
    for (const s of this.troopSprites.values()) s.setVisible(false);
    for (const s of this.enemySprites.values()) s.setVisible(false);
    for (const s of this.projectileSprites.values()) s.setVisible(false);
    for (const g of this.enemyHPBars.values()) g.setVisible(false);
    for (const t of this.enemyHPTexts.values()) t.setVisible(false);
    for (const s of this.troopProjSprites.values()) s.setVisible(false);
    if (this.rangeGraphics) this.rangeGraphics.setVisible(false);
    if (this.previewRangeGraphics) this.previewRangeGraphics.setVisible(false);
    if (this.hoverRangeGraphics) this.hoverRangeGraphics.setVisible(false);
    if (this.troopProjectileGraphics) this.troopProjectileGraphics.setVisible(false);
    if (this.waveKillText) this.waveKillText.setVisible(false);
    if (this.levelNameText) this.levelNameText.setVisible(false);
  }

  /** Show the game scenario */
  private showScenario(): void {
    for (const s of this.tileSprites) s.setVisible(true);
    for (const s of this.towerSprites.values()) s.setVisible(true);
    for (const s of this.troopSprites.values()) s.setVisible(true);
    for (const s of this.enemySprites.values()) s.setVisible(true);
    for (const s of this.projectileSprites.values()) s.setVisible(true);
    for (const g of this.enemyHPBars.values()) g.setVisible(true);
    for (const t of this.enemyHPTexts.values()) t.setVisible(true);
    for (const s of this.troopProjSprites.values()) s.setVisible(true);
    if (this.rangeGraphics) this.rangeGraphics.setVisible(true);
    if (this.troopProjectileGraphics) this.troopProjectileGraphics.setVisible(true);
    if (this.waveKillText) this.waveKillText.setVisible(true);
    if (this.levelNameText) this.levelNameText.setVisible(true);
  }

  /** Hide all game UI (HUD, bottom bar, start button, menu btn) for submenus */
  private hideGameUI(): void {
    this.hud.hide();
    this.troopSidePanel.hide();
    if (this.startWaveBtn) this.startWaveBtn.setVisible(false);
    if (this.menuBtn) this.menuBtn.setVisible(false);
    if (this.autoplayBtn) this.autoplayBtn.setVisible(false);
    for (const c of this.towerButtons) c.setVisible(false);
    for (const c of this.bottomBarContainers) c.setVisible(false);
    this.hideTroopDropdown();
    this.hideTowerTooltip();
    this.hideTroopTooltip();
  }

  /** Show all game UI after returning from a submenu */
  private showGameUI(): void {
    this.hud.show();
    this.troopSidePanel.show();
    if (this.startWaveBtn) this.startWaveBtn.setVisible(true);
    if (this.menuBtn) this.menuBtn.setVisible(true);
    if (this.autoplayBtn) this.autoplayBtn.setVisible(true);
    for (const c of this.towerButtons) c.setVisible(true);
    for (const c of this.bottomBarContainers) c.setVisible(true);
  }

  private buildWaveEnemyCounts(enemies: { enemyId: string; count: number }[]): import('../ui/HUD').WaveEnemyCount[] {
    const map = new Map<string, { enemyId: string; name: string; total: number; alive: number }>();
    for (const e of enemies) {
      const existing = map.get(e.enemyId);
      if (existing) {
        existing.total += e.count;
        existing.alive += e.count;
      } else {
        const data = this.enemyDB.get(e.enemyId);
        map.set(e.enemyId, { enemyId: e.enemyId, name: data?.name ?? e.enemyId, total: e.count, alive: e.count });
      }
    }
    return Array.from(map.values());
  }

  private startWave(waveIndex: number): void {
    const waves = this.gridMap.getWaves();
    if (waveIndex >= waves.length) {
      this.gameState = 'victory';
      this.showVictory();
      return;
    }

    // Clean preparation UI
    this.clearPreparationUI();

    this.currentWaveIndex = waveIndex;
    this.gameState = 'playing';
    this.waveKills = 0;
    if (this.waveKillText) { this.waveKillText.destroy(); this.waveKillText = null; }
    // Play theme-specific procedural music
    const theme = this.gridMap.getTheme();
    this.stopMusic();
    this.themeMusic.play(theme);
    const wave = waves[waveIndex];

    eventBus.emit('wave:start', waveIndex + 1);

    // Reset ultimate charges for new round
    if (this.troopSystem) {
      this.troopSystem.resetUltimateCharges();
    }

    // Update HUD enemy counts for this wave
    this.hud.setWaveEnemies(this.buildWaveEnemyCounts(wave.enemies));

    // Build spawn queue
    this.spawnQueue = [];
    const spawnPoints = this.gridMap.getSpawnPoints();

    for (const waveEnemy of wave.enemies) {
      const sp = spawnPoints[waveEnemy.spawnPointIndex] ?? spawnPoints[0];
      for (let i = 0; i < waveEnemy.count; i++) {
        this.spawnQueue.push({ enemyId: waveEnemy.enemyId, spawnPoint: sp });
      }
    }

    this.spawnTimer = 0;
    this.spawnInterval = wave.timeBetweenSpawns;

    console.log('[TD] Wave', waveIndex + 1, 'started. Enemies queued:', this.spawnQueue.length, 'Interval:', this.spawnInterval);
  }

  private debugLogged = false;

  update(_time: number, delta: number): void {
    if (!this.debugLogged) {
      console.log('[TD] First update tick. delta:', delta, 'state:', this.gameState, 'queue:', this.spawnQueue.length);
      this.debugLogged = true;
    }

    // Always update floating texts (even when paused)
    this.updateFloatingTexts(delta / 1000);

    // Pause game when menu is open or game is paused
    if (this.gamePaused || this.menuPanel.isVisible()) return;

    if (this.gameState === 'playing') {
      this.updatePlaying(delta * this.speedMultiplier);
    }

    // Update range circles if toggled on
    this.updateRangeGraphics();

    this.commanderSystem.update(delta);
  }

  private updatePlaying(delta: number): void {
    // Spawn enemies
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += delta;
      while (this.spawnTimer >= this.spawnInterval && this.spawnQueue.length > 0) {
        this.spawnTimer -= this.spawnInterval;
        const toSpawn = this.spawnQueue.shift()!;
        this.spawnEnemy(toSpawn.enemyId, toSpawn.spawnPoint);
      }
    }

    // Update defense system
    this.defenseSystem.update(delta, this.activeEnemies);

    // Update enemy AI (enemies only follow path to wall)
    this.enemyAI.update(delta, this.activeEnemies);

    // Update troop system
    this.troopSystem.update(delta, this.activeEnemies);
    this.updateTroopSprites();
    this.troopSidePanel.update(this.troopSystem.getTroops(), this.troopSystem.getUltimateCharges());

    // Update enemy sprites
    this.updateEnemySprites();

    // Update projectile sprites
    this.updateProjectileSprites();
    this.updateTroopProjectiles();
    this.updateHitParticles(delta / 1000);
    this.updateUltimateVFX(delta / 1000);

    // Clean up dead enemies
    this.cleanDeadEnemies();

    // Check if wave is complete
    if (this.spawnQueue.length === 0 && this.activeEnemies.length === 0) {
      this.onWaveComplete();
    }
  }

  private spawnEnemy(enemyId: string, spawnPoint: { x: number; y: number }): void {
    const data = this.enemyDB.get(enemyId);
    if (!data) {
      console.warn('[TD] Enemy not found in DB:', enemyId);
      return;
    }

    const exit = this.gridMap.getExitPoint();
    let path: { x: number; y: number }[] | null;

    // All enemies follow the A* path (aerial ones just move faster visually)
    path = this.gridMap.findPath(spawnPoint.x, spawnPoint.y, exit.x, exit.y);

    if (!path || path.length === 0) {
      console.warn('[TD] No path found from', spawnPoint, 'to', exit, '- using straight line');
      // Fallback: straight line path
      path = [spawnPoint, exit];
    }

    const world = this.gridMap.gridToWorld(spawnPoint.x, spawnPoint.y);
    const enemy = createEnemyInstance(data, world.x, world.y, path);
    this.activeEnemies.push(enemy);

    const spriteKey = this.textures.exists(data.id) ? data.id : 'character-placeholder';
    const sprite = this.add.sprite(world.x, world.y, spriteKey)
      .setDepth(10);

    // Play walk animation if available
    const animKey = data.id + '_walk';
    if (this.anims.exists(animKey)) {
      sprite.play(animKey);
    }

    this.enemySprites.set(enemy.id, sprite);
    enemy.sprite = sprite;

    console.log('[TD] Spawned', data.name, 'at', world.x.toFixed(0), world.y.toFixed(0), 'path length:', path.length);
  }

  private updateEnemySprites(): void {
    for (const enemy of this.activeEnemies) {
      if (enemy.currentHP <= 0) continue;

      const sprite = this.enemySprites.get(enemy.id);
      if (sprite) {
        sprite.setPosition(enemy.worldX, enemy.worldY);
      }

      // HP bar
      let hpBar = this.enemyHPBars.get(enemy.id);
      if (!hpBar) {
        hpBar = this.add.graphics().setDepth(20);
        this.enemyHPBars.set(enemy.id, hpBar);
      }
      hpBar.clear();
      const barW = 28;
      const barH = 4;
      const barX = enemy.worldX - barW / 2;
      const barY = enemy.worldY - 20;
      const pct = Math.max(0, enemy.currentHP / enemy.data.hp);

      // Background
      hpBar.fillStyle(0x000000, 0.7);
      hpBar.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      // HP fill
      const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffaa00 : 0xff2222;
      hpBar.fillStyle(color);
      hpBar.fillRect(barX, barY, barW * pct, barH);

      // HP text
      const hpStr = `${Math.ceil(enemy.currentHP)}/${enemy.data.hp}`;
      let hpText = this.enemyHPTexts.get(enemy.id);
      if (!hpText) {
        hpText = this.add.text(0, 0, '', {
          fontSize: '8px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(21);
        this.enemyHPTexts.set(enemy.id, hpText);
      }
      hpText.setText(hpStr);
      hpText.setPosition(enemy.worldX, barY - 7);
    }
  }

  // Projectile visual config per tower type
  private static readonly PROJ_STYLES: Record<string, { color: number; size: number; shape: 'circle' | 'diamond' | 'bolt' | 'star'; trailColor: number; trailLen: number }> = {
    tower_arrow:   { color: 0xffdd44, size: 5, shape: 'bolt',    trailColor: 0xffaa00, trailLen: 6 },
    tower_cannon:  { color: 0xff6600, size: 7, shape: 'circle',  trailColor: 0xff3300, trailLen: 4 },
    tower_antiair: { color: 0x44ccff, size: 6, shape: 'diamond', trailColor: 0x2288cc, trailLen: 8 },
    tower_magic:   { color: 0xcc44ff, size: 6, shape: 'star',    trailColor: 0x8822cc, trailLen: 7 },
  };

  private projectileGraphics: Phaser.GameObjects.Graphics | null = null;
  // Track previous projectile positions for impact detection
  private prevProjPositions: Map<string, { x: number; y: number; towerId: string }> = new Map();

  private updateProjectileSprites(): void {
    // Clear old sprite-based projectiles (legacy cleanup)
    for (const sprite of this.projectileSprites.values()) {
      sprite.destroy();
    }
    this.projectileSprites.clear();

    if (!this.projectileGraphics) {
      this.projectileGraphics = this.add.graphics().setDepth(15);
    }
    this.projectileGraphics.clear();

    const projectiles = this.defenseSystem.getProjectiles();
    const activeProjKeys = new Set<string>();
    const time = this.time.now * 0.001;

    for (const proj of projectiles) {
      const style = GameScene.PROJ_STYLES[proj.towerId] ?? { color: 0xffffff, size: 5, shape: 'circle' as const, trailColor: 0x888888, trailLen: 4 };
      const g = this.projectileGraphics;
      const { x, y } = proj;
      const projKey = proj.id;
      activeProjKeys.add(projKey);

      // Update trail
      let trail = this.projTrails.get(projKey);
      if (!trail) {
        trail = [];
        this.projTrails.set(projKey, trail);
      }
      trail.push({ x, y });
      if (trail.length > style.trailLen) trail.shift();

      // Draw trail with fading segments
      for (let t = 0; t < trail.length - 1; t++) {
        const alpha = (t / trail.length) * 0.5;
        const width = (t / trail.length) * style.size * 0.8;
        g.lineStyle(Math.max(1, width), style.trailColor, alpha);
        g.beginPath();
        g.moveTo(trail[t].x, trail[t].y);
        g.lineTo(trail[t + 1].x, trail[t + 1].y);
        g.strokePath();
      }

      // Outer glow (pulsing)
      const pulse = 1 + Math.sin(time * 8) * 0.15;
      g.fillStyle(style.color, 0.15);
      g.fillCircle(x, y, (style.size + 5) * pulse);
      g.fillStyle(style.color, 0.3);
      g.fillCircle(x, y, (style.size + 2) * pulse);

      // Main projectile
      g.fillStyle(style.color, 0.95);
      g.lineStyle(1.5, 0xffffff, 0.7);

      switch (style.shape) {
        case 'circle': {
          g.fillCircle(x, y, style.size);
          g.strokeCircle(x, y, style.size);
          // Inner bright core
          g.fillStyle(0xffffff, 0.6);
          g.fillCircle(x, y, style.size * 0.4);
          break;
        }
        case 'diamond': {
          const s = style.size;
          const rot = time * 3;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const pts = [
            { dx: 0, dy: -s }, { dx: s * 0.7, dy: 0 },
            { dx: 0, dy: s }, { dx: -s * 0.7, dy: 0 },
          ].map(p => new Phaser.Geom.Point(
            x + p.dx * cos - p.dy * sin,
            y + p.dx * sin + p.dy * cos,
          ));
          g.fillPoints(pts, true);
          // Core
          g.fillStyle(0xffffff, 0.5);
          g.fillCircle(x, y, s * 0.3);
          break;
        }
        case 'bolt': {
          const s = style.size;
          // Rotating arrow shape
          const angle = trail.length >= 2
            ? Math.atan2(y - trail[trail.length - 2].y, x - trail[trail.length - 2].x)
            : 0;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rawPts = [
            { dx: s * 1.2, dy: 0 },
            { dx: -s * 0.5, dy: -s * 0.6 },
            { dx: -s * 0.2, dy: 0 },
            { dx: -s * 0.5, dy: s * 0.6 },
          ];
          const pts = rawPts.map(p => new Phaser.Geom.Point(
            x + p.dx * cos - p.dy * sin,
            y + p.dx * sin + p.dy * cos,
          ));
          g.fillPoints(pts, true);
          // Bright tip
          g.fillStyle(0xffffff, 0.7);
          g.fillCircle(x + cos * s * 0.6, y + sin * s * 0.6, 2);
          break;
        }
        case 'star': {
          const s = style.size;
          const rot = time * 4;
          const pts: Phaser.Geom.Point[] = [];
          for (let a = 0; a < 5; a++) {
            const angle1 = (a * 72 - 90) * Math.PI / 180 + rot;
            const angle2 = ((a * 72 + 36) - 90) * Math.PI / 180 + rot;
            pts.push(new Phaser.Geom.Point(x + Math.cos(angle1) * s, y + Math.sin(angle1) * s));
            pts.push(new Phaser.Geom.Point(x + Math.cos(angle2) * s * 0.35, y + Math.sin(angle2) * s * 0.35));
          }
          g.fillPoints(pts, true);
          // Magical sparkles around the star
          for (let sp = 0; sp < 3; sp++) {
            const sa = time * 6 + sp * 2.1;
            const sr = s * 1.3;
            g.fillStyle(0xffffff, 0.4 + Math.sin(sa * 2) * 0.3);
            g.fillCircle(x + Math.cos(sa) * sr, y + Math.sin(sa) * sr, 1.5);
          }
          break;
        }
      }

      // Spawn trail particles (VFX sparkles behind projectile)
      if (Math.random() > 0.5) {
        const spreadAngle = Math.random() * Math.PI * 2;
        const spreadSpeed = 8 + Math.random() * 15;
        this.vfxParticles.push({
          x: x + (Math.random() - 0.5) * 4,
          y: y + (Math.random() - 0.5) * 4,
          vx: Math.cos(spreadAngle) * spreadSpeed,
          vy: Math.sin(spreadAngle) * spreadSpeed,
          life: 0.15 + Math.random() * 0.15,
          maxLife: 0.3,
          color: style.trailColor,
          size: 1 + Math.random() * 1.5,
          type: 'trail',
        });
      }

      // Store position for impact detection
      this.prevProjPositions.set(projKey, { x, y, towerId: proj.towerId });
    }

    // Detect destroyed projectiles → spawn impact effects
    for (const [key, pos] of this.prevProjPositions) {
      if (!activeProjKeys.has(key)) {
        // Projectile was destroyed → impact!
        const style = GameScene.PROJ_STYLES[pos.towerId] ?? { color: 0xffffff, trailColor: 0x888888, size: 5, shape: 'circle' as const, trailLen: 4 };
        this.spawnImpactEffect(pos.x, pos.y, style.color);
        this.prevProjPositions.delete(key);
      }
    }

    // Clean up trails for dead projectiles
    for (const key of this.projTrails.keys()) {
      if (!activeProjKeys.has(key)) {
        this.projTrails.delete(key);
      }
    }
  }

  /** Spawn a ring + particle burst at impact point */
  private spawnImpactEffect(x: number, y: number, color: number): void {
    // Expanding ring
    this.impactRings.push({ x, y, radius: 2, maxRadius: 18, life: 0.3, color });
    // Second smaller ring (double ring)
    this.impactRings.push({ x, y, radius: 1, maxRadius: 10, life: 0.2, color: 0xffffff });

    // Central flash
    this.vfxParticles.push({
      x, y, vx: 0, vy: 0,
      life: 0.12, maxLife: 0.12,
      color: 0xffffff, size: 6, type: 'impact',
    });

    // Burst of particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 40 + Math.random() * 70;
      this.vfxParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        color,
        size: 1.5 + Math.random() * 2.5,
        type: 'impact',
      });
    }

    // Sparks (small, fast, bright)
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      this.vfxParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.1 + Math.random() * 0.1,
        maxLife: 0.2,
        color: 0xffffff,
        size: 1 + Math.random(),
        type: 'impact',
      });
    }
  }

  private cleanDeadEnemies(): void {
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (enemy.currentHP <= 0) {
        // Spawn death VFX
        this.spawnDeathEffect(enemy.worldX, enemy.worldY, 0xff4444);

        const sprite = this.enemySprites.get(enemy.id);
        if (sprite) {
          sprite.destroy();
          this.enemySprites.delete(enemy.id);
        }
        const hpBar = this.enemyHPBars.get(enemy.id);
        if (hpBar) {
          hpBar.destroy();
          this.enemyHPBars.delete(enemy.id);
        }
        const hpText = this.enemyHPTexts.get(enemy.id);
        if (hpText) {
          hpText.destroy();
          this.enemyHPTexts.delete(enemy.id);
        }
        this.activeEnemies.splice(i, 1);
      }
    }
  }

  private onWaveComplete(): void {
    SoundFX.waveComplete();

    // Wave completion gold bonus
    const bonus = 25 + this.currentWaveIndex * 10;
    this.gold += bonus;
    this.updateResources();

    // Show bonus text in center
    const bonusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
      `Ronda completada! +${bonus}g   ☠ ${this.waveKills} eliminados`, {
        fontSize: '14px', color: '#ffdd44', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: bonusText, y: bonusText.y - 40, alpha: 0,
      duration: 2000, ease: 'Power2',
      onComplete: () => bonusText.destroy(),
    });

    // Auto-save
    this.saveSystem.updateData({
      currentWave: this.currentWaveIndex,
      gold: this.gold,
      crystals: this.crystals,
      wallHP: this.wallHP,
    });
    this.saveSystem.save();
    this.characterManager.save();

    // Check if all waves done
    const waves = this.gridMap.getWaves();
    if (this.currentWaveIndex + 1 >= waves.length) {
      this.gameState = 'victory';
      this.showVictory();
      return;
    }

    // Enter preparation phase for next wave
    this.enterPreparationPhase(this.currentWaveIndex + 1);
  }

  private updateTowerButtonHighlights(): void {
    this.towerButtons.forEach((container, i) => {
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      bg.clear();
      if (i === this.selectedTowerIndex) {
        bg.fillStyle(0x44aa44, 0.9);
        bg.fillRect(-50, -15, 100, 30);
        bg.lineStyle(2, 0x88ff88);
        bg.strokeRect(-50, -15, 100, 30);
      } else {
        bg.fillStyle(0x333333, 0.9);
        bg.fillRect(-50, -15, 100, 30);
      }
    });
  }

  private updateResources(): void {
    eventBus.emit('resources:update', this.gold, this.crystals);
  }

  private processChestResultInPlace(result: { chestType: string; drops: { type: string; rarity: string; id: string }[] }, challenge: import('../ui/DungeonChallenges').MathChallenge): void {
    const lines = this.buildChestResultLines(result);
    this.updateResources();
    challenge.showResult('📦 Cofre abierto', lines);
  }

  private buildChestResultLines(result: { chestType: string; drops: { type: string; rarity: string; id: string }[] }): string[] {
    const lines: string[] = [];
    for (const drop of result.drops) {
      if (drop.type === 'character') {
        const charName = this.tryRollCharacter();
        if (charName) {
          lines.push(`🎭 ¡Personaje: ${charName}!`);
        } else {
          this.gold += 100;
          lines.push('💰 +100 Oro (personaje duplicado)');
        }
      } else {
        const goldValue = drop.rarity === 'common' ? 20 : drop.rarity === 'uncommon' ? 40 : drop.rarity === 'rare' ? 80 : 150;
        this.gold += goldValue;
        lines.push(`💰 +${goldValue} Oro (${drop.rarity})`);
      }
    }
    return lines;
  }

  /** Roll a random character from the DB that the player doesn't own yet */
  private tryRollCharacter(guaranteed = false): string | null {
    const allChars = this.characterManager.getAllCharacterData();
    const ownedIds = new Set(this.characterManager.getAllOwned().map(c => c.data.id));
    const unowned = allChars.filter(c => !ownedIds.has(c.id));

    if (unowned.length === 0) return null;

    if (!guaranteed && Math.random() > 0.4) return null;

    // Weight by rarity (common more likely)
    const rarityWeights: Record<string, number> = {
      common: 10, uncommon: 5, rare: 2, epic: 1, legendary: 0.3, mythic: 0.05, unique: 0.01,
    };
    const weighted = unowned.map(c => ({ char: c, weight: rarityWeights[c.rarity] ?? 1 }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) {
        this.characterManager.addOwnedCharacter(w.char);
        return w.char.name;
      }
    }

    // Fallback
    const pick = unowned[0];
    this.characterManager.addOwnedCharacter(pick);
    return pick.name;
  }

  private showDungeonReward(title: string, lines: string[]): void {
    const popup = this.add.text(512, 288, `${title}\n\n${lines.join('\n')}`, {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 25, y: 18 },
      align: 'center',
    }).setOrigin(0.5).setDepth(300);

    this.time.delayedCall(2500, () => popup.destroy());
  }

  private showGameOver(): void {
    // If boss defeat music is playing, keep it; otherwise stop and play defeat sfx
    if (this.currentMusicKey !== 'music_boss_defeat') {
      this.stopMusic();
      this.playSfx('sfx_defeat', 0.7);
    }

    // Hide all other UI elements
    this.clearPreparationUI();
    this.hideTroopDropdown();
    this.clearPlacementPreview();
    if (this.menuPanel.isVisible()) this.menuPanel.hide();
    if (this.dungeonUI.isVisible()) this.dungeonUI.hide();
    if (this.rangeGraphics) this.rangeGraphics.clear();

    this.gameOverContainer = this.add.container(0, 0).setDepth(300);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.gameOverContainer.add(overlay);

    const title = this.add.text(512, 160, '¡DERROTA!', {
      fontSize: '36px', color: '#ff2222', fontFamily: 'monospace',
      align: 'center', stroke: '#660000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.gameOverContainer.add(title);

    const subtitle = this.add.text(512, 210, 'La muralla ha caído', {
      fontSize: '16px', color: '#cc8888', fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    this.gameOverContainer.add(subtitle);

    // Stats
    const statsStr = `Ronda: ${this.currentWaveIndex + 1}/${this.gridMap.getWaves().length}  |  ☠ ${this.waveKills} eliminados`;
    const statsText = this.add.text(512, 245, statsStr, {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.gameOverContainer.add(statsText);

    // Level theme colors for button text
    const levelData = levelsData[this.currentLevelIndex] as LevelData;
    const levelName = levelData?.name ?? `Nivel ${this.currentLevelIndex + 1}`;
    const themeColor = GameScene.LEVEL_NAME_COLORS[this.currentLevelIndex] ?? '#ffffff';

    // Button: Retry current level — shows level name in themed color
    const retryContainer = this.add.container(512, 310);
    const retryBg = this.add.graphics();
    retryBg.fillStyle(0x442211, 0.95);
    retryBg.fillRoundedRect(-180, -22, 360, 44, 6);
    retryContainer.add(retryBg);

    const retryLabel = this.add.text(0, -6, '🔄 Reintentar desde', {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    retryContainer.add(retryLabel);

    const retryName = this.add.text(0, 12, `"${levelName}"`, {
      fontSize: '16px', color: themeColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    retryContainer.add(retryName);

    const retryHit = this.add.rectangle(0, 0, 360, 44).setInteractive().setAlpha(0.01);
    retryHit.on('pointerover', () => { retryBg.clear(); retryBg.fillStyle(0x663322, 1); retryBg.fillRoundedRect(-180, -22, 360, 44, 6); });
    retryHit.on('pointerout', () => { retryBg.clear(); retryBg.fillStyle(0x442211, 0.95); retryBg.fillRoundedRect(-180, -22, 360, 44, 6); });
    retryHit.on('pointerdown', () => { this.playSfx('sfx_click'); this.restartAtLevel(this.currentLevelIndex); });
    retryContainer.add(retryHit);
    this.gameOverContainer.add(retryContainer);

    // Button: Restart from level 1
    const firstLevelName = (levelsData[0] as LevelData)?.name ?? 'Nivel 1';
    const firstColor = GameScene.LEVEL_NAME_COLORS[0] ?? '#ffffff';

    const restartContainer = this.add.container(512, 390);
    const restartBg = this.add.graphics();
    restartBg.fillStyle(0x221144, 0.95);
    restartBg.fillRoundedRect(-180, -22, 360, 44, 6);
    restartContainer.add(restartBg);

    const restartLabel = this.add.text(0, -6, '⏮ Comenzar desde', {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    restartContainer.add(restartLabel);

    const restartName = this.add.text(0, 12, `"${firstLevelName}"`, {
      fontSize: '16px', color: firstColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    restartContainer.add(restartName);

    const restartHit = this.add.rectangle(0, 0, 360, 44).setInteractive().setAlpha(0.01);
    restartHit.on('pointerover', () => { restartBg.clear(); restartBg.fillStyle(0x332266, 1); restartBg.fillRoundedRect(-180, -22, 360, 44, 6); });
    restartHit.on('pointerout', () => { restartBg.clear(); restartBg.fillStyle(0x221144, 0.95); restartBg.fillRoundedRect(-180, -22, 360, 44, 6); });
    restartHit.on('pointerdown', () => { this.playSfx('sfx_click'); this.restartAtLevel(0); });
    restartContainer.add(restartHit);
    this.gameOverContainer.add(restartContainer);
  }

  /** Themed colors for each level name in UI */
  private static readonly LEVEL_NAME_COLORS: string[] = [
    '#88dd44', // Pradera del Inicio — verde prado
    '#44cc88', // Bosque Encantado — verde bosque
    '#aaaacc', // Montaña del Dragón — gris piedra
    '#aa44ff', // Abismo Oscuro — púrpura oscuro
    '#ff4444', // Trono del Caos — rojo caos
    '#ffaa44', // Desierto Abrasador — naranja ámbar
    '#6688cc', // Caverna Cristalina — azul cristal
    '#44dd66', // Jungla Venenosa — verde tropical
  ];

  private restartAtLevel(levelIndex: number, resetHP: boolean = true): void {
    // Reset dungeon when changing level
    if (levelIndex !== this.currentLevelIndex) {
      this.currentDungeon = null;
      this.currentDungeonLevel = -1;
    }

    // Stop ALL sounds (music + SFX like defeat jingle)
    this.themeMusic.stop();
    this.sound.stopAll();
    this.currentMusic = null;
    this.currentMusicKey = null;

    // Clean game over / victory UI
    if (this.gameOverContainer) {
      this.gameOverContainer.destroy();
      this.gameOverContainer = null;
    }
    if (this.victoryContainer) {
      this.victoryContainer.destroy();
      this.victoryContainer = null;
    }

    this.currentLevelIndex = levelIndex;
    this.gold = 1000;
    if (resetHP) this.wallHP = this.wallMaxHP;
    this.gamePaused = false;
    this.inSubmenu = false;
    // Reset speed and autoplay
    this.speedMultiplier = 1;
    this.autoplay = false;
    this.cleanAllState();
    this.loadLevel(this.currentLevelIndex);
    this.setupInput();
    this.showScenario();
    this.showGameUI();
    this.updateResources();
    this.updateSpeedBtnVisual();
    this.updateAutoplayBtn();
    eventBus.emit('wall:damaged', this.wallHP, this.wallMaxHP);
    this.enterPreparationPhase(0);
  }

  private victoryContainer: Phaser.GameObjects.Container | null = null;

  private showVictory(): void {
    this.stopMusic();
    this.playSfx('sfx_victory', 0.7);
    SoundFX.waveComplete();

    // Advance level index
    const hasNextLevel = this.currentLevelIndex < levelsData.length - 1;
    if (hasNextLevel) {
      this.currentLevelIndex++;
      this.gold = 1000;
      this.saveSystem.updateData({
        currentLevelIndex: this.currentLevelIndex,
        gold: this.gold,
      });
      this.saveSystem.save();
      this.updateResources();
    }

    // Clean old victory UI
    if (this.victoryContainer) {
      this.victoryContainer.destroy();
      this.victoryContainer = null;
    }

    this.victoryContainer = this.add.container(0, 0).setDepth(300);

    // Full overlay to block clicks below
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    this.victoryContainer.add(overlay);

    const victoryText = this.add.text(GAME_WIDTH / 2, 220, '¡VICTORIA!', {
      fontSize: '36px', color: '#ffd700', fontFamily: 'monospace',
      align: 'center', stroke: '#996600', strokeThickness: 3,
    }).setOrigin(0.5);
    this.victoryContainer.add(victoryText);

    const subtitleText = this.add.text(GAME_WIDTH / 2, 270, 'Nivel completado', {
      fontSize: '18px', color: '#e0e0e0', fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    this.victoryContainer.add(subtitleText);

    if (hasNextLevel) {
      const nextLevelData = levelsData[this.currentLevelIndex] as LevelData;
      const nextLevelName = nextLevelData?.name ?? `Nivel ${this.currentLevelIndex + 1}`;

      const nextLabel = this.add.text(GAME_WIDTH / 2, 330, `Ir al siguiente nivel:`, {
        fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.victoryContainer.add(nextLabel);

      const nextBtn = this.add.text(GAME_WIDTH / 2, 370, `▶ ${nextLevelName}`, {
        fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#2a5a2a', padding: { x: 24, y: 12 },
      }).setOrigin(0.5).setInteractive();
      this.victoryContainer.add(nextBtn);

      this.addHoverEffect(nextBtn, '#8fbc8f');
      nextBtn.on('pointerdown', () => {
        this.playSfx('sfx_click');
        this.restartAtLevel(this.currentLevelIndex, false);
      });
    } else {
      // All levels completed
      const endText = this.add.text(GAME_WIDTH / 2, 340, '¡Has completado todos los niveles!', {
        fontSize: '18px', color: '#ffcc00', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.victoryContainer.add(endText);

      const restartBtn = this.add.text(GAME_WIDTH / 2, 400, '⏮ Reiniciar desde el inicio', {
        fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#442222', padding: { x: 15, y: 8 },
      }).setOrigin(0.5).setInteractive();
      this.victoryContainer.add(restartBtn);

      this.addHoverEffect(restartBtn, '#ff8844');
      restartBtn.on('pointerdown', () => {
        this.playSfx('sfx_click');
        if (this.victoryContainer) {
          this.victoryContainer.destroy();
          this.victoryContainer = null;
        }
        this.restartAtLevel(0);
      });
    }
  }

  private cleanAllState(): void {
    // Destroy enemy sprites and HP bars
    for (const sprite of this.enemySprites.values()) sprite.destroy();
    this.enemySprites.clear();
    for (const bar of this.enemyHPBars.values()) bar.destroy();
    this.enemyHPBars.clear();
    for (const txt of this.enemyHPTexts.values()) txt.destroy();
    this.enemyHPTexts.clear();
    // Destroy tower sprites
    for (const sprite of this.towerSprites.values()) sprite.destroy();
    this.towerSprites.clear();
    // Destroy projectile sprites
    for (const sprite of this.projectileSprites.values()) sprite.destroy();
    this.projectileSprites.clear();
    if (this.projectileGraphics) {
      this.projectileGraphics.destroy();
      this.projectileGraphics = null;
    }
    // Destroy troop sprites
    for (const sprite of this.troopSprites.values()) sprite.destroy();
    this.troopSprites.clear();
    if (this.troopProjectileGraphics) {
      this.troopProjectileGraphics.destroy();
      this.troopProjectileGraphics = null;
    }
    // Destroy troop projectile sprites
    for (const sprite of this.troopProjSprites.values()) sprite.destroy();
    this.troopProjSprites.clear();
    // Destroy hit particles
    for (const p of this.hitParticles) p.sprite.destroy();
    this.hitParticles = [];
    // Destroy VFX systems
    this.vfxParticles = [];
    this.impactRings = [];
    this.projTrails.clear();
    this.prevProjPositions.clear();
    if (this.vfxGraphics) {
      this.vfxGraphics.destroy();
      this.vfxGraphics = null;
    }
    this.ultimateEffects = [];
    this.ultimateGlows.clear();
    if (this.ultChargeGraphics) {
      this.ultChargeGraphics.destroy();
      this.ultChargeGraphics = null;
    }
    if (this.troopSystem) this.troopSystem.clearAll();
    this.selectedCharacterId = null;
    this.hideTroopTooltip();
    this.hideTowerTooltip();
    this.clearPlacementPreview();
    this.clearHoverRange();
    // Clear floating texts
    for (const ft of this.floatingTexts) ft.text.destroy();
    this.floatingTexts = [];
    // Clear kill counter
    if (this.waveKillText) { this.waveKillText.destroy(); this.waveKillText = null; }
    this.waveKills = 0;
    // Clear level name
    if (this.levelNameText) { this.levelNameText.destroy(); this.levelNameText = null; }
    // Clear arrays
    this.activeEnemies = [];
    this.spawnQueue = [];
    this.currentWaveIndex = 0;
    this.towerTypeLevels.clear();
  }

  // ---- Tower Upgrade System ----
  // Track global upgrade level per tower type (applies to ALL towers of that type)
  private towerTypeLevels: Map<string, number> = new Map();

  private getTowerTypeLevel(typeId: string): number {
    return this.towerTypeLevels.get(typeId) ?? 1;
  }

  private showUpgradeUI(): void {
    const towers = this.defenseSystem.getTowers();
    if (towers.length === 0) return;

    // Group towers by type
    const typeGroups = new Map<string, { data: TowerData; count: number; level: number }>();
    for (const tower of towers) {
      const existing = typeGroups.get(tower.data.id);
      if (existing) {
        existing.count++;
      } else {
        typeGroups.set(tower.data.id, {
          data: tower.data,
          count: 1,
          level: this.getTowerTypeLevel(tower.data.id),
        });
      }
    }

    const types = Array.from(typeGroups.entries());

    const container = this.add.container(0, 0).setDepth(260);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    container.add(overlay);

    const title = this.add.text(512, 40, 'Mejorar Torres', {
      fontSize: '22px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(title);

    const subtitle = this.add.text(512, 68, 'La mejora se aplica a TODAS las torres de ese tipo', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(subtitle);

    const closeBtn = this.add.text(512, 520, '[ Cerrar ]', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive();
    closeBtn.on('pointerover', () => closeBtn.setStroke('#ffff44', 2));
    closeBtn.on('pointerout', () => closeBtn.setStroke('', 0));
    closeBtn.on('pointerdown', () => {
      container.destroy();
      this.inSubmenu = false;
      eventBus.emit('game:resume');
    });
    container.add(closeBtn);

    const cols = types.length;
    const spacing = 230;
    const startX = 512 - ((cols - 1) * spacing) / 2;

    types.forEach(([typeId, group], i) => {
      const tx = startX + i * spacing;
      const ty = 110;
      const level = group.level;
      const upgradeCost = this.getTypUpgradeCost(group.data, level);
      const currentDmg = group.data.damage * (1 + (level - 1) * 0.15);
      const nextDmg = group.data.damage * (1 + level * 0.15);
      const currentSpd = group.data.attackSpeed * (1 + (level - 1) * 0.05);
      const nextSpd = group.data.attackSpeed * (1 + level * 0.05);

      const card = this.add.graphics();
      card.fillStyle(0x222244, 0.95);
      card.fillRect(tx - 100, ty, 200, 280);
      card.lineStyle(2, 0x6666aa);
      card.strokeRect(tx - 100, ty, 200, 280);
      container.add(card);

      const lvKey = `${typeId}_lv${Math.min(level, GameScene.MAX_TOWER_LEVELS)}`;
      const iconTexture = this.textures.exists(lvKey) ? lvKey : typeId;
      const icon = this.add.sprite(tx, ty + 35, iconTexture).setDepth(261).setScale(1.5);
      container.add(icon);

      const info = this.add.text(tx, ty + 65, [
        group.data.name,
        `Cantidad: ${group.count}`,
        `Nivel: ${level}`,
        ``,
        `Daño: ${currentDmg.toFixed(0)} → ${nextDmg.toFixed(0)}`,
        `Vel. Ataque: ${currentSpd.toFixed(2)} → ${nextSpd.toFixed(2)}`,
        `Rango: ${group.data.range}`,
        group.data.description,
      ].join('\n'), {
        fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
        align: 'center', wordWrap: { width: 180 },
      }).setOrigin(0.5, 0);
      container.add(info);

      const canAfford = this.gold >= upgradeCost;
      const btnColor = canAfford ? '#44aa44' : '#664444';
      const upgradeBtn = this.add.text(tx, ty + 250, `⬆ Mejorar ($${upgradeCost})`, {
        fontSize: '13px', color: canAfford ? '#ffffff' : '#888888',
        fontFamily: 'monospace', backgroundColor: btnColor,
        padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive();

      this.addHoverEffect(upgradeBtn, canAfford ? '#44ff44' : '#ff4444');
      upgradeBtn.on('pointerdown', () => {
        if (this.gold >= upgradeCost) {
          this.gold -= upgradeCost;
          const newLevel = level + 1;
          this.towerTypeLevels.set(typeId, newLevel);
          // Apply level to ALL towers of this type + update visuals
          for (const tower of this.defenseSystem.getTowers()) {
            if (tower.data.id === typeId) {
              tower.level = newLevel;
              if (tower.sprite) {
                this.applyTowerLevelVisual(tower.sprite, newLevel, tower.data.id);
              }
            }
          }
          this.updateResources();
          SoundFX.towerUpgrade();
          container.destroy();
          this.showUpgradeUI(); // Refresh
        }
      });
      container.add(upgradeBtn);
    });
  }

  private getTypUpgradeCost(data: TowerData, currentLevel: number): number {
    return Math.floor(data.cost * 0.6 * currentLevel);
  }

  // ---- Preparation Phase ----
  private enterPreparationPhase(waveIndex: number): void {
    this.gameState = 'preparing';
    this.currentWaveIndex = waveIndex;
    this.playMusic('music_menu');

    const waves = this.gridMap.getWaves();
    const wave = waves[waveIndex];

    // Update HUD with wave enemy data
    this.hud.setTotalWaves(waves.length, waveIndex + 1);
    this.hud.setWaveEnemies(this.buildWaveEnemyCounts(wave.enemies));

    // Start wave button — top bar, between round info and wall HP
    this.startWaveBtn = this.add.text(MAP_OFFSET_X + 512, 10, '⚔ INICIAR RONDA [ESPACIO]', {
      fontSize: '13px', color: '#e0e0e0', fontFamily: 'monospace',
      backgroundColor: '#2a5a2a', padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0).setDepth(250).setInteractive().setAlpha(0);
    // Fade in animation
    this.tweens.add({ targets: this.startWaveBtn, alpha: 1, duration: 300 });

    this.startWaveBtn.on('pointerdown', () => {
      if (this.gameState !== 'preparing') return;
      this.playSfx('sfx_click');
      this.startWave(this.currentWaveIndex);
    });
    this.addHoverEffect(this.startWaveBtn, '#8fbc8f');

    this.updateResources();

    // Show shortcut hint on first wave
    if (waveIndex === 0 && this.currentLevelIndex === 0) {
      const hint = this.add.text(MAP_OFFSET_X + 512, 50, 'Atajos: 1-4 Torres | A Auto | S Velocidad | Click-der Vender torre', {
        fontSize: '9px', color: '#666688', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(250);
      this.time.delayedCall(8000, () => {
        this.tweens.add({ targets: hint, alpha: 0, duration: 1000, onComplete: () => hint.destroy() });
      });
    }

    console.log('[TD] Preparation phase for wave', waveIndex + 1);

    // If autoplay is on and this is NOT the first wave of a new level, auto-start
    if (this.autoplay && waveIndex > 0) {
      this.time.delayedCall(600, () => {
        if (this.gameState === 'preparing' && this.autoplay) {
          this.startWave(this.currentWaveIndex);
        }
      });
    }
  }

  private clearPreparationUI(): void {
    if (this.startWaveBtn) {
      this.startWaveBtn.destroy();
      this.startWaveBtn = null;
    }
    this.menuPanel.hide();
  }

  private updateAutoplayBtn(): void {
    if (this.autoplayBtn) {
      this.autoplayBtn.destroy();
      this.autoplayBtn = null;
    }
    const label = this.autoplay ? '▶▶ AUTO: ON' : '▶▶ AUTO: OFF';
    const bgColor = this.autoplay ? '#2a5a2a' : '#333333';
    const textColor = this.autoplay ? '#8fbc8f' : '#888888';

    this.autoplayBtn = this.add.text(MAP_OFFSET_X + 512, 32, label, {
      fontSize: '11px', color: textColor, fontFamily: 'monospace',
      backgroundColor: bgColor, padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0).setDepth(250).setInteractive();

    this.autoplayBtn.on('pointerdown', () => {
      this.autoplay = !this.autoplay;
      this.playSfx('sfx_click');
      this.updateAutoplayBtn();
    });

    this.autoplayBtn.on('pointerover', () => {
      this.autoplayBtn?.setStroke('#ffffff', 2);
    });
    this.autoplayBtn.on('pointerout', () => {
      this.autoplayBtn?.setStroke('', 0);
    });
  }

  // ---- Range Toggle ----
  private createRangeToggleButton(): void {
    const touch = this.isTouch();
    const bw = touch ? 110 : 100;
    const bh = touch ? 36 : 24;
    const cx = (touch ? 910 : 900) + MAP_OFFSET_X;
    const cy = BOTTOM_BAR_Y;
    const cont = this.add.container(cx, cy).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 0.9);
    bg.fillRect(-bw / 2, -bh / 2, bw, bh);
    cont.add(bg);

    this.rangeToggleBtn = this.add.text(0, 0, '◎ Rangos: OFF', {
      fontSize: touch ? '11px' : '11px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    cont.add(this.rangeToggleBtn);

    const border = this.add.graphics();
    cont.add(border);

    const hit = this.add.rectangle(0, 0, bw, bh).setInteractive().setAlpha(0.01);
    hit.on('pointerover', () => {
      border.clear();
      border.lineStyle(2, 0x44aaff);
      border.strokeRect(-bw / 2, -bh / 2, bw, bh);
    });
    hit.on('pointerout', () => { border.clear(); });
    hit.on('pointerdown', () => {
      this.playSfx('sfx_click');
      this.showRanges = !this.showRanges;
      if (this.rangeToggleBtn) {
        this.rangeToggleBtn.setText(this.showRanges ? '◎ Rangos: ON' : '◎ Rangos: OFF');
        this.rangeToggleBtn.setColor(this.showRanges ? '#44ff44' : '#aaaaaa');
      }
      if (!this.showRanges && this.rangeGraphics) {
        this.rangeGraphics.clear();
      }
    });
    cont.add(hit);
    this.bottomBarContainers.push(cont);
  }

  // ---- Speed Control ----
  private speedBg: Phaser.GameObjects.Graphics | null = null;
  private speedBorder: Phaser.GameObjects.Graphics | null = null;

  private createSpeedButton(): void {
    const touch = this.isTouch();
    const bw = touch ? 90 : 80;
    const bh = touch ? 36 : 24;
    const cx = (touch ? 800 : 790) + MAP_OFFSET_X;
    const cy = BOTTOM_BAR_Y;
    const cont = this.add.container(cx, cy).setDepth(100);

    this.speedBtnSize = { w: bw, h: bh };
    this.speedBg = this.add.graphics();
    this.speedBg.fillStyle(0x333333, 0.9);
    this.speedBg.fillRect(-bw / 2, -bh / 2, bw, bh);
    cont.add(this.speedBg);

    this.speedBtn = this.add.text(0, 0, '>>> x1', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    cont.add(this.speedBtn);

    this.speedBorder = this.add.graphics();
    cont.add(this.speedBorder);

    const hit = this.add.rectangle(0, 0, bw, bh).setInteractive().setAlpha(0.01);
    hit.on('pointerover', () => {
      if (!this.speedBorder) return;
      this.speedBorder.clear();
      const hoverColor = this.speedMultiplier === 3 ? 0xff8844 : 0x888888;
      this.speedBorder.lineStyle(2, hoverColor);
      this.speedBorder.strokeRect(-bw / 2, -bh / 2, bw, bh);
    });
    hit.on('pointerout', () => { this.speedBorder?.clear(); });
    hit.on('pointerdown', () => {
      if (this.menuPanel.isVisible()) return;
      this.playSfx('sfx_click');
      this.speedMultiplier = this.speedMultiplier === 1 ? 3 : 1;
      this.updateSpeedBtnVisual();
    });
    cont.add(hit);
    this.bottomBarContainers.push(cont);
  }

  private speedBtnSize = { w: 80, h: 24 };

  private updateSpeedBtnVisual(): void {
    const bw = this.speedBtnSize.w;
    const bh = this.speedBtnSize.h;
    if (this.speedBtn && this.speedBg) {
      this.speedBg.clear();
      if (this.speedMultiplier === 3) {
        this.speedBtn.setText('>>> x3');
        this.speedBtn.setColor('#ff8844');
        this.speedBg.fillStyle(0x553311, 0.9);
      } else {
        this.speedBtn.setText('>>> x1');
        this.speedBtn.setColor('#aaaaaa');
        this.speedBg.fillStyle(0x333333, 0.9);
      }
      this.speedBg.fillRect(-bw / 2, -bh / 2, bw, bh);
    }
  }

  // ---- Tower Level Visuals ----
  // Tint + scale towers based on level to give visual feedback
  private static readonly MAX_TOWER_LEVELS = 7;

  private applyTowerLevelVisual(sprite: Phaser.GameObjects.Sprite, level: number, towerId?: string): void {
    // Use recolored texture variant for this level
    const id = towerId ?? this.getTowerIdFromSprite(sprite);
    if (id) {
      const lvIndex = Math.min(level, GameScene.MAX_TOWER_LEVELS);
      const textureKey = `${id}_lv${lvIndex}`;
      if (this.textures.exists(textureKey)) {
        sprite.setTexture(textureKey);
      }
    }
    // Clear any old tint
    sprite.clearTint();

    // Scale slightly with level (max 1.4x at level 7+)
    const scale = 1.0 + Math.min(level - 1, 6) * 0.06;
    sprite.setScale(scale);
  }

  /** Infer tower type ID from sprite's current texture key */
  private getTowerIdFromSprite(sprite: Phaser.GameObjects.Sprite): string | null {
    const key = sprite.texture.key;
    // Key format: tower_xxx or tower_xxx_lvN
    const match = key.match(/^(tower_\w+?)(?:_lv\d+)?$/);
    return match ? match[1] : null;
  }

  private updateRangeGraphics(): void {
    if (!this.rangeGraphics) {
      this.rangeGraphics = this.add.graphics().setDepth(4);
    }
    this.rangeGraphics.clear();

    if (!this.showRanges) return;

    const towers = this.defenseSystem.getTowers();
    for (const tower of towers) {
      const rangePx = tower.data.range * TILE_SIZE;
      this.rangeGraphics.lineStyle(1.5, 0x44aaff, 0.5);
      this.rangeGraphics.fillStyle(0x44aaff, 0.08);
      this.rangeGraphics.fillCircle(tower.worldX, tower.worldY, rangePx);
      this.rangeGraphics.strokeCircle(tower.worldX, tower.worldY, rangePx);
    }

    // Troop ranges (green)
    if (this.troopSystem) {
      for (const troop of this.troopSystem.getTroops()) {
        const stats = troop.character.getFinalStats();
        const rangePx = stats.range * TILE_SIZE;
        this.rangeGraphics.lineStyle(1.5, 0x44ff44, 0.4);
        this.rangeGraphics.fillStyle(0x44ff44, 0.06);
        this.rangeGraphics.fillCircle(troop.homeWorldX, troop.homeWorldY, rangePx);
        this.rangeGraphics.strokeCircle(troop.homeWorldX, troop.homeWorldY, rangePx);
      }
    }
  }

  // ---- Troop UI & Rendering ----
  private createTroopButton(): void {
    const touch = this.isTouch();
    const btnW = touch ? 110 : 100;
    const btnH = touch ? 36 : 30;
    const btnX = MAP_OFFSET_X + 70;
    const btnY = BOTTOM_BAR_Y;
    const container = this.add.container(btnX, btnY).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x335533, 0.9);
    bg.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
    bg.lineStyle(1, 0x44aa44);
    bg.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
    container.add(bg);

    const txt = this.add.text(0, 0, '⚔ Tropas', {
      fontSize: touch ? '12px' : '11px', color: '#b8d4b8', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(txt);

    const border = this.add.graphics();
    container.add(border);

    const hitArea = this.add.rectangle(0, 0, btnW, btnH).setInteractive().setAlpha(0.01);
    hitArea.on('pointerover', () => {
      border.clear();
      border.lineStyle(2, 0x8fbc8f);
      border.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
    });
    hitArea.on('pointerout', () => {
      border.clear();
    });
    hitArea.on('pointerdown', () => {
      if (this.menuPanel.isVisible()) return;
      this.playSfx('sfx_click');
      if (this.troopDropdownContainer) {
        this.hideTroopDropdown();
      } else {
        this.showTroopDropdown();
      }
    });
    container.add(hitArea);
    this.bottomBarContainers.push(container);
  }

  private showTroopDropdown(): void {
    this.hideTroopDropdown();

    // Deselect tower
    this.selectedTowerIndex = -1;
    this.updateTowerButtonHighlights();

    const owned = this.characterManager.getAllOwned();
    if (owned.length === 0) return;

    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(owned.length / PAGE_SIZE);
    if (this.troopDropdownPage >= totalPages) this.troopDropdownPage = totalPages - 1;
    if (this.troopDropdownPage < 0) this.troopDropdownPage = 0;

    const startIdx = this.troopDropdownPage * PAGE_SIZE;
    const pageItems = owned.slice(startIdx, startIdx + PAGE_SIZE);
    const hasNextPage = this.troopDropdownPage < totalPages - 1;
    const hasPrevPage = this.troopDropdownPage > 0;

    this.troopDropdownContainer = this.add.container(0, 0).setDepth(150);

    const itemH = 32;
    const dropW = 200;
    const arrowH = 24;
    const contentH = pageItems.length * itemH + 10;
    const dropH = contentH + (hasPrevPage ? arrowH : 0) + (hasNextPage ? arrowH : 0);
    const dropX = MAP_OFFSET_X + 20;
    const dropY = MAP_OFFSET_Y + MAP_HEIGHT - dropH - 4;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(dropX, dropY, dropW, dropH);
    bg.lineStyle(2, 0x44aa44);
    bg.strokeRect(dropX, dropY, dropW, dropH);
    this.troopDropdownContainer.add(bg);

    let currentY = dropY;

    // Previous page arrow
    if (hasPrevPage) {
      const arrowBg = this.add.graphics();
      arrowBg.fillStyle(0x2a2a3e, 0.9);
      arrowBg.fillRect(dropX + 2, currentY + 2, dropW - 4, arrowH - 2);
      this.troopDropdownContainer.add(arrowBg);

      const arrowText = this.add.text(dropX + dropW / 2, currentY + arrowH / 2, `▲ Pag ${this.troopDropdownPage}/${totalPages}`, {
        fontSize: '14px', color: '#88ff88', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.troopDropdownContainer.add(arrowText);

      const arrowHit = this.add.rectangle(dropX + dropW / 2, currentY + arrowH / 2, dropW - 4, arrowH)
        .setInteractive().setAlpha(0.01);
      arrowHit.on('pointerover', () => {
        arrowBg.clear();
        arrowBg.fillStyle(0x336633, 0.9);
        arrowBg.fillRect(dropX + 2, currentY + 2, dropW - 4, arrowH - 2);
      });
      arrowHit.on('pointerout', () => {
        arrowBg.clear();
        arrowBg.fillStyle(0x2a2a3e, 0.9);
        arrowBg.fillRect(dropX + 2, currentY + 2, dropW - 4, arrowH - 2);
      });
      arrowHit.on('pointerdown', () => {
        this.troopDropdownPage--;
        this.showTroopDropdown();
      });
      this.troopDropdownContainer.add(arrowHit);

      currentY += arrowH;
    }

    // Render page items
    pageItems.forEach((char, i) => {
      const iy = currentY + 5 + i * itemH;
      const placed = this.troopSystem.isCharacterPlaced(char.data.id);
      const stats = char.getFinalStats();
      const isMelee = stats.range <= 2;

      // Row bg color: orange for melee, green for ranged
      const rowNormal = isMelee ? 0x332211 : 0x223322;
      const rowHover = isMelee ? 0x553322 : 0x336633;
      const rowColor = placed ? 0x222222 : rowNormal;

      const rowBg = this.add.graphics();
      rowBg.fillStyle(rowColor, 0.8);
      rowBg.fillRect(dropX + 2, iy, dropW - 4, itemH - 2);
      this.troopDropdownContainer!.add(rowBg);

      // Character sprite icon
      const iconKey = this.textures.exists(char.data.id) ? char.data.id : `troop_${char.data.type}`;
      const icon = this.add.sprite(dropX + 18, iy + itemH / 2, iconKey).setScale(0.6).setDepth(151);
      if (placed) icon.setAlpha(0.3);
      this.troopDropdownContainer!.add(icon);

      // Name
      const nameColor = placed ? '#555555' : isMelee ? '#ffcc88' : '#ccffcc';
      const name = this.add.text(dropX + 36, iy + 4, char.data.name, {
        fontSize: '13px', color: nameColor, fontFamily: 'monospace',
      });
      this.troopDropdownContainer!.add(name);

      // Stats summary
      const typeLabel = char.data.type === 'ground' ? 'Tierra' : char.data.type === 'aerial' ? 'Aereo' : char.data.type === 'support' ? 'Soporte' : 'Cmdr';
      const infoColor = placed ? '#444444' : isMelee ? '#aa8855' : '#88aa88';
      const info = this.add.text(dropX + 36, iy + 16, `Nv${char.level} ${typeLabel} ATK:${stats.attack} RNG:${stats.range}`, {
        fontSize: '7px', color: infoColor, fontFamily: 'monospace',
      });
      this.troopDropdownContainer!.add(info);

      // Melee/Ranged icon (sword or bow) on the right
      const weaponIcon = isMelee ? '⚔' : '🏹';
      const weaponColor = placed ? '#444444' : isMelee ? '#ff9944' : '#44ff88';
      const weapon = this.add.text(dropX + dropW - 18, iy + itemH / 2, weaponIcon, {
        fontSize: '12px', color: weaponColor, fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.troopDropdownContainer!.add(weapon);

      // Placed indicator (shift left to not overlap weapon icon)
      if (placed) {
        const check = this.add.text(dropX + dropW - 36, iy + itemH / 2, '✓', {
          fontSize: '14px', color: '#44aa44', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.troopDropdownContainer!.add(check);
      }

      // Hit area for hover tooltip + click (all troops get hover, only unplaced get click)
      const hit = this.add.rectangle(dropX + dropW / 2, iy + itemH / 2, dropW - 4, itemH - 2)
        .setInteractive().setAlpha(0.01);
      hit.on('pointerover', () => {
        if (!placed) {
          rowBg.clear();
          rowBg.fillStyle(rowHover, 0.9);
          rowBg.fillRect(dropX + 2, iy, dropW - 4, itemH - 2);
        }
        // Start 1.5s tooltip timer
        this.hideTroopTooltip();
        this.troopTooltipTimer = this.time.delayedCall(1500, () => {
          this.showTroopTooltip(char, iy + itemH);
        });
      });
      hit.on('pointerout', () => {
        if (!placed) {
          rowBg.clear();
          rowBg.fillStyle(rowNormal, 0.8);
          rowBg.fillRect(dropX + 2, iy, dropW - 4, itemH - 2);
        }
        this.hideTroopTooltip();
      });
      if (!placed) {
        hit.on('pointerdown', () => {
          this.playSfx('sfx_click');
          this.selectedCharacterId = char.data.id;
          this.selectedTowerIndex = -1;
          this.updateTowerButtonHighlights();
          this.hideTroopDropdown();
        });
      }
      this.troopDropdownContainer!.add(hit);
    });

    // Next page arrow
    if (hasNextPage) {
      const arrowY = currentY + 5 + pageItems.length * itemH;
      const arrowBg = this.add.graphics();
      arrowBg.fillStyle(0x2a2a3e, 0.9);
      arrowBg.fillRect(dropX + 2, arrowY, dropW - 4, arrowH - 2);
      this.troopDropdownContainer.add(arrowBg);

      const arrowText = this.add.text(dropX + dropW / 2, arrowY + arrowH / 2, `▼ Pag ${this.troopDropdownPage + 2}/${totalPages}`, {
        fontSize: '14px', color: '#88ff88', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.troopDropdownContainer.add(arrowText);

      const arrowHit = this.add.rectangle(dropX + dropW / 2, arrowY + arrowH / 2, dropW - 4, arrowH)
        .setInteractive().setAlpha(0.01);
      arrowHit.on('pointerover', () => {
        arrowBg.clear();
        arrowBg.fillStyle(0x336633, 0.9);
        arrowBg.fillRect(dropX + 2, arrowY, dropW - 4, arrowH - 2);
      });
      arrowHit.on('pointerout', () => {
        arrowBg.clear();
        arrowBg.fillStyle(0x2a2a3e, 0.9);
        arrowBg.fillRect(dropX + 2, arrowY, dropW - 4, arrowH - 2);
      });
      arrowHit.on('pointerdown', () => {
        this.troopDropdownPage++;
        this.showTroopDropdown();
      });
      this.troopDropdownContainer.add(arrowHit);
    }
  }

  private hideTroopDropdown(): void {
    this.hideTroopTooltip();
    if (this.troopDropdownContainer) {
      this.troopDropdownContainer.destroy();
      this.troopDropdownContainer = null;
    }
  }

  private showTroopTooltip(char: import('../entities/characters/CharacterData').CharacterInstance, rowBottomY: number): void {
    this.hideTroopTooltip();

    const stats = char.getFinalStats();
    const isMelee = stats.range <= 2;
    const dropX = 20;
    const dropW = 200;
    const tooltipW = 195;
    const tooltipX = dropX + dropW + 6;

    const typeLabel = char.data.type === 'ground' ? 'Tierra' : char.data.type === 'aerial' ? 'Aéreo' : char.data.type === 'support' ? 'Soporte' : 'Comandante';
    const rarityLabel = char.data.rarity.charAt(0).toUpperCase() + char.data.rarity.slice(1);
    const combatLabel = isMelee ? 'Cuerpo a cuerpo' : 'A distancia';

    // Stat rows: [icon, label, value]
    const statRows: [string, string, string][] = [
      ['🏷', 'Tipo', typeLabel],
      ['💎', 'Rareza', rarityLabel],
      [isMelee ? '⚔' : '🏹', 'Combate', combatLabel],
      ['⭐', 'Nivel', `${char.level}`],
      ['❤', 'HP', `${stats.hp}`],
      ['🗡', 'ATK', `${stats.attack}`],
      ['🛡', 'DEF', `${stats.defense}`],
      ['⚡', 'Vel.Atq', `${stats.attackSpeed.toFixed(2)}`],
      ['◎', 'Rango', `${stats.range}`],
      ['👢', 'Vel.Mov', `${stats.moveSpeed.toFixed(2)}`],
    ];

    const passive = char.data.passiveSkill;
    const lineH = 14;
    const spriteAreaH = 40;
    const nameAreaH = 18;
    const padding = 8;
    const statsH = statRows.length * lineH;
    const passiveH = passive ? 30 : 0;
    const tooltipH = spriteAreaH + nameAreaH + statsH + passiveH + padding * 2 + 4;
    const tooltipY = rowBottomY - tooltipH;

    this.troopTooltip = this.add.container(0, 0).setDepth(160);

    // Background
    const bg = this.add.graphics();
    const borderColor = isMelee ? 0xff9944 : 0x44ff88;
    bg.fillStyle(0x111122, 0.95);
    bg.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
    bg.lineStyle(2, borderColor);
    bg.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);
    this.troopTooltip.add(bg);

    // Character sprite
    const spriteKey = this.textures.exists(char.data.id) ? char.data.id : `troop_${char.data.type}`;
    const sprite = this.add.sprite(tooltipX + tooltipW / 2, tooltipY + padding + 16, spriteKey).setScale(1).setDepth(161);
    this.troopTooltip.add(sprite);

    // Name header
    const nameColor = isMelee ? '#ffcc88' : '#ccffcc';
    const nameText = this.add.text(tooltipX + tooltipW / 2, tooltipY + spriteAreaH + padding, char.data.name, {
      fontSize: '14px', color: nameColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.troopTooltip.add(nameText);

    // Stat rows with icons
    let sy = tooltipY + spriteAreaH + padding + nameAreaH + 2;
    for (const [icon, label, value] of statRows) {
      const iconText = this.add.text(tooltipX + 6, sy, icon, {
        fontSize: '13px', fontFamily: 'monospace',
      });
      this.troopTooltip.add(iconText);
      const statText = this.add.text(tooltipX + 22, sy + 1, `${label}: ${value}`, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      });
      this.troopTooltip.add(statText);
      sy += lineH;
    }

    // Passive skill
    if (passive) {
      sy += 2;
      const passiveText = this.add.text(tooltipX + 6, sy, `✨ ${passive.name}`, {
        fontSize: '12px', color: '#ffdd88', fontFamily: 'monospace',
      });
      this.troopTooltip.add(passiveText);
      const passiveDesc = this.add.text(tooltipX + 6, sy + 12, passive.description, {
        fontSize: '8px', color: '#999999', fontFamily: 'monospace',
        wordWrap: { width: tooltipW - 16 },
      });
      this.troopTooltip.add(passiveDesc);
    }
  }

  private hideTroopTooltip(): void {
    if (this.troopTooltipTimer) {
      this.troopTooltipTimer.remove();
      this.troopTooltipTimer = null;
    }
    if (this.troopTooltip) {
      this.troopTooltip.destroy();
      this.troopTooltip = null;
    }
  }

  private showTowerTooltip(towerIndex: number, btnX: number, btnTopY: number): void {
    this.hideTowerTooltip();

    const tower = AVAILABLE_TOWERS[towerIndex];
    if (!tower) return;

    const tooltipW = 190;
    const targetLabel = tower.targetType === TargetType.GROUND ? 'Terrestres' : tower.targetType === TargetType.AERIAL ? 'Aéreos' : 'Todos';

    const statRows: [string, string, string][] = [
      ['🎯', 'Objetivo', targetLabel],
      ['🗡', 'Daño', `${tower.damage}`],
      ['⚡', 'Vel.Atq', `${tower.attackSpeed.toFixed(1)}`],
      ['◎', 'Rango', `${tower.range}`],
      ['💰', 'Coste', `$${tower.cost}`],
      ['🚀', 'Vel.Proy', `${tower.projectileSpeed}`],
    ];
    if (tower.aoeRadius > 0) {
      statRows.push(['💥', 'AoE', `${tower.aoeRadius}`]);
    }

    const lineH = 14;
    const spriteAreaH = 36;
    const nameAreaH = 16;
    const descAreaH = 14;
    const padding = 8;
    const statsH = statRows.length * lineH;
    const tooltipH = spriteAreaH + nameAreaH + descAreaH + statsH + padding * 2 + 4;
    const tooltipX = btnX - tooltipW / 2;
    const tooltipY = btnTopY - tooltipH - 4;

    this.towerTooltip = this.add.container(0, 0).setDepth(160);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 0.95);
    bg.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
    bg.lineStyle(2, 0x888888);
    bg.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);
    this.towerTooltip.add(bg);

    // Tower sprite
    const spriteKey = this.textures.exists(tower.id) ? tower.id : 'tower_arrow';
    const sprite = this.add.sprite(tooltipX + tooltipW / 2, tooltipY + padding + 14, spriteKey).setScale(1).setDepth(161);
    this.towerTooltip.add(sprite);

    // Name
    const nameText = this.add.text(tooltipX + tooltipW / 2, tooltipY + spriteAreaH + padding, tower.name, {
      fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.towerTooltip.add(nameText);

    // Description
    const descText = this.add.text(tooltipX + tooltipW / 2, tooltipY + spriteAreaH + padding + nameAreaH, tower.description, {
      fontSize: '8px', color: '#999999', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.towerTooltip.add(descText);

    // Stat rows with icons
    let sy = tooltipY + spriteAreaH + padding + nameAreaH + descAreaH + 4;
    for (const [icon, label, value] of statRows) {
      const iconText = this.add.text(tooltipX + 6, sy, icon, {
        fontSize: '13px', fontFamily: 'monospace',
      });
      this.towerTooltip.add(iconText);
      const statText = this.add.text(tooltipX + 22, sy + 1, `${label}: ${value}`, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      });
      this.towerTooltip.add(statText);
      sy += lineH;
    }
  }

  private hideTowerTooltip(): void {
    if (this.towerTooltipTimer) {
      this.towerTooltipTimer.remove();
      this.towerTooltipTimer = null;
    }
    if (this.towerTooltip) {
      this.towerTooltip.destroy();
      this.towerTooltip = null;
    }
  }

  private showPlacementPreview(wx: number, wy: number, hasTower: boolean): void {
    this.clearPlacementPreview();

    let textureKey: string | null = null;
    let scale = 1;
    let rangePx = 0;
    let rangeColor = 0x44aaff;

    if (this.selectedCharacterId) {
      const charInst = this.characterManager.getOwnedCharacter(this.selectedCharacterId);
      if (charInst) {
        textureKey = this.textures.exists(charInst.data.id) ? charInst.data.id : `troop_${charInst.data.type}`;
        if (hasTower) scale = 0.7;
        const stats = charInst.getFinalStats();
        rangePx = stats.range * TILE_SIZE;
        rangeColor = 0x44ff44;
      }
    } else if (this.selectedTowerIndex >= 0) {
      const tower = AVAILABLE_TOWERS[this.selectedTowerIndex];
      textureKey = tower.id;
      rangePx = tower.range * TILE_SIZE;
      rangeColor = 0x44aaff;
    }

    if (textureKey && this.textures.exists(textureKey)) {
      this.previewSprite = this.add.sprite(wx, wy, textureKey)
        .setDepth(50)
        .setAlpha(0.5)
        .setScale(scale);
    }

    // Show range preview circle
    if (rangePx > 0) {
      if (!this.previewRangeGraphics) {
        this.previewRangeGraphics = this.add.graphics().setDepth(49);
      }
      this.previewRangeGraphics.clear();
      this.previewRangeGraphics.lineStyle(2, rangeColor, 0.6);
      this.previewRangeGraphics.fillStyle(rangeColor, 0.1);
      this.previewRangeGraphics.fillCircle(wx, wy, rangePx);
      this.previewRangeGraphics.strokeCircle(wx, wy, rangePx);
    }
  }

  private clearPlacementPreview(): void {
    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
    }
    if (this.previewRangeGraphics) {
      this.previewRangeGraphics.clear();
    }
  }

  private showHoverRange(gx: number, gy: number): void {
    this.clearHoverRange();

    if (!this.hoverRangeGraphics) {
      this.hoverRangeGraphics = this.add.graphics().setDepth(4);
    }
    this.hoverRangeGraphics.setVisible(true);

    // Check for tower at this position
    const tower = this.defenseSystem.getTowers().find(t => t.gridX === gx && t.gridY === gy);
    if (tower) {
      const rangePx = tower.data.range * TILE_SIZE;
      this.hoverRangeGraphics.lineStyle(2, 0x44aaff, 0.6);
      this.hoverRangeGraphics.fillStyle(0x44aaff, 0.1);
      this.hoverRangeGraphics.fillCircle(tower.worldX, tower.worldY, rangePx);
      this.hoverRangeGraphics.strokeCircle(tower.worldX, tower.worldY, rangePx);
      return;
    }

    // Check for troop at this position
    if (this.troopSystem) {
      const troop = this.troopSystem.getTroops().find(t => t.homeGridX === gx && t.homeGridY === gy);
      if (troop) {
        const stats = troop.character.getFinalStats();
        const rangePx = stats.range * TILE_SIZE;
        this.hoverRangeGraphics.lineStyle(2, 0x44ff44, 0.6);
        this.hoverRangeGraphics.fillStyle(0x44ff44, 0.1);
        this.hoverRangeGraphics.fillCircle(troop.homeWorldX, troop.homeWorldY, rangePx);
        this.hoverRangeGraphics.strokeCircle(troop.homeWorldX, troop.homeWorldY, rangePx);
      }
    }
  }

  private clearHoverRange(): void {
    if (this.hoverRangeGraphics) {
      this.hoverRangeGraphics.clear();
    }
  }

  private addHoverEffect(btn: Phaser.GameObjects.Text, borderColor = '#ffff44'): void {
    const origStyle = btn.style;
    const origStroke = origStyle.stroke as string | undefined;
    const origStrokeW = origStyle.strokeThickness as number | undefined;
    btn.on('pointerover', () => {
      btn.setStroke(borderColor, 3);
    });
    btn.on('pointerout', () => {
      btn.setStroke(origStroke ?? '', origStrokeW ?? 0);
    });
  }

  private playMusic(key: string, loop = true): void {
    if (this.currentMusicKey === key) return;
    // Stop procedural theme music when switching to file-based music
    this.themeMusic.stop();
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
    }
    this.currentMusicKey = key;
    if (this.cache.audio.exists(key)) {
      this.currentMusic = this.sound.add(key, { loop, volume: 0.3 });
      this.currentMusic.play();
    }
  }

  private playSfx(key: string, volume = 0.5): void {
    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  private stopMusic(): void {
    this.themeMusic.stop();
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  private updateTroopSprites(): void {
    for (const troop of this.troopSystem.getTroops()) {
      const sprite = this.troopSprites.get(troop.id);
      if (sprite) {
        sprite.setPosition(troop.worldX, troop.worldY);
        sprite.clearTint();
      }
    }
  }

  private updateTroopProjectiles(): void {
    const projs = this.troopSystem.getProjectiles();
    const activeProjIds = new Set<string>();

    for (const proj of projs) {
      const projKey = `${proj.troopId}_${proj.targetId}`;
      activeProjIds.add(projKey);

      let sprite = this.troopProjSprites.get(projKey);
      const texKey = GameScene.CHAR_PROJ_MAP[proj.troopId] ?? 'proj_arrow';

      if (!sprite) {
        const finalTex = this.textures.exists(texKey) ? texKey : 'projectile-placeholder';
        sprite = this.add.sprite(proj.x, proj.y, finalTex).setDepth(15).setScale(0.7);
        this.troopProjSprites.set(projKey, sprite);
      }

      sprite.setPosition(proj.x, proj.y);
      // Rotate toward target
      const troop = this.troopSystem.getTroops().find(t => t.id === proj.troopId);
      if (troop) {
        const angle = Math.atan2(proj.y - troop.homeWorldY, proj.x - troop.homeWorldX);
        sprite.setRotation(angle);
      }
    }

    // Remove sprites for projectiles that no longer exist
    for (const [key, sprite] of this.troopProjSprites) {
      if (!activeProjIds.has(key)) {
        sprite.destroy();
        this.troopProjSprites.delete(key);
      }
    }
  }

  private spawnMeleeHitParticle(x: number, y: number, troopType: string): void {
    const texKey = GameScene.TYPE_HIT_MAP[troopType] ?? 'hit_sparkle';
    if (this.textures.exists(texKey)) {
      const sprite = this.add.sprite(x, y, texKey)
        .setDepth(20)
        .setScale(0.5)
        .setAlpha(0.9);
      this.hitParticles.push({ sprite, life: 0.4 });
    }

    // Slash arc (graphics-based)
    const slashColor = troopType === 'commander' ? 0xff4444 :
                       troopType === 'aerial' ? 0x44ccff :
                       troopType === 'support' ? 0x44ff88 : 0xffdd44;
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      this.vfxParticles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.2 + Math.random() * 0.15,
        maxLife: 0.35,
        color: slashColor,
        size: 2 + Math.random() * 2,
        type: 'slash',
      });
    }

    // Small impact ring for melee
    this.impactRings.push({ x, y, radius: 1, maxRadius: 12, life: 0.2, color: slashColor });
  }

  /** Spawn death particles when an enemy dies */
  spawnDeathEffect(x: number, y: number, color = 0xff4444): void {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 20 + Math.random() * 50;
      this.vfxParticles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color,
        size: 1.5 + Math.random() * 2.5,
        type: 'death',
      });
    }
    // Death ring
    this.impactRings.push({ x, y, radius: 3, maxRadius: 22, life: 0.35, color });
  }

  private spawnUltimateVFX(data: {
    troopId: string; charId: string; type: string;
    x: number; y: number; radius: number;
    targetX?: number; targetY?: number; duration?: number;
  }): void {
    const { type, x, y, radius } = data;

    // Color schemes per ultimate type
    const ULT_COLORS: Record<string, number> = {
      soldier_fury: 0xff8844,   archer_rain: 0xaacc44,   guard_wall: 0x8888cc,
      scout_ambush: 0x44ff88,   militia_frenzy: 0xff6644, healer_bless: 0x88ffaa,
      spearman_charge: 0xddaa44, lookout_flare: 0xffff66, knight_charge: 0xccccff,
      mage_storm: 0x8844ff,     ranger_pierce: 0x44cc44, priest_sanctuary: 0xffddaa,
      hawk_dive: 0x44aaff,      paladin_judgment: 0xffdd44, assassin_blades: 0xaa22cc,
      archmage_meteor: 0xff4400, dragon_fury: 0xff6600,   seraph_ray: 0xffff88,
      overlord_warcry: 0xff2222, phoenix_supernova: 0xff8800, generic_aoe: 0xffffff,
    };
    const color = ULT_COLORS[type] ?? 0xffffff;

    switch (type) {
      case 'paladin_judgment': {
        // Golden shockwave + rising light pillars
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.8, maxLife: 0.8, radius, color: 0xffdd44 });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const r = radius * 0.6;
          this.vfxParticles.push({
            x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3,
            vx: Math.cos(a) * 30, vy: -80 - Math.random() * 40,
            life: 0.6 + Math.random() * 0.3, maxLife: 0.9,
            color: 0xffdd44, size: 3 + Math.random() * 3, type: 'impact',
          });
        }
        // Cross pattern particles
        for (let i = 0; i < 20; i++) {
          const a = (Math.floor(i / 5) * 90) * Math.PI / 180;
          const dist = (i % 5) * radius / 5;
          this.vfxParticles.push({
            x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist,
            vx: 0, vy: -60 - Math.random() * 30,
            life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
            color: 0xffffff, size: 2 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'assassin_blades': {
        // Circular blade slash patterns
        this.ultimateEffects.push({ type: 'blades_spin', x, y, life: 1.2, maxLife: 1.2, radius, color: 0xaa22cc });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          this.vfxParticles.push({
            x, y,
            vx: Math.cos(a) * 80, vy: Math.sin(a) * 80,
            life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
            color: i % 2 === 0 ? 0xcc44ff : 0x8800aa, size: 2 + Math.random() * 2, type: 'slash',
          });
        }
        break;
      }

      case 'archmage_meteor': {
        // Meteor falling + explosion
        const tx = data.targetX ?? x;
        const ty = data.targetY ?? y;
        this.ultimateEffects.push({ type: 'meteor', x: tx, y: ty - 200, life: 1.0, maxLife: 1.0, radius, color: 0xff4400, targetX: tx, targetY: ty });
        break;
      }

      case 'dragon_fury': {
        // Fiery aura + transformation flash
        this.ultimateGlows.set(data.troopId, { color: 0xff6600 });
        this.ultimateEffects.push({ type: 'transform_flash', x, y, life: 0.6, maxLife: 0.6, radius: TILE_SIZE * 2, color: 0xff6600 });
        for (let i = 0; i < 15; i++) {
          const a = Math.random() * Math.PI * 2;
          this.vfxParticles.push({
            x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10,
            vx: Math.cos(a) * 40, vy: -50 - Math.random() * 40,
            life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
            color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00, size: 3 + Math.random() * 3, type: 'impact',
          });
        }
        break;
      }

      case 'seraph_ray': {
        // Light beam from troop to target
        const tx = data.targetX ?? x + 100;
        const ty = data.targetY ?? y;
        this.ultimateEffects.push({ type: 'light_beam', x, y, life: 0.8, maxLife: 0.8, radius, color: 0xffff88, targetX: tx, targetY: ty });
        // Sparkles along the beam
        const dx = tx - x; const dy = ty - y;
        for (let i = 0; i < 10; i++) {
          const t = i / 10;
          this.vfxParticles.push({
            x: x + dx * t, y: y + dy * t,
            vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 20,
            life: 0.3 + Math.random() * 0.3, maxLife: 0.6,
            color: 0xffffcc, size: 2 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'overlord_warcry': {
        // Red shockwave emanating from overlord
        this.ultimateGlows.set(data.troopId, { color: 0xff2222 });
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 1.0, maxLife: 1.0, radius: TILE_SIZE * 8, color: 0xff2222 });
        // Red particles upward
        for (let i = 0; i < 20; i++) {
          const a = Math.random() * Math.PI * 2;
          this.vfxParticles.push({
            x: x + Math.cos(a) * 15, y: y + Math.sin(a) * 15,
            vx: Math.cos(a) * 20, vy: -70 - Math.random() * 50,
            life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
            color: 0xff4444, size: 2.5 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'phoenix_supernova': {
        // Massive expanding sun explosion
        this.ultimateEffects.push({ type: 'supernova', x, y, life: 1.5, maxLife: 1.5, radius, color: 0xff8800 });
        // Enormous particle burst
        for (let i = 0; i < 30; i++) {
          const a = (i / 30) * Math.PI * 2;
          const speed = 60 + Math.random() * 80;
          this.vfxParticles.push({
            x, y,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20,
            life: 0.6 + Math.random() * 0.6, maxLife: 1.2,
            color: Math.random() > 0.3 ? 0xff8800 : 0xffdd00, size: 3 + Math.random() * 4, type: 'impact',
          });
        }
        // Inner white burst
        for (let i = 0; i < 15; i++) {
          const a = Math.random() * Math.PI * 2;
          this.vfxParticles.push({
            x, y,
            vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 40,
            life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
            color: 0xffffff, size: 2 + Math.random() * 3, type: 'impact',
          });
        }
        break;
      }

      // ─── COMMON ABILITIES ───

      case 'soldier_fury': {
        // Orange slash + impact
        this.ultimateEffects.push({ type: 'transform_flash', x, y, life: 0.4, maxLife: 0.4, radius: TILE_SIZE * 1.5, color: 0xff8844 });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.vfxParticles.push({
            x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20,
            life: 0.3, maxLife: 0.3, color: 0xff8844, size: 3, type: 'slash',
          });
        }
        this.impactRings.push({ x, y, radius: 2, maxRadius: radius * 0.6, life: 0.3, color: 0xff8844 });
        break;
      }

      case 'archer_rain': {
        // Rain of arrows: particles falling from above
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.7, maxLife: 0.7, radius, color: 0xaacc44 });
        for (let i = 0; i < 15; i++) {
          const ox = (Math.random() - 0.5) * radius * 2;
          this.vfxParticles.push({
            x: x + ox, y: y - 80 - Math.random() * 40,
            vx: (Math.random() - 0.5) * 10, vy: 120 + Math.random() * 60,
            life: 0.4 + Math.random() * 0.2, maxLife: 0.6,
            color: 0xaacc44, size: 2 + Math.random() * 2, type: 'trail',
          });
        }
        break;
      }

      case 'guard_wall': {
        // Blue shield bubble
        this.ultimateGlows.set(data.troopId, { color: 0x8888cc });
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.6, maxLife: 0.6, radius, color: 0x8888cc });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.vfxParticles.push({
            x: x + Math.cos(a) * radius * 0.5, y: y + Math.sin(a) * radius * 0.5,
            vx: 0, vy: -40 - Math.random() * 20,
            life: 0.5, maxLife: 0.5, color: 0xaaaaee, size: 2.5, type: 'impact',
          });
        }
        break;
      }

      case 'scout_ambush': {
        // Green dash line to target
        const tx = data.targetX ?? x; const ty = data.targetY ?? y;
        this.ultimateEffects.push({ type: 'light_beam', x, y, life: 0.5, maxLife: 0.5, radius, color: 0x44ff88, targetX: tx, targetY: ty });
        this.impactRings.push({ x: tx, y: ty, radius: 2, maxRadius: TILE_SIZE * 1.5, life: 0.3, color: 0x44ff88 });
        for (let i = 0; i < 6; i++) {
          this.vfxParticles.push({
            x: tx, y: ty, vx: (Math.random() - 0.5) * 50, vy: -50 - Math.random() * 30,
            life: 0.3, maxLife: 0.3, color: 0x44ff88, size: 2.5, type: 'slash',
          });
        }
        break;
      }

      case 'militia_frenzy': {
        // Orange rage burst + glow
        this.ultimateGlows.set(data.troopId, { color: 0xff6644 });
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.5, maxLife: 0.5, radius, color: 0xff6644 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.vfxParticles.push({
            x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50 - 30,
            life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
            color: Math.random() > 0.5 ? 0xff6644 : 0xff9944, size: 2.5, type: 'impact',
          });
        }
        break;
      }

      case 'healer_bless': {
        // Green healing aura + rising particles
        this.ultimateGlows.set(data.troopId, { color: 0x88ffaa });
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.8, maxLife: 0.8, radius, color: 0x88ffaa });
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * radius * 0.8;
          this.vfxParticles.push({
            x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
            vx: 0, vy: -40 - Math.random() * 30,
            life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
            color: 0x88ffaa, size: 2 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'spearman_charge':
      case 'ranger_pierce': {
        // Piercing line beam
        const tx2 = data.targetX ?? x + 100; const ty2 = data.targetY ?? y;
        this.ultimateEffects.push({ type: 'light_beam', x, y, life: 0.6, maxLife: 0.6, radius, color, targetX: tx2, targetY: ty2 });
        const ddx = tx2 - x; const ddy = ty2 - y;
        for (let i = 0; i < 8; i++) {
          const t = i / 8;
          this.vfxParticles.push({
            x: x + ddx * t, y: y + ddy * t,
            vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 20,
            life: 0.3, maxLife: 0.3, color, size: 2.5, type: 'impact',
          });
        }
        break;
      }

      case 'lookout_flare': {
        // Yellow flare burst upward
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.6, maxLife: 0.6, radius, color: 0xffff66 });
        for (let i = 0; i < 10; i++) {
          this.vfxParticles.push({
            x: x + (Math.random() - 0.5) * 20, y,
            vx: (Math.random() - 0.5) * 20, vy: -80 - Math.random() * 60,
            life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
            color: Math.random() > 0.5 ? 0xffff66 : 0xffcc00, size: 2.5 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'knight_charge': {
        // Silver/white heavy impact
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.7, maxLife: 0.7, radius, color: 0xccccff });
        this.impactRings.push({ x, y, radius: 3, maxRadius: radius, life: 0.4, color: 0xccccff });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.vfxParticles.push({
            x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20,
            life: 0.35, maxLife: 0.35, color: 0xccccff, size: 3, type: 'impact',
          });
        }
        break;
      }

      case 'mage_storm': {
        // Purple arcane storm
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.8, maxLife: 0.8, radius, color: 0x8844ff });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const r = radius * (0.3 + Math.random() * 0.7);
          this.vfxParticles.push({
            x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
            vx: Math.cos(a + 1.5) * 40, vy: -40 - Math.random() * 40,
            life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
            color: Math.random() > 0.5 ? 0x8844ff : 0xaa66ff, size: 2.5 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'priest_sanctuary': {
        // Warm golden healing circle + glow
        this.ultimateGlows.set(data.troopId, { color: 0xffddaa });
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.7, maxLife: 0.7, radius, color: 0xffddaa });
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * radius * 0.6;
          this.vfxParticles.push({
            x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
            vx: 0, vy: -50 - Math.random() * 30,
            life: 0.5, maxLife: 0.5, color: 0xffddaa, size: 2 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }

      case 'hawk_dive': {
        // Cyan dive bomb from above to target
        const htx = data.targetX ?? x; const hty = data.targetY ?? y;
        this.ultimateEffects.push({ type: 'meteor', x: htx, y: hty - 150, life: 0.7, maxLife: 0.7, radius, color: 0x44aaff, targetX: htx, targetY: hty });
        break;
      }

      default: {
        // Generic flash + ring
        this.ultimateEffects.push({ type: 'shockwave', x, y, life: 0.6, maxLife: 0.6, radius, color });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.vfxParticles.push({
            x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50 - 20,
            life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
            color, size: 2 + Math.random() * 2, type: 'impact',
          });
        }
        break;
      }
    }
  }

  private updateUltimateVFX(deltaSec: number): void {
    if (!this.vfxGraphics) return;
    const g = this.vfxGraphics;
    const time = this.time.now * 0.001;

    // Draw ultimate effects
    for (let i = this.ultimateEffects.length - 1; i >= 0; i--) {
      const eff = this.ultimateEffects[i];
      eff.life -= deltaSec;
      if (eff.life <= 0) {
        // On meteor end, spawn explosion
        if (eff.type === 'meteor') {
          const tx = eff.targetX ?? eff.x;
          const ty = eff.targetY ?? eff.y;
          this.ultimateEffects.push({ type: 'shockwave', x: tx, y: ty, life: 0.6, maxLife: 0.6, radius: eff.radius, color: 0xff4400 });
          // Explosion particles
          for (let j = 0; j < 20; j++) {
            const a = (j / 20) * Math.PI * 2;
            this.vfxParticles.push({
              x: tx, y: ty,
              vx: Math.cos(a) * (50 + Math.random() * 50), vy: Math.sin(a) * (50 + Math.random() * 50) - 30,
              life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
              color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00, size: 3 + Math.random() * 3, type: 'impact',
            });
          }
        }
        this.ultimateEffects.splice(i, 1);
        continue;
      }

      const progress = 1 - eff.life / eff.maxLife;

      switch (eff.type) {
        case 'shockwave': {
          // Expanding ring that fades out
          const r = eff.radius * progress;
          const alpha = (1 - progress) * 0.7;
          g.lineStyle(3 * (1 - progress) + 1, eff.color, alpha);
          g.strokeCircle(eff.x, eff.y, r);
          // Inner fill
          g.fillStyle(eff.color, alpha * 0.15);
          g.fillCircle(eff.x, eff.y, r);
          break;
        }

        case 'blades_spin': {
          // Spinning blade arcs
          const numBlades = 8;
          const spinSpeed = progress * Math.PI * 6;
          const alpha = (1 - progress) * 0.8;
          for (let b = 0; b < numBlades; b++) {
            const a = (b / numBlades) * Math.PI * 2 + spinSpeed;
            const r1 = eff.radius * 0.3;
            const r2 = eff.radius * (0.5 + progress * 0.5);
            g.lineStyle(2, eff.color, alpha);
            g.beginPath();
            g.moveTo(eff.x + Math.cos(a) * r1, eff.y + Math.sin(a) * r1);
            g.lineTo(eff.x + Math.cos(a) * r2, eff.y + Math.sin(a) * r2);
            g.strokePath();
          }
          break;
        }

        case 'meteor': {
          // Falling fireball
          const tx = eff.targetX ?? eff.x;
          const ty = eff.targetY ?? eff.y;
          const mx = eff.x + (tx - eff.x) * progress;
          const my = (eff.y) + (ty - eff.y) * progress;
          // Fire trail
          const meteorSize = 8 + progress * 6;
          g.fillStyle(0xff4400, 0.8);
          g.fillCircle(mx, my, meteorSize);
          g.fillStyle(0xffaa00, 0.6);
          g.fillCircle(mx, my, meteorSize * 0.6);
          g.fillStyle(0xffffff, 0.4);
          g.fillCircle(mx, my, meteorSize * 0.3);
          // Trail particles
          for (let t = 0; t < 3; t++) {
            this.vfxParticles.push({
              x: mx + (Math.random() - 0.5) * 6, y: my + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 20, vy: -20 + Math.random() * 10,
              life: 0.15 + Math.random() * 0.1, maxLife: 0.25,
              color: 0xff6600, size: 2 + Math.random() * 2, type: 'trail',
            });
          }
          // Shadow on ground
          g.fillStyle(0x000000, 0.3 * progress);
          g.fillEllipse(tx, ty, 20 * progress, 8 * progress);
          break;
        }

        case 'transform_flash': {
          // Bright expanding flash
          const flashAlpha = (1 - progress) * 0.6;
          const r = eff.radius * (0.5 + progress * 0.5);
          g.fillStyle(eff.color, flashAlpha * 0.3);
          g.fillCircle(eff.x, eff.y, r);
          g.fillStyle(0xffffff, flashAlpha * 0.5);
          g.fillCircle(eff.x, eff.y, r * 0.4);
          break;
        }

        case 'light_beam': {
          // Light beam line
          const tx = eff.targetX ?? eff.x + 100;
          const ty = eff.targetY ?? eff.y;
          const alpha = (1 - progress * 0.7) * 0.7;
          const width = 6 * (1 - progress * 0.5);
          // Outer glow
          g.lineStyle(width + 4, eff.color, alpha * 0.3);
          g.beginPath(); g.moveTo(eff.x, eff.y); g.lineTo(tx, ty); g.strokePath();
          // Core beam
          g.lineStyle(width, 0xffffff, alpha * 0.7);
          g.beginPath(); g.moveTo(eff.x, eff.y); g.lineTo(tx, ty); g.strokePath();
          break;
        }

        case 'supernova': {
          // Multi-layered expanding sun
          const r1 = eff.radius * progress;
          const r2 = eff.radius * progress * 0.7;
          const alpha = (1 - progress) * 0.6;
          g.fillStyle(0xff8800, alpha * 0.2);
          g.fillCircle(eff.x, eff.y, r1);
          g.fillStyle(0xffcc00, alpha * 0.3);
          g.fillCircle(eff.x, eff.y, r2);
          g.fillStyle(0xffffff, alpha * 0.4);
          g.fillCircle(eff.x, eff.y, r2 * 0.3);
          // Rays
          for (let r = 0; r < 8; r++) {
            const a = (r / 8) * Math.PI * 2 + time * 2;
            g.lineStyle(2, 0xffdd00, alpha * 0.5);
            g.beginPath();
            g.moveTo(eff.x + Math.cos(a) * r2 * 0.3, eff.y + Math.sin(a) * r2 * 0.3);
            g.lineTo(eff.x + Math.cos(a) * r1, eff.y + Math.sin(a) * r1);
            g.strokePath();
          }
          break;
        }
      }
    }

    // Draw persistent glow on troops with active buffs
    for (const [troopId, glow] of this.ultimateGlows) {
      const troop = this.troopSystem?.getTroops().find(t => t.id === troopId);
      if (!troop) { this.ultimateGlows.delete(troopId); continue; }
      const pulse = 1 + Math.sin(time * 4) * 0.2;
      g.fillStyle(glow.color, 0.15 * pulse);
      g.fillCircle(troop.worldX, troop.worldY, 18 * pulse);
      g.lineStyle(1.5, glow.color, 0.4 * pulse);
      g.strokeCircle(troop.worldX, troop.worldY, 16 * pulse);
    }

    // Draw ultimate charge bars above troops
    this.drawUltimateChargeBars();
  }

  private drawUltimateChargeBars(): void {
    if (!this.ultChargeGraphics) {
      this.ultChargeGraphics = this.add.graphics().setDepth(23);
    }
    this.ultChargeGraphics.clear();

    if (!this.troopSystem) return;
    const charges = this.troopSystem.getUltimateCharges();

    for (const [troopId, info] of charges) {
      const troop = this.troopSystem.getTroops().find(t => t.id === troopId);
      if (!troop) continue;

      const barW = 26;
      const barH = 4;
      const bx = troop.worldX - barW / 2;
      const by = troop.worldY - 24;
      const pct = Math.min(1, info.charge / info.cooldown);

      // Background
      this.ultChargeGraphics.fillStyle(0x220000, 0.85);
      this.ultChargeGraphics.fillRect(bx, by, barW, barH);
      // Fill — red bar
      const barColor = info.active ? 0xffdd00 : 0xcc2222;
      this.ultChargeGraphics.fillStyle(barColor, 0.95);
      this.ultChargeGraphics.fillRect(bx, by, barW * pct, barH);
      // Border
      this.ultChargeGraphics.lineStyle(1, info.active ? 0xffff44 : 0x882222, 0.8);
      this.ultChargeGraphics.strokeRect(bx, by, barW, barH);
    }
  }

  // ---- Floating Text System ----
  private spawnFloatingText(x: number, y: number, msg: string, color = '#ffffff', fontSize = '10px'): void {
    const text = this.add.text(x, y, msg, {
      fontSize, color, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);
    this.floatingTexts.push({ text, life: 0.8, vy: -40 });
  }

  private updateFloatingTexts(deltaSec: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= deltaSec;
      ft.text.y += ft.vy * deltaSec;
      ft.text.setAlpha(Math.max(0, ft.life / 0.8));
      if (ft.life <= 0) {
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // ---- Kill counter ----
  private updateWaveKillText(): void {
    if (!this.waveKillText) {
      this.waveKillText = this.add.text(MAP_OFFSET_X + 512, MAP_OFFSET_Y + 4, '', {
        fontSize: '10px', color: '#cc8888', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(101);
    }
    this.waveKillText.setText(`☠ ${this.waveKills}`);
  }

  // ---- Level name in top bar ----
  private showLevelName(): void {
    if (this.levelNameText) this.levelNameText.destroy();
    const levelData = levelsData[this.currentLevelIndex] as LevelData;
    const name = levelData?.name ?? `Nivel ${this.currentLevelIndex + 1}`;
    const color = GameScene.LEVEL_NAME_COLORS[this.currentLevelIndex] ?? '#ffffff';
    this.levelNameText = this.add.text(MAP_OFFSET_X + 612, 14, name, {
      fontSize: '11px', color, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(101);
  }

  // ---- Sell Tower (right-click on placed tower) ----
  private sellTowerAt(gx: number, gy: number): void {
    const key = `${gx},${gy}`;
    const tower = this.defenseSystem.getTowers().find(t => t.gridX === gx && t.gridY === gy);
    if (!tower) return;

    const refund = Math.floor(tower.data.cost * 0.6);
    this.gold += refund;
    this.updateResources();

    // Remove tower
    this.defenseSystem.removeTower(gx, gy);
    const sprite = this.towerSprites.get(key);
    if (sprite) {
      sprite.destroy();
      this.towerSprites.delete(key);
    }

    SoundFX.towerSell();
    this.spawnFloatingText(tower.worldX, tower.worldY, `+${refund}g`, '#88ff88', '11px');
  }

  private updateHitParticles(deltaSec: number): void {
    // Sprite-based hit particles
    for (let i = this.hitParticles.length - 1; i >= 0; i--) {
      const p = this.hitParticles[i];
      p.life -= deltaSec;
      p.sprite.setAlpha(Math.max(0, p.life / 0.4));
      p.sprite.setScale(0.5 + (0.4 - p.life) * 0.8);
      p.sprite.y -= deltaSec * 20;
      if (p.life <= 0) {
        p.sprite.destroy();
        this.hitParticles.splice(i, 1);
      }
    }

    // VFX Graphics particles
    if (!this.vfxGraphics) {
      this.vfxGraphics = this.add.graphics().setDepth(22);
    }
    this.vfxGraphics.clear();

    // Update and draw vfxParticles
    for (let i = this.vfxParticles.length - 1; i >= 0; i--) {
      const p = this.vfxParticles[i];
      p.life -= deltaSec;
      if (p.life <= 0) {
        this.vfxParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * deltaSec;
      p.y += p.vy * deltaSec;
      p.vy += 60 * deltaSec; // gravity

      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * (0.5 + alpha * 0.5);

      this.vfxGraphics.fillStyle(p.color, alpha * 0.9);
      this.vfxGraphics.fillCircle(p.x, p.y, size);
      // Bright core
      this.vfxGraphics.fillStyle(0xffffff, alpha * 0.4);
      this.vfxGraphics.fillCircle(p.x, p.y, size * 0.4);
    }

    // Update and draw impact rings
    for (let i = this.impactRings.length - 1; i >= 0; i--) {
      const r = this.impactRings[i];
      r.life -= deltaSec;
      if (r.life <= 0) {
        this.impactRings.splice(i, 1);
        continue;
      }
      const progress = 1 - (r.life / 0.35);
      r.radius = r.maxRadius * progress;
      const alpha = (1 - progress) * 0.6;
      this.vfxGraphics.lineStyle(2 * (1 - progress) + 0.5, r.color, alpha);
      this.vfxGraphics.strokeCircle(r.x, r.y, r.radius);
    }
  }
}

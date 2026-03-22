import Phaser from 'phaser';
import { eventBus } from '../core/EventBus';
import { TILE_SIZE, GAME_WIDTH } from '../core/Constants';
import { GridMap, TileType } from '../core/GridMap';
import type { LevelData } from '../core/GridMap';
import { SaveSystem } from '../core/SaveSystem';
import { CharacterManager } from '../entities/characters/CharacterManager';
import type { EnemyData, EnemyInstance } from '../entities/enemies/EnemyData';
import { createEnemyInstance } from '../entities/enemies/EnemyData';
import { DefenseSystem } from '../systems/combat/DefenseSystem';
import { EnemyAI } from '../systems/combat/EnemyAI';
import { DungeonGenerator } from '../systems/dungeon/DungeonGenerator';
import { ChestSystem } from '../systems/dungeon/ChestSystem';
import { EquipmentSystem } from '../systems/dungeon/EquipmentSystem';
import type { ItemData } from '../systems/dungeon/EquipmentSystem';
import { CommanderSystem } from '../systems/commander/CommanderSystem';
import { ProgressionSystem } from '../systems/progression/ProgressionSystem';
import { HUD } from '../ui/HUD';
import { MenuPanel } from '../ui/MenuPanel';
import { DungeonUI } from '../ui/DungeonUI';
import { CollectionUI } from '../ui/CollectionUI';
import type { TowerData } from '../entities/towers/TowerEntity';
import { TargetType } from '../entities/towers/TowerEntity';
import { SoundFX } from '../core/SoundFX';
import { MathChallenge, TypingChallenge } from '../ui/DungeonChallenges';
import { TroopSystem } from '../systems/combat/TroopSystem';

import levelsData from '../data/levels.json';
import charactersData from '../data/characters.json';
import enemiesData from '../data/enemies.json';
import itemsData from '../data/items.json';

type GameState = 'preparing' | 'playing' | 'between_waves' | 'dungeon' | 'game_over' | 'victory';

const AVAILABLE_TOWERS: TowerData[] = [
  { id: 'tower_arrow', name: 'Torre de Flechas', targetType: TargetType.GROUND, damage: 15, attackSpeed: 1.2, range: 4, cost: 50, projectileSpeed: 8, aoeRadius: 0, description: 'Daño rápido a terrestres' },
  { id: 'tower_cannon', name: 'Cañón', targetType: TargetType.GROUND, damage: 40, attackSpeed: 0.5, range: 3, cost: 80, projectileSpeed: 5, aoeRadius: 1.5, description: 'Daño AoE a terrestres' },
  { id: 'tower_antiair', name: 'Balista Aérea', targetType: TargetType.AERIAL, damage: 25, attackSpeed: 1.0, range: 5, cost: 70, projectileSpeed: 10, aoeRadius: 0, description: 'Solo ataca aéreos' },
  { id: 'tower_magic', name: 'Torre Arcana', targetType: TargetType.BOTH, damage: 20, attackSpeed: 0.8, range: 4, cost: 100, projectileSpeed: 6, aoeRadius: 1, description: 'Ataca todo con penalización' },
];

export class GameScene extends Phaser.Scene {
  // Systems
  private saveSystem!: SaveSystem;
  private characterManager!: CharacterManager;
  private defenseSystem!: DefenseSystem;
  private enemyAI!: EnemyAI;
  private dungeonGenerator!: DungeonGenerator;
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

  // UI
  private hud!: HUD;
  private menuPanel!: MenuPanel;
  private dungeonUI!: DungeonUI;
  private collectionUI!: CollectionUI;
  private towerButtons: Phaser.GameObjects.Container[] = [];
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

  // Speed control
  private speedMultiplier = 1;
  private speedBtn: Phaser.GameObjects.Text | null = null;

  // Placement preview
  private previewSprite: Phaser.GameObjects.Sprite | null = null;

  // Music
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;

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
      this.loadLevel(this.currentLevelIndex);
      this.createUI();
      this.setupInput();
      this.setupEventListeners();
      this.enterPreparationPhase(0);
      eventBus.emit('game:ready');
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

    // Load save if exists
    if (this.saveSystem.load()) {
      const data = this.saveSystem.getData();
      this.currentLevelIndex = Math.min(data.currentLevelIndex, levelsData.length - 1);
      // Gold always starts at 1000 on page reload
      // this.gold = data.gold;
      this.crystals = data.crystals;
      this.wallHP = data.wallHP > 0 ? data.wallHP : this.wallMaxHP;
    }

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

    const levelData = levelsData[levelIndex] as LevelData;
    this.gridMap = new GridMap(levelData);
    this.defenseSystem = new DefenseSystem(this.gridMap);
    this.troopSystem = new TroopSystem();

    // Render tiles
    for (let y = 0; y < this.gridMap.rows; y++) {
      for (let x = 0; x < this.gridMap.cols; x++) {
        const tile = this.gridMap.getTile(x, y);
        let textureKey = 'tile-buildable';
        if (tile === TileType.PATH || tile === TileType.SPAWN || tile === TileType.EXIT) textureKey = 'tile-path';
        else if (tile === TileType.WALL) textureKey = 'tile-wall';
        else if (tile === TileType.DECORATION) textureKey = 'tile-decoration';

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
  }

  private createUI(): void {
    this.hud = new HUD(this);
    this.menuPanel = new MenuPanel(this);
    this.dungeonUI = new DungeonUI(this);
    this.collectionUI = new CollectionUI(this);

    // Menu button (☰) for mobile - replaces ESC key
    const menuBtn = this.add.text(GAME_WIDTH - 30, 14, '☰', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#222233', padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 0).setDepth(250).setInteractive();
    menuBtn.on('pointerdown', () => {
      this.playSfx('sfx_click');
      if (this.menuPanel.isVisible()) this.menuPanel.hide();
      else if (this.gameState === 'preparing') this.menuPanel.show();
    });
    menuBtn.on('pointerover', () => menuBtn.setStroke('#ffff44', 2));
    menuBtn.on('pointerout', () => menuBtn.setStroke('', 0));

    // Troop button (left of tower buttons)
    this.createTroopButton();

    // Tower selection buttons at bottom
    const btnY = 560;
    AVAILABLE_TOWERS.forEach((tower, i) => {
      const btnX = 200 + i * 120;
      const container = this.add.container(btnX, btnY).setDepth(100);

      const bg = this.add.graphics();
      bg.fillStyle(0x333333, 0.9);
      bg.fillRect(-50, -15, 100, 30);
      container.add(bg);

      const txt = this.add.text(0, 0, `${tower.name}\n$${tower.cost}`, {
        fontSize: '9px', color: '#ffffff', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5);
      container.add(txt);

      const border = this.add.graphics();
      container.add(border);

      const hitArea = this.add.rectangle(0, 0, 100, 30).setInteractive();
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
        border.strokeRect(-50, -15, 100, 30);
        this.hideTowerTooltip();
        this.towerTooltipTimer = this.time.delayedCall(1500, () => {
          this.showTowerTooltip(i, btnX, btnY - 15);
        });
      });
      hitArea.on('pointerout', () => {
        border.clear();
        this.hideTowerTooltip();
      });
      container.add(hitArea);
      this.towerButtons.push(container);
    });

    this.createRangeToggleButton();
    this.createSpeedButton();
    this.updateResources();
  }

  private setupInput(): void {
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
          });
          zone.on('pointerout', () => {
            this.clearPlacementPreview();
          });

          zone.on('pointerdown', () => {
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
              this.applyTowerLevelVisual(sprite, placed.level);

              this.selectedTowerIndex = -1;
              this.updateTowerButtonHighlights();
              this.clearPlacementPreview();
              this.playSfx('sfx_place');
            } else {
              console.log('[TD] Cannot place tower at', x, y, '(already occupied?)');
            }
          });
        }
      }
    }
  }

  private setupEventListeners(): void {
    // Melee hit particles
    eventBus.on('troop:meleeHit', (...args: unknown[]) => {
      this.spawnMeleeHitParticle(args[0] as number, args[1] as number, args[2] as string);
    });

    eventBus.on('enemy:killed', (enemy: unknown) => {
      const e = enemy as EnemyInstance;
      this.gold += e.data.goldReward;

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

    eventBus.on('enemy:damaged', () => {
      SoundFX.enemyHit();
    });

    eventBus.on('enemy:reached_end', (_enemy: unknown) => {
      this.wallHP -= 10;
      if (this.wallHP < 0) this.wallHP = 0;
      SoundFX.wallHit();
      eventBus.emit('wall:damaged', this.wallHP, this.wallMaxHP);

      if (this.wallHP <= 0) {
        this.gameState = 'game_over';
        this.showGameOver();
      }
    });

    eventBus.on('menu:dungeon', () => {
      const dungeon = this.dungeonGenerator.generate(this.currentWaveIndex + 1);
      this.dungeonUI.show(dungeon);
      this.gameState = 'dungeon';
      this.playMusic('music_dungeon');
      if (this.startWaveBtn) this.startWaveBtn.setVisible(false);
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
          // Gold reward
          const goldReward = 50 + this.currentWaveIndex * 15;
          this.gold += goldReward;
          this.updateResources();
          this.showDungeonReward('⚔ Combate', [`+${goldReward} Oro`]);
          break;
        }

        case 'elite': {
          // More gold + chance for character
          const eliteGold = 100 + this.currentWaveIndex * 20;
          this.gold += eliteGold;
          this.updateResources();
          const charResult = this.tryRollCharacter();
          const lines = [`+${eliteGold} Oro`];
          if (charResult) lines.push(`¡Nuevo: ${charResult}!`);
          this.showDungeonReward('💀 Élite', lines);
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
      this.gameState = 'preparing';
      this.playMusic('music_menu');
      if (this.startWaveBtn) this.startWaveBtn.setVisible(true);
    });

    eventBus.on('menu:upgrade_towers', () => {
      if (this.startWaveBtn) this.startWaveBtn.setVisible(false);
      this.showUpgradeUI();
    });

    eventBus.on('menu:continue', () => {
      this.startWave(this.currentWaveIndex);
    });

    eventBus.on('menu:collection', () => {
      if (this.startWaveBtn) this.startWaveBtn.setVisible(false);
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
      this.collectionUI.show(this.characterManager.getAllCharacterData(), ownedIds, ultProgress, ownedInstances);
    });

    eventBus.on('collection:closed', () => {
      if (this.startWaveBtn) this.startWaveBtn.setVisible(true);
    });
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
    this.playMusic('music_battle');
    const wave = waves[waveIndex];

    eventBus.emit('wave:start', waveIndex + 1);

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

    // Pause game when menu is open
    if (this.menuPanel.isVisible()) return;

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

    // Update enemy sprites
    this.updateEnemySprites();

    // Update projectile sprites
    this.updateProjectileSprites();
    this.updateTroopProjectiles();
    this.updateHitParticles(delta / 1000);

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
  private static readonly PROJ_STYLES: Record<string, { color: number; size: number; shape: 'circle' | 'diamond' | 'bolt' | 'star' }> = {
    tower_arrow:   { color: 0xffdd44, size: 4, shape: 'bolt' },
    tower_cannon:  { color: 0xff6600, size: 6, shape: 'circle' },
    tower_antiair: { color: 0x44ccff, size: 5, shape: 'diamond' },
    tower_magic:   { color: 0xcc44ff, size: 5, shape: 'star' },
  };

  private projectileGraphics: Phaser.GameObjects.Graphics | null = null;

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
    for (const proj of projectiles) {
      const style = GameScene.PROJ_STYLES[proj.towerId] ?? { color: 0xffffff, size: 4, shape: 'circle' as const };
      const g = this.projectileGraphics;
      const { x, y } = proj;

      // Glow
      g.fillStyle(style.color, 0.25);
      g.fillCircle(x, y, style.size + 3);

      g.fillStyle(style.color, 0.9);
      g.lineStyle(1, 0xffffff, 0.6);

      switch (style.shape) {
        case 'circle':
          g.fillCircle(x, y, style.size);
          g.strokeCircle(x, y, style.size);
          break;
        case 'diamond': {
          const s = style.size;
          g.fillPoints([
            new Phaser.Geom.Point(x, y - s),
            new Phaser.Geom.Point(x + s * 0.7, y),
            new Phaser.Geom.Point(x, y + s),
            new Phaser.Geom.Point(x - s * 0.7, y),
          ], true);
          break;
        }
        case 'bolt': {
          const s = style.size;
          g.fillPoints([
            new Phaser.Geom.Point(x - s * 0.3, y - s),
            new Phaser.Geom.Point(x + s * 0.5, y - s * 0.2),
            new Phaser.Geom.Point(x, y),
            new Phaser.Geom.Point(x + s * 0.3, y + s),
            new Phaser.Geom.Point(x - s * 0.5, y + s * 0.2),
            new Phaser.Geom.Point(x, y),
          ], true);
          break;
        }
        case 'star': {
          const s = style.size;
          const pts: Phaser.Geom.Point[] = [];
          for (let a = 0; a < 5; a++) {
            const angle1 = (a * 72 - 90) * Math.PI / 180;
            const angle2 = ((a * 72 + 36) - 90) * Math.PI / 180;
            pts.push(new Phaser.Geom.Point(x + Math.cos(angle1) * s, y + Math.sin(angle1) * s));
            pts.push(new Phaser.Geom.Point(x + Math.cos(angle2) * s * 0.4, y + Math.sin(angle2) * s * 0.4));
          }
          g.fillPoints(pts, true);
          break;
        }
      }
    }
  }

  private cleanDeadEnemies(): void {
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (enemy.currentHP <= 0) {
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
    overlay.fillRect(0, 0, 1024, 576);
    this.gameOverContainer.add(overlay);

    const title = this.add.text(512, 180, '¡DERROTA!\nLa muralla ha caído', {
      fontSize: '32px', color: '#ff2222', fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    this.gameOverContainer.add(title);

    // Button: Retry current level
    const retryBtn = this.add.text(512, 310, '🔄 Reintentar Nivel', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#884422', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();
    retryBtn.on('pointerdown', () => {
      this.playSfx('sfx_click');
      this.restartAtLevel(this.currentLevelIndex);
    });
    this.addHoverEffect(retryBtn, '#ffaa44');
    this.gameOverContainer.add(retryBtn);

    // Button: Restart from level 1
    const restartBtn = this.add.text(512, 380, '⏮ Comenzar desde Nivel 1', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#442288', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();
    restartBtn.on('pointerdown', () => {
      this.playSfx('sfx_click');
      this.restartAtLevel(0);
    });
    this.addHoverEffect(restartBtn, '#8844ff');
    this.gameOverContainer.add(restartBtn);
  }

  private restartAtLevel(levelIndex: number): void {
    // Stop any playing music (including boss defeat)
    this.stopMusic();

    // Clean game over UI
    if (this.gameOverContainer) {
      this.gameOverContainer.destroy();
      this.gameOverContainer = null;
    }

    this.currentLevelIndex = levelIndex;
    this.gold = 1000;
    this.cleanAllState();
    this.loadLevel(this.currentLevelIndex);
    this.setupInput();
    this.updateResources();
    this.enterPreparationPhase(0);
  }

  private showVictory(): void {
    this.stopMusic();
    this.playSfx('sfx_victory', 0.7);
    if (this.currentLevelIndex < levelsData.length - 1) {
      this.currentLevelIndex++;
      this.gold = 1000;
      this.saveSystem.updateData({
        currentLevelIndex: this.currentLevelIndex,
        gold: this.gold,
      });
      this.saveSystem.save();
      this.updateResources();
    }

    SoundFX.waveComplete();

    const victoryText = this.add.text(512, 240, '¡VICTORIA!\nNivel completado', {
      fontSize: '32px', color: '#44ff44', fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5).setDepth(300);

    if (this.currentLevelIndex < levelsData.length) {
      const nextBtn = this.add.text(512, 340, '▶ Siguiente Nivel', {
        fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#225522', padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setDepth(300).setInteractive();

      this.addHoverEffect(nextBtn, '#44ff44');
      nextBtn.on('pointerdown', () => {
        this.playSfx('sfx_click');
        victoryText.destroy();
        nextBtn.destroy();
        this.cleanAllState();
        this.loadLevel(this.currentLevelIndex);
        this.setupInput();
        this.startWave(0);
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
    if (this.troopSystem) this.troopSystem.clearAll();
    this.selectedCharacterId = null;
    this.hideTroopTooltip();
    this.hideTowerTooltip();
    // Clear arrays
    this.activeEnemies = [];
    this.spawnQueue = [];
    this.currentWaveIndex = 0;
    this.wallHP = this.wallMaxHP;
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

    const container = this.add.container(0, 0).setDepth(250);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, 1024, 576);
    container.add(overlay);

    const title = this.add.text(512, 40, 'Mejorar Torres', {
      fontSize: '22px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(title);

    const subtitle = this.add.text(512, 68, 'La mejora se aplica a TODAS las torres de ese tipo', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(subtitle);

    const closeBtn = this.add.text(512, 520, '[ Cerrar ]', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive();
    closeBtn.on('pointerover', () => closeBtn.setStroke('#ffff44', 2));
    closeBtn.on('pointerout', () => closeBtn.setStroke('', 0));
    closeBtn.on('pointerdown', () => {
      container.destroy();
      if (this.startWaveBtn) this.startWaveBtn.setVisible(true);
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

      const icon = this.add.sprite(tx, ty + 35, typeId).setDepth(251).setScale(1.5);
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
        fontSize: '11px', color: '#cccccc', fontFamily: 'monospace',
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
                this.applyTowerLevelVisual(tower.sprite, newLevel);
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
    this.hud.setTotalWaves(waves.length);
    this.hud.setWaveEnemies(this.buildWaveEnemyCounts(wave.enemies));

    // Start wave button — top bar, between round info and wall HP
    this.startWaveBtn = this.add.text(512, 10, '⚔ INICIAR RONDA', {
      fontSize: '13px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#226622', padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0).setDepth(250).setInteractive();

    this.startWaveBtn.on('pointerdown', () => {
      this.playSfx('sfx_click');
      this.startWave(this.currentWaveIndex);
    });
    this.addHoverEffect(this.startWaveBtn, '#44ff44');

    // Also show menu panel for upgrades
    this.menuPanel.show();

    this.updateResources();
    console.log('[TD] Preparation phase for wave', waveIndex + 1);
  }

  private clearPreparationUI(): void {
    if (this.startWaveBtn) {
      this.startWaveBtn.destroy();
      this.startWaveBtn = null;
    }
    this.menuPanel.hide();
  }

  // ---- Range Toggle ----
  private createRangeToggleButton(): void {
    const cx = 900, cy = 560, bw = 100, bh = 24;
    const cont = this.add.container(cx, cy).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 0.9);
    bg.fillRect(-bw / 2, -bh / 2, bw, bh);
    cont.add(bg);

    this.rangeToggleBtn = this.add.text(0, 0, '◎ Rangos: OFF', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
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
  }

  // ---- Speed Control ----
  private speedBg: Phaser.GameObjects.Graphics | null = null;
  private speedBorder: Phaser.GameObjects.Graphics | null = null;

  private createSpeedButton(): void {
    const cx = 790, cy = 560, bw = 80, bh = 24;
    const cont = this.add.container(cx, cy).setDepth(100);

    this.speedBg = this.add.graphics();
    this.speedBg.fillStyle(0x333333, 0.9);
    this.speedBg.fillRect(-bw / 2, -bh / 2, bw, bh);
    cont.add(this.speedBg);

    this.speedBtn = this.add.text(0, 0, '>>> x1', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
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
    });
    cont.add(hit);
  }

  // ---- Tower Level Visuals ----
  // Tint + scale towers based on level to give visual feedback
  private static readonly LEVEL_TINTS: number[] = [
    0xffffff, // level 1: normal
    0xaaffaa, // level 2: green tint
    0x88ccff, // level 3: blue tint
    0xffaa44, // level 4: orange tint
    0xff66ff, // level 5: pink tint
    0xffff44, // level 6: gold tint
    0xff4444, // level 7+: red tint
  ];

  private applyTowerLevelVisual(sprite: Phaser.GameObjects.Sprite, level: number): void {
    // Tint
    const tintIndex = Math.min(level - 1, GameScene.LEVEL_TINTS.length - 1);
    const tint = GameScene.LEVEL_TINTS[tintIndex];
    sprite.setTint(tint);

    // Scale slightly with level (max 1.4x at level 7+)
    const scale = 1.0 + Math.min(level - 1, 6) * 0.06;
    sprite.setScale(scale);
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
    const btnX = 70;
    const btnY = 560;
    const container = this.add.container(btnX, btnY).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x335533, 0.9);
    bg.fillRect(-50, -15, 100, 30);
    bg.lineStyle(1, 0x44aa44);
    bg.strokeRect(-50, -15, 100, 30);
    container.add(bg);

    const txt = this.add.text(0, 0, 'Tropas', {
      fontSize: '11px', color: '#88ff88', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(txt);

    const border = this.add.graphics();
    container.add(border);

    const hitArea = this.add.rectangle(0, 0, 100, 30).setInteractive().setAlpha(0.01);
    hitArea.on('pointerover', () => {
      border.clear();
      border.lineStyle(2, 0x88ff88);
      border.strokeRect(-50, -15, 100, 30);
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
    const dropX = 20;
    const dropY = 545 - dropH;

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
        fontSize: '11px', color: '#88ff88', fontFamily: 'monospace',
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
        fontSize: '10px', color: nameColor, fontFamily: 'monospace',
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
        fontSize: '11px', color: '#88ff88', fontFamily: 'monospace',
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
      fontSize: '11px', color: nameColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.troopTooltip.add(nameText);

    // Stat rows with icons
    let sy = tooltipY + spriteAreaH + padding + nameAreaH + 2;
    for (const [icon, label, value] of statRows) {
      const iconText = this.add.text(tooltipX + 6, sy, icon, {
        fontSize: '10px', fontFamily: 'monospace',
      });
      this.troopTooltip.add(iconText);
      const statText = this.add.text(tooltipX + 22, sy + 1, `${label}: ${value}`, {
        fontSize: '9px', color: '#cccccc', fontFamily: 'monospace',
      });
      this.troopTooltip.add(statText);
      sy += lineH;
    }

    // Passive skill
    if (passive) {
      sy += 2;
      const passiveText = this.add.text(tooltipX + 6, sy, `✨ ${passive.name}`, {
        fontSize: '9px', color: '#ffdd88', fontFamily: 'monospace',
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
      fontSize: '11px', color: '#ffdd88', fontFamily: 'monospace', fontStyle: 'bold',
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
        fontSize: '10px', fontFamily: 'monospace',
      });
      this.towerTooltip.add(iconText);
      const statText = this.add.text(tooltipX + 22, sy + 1, `${label}: ${value}`, {
        fontSize: '9px', color: '#cccccc', fontFamily: 'monospace',
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

    if (this.selectedCharacterId) {
      const charInst = this.characterManager.getOwnedCharacter(this.selectedCharacterId);
      if (charInst) {
        textureKey = this.textures.exists(charInst.data.id) ? charInst.data.id : `troop_${charInst.data.type}`;
        if (hasTower) scale = 0.7;
      }
    } else if (this.selectedTowerIndex >= 0) {
      const tower = AVAILABLE_TOWERS[this.selectedTowerIndex];
      textureKey = tower.id;
    }

    if (textureKey && this.textures.exists(textureKey)) {
      this.previewSprite = this.add.sprite(wx, wy, textureKey)
        .setDepth(50)
        .setAlpha(0.5)
        .setScale(scale);
    }
  }

  private clearPlacementPreview(): void {
    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
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
        // Tint based on state
        if (troop.state === 'attacking') {
          sprite.setTint(0xff4444);
        } else if (troop.state === 'patrol' || troop.state === 'returning') {
          sprite.setTint(0xffff44);
        } else {
          sprite.clearTint();
        }
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
    if (!this.textures.exists(texKey)) return;

    const sprite = this.add.sprite(x, y, texKey)
      .setDepth(20)
      .setScale(0.5)
      .setAlpha(0.9);
    this.hitParticles.push({ sprite, life: 0.4 });
  }

  private updateHitParticles(deltaSec: number): void {
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
  }
}

import Phaser from 'phaser';

// Frame counts for each enemy spritesheet
const ENEMY_FRAME_COUNTS: Record<string, number> = {
  enemy_runner: 4,
  enemy_tank: 4,
  enemy_berserker: 4,
  enemy_dark_mage: 4,
  enemy_healer: 4,
  enemy_exploder: 4,
  enemy_shield: 4,
  enemy_flying_bomb: 4,
  enemy_golem: 4,
  enemy_ground_boss: 6,
  enemy_wyvern: 5,
  enemy_harpy: 4,
  enemy_sky_boss: 4,
  enemy_titan: 6,
  enemy_specter: 4,
};

// Character IDs for troop sprite loading
const CHARACTER_IDS = [
  'char_soldier', 'char_archer', 'char_guard', 'char_scout',
  'char_militia', 'char_healer_basic', 'char_spearman', 'char_lookout',
  'char_knight', 'char_mage', 'char_ranger', 'char_priest',
  'char_hawk_rider', 'char_paladin', 'char_assassin', 'char_archmage',
  'char_dragon_knight', 'char_seraph', 'char_overlord', 'char_phoenix',
];

export { ENEMY_FRAME_COUNTS, CHARACTER_IDS };

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create minimal fallback textures (in case assets fail to load)
    this.createFallbacks();

    // Load real sprites from assets folder
    const base = 'assets/sprites/';

    // Tower images (single frame)
    this.load.image('tower_arrow', base + 'tower_arrow.png');
    this.load.image('tower_cannon', base + 'tower_cannon.png');
    this.load.image('tower_antiair', base + 'tower_antiair.png');
    this.load.image('tower_magic', base + 'tower_magic.png');

    // Map tiles
    this.load.image('tile-path', base + 'tile_path.png');
    this.load.image('tile-buildable', base + 'tile_buildable.png');
    this.load.image('tile-wall', base + 'tile_wall.png');
    this.load.image('tile-decoration', base + 'tile_decoration.png');

    // Projectile
    this.load.image('projectile-placeholder', base + 'projectile.png');

    // Enemy spritesheets (horizontal strips, 32px tall)
    for (const id of Object.keys(ENEMY_FRAME_COUNTS)) {
      this.load.spritesheet(id, base + id + '.png', {
        frameWidth: 32,
        frameHeight: 32,
      });
    }

    // Character/troop sprites (32x32 individual images)
    for (const id of CHARACTER_IDS) {
      this.load.image(id, base + 'troops/' + id + '.png');
    }

    // Projectile & hit effect sprites
    const effectIds = [
      'proj_arrow', 'proj_bolt', 'proj_fire', 'proj_magic', 'proj_frost',
      'proj_sting', 'proj_holy', 'proj_iron', 'proj_energy',
      'hit_sparkle', 'hit_sparkle2', 'hit_fire', 'hit_frost', 'hit_explosion',
    ];
    for (const id of effectIds) {
      this.load.image(id, base + 'effects/' + id + '.png');
    }

    // Music
    this.load.audio('music_menu', 'assets/music/menu.mp3');
    this.load.audio('music_battle', 'assets/music/battle.mp3');
    this.load.audio('music_dungeon', 'assets/music/dungeon.mp3');
    this.load.audio('music_boss_defeat', 'assets/music/boss_defeat.mp3');

    // SFX
    this.load.audio('sfx_click', 'assets/sfx/click.wav');
    this.load.audio('sfx_place', 'assets/sfx/complete.mp3');
    this.load.audio('sfx_victory', 'assets/sfx/victory.ogg');
    this.load.audio('sfx_defeat', 'assets/sfx/defeat.ogg');
    this.load.audio('sfx_chest_open', 'assets/sfx/chest_open.wav');
    this.load.audio('sfx_chest_fail', 'assets/sfx/chest_fail.wav');
    this.load.audio('sfx_boss_win', 'assets/sfx/boss_win.wav');
  }

  create(): void {
    // Create walk animations for each enemy type
    for (const [id, frameCount] of Object.entries(ENEMY_FRAME_COUNTS)) {
      if (this.textures.exists(id)) {
        this.anims.create({
          key: id + '_walk',
          frames: this.anims.generateFrameNumbers(id, { start: 0, end: frameCount - 1 }),
          frameRate: 6,
          repeat: -1,
        });
      }
    }

    this.createTroopSprites();
    this.scene.start('PreloadScene');
  }

  private createFallbacks(): void {
    const charG = this.make.graphics({ x: 0, y: 0 }, false);
    charG.fillStyle(0x3399ff);
    charG.fillCircle(16, 16, 12);
    charG.generateTexture('character-placeholder', 32, 32);
    charG.destroy();

    // Wall/fortress sprite (gate with bricks)
    const wG = this.make.graphics({ x: 0, y: 0 }, false);
    // Base wall bricks
    wG.fillStyle(0x666677);
    wG.fillRect(0, 8, 32, 24);
    // Brick lines
    wG.lineStyle(1, 0x555566);
    wG.lineBetween(0, 16, 32, 16);
    wG.lineBetween(0, 24, 32, 24);
    wG.lineBetween(8, 8, 8, 16);
    wG.lineBetween(24, 8, 24, 16);
    wG.lineBetween(16, 16, 16, 24);
    // Gate arch
    wG.fillStyle(0x332211);
    wG.fillRect(10, 14, 12, 18);
    // Battlements on top
    wG.fillStyle(0x777788);
    wG.fillRect(0, 4, 8, 8);
    wG.fillRect(12, 4, 8, 8);
    wG.fillRect(24, 4, 8, 8);
    // Top highlights
    wG.fillStyle(0x8888aa);
    wG.fillRect(0, 4, 8, 2);
    wG.fillRect(12, 4, 8, 2);
    wG.fillRect(24, 4, 8, 2);
    wG.generateTexture('wall_gate', 32, 32);
    wG.destroy();
  }

  private createTroopSprites(): void {
    // Ground troop: sword shape (green)
    const gG = this.make.graphics({ x: 0, y: 0 }, false);
    gG.fillStyle(0x44aa44);
    gG.fillRect(14, 4, 4, 20);       // blade
    gG.fillStyle(0x88dd88);
    gG.fillRect(14, 4, 4, 3);        // tip highlight
    gG.fillStyle(0x886633);
    gG.fillRect(8, 22, 16, 3);       // cross-guard
    gG.fillRect(14, 25, 4, 6);       // handle
    gG.generateTexture('troop_ground', 32, 32);
    gG.destroy();

    // Aerial troop: wings (blue)
    const aG = this.make.graphics({ x: 0, y: 0 }, false);
    aG.fillStyle(0x44aaff);
    aG.fillTriangle(16, 8, 2, 22, 14, 18);   // left wing
    aG.fillTriangle(16, 8, 30, 22, 18, 18);  // right wing
    aG.fillStyle(0x88ccff);
    aG.fillCircle(16, 16, 4);                 // body
    aG.generateTexture('troop_aerial', 32, 32);
    aG.destroy();

    // Support troop: staff with orb (orange)
    const sG = this.make.graphics({ x: 0, y: 0 }, false);
    sG.fillStyle(0x886633);
    sG.fillRect(15, 8, 3, 22);       // staff
    sG.fillStyle(0xffaa44);
    sG.fillCircle(16, 7, 5);         // orb
    sG.fillStyle(0xffdd88);
    sG.fillCircle(16, 6, 2);         // orb highlight
    sG.generateTexture('troop_support', 32, 32);
    sG.destroy();

    // Commander troop: crown (purple)
    const cG = this.make.graphics({ x: 0, y: 0 }, false);
    cG.fillStyle(0xcc44ff);
    cG.fillRect(6, 16, 20, 10);              // base
    cG.fillTriangle(6, 16, 10, 4, 14, 16);   // left spike
    cG.fillTriangle(12, 16, 16, 2, 20, 16);  // center spike
    cG.fillTriangle(18, 16, 22, 4, 26, 16);  // right spike
    cG.fillStyle(0xffdd44);
    cG.fillCircle(10, 8, 2);                  // gem left
    cG.fillCircle(16, 5, 2);                  // gem center
    cG.fillCircle(22, 8, 2);                  // gem right
    cG.generateTexture('troop_commander', 32, 32);
    cG.destroy();
  }
}

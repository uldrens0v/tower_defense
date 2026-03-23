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
    this.load.audio('music_dungeon', 'assets/music/dungeon.ogg');
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
    this.createTowerLevelVariants();
    this.createThemedTiles();
    this.createProjectileParticles();
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

  /**
   * Generate recolored tower textures for each level.
   * Level 1 uses the original texture. Levels 2-7 shift the hue.
   * Texture keys: tower_arrow_lv1, tower_arrow_lv2, ... tower_arrow_lv7
   */
  private createTowerLevelVariants(): void {
    const towerIds = ['tower_arrow', 'tower_cannon', 'tower_antiair', 'tower_magic'];

    // Hue shifts in degrees for each level (level 1 = 0 = original)
    const LEVEL_HUE_SHIFTS = [
      0,    // Level 1: original color
      200,  // Level 2: blue
      270,  // Level 3: purple
      50,   // Level 4: gold/yellow
      160,  // Level 5: cyan/teal
      0,    // Level 6: crimson (shift + saturation boost)
      300,  // Level 7: magenta/legendary
    ];

    for (const towerId of towerIds) {
      if (!this.textures.exists(towerId)) continue;

      const sourceImage = this.textures.get(towerId).getSourceImage() as HTMLImageElement;
      const w = sourceImage.width;
      const h = sourceImage.height;

      for (let lv = 0; lv < LEVEL_HUE_SHIFTS.length; lv++) {
        const key = `${towerId}_lv${lv + 1}`;

        if (lv === 0) {
          // Level 1: just alias the original texture
          // Create a copy so it's consistent
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(sourceImage, 0, 0);
          this.textures.addCanvas(key, canvas);
          continue;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(sourceImage, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const hueShift = LEVEL_HUE_SHIFTS[lv];

        // Level 6 special: increase saturation + slight red push
        const satBoost = lv === 5 ? 1.4 : (lv === 6 ? 1.2 : 1.0);
        const lightBoost = lv === 6 ? 1.15 : 1.0; // legendary glow

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a === 0) continue; // skip transparent

          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;

          // Convert RGB to HSL
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;

          // Only recolor pixels that have some saturation (not gray/white/black)
          const delta = max - min;
          if (delta < 0.08) continue; // skip grays

          let hue = 0;
          const sat = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

          if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
          else if (max === g) hue = ((b - r) / delta + 2) * 60;
          else hue = ((r - g) / delta + 4) * 60;

          // Apply hue shift
          let newHue = (hue + hueShift) % 360;
          if (newHue < 0) newHue += 360;
          const newSat = Math.min(1, sat * satBoost);
          const newL = Math.min(1, l * lightBoost);

          // Convert HSL back to RGB
          const [nr, ng, nb] = BootScene.hslToRgb(newHue / 360, newSat, newL);
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
        }

        ctx.putImageData(imageData, 0, 0);
        this.textures.addCanvas(key, canvas);
      }
    }
  }

  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  }

  /** Generate themed tile textures for desert, cave, and jungle biomes */
  private createThemedTiles(): void {
    // Helper to create a 32x32 tile
    const makeTile = (key: string, drawFn: (g: Phaser.GameObjects.Graphics) => void) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      drawFn(g);
      g.generateTexture(key, 32, 32);
      g.destroy();
    };

    // ═══════════ FOREST ═══════════
    makeTile('tile-path-forest', (g) => {
      g.fillStyle(0x5a7a3a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x4d6b30); g.fillRect(3, 10, 26, 3);
      g.fillStyle(0x6b8a48); g.fillRect(12, 22, 10, 2);
      // Fallen leaves
      g.fillStyle(0x8a6b30); g.fillRect(6, 6, 3, 2);
      g.fillStyle(0x7a5a28); g.fillRect(22, 18, 2, 2);
    });
    makeTile('tile-buildable-forest', (g) => {
      g.fillStyle(0x4a8a3e); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x3d7a32); g.fillRect(0, 0, 32, 6);
      g.fillStyle(0x55994a); g.fillRect(20, 22, 6, 4);
      g.lineStyle(1, 0x2d6a24, 0.3); g.strokeRect(0, 0, 32, 32);
    });
    makeTile('tile-wall-forest', (g) => {
      g.fillStyle(0x3a5a2a); g.fillRect(0, 0, 32, 32);
      // Tree trunk
      g.fillStyle(0x6b4a28); g.fillRect(12, 8, 8, 24);
      g.fillStyle(0x7a5a30); g.fillRect(14, 10, 4, 20);
      // Canopy
      g.fillStyle(0x2a6a22); g.fillCircle(16, 8, 10);
      g.fillStyle(0x338833); g.fillCircle(16, 8, 7);
    });
    makeTile('tile-decoration-forest', (g) => {
      g.fillStyle(0x4a8a3e); g.fillRect(0, 0, 32, 32);
      // Mushroom
      g.fillStyle(0xcc4444); g.fillCircle(16, 14, 6);
      g.fillStyle(0xdddddd); g.fillRect(14, 14, 4, 10);
      g.fillStyle(0xffffff); g.fillCircle(14, 12, 2);
      g.fillStyle(0xffffff); g.fillCircle(19, 13, 1);
    });

    // ═══════════ MOUNTAIN ═══════════
    makeTile('tile-path-mountain', (g) => {
      g.fillStyle(0x8a8a8a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x7a7a7a); g.fillRect(4, 6, 24, 3);
      g.fillStyle(0x9a9a9a); g.fillRect(10, 20, 14, 2);
    });
    makeTile('tile-buildable-mountain', (g) => {
      g.fillStyle(0x999999); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x8a8a8a); g.fillRect(0, 0, 32, 4);
      g.lineStyle(1, 0x777777, 0.3); g.strokeRect(0, 0, 32, 32);
      // Pebbles
      g.fillStyle(0x777777); g.fillRect(6, 14, 3, 2);
      g.fillStyle(0xaaaaaa); g.fillRect(22, 24, 2, 2);
    });
    makeTile('tile-wall-mountain', (g) => {
      g.fillStyle(0x666666); g.fillRect(0, 0, 32, 32);
      // Rock layers
      g.fillStyle(0x555555); g.fillRect(0, 0, 32, 10);
      g.fillStyle(0x5a5a5a); g.fillRect(0, 20, 32, 12);
      g.lineStyle(1, 0x4a4a4a, 0.5);
      g.lineBetween(0, 10, 32, 10); g.lineBetween(0, 20, 32, 20);
      // Snow cap
      g.fillStyle(0xddddee); g.fillTriangle(16, 2, 8, 10, 24, 10);
    });
    makeTile('tile-decoration-mountain', (g) => {
      g.fillStyle(0x999999); g.fillRect(0, 0, 32, 32);
      // Rock pile
      g.fillStyle(0x777777); g.fillTriangle(16, 8, 6, 26, 26, 26);
      g.fillStyle(0x888888); g.fillTriangle(16, 12, 10, 24, 22, 24);
      // Snow
      g.fillStyle(0xccccdd); g.fillRect(12, 8, 8, 3);
    });

    // ═══════════ ABYSS ═══════════
    makeTile('tile-path-abyss', (g) => {
      g.fillStyle(0x1a1a2e); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x22223a); g.fillRect(4, 8, 24, 3);
      g.fillStyle(0x2a2a44); g.fillRect(12, 22, 10, 2);
      // Purple cracks
      g.fillStyle(0x6622aa); g.fillRect(8, 14, 2, 6);
      g.fillStyle(0x5518aa); g.fillRect(20, 4, 1, 8);
    });
    makeTile('tile-buildable-abyss', (g) => {
      g.fillStyle(0x22223a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x1a1a30); g.fillRect(0, 0, 32, 4);
      g.lineStyle(1, 0x332266, 0.4); g.strokeRect(0, 0, 32, 32);
      // Faint glow
      g.fillStyle(0x442288, 0.15); g.fillCircle(16, 16, 8);
    });
    makeTile('tile-wall-abyss', (g) => {
      g.fillStyle(0x111122); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x1a1a33); g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x1a1a33); g.fillRect(16, 16, 16, 16);
      // Purple veins
      g.lineStyle(1, 0x6622cc, 0.4);
      g.lineBetween(4, 4, 14, 14); g.lineBetween(28, 6, 18, 28);
      // Eye
      g.fillStyle(0x8844cc); g.fillCircle(24, 8, 3);
      g.fillStyle(0xaa66ff); g.fillCircle(24, 8, 1);
    });
    makeTile('tile-decoration-abyss', (g) => {
      g.fillStyle(0x22223a); g.fillRect(0, 0, 32, 32);
      // Dark crystal
      g.fillStyle(0x5522aa); g.fillTriangle(16, 4, 8, 24, 24, 24);
      g.fillStyle(0x7744cc); g.fillTriangle(16, 8, 11, 22, 21, 22);
      // Glow
      g.fillStyle(0xaa66ff, 0.2); g.fillCircle(16, 16, 10);
    });

    // ═══════════ CHAOS ═══════════
    makeTile('tile-path-chaos', (g) => {
      g.fillStyle(0x3a1a1a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x441a1a); g.fillRect(4, 8, 24, 3);
      // Lava cracks
      g.fillStyle(0xff4400); g.fillRect(8, 14, 2, 4);
      g.fillStyle(0xff6622); g.fillRect(18, 22, 3, 2);
      g.fillStyle(0xff3300); g.fillRect(24, 6, 1, 6);
    });
    makeTile('tile-buildable-chaos', (g) => {
      g.fillStyle(0x442222); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x3a1a1a); g.fillRect(0, 0, 32, 4);
      g.lineStyle(1, 0x662222, 0.4); g.strokeRect(0, 0, 32, 32);
      // Ember
      g.fillStyle(0xff6600, 0.2); g.fillCircle(8, 20, 3);
    });
    makeTile('tile-wall-chaos', (g) => {
      g.fillStyle(0x2a0a0a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x331111); g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x331111); g.fillRect(16, 16, 16, 16);
      // Lava veins
      g.lineStyle(1.5, 0xff4400, 0.6);
      g.lineBetween(2, 12, 16, 4); g.lineBetween(16, 28, 30, 18);
      // Skull
      g.fillStyle(0xccccbb); g.fillCircle(16, 16, 4);
      g.fillStyle(0x2a0a0a); g.fillRect(14, 14, 2, 2);
      g.fillStyle(0x2a0a0a); g.fillRect(18, 14, 2, 2);
    });
    makeTile('tile-decoration-chaos', (g) => {
      g.fillStyle(0x442222); g.fillRect(0, 0, 32, 32);
      // Demon statue
      g.fillStyle(0x882222); g.fillTriangle(16, 4, 6, 28, 26, 28);
      g.fillStyle(0xaa3333); g.fillTriangle(16, 8, 10, 26, 22, 26);
      // Glowing eyes
      g.fillStyle(0xff4400); g.fillCircle(13, 16, 2);
      g.fillStyle(0xff4400); g.fillCircle(19, 16, 2);
    });

    // ═══════════ DESERT ═══════════
    makeTile('tile-path-desert', (g) => {
      g.fillStyle(0xd4a843); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xc99b3a); g.fillRect(4, 8, 24, 2);
      g.fillStyle(0xdbb550); g.fillRect(10, 20, 12, 2);
    });
    makeTile('tile-buildable-desert', (g) => {
      g.fillStyle(0xe8c95a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xd4a843); g.fillRect(0, 0, 32, 4);
      g.lineStyle(1, 0xc99b3a, 0.3); g.strokeRect(0, 0, 32, 32);
    });
    makeTile('tile-wall-desert', (g) => {
      g.fillStyle(0xa07030); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x8a6028); g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x8a6028); g.fillRect(16, 16, 16, 16);
      g.lineStyle(1, 0x705020, 0.5);
      g.lineBetween(0, 16, 32, 16); g.lineBetween(16, 0, 16, 32);
    });
    makeTile('tile-decoration-desert', (g) => {
      g.fillStyle(0xe8c95a); g.fillRect(0, 0, 32, 32);
      // Cactus
      g.fillStyle(0x448833); g.fillRect(14, 8, 4, 18);
      g.fillRect(8, 12, 6, 4); g.fillRect(18, 16, 6, 4);
      g.fillStyle(0x55aa44); g.fillRect(15, 8, 2, 16);
    });

    // ═══════════ CAVE ═══════════
    makeTile('tile-path-cave', (g) => {
      g.fillStyle(0x444455); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x3a3a4a); g.fillRect(6, 4, 8, 4);
      g.fillStyle(0x4e4e60); g.fillRect(18, 22, 10, 4);
    });
    makeTile('tile-buildable-cave', (g) => {
      g.fillStyle(0x555566); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x4a4a5a); g.fillRect(0, 0, 32, 4);
      g.lineStyle(1, 0x3d3d4d, 0.4); g.strokeRect(0, 0, 32, 32);
    });
    makeTile('tile-wall-cave', (g) => {
      g.fillStyle(0x2a2a3a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x333344); g.fillRect(2, 2, 12, 10);
      g.fillStyle(0x333344); g.fillRect(18, 18, 12, 10);
      // Crystal glints
      g.fillStyle(0x6688cc); g.fillRect(22, 6, 3, 3);
      g.fillStyle(0x88aadd); g.fillRect(8, 22, 2, 2);
    });
    makeTile('tile-decoration-cave', (g) => {
      g.fillStyle(0x555566); g.fillRect(0, 0, 32, 32);
      // Stalagmite
      g.fillStyle(0x666678); g.fillTriangle(16, 6, 10, 28, 22, 28);
      g.fillStyle(0x777788); g.fillTriangle(16, 10, 12, 26, 20, 26);
    });

    // ═══════════ JUNGLE ═══════════
    makeTile('tile-path-jungle', (g) => {
      g.fillStyle(0x6b4423); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x5a3a1e); g.fillRect(2, 12, 28, 3);
      g.fillStyle(0x7a5030); g.fillRect(8, 24, 16, 2);
    });
    makeTile('tile-buildable-jungle', (g) => {
      g.fillStyle(0x2d6b30); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x1e5a22); g.fillRect(0, 0, 32, 6);
      g.fillStyle(0x388a3c); g.fillRect(4, 20, 8, 6);
      g.lineStyle(1, 0x1a4d1e, 0.3); g.strokeRect(0, 0, 32, 32);
    });
    makeTile('tile-wall-jungle', (g) => {
      g.fillStyle(0x1a3a1a); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x224422); g.fillRect(0, 0, 16, 16);
      g.fillStyle(0x224422); g.fillRect(16, 16, 16, 16);
      // Vine
      g.fillStyle(0x44aa44); g.fillRect(14, 0, 3, 32);
      g.fillStyle(0x338833); g.fillRect(12, 8, 2, 4);
      g.fillStyle(0x338833); g.fillRect(18, 20, 2, 4);
    });
    makeTile('tile-decoration-jungle', (g) => {
      g.fillStyle(0x2d6b30); g.fillRect(0, 0, 32, 32);
      // Tropical flower
      g.fillStyle(0xff5588); g.fillCircle(16, 14, 5);
      g.fillStyle(0xff7799); g.fillCircle(16, 14, 3);
      g.fillStyle(0xffdd44); g.fillCircle(16, 14, 2);
      // Leaf
      g.fillStyle(0x44aa44); g.fillTriangle(16, 20, 6, 30, 26, 30);
    });
  }

  private createProjectileParticles(): void {
    const particles: { key: string; color: number; glowColor: number; shape: 'circle' | 'diamond' | 'star' | 'spark' }[] = [
      { key: 'particle-arrow', color: 0xffdd44, glowColor: 0xffaa00, shape: 'spark' },
      { key: 'particle-cannon', color: 0xff6600, glowColor: 0xff3300, shape: 'circle' },
      { key: 'particle-antiair', color: 0x44ccff, glowColor: 0x2288cc, shape: 'diamond' },
      { key: 'particle-magic', color: 0xcc44ff, glowColor: 0x8822cc, shape: 'star' },
      { key: 'particle-impact', color: 0xffffff, glowColor: 0xffffaa, shape: 'circle' },
    ];

    for (const p of particles) {
      const size = 16;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const cx = size / 2;
      const cy = size / 2;

      // Outer glow
      g.fillStyle(p.glowColor, 0.2);
      g.fillCircle(cx, cy, size / 2);
      g.fillStyle(p.glowColor, 0.4);
      g.fillCircle(cx, cy, size / 3);

      // Main shape
      g.fillStyle(p.color, 0.9);
      switch (p.shape) {
        case 'circle':
          g.fillCircle(cx, cy, size / 4);
          break;
        case 'diamond':
          g.fillPoints([
            new Phaser.Geom.Point(cx, cy - size / 3),
            new Phaser.Geom.Point(cx + size / 4, cy),
            new Phaser.Geom.Point(cx, cy + size / 3),
            new Phaser.Geom.Point(cx - size / 4, cy),
          ], true);
          break;
        case 'star': {
          const pts: Phaser.Geom.Point[] = [];
          for (let i = 0; i < 5; i++) {
            const a1 = (i * 72 - 90) * Math.PI / 180;
            const a2 = ((i * 72 + 36) - 90) * Math.PI / 180;
            pts.push(new Phaser.Geom.Point(cx + Math.cos(a1) * size / 3, cy + Math.sin(a1) * size / 3));
            pts.push(new Phaser.Geom.Point(cx + Math.cos(a2) * size / 6, cy + Math.sin(a2) * size / 6));
          }
          g.fillPoints(pts, true);
          break;
        }
        case 'spark':
          // Cross/spark shape
          g.fillRect(cx - 1, cy - size / 3, 2, size * 2 / 3);
          g.fillRect(cx - size / 3, cy - 1, size * 2 / 3, 2);
          break;
      }

      // Bright white core
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(cx, cy, 2);

      g.generateTexture(p.key, size, size);
      g.destroy();
    }
  }
}

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
    this.createTowerLevelVariants();
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
}

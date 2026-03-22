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

export { ENEMY_FRAME_COUNTS };

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

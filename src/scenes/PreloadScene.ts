import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(centerX - 160, centerY - 15, 320, 30);

    this.progressBar = this.add.graphics();

    this.loadingText = this.add.text(centerX, centerY - 40, 'Cargando...', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.percentText = this.add.text(centerX, centerY, '0%', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Simulate loading with a tween since we use generated textures
    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 800,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const value = (tween.getValue() ?? 0) / 100;
        this.progressBar.clear();
        this.progressBar.fillStyle(0x44aa44, 1);
        this.progressBar.fillRect(centerX - 155, centerY - 10, 310 * value, 20);
        this.percentText.setText(`${Math.floor(value * 100)}%`);
      },
      onComplete: () => {
        this.loadingText.setText('¡Listo!');
        this.time.delayedCall(300, () => {
          this.scene.start('GameScene');
        });
      },
    });
  }
}

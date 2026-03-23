import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

interface TutorialSection {
  title: string;
  lines: string[];
  /** Illustrations to render below text lines */
  illustrations?: TutorialIllustration[];
}

interface TutorialIllustration {
  type: 'sprites' | 'arrow_sequence' | 'room_icons' | 'range_demo';
  y: number; // relative y from start of section content
  data?: unknown;
}

const SECTIONS: TutorialSection[] = [
  {
    title: 'Como jugar',
    lines: [
      '--- OBJETIVO ---',
      'Defiende la muralla de las oleadas de enemigos.',
      'Si la vida de la muralla llega a 0, pierdes.',
      '',
      '--- COLOCAR DEFENSAS ---',
      'Selecciona una torre en la barra inferior y',
      'haz clic en una casilla edificable para colocarla.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '--- COLOCAR TROPAS ---',
      'Pulsa "Tropas" para ver tus personajes.',
      'Selecciona uno y colócalo en el mapa.',
      'Puedes ponerlo encima de una torre.',
      '',
      '',
      '',
      '',
      '',
      '',
      '--- TERRESTRE vs AEREO ---',
      'Flechas/Canon: solo terrestres.',
      'Balista: solo aereos. Arcana: ambos.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '--- ATAJOS DE TECLADO ---',
      'ESPACIO: Iniciar ronda',
      '1-4: Seleccionar torre',
      'A: Toggle autoplay',
      'S: Toggle velocidad x1/x3',
      'Click-der sobre torre: Vender (60% reembolso)',
    ],
    illustrations: [
      { type: 'arrow_sequence', y: 8 * 16 + 4, data: {
        label: 'Colocar torres:',
        items: [
          { sprite: 'tower_arrow', caption: 'Flechas' },
          { sprite: 'tower_cannon', caption: 'Cañón' },
          { sprite: 'tower_antiair', caption: 'Balista' },
          { sprite: 'tower_magic', caption: 'Arcana' },
        ]
      }},
      { type: 'arrow_sequence', y: 18 * 16 + 4, data: {
        label: 'Colocar tropas sobre el mapa:',
        items: [
          { sprite: 'char_soldier', caption: 'Soldado' },
          { sprite: 'char_archer', caption: 'Arquero' },
          { sprite: 'char_mage', caption: 'Mago' },
          { sprite: 'char_knight', caption: 'Caballero' },
        ]
      }},
      { type: 'range_demo', y: 28 * 16 + 4, data: {
        items: [
          { sprite: 'tower_arrow', label: 'Flechas', target: 'ground', color: 0x44ff44 },
          { sprite: 'tower_cannon', label: 'Cañón', target: 'ground', color: 0xff8844 },
          { sprite: 'tower_antiair', label: 'Balista', target: 'air', color: 0x44ccff },
          { sprite: 'tower_magic', label: 'Arcana', target: 'both', color: 0xcc44ff },
        ]
      }},
    ],
  },
  {
    title: 'Calabozo',
    lines: [
      '--- ACCESO ---',
      'Pulsa ESC (o menu) y selecciona',
      '"Entrar al Calabozo" entre rondas.',
      '',
      '--- TIPOS DE HABITACION ---',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    illustrations: [
      { type: 'room_icons', y: 5 * 16 + 4, data: {
        rooms: [
          { icon: '🏕', color: 0x336633, name: 'Descanso', desc: 'Punto seguro. Recupera\nHP de la muralla.' },
          { icon: '⚔', color: 0x663333, name: 'Combate', desc: 'Desafio de memoria.\nGana oro si aciertas.' },
          { icon: '📦', color: 0x665522, name: 'Cofre', desc: 'Resuelve matematicas\npara obtener items.' },
          { icon: '💀', color: 0x552244, name: 'Elite', desc: 'Desafio de memoria\ndificil. Mejor botin.' },
          { icon: '👹', color: 0x442222, name: 'Jefe', desc: 'Escritura rapida.\nGrandes recompensas.' },
        ]
      }},
    ],
  },
  {
    title: 'Mejorar torres',
    lines: [
      '--- ACCESO ---',
      'Pulsa ESC (o menu) y selecciona',
      '"Mejorar Torres" entre rondas.',
      '',
      '--- FUNCIONAMIENTO ---',
      'Gasta oro para subir el nivel de un tipo',
      'de torre. La mejora se aplica a TODAS las',
      'torres de ese tipo que tengas colocadas.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    illustrations: [
      { type: 'arrow_sequence', y: 9 * 16 + 4, data: {
        label: 'Ejemplo de mejora:',
        isUpgrade: true,
        items: [
          { sprite: 'tower_cannon', caption: 'Nv.1\nDaño: 40' },
          { sprite: 'tower_cannon', caption: 'Nv.2\nDaño: 46', tint: 0x88aaff },
          { sprite: 'tower_cannon', caption: 'Nv.3\nDaño: 52', tint: 0xffaa44 },
          { sprite: 'tower_cannon', caption: 'Nv.4\nDaño: 58', tint: 0xff4444, scale: 1.15 },
        ]
      }},
    ],
  },
  {
    title: 'Inventario',
    lines: [
      '',
      '        En desarrollo',
      '',
      '  Esta funcion estara disponible',
      '  en futuras actualizaciones.',
    ],
  },
  {
    title: 'Coleccion',
    lines: [
      '--- ACCESO ---',
      'Pulsa ESC (o menu) y selecciona',
      '"Coleccion" entre rondas.',
      '',
      '--- CONTENIDO ---',
      'Ve todos los personajes disponibles.',
      'Haz clic para ver sus estadisticas.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    illustrations: [
      { type: 'arrow_sequence', y: 8 * 16 + 4, data: {
        label: 'Ejemplos de tropas por rareza:',
        items: [
          { sprite: 'char_soldier', caption: 'Comun', captionColor: '#aaaaaa' },
          { sprite: 'char_knight', caption: 'Poco comun', captionColor: '#44cc44' },
          { sprite: 'char_paladin', caption: 'Raro', captionColor: '#4488ff' },
          { sprite: 'char_dragon_knight', caption: 'Epico', captionColor: '#cc44ff' },
          { sprite: 'char_phoenix', caption: 'Mitico', captionColor: '#ff4444' },
        ]
      }},
    ],
  },
];

export class TutorialPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private openSection = -1;
  private sectionContents: Phaser.GameObjects.Container[] = [];
  private sectionTitles: Phaser.GameObjects.Text[] = [];
  private sectionArrows: Phaser.GameObjects.Text[] = [];
  private sectionBgs: { bg: Phaser.GameObjects.Graphics; y: number }[] = [];
  private scrollOffset = 0;
  private maxScroll = 0;
  private contentMask: Phaser.Display.Masks.GeometryMask | null = null;

  // Panel dimensions
  private readonly panelW = 500;
  private readonly panelH = 490;
  private readonly panelX: number;
  private readonly panelY = 30;
  private readonly contentAreaY: number;
  private readonly contentAreaH: number;
  private readonly headerH = 50;
  private readonly sectionHeaderH = 32;
  private readonly startBtnTotalH = 46;

  private onClose: () => void;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    this.scene = scene;
    this.onClose = onClose;
    this.panelX = GAME_WIDTH / 2 - this.panelW / 2;
    this.contentAreaY = this.panelY + this.headerH + SECTIONS.length * this.sectionHeaderH;
    this.contentAreaH = this.panelY + this.panelH - this.contentAreaY - this.startBtnTotalH;
    this.container = scene.add.container(0, 0).setDepth(300);
    this.build();
  }

  private build(): void {
    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );
    this.container.add(overlay);

    // Panel background
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRect(this.panelX, this.panelY, this.panelW, this.panelH);
    panel.lineStyle(2, 0x44aa44);
    panel.strokeRect(this.panelX, this.panelY, this.panelW, this.panelH);
    this.container.add(panel);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, this.panelY + 14, 'TUTORIAL', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Separator line under title
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x44aa44, 0.5);
    sep.lineBetween(this.panelX + 20, this.panelY + this.headerH - 4, this.panelX + this.panelW - 20, this.panelY + this.headerH - 4);
    this.container.add(sep);

    // Section headers
    for (let i = 0; i < SECTIONS.length; i++) {
      const sy = this.panelY + this.headerH + i * this.sectionHeaderH;
      this.createSectionHeader(i, SECTIONS[i].title, sy);
    }

    // Gear icon for "Inventario"
    const invIdx = SECTIONS.findIndex(s => s.title === 'Inventario');
    if (invIdx >= 0) {
      const iy = this.panelY + this.headerH + invIdx * this.sectionHeaderH;
      const gear = this.scene.add.text(
        this.panelX + this.panelW - 40, iy + this.sectionHeaderH / 2, '\u2699',
        { fontSize: '16px', color: '#888888', fontFamily: 'monospace' }
      ).setOrigin(0.5);
      this.container.add(gear);
    }

    // Close button
    const closeBtn = this.scene.add.text(this.panelX + this.panelW - 14, this.panelY + 8, 'X', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive();
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff8888'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff4444'));
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    // "Empezar" button at bottom
    const startBtnW = 200;
    const startBtnH = 34;
    const startBtnX = GAME_WIDTH / 2 - startBtnW / 2;
    const startBtnY = this.panelY + this.panelH - startBtnH - 8;

    const startBg = this.scene.add.graphics();
    startBg.fillStyle(0x335533, 0.95);
    startBg.fillRect(startBtnX, startBtnY, startBtnW, startBtnH);
    startBg.lineStyle(2, 0x44aa44);
    startBg.strokeRect(startBtnX, startBtnY, startBtnW, startBtnH);
    this.container.add(startBg);

    const startText = this.scene.add.text(GAME_WIDTH / 2, startBtnY + startBtnH / 2, 'EMPEZAR', {
      fontSize: '16px', color: '#88ff88', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive();
    startText.on('pointerover', () => {
      startText.setColor('#ffffff');
      startBg.clear();
      startBg.fillStyle(0x447744, 0.95);
      startBg.fillRect(startBtnX, startBtnY, startBtnW, startBtnH);
      startBg.lineStyle(2, 0x88ff88);
      startBg.strokeRect(startBtnX, startBtnY, startBtnW, startBtnH);
    });
    startText.on('pointerout', () => {
      startText.setColor('#88ff88');
      startBg.clear();
      startBg.fillStyle(0x335533, 0.95);
      startBg.fillRect(startBtnX, startBtnY, startBtnW, startBtnH);
      startBg.lineStyle(2, 0x44aa44);
      startBg.strokeRect(startBtnX, startBtnY, startBtnW, startBtnH);
    });
    startText.on('pointerdown', () => this.close());
    this.container.add(startText);

    // Scroll with mouse wheel
    this.scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      if (!this.container.visible || this.openSection < 0) return;
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + dy * 0.5,
        0,
        Math.max(0, this.maxScroll)
      );
      this.updateContentScroll();
    });
  }

  private createSectionHeader(index: number, label: string, y: number): void {
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x333355, 0.9);
    headerBg.fillRect(this.panelX + 10, y + 2, this.panelW - 20, this.sectionHeaderH - 4);
    this.container.add(headerBg);

    const arrow = this.scene.add.text(this.panelX + 24, y + this.sectionHeaderH / 2, '\u25B6', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(arrow);
    this.sectionArrows.push(arrow);

    const txt = this.scene.add.text(this.panelX + 40, y + this.sectionHeaderH / 2, label, {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);
    this.container.add(txt);
    this.sectionTitles.push(txt);
    this.sectionBgs.push({ bg: headerBg, y });

    const hitArea = this.scene.add.rectangle(
      this.panelX + this.panelW / 2, y + this.sectionHeaderH / 2,
      this.panelW - 20, this.sectionHeaderH - 4
    ).setInteractive().setAlpha(0.01);

    hitArea.on('pointerover', () => {
      if (this.openSection !== index) {
        headerBg.clear();
        headerBg.fillStyle(0x444477, 0.9);
        headerBg.fillRect(this.panelX + 10, y + 2, this.panelW - 20, this.sectionHeaderH - 4);
      }
    });
    hitArea.on('pointerout', () => {
      if (this.openSection !== index) {
        headerBg.clear();
        headerBg.fillStyle(0x333355, 0.9);
        headerBg.fillRect(this.panelX + 10, y + 2, this.panelW - 20, this.sectionHeaderH - 4);
      }
    });
    hitArea.on('pointerdown', () => {
      if (this.openSection === index) {
        this.closeSection(index);
        this.openSection = -1;
        txt.setColor('#cccccc');
        arrow.setText('\u25B6');
        arrow.setColor('#aaaaaa');
        headerBg.clear();
        headerBg.fillStyle(0x333355, 0.9);
        headerBg.fillRect(this.panelX + 10, y + 2, this.panelW - 20, this.sectionHeaderH - 4);
      } else {
        if (this.openSection >= 0) {
          const prevIdx = this.openSection;
          this.closeSection(prevIdx);
          this.sectionTitles[prevIdx].setColor('#cccccc');
          this.sectionArrows[prevIdx].setText('\u25B6');
          this.sectionArrows[prevIdx].setColor('#aaaaaa');
          const prevBg = this.sectionBgs[prevIdx];
          prevBg.bg.clear();
          prevBg.bg.fillStyle(0x333355, 0.9);
          prevBg.bg.fillRect(this.panelX + 10, prevBg.y + 2, this.panelW - 20, this.sectionHeaderH - 4);
        }
        this.openSection = index;
        txt.setColor('#ffcc00');
        arrow.setText('\u25BC');
        arrow.setColor('#ffcc00');
        headerBg.clear();
        headerBg.fillStyle(0x444466, 0.95);
        headerBg.fillRect(this.panelX + 10, y + 2, this.panelW - 20, this.sectionHeaderH - 4);
        this.showSectionContent(index);
      }
    });
    this.container.add(hitArea);
  }

  private showSectionContent(index: number): void {
    this.clearContent();
    this.scrollOffset = 0;

    const section = SECTIONS[index];
    const contentContainer = this.scene.add.container(0, 0);

    const lineH = 16;
    const startY = this.contentAreaY + 6;
    const textX = this.panelX + 24;

    // Render text lines
    for (let i = 0; i < section.lines.length; i++) {
      const line = section.lines[i];
      if (!line) continue; // skip empty lines (used as illustration spacers)
      const isHeader = line.startsWith('---') && line.endsWith('---');

      const txt = this.scene.add.text(textX, startY + i * lineH, line, {
        fontSize: isHeader ? '12px' : '11px',
        color: isHeader ? '#ffcc00' : '#bbbbbb',
        fontFamily: 'monospace',
        fontStyle: isHeader ? 'bold' : 'normal',
      });
      contentContainer.add(txt);
    }

    // Render illustrations
    if (section.illustrations) {
      for (const illus of section.illustrations) {
        this.renderIllustration(contentContainer, illus, startY, textX);
      }
    }

    const totalContentH = section.lines.length * lineH + 12;
    this.maxScroll = Math.max(0, totalContentH - this.contentAreaH);

    // Create mask for scrollable area
    const maskShape = this.scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(this.panelX + 10, this.contentAreaY, this.panelW - 20, this.contentAreaH);
    this.contentMask = maskShape.createGeometryMask();
    contentContainer.setMask(this.contentMask);

    this.sectionContents.push(contentContainer);
    this.container.add(contentContainer);

    // Scroll indicator if content overflows
    if (this.maxScroll > 0) {
      const scrollHint = this.scene.add.text(
        this.panelX + this.panelW - 30, this.contentAreaY + this.contentAreaH - 14,
        '\u25BC scroll', {
          fontSize: '12px', color: '#666666', fontFamily: 'monospace',
        }
      ).setOrigin(1, 0.5);
      scrollHint.setMask(this.contentMask);
      contentContainer.add(scrollHint);
    }
  }

  private renderIllustration(container: Phaser.GameObjects.Container, illus: TutorialIllustration, startY: number, _textX: number): void {
    const y = startY + illus.y;
    const centerX = this.panelX + this.panelW / 2;

    switch (illus.type) {
      case 'arrow_sequence': {
        const data = illus.data as {
          label: string;
          isUpgrade?: boolean;
          items: { sprite: string; caption: string; tint?: number; scale?: number; captionColor?: string }[];
        };

        // Label
        const labelTxt = this.scene.add.text(this.panelX + 24, y, data.label, {
          fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
        });
        container.add(labelTxt);

        const count = data.items.length;
        const spacing = Math.min(90, (this.panelW - 60) / count);
        const totalW = (count - 1) * spacing;
        const baseX = centerX - totalW / 2;

        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const ix = baseX + i * spacing;
          const iy = y + 22;

          // Background card
          const cardG = this.scene.add.graphics();
          cardG.fillStyle(0x222244, 0.8);
          cardG.fillRoundedRect(ix - 32, iy - 4, 64, 70, 4);
          cardG.lineStyle(1, data.isUpgrade ? 0x6666aa : 0x444466, 0.6);
          cardG.strokeRoundedRect(ix - 32, iy - 4, 64, 70, 4);
          container.add(cardG);

          // Sprite
          const texKey = this.scene.textures.exists(item.sprite) ? item.sprite : 'tower_arrow';
          const sprite = this.scene.add.sprite(ix, iy + 18, texKey)
            .setScale(item.scale ?? 1);
          if (item.tint) sprite.setTint(item.tint);
          container.add(sprite);

          // Caption
          const capColor = item.captionColor ?? '#cccccc';
          const cap = this.scene.add.text(ix, iy + 42, item.caption, {
            fontSize: '8px', color: capColor, fontFamily: 'monospace',
            align: 'center',
          }).setOrigin(0.5, 0);
          container.add(cap);

          // Arrow between items
          if (i < data.items.length - 1) {
            const arrowX = ix + spacing / 2;
            const arrowColor = data.isUpgrade ? '#ffcc00' : '#888888';
            const arrowTxt = this.scene.add.text(arrowX, iy + 16, data.isUpgrade ? '→' : '·', {
              fontSize: data.isUpgrade ? '18px' : '14px',
              color: arrowColor, fontFamily: 'monospace',
            }).setOrigin(0.5);
            container.add(arrowTxt);
          }
        }
        break;
      }

      case 'room_icons': {
        const data = illus.data as {
          rooms: { icon: string; color: number; name: string; desc: string }[];
        };

        const roomH = 46;
        for (let i = 0; i < data.rooms.length; i++) {
          const room = data.rooms[i];
          const ry = y + i * roomH;
          const rx = this.panelX + 24;
          const rw = this.panelW - 48;

          // Room card background
          const cardG = this.scene.add.graphics();
          cardG.fillStyle(room.color, 0.6);
          cardG.fillRoundedRect(rx, ry, rw, roomH - 4, 6);
          cardG.lineStyle(1, 0x555577, 0.5);
          cardG.strokeRoundedRect(rx, ry, rw, roomH - 4, 6);
          container.add(cardG);

          // Icon (large emoji)
          const iconTxt = this.scene.add.text(rx + 22, ry + (roomH - 4) / 2, room.icon, {
            fontSize: '22px', fontFamily: 'monospace',
          }).setOrigin(0.5);
          container.add(iconTxt);

          // Room name
          const nameTxt = this.scene.add.text(rx + 48, ry + 6, room.name, {
            fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
            fontStyle: 'bold',
          });
          container.add(nameTxt);

          // Description
          const descTxt = this.scene.add.text(rx + 48, ry + 20, room.desc, {
            fontSize: '9px', color: '#bbbbbb', fontFamily: 'monospace',
          });
          container.add(descTxt);

          // Decorative room shape on right side
          const shapeG = this.scene.add.graphics();
          const shapeX = rx + rw - 35;
          const shapeY = ry + (roomH - 4) / 2;
          shapeG.lineStyle(1.5, 0xffffff, 0.2);
          // Draw a small room icon (square with door)
          shapeG.strokeRect(shapeX - 10, shapeY - 10, 20, 20);
          shapeG.fillStyle(0x000000, 0.3);
          shapeG.fillRect(shapeX - 2, shapeY + 4, 4, 6);
          container.add(shapeG);
        }
        break;
      }

      case 'range_demo': {
        const data = illus.data as {
          items: { sprite: string; label: string; target: string; color: number }[];
        };

        const count = data.items.length;
        const spacing = Math.min(100, (this.panelW - 60) / count);
        const totalW = (count - 1) * spacing;
        const baseX = centerX - totalW / 2;

        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const ix = baseX + i * spacing;
          const iy = y + 10;

          // Range circle (small)
          const rangeG = this.scene.add.graphics();
          rangeG.lineStyle(1.5, item.color, 0.5);
          rangeG.fillStyle(item.color, 0.08);
          rangeG.fillCircle(ix, iy + 16, 28);
          rangeG.strokeCircle(ix, iy + 16, 28);
          container.add(rangeG);

          // Tower sprite
          const texKey = this.scene.textures.exists(item.sprite) ? item.sprite : 'tower_arrow';
          const sprite = this.scene.add.sprite(ix, iy + 16, texKey).setScale(0.9);
          container.add(sprite);

          // Label
          const lbl = this.scene.add.text(ix, iy + 42, item.label, {
            fontSize: '8px', color: '#cccccc', fontFamily: 'monospace',
          }).setOrigin(0.5, 0);
          container.add(lbl);

          // Target type indicator
          const targetLabel = item.target === 'ground' ? '🦶 Tierra' :
                              item.target === 'air' ? '🦅 Aéreo' : '⚡ Ambos';
          const targetColor = item.target === 'ground' ? '#88cc44' :
                              item.target === 'air' ? '#44ccff' : '#cc88ff';
          const targetTxt = this.scene.add.text(ix, iy + 52, targetLabel, {
            fontSize: '7px', color: targetColor, fontFamily: 'monospace',
          }).setOrigin(0.5, 0);
          container.add(targetTxt);
        }
        break;
      }
    }
  }

  private updateContentScroll(): void {
    for (const cont of this.sectionContents) {
      cont.setY(-this.scrollOffset);
    }
  }

  private closeSection(index: number): void {
    this.clearContent();
    if (this.sectionTitles[index]) {
      this.sectionTitles[index].setColor('#cccccc');
    }
  }

  private clearContent(): void {
    for (const cont of this.sectionContents) {
      cont.destroy();
    }
    this.sectionContents = [];
    this.scrollOffset = 0;
    this.maxScroll = 0;
    if (this.contentMask) {
      this.contentMask.destroy();
      this.contentMask = null;
    }
  }

  private close(): void {
    this.clearContent();
    this.container.destroy();
    this.onClose();
  }
}

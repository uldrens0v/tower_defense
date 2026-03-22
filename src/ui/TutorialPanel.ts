import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

interface TutorialSection {
  title: string;
  lines: string[];
}

const SECTIONS: TutorialSection[] = [
  {
    title: 'Como jugar',
    lines: [
      '--- OBJETIVO ---',
      'Defiende la muralla de las oleadas de enemigos.',
      'Si la vida de la muralla llega a 0, pierdes.',
      'Coloca defensas y tropas para detenerlos.',
      '',
      '--- COLOCAR DEFENSAS ---',
      'Selecciona una torre en la barra inferior y',
      'haz clic en una casilla edificable (verde) para',
      'colocarla. Necesitas oro suficiente.',
      '',
      '--- COLOCAR TROPAS ---',
      'Pulsa "Tropas" en la barra inferior para ver',
      'tus personajes. Selecciona uno y colócalo en',
      'el mapa. Puedes ponerlo sobre una torre.',
      '',
      '--- TERRESTRE vs AEREO ---',
      'Los enemigos pueden ser terrestres o aereos.',
      'Torre de Flechas y Canon solo atacan terrestres.',
      'Balista Aerea solo ataca aereos.',
      'Torre Arcana ataca ambos pero con penalizacion.',
      'Las tropas atacan segun su tipo.',
      '',
      '--- RANGOS ---',
      'Cada torre/tropa tiene un rango de ataque.',
      'Pulsa "Rangos" en la barra inferior para ver',
      'todos los rangos a la vez. Tambien puedes pasar',
      'el cursor sobre una unidad para ver su rango.',
      '',
      '--- VELOCIDAD ---',
      'Pulsa ">>> x1" para acelerar el juego a x3.',
      'Pulsa de nuevo para volver a velocidad normal.',
      '',
      '--- RONDAS ---',
      'Pasa el cursor sobre "Ronda N" en la esquina',
      'superior izquierda para ver los enemigos de',
      'la ronda actual con sus cantidades en tiempo real.',
    ],
  },
  {
    title: 'Calabozo',
    lines: [
      '--- ACCESO ---',
      'Pulsa ESC (o el boton menu) y selecciona',
      '"Entrar al Calabozo" entre rondas.',
      '',
      '--- NAVEGACION ---',
      'El calabozo es un mapa con varias habitaciones',
      'conectadas. Haz clic en una habitacion adyacente',
      'a la actual para moverte a ella.',
      '',
      '--- TIPOS DE HABITACION ---',
      '',
      'Descanso (primera sala):',
      '  Punto de inicio seguro.',
      '',
      'Combate:',
      '  Enfrentamiento contra enemigos del calabozo.',
      '  Ganar otorga recompensas de oro y experiencia.',
      '',
      'Cofre:',
      '  Resuelve un desafio matematico para abrir',
      '  el cofre. Si aciertas, obtienes recompensas',
      '  como oro, cristales, equipo o nuevos personajes.',
      '  Si fallas, el cofre se cierra.',
      '',
      'Elite:',
      '  Enemigos mas fuertes con mejores recompensas.',
      '',
      'Jefe (ultima sala):',
      '  Desafio de escritura rapida. Escribe la frase',
      '  antes de que se acabe el tiempo para ganar',
      '  grandes recompensas.',
    ],
  },
  {
    title: 'Mejorar torres',
    lines: [
      '--- ACCESO ---',
      'Pulsa ESC (o el boton menu) y selecciona',
      '"Mejorar Torres" entre rondas.',
      '',
      '--- REQUISITO ---',
      'Solo puedes acceder si tienes al menos una',
      'torre colocada en el mapa. Si solo tienes',
      'tropas o no tienes nada colocado, esta opcion',
      'no estara disponible.',
      '',
      '--- FUNCIONAMIENTO ---',
      'Gasta cristales para subir el nivel de un tipo',
      'de torre. La mejora se aplica a TODAS las torres',
      'de ese tipo que tengas colocadas y a las que',
      'coloques en el futuro.',
      '',
      'Cada nivel aumenta el dano y las estadisticas',
      'de la torre. El coste en cristales sube con',
      'cada nivel.',
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
      'Pulsa ESC (o el boton menu) y selecciona',
      '"Coleccion" entre rondas.',
      '',
      '--- CONTENIDO ---',
      'Aqui puedes ver todos los tipos de tropa',
      'disponibles en el juego.',
      '',
      'Haz clic en cualquier personaje para ver',
      'sus estadisticas detalladas: vida, dano,',
      'defensa, velocidad de ataque, rango y',
      'velocidad de movimiento.',
      '',
      'Tambien muestra sus habilidades pasivas',
      'y su sprite a tamaño ampliado.',
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
  private readonly startBtnTotalH = 46; // button height + padding

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
        // Close current section
        this.closeSection(index);
        this.openSection = -1;
        txt.setColor('#cccccc');
        arrow.setText('\u25B6');
        arrow.setColor('#aaaaaa');
        headerBg.clear();
        headerBg.fillStyle(0x333355, 0.9);
        headerBg.fillRect(this.panelX + 10, y + 2, this.panelW - 20, this.sectionHeaderH - 4);
      } else {
        // Close previous section if open
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
        // Open new section
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

    for (let i = 0; i < section.lines.length; i++) {
      const line = section.lines[i];
      const isHeader = line.startsWith('---') && line.endsWith('---');

      const txt = this.scene.add.text(textX, startY + i * lineH, line, {
        fontSize: isHeader ? '12px' : '11px',
        color: isHeader ? '#ffcc00' : '#bbbbbb',
        fontFamily: 'monospace',
        fontStyle: isHeader ? 'bold' : 'normal',
      });
      contentContainer.add(txt);
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

  private updateContentScroll(): void {
    for (const cont of this.sectionContents) {
      cont.setY(-this.scrollOffset);
    }
  }

  private closeSection(index: number): void {
    // Reset arrow for the closed section - arrows are part of main container
    // They get recreated anyway, just clear content
    this.clearContent();
    // Reset title color
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

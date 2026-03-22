import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

// ── Random phrases for boss typing challenge ──
const PHRASES: string[] = [
  'En un lugar de la Mancha',
  'Caminante no hay camino',
  'La vida es sueno',
  'Poderoso caballero',
  'Verde que te quiero verde',
  'Ladran luego cabalgamos',
  'Mas vale mana que fuerza',
  'Cada uno es hijo de sus obras',
  'El valor esta en el corazon',
  'Quien busca el peligro perece',
];

// ── Detect touch device ──
function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ── Math Expression Generator ──
const R = () => Math.random();
const RI = (min: number, max: number) => Math.floor(R() * (max - min + 1)) + min;

function buildExpr(depth: number, difficulty: number): [string, number] {
  if (depth <= 0 || (depth === 1 && R() < 0.5)) {
    const maxN = Math.min(8 + difficulty * 4, 50);
    const n = RI(2, maxN);
    return [String(n), n];
  }

  if (difficulty >= 3 && R() < 0.25) {
    const base = RI(2, Math.min(5 + difficulty, 12));
    const exp = RI(2, 3);
    const val = Math.pow(base, exp);
    return [`${base}^${exp}`, val];
  }

  const ops = ['+', '-', '*'];
  if (R() < 0.3) ops.push('/');

  const op = ops[RI(0, ops.length - 1)];
  const [lExpr, lVal] = buildExpr(depth - 1, difficulty);
  let [rExpr, rVal] = buildExpr(depth - 1, difficulty);

  if (op === '/') {
    if (lVal === 0 || rVal === 0) return [lExpr, lVal];
    const divisors: number[] = [];
    const absL = Math.abs(lVal);
    for (let d = 2; d <= Math.min(absL, 20); d++) {
      if (absL % d === 0) divisors.push(d);
    }
    if (divisors.length === 0) return [lExpr, lVal];
    rVal = divisors[RI(0, divisors.length - 1)];
    rExpr = String(rVal);
  }

  let val: number;
  switch (op) {
    case '+': val = lVal + rVal; break;
    case '-': val = lVal - rVal; break;
    case '*': val = lVal * rVal; break;
    case '/': val = lVal / rVal; break;
    default: val = lVal + rVal;
  }

  const useParens = depth > 1 && R() < 0.4;
  const expr = useParens
    ? `(${lExpr} ${op} ${rExpr})`
    : `${lExpr} ${op} ${rExpr}`;

  return [expr, val];
}

function generateMathChallenge(difficulty: number): { expression: string; answer: number } {
  const depth = Math.min(2 + Math.floor(difficulty / 2), 5);

  for (let attempt = 0; attempt < 100; attempt++) {
    const [expr, val] = buildExpr(depth, difficulty);
    if (Number.isFinite(val) && Number.isInteger(val) && Math.abs(val) <= 5000 && expr.length >= 5) {
      return { expression: expr, answer: val };
    }
  }

  const a = RI(10, 30);
  const b = RI(2, 8);
  const c = RI(3, 12);
  return { expression: `${a} * ${b} - ${c}`, answer: a * b - c };
}

// ── Helper: create a virtual button ──
function addVirtualKey(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number, y: number, w: number, h: number,
  label: string, onPress: () => void,
  color = 0x333355, textColor = '#ffffff', fontSize = '14px',
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(color, 0.9);
  bg.fillRect(x, y, w, h);
  bg.lineStyle(1, 0x555577);
  bg.strokeRect(x, y, w, h);
  container.add(bg);

  const txt = scene.add.text(x + w / 2, y + h / 2, label, {
    fontSize, color: textColor, fontFamily: 'monospace',
  }).setOrigin(0.5);
  container.add(txt);

  const hit = scene.add.rectangle(x + w / 2, y + h / 2, w, h).setInteractive().setAlpha(0.01);
  hit.on('pointerdown', () => {
    bg.clear();
    bg.fillStyle(0x5555aa, 1);
    bg.fillRect(x, y, w, h);
    bg.lineStyle(1, 0x8888cc);
    bg.strokeRect(x, y, w, h);
    onPress();
  });
  hit.on('pointerup', () => {
    bg.clear();
    bg.fillStyle(color, 0.9);
    bg.fillRect(x, y, w, h);
    bg.lineStyle(1, 0x555577);
    bg.strokeRect(x, y, w, h);
  });
  hit.on('pointerout', () => {
    bg.clear();
    bg.fillStyle(color, 0.9);
    bg.fillRect(x, y, w, h);
    bg.lineStyle(1, 0x555577);
    bg.strokeRect(x, y, w, h);
  });
  container.add(hit);
}

// ══════════════════════════════════════════
// MATH CHALLENGE (Chest rooms)
// ══════════════════════════════════════════
export class MathChallenge {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private inputText = '';
  private inputDisplay!: Phaser.GameObjects.Text;
  private onComplete: (success: boolean, challenge: MathChallenge) => void;
  private answer: number;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(scene: Phaser.Scene, difficulty: number, onComplete: (success: boolean, challenge: MathChallenge) => void) {
    this.scene = scene;
    this.onComplete = onComplete;
    this.container = scene.add.container(0, 0).setDepth(400);

    const { expression, answer } = generateMathChallenge(difficulty);
    this.answer = answer;

    const touch = isTouchDevice();
    const panelW = 500;
    const panelH = touch ? 340 : 280;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2;

    // Overlay
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Panel
    const panel = scene.add.graphics();
    panel.fillStyle(0x1a1a3a, 0.98);
    panel.fillRect(px, py, panelW, panelH);
    panel.lineStyle(2, 0xffcc00);
    panel.strokeRect(px, py, panelW, panelH);
    this.container.add(panel);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, py + 12, '📦 Desafio del Cofre', {
      fontSize: '16px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Instructions
    const inst = scene.add.text(GAME_WIDTH / 2, py + 34, 'Resuelve la operacion para abrir el cofre:', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(inst);

    // Expression
    const exprText = scene.add.text(GAME_WIDTH / 2, py + 54, expression, {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(exprText);

    // Input box
    const inputBg = scene.add.graphics();
    inputBg.fillStyle(0x222244, 1);
    inputBg.fillRect(px + 100, py + 95, panelW - 200, 35);
    inputBg.lineStyle(2, 0x6666aa);
    inputBg.strokeRect(px + 100, py + 95, panelW - 200, 35);
    this.container.add(inputBg);

    this.inputDisplay = scene.add.text(GAME_WIDTH / 2, py + 112, '|', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(this.inputDisplay);

    // Warning
    const warning = scene.add.text(GAME_WIDTH / 2, py + 136, 'Respuesta incorrecta = -10 HP Muralla', {
      fontSize: '9px', color: '#ff6644', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(warning);

    if (touch) {
      // Virtual numpad
      const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '.'];
      const kw = 38, kh = 30, gap = 4;
      const gridW = 4 * kw + 3 * gap;
      const kx0 = GAME_WIDTH / 2 - gridW / 2;
      const ky0 = py + 155;

      numKeys.forEach((key, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        addVirtualKey(scene, this.container,
          kx0 + col * (kw + gap), ky0 + row * (kh + gap), kw, kh,
          key, () => this.onVirtualKey(key), 0x333355, '#ffffff', '14px');
      });

      // Backspace and Enter buttons
      const actionY = ky0 + 3 * (kh + gap);
      addVirtualKey(scene, this.container,
        kx0, actionY, (gridW - gap) / 2, kh,
        '⌫', () => this.onVirtualKey('Backspace'), 0x553333, '#ff8888', '14px');
      addVirtualKey(scene, this.container,
        kx0 + (gridW + gap) / 2, actionY, (gridW - gap) / 2, kh,
        'OK ✓', () => this.onVirtualKey('Enter'), 0x335533, '#88ff88', '14px');
    } else {
      const hint = scene.add.text(GAME_WIDTH / 2, py + 155, 'Escribe el resultado y pulsa ENTER', {
        fontSize: '10px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      this.container.add(hint);
    }

    // Keyboard input (works on both, but essential for desktop)
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.submit();
      } else if (event.key === 'Backspace') {
        this.inputText = this.inputText.slice(0, -1);
        this.updateDisplay();
      } else if (event.key === 'Escape') {
        this.removeKeyHandler();
        this.destroy();
        this.onComplete(false, this);
      } else if (/^[0-9\-.]$/.test(event.key) && this.inputText.length < 10) {
        this.inputText += event.key;
        this.updateDisplay();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private onVirtualKey(key: string): void {
    if (key === 'Enter') {
      this.submit();
    } else if (key === 'Backspace') {
      this.inputText = this.inputText.slice(0, -1);
      this.updateDisplay();
    } else if (this.inputText.length < 10) {
      this.inputText += key;
      this.updateDisplay();
    }
  }

  private updateDisplay(): void {
    this.inputDisplay.setText(this.inputText.length > 0 ? this.inputText + '|' : '|');
  }

  private submit(): void {
    const userAnswer = parseFloat(this.inputText);
    const success = !isNaN(userAnswer) && Math.abs(userAnswer - this.answer) < 0.01;

    this.removeKeyHandler();

    this.container.removeAll(true);

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    const flash = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
      success ? '¡Correcto!' : `Incorrecto (era ${this.answer})`, {
        fontSize: '16px', color: success ? '#44ff44' : '#ff4444', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(401);
    this.container.add(flash);

    this.scene.time.delayedCall(800, () => {
      this.onComplete(success, this);
    });
  }

  showResult(title: string, lines: string[], autoCloseMs = 2000): void {
    this.container.removeAll(true);

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    const text = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${title}\n\n${lines.join('\n')}`, {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 25, y: 18 },
      align: 'center',
    }).setOrigin(0.5).setDepth(401);
    this.container.add(text);

    this.scene.time.delayedCall(autoCloseMs, () => this.destroy());
  }

  private removeKeyHandler(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  destroy(): void {
    this.removeKeyHandler();
    this.container.destroy();
  }
}

// ══════════════════════════════════════════
// TYPING CHALLENGE (Boss rooms)
// ══════════════════════════════════════════
export class TypingChallenge {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private targetPhrase: string;
  private typedText = '';
  private charTexts: Phaser.GameObjects.Text[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft: number;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private onComplete: (success: boolean, challenge: TypingChallenge) => void;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private finished = false;

  constructor(scene: Phaser.Scene, onComplete: (success: boolean, challenge: TypingChallenge) => void) {
    this.scene = scene;
    this.onComplete = onComplete;
    this.container = scene.add.container(0, 0).setDepth(400);

    const touch = isTouchDevice();
    // Shorter phrases for touch, more time
    this.targetPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    this.timeLeft = touch ? 20 : 10;

    // Overlay
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Panel
    const panelW = touch ? 980 : 900;
    const panelH = touch ? 530 : 300;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x1a1a3a, 0.98);
    panel.fillRect(px, py, panelW, panelH);
    panel.lineStyle(2, 0xff4444);
    panel.strokeRect(px, py, panelW, panelH);
    this.container.add(panel);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, py + 8, '👹 Combate contra el Jefe', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Timer
    this.timerText = scene.add.text(GAME_WIDTH / 2, py + 30, `${this.timeLeft.toFixed(1)}s`, {
      fontSize: '20px', color: '#ff8844', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(this.timerText);

    // Target phrase
    const phraseY = py + 60;
    const fontSize = touch ? 14 : 16;
    const charWidth = touch ? 8.4 : 9.6;
    const totalWidth = this.targetPhrase.length * charWidth;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;

    const phraseBg = scene.add.graphics();
    phraseBg.fillStyle(0x111122, 0.9);
    phraseBg.fillRect(px + 10, phraseY - 5, panelW - 20, 26);
    this.container.add(phraseBg);

    for (let i = 0; i < this.targetPhrase.length; i++) {
      const charText = scene.add.text(startX + i * charWidth, phraseY, this.targetPhrase[i], {
        fontSize: `${fontSize}px`, color: '#666666', fontFamily: 'monospace',
      });
      this.container.add(charText);
      this.charTexts.push(charText);
    }

    if (touch) {
      // Virtual QWERTY keyboard
      const rows = [
        'qwertyuiop',
        'asdfghjkl',
        'zxcvbnm',
      ];
      const kw = 30, kh = 28, gap = 3;
      const kbY = py + 100;

      rows.forEach((row, ri) => {
        const rowW = row.length * (kw + gap) - gap;
        const rx = GAME_WIDTH / 2 - rowW / 2;
        const ry = kbY + ri * (kh + gap);
        for (let ci = 0; ci < row.length; ci++) {
          const ch = row[ci];
          addVirtualKey(scene, this.container,
            rx + ci * (kw + gap), ry, kw, kh,
            ch, () => this.onVirtualKey(ch), 0x333355, '#ffffff', '12px');
        }
      });

      // Space, backspace row
      const lastRowY = kbY + 3 * (kh + gap);
      const spaceW = 200;
      addVirtualKey(scene, this.container,
        GAME_WIDTH / 2 - spaceW / 2, lastRowY, spaceW, kh,
        'espacio', () => this.onVirtualKey(' '), 0x444466, '#aaaaaa', '11px');

      addVirtualKey(scene, this.container,
        GAME_WIDTH / 2 + spaceW / 2 + gap + 5, lastRowY, 80, kh,
        '⌫', () => this.onVirtualKey('Backspace'), 0x553333, '#ff8888', '13px');

      // Special chars row (accents, punctuation)
      const specialY = lastRowY + kh + gap;
      const specials = ['á', 'é', 'í', 'ó', 'ú', 'ñ', ',', '.'];
      const specW = specials.length * (kw + gap) - gap;
      const specX = GAME_WIDTH / 2 - specW / 2;
      specials.forEach((ch, i) => {
        addVirtualKey(scene, this.container,
          specX + i * (kw + gap), specialY, kw, kh,
          ch, () => this.onVirtualKey(ch), 0x335544, '#ccffcc', '12px');
      });
    } else {
      const hint = scene.add.text(GAME_WIDTH / 2, py + panelH - 25, 'Escribe el texto exacto. Cada letra correcta cambia de color.', {
        fontSize: '9px', color: '#555555', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      this.container.add(hint);
    }

    // Timer countdown
    this.timerEvent = scene.time.addEvent({
      delay: 100,
      callback: () => {
        this.timeLeft -= 0.1;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.finish(false);
        }
        this.timerText.setText(`${this.timeLeft.toFixed(1)}s`);
        if (this.timeLeft <= 3) {
          this.timerText.setColor('#ff2222');
        } else if (this.timeLeft <= 6) {
          this.timerText.setColor('#ff8844');
        }
      },
      loop: true,
    });

    // Keyboard input (desktop)
    this.keyHandler = (event: KeyboardEvent) => {
      if (this.finished) return;

      if (event.key === 'Backspace') {
        if (this.typedText.length > 0) {
          const idx = this.typedText.length - 1;
          if (idx < this.charTexts.length) {
            this.charTexts[idx].setColor('#666666');
          }
          this.typedText = this.typedText.slice(0, -1);
        }
      } else if (event.key === 'Escape') {
        this.finish(false);
      } else if (event.key.length === 1) {
        this.typedText += event.key;
        this.updateCharColors();

        if (this.typedText.length >= this.targetPhrase.length) {
          const success = this.typedText === this.targetPhrase;
          this.finish(success);
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private onVirtualKey(key: string): void {
    if (this.finished) return;

    if (key === 'Backspace') {
      if (this.typedText.length > 0) {
        const idx = this.typedText.length - 1;
        if (idx < this.charTexts.length) {
          this.charTexts[idx].setColor('#666666');
        }
        this.typedText = this.typedText.slice(0, -1);
      }
    } else {
      this.typedText += key;
      this.updateCharColors();

      if (this.typedText.length >= this.targetPhrase.length) {
        const success = this.typedText === this.targetPhrase;
        this.finish(success);
      }
    }
  }

  private updateCharColors(): void {
    for (let i = 0; i < this.charTexts.length; i++) {
      if (i < this.typedText.length) {
        if (this.typedText[i] === this.targetPhrase[i]) {
          this.charTexts[i].setColor('#44ff44');
        } else {
          this.charTexts[i].setColor('#ff4444');
        }
      } else {
        this.charTexts[i].setColor('#666666');
      }
    }
  }

  private finish(success: boolean): void {
    if (this.finished) return;
    this.finished = true;

    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }

    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    this.container.removeAll(true);

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    const flash = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
      success ? '¡Jefe derrotado!' : 'No pudiste vencer al jefe...', {
        fontSize: '18px', color: success ? '#44ff44' : '#ff4444', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(401);
    this.container.add(flash);

    this.scene.time.delayedCall(800, () => {
      this.onComplete(success, this);
    });
  }

  showResult(title: string, lines: string[], autoCloseMs = 2000): void {
    this.container.removeAll(true);

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    const text = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${title}\n\n${lines.join('\n')}`, {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 25, y: 18 },
      align: 'center',
    }).setOrigin(0.5).setDepth(401);
    this.container.add(text);

    this.scene.time.delayedCall(autoCloseMs, () => this.destroy());
  }

  destroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }
    this.container.destroy();
  }
}

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

// ── Random phrases for boss typing challenge ──
const PHRASES: string[] = [
  'En un lugar de la Mancha de cuyo nombre no quiero acordarme',
  'Caminante no hay camino se hace camino al andar',
  'La vida es sueno y los suenos suenos son',
  'Poderoso caballero es don dinero',
  'Yo soy yo y mi circunstancia',
  'Verde que te quiero verde',
  'Puedo escribir los versos mas tristes esta noche',
  'Con diez canones por banda viento en popa a toda vela',
  'Volveran las oscuras golondrinas en tu balcon sus nidos a colgar',
  'Nuestras vidas son los rios que van a dar en la mar',
  'Todo lo que se ignora se desprecia',
  'La pluma es la lengua del alma',
  'El que lee mucho y anda mucho ve mucho y sabe mucho',
  'Ladran luego cabalgamos',
  'Mas vale maña que fuerza',
  'No hay libro tan malo que no tenga algo bueno',
  'La libertad es uno de los mas preciosos dones',
  'El valor esta en el corazon no en las manos',
  'Quien busca el peligro perece en el',
  'Cada uno es hijo de sus obras',
];

// ── Math Expression Generator (hard!) ──
const R = () => Math.random();
const RI = (min: number, max: number) => Math.floor(R() * (max - min + 1)) + min;

/** Build a random sub-expression string and return [expr, value] */
function buildExpr(depth: number, difficulty: number): [string, number] {
  // Base case: a number
  if (depth <= 0 || (depth === 1 && R() < 0.5)) {
    const maxN = Math.min(8 + difficulty * 4, 50);
    const n = RI(2, maxN);
    return [String(n), n];
  }

  // Possibly generate a power expression (a^b)
  if (difficulty >= 3 && R() < 0.25) {
    const base = RI(2, Math.min(5 + difficulty, 12));
    const exp = RI(2, 3);
    const val = Math.pow(base, exp);
    return [`${base}^${exp}`, val];
  }

  // Binary operation
  const ops = ['+', '-', '*'];
  // Add division only if we can keep it clean
  if (R() < 0.3) ops.push('/');

  const op = ops[RI(0, ops.length - 1)];

  // Build left and right
  const [lExpr, lVal] = buildExpr(depth - 1, difficulty);
  let [rExpr, rVal] = buildExpr(depth - 1, difficulty);

  // For division, ensure clean integer result
  if (op === '/') {
    // Pick a divisor that divides evenly
    if (lVal === 0 || rVal === 0) return [lExpr, lVal]; // abort
    const divisors: number[] = [];
    const absL = Math.abs(lVal);
    for (let d = 2; d <= Math.min(absL, 20); d++) {
      if (absL % d === 0) divisors.push(d);
    }
    if (divisors.length === 0) return [lExpr, lVal]; // can't divide cleanly
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

  // Wrap in parentheses sometimes to force different evaluation order
  const useParens = depth > 1 && R() < 0.4;
  const expr = useParens
    ? `(${lExpr} ${op} ${rExpr})`
    : `${lExpr} ${op} ${rExpr}`;

  return [expr, val];
}

function generateMathChallenge(difficulty: number): { expression: string; answer: number } {
  // depth scales: wave 1-2 → depth 2, wave 3-4 → depth 3, wave 5+ → depth 4
  const depth = Math.min(2 + Math.floor(difficulty / 2), 5);

  for (let attempt = 0; attempt < 100; attempt++) {
    const [expr, val] = buildExpr(depth, difficulty);

    // Accept only clean integers in a reasonable range
    if (Number.isFinite(val) && Number.isInteger(val) && Math.abs(val) <= 5000 && expr.length >= 5) {
      // Replace ^ with display-friendly version (keep ^ for display, user calculates)
      return { expression: expr, answer: val };
    }
  }

  // Fallback: still hard
  const a = RI(10, 30);
  const b = RI(2, 8);
  const c = RI(3, 12);
  return { expression: `${a} * ${b} - ${c}`, answer: a * b - c };
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

    // Overlay
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Panel
    const panelW = 500;
    const panelH = 280;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x1a1a3a, 0.98);
    panel.fillRect(px, py, panelW, panelH);
    panel.lineStyle(2, 0xffcc00);
    panel.strokeRect(px, py, panelW, panelH);
    this.container.add(panel);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, py + 20, '📦 Desafio del Cofre', {
      fontSize: '18px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Instructions
    const inst = scene.add.text(GAME_WIDTH / 2, py + 50, 'Resuelve la operacion para abrir el cofre:', {
      fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(inst);

    // Expression
    const exprText = scene.add.text(GAME_WIDTH / 2, py + 85, expression, {
      fontSize: '28px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(exprText);

    // Input box bg
    const inputBg = scene.add.graphics();
    inputBg.fillStyle(0x222244, 1);
    inputBg.fillRect(px + 100, py + 140, panelW - 200, 40);
    inputBg.lineStyle(2, 0x6666aa);
    inputBg.strokeRect(px + 100, py + 140, panelW - 200, 40);
    this.container.add(inputBg);

    // Input text display
    this.inputDisplay = scene.add.text(GAME_WIDTH / 2, py + 160, '|', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(this.inputDisplay);

    // Warning
    const warning = scene.add.text(GAME_WIDTH / 2, py + 200, 'Respuesta incorrecta = -10 HP Muralla', {
      fontSize: '10px', color: '#ff6644', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(warning);

    // Hint
    const hint = scene.add.text(GAME_WIDTH / 2, py + 225, 'Escribe el resultado y pulsa ENTER', {
      fontSize: '10px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(hint);

    // Keyboard input
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

  private updateDisplay(): void {
    this.inputDisplay.setText(this.inputText.length > 0 ? this.inputText + '|' : '|');
  }

  private submit(): void {
    const userAnswer = parseFloat(this.inputText);
    const success = !isNaN(userAnswer) && Math.abs(userAnswer - this.answer) < 0.01;

    // Remove key handler immediately to prevent double submit
    this.removeKeyHandler();

    // Replace challenge content with result — callback will show reward in-place
    this.container.removeAll(true);

    // Keep overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Brief correctness flash
    const flash = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
      success ? '¡Correcto!' : `Incorrecto (era ${this.answer})`, {
        fontSize: '16px', color: success ? '#44ff44' : '#ff4444', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(401);
    this.container.add(flash);

    this.scene.time.delayedCall(800, () => {
      this.onComplete(success, this);
    });
  }

  /** Show reward/result replacing the challenge panel content */
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
  private timeLeft = 10;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private onComplete: (success: boolean, challenge: TypingChallenge) => void;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private finished = false;

  constructor(scene: Phaser.Scene, onComplete: (success: boolean, challenge: TypingChallenge) => void) {
    this.scene = scene;
    this.onComplete = onComplete;
    this.container = scene.add.container(0, 0).setDepth(400);

    // Pick random phrase
    this.targetPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];

    // Overlay
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Panel
    const panelW = 900;
    const panelH = 300;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x1a1a3a, 0.98);
    panel.fillRect(px, py, panelW, panelH);
    panel.lineStyle(2, 0xff4444);
    panel.strokeRect(px, py, panelW, panelH);
    this.container.add(panel);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, py + 15, '👹 Combate contra el Jefe', {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Instructions
    const inst = scene.add.text(GAME_WIDTH / 2, py + 42, 'Escribe el texto antes de que se acabe el tiempo:', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(inst);

    // Timer
    this.timerText = scene.add.text(GAME_WIDTH / 2, py + 65, '10.0s', {
      fontSize: '24px', color: '#ff8844', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(this.timerText);

    // Target phrase - render each character individually for coloring
    const phraseY = py + 110;
    const fontSize = 16;
    const charWidth = 9.6; // approximate monospace char width at 16px
    const totalWidth = this.targetPhrase.length * charWidth;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;

    // Background for phrase area
    const phraseBg = scene.add.graphics();
    phraseBg.fillStyle(0x111122, 0.9);
    phraseBg.fillRect(px + 10, phraseY - 5, panelW - 20, 30);
    this.container.add(phraseBg);

    for (let i = 0; i < this.targetPhrase.length; i++) {
      const charText = scene.add.text(startX + i * charWidth, phraseY, this.targetPhrase[i], {
        fontSize: `${fontSize}px`, color: '#666666', fontFamily: 'monospace',
      });
      this.container.add(charText);
      this.charTexts.push(charText);
    }

    // Cursor/typed area label
    const typedLabel = scene.add.text(GAME_WIDTH / 2, phraseY + 45, 'Tu texto:', {
      fontSize: '10px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(typedLabel);

    // Typed text area bg
    const typedBg = scene.add.graphics();
    typedBg.fillStyle(0x222244, 0.8);
    typedBg.fillRect(px + 10, phraseY + 60, panelW - 20, 30);
    this.container.add(typedBg);

    // Hint
    const hint = scene.add.text(GAME_WIDTH / 2, py + panelH - 25, 'Escribe el texto exacto. Cada letra correcta cambia de color.', {
      fontSize: '9px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(hint);

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
        // Color based on time
        if (this.timeLeft <= 3) {
          this.timerText.setColor('#ff2222');
        } else if (this.timeLeft <= 6) {
          this.timerText.setColor('#ff8844');
        }
      },
      loop: true,
    });

    // Keyboard input
    this.keyHandler = (event: KeyboardEvent) => {
      if (this.finished) return;

      if (event.key === 'Backspace') {
        if (this.typedText.length > 0) {
          // Reset the color of the char we're removing
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

        // Check if complete
        if (this.typedText.length >= this.targetPhrase.length) {
          const success = this.typedText === this.targetPhrase;
          this.finish(success);
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private updateCharColors(): void {
    for (let i = 0; i < this.charTexts.length; i++) {
      if (i < this.typedText.length) {
        if (this.typedText[i] === this.targetPhrase[i]) {
          this.charTexts[i].setColor('#44ff44'); // Correct - green
        } else {
          this.charTexts[i].setColor('#ff4444'); // Wrong - red
        }
      } else {
        this.charTexts[i].setColor('#666666'); // Not typed yet
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

    // Replace challenge content with brief flash
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

  /** Show reward/result replacing the challenge panel content */
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

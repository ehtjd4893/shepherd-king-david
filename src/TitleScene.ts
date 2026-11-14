import Phaser from 'phaser';
import { frameOf, sheepFrame, bgField } from './art.ts';
import { loadSave, type Save } from './save.ts';
import { STAGES } from './stages.ts';

const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
let devJumped = false;

export class TitleScene extends Phaser.Scene {
  private T = 0;
  private david!: Phaser.GameObjects.Image;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private save: Save | null = null;
  private choice = 0; // 0 = continue, 1 = new game (only when there is a save)
  private options: Phaser.GameObjects.Text[] = [];

  constructor() { super('title'); }

  create() {
    // dev shortcut: ?stage=<id> or ?cut=<id> jumps straight in
    const q = new URLSearchParams(location.search);
    if (import.meta.env.DEV && !devJumped && (q.get('stage') || q.get('cut'))) {
      devJumped = true; // only on first load, so finishing the game still returns to the title
      if (q.get('stage')) this.scene.start('stage', { stage: q.get('stage') });
      else this.scene.start('cutscene', { id: q.get('cut') });
      return;
    }

    this.T = 0;
    this.save = loadSave();
    this.choice = 0;
    if (!this.textures.exists('bg_field480')) this.textures.addCanvas('bg_field480', bgField(480));
    this.add.image(0, 0, 'bg_field480').setOrigin(0);
    this.add.rectangle(0, 0, 480, 120, 0x1c1226, 0.25).setOrigin(0);
    const add = (key: string, s: { c: HTMLCanvasElement; ox: number; oy: number }) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, s.c);
      return this.add.image(0, 0, key).setOrigin(s.ox / s.c.width, s.oy / s.c.height);
    };
    for (const [x, y, f] of [[150, 214, 0], [176, 230, 1], [128, 236, 1]] as const) add(`title_sheep_${f}`, sheepFrame(f)).setPosition(x, y).setFlipX(true);
    this.david = add('title_david_0', frameOf('david', 'idle', 0)).setPosition(240, 228);

    this.add.text(240, 62, '목동왕 다윗', { fontFamily: FONT, fontSize: '44px', color: '#f2c14e', stroke: '#1c1226', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(240, 96, '양 치던 소년이 왕이 되기까지 · 사무엘상 8장 – 사무엘하 5장', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#1c1226', strokeThickness: 3 }).setOrigin(0.5);
    const touch = this.sys.game.device.input.touch, style = { fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#1c1226', strokeThickness: 3 };
    if (this.save) {
      // two choices; touch picks directly, keys move with ↑↓ and confirm with Z/Enter
      const name = STAGES[this.save.stage].title;
      this.options = [
        this.add.text(240, 134, `이어하기 · ${name}`, style).setOrigin(0.5),
        this.add.text(240, 156, '처음부터', style).setOrigin(0.5),
      ];
      this.options.forEach((o, i) => o.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.begin(i)));
      if (!touch) this.add.text(240, 176, '↑↓ 고르기 · Z 결정', { ...style, fontSize: '9px' }).setOrigin(0.5);
      this.highlight();
    } else {
      this.options = [];
      const press = this.add.text(240, 140, touch ? '화면을 눌러 시작' : 'Z 를 눌러 시작', style).setOrigin(0.5);
      this.tweens.add({ targets: press, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
      this.input.once('pointerdown', () => this.begin(1));
    }
    this.keys = this.input.keyboard!.addKeys('Z,X,J,K,ENTER,SPACE,UP,DOWN,W,S') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private highlight() {
    this.options.forEach((o, i) => o.setColor(i === this.choice ? '#ffe27a' : '#ffffff').setText((i === this.choice ? '▶ ' : '') + o.text.replace(/^▶ /, '')));
  }

  /** 0 = continue from the saved stage, 1 = start the story from the prologue. */
  private begin(which: number) {
    if (which === 0 && this.save) {
      this.registry.set('score', this.save.score);
      this.scene.start('stage', { stage: this.save.stage });
    } else {
      this.registry.set('score', 0);
      this.scene.start('cutscene', { id: 'prologue' });
    }
  }

  update(_: number, dms: number) {
    const k = this.keys;
    if (!k) return;
    this.T += dms / 1000;
    const key = `title_david_${Math.floor(this.T * 2.5) % 2}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, frameOf('david', 'idle', Math.floor(this.T * 2.5) % 2).c);
    this.david.setTexture(key);
    const J = Phaser.Input.Keyboard.JustDown;
    if (this.options.length && (J(k.UP) || J(k.DOWN) || J(k.W) || J(k.S))) { this.choice = 1 - this.choice; this.highlight(); }
    if ([k.Z, k.X, k.J, k.K, k.ENTER, k.SPACE].some(x => J(x))) this.begin(this.options.length ? this.choice : 1);
  }
}

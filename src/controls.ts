import Phaser from 'phaser';
import { isDoubleTap } from './combat.ts';

const BTN = {
  attack: { x: 436, y: 226, r: 20, label: '공격', gold: true },
  jump: { x: 392, y: 249, r: 14, label: '점프', gold: false },
  sling: { x: 394, y: 203, r: 14, label: '물매', gold: false },
  special: { x: 446, y: 180, r: 14, label: '믿음', gold: true },
  spin: { x: 350, y: 244, r: 14, label: '회전', gold: false },
} as const;
type BtnName = keyof typeof BTN;

/**
 * Keyboard, touch and gamepad folded into one input state, read once per frame.
 * Keys: arrows/WASD move (double-tap ←/→ to run), Z/J attack, X/K jump, C/L sling, Z+X or F spin, V/; special.
 */
export class Controls {
  x = 0;
  y = 0;
  run = false;
  // pressed this frame
  attack = false;
  jump = false;
  sling = false;
  spin = false;
  special = false;

  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private prevPad = { a: false, x: false, b: false, y: false, r: false };
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private touched: Partial<Record<BtnName, boolean>> = {};
  private knob?: Phaser.GameObjects.Arc;
  private specialRing?: Phaser.GameObjects.Arc;
  private lastTap = { dir: 0, at: -1 };
  private prevX = 0;

  constructor(private scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,Z,X,J,K,C,L,V,F,SEMICOLON') as Record<string, Phaser.Input.Keyboard.Key>;
    if (scene.sys.game.device.input.touch) this.buildTouch();
  }

  /** Lights the special button when the faith gauge is full. */
  setSpecialReady(ready: boolean) { this.specialRing?.setVisible(ready); }

  private buildTouch() {
    const s = this.scene;
    s.input.addPointer(2);
    const ui = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => o.setScrollFactor(0).setDepth(1000);
    ui(s.add.circle(56, 222, 30, 0xffffff, 0.08).setStrokeStyle(1.5, 0xffffff, 0.55));
    this.knob = ui(s.add.circle(56, 222, 12, 0xffffff, 0.5)).setDepth(1001);
    for (const b of Object.values(BTN)) {
      ui(s.add.circle(b.x, b.y, b.r, 0x1c1226, 0.45).setStrokeStyle(1.5, b.gold ? 0xf2c14e : 0xffffff, 0.8));
      ui(s.add.text(b.x, b.y, b.label, { fontFamily: '"Do Hyeon", sans-serif', fontSize: '9px', color: '#ffffff' }).setOrigin(0.5)).setDepth(1001);
    }
    this.specialRing = ui(s.add.circle(BTN.special.x, BTN.special.y, BTN.special.r + 3).setStrokeStyle(2, 0xffe27a, 1)).setVisible(false);

    s.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < 240) { this.stick = { id: p.id, ox: p.x, oy: p.y, x: 0, y: 0 }; return; }
      for (const [name, b] of Object.entries(BTN) as [BtnName, (typeof BTN)[BtnName]][])
        if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < b.r + 6) { this.touched[name] = true; return; }
    });
    s.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.stick || p.id !== this.stick.id) return;
      const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy, m = Math.max(1, Math.hypot(dx, dy) / 24);
      this.stick.x = dx / 24 / m;
      this.stick.y = dy / 24 / m;
    });
    s.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.stick && p.id === this.stick.id) this.stick = null;
    });
  }

  update(now: number) {
    const k = this.keys, pad = this.scene.input.gamepad?.pad1, on = !!pad?.connected;
    let x = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    let y = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    let fullTilt = false; // stick pushed to the edge also runs
    if (on) {
      x ||= (pad.right ? 1 : 0) - (pad.left ? 1 : 0) || (Math.abs(pad.leftStick.x) > 0.3 ? Math.sign(pad.leftStick.x) : 0);
      y ||= (pad.down ? 1 : 0) - (pad.up ? 1 : 0) || (Math.abs(pad.leftStick.y) > 0.3 ? Math.sign(pad.leftStick.y) : 0);
      fullTilt ||= Math.abs(pad.leftStick.x) > 0.95;
    }
    if (this.stick) {
      x ||= Math.abs(this.stick.x) > 0.35 ? Math.sign(this.stick.x) : 0;
      y ||= Math.abs(this.stick.y) > 0.35 ? Math.sign(this.stick.y) : 0;
      fullTilt ||= Math.abs(this.stick.x) > 0.95;
    }
    // a fresh horizontal press: check for a double tap
    if (x !== 0 && x !== this.prevX) {
      if (isDoubleTap(this.lastTap.dir, this.lastTap.at, x, now)) this.run = true;
      this.lastTap = { dir: x, at: now };
    }
    if (x === 0 || (this.prevX !== 0 && x !== this.prevX)) this.run = false;
    this.run ||= fullTilt && x !== 0;
    this.prevX = x;
    this.x = x;
    this.y = y;
    this.knob?.setPosition(56 + (this.stick?.x ?? 0) * 18, 222 + (this.stick?.y ?? 0) * 18);

    const J = Phaser.Input.Keyboard.JustDown;
    const pd = { a: on && pad.A, x: on && pad.X, b: on && pad.B, y: on && pad.Y, r: on && pad.R1 > 0.5 };
    const edge = (b: keyof typeof pd) => pd[b] && !this.prevPad[b];
    const zDown = J(k.Z) || J(k.J), xDown = J(k.X) || J(k.K);
    const bothButtons = (zDown && (k.X.isDown || k.K.isDown)) || (xDown && (k.Z.isDown || k.J.isDown));
    this.spin = bothButtons || J(k.F) || !!this.touched.spin || edge('r');
    this.special = J(k.V) || J(k.SEMICOLON) || !!this.touched.special || edge('y');
    this.attack = !this.spin && (zDown || !!this.touched.attack || edge('x'));
    this.jump = !this.spin && (xDown || !!this.touched.jump || edge('a'));
    this.sling = J(k.C) || J(k.L) || !!this.touched.sling || edge('b');
    this.prevPad = pd;
    this.touched = {};
  }
}

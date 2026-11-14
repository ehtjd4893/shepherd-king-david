import Phaser from 'phaser';
import { isDoubleTap } from './combat.ts';

/**
 * Touch buttons live in the page (not in the 480×270 game canvas), so they are sized in real screen pixels
 * — big enough for a thumb on a phone — and can sit over the letterbox bars beside the game.
 * Position: distance from the bottom-right corner; size: diameter in CSS px.
 */
const BTN = {
  attack: { right: 18, bottom: 20, size: 92, label: '공격', gold: true },
  jump: { right: 124, bottom: 14, size: 68, label: '점프', gold: false },
  spin: { right: 208, bottom: 18, size: 60, label: '회전', gold: false },
  sling: { right: 118, bottom: 96, size: 64, label: '물매', gold: false },
  special: { right: 26, bottom: 124, size: 64, label: '믿음', gold: true },
  ally: { right: 196, bottom: 96, size: 58, label: '동료', gold: false },
} as const;
type BtnName = keyof typeof BTN;
const STICK_R = 50; // px the thumb travels for a full push

const CSS = `
.tc{position:fixed;inset:0;pointer-events:none;z-index:10;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Do Hyeon","Apple SD Gothic Neo",sans-serif}
.tc-zone{position:absolute;left:0;top:0;bottom:0;width:50%;pointer-events:auto}
.tc-base{position:absolute;width:${STICK_R * 2 + 28}px;height:${STICK_R * 2 + 28}px;margin:-${STICK_R + 14}px 0 0 -${STICK_R + 14}px;border-radius:50%;
  border:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.08);pointer-events:none}
.tc-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 2px rgba(28,18,38,.6)}
.tc-btn{position:absolute;display:grid;place-items:center;border-radius:50%;pointer-events:auto;touch-action:none;color:#fff;font-size:17px;
  background:rgba(28,18,38,.5);border:2.5px solid rgba(255,255,255,.75);text-shadow:0 1px 0 #1c1226}
.tc-btn.gold{border-color:#f2c14e}
.tc-btn.down{background:rgba(242,193,78,.55);transform:scale(.94)}
.tc-btn.ready{box-shadow:0 0 0 4px #ffe27a,0 0 14px #ffe27a}
`;

/**
 * Keyboard, touch and gamepad folded into one input state, read once per frame.
 * Keys: arrows/WASD move (double-tap ←/→ to run), Z/J attack, X/K jump, C/L sling, Z+X or F spin, V/; special, G call companions.
 * Touch: thumb anywhere on the left half = joystick (push to the edge to run), buttons on the right.
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
  ally = false;
  special = false;

  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private prevPad = { a: false, x: false, b: false, y: false, r: false, l: false };
  private stick: { id: number; x: number; y: number } | null = null;
  private touched: Partial<Record<BtnName, boolean>> = {};
  private btns: Partial<Record<BtnName, HTMLElement>> = {};
  private lastTap = { dir: 0, at: -1 };
  private prevX = 0;

  constructor(private scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,Z,X,J,K,C,L,V,F,G,SEMICOLON') as Record<string, Phaser.Input.Keyboard.Key>;
    if (scene.sys.game.device.input.touch) this.buildTouch();
  }

  /** Lights the special button when the faith gauge is full. */
  setSpecialReady(ready: boolean) { this.btns.special?.classList.toggle('ready', ready); }

  /** Hide a touch button the current stage doesn't use (e.g. companions before Adullam). */
  setButton(name: BtnName, on: boolean) {
    const b = this.btns[name];
    if (b) b.style.display = on ? '' : 'none';
  }

  private buildTouch() {
    if (!document.getElementById('tc-style')) {
      const st = document.createElement('style');
      st.id = 'tc-style'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    const root = document.createElement('div');
    root.className = 'tc';
    const zone = document.createElement('div'), base = document.createElement('div'), knob = document.createElement('div');
    zone.className = 'tc-zone'; base.className = 'tc-base'; knob.className = 'tc-knob';
    base.appendChild(knob);
    root.append(zone, base);
    const rest = () => { base.style.left = `calc(${STICK_R + 30}px + env(safe-area-inset-left, 0px))`; base.style.top = `calc(100% - ${STICK_R + 34}px)`; knob.style.transform = ''; };
    rest();

    // floating joystick: it starts wherever the thumb lands on the left half
    let ox = 0, oy = 0;
    zone.addEventListener('pointerdown', e => {
      e.preventDefault();
      ox = e.clientX; oy = e.clientY;
      base.style.left = `${ox}px`; base.style.top = `${oy}px`;
      this.stick = { id: e.pointerId, x: 0, y: 0 };
      // keep getting moves if the thumb slides off the zone; the stick still works if capture is refused
      try { zone.setPointerCapture(e.pointerId); } catch { /* see above */ }
    });
    zone.addEventListener('pointermove', e => {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      const dx = e.clientX - ox, dy = e.clientY - oy, m = Math.max(1, Math.hypot(dx, dy) / STICK_R);
      this.stick.x = dx / STICK_R / m; this.stick.y = dy / STICK_R / m;
      knob.style.transform = `translate(${this.stick.x * STICK_R}px, ${this.stick.y * STICK_R}px)`;
    });
    const release = (e: PointerEvent) => { if (this.stick && e.pointerId === this.stick.id) { this.stick = null; rest(); } };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);

    for (const [name, b] of Object.entries(BTN) as [BtnName, (typeof BTN)[BtnName]][]) {
      const el = document.createElement('div');
      el.className = 'tc-btn' + (b.gold ? ' gold' : '');
      el.textContent = b.label;
      Object.assign(el.style, {
        width: `${b.size}px`, height: `${b.size}px`,
        right: `calc(${b.right}px + env(safe-area-inset-right, 0px))`, bottom: `calc(${b.bottom}px + env(safe-area-inset-bottom, 0px))`,
      });
      el.addEventListener('pointerdown', e => { e.preventDefault(); this.touched[name] = true; el.classList.add('down'); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('down'));
      this.btns[name] = el;
      root.appendChild(el);
    }
    document.body.appendChild(root);
    // the overlay belongs to this scene only (cutscenes and the title take taps on the canvas)
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => root.remove());
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, () => root.remove());
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

    const J = Phaser.Input.Keyboard.JustDown;
    const pd = { a: on && pad.A, x: on && pad.X, b: on && pad.B, y: on && pad.Y, r: on && pad.R1 > 0.5, l: on && pad.L1 > 0.5 };
    const edge = (b: keyof typeof pd) => pd[b] && !this.prevPad[b];
    const zDown = J(k.Z) || J(k.J), xDown = J(k.X) || J(k.K);
    const bothButtons = (zDown && (k.X.isDown || k.K.isDown)) || (xDown && (k.Z.isDown || k.J.isDown));
    this.spin = bothButtons || J(k.F) || !!this.touched.spin || edge('r');
    this.special = J(k.V) || J(k.SEMICOLON) || !!this.touched.special || edge('y');
    this.attack = !this.spin && (zDown || !!this.touched.attack || edge('x'));
    this.jump = !this.spin && (xDown || !!this.touched.jump || edge('a'));
    this.sling = J(k.C) || J(k.L) || !!this.touched.sling || edge('b');
    this.ally = J(k.G) || !!this.touched.ally || edge('l');
    this.prevPad = pd;
    this.touched = {};
  }
}

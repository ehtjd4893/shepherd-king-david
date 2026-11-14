import Phaser from 'phaser';
import { frameOf, shaftCanvas, pickupCanvas } from './art.ts';
import { rockHits, slideDown, SHAFT, SHAFT_COLUMNS } from './combat.ts';
import { Controls } from './controls.ts';
import { sfx } from './sfx.ts';

const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
interface Rock { x: number; y: number; t: number; img: Phaser.GameObjects.Image }

/** Climbing the water shaft into Jebus (2 Sam 5:8): up the chimney, dodging stones that are warned at the top first. */
export class ShaftScene extends Phaser.Scene {
  private ctl!: Controls;
  private x = 240;
  private y = 0;
  private T = 0;
  private hurtT = 0;
  private next = 1.2;
  private doneAt = -1;
  private rocks: Rock[] = [];
  private david!: Phaser.GameObjects.Image;
  private marks!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Graphics;
  private origins = new Map<string, [number, number]>();

  constructor() { super('shaft'); }

  create() {
    const H = SHAFT.height;
    this.x = 240; this.y = H - 50; this.T = 0; this.hurtT = 0; this.next = 1.2; this.doneAt = -1; this.rocks = [];
    if (!this.textures.exists('shaftBg')) this.textures.addCanvas('shaftBg', shaftCanvas(H));
    if (!this.textures.exists('pickup')) this.textures.addCanvas('pickup', pickupCanvas());
    this.add.image(0, 0, 'shaftBg').setOrigin(0);
    this.cameras.main.setBounds(0, 0, 480, H);
    this.david = this.add.image(this.x, this.y, this.frame(0)).setDepth(10);
    this.marks = this.add.graphics().setDepth(20);
    this.bar = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.add.text(240, 8, '물 긷는 수구 · 성벽 위까지 올라가라!', { fontFamily: FONT, fontSize: '12px', color: '#ffe27a', stroke: '#1c1226', strokeThickness: 3 })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.add.text(240, 250, this.sys.game.device.input.touch ? '조이스틱 ↑ 오르기 · 붉은 표시 아래로는 돌이 떨어진다' : '↑ 오르기 · ←→ 옆으로 · 붉은 표시 아래로는 돌이 떨어진다',
      { fontFamily: FONT, fontSize: '10px', color: '#ffffff', stroke: '#1c1226', strokeThickness: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.ctl = new Controls(this);
    for (const b of ['attack', 'jump', 'sling', 'special', 'spin', 'ally'] as const) this.ctl.setButton(b, false);
  }

  private frame(f: number) {
    const key = `shaft_david_${f}`;
    if (!this.textures.exists(key)) {
      const s = frameOf('davidS', 'climb', f);
      this.textures.addCanvas(key, s.c);
      this.origins.set(key, [s.ox / s.c.width, s.oy / s.c.height]);
    }
    return key;
  }

  update(_: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05), H = SHAFT.height, c = this.ctl;
    this.T += dt;
    c.update(this.T);
    if (this.doneAt >= 0) {
      if (this.T > this.doneAt + 1.6) this.scene.start('stage', { stage: 'zion' });
      return;
    }
    // climb
    if (this.hurtT > 0) this.hurtT -= dt;
    else { this.y += c.y * SHAFT.climb * dt; this.x += c.x * SHAFT.side * dt; }
    this.x = Phaser.Math.Clamp(this.x, 172, 308);
    this.y = Phaser.Math.Clamp(this.y, SHAFT.top, H - 40);
    const moving = this.hurtT <= 0 && (c.x !== 0 || c.y !== 0), key = this.frame(moving ? Math.floor(this.T * 6) % 2 : 0), o = this.origins.get(key)!;
    this.david.setTexture(key).setOrigin(o[0], o[1]).setPosition(Math.round(this.x), Math.round(this.y)).setAlpha(this.hurtT > 0 && Math.floor(this.T * 14) % 2 ? 0.4 : 1);
    const camTop = Phaser.Math.Clamp(this.y - 180, 0, H - 270);
    this.cameras.main.scrollY = Math.round(camTop);

    // stones: pick a column (often David's), warn at the top of the view, then drop
    this.next -= dt;
    if (this.next <= 0) {
      this.next = SHAFT.every;
      const mine = SHAFT_COLUMNS.reduce((a, b) => (Math.abs(a - this.x) < Math.abs(b - this.x) ? a : b));
      const x = Math.random() < 0.5 ? mine : Phaser.Utils.Array.GetRandom(SHAFT_COLUMNS);
      this.rocks.push({ x, y: camTop - 12, t: -SHAFT.warn, img: this.add.image(x, camTop - 12, 'pickup').setScale(2).setDepth(12) });
    }
    this.marks.clear();
    for (const r of this.rocks) {
      if (r.t < 0) {
        r.t += dt; r.y = camTop - 12;
        if (Math.floor(this.T * 12) % 2) this.marks.fillStyle(0xe63c3c, 0.5).fillRect(r.x - 14, camTop, 28, 270);
      } else {
        r.y += SHAFT.rockSpeed * dt;
        if (this.hurtT <= 0 && rockHits(r, { x: this.x, y: this.y })) {
          this.y = slideDown(this.y, H - 40); this.hurtT = 0.5; r.y = Infinity;
          this.cameras.main.shake(120, 0.008); sfx.hurt();
          this.add.text(this.x, this.y - 60, '아야!', { fontFamily: FONT, fontSize: '13px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 3 }).setOrigin(0.5).setDepth(30);
        }
      }
      r.img.setPosition(r.x, r.y);
    }
    for (const r of this.rocks.filter(r => r.y > camTop + 300)) r.img.destroy();
    this.rocks = this.rocks.filter(r => r.img.active);

    // progress to the top
    const prog = 1 - (this.y - SHAFT.top) / (H - 40 - SHAFT.top);
    this.bar.clear().fillStyle(0x1c1226, 0.8).fillRect(460, 30, 10, 200).fillStyle(0xf2c14e, 1).fillRect(462, 32 + 196 * (1 - prog), 6, 196 * prog);
    if (this.y <= SHAFT.top) {
      this.doneAt = this.T;
      sfx.harp();
      this.add.text(240, this.y - 70, '성 안으로!', { fontFamily: FONT, fontSize: '20px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 4 }).setOrigin(0.5).setDepth(30);
    }
  }
}

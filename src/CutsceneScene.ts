import Phaser from 'phaser';
import { frameOf, downOf, sheepFrame, portraitOf, bgBeth, bgField, bgElah, bgGibeah, bgWild, bgZiklag, bgJebus, bgZion, frame, R } from './art.ts';
import { sfx } from './sfx.ts';
import { CUTSCENES, NAMES, type Actor, type Cutscene } from './cutscenes.ts';

const BACKDROPS = { beth: bgBeth, field: () => bgField(480), elah: () => bgElah(480), gibeah: () => bgGibeah(480), wild: () => bgWild(480), ziklag: () => bgZiklag(480), jebus: () => bgJebus(480), zion: () => bgZion(480) };

const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
const CPS = 30; // characters typed per second

/** Dialogue scene in the style of the approved draft: actors on a backdrop, a framed box, portrait, typewriter text. */
export class CutsceneScene extends Phaser.Scene {
  private cs!: Cutscene;
  private i = 0;
  private lineT = 0;
  private T = 0;
  private started = false;
  private cast: { a: Actor; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse }[] = [];
  private origins = new Map<string, [number, number]>();
  private box!: Phaser.Textures.CanvasTexture;
  private name!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private fx!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Graphics;
  private anointing = false;
  private gilboa = false;
  private backdrop!: Phaser.GameObjects.Image;
  private qteGot = 0;
  private scribbles: number[][] = [];
  private qteText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('cutscene'); }

  init(d: { id: string }) {
    this.cs = CUTSCENES[d.id];
    this.i = 0; this.lineT = 0; this.T = 0; this.started = false; this.cast = []; this.anointing = false; this.gilboa = false; this.qteGot = 0; this.scribbles = [];
  }

  create() {
    this.backdrop = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.setBackdrop(this.cs.bg);
    this.fx = this.add.graphics().setDepth(500);
    this.ui = this.add.graphics().setDepth(1003);
    if (!this.textures.exists('dlgbox')) this.textures.createCanvas('dlgbox', 480, 270);
    this.box = this.textures.get('dlgbox') as Phaser.Textures.CanvasTexture;
    this.add.image(0, 0, 'dlgbox').setOrigin(0).setDepth(1000);
    this.face = this.add.image(15, 206, '__DEFAULT').setOrigin(0).setDepth(1001).setVisible(false);
    this.name = this.add.text(80, 189, '', { fontFamily: FONT, fontSize: '10px', color: '#f2c14e' }).setDepth(1002);
    this.body = this.add.text(80, 209, '', { fontFamily: FONT, fontSize: '11px', color: '#f5ecd8', lineSpacing: 4, wordWrap: { width: 378 } }).setDepth(1002);
    this.qteText = this.add.text(240, 22, '', { fontFamily: FONT, fontSize: '12px', color: '#ffe27a', stroke: '#1c1226', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(1004);
    this.add.text(472, 6, '건너뛰기 ▶▶', { fontFamily: FONT, fontSize: '9px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setOrigin(1, 0).setDepth(1002).setAlpha(0.8);

    this.keys = this.input.keyboard!.addKeys('Z,X,J,K,ENTER,SPACE,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (p.x > 400 && p.y < 26 ? this.finish() : this.advance()));

    if (this.cs.title) {
      const t = this.add.text(240, 120, this.cs.title, { fontFamily: FONT, fontSize: '34px', color: '#f2c14e', stroke: '#1c1226', strokeThickness: 4 }).setOrigin(0.5).setDepth(1500);
      this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 500 });
      this.time.delayedCall(1800, () => { t.destroy(); this.startLine(0); });
    } else this.startLine(0);
  }

  private setBackdrop(bg: Cutscene['bg']) {
    if (bg === 'dark') { this.backdrop.setVisible(false); return; }
    const key = `bg_${bg}480`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, BACKDROPS[bg]());
    this.backdrop.setTexture(key).setVisible(true);
  }

  private frameKey(id: string, anim: string, f: number, k = 1, down = false) {
    const key = `cs_${id}_${anim}_${f}_${k}${down ? '_L' : ''}`;
    if (!this.textures.exists(key)) {
      const s = id === 'sheep' ? sheepFrame(f, 1) : down ? downOf(id, anim, f, k) : frameOf(id, anim, f, k);
      this.textures.addCanvas(key, s.c);
      this.origins.set(key, [s.ox / s.c.width, s.oy / s.c.height]);
    }
    return key;
  }

  private startLine(i: number) {
    this.started = true;
    this.i = i; this.lineT = 0;
    const b = this.cs.beats[i];
    this.qteGot = 0; this.scribbles = [];
    if (b.banner) this.banner(b.banner);
    if (b.bg) this.setBackdrop(b.bg);
    if (b.fx === 'gilboa') this.gilboa = true; else if (b.bg) this.gilboa = false;
    if (b.fx === 'anoint') this.anointing = true;
    else if (b.actors) this.anointing = false;
    if (b.actors) {
      for (const c of this.cast) { c.img.destroy(); c.shadow.destroy(); }
      this.cast = b.actors.map(a => ({
        a,
        shadow: this.add.ellipse(a.x, a.y, (a.id === 'sheep' ? 18 : 20) * (a.k ?? 1) * (a.down ? 1.8 : 1), 5 * (a.k ?? 1), 0x28161e, 0.32),
        img: this.add.image(a.x, a.y, this.frameKey(a.id, a.anim ?? 'idle', 0, a.k, a.down)).setFlipX(!!a.flip).setDepth(a.y),
      }));
    }
    // dialogue box: portrait + name tab for speakers, full width for narration
    const g = this.box.getContext();
    g.clearRect(0, 0, 480, 270);
    frame(g, 8, 198, 464, 66);
    if (b.who) { frame(g, 12, 203, 56, 56); R(g, 15, 206, 50, 50, '#2e2444'); frame(g, 74, 186, 62, 16); }
    this.box.refresh();
    this.name.setText(b.who ? NAMES[b.who] : '');
    this.body.setPosition(b.who ? 80 : 22, 209).setWordWrapWidth(b.who ? 378 : 434).setColor(b.who ? '#f5ecd8' : '#e9d7a6').setText('');
    this.face.setVisible(!!b.who);
  }

  private banner(text: string) {
    const t = this.add.text(240, 96, text, { fontFamily: FONT, fontSize: '20px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(1500).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 400, onComplete: () => t.destroy() });
    sfx.harp();
  }

  private typed() { return Math.min(this.cs.beats[this.i].text.length, Math.floor(this.lineT * CPS)); }

  private advance() {
    if (!this.started) return;
    const q = this.cs.beats[this.i].qte;
    if (q && this.qteGot < q) {
      // mash: every press scribbles on the gate; it can't be failed, only finished
      this.qteGot++;
      this.lineT = 1e3;
      this.scribbles.push([262 + Math.random() * 46, 128 + Math.random() * 54, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 22]);
      sfx.swing();
      if (this.qteGot === q) this.banner('해냈다!');
      return;
    }
    if (this.typed() < this.cs.beats[this.i].text.length) { this.lineT = 1e3; return; } // first press finishes the line
    if (this.i + 1 < this.cs.beats.length) this.startLine(this.i + 1);
    else this.finish();
  }

  private finish() {
    const n = this.cs.next;
    if (n.scene === 'stage') this.scene.start('stage', { stage: n.id });
    else if (n.scene === 'cutscene') this.scene.start('cutscene', { id: n.id });
    else if (n.scene === 'credits') this.scene.start('credits');
    else this.scene.start('title');
  }

  update(_: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    this.T += dt;
    const J = Phaser.Input.Keyboard.JustDown, k = this.keys;
    if (J(k.ESC)) { this.finish(); return; }
    if (J(k.Z) || J(k.X) || J(k.J) || J(k.K) || J(k.ENTER) || J(k.SPACE)) this.advance();
    if (!this.started) return;
    this.lineT += dt;

    const b = this.cs.beats[this.i], n = this.typed(), done = n >= b.text.length;
    this.body.setText(b.text.slice(0, n));
    if (b.who) {
      const open = !done && Math.floor(this.lineT * 8) % 2 === 0, key = `portrait_${b.who}_${open}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, portraitOf(b.who, open));
      this.face.setTexture(key);
    }

    for (const c of this.cast) {
      const a = c.a, walkIn = a.from !== undefined && this.lineT < 1.1 && !!b.actors;
      const x = walkIn ? a.from! + (a.x - a.from!) * (this.lineT / 1.1) : a.x;
      const anim = a.down ? 'hurt' : walkIn ? 'walk' : a.anim === 'flail' ? (this.qteGot % 2 ? 'atk3' : 'jump') : a.anim ?? 'idle';
      const f = a.down ? 0 : a.id === 'sheep' ? (walkIn ? Math.floor(this.T * 8) % 2 : 0) : anim === 'walk' ? Math.floor(this.T * 8) % 4 : anim === 'idle' || anim === 'laugh' ? Math.floor(this.T * 2.5) % 2 : anim === 'harp' ? Math.floor(this.T * 6) % 2 : 0;
      const key = this.frameKey(a.id, a.id === 'sheep' ? 'idle' : anim, f, a.k, a.down), o = this.origins.get(key)!;
      c.img.setTexture(key).setOrigin(o[0], o[1]).setPosition(Math.round(x), a.y);
      c.shadow.setPosition(Math.round(x), a.y);
    }

    // anointing: light from above, oil from the horn, sparkles around David
    this.fx.clear();
    if (this.anointing) {
      this.fx.fillStyle(0xffe28c, 0.2).fillRect(214, 0, 46, 192).fillRect(222, 0, 30, 192);
      for (let i = 0; i < 4; i++) this.fx.fillStyle(0xf2c14e, 1).fillRect(233, 148 + ((this.T * 14 + i * 1.3) % 5), 1, 1);
      for (let i = 0; i < 14; i++) {
        const ph = (this.T * 0.5 + i / 14) % 1, x = Math.round(236 + Math.sin(i * 2.1) * 16), y = Math.round(176 - ph * 50);
        if ((Math.floor(this.T * 8) + i) % 3) { this.fx.fillStyle(i % 3 ? 0xf2c14e : 0xffffff, 1).fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3); }
      }
    }
    if (this.gilboa) {
      // Mount Gilboa at dusk, only in silhouette: Saul's crown and Jonathan's bow fall onto the slope
      const sky = [0x2a0a12, 0x4a1418, 0x6a2018, 0x8a3018, 0x3a1010];
      sky.forEach((c, i) => this.fx.fillStyle(c, 1).fillRect(0, i * 34, 480, 34));
      this.fx.fillStyle(0x3a1010, 1).fillRect(0, 170, 480, 100);
      this.fx.fillStyle(0x0d0a14, 1);
      for (let x = 0; x < 480; x += 2) { const h = 96 + Math.abs(x - 232) * 0.42 + Math.sin(x * 0.07) * 4; this.fx.fillRect(x, h, 2, 270 - h); }
      const t = Math.min(1, this.lineT / 2.2), cy = 30 + t * 64, by = 20 + Math.min(1, this.lineT / 2.6) * 86;
      this.fx.fillStyle(0xf2c14e, 1).fillRect(204, cy, 20, 6).fillTriangle(204, cy, 208, cy - 7, 212, cy).fillTriangle(212, cy, 216, cy - 7, 220, cy).fillTriangle(218, cy, 222, cy - 6, 224, cy);
      this.fx.lineStyle(2, 0x9a6a40, 1).beginPath().arc(262, by + 10, 14, -1.2, 1.2).strokePath().lineStyle(1, 0xe8e0cc, 1).lineBetween(262 + 14 * Math.cos(-1.2), by + 10 + 14 * Math.sin(-1.2), 262 + 14 * Math.cos(1.2), by + 10 + 14 * Math.sin(1.2));
    }
    this.ui.clear();
    const q = b.qte;
    this.qteText.setText(q ? (this.qteGot < q ? `연타! ${this.qteGot} / ${q}` : '') : '');
    if (q) {
      // the gate of Gath, getting covered in scribbles
      this.fx.fillStyle(0x6a4a30, 1).fillRect(262, 124, 50, 66).fillStyle(0x4a3220, 1);
      for (let x = 270; x < 312; x += 10) this.fx.fillRect(x, 124, 1, 66);
      this.fx.lineStyle(1, 0xf3ecd9, 1);
      for (const [x, y, dx, dy] of this.scribbles) this.fx.lineBetween(x, y, x + dx, y + dy);
      if (this.qteGot < q) this.ui.fillStyle(0x1c1226, 0.8).fillRect(138, 40, 204, 10).fillStyle(0xf2c14e, 1).fillRect(140, 42, 200 * this.qteGot / q, 6);
    }
    if (done && Math.floor(this.T * 3) % 2) this.ui.fillStyle(0xf2c14e, 1).fillTriangle(455, 250, 463, 250, 459, 255);
  }
}

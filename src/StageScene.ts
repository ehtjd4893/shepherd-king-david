import Phaser from 'phaser';
import {
  frameOf, downOf, whiteOf, isBeast, shadowCanvas, sparkCanvas, stoneCanvas, pickupCanvas, sheepFrame, arrowCanvas, spearCanvas,
  bgElah, bgField, bgGibeah, bgWild, bgKeilah, bgZiklag, bgJebus, bgZion, KB, frame, bar, R, D, C,
} from './art.ts';
import { SAUL_DODGES, SPIN, FAITH_MAX, STONE_MAX, type Section } from './combat.ts';
import { standing, type HitOutcome } from './hit.ts';
import { betweenFights } from './progress.ts';
import { SIGHT_RANGE, type StealthRun } from './stealth.ts';
import { telegraphs, def, type Actor, type SheepBody, type GMode } from './fighters.ts';
import { StageSim, PICKUP_FADE, type Fx, type Stone, type Shot, type Pickup, type Rusher, type Bound } from './sim.ts';
import { Controls } from './controls.ts';
import { sfx } from './sfx.ts';
import { writeSave } from './save.ts';

const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
// the sling throw: [pose, frame, seconds]; the stone leaves at the start of 'release'
const SLING_SEQ: [string, number, number][] = [['sling', 0, 0.05], ['sling', 2, 0.05], ['wind', 0, 0.05], ['release', 0, 0.08], ['follow', 0, 0.08]];

type Img = Phaser.GameObjects.Image;
type Txt = Phaser.GameObjects.Text;
/** What the scene draws for a stealth section: a sprite and a ?/! mark per guard, the marks over each goal. */
interface StealthView { sentries: { spr: Img; mark: Txt }[]; goals: Phaser.GameObjects.GameObject[][] }

/**
 * The stage on screen. The game itself runs in StageSim (sim.ts); this scene feeds it input, draws its state
 * and plays its effects.
 */
export class StageScene extends Phaser.Scene {
  private stageId = 'field';
  private startSection = 0; // > 0 when retrying after a fall: start at that section, not the whole stage
  sim!: StageSim; // the dev bot reads it
  private ctl!: Controls;
  private fighters = new Map<Actor, { spr: Img; shadow: Img }>();
  private stoneImgs = new Map<Stone, Img>();
  private shotImgs = new Map<Shot, Img>();
  private pickupImgs = new Map<Pickup, { img: Img; arrow: Txt }>();
  private rusherImgs = new Map<Rusher, { spr: Img; shadow: Img }>();
  private sheepImgs = new Map<SheepBody, { img: Img; shadow: Img }>();
  private boundImgs = new Map<Bound, { img: Img; rope: Phaser.GameObjects.Graphics; arrow: Txt }>();
  private stealthView: StealthView | null = null;
  private spinRing: Phaser.GameObjects.Ellipse | null = null;
  private fxg!: Phaser.GameObjects.Graphics; // floor effects (warning line, shockwave)
  private topfx!: Phaser.GameObjects.Graphics; // above sprites (Goliath's forehead)
  private bubble: Txt | null = null;
  private shade!: Phaser.GameObjects.Rectangle;
  private origins = new Map<string, [number, number]>();
  private hud!: Phaser.Textures.CanvasTexture;
  private texts!: Record<'score' | 'enemy' | 'banner' | 'sub' | 'go' | 'hint' | 'boss' | 'sheep' | 'ally', Txt>;

  constructor() { super('stage'); }

  init(data: { stage?: string; section?: number }) { this.stageId = data.stage ?? 'field'; this.startSection = data.section ?? 0; }

  create() {
    const score = (this.registry.get('score') as number) ?? 0;
    this.sim = new StageSim(this.stageId, this.startSection, score, e => this.play(e), () => Math.random());
    writeSave({ stage: this.stageId, score }); // continue from here next time
    const stage = this.sim.stage;
    this.fighters = new Map(); this.stoneImgs = new Map(); this.shotImgs = new Map(); this.pickupImgs = new Map();
    this.rusherImgs = new Map(); this.sheepImgs = new Map(); this.boundImgs = new Map();
    this.stealthView = null; this.spinRing = null; this.bubble = null;

    const once = (key: string, make: () => HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); };
    const bgKey = `bg_${stage.bg}`;
    once(bgKey, () => ({ field: bgField, elah: bgElah, gibeah: bgGibeah, wild: bgWild, keilah: bgKeilah, ziklag: bgZiklag, jebus: bgJebus, zion: bgZion })[stage.bg](stage.width));
    once('stealthSpear', () => { const c = document.createElement('canvas'); c.width = 9; c.height = 60; const g = c.getContext('2d')!; g.fillStyle = '#1c1226'; g.fillRect(3, 6, 3, 54); g.fillStyle = '#7c4c2c'; g.fillRect(4, 7, 1, 52); g.fillStyle = '#9aa4ae'; g.fillRect(2, 0, 5, 8); return c; });
    once('jug', () => { const c = document.createElement('canvas'); c.width = 12; c.height = 14; const g = c.getContext('2d')!; g.fillStyle = '#1c1226'; g.fillRect(2, 3, 8, 11); g.fillRect(4, 0, 4, 4); g.fillStyle = '#b06a3a'; g.fillRect(3, 4, 6, 9); g.fillRect(5, 1, 2, 3); g.fillStyle = '#d8945a'; g.fillRect(4, 5, 1, 5); return c; });
    once('arrow', arrowCanvas);
    once('spear', spearCanvas);
    once('shadow', () => shadowCanvas(13));
    once('spark', () => sparkCanvas(9));
    once('sparkBig', () => sparkCanvas(14));
    once('stone', stoneCanvas);
    once('pickup', pickupCanvas);
    this.add.image(0, 0, bgKey).setOrigin(0).setDepth(0);
    this.cameras.main.setBounds(0, 0, stage.width, 270);

    this.fxg = this.add.graphics().setDepth(2);
    this.shade = this.add.rectangle(0, 0, 480, 270, 0x0a0c30, 0).setOrigin(0).setScrollFactor(0).setDepth(1500);
    this.topfx = this.add.graphics().setDepth(940);
    this.ctl = new Controls(this);
    this.ctl.setButton('ally', !!stage.allies);
    this.buildHud();
    if (!stage.noBanner || this.startSection) {
      this.texts.banner.setText(this.startSection ? '다시 한 번!' : stage.title).setAlpha(1);
      this.tweens.add({ targets: this.texts.banner, alpha: 0, delay: 1600, duration: 500 });
    }
  }

  /* ---------- loop ---------- */
  update(_: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05), s = this.sim;
    this.ctl.update(s.time0 + dt);
    s.step(dt, this.ctl);
    if (s.exit) {
      if ('retry' in s.exit) this.scene.restart({ stage: this.stageId, section: s.exit.retry }); // retry this section, full health
      else this.leave();
    }
    const T = s.time0;
    this.drawFlock(T);
    this.cameras.main.scrollX = Math.round(s.camX);
    this.draw(s.player, T);
    for (const e of s.enemies) this.draw(e, T);
    this.drawThings(T);
    this.drawStealth(T);
    this.drawHud(T);
    this.drawFloorFx(T);
    this.drawOverheadFx(T);
    this.texts.go.setVisible(betweenFights(s.prog) && Math.floor(T * 3) % 2 === 0);
  }

  private leave() {
    const n = this.sim.stage.next;
    if (n.scene === 'cutscene') this.scene.start('cutscene', { id: n.id });
    else if (n.scene === 'shaft') this.scene.start('shaft');
    else this.scene.start('title');
  }

  /* ---------- sprites ---------- */
  private tex(id: string, anim: string, f: number, lying = false, white = false, k = KB) {
    const key = `${id}_${anim}_${f}${lying ? '_L' : ''}${white ? '_W' : ''}${k !== KB ? '_' + k : ''}`;
    if (!this.textures.exists(key)) {
      let s = lying ? downOf(id, anim, f, k) : frameOf(id, anim, f, k);
      if (white) s = whiteOf(s);
      this.textures.addCanvas(key, s.c);
      this.origins.set(key, [s.ox / s.c.width, s.oy / s.c.height]);
    }
    return key;
  }

  /** Make an image use frame `key` with that frame's own origin. */
  private show<T extends Img>(img: T, key: string): T {
    const o = this.origins.get(key)!;
    return img.setTexture(key).setOrigin(o[0], o[1]);
  }

  private pose(f: Actor, T: number): [string, number, boolean] {
    const fr2 = Math.floor(T * 2.5) % 2;
    if (f.g && standing(f)) {
      const m = f.g.mode;
      const P: Record<GMode, [string, number, boolean]> = {
        taunt: ['laugh', Math.floor(T * 4) % 2, false], walk: ['walk', Math.floor(T * 6) % 4, false], tele: ['atkA', 0, false],
        thrust: ['atk', 0, false], stuck: ['stuck', 0, false], sweepA: ['throw', 0, false], sweep: ['sweep', 0, false],
        jumpA: ['stuck', 0, false], jump: ['throw', 0, false], recover: ['idle', fr2, false], stagger: ['hurt', 0, false],
      };
      return P[m];
    }
    switch (f.state) {
      case 'walk': return ['walk', Math.floor(T * (f.kind === 'jackal' ? 16 : 12)) % 4, false];
      case 'run': return ['run', Math.floor(T * 16) % 4, false];
      case 'jump': return f.airAtk ? ['atk2', 0, false] : ['jump', 0, false];
      case 'sling': {
        let t = f.t;
        for (const [p, fr, d] of SLING_SEQ) { if (t < d) return [p, fr, false]; t -= d; }
        return ['follow', 0, false];
      }
      case 'special': return [f.t < 0.12 ? 'atk2a' : 'atk3', 0, false];
      case 'harp': return ['harp', Math.floor(T * 8) % 2, false];
      case 'spin': return ['atk1', 0, false];
      case 'attack': {
        const a = f.atk!;
        if (f === this.sim.player) return [a.pose === 'atk2' && f.t < a.active[0] ? 'atk2a' : a.pose, 0, false];
        if (f.z > 2 && a.leap) return ['leap', 0, false];
        if (a.keep && f.t >= a.active[0]) return ['walk', Math.floor(T * 18) % 4, false]; // charging
        return [f.t < a.active[0] ? 'atkA' : 'atk', 0, false];
      }
      case 'hurt': case 'getup': return ['hurt', 0, false];
      case 'down': case 'dead': return ['hurt', 0, f.z <= 0 && f.vz <= 0];
      default: return [f.stun ? 'hurt' : 'idle', fr2, false];
    }
  }

  private draw(f: Actor, T: number) {
    let v = this.fighters.get(f);
    if (!v) {
      v = { shadow: this.add.image(f.x, f.y, 'shadow').setDepth(1), spr: this.add.image(f.x, f.y, this.tex(f.id, 'idle', 0)) };
      if (f.g) v.shadow.setScale(2.6, 1.6); // Goliath's shadow is fixed size
      this.fighters.set(f, v);
    }
    const [anim, fr, lying] = this.pose(f, T);
    const k = KB * (f.kind ? def(f).scale ?? 1 : 1);
    this.show(v.spr, this.tex(f.id, anim, fr, lying, f.flash > 0, k)).setFlipX(f.facing < 0)
      .setPosition(Math.round(f.x), Math.round(f.y - f.z)).setDepth(f.y + 10);
    const blink = ((f.state === 'dead' && !f.g) || f.inv > 0) && Math.floor(T * 14) % 2 === 0;
    v.spr.setVisible(!blink);
    if (f.g) return;
    const base = f.kind && isBeast(f.kind) ? def(f).hw / 8 : 1;
    v.shadow.setPosition(Math.round(f.x), Math.round(f.y)).setScale((lying ? 1.5 : 1 - Math.min(f.z, 60) / 150) * base, 1);
  }

  /** One set of display objects per item: made for new items, updated, destroyed once the item is gone from the sim. */
  private sync<T, V>(items: T[], views: Map<T, V>, make: (it: T) => V, update: (it: T, v: V) => void, destroy: (v: V) => void) {
    for (const it of items) {
      let v = views.get(it);
      if (!v) views.set(it, v = make(it));
      update(it, v);
    }
    const live = new Set(items);
    for (const [it, v] of views) if (!live.has(it)) { destroy(v); views.delete(it); }
  }

  /** Sling stones, arrows and spears, stones to pick up, charging companions, captives, the spin ring. */
  private drawThings(T: number) {
    const s = this.sim, p = s.player;
    this.sync(s.stones, this.stoneImgs,
      st => this.add.image(0, 0, 'stone').setOrigin(34 / 40, 0.5).setFlipX(st.dir < 0),
      (st, img) => img.setPosition(Math.round(st.x), Math.round(st.y - st.z)).setDepth(st.y + 11),
      img => img.destroy());
    this.sync(s.shots, this.shotImgs,
      sh => this.add.image(0, 0, sh.spear ? 'spear' : 'arrow').setOrigin(1, 0.5).setFlipX(sh.dir < 0),
      (sh, img) => img.setPosition(Math.round(sh.x), Math.round(sh.y - sh.z)).setDepth(sh.y + 11),
      img => img.destroy());
    this.sync(s.pickups, this.pickupImgs, k => this.pickupView(k),
      (k, v) => {
        const fading = !s.keepsPickups && k.t > PICKUP_FADE;
        v.img.setDepth(k.y + 5).setVisible(!fading || Math.floor(T * 8) % 2 === 0);
        v.arrow.setPosition(k.x, k.y - 12 - Math.abs(Math.sin(T * 6)) * 5).setDepth(k.y + 6).setVisible(s.ammo < STONE_MAX && v.img.visible);
      },
      v => { v.img.destroy(); v.arrow.destroy(); });
    this.sync(s.rushers, this.rusherImgs,
      r => ({ shadow: this.add.image(r.x, r.y, 'shadow').setDepth(1), spr: this.add.image(r.x, r.y, this.tex(r.id, 'walk', 0)) }),
      (r, v) => {
        this.show(v.spr, this.tex(r.id, 'walk', Math.floor(T * 18) % 4)).setPosition(Math.round(r.x), Math.round(r.y)).setDepth(r.y + 10);
        v.shadow.setPosition(Math.round(r.x), Math.round(r.y));
      },
      v => { v.spr.destroy(); v.shadow.destroy(); });
    for (const [b, v] of this.boundImgs) if (!b.done) v.arrow.setY(b.c.y - 44 - Math.abs(Math.sin(T * 6)) * 4);
    if (this.spinRing) {
      if (p.state === 'spin') this.spinRing.setPosition(p.x, p.y - 20 * KB).setDepth(p.y + 12);
      else { this.spinRing.destroy(); this.spinRing = null; }
    }
  }

  private pickupView(k: Pickup) {
    return {
      img: this.add.image(k.x, k.y, 'pickup').setOrigin(0.5, 1),
      arrow: this.add.text(k.x, k.y - 14, '▼', { fontFamily: FONT, fontSize: '10px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2 }).setOrigin(0.5, 1),
    };
  }

  private drawFlock(T: number) {
    this.sync(this.sim.flock, this.sheepImgs,
      sh => ({ img: this.add.image(sh.x, sh.y, 'shadow'), shadow: this.add.image(sh.x, sh.y, 'shadow').setDepth(1).setScale(0.8, 1) }),
      (sh, v) => {
        const f = sh.moving ? Math.floor(T * 8) % 2 : 0, key = `sheep_${f}`;
        if (!this.textures.exists(key)) { const fr = sheepFrame(f); this.textures.addCanvas(key, fr.c); this.origins.set(key, [fr.ox / fr.c.width, fr.oy / fr.c.height]); }
        this.show(v.img, key).setFlipX(sh.facing < 0).setPosition(Math.round(sh.x), Math.round(sh.y)).setDepth(sh.y + 9);
        v.shadow.setPosition(Math.round(sh.x), Math.round(sh.y));
      },
      v => { v.img.destroy(); v.shadow.destroy(); });
  }

  /* ---------- effects ---------- */
  /** Show or play what the sim says just happened. */
  private play(e: Fx) {
    const p = this.sim.player;
    switch (e.type) {
      case 'pop': this.pop(e.text, e.x, e.y, e.big); break;
      case 'say': this.say(e.text, e.x, e.y); break;
      case 'shake': this.cameras.main.shake(e.ms, e.amount); break;
      case 'flash': this.cameras.main.flash(e.ms, e.r, e.g, e.b); break;
      case 'sound': sfx[e.name](); break;
      case 'tip': this.tip(e.text, 4000); break;
      case 'hint': this.tip(this.sys.game.device.input.touch ? e.hint.touch : e.hint.pc, 5000); break;
      case 'struck': if (e.target.g) this.goliathStruck(e.target, e.out, e.dir); else this.struck(e.target, e.out, e.dir); break;
      case 'opening': { const K = KB * 1.6; this.say('빈틈!', e.x + e.facing * 11 * K, e.y - 44 * K); break; }
      case 'goliathTaunt':
        this.bubble = this.add.text(e.x, e.y, '와 봐라, 꼬마야! 네 살을 새들에게 주겠다!', {
          fontFamily: FONT, fontSize: '10px', color: '#1c1226', backgroundColor: '#ffffff', padding: { x: 5, y: 3 },
        }).setOrigin(1, 1).setDepth(960);
        break;
      case 'tauntOver': this.bubble?.destroy(); this.bubble = null; break;
      case 'dropped': this.pickupImgs.set(e.k, this.pickupView(e.k)); break; // made right away, even if it's picked up this same frame
      case 'vanish': {
        const v = this.fighters.get(e.who);
        v?.spr.destroy(); v?.shadow.destroy();
        this.fighters.delete(e.who);
        break;
      }
      case 'spin':
        this.spinRing?.destroy();
        this.spinRing = this.add.ellipse(p.x, p.y - 20 * KB, 96, 30).setStrokeStyle(3, 0xfff2c0, 0.9);
        this.tweens.add({ targets: this.spinRing, alpha: 0.2, scaleX: 1.15, scaleY: 1.15, duration: SPIN.dur * 1000 });
        break;
      case 'special': {
        // pillar of light on David + expanding ring along the floor
        const pillar = this.add.rectangle(p.x, 0, 34, p.y, 0xffe9a8, 0.55).setOrigin(0.5, 0).setDepth(899);
        const ring = this.add.ellipse(p.x, p.y, 20, 8).setStrokeStyle(3, 0xffe27a, 1).setDepth(898);
        this.tweens.add({ targets: pillar, alpha: 0, scaleX: 2.4, duration: 520, onComplete: () => pillar.destroy() });
        this.tweens.add({ targets: ring, scaleX: 28, scaleY: 18, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
        break;
      }
      case 'harp': {
        for (let i = 0; i < 9; i++) {
          const n = this.add.text(p.x + Phaser.Math.Between(-30, 30), p.y - 40, Phaser.Utils.Array.GetRandom(['♪', '♫']), {
            fontFamily: FONT, fontSize: '14px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2,
          }).setOrigin(0.5).setDepth(950).setAlpha(0);
          this.tweens.add({ targets: n, alpha: 1, y: n.y - 60 - i * 6, x: n.x + Phaser.Math.Between(-40, 40), delay: i * 90, duration: 900, onComplete: () => n.destroy() });
        }
        const ring = this.add.ellipse(p.x, p.y, 20, 8).setStrokeStyle(2, 0xffe27a, 1).setDepth(898);
        this.tweens.add({ targets: ring, scaleX: 26, scaleY: 16, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
        break;
      }
      case 'stealthStart': this.buildStealth(e.section, e.run); break;
      case 'took': for (const m of this.stealthView!.goals[e.i]) m.destroy(); break;
      case 'caught':
        this.pop('들켰다!', e.x, e.y - 80, true);
        sfx.bark();
        this.cameras.main.flash(250, 255, 255, 255);
        break;
      case 'stealthDone':
        this.shade.setFillStyle(0x000000, 0);
        for (const s of this.stealthView!.sentries) s.mark.setText('');
        this.stealthView = null;
        break;
      case 'captives':
        for (const b of this.sim.bound) {
          const rope = this.add.graphics().setDepth(b.c.y + 11);
          rope.lineStyle(2, 0x8a6a40, 1).lineBetween(b.x - 9, b.c.y - 24, b.x + 9, b.c.y - 14).lineBetween(b.x - 9, b.c.y - 14, b.x + 9, b.c.y - 24);
          this.boundImgs.set(b, {
            rope,
            img: this.show(this.add.image(b.x, b.c.y, 'shadow'), this.tex(b.c.who, 'tied', 0)).setDepth(b.c.y + 10),
            arrow: this.add.text(b.x, b.c.y - 44, '▼', { fontFamily: FONT, fontSize: '11px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(961),
          });
        }
        break;
      case 'freed': {
        const b = e.b, v = this.boundImgs.get(b)!;
        v.rope.destroy(); v.arrow.destroy();
        this.show(v.img, this.tex(b.c.who, 'idle', 0));
        this.say(b.c.who === 'child' ? '다윗 아저씨!' : '고마워요!', b.x, b.c.y - 50);
        sfx.harp();
        this.tweens.add({ targets: v.img, x: b.x - 260, duration: 1600, onComplete: () => v.img.destroy() }); // runs back toward Ziklag
        this.boundImgs.delete(b);
        break;
      }
      case 'ended': {
        const stage = this.sim.stage;
        this.tweens.killTweensOf(this.texts.banner);
        if (e.how === 'clear') {
          this.registry.set('score', this.sim.score);
          this.texts.banner.setText('STAGE CLEAR').setAlpha(1);
          this.texts.sub.setText(stage.sheep ? `지킨 양 ${e.kept} / ${stage.sheep} · 보너스 +${e.bonus}` : '');
        } else {
          this.texts.banner.setText('다윗이 쓰러졌다').setAlpha(1);
          this.texts.sub.setText('공격 또는 점프로 이 구간부터 다시');
        }
        break;
      }
    }
  }

  private pop(text: string, x: number, y: number, big: boolean) {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: big ? '20px' : '15px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(950).setAngle(Phaser.Math.Between(-12, 6)).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, y: y - 10, duration: 90, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 260, duration: 160, onComplete: () => t.destroy() });
  }

  private say(text: string, x: number, y: number) {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 })
      .setOrigin(0.5).setDepth(950);
    this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, delay: 450, duration: 250, onComplete: () => t.destroy() });
  }

  private impact(x: number, y: number, big: boolean) {
    const s = this.add.image(x, y, big ? 'sparkBig' : 'spark').setDepth(900).setAngle(Phaser.Math.Between(0, 3) * 22.5);
    this.time.delayedCall(big ? 110 : 80, () => s.destroy());
  }

  private tip(text: string, ms: number) {
    this.texts.hint.setText(text).setAlpha(1);
    this.tweens.killTweensOf(this.texts.hint);
    this.tweens.add({ targets: this.texts.hint, alpha: 0, delay: ms, duration: 600 });
  }

  private struck(t: Actor, out: HitOutcome, dir: 1 | -1) {
    const heavy = out.look === 'heavy', boss = out.boss;
    const beast = !!t.kind && isBeast(t.kind);
    const hx = out.at.x - dir * 4, hy = t.y - out.at.z - (beast ? (boss ? 24 : 14) : 26) * KB;
    this.impact(hx, hy, heavy);
    if (out.reaction === 'down') this.cameras.main.shake(boss && out.ko ? 400 : 140, boss ? 0.014 : 0.009);
    else if (out.reaction === 'hurt') this.cameras.main.shake(60, 0.003);
    if (t === this.sim.player) { sfx.hurt(); return; }
    (heavy ? sfx.heavy : sfx.hit)();
    this.pop(heavy ? Phaser.Utils.Array.GetRandom(['빡!!', '콰직!', '쾅!']) : Phaser.Utils.Array.GetRandom(['퍽!', '딱!', '탁!']), hx + dir * 6, hy - 14, heavy);
    if (boss && out.ko) this.pop('목자의 승리!', t.x, t.y - 90, true);
  }

  private goliathStruck(e: Actor, out: HitOutcome, dir: 1 | -1) {
    const K = KB * 1.6;
    if (out.look === 'blocked') {
      this.impact(e.x - dir * 14, e.y - 24 * K, false);
      this.pop('팅!', e.x - dir * 20, e.y - 30 * K, false);
      sfx.clank();
    } else if (out.look === 'crit') {
      const fx = e.x + e.facing * 11 * K, fy = e.y - 33 * K; // forehead while bent over
      this.impact(fx, fy, true);
      this.pop('명중!!', fx, fy - 18, true);
      this.cameras.main.shake(260, 0.014);
      sfx.heavy();
    } else {
      this.impact(e.x - dir * 10, e.y - 24 * K, false);
      this.pop(Phaser.Utils.Array.GetRandom(['퍽!', '딱!']), e.x - dir * 16, e.y - 30 * K, false);
      sfx.hit();
    }
  }

  /* ---------- stealth: En-gedi cave, Ziph camp (1 Sam 24, 26) ---------- */
  private buildStealth(sec: Section, run: StealthRun) {
    const st = sec.stealth!, at = sec.at;
    this.shade.setFillStyle(st.mood === 'night' ? 0x0a0c30 : 0x1a1008, st.mood === 'night' ? 0.5 : 0.3);
    if (st.mood === 'cave') {
      // rock ceiling with stalactites over the whole section: this is En-gedi's cave, not open desert
      const rock = this.add.graphics().setDepth(1400);
      rock.fillStyle(0x3a2a24, 1).fillRect(at, 0, 480, 96);
      for (let x = at; x < at + 480; x += 16) rock.fillTriangle(x, 96, x + 16, 96, x + 8, 104 + ((x * 7) % 23));
      rock.fillStyle(0x5a4234, 1).fillRect(at, 0, 480, 6);
      for (let x = at + 30; x < at + 480; x += 70) rock.fillStyle(0x2a1e18, 1).fillTriangle(x, 96, x + 10, 96, x + 5, 140);
      rock.fillStyle(0x3a2a24, 1).fillRect(at + 452, 96, 28, 170);
    }
    // Saul asleep / resting, never to be harmed
    this.show(this.add.image(at + st.saul.x, st.saul.y, 'shadow'), this.tex('saul', 'hurt', 0, true)).setDepth(st.saul.y + 10);
    this.add.text(at + st.saul.x - 10, st.saul.y - 40, 'Zz', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setDepth(960);
    const view: StealthView = { sentries: [], goals: [] };
    for (const { g } of run.sentries) {
      const key = g.asleep ? this.tex('guard', 'hurt', 0, true) : this.tex('guard', 'idle', 0);
      if (g.asleep) this.add.text(at + g.x - 6, g.y - 30, 'Zz', { fontFamily: FONT, fontSize: '10px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setDepth(960);
      view.sentries.push({
        spr: this.show(this.add.image(at + g.x, g.y, 'shadow'), key).setDepth(g.y + 10),
        mark: this.add.text(at + g.x, g.y - 70, '', { fontFamily: FONT, fontSize: '16px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 3 }).setOrigin(0.5).setDepth(960),
      });
    }
    for (const { g } of run.goals) {
      const x = at + g.x, marks: Phaser.GameObjects.GameObject[] = [];
      if (g.kind === 'spear') marks.push(this.add.image(x, g.y, 'stealthSpear').setOrigin(0.5, 1).setDepth(g.y + 9));
      if (g.kind === 'jug') marks.push(this.add.image(x, g.y, 'jug').setOrigin(0.5, 1).setDepth(g.y + 9));
      marks.push(this.add.text(x, g.y - (g.kind === 'spear' ? 66 : 26), '▼', { fontFamily: FONT, fontSize: '11px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(961));
      view.goals.push(marks);
    }
    this.stealthView = view;
  }

  /** Guards walking their beat with a ?/! over their heads, the bobbing marks over what's left to take. */
  private drawStealth(T: number) {
    const run = this.sim.stealthRun, v = this.stealthView;
    if (!run || !v) return;
    run.sentries.forEach((s, i) => {
      const { spr, mark } = v.sentries[i];
      if (!s.g.asleep) {
        this.show(spr, this.tex('guard', s.wait > 0 ? 'idle' : 'walk', s.wait > 0 ? Math.floor(T * 2.5) % 2 : Math.floor(T * 6) % 4))
          .setFlipX(s.facing < 0).setPosition(Math.round(s.x), s.y);
      }
      mark.setPosition(s.x, s.y - (s.g.asleep ? 34 : 70)).setText(s.meter >= 1 ? '!' : s.meter > 0 ? '?' : '').setColor(s.meter > 0.5 ? '#ff7a6a' : '#ffe27a');
    });
    run.goals.forEach((g, i) => { if (!g.done) (v.goals[i][v.goals[i].length - 1] as Txt).setY(g.g.y - (g.g.kind === 'spear' ? 66 : 26) - Math.abs(Math.sin(T * 6)) * 4); });
  }

  /** On the floor: stealth sight cones, red warning lines before strong attacks, Goliath's shockwave. */
  private drawFloorFx(T: number) {
    const s = this.sim;
    this.fxg.clear();
    for (const g of s.stealthRun?.sentries ?? []) {
      if (g.g.asleep) continue;
      const far = g.x + g.facing * SIGHT_RANGE, spread = 8 + SIGHT_RANGE * 0.22;
      const col = g.meter > 0.5 ? 0xff5a4a : 0xffe27a;
      this.fxg.fillStyle(col, 0.34).fillTriangle(g.x, g.y - 2, far, g.y - spread, far, g.y + spread);
      this.fxg.lineStyle(1, col, 0.9).strokeTriangle(g.x, g.y - 2, far, g.y - spread, far, g.y + spread);
    }
    if (Math.floor(T * 12) % 2) {
      for (const w of telegraphs(s.enemies, s.camX)) {
        this.fxg.fillStyle(0xe63c3c, w.strong ? 0.45 : 0.28).fillRect(Math.min(w.x0, w.x1), w.y - w.half, Math.abs(w.x1 - w.x0), w.half * 2);
        const a = w.arrows;
        if (a) for (let i = 0; i < a.n; i++) { const cx = a.from + i * a.step; this.fxg.fillStyle(0xffd0c8, 1).fillTriangle(cx, w.y - 4, cx, w.y + 4, cx + a.dir * a.size, w.y); }
      }
    }
    const q = s.quake;
    if (q) {
      const r = q.t * 420;
      this.fxg.lineStyle(3, 0xc7a26a, 1 - q.t * 2).strokeEllipse(q.x, q.y, r * 2, r * 0.5);
      this.fxg.lineStyle(2, 0xffffff, 0.8 - q.t * 1.6).strokeEllipse(q.x, q.y, r * 2 - 10, r * 0.5 - 3);
    }
  }

  /** Above the sprites: stars over harp-soothed enemies, the target on Goliath's forehead while he's open. */
  private drawOverheadFx(T: number) {
    this.topfx.clear();
    for (const e of this.sim.enemies) {
      if (e.stun && e.state !== 'down') {
        const k = KB * (def(e).scale ?? 1), hy = e.y - (isBeast(e.id) ? 30 : 50) * k;
        for (let i = 0; i < 3; i++) { const a = T * 5 + i * 2.1; this.topfx.fillStyle(0xffe27a, 1).fillRect(Math.round(e.x + Math.cos(a) * 9) - 1, Math.round(hy + Math.sin(a) * 2.5), 3, 1).fillRect(Math.round(e.x + Math.cos(a) * 9), Math.round(hy + Math.sin(a) * 2.5) - 1, 1, 3); }
      }
    }
    const e = this.sim.enemies.find(o => o.g && standing(o)), K = KB * 1.6;
    if (e?.g?.mode === 'stuck' && Math.floor(T * 10) % 2) {
      const fx = e.x + e.facing * 11 * K, fy = e.y - 33 * K;
      this.topfx.lineStyle(2, 0xf2c14e, 1).strokeCircle(fx, fy, 7).fillStyle(0xfff2b0, 0.6).fillCircle(fx, fy, 3);
    }
  }

  /* ---------- HUD ---------- */
  private buildHud() {
    if (!this.textures.exists('hud')) this.textures.createCanvas('hud', 480, 270);
    this.hud = this.textures.get('hud') as Phaser.Textures.CanvasTexture;
    this.add.image(0, 0, 'hud').setOrigin(0).setScrollFactor(0).setDepth(2000);
    const t = (x: number, y: number, size: number, color = '#ffffff') =>
      this.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#0d0a14', strokeThickness: 2 })
        .setScrollFactor(0).setDepth(2001);
    t(44, 5, 12).setText('다윗');
    this.texts = {
      score: t(240, 6, 9).setOrigin(0.5, 0),
      sheep: t(240, 18, 10, '#f3ecd9').setOrigin(0.5, 0),
      ally: t(8, 44, 9, '#d8f0f0'),
      enemy: t(332, 5, 11),
      go: t(452, 120, 14, '#f2c14e').setOrigin(1, 0.5),
      hint: t(240, 56, 10, '#fff6de').setOrigin(0.5, 0).setWordWrapWidth(440).setAlign('center'),
      boss: t(108, 243, 11),
      banner: t(240, 118, 22, '#f2c14e').setOrigin(0.5),
      sub: t(240, 142, 10).setOrigin(0.5),
    };
    this.texts.go.setText('GO ▶');
  }

  private drawHud(T: number) {
    const sim = this.sim, stage = sim.stage, g = this.hud.getContext();
    g.clearRect(0, 0, 480, 270);
    frame(g, 4, 4, 152, 38);
    R(g, 8, 8, 30, 30, '#0d0a14'); R(g, 9, 9, 28, 28, '#3b2f55');
    const s = frameOf('david', 'idle', 0, 1);
    g.drawImage(s.c, s.ox + 1 - 14, s.oy - 35 - 13, 28, 28, 9, 9, 28, 28);
    bar(g, 44, 22, 104, 6, sim.player.hp / sim.player.maxHp, '#6cc46a', '#b2eda6');
    const full = sim.faith >= FAITH_MAX;
    bar(g, 44, 32, 72, 4, sim.faith / FAITH_MAX, full && Math.floor(T * 8) % 2 ? '#fff2b0' : C.gold, '#fff2b0');
    // stones left; dimmed while the sling cools down
    for (let i = 0; i < STONE_MAX; i++) {
      const has = i < sim.ammo;
      D(g, 122 + i * 7, 34, 3, '#0d0a14'); D(g, 122 + i * 7, 34, 2, has ? (sim.slingCd > 0 ? C.stoneD : C.stone) : '#3a2c4a');
      if (has && sim.slingCd <= 0) R(g, 121 + i * 7, 33, 2, 1, '#ffffff');
    }
    const boss = sim.enemies.find(e => e.kind && def(e).boss && e.state !== 'dead');
    const e = sim.lastHit;
    const showEnemy = e && e !== boss && e.state !== 'dead' && this.fighters.has(e);
    if (showEnemy) { frame(g, 324, 4, 152, 26); bar(g, 332, 19, 136, 5, e.hp / e.maxHp, '#e0574f', '#ffa59a'); }
    const saul = sim.enemies.find(o => o.kind === 'saul');
    const [bx, by, bw] = this.sys.game.device.input.touch ? [160, 28, 160] : [100, 239, 280];
    if (boss) { frame(g, bx, by, bw, 28); bar(g, bx + 8, by + 17, bw - 16, 6, Math.max(0, boss.hp) / boss.maxHp, '#e0574f', '#ffa59a'); }
    else if (saul) { frame(g, bx, by, bw, 28); bar(g, bx + 8, by + 17, bw - 16, 6, sim.saulDodged / SAUL_DODGES, C.gold, '#fff2b0'); }
    this.texts.boss.setPosition(bx + 8, by + 4).setFontSize(bw < 200 ? 9 : 11);
    this.hud.refresh();
    this.texts.enemy.setText(showEnemy ? e.name : '');
    this.texts.boss.setText(boss ? (boss.g ? '골리앗 · 가드 사람, 키 여섯 규빗 한 뼘' : boss.name) : saul ? `사울 왕의 창 · 피한 횟수 ${Math.min(sim.saulDodged, SAUL_DODGES)} / ${SAUL_DODGES}` : '');
    this.texts.score.setText('SCORE ' + String(sim.score).padStart(7, '0'));
    this.texts.sheep.setText(stage.sheep ? `양 ${sim.flock.length} / ${stage.sheep}` : '');
    this.texts.ally.setText(!stage.allies ? '' : sim.allyCd > 0 ? `동료 ${Math.ceil(sim.allyCd)}초` : (this.sys.game.device.input.touch ? '동료 호출 가능' : '동료 호출 가능 (G)'));
    this.ctl.setSpecialReady(full);
  }
}

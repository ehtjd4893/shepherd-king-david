import Phaser from 'phaser';
import {
  frameOf, downOf, whiteOf, isBeast, shadowCanvas, sparkCanvas, stoneCanvas, pickupCanvas, sheepFrame, arrowCanvas, spearCanvas,
  bgElah, bgField, bgGibeah, bgWild, bgKeilah, bgZiklag, bgJebus, bgZion, KB, frame, bar, R, D, C,
} from './art.ts';
import {
  hits, spinCost, brookShouldDrop, swordify, ALLY_COOLDOWN, ALLY_SPEED, ALLY_RUSH, ARROW_SPEED, SPEAR_SPEED, SAUL_DODGES, SHOT_BOX, HARP, GOLIATH_SWEEP, GOLIATH_SLAM_DMG, COMBO, DASH_ATTACK, JUMP_ATTACK, SLING_STONE, SPIN, ENEMIES, FLOOR_TOP, FLOOR_BOTTOM, GRAV,
  SPECIAL_DMG, FAITH_MAX, STONE_MAX, type Attack, type Spawn, type EnemyDef, type Section, type Captive,
} from './combat.ts';
import { resolveHit, standing, vulnerable, hittable, type HitOutcome } from './hit.ts';
import { advance, startAt, cameraTarget, betweenFights, verdict, type Prog } from './progress.ts';
import { startStealth, stepStealth, entry, SIGHT_RANGE, type StealthRun, type StealthEvent } from './stealth.ts';
import { think, arrive, telegraphs, startAttack, physicsDown, slide, type Actor, type SheepBody, type GMode, type World, type Intent } from './fighters.ts';
import { Controls } from './controls.ts';
import { STAGES, type StageDef } from './stages.ts';
import { sfx } from './sfx.ts';
import { writeSave } from './save.ts';

const WALK_X = 125, WALK_Y = 80, RUN_X = 220, JUMP_V = 240;
const SLING_COOLDOWN = 0.8, STONE_SPEED = 460;
const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
// the sling throw: [pose, frame, seconds]; the stone leaves at the start of 'release'
const SLING_SEQ: [string, number, number][] = [['sling', 0, 0.05], ['sling', 2, 0.05], ['wind', 0, 0.05], ['release', 0, 0.08], ['follow', 0, 0.08]];
const SLING_RELEASE = 0.15, SLING_DUR = 0.31, SPECIAL_DUR = 0.55;
const DROP_EVERY = 2, PICKUP_LIFE = 9; // every 2nd knockout drops a stone; it lies there 9 s
const SHEEP_BONUS = 1000;

/** David or an enemy, plus what draws it. */
interface Fighter extends Actor { spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }
interface Stone { x: number; y: number; z: number; dir: 1 | -1; img: Phaser.GameObjects.Image }
/** Enemy projectile: an archer's arrow or Saul's spear. */
interface Shot { x: number; y: number; z: number; dir: 1 | -1; speed: number; dmg: number; knock: boolean; spear: boolean; passed: boolean; img: Phaser.GameObjects.Image }
/** Adullam companion charging across the screen. */
interface Rusher { id: string; x: number; y: number; hitSet: Set<Actor>; spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }
/** What the scene draws for a stealth section (the state itself is a StealthRun): a sprite and a ?/! mark per guard, the marks over each goal. */
interface StealthView { sentries: { spr: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Text }[]; goals: Phaser.GameObjects.GameObject[][] }
/** A captive in the Amalekite camp, freed by walking up and pressing attack. */
interface Bound { c: Captive; x: number; done: boolean; img: Phaser.GameObjects.Image; rope: Phaser.GameObjects.Graphics; arrow: Phaser.GameObjects.Text }
interface Pickup { x: number; y: number; t: number; img: Phaser.GameObjects.Image; arrow: Phaser.GameObjects.Text }
interface Sheep extends SheepBody { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }

export class StageScene extends Phaser.Scene {
  private stageId = 'field';
  private stage!: StageDef;
  private ctl!: Controls;
  private player!: Fighter;
  private enemies: Fighter[] = [];
  private stones: Stone[] = [];
  private pickups: Pickup[] = [];
  private flock: Sheep[] = [];
  private sheepLost = 0;
  private ammo = STONE_MAX;
  private kos = 0;
  private spinRing: Phaser.GameObjects.Ellipse | null = null;
  private fxg!: Phaser.GameObjects.Graphics; // floor effects (warning line, shockwave)
  private topfx!: Phaser.GameObjects.Graphics; // above sprites (Goliath's forehead)
  private quake: { x: number; y: number; t: number; hit: boolean } | null = null;
  private bubble: Phaser.GameObjects.Text | null = null;
  private brookT = 0;
  private shots: Shot[] = [];
  private rushers: Rusher[] = [];
  private allyCd = 0;
  private stealthRun: StealthRun | null = null;
  private stealthView: StealthView | null = null;
  private stealthEvents: StealthEvent[] = []; // this frame's (the dev bot counts catches from these)
  private bound: Bound[] = [];
  private shade!: Phaser.GameObjects.Rectangle;
  private saulDodged = 0;
  private royalWarnAt = -9;
  private prog: Prog = { section: 0, wave: 0, locked: false, done: false };
  private camX = 0;
  private hitstop = 0;
  private atkBuf = 0; // remembers an attack press (incl. during hitstop) for a short window
  private slingCd = 0;
  private faith = 0;
  private time0 = 0;
  private score = 0;
  private hintsShown = 0;
  private lastHit: Fighter | null = null;
  private origins = new Map<string, [number, number]>();
  private hud!: Phaser.Textures.CanvasTexture;
  private texts!: Record<'score' | 'enemy' | 'banner' | 'sub' | 'go' | 'hint' | 'boss' | 'sheep' | 'ally', Phaser.GameObjects.Text>;
  private ended: 'clear' | 'dead' | null = null;
  private endAt = 0;

  constructor() { super('stage'); }

  private startSection = 0; // > 0 when retrying after a fall: start at that section, not the whole stage

  init(data: { stage?: string; section?: number }) { this.stageId = data.stage ?? 'field'; this.startSection = data.section ?? 0; }

  create() {
    this.stage = STAGES[this.stageId];
    this.enemies = []; this.stones = []; this.pickups = []; this.flock = [];
    this.ammo = this.stage.ammo ?? STONE_MAX; this.kos = 0; this.sheepLost = 0; this.hintsShown = 0;
    this.quake = null; this.bubble = null; this.brookT = 0; this.shots = []; this.saulDodged = 0; this.royalWarnAt = -9; this.rushers = []; this.allyCd = 0; this.stealthRun = null; this.stealthView = null; this.bound = [];
    this.spinRing = null;
    this.hitstop = this.time0 = this.atkBuf = this.slingCd = 0;
    const start = startAt(this.stage, this.startSection);
    this.prog = start.prog; this.camX = start.camX; this.hintsShown = start.hintsShown;
    this.score = (this.registry.get('score') as number) ?? 0;
    writeSave({ stage: this.stageId, score: this.score }); // continue from here next time
    this.faith = 40;
    this.lastHit = null;
    this.ended = null;

    const once = (key: string, make: () => HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); };
    const bgKey = `bg_${this.stage.bg}`;
    once(bgKey, () => ({ field: bgField, elah: bgElah, gibeah: bgGibeah, wild: bgWild, keilah: bgKeilah, ziklag: bgZiklag, jebus: bgJebus, zion: bgZion })[this.stage.bg](this.stage.width));
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
    this.cameras.main.setBounds(0, 0, this.stage.width, 270);

    this.fxg = this.add.graphics().setDepth(2);
    this.shade = this.add.rectangle(0, 0, 480, 270, 0x0a0c30, 0).setOrigin(0).setScrollFactor(0).setDepth(1500);
    this.topfx = this.add.graphics().setDepth(940);
    const startX = start.playerX;
    this.player = this.makeFighter(this.stage.sword ? 'davidS' : 'david', '다윗', startX, 210, 100);
    for (let i = 0; i < this.stage.sheep; i++) {
      const x = startX - 30 - (i % 3) * 18, y = 186 + ((i * 13) % 50);
      this.flock.push({ i, x, y, facing: 1, moving: false, carrier: null, img: this.add.image(x, y, 'shadow'), shadow: this.add.image(x, y, 'shadow').setDepth(1).setScale(0.8, 1) });
    }
    this.ctl = new Controls(this);
    this.ctl.setButton('ally', !!this.stage.allies);
    this.buildHud();
    if (!this.stage.noBanner || this.startSection) {
      this.texts.banner.setText(this.startSection ? '다시 한 번!' : this.stage.title).setAlpha(1);
      this.tweens.add({ targets: this.texts.banner, alpha: 0, delay: 1600, duration: 500 });
    }
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

  private makeFighter(id: string, name: string, x: number, y: number, hp: number): Fighter {
    const shadow = this.add.image(x, y, 'shadow').setDepth(1);
    const spr = this.add.image(x, y, this.tex(id, 'idle', 0));
    return { id, name, x, y, z: 0, vx: 0, vz: 0, facing: 1, hp, maxHp: hp, state: 'idle', t: 0, inv: 0, flash: 0, combo: 0, queued: false, hitSet: new Set(), airAtk: false, spr, shadow };
  }

  private def(e: Fighter): EnemyDef { return ENEMIES[e.kind ?? 'philA']; }

  private spawn(list: Spawn[]) {
    for (const s of list) {
      const kind = s.t ?? 'philA', d: EnemyDef = ENEMIES[kind];
      const e = this.makeFighter(kind, d.name, this.camX + s.x, s.y, d.hp);
      e.kind = kind;
      arrive(e, s, list, this.camX, this.enemies, () => Math.random());
      if (e.g) {
        e.shadow.setScale(2.6, 1.6);
        // speech bubble at his mouth, clear of the tip line above
        this.bubble = this.add.text(this.camX + s.x - 34, s.y - 84, '와 봐라, 꼬마야! 네 살을 새들에게 주겠다!', {
          fontFamily: FONT, fontSize: '10px', color: '#1c1226', backgroundColor: '#ffffff', padding: { x: 5, y: 3 },
        }).setOrigin(1, 1).setDepth(960);
      }
      if (isBeast(kind)) e.shadow.setScale(d.hw / 8, 1.2);
      this.enemies.push(e);
      if (d.boss) {
        this.cameras.main.shake(500, 0.01);
        sfx.roar();
        this.pop(kind === 'lion' ? '크아앙!!' : '크르릉!!', this.camX + 380, 120, true);
      } else if (kind === 'jackal') sfx.bark();
    }
  }

  private pose(f: Fighter, T: number): [string, number, boolean] {
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
        if (f === this.player) return [a.pose === 'atk2' && f.t < a.active[0] ? 'atk2a' : a.pose, 0, false];
        if (f.z > 2 && a.leap) return ['leap', 0, false];
        if (a.keep && f.t >= a.active[0]) return ['walk', Math.floor(T * 18) % 4, false]; // charging
        return [f.t < a.active[0] ? 'atkA' : 'atk', 0, false];
      }
      case 'hurt': case 'getup': return ['hurt', 0, false];
      case 'down': case 'dead': return ['hurt', 0, f.z <= 0 && f.vz <= 0];
      default: return [f.stun ? 'hurt' : 'idle', fr2, false];
    }
  }

  private draw(f: Fighter, T: number) {
    const [anim, fr, lying] = this.pose(f, T);
    const k = KB * (f.kind ? this.def(f).scale ?? 1 : 1);
    const key = this.tex(f.id, anim, fr, lying, f.flash > 0, k);
    const o = this.origins.get(key)!;
    f.spr.setTexture(key).setOrigin(o[0], o[1]).setFlipX(f.facing < 0)
      .setPosition(Math.round(f.x), Math.round(f.y - f.z)).setDepth(f.y + 10);
    const blink = ((f.state === 'dead' && !f.g) || f.inv > 0) && Math.floor(T * 14) % 2 === 0;
    f.spr.setVisible(!blink);
    if (f.g) return; // Goliath's shadow is fixed size
    const base = f.kind && isBeast(f.kind) ? this.def(f).hw / 8 : 1;
    f.shadow.setPosition(Math.round(f.x), Math.round(f.y)).setScale((lying ? 1.5 : 1 - Math.min(f.z, 60) / 150) * base, 1);
  }

  /* ---------- feedback ---------- */
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

  /* ---------- combat ---------- */
  private playerAttack(a: Attack) {
    startAttack(this.player, a);
    sfx.swing();
  }

  /** The rules live in resolveHit (hit.ts); this plays what it says happened. */
  private applyHit(target: Fighter, a: Attack, dir: 1 | -1, special = false, src: 'staff' | 'stone' = 'staff') {
    const out = resolveHit(target, a, dir, { hitstop: this.hitstop, score: this.score, faith: this.faith }, { special, src });
    ({ hitstop: this.hitstop, score: this.score, faith: this.faith } = out.m);
    target.flash = 0.07;
    if (target !== this.player) this.lastHit = target;
    const K = KB * 1.6; // Goliath's scale
    for (const ev of out.events) {
      switch (ev.type) {
        case 'reinforce': this.spawn(ev.spawns); this.pop(ev.shout, this.camX + 240, 90, true); break;
        case 'stoneBounced': this.dropStone(target.x - dir * 34, target.y); break; // bounced off the bronze: pick it up again
        case 'struck': if (target.g) this.goliathStruck(target, out, dir); else this.struck(target, out, dir); break;
        case 'sheepDropped': this.say('음매~', ev.x, ev.y - 34); sfx.baa(); break;
        case 'hint': this.say(ev.text, this.player.x, this.player.y - 70); break;
        case 'enraged':
          sfx.roar();
          this.cameras.main.shake(400, 0.01);
          this.pop('크아아!!', target.x, target.y - 50 * K, true);
          this.spawn(ev.spawns);
          break;
        case 'goliathDown':
          this.cameras.main.flash(300, 255, 255, 255);
          this.cameras.main.shake(600, 0.02);
          this.pop('골리앗이 쓰러졌다!', target.x, target.y - 70 * K, true);
          for (const o of this.enemies) if (o !== target && o.state !== 'dead') o.flee = true;
          this.bubble?.destroy(); this.bubble = null;
          break;
      }
    }
  }

  private struck(t: Fighter, out: HitOutcome, dir: 1 | -1) {
    const heavy = out.look === 'heavy', boss = out.boss;
    const beast = !!t.kind && isBeast(t.kind);
    const hx = out.at.x - dir * 4, hy = t.y - out.at.z - (beast ? (boss ? 24 : 14) : 26) * KB;
    this.impact(hx, hy, heavy);
    if (out.reaction === 'down') this.cameras.main.shake(boss && out.ko ? 400 : 140, boss ? 0.014 : 0.009);
    else if (out.reaction === 'hurt') this.cameras.main.shake(60, 0.003);
    if (t === this.player) { sfx.hurt(); return; }
    (heavy ? sfx.heavy : sfx.hit)();
    this.pop(heavy ? Phaser.Utils.Array.GetRandom(['빡!!', '콰직!', '쾅!']) : Phaser.Utils.Array.GetRandom(['퍽!', '딱!', '탁!']), hx + dir * 6, hy - 14, heavy);
    if (boss && out.ko) this.pop('목자의 승리!', t.x, t.y - 90, true);
  }

  private goliathStruck(e: Fighter, out: HitOutcome, dir: 1 | -1) {
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

  private hitEnemies(a: Attack, dirFrom?: number) {
    const p = this.player;
    if (this.stage.sword) a = swordify(a);
    for (const e of this.enemies) {
      if (p.hitSet.has(e)) continue;
      if (!hittable(e, this.def(e))) {
        if (this.def(e).untouchable && standing(e) && hits(p, a.box, { x: e.x, y: e.y, z: e.z, hw: 10 })) this.royalWarning(e);
        continue;
      }
      if (hits(p, a.box, { x: e.x, y: e.y, z: e.z, hw: this.def(e).hw })) {
        p.hitSet.add(e);
        this.applyHit(e, a, dirFrom === undefined ? p.facing : (e.x >= dirFrom ? 1 : -1));
      }
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player, c = this.ctl;
    p.inv = Math.max(0, p.inv - dt);
    const attack = this.atkBuf > 0;
    this.atkBuf = Math.max(0, this.atkBuf - dt);
    const free = p.state === 'idle' || p.state === 'walk' || p.state === 'run';

    if (free && c.special && this.faith >= FAITH_MAX) { if (this.stage.harp) this.startHarp(); else this.startSpecial(); }
    else if ((free || p.state === 'attack' || p.state === 'hurt') && c.spin) this.startSpin();
    else if (c.ally && this.stage.allies) this.callAllies();
    else if ((free || p.state === 'jump') && c.sling && this.slingCd <= 0 && !p.airAtk) {
      if (this.ammo > 0) {
        p.state = 'sling'; p.t = 0; p.vx = 0; this.slingCd = SLING_COOLDOWN; this.ammo--;
        if (this.ammo === 0 && this.stage.brook) this.tip('돌을 다 썼다! 반짝이는 ▼ 돌을 주우세요');
      }
      else this.say('돌이 없다!', p.x, p.y - p.z - 66);
    }

    switch (p.state) {
      case 'idle': case 'walk': case 'run': {
        if (c.x) p.facing = c.x as 1 | -1;
        const running = c.run && c.x !== 0;
        p.x += c.x * (running ? RUN_X : WALK_X) * dt; p.y += c.y * WALK_Y * dt;
        p.state = running ? 'run' : c.x || c.y ? 'walk' : 'idle';
        if (attack) {
          this.atkBuf = 0;
          if (running) this.playerAttack(DASH_ATTACK);
          else { p.combo = 0; this.playerAttack(COMBO[0]); }
        } else if (c.jump) {
          p.vx = running ? c.x * RUN_X : c.x * WALK_X;
          p.state = 'jump'; p.vz = JUMP_V; p.z = 0.01; p.airAtk = false; p.hitSet.clear(); sfx.jump();
        }
        break;
      }
      case 'jump':
        if (c.x) { p.facing = c.x as 1 | -1; p.vx = Phaser.Math.Clamp(p.vx + c.x * 600 * dt, -RUN_X, RUN_X); }
        p.x += p.vx * dt; p.y += c.y * WALK_Y * 0.5 * dt;
        p.z += p.vz * dt; p.vz -= GRAV * dt;
        if (attack && !p.airAtk) { this.atkBuf = 0; p.airAtk = true; p.vz = Math.min(p.vz, 40); sfx.swing(); }
        if (p.airAtk) this.hitEnemies(JUMP_ATTACK);
        if (p.z <= 0) {
          p.z = 0; p.vz = 0; p.vx = 0; p.state = 'idle';
          if (p.airAtk) this.cameras.main.shake(70, 0.004);
          p.airAtk = false;
        }
        break;
      case 'attack': {
        const a = p.atk!;
        slide(p, dt);
        if (attack && p.t > a.dur * 0.25) { this.atkBuf = 0; p.queued = true; }
        if (p.t >= a.active[0] && p.t <= a.active[1]) this.hitEnemies(a);
        if (p.t >= a.dur) {
          if (p.queued && a !== DASH_ATTACK && p.combo < COMBO.length - 1) this.playerAttack(COMBO[++p.combo]);
          else { p.state = 'idle'; p.combo = 0; }
        }
        break;
      }
      case 'sling':
        if (p.z > 0 || p.vz > 0) { p.z = Math.max(0, p.z + p.vz * dt); p.vz -= GRAV * dt; }
        if (p.t >= SLING_RELEASE && p.t - dt < SLING_RELEASE) this.throwStone();
        if (p.t >= SLING_DUR && p.z <= 0) { p.state = 'idle'; p.vz = 0; }
        break;
      case 'special':
        if (p.t >= SPECIAL_DUR) p.state = 'idle';
        break;
      case 'harp':
        if (p.t >= HARP.dur) p.state = 'idle';
        break;
      case 'spin': {
        // turn every 0.07 s, drift a little with the stick, hit everyone around once
        const turn = Math.floor(p.t / 0.07);
        if (turn !== Math.floor((p.t - dt) / 0.07)) { p.facing = (p.facing * -1) as 1 | -1; if (turn % 2) sfx.swing(); }
        p.x += c.x * 70 * dt; p.y += c.y * 45 * dt;
        if (p.t >= SPIN.active[0] && p.t <= SPIN.active[1]) this.hitEnemies(SPIN, p.x);
        this.spinRing?.setPosition(p.x, p.y - 20 * KB).setDepth(p.y + 12);
        if (p.t >= SPIN.dur) { p.state = 'idle'; this.spinRing?.destroy(); this.spinRing = null; }
        break;
      }
      case 'hurt': slide(p, dt); if (p.t > 0.25) p.state = 'idle'; break;
      case 'down': case 'dead': physicsDown(p, dt); break;
      case 'getup': if (p.t > 0.25) { p.state = 'idle'; p.inv = 1.0; } break;
    }
    p.y = Phaser.Math.Clamp(p.y, FLOOR_TOP, FLOOR_BOTTOM);
    p.x = Phaser.Math.Clamp(p.x, this.camX + 12, this.camX + 468);
  }

  private startSpin() {
    const p = this.player, cost = spinCost(this.faith, p.hp);
    if (!cost) { this.say('힘이 모자라!', p.x, p.y - p.z - 66); return; }
    this.faith = cost.faith; p.hp = cost.hp;
    p.state = 'spin'; p.t = 0; p.vx = 0; p.z = 0; p.vz = 0; p.hitSet.clear(); p.inv = SPIN.dur;
    this.spinRing?.destroy();
    this.spinRing = this.add.ellipse(p.x, p.y - 20 * KB, 96, 30).setStrokeStyle(3, 0xfff2c0, 0.9);
    this.tweens.add({ targets: this.spinRing, alpha: 0.2, scaleX: 1.15, scaleY: 1.15, duration: SPIN.dur * 1000 });
    this.pop('회오리!', p.x, p.y - 74, true);
    sfx.swing();
  }

  private throwStone() {
    const p = this.player;
    const img = this.add.image(0, 0, 'stone').setOrigin(34 / 40, 0.5).setFlipX(p.facing < 0).setDepth(p.y + 11);
    this.stones.push({ x: p.x + p.facing * 30, y: p.y, z: p.z + 30 * KB, dir: p.facing, img });
    this.pop('슉!', p.x + p.facing * 30, p.y - p.z - 52, false);
    sfx.sling();
  }

  private updateStones(dt: number) {
    for (const s of this.stones) {
      s.x += s.dir * STONE_SPEED * dt;
      for (const e of this.enemies) {
        if (!hittable(e, this.def(e))) continue;
        // the stone flies at hand height; compare against the enemy's body, not its feet
        if (hits({ x: s.x, y: s.y, z: s.z - 26 * KB, facing: s.dir }, SLING_STONE.box, { x: e.x, y: e.y, z: e.z, hw: this.def(e).hw })) {
          this.applyHit(e, SLING_STONE, s.dir, false, 'stone');
          s.x = Infinity;
          break;
        }
      }
      s.img.setPosition(Math.round(s.x), Math.round(s.y - s.z)).setDepth(s.y + 11);
    }
    for (const s of this.stones.filter(s => !isFinite(s.x) || s.x < this.camX - 40 || s.x > this.camX + 520)) s.img.destroy();
    this.stones = this.stones.filter(s => s.img.active);
  }

  private startSpecial() {
    const p = this.player;
    this.faith = 0;
    p.state = 'special'; p.t = 0; p.inv = SPECIAL_DUR + 0.3; p.vx = 0;
    sfx.special();
    this.cameras.main.flash(260, 255, 236, 170);
    // pillar of light on David + expanding ring along the floor
    const pillar = this.add.rectangle(p.x, 0, 34, p.y, 0xffe9a8, 0.55).setOrigin(0.5, 0).setDepth(899);
    const ring = this.add.ellipse(p.x, p.y, 20, 8).setStrokeStyle(3, 0xffe27a, 1).setDepth(898);
    this.tweens.add({ targets: pillar, alpha: 0, scaleX: 2.4, duration: 520, onComplete: () => pillar.destroy() });
    this.tweens.add({ targets: ring, scaleX: 28, scaleY: 18, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
    this.pop('믿음의 일격!', p.x, p.y - 80, true);
    for (const e of this.enemies) {
      if (!hittable(e, this.def(e), true) || e.x < this.camX - 10 || e.x > this.camX + 490) continue; // the strike also lands on enemies already down
      this.applyHit(e, { ...COMBO[2], dmg: SPECIAL_DMG }, e.x >= p.x ? 1 : -1, true);
    }
    this.hitstop = 0.2;
  }

  /* ---------- Ziklag: captives (1 Sam 30) ---------- */
  private setupCaptives(sec: Section) {
    this.bound = sec.captives!.map(c => {
      const x = sec.at + c.x, key = this.tex(c.who, 'tied', 0), o = this.origins.get(key)!;
      const rope = this.add.graphics().setDepth(c.y + 11);
      rope.lineStyle(2, 0x8a6a40, 1).lineBetween(x - 9, c.y - 24, x + 9, c.y - 14).lineBetween(x - 9, c.y - 14, x + 9, c.y - 24);
      return {
        c, x, done: false, rope,
        img: this.add.image(x, c.y, key).setOrigin(o[0], o[1]).setDepth(c.y + 10),
        arrow: this.add.text(x, c.y - 44, '▼', { fontFamily: FONT, fontSize: '11px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(961),
      };
    });
  }

  private updateCaptives(T: number) {
    const p = this.player;
    for (const b of this.bound) {
      if (b.done) continue;
      b.arrow.setY(b.c.y - 44 - Math.abs(Math.sin(T * 6)) * 4);
      if (!this.ctl.attack || Math.abs(b.x - p.x) > 22 || Math.abs(b.c.y - p.y) > 14) continue;
      b.done = true; b.rope.destroy(); b.arrow.destroy();
      const key = this.tex(b.c.who, 'idle', 0), o = this.origins.get(key)!;
      b.img.setTexture(key).setOrigin(o[0], o[1]);
      this.say(b.c.who === 'child' ? '다윗 아저씨!' : '고마워요!', b.x, b.c.y - 50);
      sfx.harp();
      this.tweens.add({ targets: b.img, x: b.x - 260, duration: 1600, onComplete: () => b.img.destroy() }); // runs back toward Ziklag
    }
  }

  /* ---------- Stealth: En-gedi cave, Ziph camp (1 Sam 24, 26) ---------- */
  private setupStealth(sec: Section) {
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
    const sk = this.tex('saul', 'hurt', 0, true), so = this.origins.get(sk)!;
    this.add.image(at + st.saul.x, st.saul.y, sk).setOrigin(so[0], so[1]).setDepth(st.saul.y + 10);
    this.add.text(at + st.saul.x - 10, st.saul.y - 40, 'Zz', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setDepth(960);
    const run = startStealth(sec), view: StealthView = { sentries: [], goals: [] };
    for (const { g } of run.sentries) {
      const key = g.asleep ? this.tex('guard', 'hurt', 0, true) : this.tex('guard', 'idle', 0), o = this.origins.get(key)!;
      if (g.asleep) this.add.text(at + g.x - 6, g.y - 30, 'Zz', { fontFamily: FONT, fontSize: '10px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setDepth(960);
      view.sentries.push({
        spr: this.add.image(at + g.x, g.y, key).setOrigin(o[0], o[1]).setDepth(g.y + 10),
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
    this.stealthRun = run; this.stealthView = view;
    const p = this.player, e = entry(run); p.x = e.x; p.y = e.y; p.state = 'idle'; p.vx = 0;
    this.say('살금살금…', p.x, p.y - 70);
  }

  /** The rules live in stepStealth (stealth.ts); this plays the events and draws the guards. */
  private updateStealth(dt: number, T: number) {
    const run = this.stealthRun, v = this.stealthView!, p = this.player;
    if (!run) return;
    const events = this.stealthEvents = stepStealth(run, dt, p, this.ctl.attack);
    for (const ev of events) {
      if (ev.type === 'caught') this.caught();
      else if (ev.type === 'took') {
        for (const m of v.goals[run.goals.findIndex(g => g.g === ev.goal)]) m.destroy();
        this.pop({ robe: '옷자락을 베었다!', spear: '사울의 창을 챙겼다!', jug: '물병을 챙겼다!' }[ev.goal.kind], p.x, p.y - 80, true);
        sfx.harp();
      }
    }
    run.sentries.forEach((s, i) => {
      const { spr, mark } = v.sentries[i];
      if (!s.g.asleep) {
        const key = this.tex('guard', s.wait > 0 ? 'idle' : 'walk', s.wait > 0 ? Math.floor(T * 2.5) % 2 : Math.floor(T * 6) % 4), o = this.origins.get(key)!;
        spr.setTexture(key).setOrigin(o[0], o[1]).setFlipX(s.facing < 0).setPosition(Math.round(s.x), s.y);
      }
      mark.setPosition(s.x, s.y - (s.g.asleep ? 34 : 70)).setText(s.meter >= 1 ? '!' : s.meter > 0 ? '?' : '').setColor(s.meter > 0.5 ? '#ff7a6a' : '#ffe27a');
    });
    run.goals.forEach((g, i) => { if (!g.done) (v.goals[i][v.goals[i].length - 1] as Phaser.GameObjects.Text).setY(g.g.y - (g.g.kind === 'spear' ? 66 : 26) - Math.abs(Math.sin(T * 6)) * 4); });
    if (events.some(e => e.type === 'done')) {
      // done: everyone stays asleep / at their post; lift the darkness
      this.shade.setFillStyle(0x000000, 0);
      for (const s of v.sentries) s.mark.setText('');
      this.stealthRun = null; this.stealthView = null;
    }
  }

  /** Spotted: back to the start of the section (stepStealth already sent the guards back to their posts). No damage. */
  private caught() {
    const p = this.player, e = entry(this.stealthRun!);
    this.pop('들켰다!', p.x, p.y - 80, true);
    sfx.bark();
    this.cameras.main.flash(250, 255, 255, 255);
    p.x = e.x; p.y = e.y; p.state = 'idle'; p.vx = 0; p.z = 0; p.vz = 0;
    this.tip('들켰다! 다시 살금살금… 노란 시야를 피하고, 잠든 군사 곁에서는 달리지 마세요');
  }

  private drawStealth() {
    const run = this.stealthRun;
    if (!run) return;
    for (const s of run.sentries) {
      if (s.g.asleep) continue;
      const far = s.x + s.facing * SIGHT_RANGE, spread = 8 + SIGHT_RANGE * 0.22;
      const col = s.meter > 0.5 ? 0xff5a4a : 0xffe27a;
      this.fxg.fillStyle(col, 0.34).fillTriangle(s.x, s.y - 2, far, s.y - spread, far, s.y + spread);
      this.fxg.lineStyle(1, col, 0.9).strokeTriangle(s.x, s.y - 2, far, s.y - spread, far, s.y + spread);
    }
  }

  /* ---------- Gibeah: harp, archers, Saul ---------- */
  private startHarp() {
    const p = this.player;
    this.faith = 0;
    p.state = 'harp'; p.t = 0; p.vx = 0; p.inv = HARP.dur + 0.3;
    p.hp = Math.min(p.maxHp, p.hp + HARP.heal);
    sfx.harp();
    this.say(`+${HARP.heal}`, p.x, p.y - 70);
    for (let i = 0; i < 9; i++) {
      const n = this.add.text(p.x + Phaser.Math.Between(-30, 30), p.y - 40, Phaser.Utils.Array.GetRandom(['♪', '♫']), {
        fontFamily: FONT, fontSize: '14px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(950).setAlpha(0);
      this.tweens.add({ targets: n, alpha: 1, y: n.y - 60 - i * 6, x: n.x + Phaser.Math.Between(-40, 40), delay: i * 90, duration: 900, onComplete: () => n.destroy() });
    }
    const ring = this.add.ellipse(p.x, p.y, 20, 8).setStrokeStyle(2, 0xffe27a, 1).setDepth(898);
    this.tweens.add({ targets: ring, scaleX: 26, scaleY: 16, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    this.pop('수금 연주', p.x, p.y - 82, true);
    for (const e of this.enemies) {
      if (!hittable(e, this.def(e)) || e.x < this.camX - 10 || e.x > this.camX + 490) continue;
      e.stun = HARP.stun; e.hp = Math.max(1, e.hp - HARP.dmg); e.flash = 0.07;
      if (e.ai) e.ai.mode = 'approach';
      e.state = 'idle';
    }
  }

  /** Adullam companions charge from the left edge on David's lane and the lanes beside it. */
  private callAllies() {
    const p = this.player;
    if (this.allyCd > 0) { this.say(`동료들이 숨을 고르는 중… ${Math.ceil(this.allyCd)}`, p.x, p.y - 70); return; }
    this.allyCd = ALLY_COOLDOWN;
    ['ally1', 'ally2', 'ally3'].forEach((id, i) => {
      const x = this.camX - 30 - i * 24, y = Phaser.Math.Clamp(p.y + (i - 1) * 18, FLOOR_TOP, FLOOR_BOTTOM);
      this.rushers.push({ id, x, y, hitSet: new Set(), shadow: this.add.image(x, y, 'shadow').setDepth(1), spr: this.add.image(x, y, this.tex(id, 'walk', 0)) });
    });
    this.pop('용사들아, 가자!', p.x, p.y - 80, true);
    sfx.roar();
  }

  private updateRushers(dt: number, T: number) {
    for (const r of this.rushers) {
      r.x += ALLY_SPEED * dt;
      for (const e of this.enemies) {
        if (r.hitSet.has(e) || !hittable(e, this.def(e))) continue;
        if (hits({ x: r.x, y: r.y, z: 0, facing: 1 }, ALLY_RUSH.box, { x: e.x, y: e.y, z: e.z, hw: this.def(e).hw })) { r.hitSet.add(e); this.applyHit(e, ALLY_RUSH, 1); }
      }
      const key = this.tex(r.id, 'walk', Math.floor(T * 18) % 4), o = this.origins.get(key)!;
      r.spr.setTexture(key).setOrigin(o[0], o[1]).setPosition(Math.round(r.x), Math.round(r.y)).setDepth(r.y + 10);
      r.shadow.setPosition(Math.round(r.x), Math.round(r.y));
    }
    for (const r of this.rushers.filter(r => r.x > this.camX + 540)) { r.spr.destroy(); r.shadow.destroy(); }
    this.rushers = this.rushers.filter(r => r.spr.active);
  }

  private royalWarning(e: Fighter) {
    if (this.time0 - this.royalWarnAt < 1.5) return;
    this.royalWarnAt = this.time0;
    this.say('왕에게는 손댈 수 없다!', e.x, e.y - 80);
  }

  private fire(e: Fighter, spear: boolean, lane: number) {
    const img = this.add.image(0, 0, spear ? 'spear' : 'arrow').setOrigin(1, 0.5).setFlipX(e.facing < 0);
    this.shots.push({ x: e.x + e.facing * 26, y: lane, z: 30 * KB, dir: e.facing, speed: spear ? SPEAR_SPEED : ARROW_SPEED, dmg: spear ? 22 : 8, knock: spear, spear, passed: false, img });
    sfx.swing();
  }

  private updateShots(dt: number) {
    const p = this.player;
    for (const s of this.shots) {
      s.x += s.dir * s.speed * dt;
      const open = vulnerable(p);
      if (open && hits({ x: s.x, y: s.y, z: s.z - 26 * KB, facing: s.dir }, SHOT_BOX, { x: p.x, y: p.y, z: p.z, hw: 6 })) {
        this.applyHit(p, { ...COMBO[0], dmg: s.dmg, knock: s.knock }, s.dir);
        s.x = Infinity;
      } else if (s.spear && !s.passed && (s.x - p.x) * s.dir > 24) {
        s.passed = true; this.saulDodged++;
        this.pop(this.saulDodged >= SAUL_DODGES ? '세 번 피했다!' : '피했다!', p.x, p.y - 70, true);
        this.cameras.main.shake(80, 0.004);
      }
      s.img.setPosition(Math.round(s.x), Math.round(s.y - s.z)).setDepth(s.y + 11);
    }
    for (const s of this.shots.filter(s => !isFinite(s.x) || s.x < this.camX - 80 || s.x > this.camX + 560)) s.img.destroy();
    this.shots = this.shots.filter(s => s.img.active);
  }

  /** Floor shockwave from the slam: jump over it. */
  private updateQuake(dt: number) {
    const q = this.quake, p = this.player;
    if (!q) return;
    q.t += dt;
    const r = q.t * 420;
    if (!q.hit && p.z < 4 && vulnerable(p) && Math.abs(p.y - q.y) <= 40 && Math.abs(Math.abs(p.x - q.x) - r) < 14) {
      q.hit = true;
      this.applyHit(p, { ...GOLIATH_SWEEP, dmg: GOLIATH_SLAM_DMG }, p.x >= q.x ? 1 : -1);
    }
    if (q.t > 0.5) this.quake = null;
  }

  /** On the floor: stealth sight cones, red warning lines before strong attacks, Goliath's shockwave. */
  private drawFloorFx(T: number) {
    this.fxg.clear();
    this.drawStealth();
    if (Math.floor(T * 12) % 2) {
      for (const w of telegraphs(this.enemies, this.camX)) {
        this.fxg.fillStyle(0xe63c3c, w.strong ? 0.45 : 0.28).fillRect(Math.min(w.x0, w.x1), w.y - w.half, Math.abs(w.x1 - w.x0), w.half * 2);
        const a = w.arrows;
        if (a) for (let i = 0; i < a.n; i++) { const cx = a.from + i * a.step; this.fxg.fillStyle(0xffd0c8, 1).fillTriangle(cx, w.y - 4, cx, w.y + 4, cx + a.dir * a.size, w.y); }
      }
    }
    const q = this.quake;
    if (q) {
      const r = q.t * 420;
      this.fxg.lineStyle(3, 0xc7a26a, 1 - q.t * 2).strokeEllipse(q.x, q.y, r * 2, r * 0.5);
      this.fxg.lineStyle(2, 0xffffff, 0.8 - q.t * 1.6).strokeEllipse(q.x, q.y, r * 2 - 10, r * 0.5 - 3);
    }
  }

  /** Above the sprites: stars over harp-soothed enemies, the target on Goliath's forehead while he's open. */
  private drawOverheadFx(T: number) {
    this.topfx.clear();
    for (const e of this.enemies) {
      if (e.stun && e.state !== 'down') {
        const k = KB * (this.def(e).scale ?? 1), hy = e.y - (isBeast(e.id) ? 30 : 50) * k;
        for (let i = 0; i < 3; i++) { const a = T * 5 + i * 2.1; this.topfx.fillStyle(0xffe27a, 1).fillRect(Math.round(e.x + Math.cos(a) * 9) - 1, Math.round(hy + Math.sin(a) * 2.5), 3, 1).fillRect(Math.round(e.x + Math.cos(a) * 9), Math.round(hy + Math.sin(a) * 2.5) - 1, 1, 3); }
      }
    }
    const e = this.enemies.find(o => o.g && standing(o)), K = KB * 1.6;
    if (e?.g?.mode === 'stuck' && Math.floor(T * 10) % 2) {
      const fx = e.x + e.facing * 11 * K, fy = e.y - 33 * K;
      this.topfx.lineStyle(2, 0xf2c14e, 1).strokeCircle(fx, fy, 7).fillStyle(0xfff2b0, 0.6).fillCircle(fx, fy, 3);
    }
  }

  /* ---------- sheep ---------- */
  private updateFlock(dt: number, T: number) {
    const p = this.player;
    for (const s of this.flock) {
      if (s.carrier) {
        // dragged behind the thief
        s.x = s.carrier.x - s.carrier.facing * 20; s.y = s.carrier.y + 2; s.facing = s.carrier.facing; s.moving = true;
      } else {
        const tx = Phaser.Math.Clamp(p.x - 54 - (s.i % 3) * 18 + Math.floor(s.i / 3) * 10, this.camX + 16, this.camX + 464);
        const ty = Phaser.Math.Clamp(p.y - 22 + ((s.i * 17) % 44), FLOOR_TOP, FLOOR_BOTTOM);
        const dx = tx - s.x, dy = ty - s.y, far = Math.hypot(dx, dy) > 10;
        s.moving = far;
        if (far) {
          const sp = Math.hypot(dx, dy) > 120 ? 160 : 85;
          s.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
          s.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * 0.6 * dt);
          if (Math.abs(dx) > 2) s.facing = dx > 0 ? 1 : -1;
        }
      }
      const f = s.moving ? Math.floor(T * 8) % 2 : 0, key = `sheep_${f}`;
      if (!this.textures.exists(key)) { const fr = sheepFrame(f); this.textures.addCanvas(key, fr.c); this.origins.set(key, [fr.ox / fr.c.width, fr.oy / fr.c.height]); }
      const o = this.origins.get(key)!;
      s.img.setTexture(key).setOrigin(o[0], o[1]).setFlipX(s.facing < 0).setPosition(Math.round(s.x), Math.round(s.y)).setDepth(s.y + 9);
      s.shadow.setPosition(Math.round(s.x), Math.round(s.y));
    }
  }

  /* ---------- enemies ---------- */
  private world(): World {
    return { player: this.player, enemies: this.enemies, camX: this.camX, locked: this.prog.locked, shots: this.shots, flock: this.flock, saulDodged: this.saulDodged, rng: () => Math.random() };
  }

  /** The behaviour lives in think (fighters.ts); this carries out what the enemy decided. */
  private updateEnemy(e: Fighter, dt: number) {
    for (const it of think(e, this.world(), dt)) this.act(e, it);
  }

  private act(e: Fighter, it: Intent) {
    switch (it.type) {
      case 'strike': this.applyHit(this.player, it.attack, it.dir); break;
      case 'fire': this.fire(e, it.spear, it.lane); break;
      case 'quake': this.quake = { x: it.x, y: it.y, t: 0, hit: false }; break;
      case 'say': this.say(it.text, it.x, it.y); break;
      case 'pop': this.pop(it.text, it.x, it.y, true); break;
      case 'opening': { const K = KB * 1.6; this.say('빈틈!', it.x + it.facing * 11 * K, it.y - 44 * K); break; }
      case 'shake': this.cameras.main.shake(it.ms, it.amount); break;
      case 'sound': sfx[it.name](); break;
      case 'tauntOver': this.bubble?.destroy(); this.bubble = null; break;
      case 'grab': sfx.baa(); this.say('메에!', it.sheep.x, it.sheep.y - 34); break;
      case 'stole': {
        const s = this.flock.find(o => o === it.sheep)!;
        s.img.destroy(); s.shadow.destroy();
        this.flock = this.flock.filter(o => o !== s);
        this.sheepLost++;
        this.say('양을 빼앗겼다!', this.player.x, this.player.y - 70);
        break;
      }
      case 'vanish': e.spr.destroy(); e.shadow.destroy(); break;
    }
  }

  /** A stone on the ground, with a bobbing arrow so it's easy to spot. */
  private dropStone(x: number, y: number) {
    x = Phaser.Math.Clamp(x, this.camX + 24, this.camX + 456);
    y = Phaser.Math.Clamp(y, FLOOR_TOP, FLOOR_BOTTOM);
    const img = this.add.image(x, y, 'pickup').setOrigin(0.5, 1);
    const arrow = this.add.text(x, y - 14, '▼', { fontFamily: FONT, fontSize: '10px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2 }).setOrigin(0.5, 1);
    this.pickups.push({ x, y, t: 0, img, arrow });
  }

  private tip(text: string) {
    this.texts.hint.setText(text).setAlpha(1);
    this.tweens.killTweensOf(this.texts.hint);
    this.tweens.add({ targets: this.texts.hint, alpha: 0, delay: 4000, duration: 600 });
  }

  /** Goliath arena: never leave David without a stone (see brookShouldDrop). */
  private updateBrook(dt: number) {
    if (!this.stage.brook) return;
    this.brookT += dt;
    if (!brookShouldDrop(this.ammo, this.pickups.length, this.brookT)) return;
    this.brookT = 0;
    const p = this.player;
    if (this.ammo + this.pickups.length === 0) this.dropStone(p.x + p.facing * 46, p.y); // right in front of him, same lane
    else this.dropStone(this.camX + Phaser.Math.Between(60, 420), Phaser.Math.Between(FLOOR_TOP + 10, FLOOR_BOTTOM));
    this.say('돌이다!', this.pickups[this.pickups.length - 1].x, this.pickups[this.pickups.length - 1].y - 26);
  }

  private updatePickups(dt: number, T: number) {
    const p = this.player, keep = !!this.stage.brook; // arena stones never fade away
    for (const k of this.pickups) {
      k.t += dt;
      const near = Math.abs(k.x - p.x) < 20 && Math.abs(k.y - p.y) < 12 && p.z < 10;
      if (near && this.ammo < STONE_MAX) { this.ammo++; k.t = Infinity; this.say('+1 돌', p.x, p.y - 66); sfx.jump(); }
      const fading = !keep && k.t > PICKUP_LIFE - 2;
      k.img.setDepth(k.y + 5).setVisible(!fading || Math.floor(T * 8) % 2 === 0);
      k.arrow.setPosition(k.x, k.y - 12 - Math.abs(Math.sin(T * 6)) * 5).setDepth(k.y + 6).setVisible(this.ammo < STONE_MAX && k.img.visible);
    }
    for (const k of this.pickups.filter(k => k.t === Infinity || (!keep && k.t >= PICKUP_LIFE))) { k.img.destroy(); k.arrow.destroy(); }
    this.pickups = this.pickups.filter(k => k.img.active);
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
    const g = this.hud.getContext();
    g.clearRect(0, 0, 480, 270);
    frame(g, 4, 4, 152, 38);
    R(g, 8, 8, 30, 30, '#0d0a14'); R(g, 9, 9, 28, 28, '#3b2f55');
    const s = frameOf('david', 'idle', 0, 1);
    g.drawImage(s.c, s.ox + 1 - 14, s.oy - 35 - 13, 28, 28, 9, 9, 28, 28);
    bar(g, 44, 22, 104, 6, this.player.hp / this.player.maxHp, '#6cc46a', '#b2eda6');
    const full = this.faith >= FAITH_MAX;
    bar(g, 44, 32, 72, 4, this.faith / FAITH_MAX, full && Math.floor(T * 8) % 2 ? '#fff2b0' : C.gold, '#fff2b0');
    // stones left; dimmed while the sling cools down
    for (let i = 0; i < STONE_MAX; i++) {
      const has = i < this.ammo;
      D(g, 122 + i * 7, 34, 3, '#0d0a14'); D(g, 122 + i * 7, 34, 2, has ? (this.slingCd > 0 ? C.stoneD : C.stone) : '#3a2c4a');
      if (has && this.slingCd <= 0) R(g, 121 + i * 7, 33, 2, 1, '#ffffff');
    }
    const boss = this.enemies.find(e => e.kind && this.def(e).boss && e.state !== 'dead');
    const e = this.lastHit;
    const showEnemy = e && e !== boss && e.state !== 'dead' && e.spr.active;
    if (showEnemy) { frame(g, 324, 4, 152, 26); bar(g, 332, 19, 136, 5, e.hp / e.maxHp, '#e0574f', '#ffa59a'); }
    const saul = this.enemies.find(o => o.kind === 'saul');
    const [bx, by, bw] = this.sys.game.device.input.touch ? [160, 28, 160] : [100, 239, 280];
    if (boss) { frame(g, bx, by, bw, 28); bar(g, bx + 8, by + 17, bw - 16, 6, Math.max(0, boss.hp) / boss.maxHp, '#e0574f', '#ffa59a'); }
    else if (saul) { frame(g, bx, by, bw, 28); bar(g, bx + 8, by + 17, bw - 16, 6, this.saulDodged / SAUL_DODGES, C.gold, '#fff2b0'); }
    this.texts.boss.setPosition(bx + 8, by + 4).setFontSize(bw < 200 ? 9 : 11);
    this.hud.refresh();
    this.texts.enemy.setText(showEnemy ? e.name : '');
    this.texts.boss.setText(boss ? (boss.g ? '골리앗 · 가드 사람, 키 여섯 규빗 한 뼘' : boss.name) : saul ? `사울 왕의 창 · 피한 횟수 ${Math.min(this.saulDodged, SAUL_DODGES)} / ${SAUL_DODGES}` : '');
    this.texts.score.setText('SCORE ' + String(this.score).padStart(7, '0'));
    this.texts.sheep.setText(this.stage.sheep ? `양 ${this.flock.length} / ${this.stage.sheep}` : '');
    this.texts.ally.setText(!this.stage.allies ? '' : this.allyCd > 0 ? `동료 ${Math.ceil(this.allyCd)}초` : (this.sys.game.device.input.touch ? '동료 호출 가능' : '동료 호출 가능 (G)'));
    this.ctl.setSpecialReady(full);
  }

  private showHint() {
    const h = this.stage.hints[this.hintsShown];
    if (!h || this.player.x < h.at) return;
    this.hintsShown++;
    const touch = this.sys.game.device.input.touch;
    this.texts.hint.setText(touch ? h.touch : h.pc).setAlpha(1);
    this.tweens.killTweensOf(this.texts.hint);
    this.tweens.add({ targets: this.texts.hint, alpha: 0, delay: 5000, duration: 600 });
  }

  /* ---------- loop ---------- */
  update(_: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    this.time0 += dt;
    const T = this.time0;
    this.stealthEvents = [];
    this.ctl.update(T);
    if (this.ctl.attack) this.atkBuf = 0.2;

    if (this.ended) {
      const go = (this.ctl.attack || this.ctl.jump) && T > this.endAt + 0.6;
      if (go && this.ended === 'dead') this.scene.restart({ stage: this.stageId, section: this.prog.section }); // retry this section, full health
      if ((go || T > this.endAt + 4) && this.ended === 'clear') this.leave();
    } else if (this.hitstop > 0) {
      this.hitstop -= dt;
    } else {
      for (const f of [this.player, ...this.enemies]) { f.t += dt; f.flash = Math.max(0, f.flash - dt); }
      this.slingCd = Math.max(0, this.slingCd - dt);
      this.updatePlayer(dt);
      for (const e of this.enemies) this.updateEnemy(e, dt);
      this.updateStones(dt);
      for (const e of this.enemies.filter(e => e.state === 'dead' && e.t > 0.6 && !e.g)) {
        e.spr.destroy(); e.shadow.destroy(); e.gone = true;
        if (++this.kos % (this.stage.brook ? 1 : DROP_EVERY) === 0) this.dropStone(e.x, e.y);
      }
      this.enemies = this.enemies.filter(e => !e.gone);
      this.updatePickups(dt, T);
      this.updateQuake(dt);
      this.updateShots(dt);
      this.updateRushers(dt, T);
      this.allyCd = Math.max(0, this.allyCd - dt);
      this.updateBrook(dt);
      this.showHint();

      this.updateStealth(dt, T);
      this.updateCaptives(T);
      const r = advance(this.prog, this.stage.sections, this.player.x, {
        enemies: this.enemies.length,
        stealthGoals: this.stealthRun ? this.stealthRun.goals.filter(g => !g.done).length : 0,
        captives: this.bound.filter(b => !b.done).length,
      });
      this.prog = r.p;
      for (const ev of r.events) {
        if (ev.type === 'wave') this.spawn(ev.spawns);
        else if (ev.type === 'stealth') this.setupStealth(ev.section);
        else if (ev.type === 'captives') this.setupCaptives(ev.section);
      }
    }
    this.updateFlock(dt, T);

    // camera: only moves forward; locks onto the section while a fight is on
    const target = cameraTarget(this.prog, this.stage.sections, this.camX, this.player.x);
    this.camX = Phaser.Math.Clamp(this.camX + (target - this.camX) * Math.min(1, dt * 8), 0, this.stage.width - 480);
    this.cameras.main.scrollX = Math.round(this.camX);

    this.draw(this.player, T);
    for (const e of this.enemies) this.draw(e, T);
    this.drawHud(T);
    this.drawFloorFx(T);
    this.drawOverheadFx(T);

    this.texts.go.setVisible(betweenFights(this.prog) && Math.floor(T * 3) % 2 === 0);
    const end = verdict(this.prog, this.player.state === 'dead');
    if (!this.ended && end) {
      this.ended = end;
      this.endAt = T;
      this.tweens.killTweensOf(this.texts.banner);
      if (this.ended === 'clear') {
        const kept = this.flock.length, bonus = kept * SHEEP_BONUS;
        this.score += bonus;
        this.registry.set('score', this.score);
        this.texts.banner.setText('STAGE CLEAR').setAlpha(1);
        this.texts.sub.setText(this.stage.sheep ? `지킨 양 ${kept} / ${this.stage.sheep} · 보너스 +${bonus}` : '');
      } else {
        this.texts.banner.setText('다윗이 쓰러졌다').setAlpha(1);
        this.texts.sub.setText('공격 또는 점프로 이 구간부터 다시');
      }
    }
  }

  private leave() {
    const n = this.stage.next;
    if (n.scene === 'cutscene') this.scene.start('cutscene', { id: n.id });
    else if (n.scene === 'shaft') this.scene.start('shaft');
    else this.scene.start('title');
  }
}

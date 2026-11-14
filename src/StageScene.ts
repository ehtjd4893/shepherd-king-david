import Phaser from 'phaser';
import {
  frameOf, downOf, whiteOf, isBeast, shadowCanvas, sparkCanvas, stoneCanvas, pickupCanvas, sheepFrame, arrowCanvas, spearCanvas,
  bgElah, bgField, bgGibeah, bgWild, bgKeilah, bgZiklag, bgJebus, bgZion, KB, frame, bar, R, D, C,
} from './art.ts';
import {
  hits, stepProg, spinCost, reaction, goliathDamage, brookShouldDrop, archerStep, swordify, camelPhase, chiefCalls, CAMEL_SPEED, CAMEL_WARN, seen, heard, suspicion, SIGHT_RANGE, SIGHT_RATE, HEAR_RATE, ALLY_COOLDOWN, ALLY_SPEED, ALLY_RUSH, ARROW_SPEED, SPEAR_SPEED, SAUL_DODGES, SHOT_BOX, HARP, GOLIATH_THRUST, GOLIATH_SWEEP, GOLIATH_SLAM_DMG, COMBO, DASH_ATTACK, JUMP_ATTACK, SLING_STONE, SPIN, ENEMIES, DEPTH_TOL,
  SPECIAL_DMG, FAITH_MAX, FAITH_PER_HIT, FAITH_PER_KO, STONE_MAX, type Attack, type Prog, type Spawn, type EnemyId, type EnemyDef, type Section, type Guard, type Goal, type Captive,
} from './combat.ts';
import { Controls } from './controls.ts';
import { STAGES, type StageDef } from './stages.ts';
import { sfx } from './sfx.ts';

const FLOOR_TOP = 168, FLOOR_BOTTOM = 246, GRAV = 760;
const WALK_X = 125, WALK_Y = 80, RUN_X = 220, JUMP_V = 240;
const MAX_ATTACKERS = 3, CHAIN_CHANCE = 0.4; // enemies swinging at once; chance to follow a swing with another
const SLING_COOLDOWN = 0.8, STONE_SPEED = 460;
const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
// the sling throw: [pose, frame, seconds]; the stone leaves at the start of 'release'
const SLING_SEQ: [string, number, number][] = [['sling', 0, 0.05], ['sling', 2, 0.05], ['wind', 0, 0.05], ['release', 0, 0.08], ['follow', 0, 0.08]];
const SLING_RELEASE = 0.15, SLING_DUR = 0.31, SPECIAL_DUR = 0.55;
const DROP_EVERY = 2, PICKUP_LIFE = 9; // every 2nd knockout drops a stone; it lies there 9 s
const SHEEP_BONUS = 1000;

type State = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'sling' | 'spin' | 'special' | 'harp' | 'hurt' | 'down' | 'getup' | 'dead';
interface Fighter {
  id: string; name: string; kind?: EnemyId;
  x: number; y: number; z: number; vx: number; vz: number; facing: 1 | -1;
  hp: number; maxHp: number; state: State; t: number; inv: number; flash: number;
  atk?: Attack; combo: number; queued: boolean; hitSet: Set<Fighter>; airAtk: boolean;
  ai?: { mode: 'approach' | 'ready' | 'swing' | 'back'; wait: number; side: 1 | -1; lane: number; cd: number };
  carry?: Sheep; fights?: boolean; // sheep thief: carrying a sheep / gave up stealing
  g?: GState; flee?: boolean; gone?: boolean; stun?: number; lane?: number;
  spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image;
}
type GMode = 'taunt' | 'walk' | 'tele' | 'thrust' | 'stuck' | 'sweepA' | 'sweep' | 'jumpA' | 'jump' | 'recover' | 'stagger';
/** Goliath's own state machine: he's slow, telegraphs everything, and is only open right after an attack. */
interface GState { mode: GMode; t: number; cd: number; lane: number; stuckFor: number; jumpVx: number; phase2: boolean; hinted: boolean }
interface Stone { x: number; y: number; z: number; dir: 1 | -1; img: Phaser.GameObjects.Image }
/** Enemy projectile: an archer's arrow or Saul's spear. */
interface Shot { x: number; y: number; z: number; dir: 1 | -1; speed: number; dmg: number; knock: boolean; spear: boolean; passed: boolean; img: Phaser.GameObjects.Image }
/** Adullam companion charging across the screen. */
interface Rusher { id: string; x: number; y: number; hitSet: Set<Fighter>; spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }
/** One of Saul's men in a stealth section: patrols with a sight cone, or sleeps and only hears running. */
interface Sentry { g: Guard; x: number; y: number; facing: 1 | -1; wait: number; meter: number; spr: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Text }
interface StealthRun { at: number; sentries: Sentry[]; goals: { g: Goal; done: boolean; marks: Phaser.GameObjects.GameObject[] }[]; grace: number; extras: Phaser.GameObjects.GameObject[] }
/** A captive in the Amalekite camp, freed by walking up and pressing attack. */
interface Bound { c: Captive; x: number; done: boolean; img: Phaser.GameObjects.Image; rope: Phaser.GameObjects.Graphics; arrow: Phaser.GameObjects.Text }
interface Pickup { x: number; y: number; t: number; img: Phaser.GameObjects.Image; arrow: Phaser.GameObjects.Text }
interface Sheep { i: number; x: number; y: number; facing: 1 | -1; moving: boolean; carrier: Fighter | null; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }

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

  init(data: { stage?: string }) { this.stageId = data.stage ?? 'field'; }

  create() {
    this.stage = STAGES[this.stageId];
    this.enemies = []; this.stones = []; this.pickups = []; this.flock = [];
    this.ammo = this.stage.ammo ?? STONE_MAX; this.kos = 0; this.sheepLost = 0; this.hintsShown = 0;
    this.quake = null; this.bubble = null; this.brookT = 0; this.shots = []; this.saulDodged = 0; this.royalWarnAt = -9; this.rushers = []; this.allyCd = 0; this.stealthRun = null; this.bound = [];
    this.spinRing = null;
    this.prog = { section: 0, wave: 0, locked: false, done: false };
    this.camX = this.hitstop = this.time0 = this.atkBuf = this.slingCd = 0;
    this.score = (this.registry.get('score') as number) ?? 0;
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
    this.player = this.makeFighter(this.stage.sword ? 'davidS' : 'david', '다윗', this.stage.start ?? 60, 210, 100);
    for (let i = 0; i < this.stage.sheep; i++) {
      const x = 30 - (i % 3) * 18, y = 186 + ((i * 13) % 50);
      this.flock.push({ i, x, y, facing: 1, moving: false, carrier: null, img: this.add.image(x, y, 'shadow'), shadow: this.add.image(x, y, 'shadow').setDepth(1).setScale(0.8, 1) });
    }
    this.ctl = new Controls(this);
    this.ctl.setButton('ally', !!this.stage.allies);
    this.buildHud();
    if (this.stage.title) {
      this.texts.banner.setText(this.stage.title).setAlpha(1);
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
      if (kind === 'goliath') {
        e.g = { mode: 'taunt', t: 0, cd: 0, lane: s.y, stuckFor: 1.3, jumpVx: 0, phase2: false, hinted: false };
        e.shadow.setScale(2.6, 1.6);
        // speech bubble at his mouth, clear of the tip line above
        this.bubble = this.add.text(this.camX + s.x - 34, s.y - 84, '와 봐라, 꼬마야! 네 살을 새들에게 주겠다!', {
          fontFamily: FONT, fontSize: '10px', color: '#1c1226', backgroundColor: '#ffffff', padding: { x: 5, y: 3 },
        }).setOrigin(1, 1).setDepth(960);
      }
      e.facing = s.x < 240 ? 1 : -1;
      if (isBeast(kind)) e.shadow.setScale(d.hw / 8, 1.2);
      // surround: take whichever side of David has fewer enemies
      const left = this.enemies.filter(o => o.ai?.side === -1).length, right = this.enemies.length - left;
      e.ai = { mode: 'approach', wait: 0, side: left < right ? -1 : left > right ? 1 : (s.x < 240 ? -1 : 1), lane: Phaser.Math.Between(-5, 5), cd: 1.5 };
      if (kind === 'saul') { e.ai.wait = 2.2; e.ai.mode = 'ready'; } // a beat to read the tip before the first spear
      if (kind === 'camel') { e.x = s.x < 240 ? this.camX - 50 : this.camX + 530; e.t = -0.8 * list.slice(0, list.indexOf(s)).filter(o => o.t === 'camel').length; }
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
    if (f.g && f.state !== 'down' && f.state !== 'dead') {
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
  private startAttack(f: Fighter, a: Attack) {
    f.state = 'attack'; f.t = 0; f.atk = a; f.queued = false; f.hitSet.clear();
    f.vx = f.facing * a.lunge;
    if (f === this.player) sfx.swing();
  }

  private applyHit(target: Fighter, a: Attack, dir: 1 | -1, heavyFx = false, src: 'staff' | 'stone' = 'staff') {
    if (target.g) { this.hitGoliath(target, a, dir, src); return; }
    target.hp -= a.dmg;
    if (target.kind === 'chief' || target.kind === 'lord') {
      const n = chiefCalls(target.hp + a.dmg, target.hp);
      if (n && target.hp > 0) {
        if (target.kind === 'chief') this.callCamels(n * 2);
        else { this.spawn([{ x: -40, y: 200, t: 'jebusite' }, { x: 520, y: 230, t: 'jebArcher' }]); this.pop('성주를 지켜라!', this.camX + 240, 90, true); }
      }
    }
    const heavy = a.knock || heavyFx || target.kind === 'camel';
    const boss = !!(target.kind && this.def(target).boss);
    const r = reaction(boss, heavy, target.hp <= 0);
    this.hitstop = Math.max(this.hitstop, r === 'down' ? 0.11 : 0.055);
    if (boss && target.hp <= 0) this.hitstop = 0.45;
    target.flash = 0.07;
    const beast = !!target.kind && isBeast(target.kind);
    const hx = target.x - dir * 4, hy = target.y - target.z - (beast ? (boss ? 24 : 14) : 26) * KB;
    this.impact(hx, hy, heavy);
    if (target.carry) this.dropSheep(target);
    if (r === 'down') {
      target.facing = (dir * -1) as 1 | -1;
      target.state = 'down'; target.t = 0; target.vx = dir * (boss ? 90 : 150); target.vz = boss ? 150 : 190; target.z = Math.max(target.z, 1);
      if (target.ai) target.ai.mode = 'approach';
      this.cameras.main.shake(boss && target.hp <= 0 ? 400 : 140, boss ? 0.014 : 0.009);
    } else if (r === 'hurt') {
      target.facing = (dir * -1) as 1 | -1;
      if (target.ai?.mode === 'swing') target.ai.mode = 'back';
      target.state = 'hurt'; target.t = 0; target.vx = dir * (boss ? 60 : 110); target.z = 0; target.vz = 0;
      this.cameras.main.shake(60, 0.003);
    } else {
      target.x += dir * 2; // boss armor: flinch in place, keeps attacking
    }
    if (target === this.player) { sfx.hurt(); return; }
    (heavy ? sfx.heavy : sfx.hit)();
    this.pop(heavy ? Phaser.Utils.Array.GetRandom(['빡!!', '콰직!', '쾅!']) : Phaser.Utils.Array.GetRandom(['퍽!', '딱!', '탁!']), hx + dir * 6, hy - 14, heavy);
    this.score += 100 + (target.hp <= 0 ? (boss ? 5000 : 400) : 0);
    if (!heavyFx) this.faith = Math.min(FAITH_MAX, this.faith + FAITH_PER_HIT + (target.hp <= 0 ? FAITH_PER_KO : 0)); // the special doesn't refill itself
    this.lastHit = target;
    if (boss && target.hp <= 0) this.pop('목자의 승리!', target.x, target.y - 90, true);
  }

  /** Knocked-down bodies fly, slide, lie, then get up (or fade out). */
  private physicsDown(f: Fighter, dt: number) {
    if (f.z > 0 || f.vz > 0) {
      f.z += f.vz * dt; f.vz -= GRAV * dt; f.x += f.vx * dt;
      if (f.z <= 0) { f.z = 0; f.vz = 0; f.vx *= 0.3; f.t = 0; }
      return;
    }
    f.x += f.vx * dt; f.vx *= Math.pow(0.002, dt);
    if (f.state === 'down' && f.t > 0.5) {
      if (f.hp <= 0) { f.state = 'dead'; f.t = 0; }
      else { f.state = 'getup'; f.t = 0; }
    }
  }

  private slide(f: Fighter, dt: number) {
    f.x += f.vx * dt;
    f.vx *= Math.pow(0.0005, dt);
  }

  private hitEnemies(a: Attack, dirFrom?: number) {
    const p = this.player;
    if (this.stage.sword) a = swordify(a);
    for (const e of this.enemies) {
      if (p.hitSet.has(e) || e.state === 'down' || e.state === 'dead') continue;
      if (this.def(e).untouchable) {
        if (hits(p, a.box, { x: e.x, y: e.y, z: e.z, hw: 10 })) this.royalWarning(e);
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
          if (running) this.startAttack(p, DASH_ATTACK);
          else { p.combo = 0; this.startAttack(p, COMBO[0]); }
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
        this.slide(p, dt);
        if (attack && p.t > a.dur * 0.25) { this.atkBuf = 0; p.queued = true; }
        if (p.t >= a.active[0] && p.t <= a.active[1]) this.hitEnemies(a);
        if (p.t >= a.dur) {
          if (p.queued && a !== DASH_ATTACK && p.combo < COMBO.length - 1) this.startAttack(p, COMBO[++p.combo]);
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
      case 'hurt': this.slide(p, dt); if (p.t > 0.25) p.state = 'idle'; break;
      case 'down': case 'dead': this.physicsDown(p, dt); break;
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
        if (e.state === 'down' || e.state === 'dead' || this.def(e).untouchable) continue;
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
      if (e.state === 'dead' || this.def(e).untouchable || e.x < this.camX - 10 || e.x > this.camX + 490) continue;
      this.applyHit(e, { ...COMBO[2], dmg: SPECIAL_DMG }, e.x >= p.x ? 1 : -1, true);
    }
    this.hitstop = 0.2;
  }

  /* ---------- Ziklag: camel riders, captives (1 Sam 30) ---------- */
  private callCamels(n: number) {
    this.spawn(Array.from({ length: n }, (_, i) => ({ x: i % 2 ? -40 : 520, y: 210, t: 'camel' as const })));
    this.pop('낙타 기병이다!', this.camX + 240, 90, true);
  }

  /** Waits off-screen, then (warning line on David's lane) gallops across and leaves. */
  private updateCamel(e: Fighter, dt: number) {
    const p = this.player;
    if (e.t < 0) return;
    if (e.lane === undefined) e.lane = p.y;
    e.y = e.lane;
    if (camelPhase(e.t) === 'warn') { e.state = 'idle'; return; }
    e.state = 'walk';
    e.x += e.facing * CAMEL_SPEED * dt;
    const a = this.def(e).attack;
    if (!e.hitSet.has(p) && p.inv <= 0 && p.state !== 'down' && p.state !== 'dead' && hits(e, a.box, { x: p.x, y: p.y, z: p.z, hw: 6 })) {
      e.hitSet.add(p); this.applyHit(p, a, e.facing);
    }
    if ((e.facing > 0 && e.x > this.camX + 540) || (e.facing < 0 && e.x < this.camX - 60)) { e.spr.destroy(); e.shadow.destroy(); e.gone = true; }
  }

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
    const st = sec.stealth!, at = sec.at, extras: Phaser.GameObjects.GameObject[] = [];
    this.shade.setFillStyle(st.mood === 'night' ? 0x0a0c30 : 0x1a1008, st.mood === 'night' ? 0.5 : 0.3);
    if (st.mood === 'cave') {
      // rock ceiling with stalactites over the whole section: this is En-gedi's cave, not open desert
      const rock = this.add.graphics().setDepth(1400);
      rock.fillStyle(0x3a2a24, 1).fillRect(at, 0, 480, 96);
      for (let x = at; x < at + 480; x += 16) rock.fillTriangle(x, 96, x + 16, 96, x + 8, 104 + ((x * 7) % 23));
      rock.fillStyle(0x5a4234, 1).fillRect(at, 0, 480, 6);
      for (let x = at + 30; x < at + 480; x += 70) rock.fillStyle(0x2a1e18, 1).fillTriangle(x, 96, x + 10, 96, x + 5, 140);
      rock.fillStyle(0x3a2a24, 1).fillRect(at + 452, 96, 28, 170);
      extras.push(rock);
    }
    // Saul asleep / resting, never to be harmed
    const sk = this.tex('saul', 'hurt', 0, true), so = this.origins.get(sk)!;
    extras.push(this.add.image(at + st.saul.x, st.saul.y, sk).setOrigin(so[0], so[1]).setDepth(st.saul.y + 10));
    extras.push(this.add.text(at + st.saul.x - 10, st.saul.y - 40, 'Zz', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setDepth(960));
    const sentries = st.guards.map(g => {
      const key = g.asleep ? this.tex('guard', 'hurt', 0, true) : this.tex('guard', 'idle', 0), o = this.origins.get(key)!;
      if (g.asleep) extras.push(this.add.text(at + g.x - 6, g.y - 30, 'Zz', { fontFamily: FONT, fontSize: '10px', color: '#ffffff', stroke: '#0d0a14', strokeThickness: 2 }).setDepth(960));
      return {
        g, x: at + g.x, y: g.y, facing: -1 as 1 | -1, wait: 0, meter: 0,
        spr: this.add.image(at + g.x, g.y, key).setOrigin(o[0], o[1]).setDepth(g.y + 10),
        mark: this.add.text(at + g.x, g.y - 70, '', { fontFamily: FONT, fontSize: '16px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 3 }).setOrigin(0.5).setDepth(960),
      };
    });
    const goals = st.goals.map(g => {
      const x = at + g.x, marks: Phaser.GameObjects.GameObject[] = [];
      if (g.kind === 'spear') marks.push(this.add.image(x, g.y, 'stealthSpear').setOrigin(0.5, 1).setDepth(g.y + 9));
      if (g.kind === 'jug') marks.push(this.add.image(x, g.y, 'jug').setOrigin(0.5, 1).setDepth(g.y + 9));
      marks.push(this.add.text(x, g.y - (g.kind === 'spear' ? 66 : 26), '▼', { fontFamily: FONT, fontSize: '11px', color: '#ffe27a', stroke: '#7a2416', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(961));
      return { g, done: false, marks };
    });
    this.stealthRun = { at, sentries, goals, grace: 1, extras };
    // start from the near edge of the section, out of everyone's sight
    const p = this.player; p.x = at + 30; p.y = 210; p.state = 'idle'; p.vx = 0;
    this.say('살금살금…', p.x, p.y - 70);
  }

  private updateStealth(dt: number, T: number) {
    const run = this.stealthRun, p = this.player;
    if (!run) return;
    run.grace = Math.max(0, run.grace - dt);
    for (const s of run.sentries) {
      if (!s.g.asleep) {
        // patrol between from..to, pausing to look around at each end
        if (s.wait > 0) s.wait -= dt;
        else {
          s.x += s.facing * 35 * dt;
          const lo = run.at + (s.g.from ?? s.g.x), hi = run.at + (s.g.to ?? s.g.x);
          if (s.x <= lo || s.x >= hi) { s.x = Phaser.Math.Clamp(s.x, lo, hi); s.facing = (s.facing * -1) as 1 | -1; s.wait = 1.2; }
        }
        const key = this.tex('guard', s.wait > 0 ? 'idle' : 'walk', s.wait > 0 ? Math.floor(T * 2.5) % 2 : Math.floor(T * 6) % 4), o = this.origins.get(key)!;
        s.spr.setTexture(key).setOrigin(o[0], o[1]).setFlipX(s.facing < 0).setPosition(Math.round(s.x), s.y);
      }
      const sensed = run.grace <= 0 && p.state !== 'down' && p.state !== 'dead'
        && (s.g.asleep ? heard(s, p, p.state === 'run') : seen(s, p));
      s.meter = suspicion(s.meter, sensed, dt, s.g.asleep ? HEAR_RATE : SIGHT_RATE);
      s.mark.setPosition(s.x, s.y - (s.g.asleep ? 34 : 70)).setText(s.meter >= 1 ? '!' : s.meter > 0 ? '?' : '').setColor(s.meter > 0.5 ? '#ff7a6a' : '#ffe27a');
      if (s.meter >= 1) { this.caught(); return; }
    }
    // take a goal: walk up to it and press attack
    for (const g of run.goals) {
      if (g.done || !this.ctl.attack) continue;
      const gx = run.at + g.g.x;
      if (Math.abs(gx - p.x) < 22 && Math.abs(g.g.y - p.y) < 14) {
        g.done = true;
        for (const m of g.marks) m.destroy();
        this.pop({ robe: '옷자락을 베었다!', spear: '사울의 창을 챙겼다!', jug: '물병을 챙겼다!' }[g.g.kind], p.x, p.y - 80, true);
        sfx.harp();
      }
    }
    for (const g of run.goals) if (!g.done) (g.marks[g.marks.length - 1] as Phaser.GameObjects.Text).setY(g.g.y - (g.g.kind === 'spear' ? 66 : 26) - Math.abs(Math.sin(T * 6)) * 4);
    if (run.goals.every(g => g.done)) {
      // done: everyone stays asleep / at their post; lift the darkness
      this.shade.setFillStyle(0x000000, 0);
      for (const s of run.sentries) s.mark.setText('');
      this.stealthRun = null;
    }
  }

  /** Spotted: back to the start of the section (goals already taken stay taken). No damage. */
  private caught() {
    const run = this.stealthRun!, p = this.player;
    this.pop('들켰다!', p.x, p.y - 80, true);
    sfx.bark();
    this.cameras.main.flash(250, 255, 255, 255);
    p.x = run.at + 30; p.y = 210; p.state = 'idle'; p.vx = 0; p.z = 0; p.vz = 0;
    for (const s of run.sentries) { s.x = run.at + s.g.x; s.facing = -1; s.wait = 0; s.meter = 0; }
    run.grace = 1.2;
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
      if (e.state === 'dead' || e.state === 'down' || this.def(e).untouchable || e.x < this.camX - 10 || e.x > this.camX + 490) continue;
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
        if (r.hitSet.has(e) || e.state === 'down' || e.state === 'dead' || this.def(e).untouchable) continue;
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
      const open = p.inv <= 0 && p.state !== 'down' && p.state !== 'dead';
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

  /** Archer: keep ~110-170px away on David's lane, draw (warning line), loose, reposition. */
  private updateArcher(e: Fighter, dt: number) {
    const p = this.player, ai = e.ai!, d = this.def(e), dist = Math.abs(p.x - e.x), toward = Math.sign(p.x - e.x) || 1;
    e.facing = toward as 1 | -1;
    if (ai.mode === 'swing') {
      const a = e.atk!;
      if (e.t >= a.active[0] && e.t - dt < a.active[0]) this.fire(e, false, e.lane ?? e.y);
      if (e.t >= a.dur) { ai.mode = 'approach'; ai.cd = Phaser.Math.FloatBetween(1.2, 2.2); e.state = 'idle'; }
      return;
    }
    const step = archerStep(dist), ty = Phaser.Math.Clamp(p.y + ai.lane, FLOOR_TOP, FLOOR_BOTTOM);
    e.x += step * toward * d.speed * dt;
    e.y += Math.sign(ty - e.y) * Math.min(Math.abs(ty - e.y), d.speed * 0.7 * dt);
    e.state = step || Math.abs(ty - e.y) > 2 ? 'walk' : 'idle';
    e.x = Phaser.Math.Clamp(e.x, this.camX + 16, this.camX + 464);
    if (ai.cd <= 0 && Math.abs(p.y - e.y) <= 10 && dist < 220 && p.state !== 'down' && p.state !== 'dead') {
      ai.mode = 'swing'; e.lane = e.y; this.startAttack(e, d.attack);
    }
  }

  /** King Saul: can't be fought. He raises the spear over David's lane and hurls it — dodge it three times (1 Sam 18:11, 19:10). */
  private updateSaul(e: Fighter, dt: number) {
    const p = this.player, ai = e.ai!;
    e.facing = p.x >= e.x ? 1 : -1;
    if (this.saulDodged >= SAUL_DODGES) {
      // he storms off; the court is open
      e.state = 'walk'; e.facing = 1; e.x += 70 * dt;
      if (e.x > this.camX + 520) { e.spr.destroy(); e.shadow.destroy(); e.gone = true; }
      return;
    }
    if (ai.mode === 'swing') {
      const a = e.atk!;
      if (e.t >= a.active[0] && e.t - dt < a.active[0]) this.fire(e, true, e.lane ?? p.y);
      if (e.t >= a.dur) { ai.mode = 'ready'; ai.wait = Phaser.Math.FloatBetween(0.7, 1.3); e.state = 'idle'; }
      return;
    }
    e.state = 'idle';
    ai.wait -= dt;
    const inFlight = this.shots.some(s => s.spear);
    if (ai.wait <= 0 && !inFlight && p.state !== 'down' && p.state !== 'dead') {
      ai.mode = 'swing'; e.lane = p.y; this.startAttack(e, this.def(e).attack);
      this.say(Phaser.Utils.Array.GetRandom(['다윗을 벽에 박으리라!', '네 이놈…!', '받아라!']), e.x, e.y - 82);
    }
  }

  /* ---------- Goliath ---------- */
  private hitGoliath(e: Fighter, a: Attack, dir: 1 | -1, src: 'staff' | 'stone') {
    const g = e.g!, K = KB * 1.6;
    const r = goliathDamage(e.hp, src, g.mode === 'stuck', dir === -e.facing, a.dmg);
    e.hp -= r.dmg; e.flash = 0.07;
    this.lastHit = e;
    const fx = e.x + e.facing * 11 * K, fy = e.y - 33 * K; // forehead while bent over
    if (r.blocked) {
      if (src === 'stone') this.dropStone(e.x - dir * 34, e.y); // bounced off the bronze: pick it up again
      this.hitstop = Math.max(this.hitstop, 0.03);
      this.impact(e.x - dir * 14, e.y - 24 * K, false);
      this.pop('팅!', e.x - dir * 20, e.y - 30 * K, false);
      sfx.clank();
    } else if (r.crit) {
      this.hitstop = 0.25;
      this.impact(fx, fy, true);
      this.pop('명중!!', fx, fy - 18, true);
      this.cameras.main.shake(260, 0.014);
      sfx.heavy();
      this.score += 1000;
      this.faith = Math.min(FAITH_MAX, this.faith + FAITH_PER_KO);
      if (e.hp > 0) { g.mode = 'stagger'; g.t = 0; }
    } else {
      this.hitstop = Math.max(this.hitstop, 0.05);
      this.impact(e.x - dir * 10, e.y - 24 * K, false);
      this.pop(Phaser.Utils.Array.GetRandom(['퍽!', '딱!']), e.x - dir * 16, e.y - 30 * K, false);
      sfx.hit();
      this.score += 50;
      this.faith = Math.min(FAITH_MAX, this.faith + FAITH_PER_HIT);
    }
    if (e.hp === 1 && src !== 'stone' && !g.hinted) { g.hinted = true; this.say('마지막은 물매로!', this.player.x, this.player.y - 70); }
    if (!g.phase2 && e.hp > 0 && e.hp <= 50) {
      g.phase2 = true;
      sfx.roar();
      this.cameras.main.shake(400, 0.01);
      this.pop('크아아!!', e.x, e.y - 50 * K, true);
      this.spawn([{ x: -40, y: 196 }, { x: 520, y: 236, t: 'philB' }]);
    }
    if (e.hp <= 0) {
      // the stone sank into his forehead and he fell on his face (1 Sam 17:49)
      e.state = 'down'; e.t = 0; e.vx = -e.facing * 40; e.vz = 110; e.z = 1;
      this.hitstop = 0.6;
      this.cameras.main.flash(300, 255, 255, 255);
      this.cameras.main.shake(600, 0.02);
      this.pop('골리앗이 쓰러졌다!', e.x, e.y - 70 * K, true);
      this.score += 10000;
      for (const o of this.enemies) if (o !== e && o.state !== 'dead') o.flee = true;
      this.bubble?.destroy(); this.bubble = null;
    }
  }

  private updateGoliath(e: Fighter, dt: number) {
    const g = e.g!, p = this.player, K = KB * 1.6;
    if (e.state === 'down' || e.state === 'dead') { this.physicsDown(e, dt); if (e.state === 'dead') e.gone = true; return; }
    g.t += dt; g.cd = Math.max(0, g.cd - dt);
    const go = (m: GMode) => { g.mode = m; g.t = 0; };
    const dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y;
    const open = p.state !== 'down' && p.state !== 'dead';
    const strike = (a: Attack) => {
      if (e.t >= a.active[0] && e.t <= a.active[1] && !e.hitSet.has(p) && p.inv <= 0 && open && hits(e, a.box, { x: p.x, y: p.y, z: p.z, hw: 6 })) {
        e.hitSet.add(p); this.applyHit(p, a, e.facing);
      }
    };
    switch (g.mode) {
      case 'taunt':
        if (g.t > 2.4) { this.bubble?.destroy(); this.bubble = null; go('walk'); }
        break;
      case 'walk':
        e.facing = dx >= 0 ? 1 : -1;
        if (adx > 95) e.x += Math.sign(dx) * 34 * dt; else if (adx < 70) e.x -= Math.sign(dx) * 22 * dt;
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), 24 * dt);
        if (g.cd <= 0 && open) {
          if (adx < 58 && Math.abs(dy) < 16) go('sweepA');
          else if (g.phase2 && Math.random() < 0.35) go('jumpA');
          else if (adx <= 150 && Math.abs(dy) <= 14) { g.lane = e.y; go('tele'); }
        }
        break;
      case 'tele': // red warning line along his lane, then the thrust
        if (g.t > 0.65) { go('thrust'); this.startAttack(e, GOLIATH_THRUST); }
        break;
      case 'thrust':
        this.slide(e, dt); strike(GOLIATH_THRUST);
        if (g.t > 0.25) { g.stuckFor = 1.3; go('stuck'); this.say('빈틈!', e.x + e.facing * 11 * K, e.y - 44 * K); }
        break;
      case 'sweepA':
        if (g.t > 0.45) { go('sweep'); this.startAttack(e, GOLIATH_SWEEP); }
        break;
      case 'sweep':
        strike(GOLIATH_SWEEP);
        if (g.t > 0.25) go('recover');
        break;
      case 'jumpA':
        if (g.t > 0.5) { go('jump'); e.vz = 300; g.jumpVx = Phaser.Math.Clamp(dx, -220, 220) / 0.8; sfx.jump(); }
        break;
      case 'jump':
        e.x += g.jumpVx * dt; e.z += e.vz * dt; e.vz -= GRAV * dt;
        if (e.z <= 0) {
          e.z = 0; e.vz = 0;
          this.quake = { x: e.x, y: e.y, t: 0, hit: false };
          this.cameras.main.shake(300, 0.016); sfx.heavy();
          this.pop('쿵!!', e.x, e.y - 10, true);
          g.stuckFor = 0.9; go('stuck'); this.say('빈틈!', e.x + e.facing * 11 * K, e.y - 44 * K);
        }
        break;
      case 'stuck': if (g.t > g.stuckFor) go('recover'); break;
      case 'stagger': if (g.t > 0.9) go('recover'); break;
      case 'recover': if (g.t > 0.4) { go('walk'); g.cd = g.phase2 ? 0.4 : 0.9; } break;
    }
    e.y = Phaser.Math.Clamp(e.y, FLOOR_TOP, FLOOR_BOTTOM);
    e.x = Phaser.Math.Clamp(e.x, this.camX + 30, this.camX + 450);
  }

  /** Floor shockwave from the slam: jump over it. */
  private updateQuake(dt: number) {
    const q = this.quake, p = this.player;
    if (!q) return;
    q.t += dt;
    const r = q.t * 420;
    if (!q.hit && p.z < 4 && p.inv <= 0 && Math.abs(p.y - q.y) <= 40 && Math.abs(Math.abs(p.x - q.x) - r) < 14 && p.state !== 'down' && p.state !== 'dead') {
      q.hit = true;
      this.applyHit(p, { ...GOLIATH_SWEEP, dmg: GOLIATH_SLAM_DMG }, p.x >= q.x ? 1 : -1);
    }
    if (q.t > 0.5) this.quake = null;
  }

  private drawGoliathFx(T: number) {
    this.fxg.clear(); this.topfx.clear();
    this.drawStealth();
    for (const e of this.enemies) {
      const d = this.def(e);
      if (e.ai?.mode === 'swing' && e.atk && e.t < e.atk.active[0] && (d.ai === 'archer' || d.ai === 'saul') && Math.floor(T * 12) % 2) {
        const y = e.lane ?? e.y, x0 = e.x + e.facing * 24, len = d.ai === 'saul' ? 480 : 200;
        this.fxg.fillStyle(0xe63c3c, d.ai === 'saul' ? 0.45 : 0.28).fillRect(e.facing > 0 ? x0 : x0 - len, y - (d.ai === 'saul' ? 6 : 3), len, d.ai === 'saul' ? 12 : 6);
      }
      if (e.ai?.mode === 'swing' && e.atk?.keep && e.t < e.atk.active[0] && Math.floor(T * 12) % 2) {
        const x0 = e.x + e.facing * 20;
        this.fxg.fillStyle(0xe63c3c, 0.45).fillRect(e.facing > 0 ? x0 : x0 - 260, e.y - 6, 260, 12);
      }
      if (e.kind === 'camel' && e.t >= 0 && e.t < CAMEL_WARN && e.lane !== undefined && Math.floor(T * 12) % 2) {
        this.fxg.fillStyle(0xe63c3c, 0.45).fillRect(this.camX, e.lane - 7, 480, 14);
        for (let i = 0; i < 8; i++) { const cx = this.camX + (e.facing > 0 ? 30 + i * 56 : 450 - i * 56); this.fxg.fillStyle(0xffd0c8, 1).fillTriangle(cx, e.lane - 4, cx, e.lane + 4, cx + e.facing * 7, e.lane); }
      }
      if (e.stun && e.state !== 'down') {
        const k = KB * (d.scale ?? 1), hy = e.y - (isBeast(e.id) ? 30 : 50) * k;
        for (let i = 0; i < 3; i++) { const a = T * 5 + i * 2.1; this.topfx.fillStyle(0xffe27a, 1).fillRect(Math.round(e.x + Math.cos(a) * 9) - 1, Math.round(hy + Math.sin(a) * 2.5), 3, 1).fillRect(Math.round(e.x + Math.cos(a) * 9), Math.round(hy + Math.sin(a) * 2.5) - 1, 1, 3); }
      }
    }
    const e = this.enemies.find(o => o.g && o.state !== 'down' && o.state !== 'dead'), K = KB * 1.6;
    if (e?.g?.mode === 'tele' && Math.floor(T * 12) % 2) {
      const x0 = e.x + e.facing * 24, x1 = e.x + e.facing * 140, y = e.g.lane;
      this.fxg.fillStyle(0xe63c3c, 0.45).fillRect(Math.min(x0, x1), y - 6, Math.abs(x1 - x0), 12);
      for (let i = 0; i < 5; i++) {
        const cx = x0 + e.facing * (14 + i * 22);
        this.fxg.fillStyle(0xffd0c8, 1).fillTriangle(cx, y - 4, cx, y + 4, cx + e.facing * 6, y);
      }
    }
    if (e?.g?.mode === 'stuck' && Math.floor(T * 10) % 2) {
      const fx = e.x + e.facing * 11 * K, fy = e.y - 33 * K;
      this.topfx.lineStyle(2, 0xf2c14e, 1).strokeCircle(fx, fy, 7).fillStyle(0xfff2b0, 0.6).fillCircle(fx, fy, 3);
    }
    const q = this.quake;
    if (q) {
      const r = q.t * 420;
      this.fxg.lineStyle(3, 0xc7a26a, 1 - q.t * 2).strokeEllipse(q.x, q.y, r * 2, r * 0.5);
      this.fxg.lineStyle(2, 0xffffff, 0.8 - q.t * 1.6).strokeEllipse(q.x, q.y, r * 2 - 10, r * 0.5 - 3);
    }
  }

  /* ---------- sheep ---------- */
  private dropSheep(thief: Fighter) {
    const s = thief.carry!;
    s.carrier = null; thief.carry = undefined; thief.fights = true;
    this.say('음매~', s.x, s.y - 34);
    sfx.baa();
  }

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
  private updateEnemy(e: Fighter, dt: number) {
    if (e.g) { this.updateGoliath(e, dt); return; }
    const p = this.player, ai = e.ai!, d = this.def(e);
    ai.cd = Math.max(0, ai.cd - dt);
    if (d.ai === 'saul') { this.updateSaul(e, dt); return; }
    if (e.flee && e.state !== 'down' && e.state !== 'dead') {
      // their champion is dead: run (1 Sam 17:51)
      const dir = e.x < this.camX + 240 ? -1 : 1;
      e.facing = dir; e.state = 'walk'; e.x += dir * 160 * dt;
      if (e.x < this.camX - 40 || e.x > this.camX + 520) { e.spr.destroy(); e.shadow.destroy(); e.gone = true; }
      return;
    }
    if (e.state === 'down' || e.state === 'dead') { this.physicsDown(e, dt); return; }
    if (e.state === 'hurt') { this.slide(e, dt); if (e.t > 0.3) { e.state = 'idle'; ai.mode = 'back'; ai.wait = 0.2; } return; }
    if (e.state === 'getup') { if (e.t > 0.25) { e.state = 'idle'; ai.mode = 'approach'; } return; }
    if (e.stun) { e.stun = Math.max(0, e.stun - dt); e.state = 'idle'; return; } // soothed by the harp
    if (d.ai === 'archer') { this.updateArcher(e, dt); return; }
    if (d.ai === 'camel') { this.updateCamel(e, dt); return; }

    if (d.ai === 'thief' && !e.fights && this.thiefSteal(e, dt)) return;

    const tx = p.x + ai.side * d.reach, ty = Phaser.Math.Clamp(p.y + ai.lane, FLOOR_TOP, FLOOR_BOTTOM);
    const faceP = () => { e.facing = p.x >= e.x ? 1 : -1; };
    const playerOpen = p.state !== 'down' && p.state !== 'dead';
    // bosses: a charge / pounce from range when lined up
    const sp = d.special, dist = Math.abs(p.x - e.x);
    if (sp && ai.cd <= 0 && ai.mode !== 'swing' && playerOpen && dist >= sp.from && dist <= sp.to && Math.abs(p.y - e.y) <= DEPTH_TOL) {
      faceP(); ai.mode = 'swing'; ai.cd = sp.every; this.startAttack(e, sp.attack);
      return;
    }
    switch (ai.mode) {
      case 'approach': {
        const dx = tx - e.x, dy = ty - e.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 4) { ai.mode = 'ready'; ai.wait = Phaser.Math.FloatBetween(0.05, 0.35); e.state = 'idle'; break; }
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), d.speed * dt);
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), d.speed * 0.65 * dt);
        e.state = 'walk';
        faceP();
        break;
      }
      case 'ready': {
        faceP(); e.state = 'idle';
        if (Math.abs(tx - e.x) > 12 || Math.abs(ty - e.y) > 8) { ai.mode = 'approach'; break; }
        ai.wait -= dt;
        const swinging = this.enemies.filter(o => o.ai?.mode === 'swing').length;
        if (ai.wait <= 0) {
          if (swinging < MAX_ATTACKERS && playerOpen && Math.abs(e.y - p.y) <= DEPTH_TOL) { ai.mode = 'swing'; this.startAttack(e, d.attack); }
          else ai.wait = 0.12;
        }
        break;
      }
      case 'swing': {
        const a = e.atk!;
        if (a.keep && e.t >= a.active[0] - dt) e.x += e.vx * dt; else this.slide(e, dt);
        if (a.leap && e.t >= a.active[0] && e.t - dt < a.active[0]) e.vz = a.leap;
        if (e.z > 0 || e.vz > 0) {
          e.z += e.vz * dt; e.vz -= GRAV * dt;
          if (e.z <= 0) { e.z = 0; e.vz = 0; e.vx = 0; this.cameras.main.shake(90, 0.006); }
        }
        if (e.t >= a.active[0] && e.t <= a.active[1] && !e.hitSet.has(p) && p.inv <= 0 && playerOpen
          && hits(e, a.box, { x: p.x, y: p.y, z: p.z, hw: 6 })) { e.hitSet.add(p); this.applyHit(p, a, e.facing); }
        if (e.t >= a.dur && e.z <= 0) {
          const stillClose = dist < d.reach + 14 && Math.abs(p.y - e.y) <= DEPTH_TOL && playerOpen;
          if (!a.keep && stillClose && Math.random() < CHAIN_CHANCE) { faceP(); this.startAttack(e, d.attack); }
          else { e.state = 'idle'; ai.mode = 'back'; ai.wait = 0.18; }
        }
        break;
      }
      case 'back': {
        e.state = 'walk'; faceP();
        e.x += ai.side * 40 * dt;
        ai.wait -= dt;
        if (ai.wait <= 0) ai.mode = 'approach';
        break;
      }
    }
    e.y = Phaser.Math.Clamp(e.y, FLOOR_TOP, FLOOR_BOTTOM);
    if (d.boss) e.x = Phaser.Math.Clamp(e.x, this.camX + 16, this.camX + 464);
  }

  /** Sheep thief: walk to a free sheep, grab it, drag it off the nearer screen edge. Returns false when there's nothing to steal. */
  private thiefSteal(e: Fighter, dt: number): boolean {
    if (e.carry) {
      const dir: 1 | -1 = e.x < this.camX + 240 ? -1 : 1;
      e.facing = (dir * -1) as 1 | -1; // walks backwards, pulling the sheep
      e.x += dir * 55 * dt; e.state = 'walk';
      if (e.x < this.camX - 30 || e.x > this.camX + 510) {
        const s = e.carry;
        s.img.destroy(); s.shadow.destroy();
        this.flock = this.flock.filter(o => o !== s);
        this.sheepLost++;
        this.say('양을 빼앗겼다!', this.player.x, this.player.y - 70);
        e.spr.destroy(); e.shadow.destroy(); e.gone = true; // gone with the sheep
      }
      return true;
    }
    const free = this.flock.filter(s => !s.carrier);
    if (!free.length) return false;
    const s = free.reduce((a, b) => (Math.abs(a.x - e.x) < Math.abs(b.x - e.x) ? a : b));
    const dx = s.x - e.x, dy = s.y - e.y;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 6) { e.carry = s; s.carrier = e; sfx.baa(); this.say('메에!', s.x, s.y - 34); return true; }
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), this.def(e).speed * dt);
    e.y += Math.sign(dy) * Math.min(Math.abs(dy), this.def(e).speed * 0.7 * dt);
    e.facing = dx >= 0 ? 1 : -1; e.state = 'walk';
    return true;
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
    this.texts.ally.setText(!this.stage.allies ? '' : this.allyCd > 0 ? `동료 ${Math.ceil(this.allyCd)}초` : '동료 호출 가능 (G)');
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
    this.ctl.update(T);
    if (this.ctl.attack) this.atkBuf = 0.2;

    if (this.ended) {
      const go = (this.ctl.attack || this.ctl.jump) && T > this.endAt + 0.6;
      if (go && this.ended === 'dead') this.scene.restart({ stage: this.stageId });
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
      const goalsLeft = (this.stealthRun ? this.stealthRun.goals.filter(g => !g.done).length : 0) + this.bound.filter(b => !b.done).length;
      const r = stepProg(this.prog, this.stage.sections, this.player.x, this.enemies.length + goalsLeft);
      this.prog = r.p;
      if (r.spawn) {
        this.spawn(r.spawn);
        const sec = this.stage.sections[this.prog.section];
        if (sec.stealth && this.prog.wave === 0) this.setupStealth(sec);
        if (sec.captives && this.prog.wave === 0) this.setupCaptives(sec);
      }
    }
    this.updateFlock(dt, T);

    // camera: only moves forward; locks onto the section while a fight is on
    const target = this.prog.locked ? this.stage.sections[this.prog.section].at : Math.max(this.camX, this.player.x - 200);
    this.camX = Phaser.Math.Clamp(this.camX + (target - this.camX) * Math.min(1, dt * 8), 0, this.stage.width - 480);
    this.cameras.main.scrollX = Math.round(this.camX);

    this.draw(this.player, T);
    for (const e of this.enemies) this.draw(e, T);
    this.drawHud(T);
    this.drawGoliathFx(T);

    const cleared = !this.prog.locked && !this.prog.done && this.prog.section > 0;
    this.texts.go.setVisible(cleared && Math.floor(T * 3) % 2 === 0);
    if (!this.ended && (this.prog.done || this.player.state === 'dead')) {
      this.ended = this.prog.done ? 'clear' : 'dead';
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
        this.texts.sub.setText('공격 또는 점프로 다시 시작');
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

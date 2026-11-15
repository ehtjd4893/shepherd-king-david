// One stage, played out: David, the enemies, stones, arrows, companions, sheep, captives, stealth, progress and the camera.
// No Phaser here. The scene feeds it input each frame, draws its state, and plays its effects (fx) as they happen;
// a test can run a whole stage with no screen at all (see autoplay.ts).
import { KB } from './art.ts';
import {
  hits, spinCost, brookShouldDrop, swordify, ALLY_COOLDOWN, ALLY_SPEED, ALLY_RUSH, ARROW_SPEED, SPEAR_SPEED, SAUL_DODGES, SHOT_BOX, HARP, GOLIATH_SWEEP, GOLIATH_SLAM_DMG,
  COMBO, DASH_ATTACK, JUMP_ATTACK, SLING_STONE, SPIN, ENEMIES, FLOOR_TOP, FLOOR_BOTTOM, GRAV, SPECIAL_DMG, FAITH_MAX, STONE_MAX,
  type Attack, type Spawn, type Section, type Captive, type Goal, type EnemyDef,
} from './combat.ts';
import { resolveHit, standing, vulnerable, hittable, type HitOutcome } from './hit.ts';
import { advance, startAt, cameraTarget, verdict, type Prog } from './progress.ts';
import { startStealth, stepStealth, entry, type StealthRun, type StealthEvent } from './stealth.ts';
import { think, arrive, startAttack, physicsDown, slide, newFighter, def, type Actor, type SheepBody, type World, type Intent } from './fighters.ts';
import { STAGES, type StageDef, type Hint } from './stages.ts';

const WALK_X = 125, WALK_Y = 80, RUN_X = 220, JUMP_V = 240;
const SLING_COOLDOWN = 0.8, STONE_SPEED = 460;
export const SLING_RELEASE = 0.15, SLING_DUR = 0.31, SPECIAL_DUR = 0.55;
const DROP_EVERY = 2, PICKUP_LIFE = 9; // every 2nd knockout drops a stone; it lies there 9 s
export const PICKUP_FADE = PICKUP_LIFE - 2; // starts blinking this long after it lands
const SHEEP_BONUS = 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const between = (rng: () => number, a: number, b: number) => Math.floor(rng() * (b - a + 1) + a);

/** One frame of player input (keyboard, touch and gamepad already merged; the action flags are "pressed this frame"). */
export interface Input { x: number; y: number; run: boolean; attack: boolean; jump: boolean; sling: boolean; spin: boolean; ally: boolean; special: boolean }
export interface Stone { x: number; y: number; z: number; dir: 1 | -1 }
/** Enemy projectile: an archer's arrow or Saul's spear. */
export interface Shot { x: number; y: number; z: number; dir: 1 | -1; speed: number; dmg: number; knock: boolean; spear: boolean; passed: boolean }
/** Adullam companion charging across the screen. */
export interface Rusher { id: string; x: number; y: number; hitSet: Set<Actor> }
/** A captive in the Amalekite camp, freed by walking up and pressing attack. */
export interface Bound { c: Captive; x: number; done: boolean }
export interface Pickup { x: number; y: number; t: number }

export type Sound = 'swing' | 'hit' | 'heavy' | 'sling' | 'jump' | 'hurt' | 'clank' | 'harp' | 'bark' | 'roar' | 'baa' | 'special';
/** Something to show or play, right when it happens. */
export type Fx =
  | { type: 'pop'; text: string; x: number; y: number; big: boolean }
  | { type: 'say'; text: string; x: number; y: number }
  | { type: 'shake'; ms: number; amount: number }
  | { type: 'flash'; ms: number; r: number; g: number; b: number }
  | { type: 'sound'; name: Sound }
  | { type: 'tip'; text: string }
  | { type: 'hint'; hint: Hint }
  | { type: 'struck'; target: Actor; out: HitOutcome; dir: 1 | -1 } // spark, shake, sound, "퍽!"
  | { type: 'opening'; x: number; y: number; facing: 1 | -1 } // Goliath is stuck: "빈틈!" at his forehead
  | { type: 'goliathTaunt'; x: number; y: number }
  | { type: 'dropped'; k: Pickup } // a stone to pick up
  | { type: 'tauntOver' }
  | { type: 'vanish'; who: Actor } // an enemy left the field
  | { type: 'spin' } | { type: 'special' } | { type: 'harp' }
  | { type: 'stealthStart'; section: Section; run: StealthRun }
  | { type: 'took'; i: number; goal: Goal }
  | { type: 'caught'; x: number; y: number }
  | { type: 'stealthDone' }
  | { type: 'captives' }
  | { type: 'freed'; b: Bound }
  | { type: 'ended'; how: 'clear' | 'dead'; kept: number; bonus: number };

export class StageSim {
  readonly stage: StageDef;
  player: Actor;
  enemies: Actor[] = [];
  stones: Stone[] = [];
  pickups: Pickup[] = [];
  flock: SheepBody[] = [];
  sheepLost = 0;
  ammo: number;
  kos = 0;
  quake: { x: number; y: number; t: number; hit: boolean } | null = null;
  brookT = 0;
  shots: Shot[] = [];
  rushers: Rusher[] = [];
  allyCd = 0;
  stealthRun: StealthRun | null = null;
  stealthEvents: StealthEvent[] = []; // this frame's (the dev bot counts catches from these)
  bound: Bound[] = [];
  saulDodged = 0;
  royalWarnAt = -9;
  prog: Prog;
  camX: number;
  hitstop = 0;
  atkBuf = 0; // remembers an attack press (incl. during hitstop) for a short window
  slingCd = 0;
  faith = 40;
  time0 = 0;
  score: number;
  hintsShown: number;
  lastHit: Actor | null = null;
  ended: 'clear' | 'dead' | null = null;
  endAt = 0;
  /** Set once the stage is over and the player moves on: retry from a section after a fall, or go on after a clear. */
  exit: { retry: number } | { next: true } | null = null;
  private input!: Input;

  /** section > 0: retrying after a fall (see startAt). fx: shows and plays effects as they happen. rng: all the game's randomness. */
  readonly stageId: string;
  private fx: (e: Fx) => void;
  private rng: () => number;
  constructor(stageId: string, section: number, score: number, fx: (e: Fx) => void = () => {}, rng: () => number = () => Math.random()) {
    this.stageId = stageId; this.fx = fx; this.rng = rng;
    this.stage = STAGES[stageId];
    this.ammo = this.stage.ammo ?? STONE_MAX;
    const start = startAt(this.stage, section);
    this.prog = start.prog; this.camX = start.camX; this.hintsShown = start.hintsShown;
    this.score = score;
    this.player = newFighter(this.stage.sword ? 'davidS' : 'david', '다윗', start.playerX, 210, 100);
    for (let i = 0; i < this.stage.sheep; i++) {
      this.flock.push({ i, x: start.playerX - 30 - (i % 3) * 18, y: 186 + ((i * 13) % 50), facing: 1, moving: false, carrier: null });
    }
  }

  private pop(text: string, x: number, y: number, big: boolean) { this.fx({ type: 'pop', text, x, y, big }); }
  private say(text: string, x: number, y: number) { this.fx({ type: 'say', text, x, y }); }
  private sound(name: Sound) { this.fx({ type: 'sound', name }); }
  private shake(ms: number, amount: number) { this.fx({ type: 'shake', ms, amount }); }
  private tip(text: string) { this.fx({ type: 'tip', text }); }

  /* ---------- the frame ---------- */
  step(dt: number, input: Input) {
    this.input = input;
    this.time0 += dt;
    const T = this.time0;
    this.stealthEvents = [];
    if (input.attack) this.atkBuf = 0.2;

    if (this.ended) {
      const go = (input.attack || input.jump) && T > this.endAt + 0.6;
      if (go && this.ended === 'dead') this.exit = { retry: this.prog.section }; // retry this section, full health
      if ((go || T > this.endAt + 4) && this.ended === 'clear') this.exit = { next: true };
    } else if (this.hitstop > 0) {
      this.hitstop -= dt;
    } else {
      for (const f of [this.player, ...this.enemies]) { f.t += dt; f.flash = Math.max(0, f.flash - dt); }
      this.slingCd = Math.max(0, this.slingCd - dt);
      this.updatePlayer(dt);
      for (const e of this.enemies) for (const it of think(e, this.world(), dt)) this.act(e, it);
      this.updateStones(dt);
      for (const e of this.enemies.filter(e => e.state === 'dead' && e.t > 0.6 && !e.g)) {
        e.gone = true; this.fx({ type: 'vanish', who: e });
        if (++this.kos % (this.stage.brook ? 1 : DROP_EVERY) === 0) this.dropStone(e.x, e.y);
      }
      this.enemies = this.enemies.filter(e => !e.gone);
      this.updatePickups(dt);
      this.updateQuake(dt);
      this.updateShots(dt);
      this.updateRushers(dt);
      this.allyCd = Math.max(0, this.allyCd - dt);
      this.updateBrook(dt);
      this.showHint();

      this.updateStealth(dt);
      this.updateCaptives();
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
    this.updateFlock(dt);

    // camera: only moves forward; locks onto the section while a fight is on
    const target = cameraTarget(this.prog, this.stage.sections, this.camX, this.player.x);
    this.camX = clamp(this.camX + (target - this.camX) * Math.min(1, dt * 8), 0, this.stage.width - 480);

    const end = verdict(this.prog, this.player.state === 'dead');
    if (!this.ended && end) {
      this.ended = end;
      this.endAt = T;
      const kept = this.flock.length, bonus = end === 'clear' ? kept * SHEEP_BONUS : 0;
      this.score += bonus;
      this.fx({ type: 'ended', how: end, kept, bonus });
    }
  }

  /* ---------- enemies ---------- */
  private spawn(list: Spawn[]) {
    for (const s of list) {
      const kind = s.t ?? 'philA', d: EnemyDef = ENEMIES[kind];
      const e = newFighter(kind, d.name, this.camX + s.x, s.y, d.hp);
      e.kind = kind;
      arrive(e, s, list, this.camX, this.enemies, this.rng);
      if (e.g) this.fx({ type: 'goliathTaunt', x: this.camX + s.x - 34, y: s.y - 84 }); // speech bubble at his mouth, clear of the tip line above
      this.enemies.push(e);
      if (d.boss) {
        this.shake(500, 0.01);
        this.sound('roar');
        this.pop(kind === 'lion' ? '크아앙!!' : '크르릉!!', this.camX + 380, 120, true);
      } else if (kind === 'jackal') this.sound('bark');
    }
  }

  private world(): World {
    return { player: this.player, enemies: this.enemies, camX: this.camX, locked: this.prog.locked, shots: this.shots, flock: this.flock, saulDodged: this.saulDodged, rng: this.rng };
  }

  /** Carry out what an enemy decided (fighters.ts). */
  private act(e: Actor, it: Intent) {
    switch (it.type) {
      case 'strike': this.applyHit(this.player, it.attack, it.dir); break;
      case 'fire': this.fire(e, it.spear, it.lane); break;
      case 'quake': this.quake = { x: it.x, y: it.y, t: 0, hit: false }; break;
      case 'say': this.say(it.text, it.x, it.y); break;
      case 'pop': this.pop(it.text, it.x, it.y, true); break;
      case 'opening': this.fx(it); break;
      case 'shake': this.shake(it.ms, it.amount); break;
      case 'sound': this.sound(it.name); break;
      case 'tauntOver': this.fx(it); break;
      case 'grab': this.sound('baa'); this.say('메에!', it.sheep.x, it.sheep.y - 34); break;
      case 'stole':
        this.flock = this.flock.filter(o => o !== it.sheep);
        this.sheepLost++;
        this.say('양을 빼앗겼다!', this.player.x, this.player.y - 70);
        break;
      case 'vanish': this.fx({ type: 'vanish', who: e }); break;
    }
  }

  /** The rules live in resolveHit (hit.ts); this applies what it says happened to the rest of the stage. */
  private applyHit(target: Actor, a: Attack, dir: 1 | -1, special = false, src: 'staff' | 'stone' = 'staff') {
    const out = resolveHit(target, a, dir, { hitstop: this.hitstop, score: this.score, faith: this.faith }, { special, src });
    ({ hitstop: this.hitstop, score: this.score, faith: this.faith } = out.m);
    target.flash = 0.07;
    if (target !== this.player) this.lastHit = target;
    const K = KB * 1.6; // Goliath's scale
    for (const ev of out.events) {
      switch (ev.type) {
        case 'reinforce': this.spawn(ev.spawns); this.pop(ev.shout, this.camX + 240, 90, true); break;
        case 'stoneBounced': this.dropStone(target.x - dir * 34, target.y); break; // bounced off the bronze: pick it up again
        case 'struck': this.fx({ type: 'struck', target, out, dir }); break;
        case 'sheepDropped': this.say('음매~', ev.x, ev.y - 34); this.sound('baa'); break;
        case 'hint': this.say(ev.text, this.player.x, this.player.y - 70); break;
        case 'enraged':
          this.sound('roar');
          this.shake(400, 0.01);
          this.pop('크아아!!', target.x, target.y - 50 * K, true);
          this.spawn(ev.spawns);
          break;
        case 'goliathDown':
          this.fx({ type: 'flash', ms: 300, r: 255, g: 255, b: 255 });
          this.shake(600, 0.02);
          this.pop('골리앗이 쓰러졌다!', target.x, target.y - 70 * K, true);
          for (const o of this.enemies) if (o !== target && o.state !== 'dead') o.flee = true;
          this.fx({ type: 'tauntOver' });
          break;
      }
    }
  }

  private hitEnemies(a: Attack, dirFrom?: number) {
    const p = this.player;
    if (this.stage.sword) a = swordify(a);
    for (const e of this.enemies) {
      if (p.hitSet.has(e)) continue;
      if (!hittable(e, def(e))) {
        if (def(e).untouchable && standing(e) && hits(p, a.box, { x: e.x, y: e.y, z: e.z, hw: 10 })) this.royalWarning(e);
        continue;
      }
      if (hits(p, a.box, { x: e.x, y: e.y, z: e.z, hw: def(e).hw })) {
        p.hitSet.add(e);
        this.applyHit(e, a, dirFrom === undefined ? p.facing : (e.x >= dirFrom ? 1 : -1));
      }
    }
  }

  private royalWarning(e: Actor) {
    if (this.time0 - this.royalWarnAt < 1.5) return;
    this.royalWarnAt = this.time0;
    this.say('왕에게는 손댈 수 없다!', e.x, e.y - 80);
  }

  /* ---------- David ---------- */
  private playerAttack(a: Attack) {
    startAttack(this.player, a);
    this.sound('swing');
  }

  private updatePlayer(dt: number) {
    const p = this.player, c = this.input;
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
          p.state = 'jump'; p.vz = JUMP_V; p.z = 0.01; p.airAtk = false; p.hitSet.clear(); this.sound('jump');
        }
        break;
      }
      case 'jump':
        if (c.x) { p.facing = c.x as 1 | -1; p.vx = clamp(p.vx + c.x * 600 * dt, -RUN_X, RUN_X); }
        p.x += p.vx * dt; p.y += c.y * WALK_Y * 0.5 * dt;
        p.z += p.vz * dt; p.vz -= GRAV * dt;
        if (attack && !p.airAtk) { this.atkBuf = 0; p.airAtk = true; p.vz = Math.min(p.vz, 40); this.sound('swing'); }
        if (p.airAtk) this.hitEnemies(JUMP_ATTACK);
        if (p.z <= 0) {
          p.z = 0; p.vz = 0; p.vx = 0; p.state = 'idle';
          if (p.airAtk) this.shake(70, 0.004);
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
        if (turn !== Math.floor((p.t - dt) / 0.07)) { p.facing = (p.facing * -1) as 1 | -1; if (turn % 2) this.sound('swing'); }
        p.x += c.x * 70 * dt; p.y += c.y * 45 * dt;
        if (p.t >= SPIN.active[0] && p.t <= SPIN.active[1]) this.hitEnemies(SPIN, p.x);
        if (p.t >= SPIN.dur) p.state = 'idle';
        break;
      }
      case 'hurt': slide(p, dt); if (p.t > 0.25) p.state = 'idle'; break;
      case 'down': case 'dead': physicsDown(p, dt); break;
      case 'getup': if (p.t > 0.25) { p.state = 'idle'; p.inv = 1.0; } break;
    }
    p.y = clamp(p.y, FLOOR_TOP, FLOOR_BOTTOM);
    p.x = clamp(p.x, this.camX + 12, this.camX + 468);
  }

  private startSpin() {
    const p = this.player, cost = spinCost(this.faith, p.hp);
    if (!cost) { this.say('힘이 모자라!', p.x, p.y - p.z - 66); return; }
    this.faith = cost.faith; p.hp = cost.hp;
    p.state = 'spin'; p.t = 0; p.vx = 0; p.z = 0; p.vz = 0; p.hitSet.clear(); p.inv = SPIN.dur;
    this.fx({ type: 'spin' });
    this.pop('회오리!', p.x, p.y - 74, true);
    this.sound('swing');
  }

  private throwStone() {
    const p = this.player;
    this.stones.push({ x: p.x + p.facing * 30, y: p.y, z: p.z + 30 * KB, dir: p.facing });
    this.pop('슉!', p.x + p.facing * 30, p.y - p.z - 52, false);
    this.sound('sling');
  }

  private updateStones(dt: number) {
    for (const s of this.stones) {
      s.x += s.dir * STONE_SPEED * dt;
      for (const e of this.enemies) {
        if (!hittable(e, def(e))) continue;
        // the stone flies at hand height; compare against the enemy's body, not its feet
        if (hits({ x: s.x, y: s.y, z: s.z - 26 * KB, facing: s.dir }, SLING_STONE.box, { x: e.x, y: e.y, z: e.z, hw: def(e).hw })) {
          this.applyHit(e, SLING_STONE, s.dir, false, 'stone');
          s.x = Infinity;
          break;
        }
      }
    }
    this.stones = this.stones.filter(s => isFinite(s.x) && s.x >= this.camX - 40 && s.x <= this.camX + 520);
  }

  private startSpecial() {
    const p = this.player;
    this.faith = 0;
    p.state = 'special'; p.t = 0; p.inv = SPECIAL_DUR + 0.3; p.vx = 0;
    this.sound('special');
    this.fx({ type: 'flash', ms: 260, r: 255, g: 236, b: 170 });
    this.fx({ type: 'special' }); // pillar of light on David + expanding ring along the floor
    this.pop('믿음의 일격!', p.x, p.y - 80, true);
    for (const e of this.enemies) {
      if (!hittable(e, def(e), true) || e.x < this.camX - 10 || e.x > this.camX + 490) continue; // the strike also lands on enemies already down
      this.applyHit(e, { ...COMBO[2], dmg: SPECIAL_DMG }, e.x >= p.x ? 1 : -1, true);
    }
    this.hitstop = 0.2;
  }

  /** Gibeah on: the faith gauge plays the harp instead — everyone on screen nods off, David recovers (1 Sam 16:23). */
  private startHarp() {
    const p = this.player;
    this.faith = 0;
    p.state = 'harp'; p.t = 0; p.vx = 0; p.inv = HARP.dur + 0.3;
    p.hp = Math.min(p.maxHp, p.hp + HARP.heal);
    this.sound('harp');
    this.say(`+${HARP.heal}`, p.x, p.y - 70);
    this.fx({ type: 'harp' });
    this.pop('수금 연주', p.x, p.y - 82, true);
    for (const e of this.enemies) {
      if (!hittable(e, def(e)) || e.x < this.camX - 10 || e.x > this.camX + 490) continue;
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
      this.rushers.push({ id, x: this.camX - 30 - i * 24, y: clamp(p.y + (i - 1) * 18, FLOOR_TOP, FLOOR_BOTTOM), hitSet: new Set() });
    });
    this.pop('용사들아, 가자!', p.x, p.y - 80, true);
    this.sound('roar');
  }

  private updateRushers(dt: number) {
    for (const r of this.rushers) {
      r.x += ALLY_SPEED * dt;
      for (const e of this.enemies) {
        if (r.hitSet.has(e) || !hittable(e, def(e))) continue;
        if (hits({ x: r.x, y: r.y, z: 0, facing: 1 }, ALLY_RUSH.box, { x: e.x, y: e.y, z: e.z, hw: def(e).hw })) { r.hitSet.add(e); this.applyHit(e, ALLY_RUSH, 1); }
      }
    }
    this.rushers = this.rushers.filter(r => r.x <= this.camX + 540);
  }

  /* ---------- projectiles, the slam ---------- */
  private fire(e: Actor, spear: boolean, lane: number) {
    this.shots.push({ x: e.x + e.facing * 26, y: lane, z: 30 * KB, dir: e.facing, speed: spear ? SPEAR_SPEED : ARROW_SPEED, dmg: spear ? 22 : 8, knock: spear, spear, passed: false });
    this.sound('swing');
  }

  private updateShots(dt: number) {
    const p = this.player;
    for (const s of this.shots) {
      s.x += s.dir * s.speed * dt;
      const open = vulnerable(p);
      if (open && hits({ x: s.x, y: s.y, z: s.z - 26 * KB, facing: s.dir }, SHOT_BOX, { x: p.x, y: p.y, z: p.z, hw: 6 })) {
        this.applyHit(p, { ...COMBO[0], dmg: s.dmg, knock: s.knock }, s.dir);
        s.x = Infinity;
        // Saul's spear: the three dodges must come in a row
        if (s.spear && this.saulDodged > 0 && this.saulDodged < SAUL_DODGES) { this.saulDodged = 0; this.pop('처음부터 다시!', p.x, p.y - 70, true); }
      } else if (s.spear && !s.passed && (s.x - p.x) * s.dir > 24) {
        s.passed = true; this.saulDodged++;
        this.pop(this.saulDodged >= SAUL_DODGES ? '세 번 피했다!' : `피했다! ${this.saulDodged}/${SAUL_DODGES}`, p.x, p.y - 70, true);
        this.shake(80, 0.004);
      }
    }
    this.shots = this.shots.filter(s => isFinite(s.x) && s.x >= this.camX - 80 && s.x <= this.camX + 560);
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

  /* ---------- stones to pick up ---------- */
  /** A stone on the ground (the scene adds a bobbing arrow so it's easy to spot). */
  private dropStone(x: number, y: number) {
    const k = { x: clamp(x, this.camX + 24, this.camX + 456), y: clamp(y, FLOOR_TOP, FLOOR_BOTTOM), t: 0 };
    this.pickups.push(k);
    this.fx({ type: 'dropped', k });
  }

  /** Goliath arena: never leave David without a stone (see brookShouldDrop). */
  private updateBrook(dt: number) {
    if (!this.stage.brook) return;
    this.brookT += dt;
    if (!brookShouldDrop(this.ammo, this.pickups.length, this.brookT)) return;
    this.brookT = 0;
    const p = this.player;
    if (this.ammo + this.pickups.length === 0) this.dropStone(p.x + p.facing * 46, p.y); // right in front of him, same lane
    else this.dropStone(this.camX + between(this.rng, 60, 420), between(this.rng, FLOOR_TOP + 10, FLOOR_BOTTOM));
    this.say('돌이다!', this.pickups[this.pickups.length - 1].x, this.pickups[this.pickups.length - 1].y - 26);
  }

  private updatePickups(dt: number) {
    const p = this.player, keep = this.keepsPickups;
    for (const k of this.pickups) {
      k.t += dt;
      const near = Math.abs(k.x - p.x) < 20 && Math.abs(k.y - p.y) < 12 && p.z < 10;
      if (near && this.ammo < STONE_MAX) { this.ammo++; k.t = Infinity; this.say('+1 돌', p.x, p.y - 66); this.sound('jump'); }
    }
    this.pickups = this.pickups.filter(k => k.t !== Infinity && (keep || k.t < PICKUP_LIFE));
  }

  /** Arena stones never fade away. */
  get keepsPickups() { return !!this.stage.brook; }

  /* ---------- sheep ---------- */
  private updateFlock(dt: number) {
    const p = this.player;
    for (const s of this.flock) {
      if (s.carrier) {
        // dragged behind the thief
        s.x = s.carrier.x - s.carrier.facing * 20; s.y = s.carrier.y + 2; s.facing = s.carrier.facing; s.moving = true;
        continue;
      }
      const tx = clamp(p.x - 54 - (s.i % 3) * 18 + Math.floor(s.i / 3) * 10, this.camX + 16, this.camX + 464);
      const ty = clamp(p.y - 22 + ((s.i * 17) % 44), FLOOR_TOP, FLOOR_BOTTOM);
      const dx = tx - s.x, dy = ty - s.y, far = Math.hypot(dx, dy) > 10;
      s.moving = far;
      if (far) {
        const sp = Math.hypot(dx, dy) > 120 ? 160 : 85;
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        s.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * 0.6 * dt);
        if (Math.abs(dx) > 2) s.facing = dx > 0 ? 1 : -1;
      }
    }
  }

  /* ---------- Ziklag: captives (1 Sam 30) ---------- */
  private setupCaptives(sec: Section) {
    this.bound = sec.captives!.map(c => ({ c, x: sec.at + c.x, done: false }));
    this.fx({ type: 'captives' });
  }

  private updateCaptives() {
    const p = this.player;
    for (const b of this.bound) {
      if (b.done || !this.input.attack || Math.abs(b.x - p.x) > 22 || Math.abs(b.c.y - p.y) > 14) continue;
      b.done = true;
      this.fx({ type: 'freed', b });
    }
  }

  /* ---------- stealth: En-gedi cave, Ziph camp (1 Sam 24, 26) ---------- */
  private setupStealth(sec: Section) {
    const run = this.stealthRun = startStealth(sec);
    this.fx({ type: 'stealthStart', section: sec, run });
    // start from the near edge of the section, out of everyone's sight
    const p = this.player, e = entry(run); p.x = e.x; p.y = e.y; p.state = 'idle'; p.vx = 0;
    this.say('살금살금…', p.x, p.y - 70);
  }

  /** The rules live in stepStealth (stealth.ts). */
  private updateStealth(dt: number) {
    const run = this.stealthRun, p = this.player;
    if (!run) return;
    const events = this.stealthEvents = stepStealth(run, dt, p, this.input.attack);
    for (const ev of events) {
      if (ev.type === 'caught') {
        // back to the start of the section (the guards are already back at their posts). No damage.
        const e = entry(run);
        this.fx({ type: 'caught', x: p.x, y: p.y });
        p.x = e.x; p.y = e.y; p.state = 'idle'; p.vx = 0; p.z = 0; p.vz = 0;
        this.tip('들켰다! 다시 살금살금… 노란 시야를 피하고, 잠든 군사 곁에서는 달리지 마세요');
      } else if (ev.type === 'took') {
        this.fx({ type: 'took', i: run.goals.findIndex(g => g.g === ev.goal), goal: ev.goal });
        this.pop({ robe: '옷자락을 베었다!', spear: '사울의 창을 챙겼다!', jug: '물병을 챙겼다!' }[ev.goal.kind], p.x, p.y - 80, true);
        this.sound('harp');
      } else {
        // done: everyone stays asleep / at their post; lift the darkness
        this.fx({ type: 'stealthDone' });
        this.stealthRun = null;
      }
    }
  }

  private showHint() {
    const h = this.stage.hints[this.hintsShown];
    if (!h || this.player.x < h.at) return;
    this.hintsShown++;
    this.fx({ type: 'hint', hint: h });
  }
}

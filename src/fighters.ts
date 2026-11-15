// Fighters: the body physics everyone shares, and how each kind of enemy behaves.
// No Phaser here — a brain changes its own enemy and returns intents (strike David, loose an arrow, shake the screen…);
// the scene carries those out. Randomness comes in through World.rng so a run can be replayed.
import {
  hits, archerStep, camelPhase, CAMEL_SPEED, CAMEL_WARN, SAUL_DODGES, GOLIATH_THRUST, GOLIATH_SWEEP, DEPTH_TOL, ENEMIES, FLOOR_TOP, FLOOR_BOTTOM, GRAV,
  type Attack, type EnemyDef, type EnemyId, type Spawn,
} from './combat.ts';
import { standing, vulnerable } from './hit.ts';

export const MAX_ATTACKERS = 3, CHAIN_CHANCE = 0.4; // enemies swinging at once; chance to follow a swing with another

export type State = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'sling' | 'spin' | 'special' | 'harp' | 'hurt' | 'down' | 'getup' | 'dead';
export type GMode = 'taunt' | 'walk' | 'tele' | 'thrust' | 'stuck' | 'sweepA' | 'sweep' | 'jumpA' | 'jump' | 'recover' | 'stagger';
/** Goliath's own state machine: he's slow, telegraphs everything, and is only open right after an attack. */
export interface GState { mode: GMode; t: number; cd: number; lane: number; stuckFor: number; jumpVx: number; phase2: boolean; hinted: boolean }
export interface SheepBody { i: number; x: number; y: number; facing: 1 | -1; moving: boolean; carrier: Actor | null }
/** David or an enemy, without anything to draw. */
export interface Actor {
  id: string; name: string; kind?: EnemyId;
  x: number; y: number; z: number; vx: number; vz: number; facing: 1 | -1;
  hp: number; maxHp: number; state: State; t: number; inv: number; flash: number;
  atk?: Attack; combo: number; queued: boolean; hitSet: Set<Actor>; airAtk: boolean;
  ai?: { mode: 'approach' | 'ready' | 'swing' | 'back'; wait: number; side: 1 | -1; lane: number; cd: number };
  carry?: SheepBody; fights?: boolean; // sheep thief: carrying a sheep / gave up stealing
  /** gone: off the field (Goliath's is set when he's beaten; his body stays where he fell) */
  g?: GState; flee?: boolean; gone?: boolean; stun?: number; lane?: number;
}
/** What a brain can see of the world this frame. */
export interface World {
  player: Actor; enemies: Actor[]; camX: number; locked: boolean;
  shots: { spear: boolean }[]; flock: SheepBody[]; saulDodged: number;
  rng: () => number;
}
export type Intent =
  | { type: 'strike'; attack: Attack; dir: 1 | -1 } // this enemy's attack lands on David
  | { type: 'fire'; spear: boolean; lane: number }
  | { type: 'quake'; x: number; y: number } // Goliath's slam: a shockwave along the floor
  | { type: 'say'; text: string; x: number; y: number }
  | { type: 'pop'; text: string; x: number; y: number }
  | { type: 'opening'; x: number; y: number; facing: 1 | -1 } // Goliath is stuck: "빈틈!" at his forehead
  | { type: 'shake'; ms: number; amount: number }
  | { type: 'sound'; name: 'jump' | 'heavy' }
  | { type: 'tauntOver' }
  | { type: 'grab'; sheep: SheepBody }
  | { type: 'stole'; sheep: SheepBody } // a thief made it off screen with a sheep
  | { type: 'vanish' }; // this enemy left the field: remove its sprite

export const def = (e: Actor): EnemyDef => ENEMIES[e.kind ?? 'philA'];
export function newFighter(id: string, name: string, x: number, y: number, hp: number): Actor {
  return { id, name, x, y, z: 0, vx: 0, vz: 0, facing: 1, hp, maxHp: hp, state: 'idle', t: 0, inv: 0, flash: 0, combo: 0, queued: false, hitSet: new Set(), airAtk: false };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const between = (rng: () => number, a: number, b: number) => Math.floor(rng() * (b - a + 1) + a);
const floatBetween = (rng: () => number, a: number, b: number) => rng() * (b - a) + a;
const pick = <T>(rng: () => number, xs: T[]) => xs[Math.floor(rng() * xs.length)];
const body = (p: Actor) => ({ x: p.x, y: p.y, z: p.z, hw: 6 });

/* ---------- body physics (David too) ---------- */
export function startAttack(f: Actor, a: Attack) {
  f.state = 'attack'; f.t = 0; f.atk = a; f.queued = false; f.hitSet.clear();
  f.vx = f.facing * a.lunge;
}

/** Knocked-down bodies fly, slide, lie, then get up (or fade out). */
export function physicsDown(f: Actor, dt: number) {
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

export function slide(f: Actor, dt: number) {
  f.x += f.vx * dt;
  f.vx *= Math.pow(0.0005, dt);
}

/** A spawned enemy takes up its post: which side of David it goes for, its lane offset, and per-kind starting state. */
export function arrive(e: Actor, s: Spawn, list: Spawn[], camX: number, others: Actor[], rng: () => number) {
  const d = def(e);
  if (d.ai === 'goliath') e.g = { mode: 'taunt', t: 0, cd: 0, lane: s.y, stuckFor: 1.3, jumpVx: 0, phase2: false, hinted: false };
  e.facing = s.x < 240 ? 1 : -1;
  // surround: take whichever side of David has fewer enemies
  const left = others.filter(o => o.ai?.side === -1).length, right = others.length - left;
  e.ai = { mode: 'approach', wait: 0, side: left < right ? -1 : left > right ? 1 : (s.x < 240 ? -1 : 1), lane: between(rng, -5, 5), cd: 1.5 };
  if (d.ai === 'saul') { e.ai.wait = 2.2; e.ai.mode = 'ready'; } // a beat to read the tip before the first spear
  if (d.ai === 'camel') {
    // riders wait off-screen and go one after another
    e.x = s.x < 240 ? camX - 50 : camX + 530;
    e.t = -0.8 * list.slice(0, list.indexOf(s)).filter(o => o.t && ENEMIES[o.t].ai === 'camel').length;
  }
}

/* ---------- brains ---------- */
/** One frame of an enemy's behaviour, chosen by its kind's `ai`. */
export function think(e: Actor, w: World, dt: number): Intent[] {
  const out: Intent[] = [], d = def(e);
  if (d.ai === 'goliath') { goliath(e, w, dt, out); return out; }
  const ai = e.ai!;
  ai.cd = Math.max(0, ai.cd - dt);
  if (d.ai === 'saul') { saul(e, w, dt, out); return out; }
  if (e.flee && standing(e)) {
    // their champion is dead: run (1 Sam 17:51)
    const dir = e.x < w.camX + 240 ? -1 : 1;
    e.facing = dir; e.state = 'walk'; e.x += dir * 160 * dt;
    if (e.x < w.camX - 40 || e.x > w.camX + 520) { e.gone = true; out.push({ type: 'vanish' }); }
    return out;
  }
  if (e.state === 'down' || e.state === 'dead') { physicsDown(e, dt); return out; }
  if (e.state === 'hurt') { slide(e, dt); if (e.t > 0.3) { e.state = 'idle'; ai.mode = 'back'; ai.wait = 0.2; } return out; }
  if (e.state === 'getup') { if (e.t > 0.25) { e.state = 'idle'; ai.mode = 'approach'; } return out; }
  if (e.stun) { e.stun = Math.max(0, e.stun - dt); e.state = 'idle'; return out; } // soothed by the harp
  if (d.ai === 'archer') archer(e, w, dt, out);
  else if (d.ai === 'camel') camel(e, w, dt, out);
  else if (!(d.ai === 'thief' && !e.fights && thiefSteal(e, w, dt, out))) soldier(e, w, dt, out);
  return out;
}

/** Close in on a spot beside David, wait a beat, swing (at most MAX_ATTACKERS at once), back off. Bosses add a move from range. */
function soldier(e: Actor, w: World, dt: number, out: Intent[]) {
  const p = w.player, ai = e.ai!, d = def(e);
  // the spot beside David must be on screen while the fight is locked, or a boss pinned to the edge would never reach it
  if (w.locked && Math.abs(p.x + ai.side * d.reach - (w.camX + 240)) > 224) ai.side = (ai.side * -1) as 1 | -1;
  const tx = p.x + ai.side * d.reach, ty = clamp(p.y + ai.lane, FLOOR_TOP, FLOOR_BOTTOM);
  const faceP = () => { e.facing = p.x >= e.x ? 1 : -1; };
  const playerOpen = standing(p);
  // bosses: a charge / pounce from range when lined up
  const sp = d.special, dist = Math.abs(p.x - e.x);
  if (sp && ai.cd <= 0 && ai.mode !== 'swing' && playerOpen && dist >= sp.from && dist <= sp.to && Math.abs(p.y - e.y) <= DEPTH_TOL) {
    faceP(); ai.mode = 'swing'; ai.cd = sp.every; startAttack(e, sp.attack);
    return;
  }
  switch (ai.mode) {
    case 'approach': {
      const dx = tx - e.x, dy = ty - e.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 4) { ai.mode = 'ready'; ai.wait = floatBetween(w.rng, 0.05, 0.35); e.state = 'idle'; break; }
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
      const swinging = w.enemies.filter(o => o.ai?.mode === 'swing').length;
      if (ai.wait <= 0) {
        if (swinging < MAX_ATTACKERS && playerOpen && Math.abs(e.y - p.y) <= DEPTH_TOL) { ai.mode = 'swing'; startAttack(e, d.attack); }
        else ai.wait = 0.12;
      }
      break;
    }
    case 'swing': {
      const a = e.atk!;
      if (a.keep && e.t >= a.active[0] - dt) e.x += e.vx * dt; else slide(e, dt);
      if (a.leap && e.t >= a.active[0] && e.t - dt < a.active[0]) e.vz = a.leap;
      if (e.z > 0 || e.vz > 0) {
        e.z += e.vz * dt; e.vz -= GRAV * dt;
        if (e.z <= 0) { e.z = 0; e.vz = 0; e.vx = 0; out.push({ type: 'shake', ms: 90, amount: 0.006 }); }
      }
      if (e.t >= a.active[0] && e.t <= a.active[1] && !e.hitSet.has(p) && vulnerable(p) && hits(e, a.box, body(p))) {
        e.hitSet.add(p); out.push({ type: 'strike', attack: a, dir: e.facing });
      }
      if (e.t >= a.dur && e.z <= 0) {
        const stillClose = dist < d.reach + 14 && Math.abs(p.y - e.y) <= DEPTH_TOL && playerOpen;
        if (!a.keep && stillClose && w.rng() < CHAIN_CHANCE) { faceP(); startAttack(e, d.attack); }
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
  e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOTTOM);
  if (d.boss) e.x = clamp(e.x, w.camX + 16, w.camX + 464);
}

/** Archer: keep ~110-170px away on David's lane, draw (warning line), loose, reposition. */
function archer(e: Actor, w: World, dt: number, out: Intent[]) {
  const p = w.player, ai = e.ai!, d = def(e), dist = Math.abs(p.x - e.x), toward = Math.sign(p.x - e.x) || 1;
  e.facing = toward as 1 | -1;
  if (ai.mode === 'swing') {
    const a = e.atk!;
    if (e.t >= a.active[0] && e.t - dt < a.active[0]) out.push({ type: 'fire', spear: false, lane: e.lane ?? e.y });
    if (e.t >= a.dur) { ai.mode = 'approach'; ai.cd = floatBetween(w.rng, 1.2, 2.2); e.state = 'idle'; }
    return;
  }
  const step = archerStep(dist), ty = clamp(p.y + ai.lane, FLOOR_TOP, FLOOR_BOTTOM);
  e.x += step * toward * d.speed * dt;
  e.y += Math.sign(ty - e.y) * Math.min(Math.abs(ty - e.y), d.speed * 0.7 * dt);
  e.state = step || Math.abs(ty - e.y) > 2 ? 'walk' : 'idle';
  e.x = clamp(e.x, w.camX + 16, w.camX + 464);
  if (ai.cd <= 0 && Math.abs(p.y - e.y) <= 10 && dist < 220 && standing(p)) {
    ai.mode = 'swing'; e.lane = e.y; startAttack(e, d.attack);
  }
}

/** King Saul: can't be fought. He raises the spear over David's lane and hurls it — dodge it three times (1 Sam 18:11, 19:10). */
function saul(e: Actor, w: World, dt: number, out: Intent[]) {
  const p = w.player, ai = e.ai!;
  e.facing = p.x >= e.x ? 1 : -1;
  if (w.saulDodged >= SAUL_DODGES) {
    // he storms off; the court is open
    e.state = 'walk'; e.facing = 1; e.x += 70 * dt;
    if (e.x > w.camX + 520) { e.gone = true; out.push({ type: 'vanish' }); }
    return;
  }
  if (ai.mode === 'swing') {
    const a = e.atk!;
    if (e.t >= a.active[0] && e.t - dt < a.active[0]) out.push({ type: 'fire', spear: true, lane: e.lane ?? p.y });
    if (e.t >= a.dur) { ai.mode = 'ready'; ai.wait = floatBetween(w.rng, 0.7, 1.3); e.state = 'idle'; }
    return;
  }
  e.state = 'idle';
  ai.wait -= dt;
  const inFlight = w.shots.some(s => s.spear);
  if (ai.wait <= 0 && !inFlight && standing(p)) {
    ai.mode = 'swing'; e.lane = p.y; startAttack(e, def(e).attack);
    out.push({ type: 'say', text: pick(w.rng, ['다윗을 벽에 박으리라!', '네 이놈…!', '받아라!']), x: e.x, y: e.y - 82 });
  }
}

/** Camel rider: waits off-screen, then (warning line on David's lane) gallops across and leaves. */
function camel(e: Actor, w: World, dt: number, out: Intent[]) {
  const p = w.player;
  if (e.t < 0) return;
  if (e.lane === undefined) e.lane = p.y;
  e.y = e.lane;
  if (camelPhase(e.t) === 'warn') { e.state = 'idle'; return; }
  e.state = 'walk';
  e.x += e.facing * CAMEL_SPEED * dt;
  const a = def(e).attack;
  if (!e.hitSet.has(p) && vulnerable(p) && hits(e, a.box, body(p))) { e.hitSet.add(p); out.push({ type: 'strike', attack: a, dir: e.facing }); }
  if ((e.facing > 0 && e.x > w.camX + 540) || (e.facing < 0 && e.x < w.camX - 60)) { e.gone = true; out.push({ type: 'vanish' }); }
}

/** Sheep thief: walk to a free sheep, grab it, drag it off the nearer screen edge. Returns false when there's nothing to steal. */
function thiefSteal(e: Actor, w: World, dt: number, out: Intent[]): boolean {
  if (e.carry) {
    const dir: 1 | -1 = e.x < w.camX + 240 ? -1 : 1;
    e.facing = (dir * -1) as 1 | -1; // walks backwards, pulling the sheep
    e.x += dir * 55 * dt; e.state = 'walk';
    if (e.x < w.camX - 30 || e.x > w.camX + 510) { out.push({ type: 'stole', sheep: e.carry }, { type: 'vanish' }); e.gone = true; } // gone with the sheep
    return true;
  }
  const free = w.flock.filter(s => !s.carrier);
  if (!free.length) return false;
  const s = free.reduce((a, b) => (Math.abs(a.x - e.x) < Math.abs(b.x - e.x) ? a : b));
  const dx = s.x - e.x, dy = s.y - e.y;
  if (Math.abs(dx) < 16 && Math.abs(dy) < 6) { e.carry = s; s.carrier = e; out.push({ type: 'grab', sheep: s }); return true; }
  e.x += Math.sign(dx) * Math.min(Math.abs(dx), def(e).speed * dt);
  e.y += Math.sign(dy) * Math.min(Math.abs(dy), def(e).speed * 0.7 * dt);
  e.facing = dx >= 0 ? 1 : -1; e.state = 'walk';
  return true;
}

/** Goliath (1 Sam 17): slow, every attack warned; open (stuck) only right after a thrust or a slam. */
function goliath(e: Actor, w: World, dt: number, out: Intent[]) {
  const g = e.g!, p = w.player;
  if (e.state === 'down' || e.state === 'dead') { physicsDown(e, dt); if (e.state === 'dead') e.gone = true; return; }
  g.t += dt; g.cd = Math.max(0, g.cd - dt);
  const go = (m: GMode) => { g.mode = m; g.t = 0; };
  const dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y;
  const open = standing(p);
  const strike = (a: Attack) => {
    if (e.t >= a.active[0] && e.t <= a.active[1] && !e.hitSet.has(p) && vulnerable(p) && hits(e, a.box, body(p))) {
      e.hitSet.add(p); out.push({ type: 'strike', attack: a, dir: e.facing });
    }
  };
  switch (g.mode) {
    case 'taunt':
      if (g.t > 2.4) { out.push({ type: 'tauntOver' }); go('walk'); }
      break;
    case 'walk':
      e.facing = dx >= 0 ? 1 : -1;
      if (adx > 95) e.x += Math.sign(dx) * 34 * dt; else if (adx < 70) e.x -= Math.sign(dx) * 22 * dt;
      e.y += Math.sign(dy) * Math.min(Math.abs(dy), 24 * dt);
      if (g.cd <= 0 && open) {
        if (adx < 58 && Math.abs(dy) < 16) go('sweepA');
        else if (g.phase2 && w.rng() < 0.35) go('jumpA');
        else if (adx <= 150 && Math.abs(dy) <= 14) { g.lane = e.y; go('tele'); }
      }
      break;
    case 'tele': // red warning line along his lane, then the thrust
      if (g.t > 0.65) { go('thrust'); startAttack(e, GOLIATH_THRUST); }
      break;
    case 'thrust':
      slide(e, dt); strike(GOLIATH_THRUST);
      if (g.t > 0.25) { g.stuckFor = 1.3; go('stuck'); out.push({ type: 'opening', x: e.x, y: e.y, facing: e.facing }); }
      break;
    case 'sweepA':
      if (g.t > 0.45) { go('sweep'); startAttack(e, GOLIATH_SWEEP); }
      break;
    case 'sweep':
      strike(GOLIATH_SWEEP);
      if (g.t > 0.25) go('recover');
      break;
    case 'jumpA':
      if (g.t > 0.5) { go('jump'); e.vz = 300; g.jumpVx = clamp(dx, -220, 220) / 0.8; out.push({ type: 'sound', name: 'jump' }); }
      break;
    case 'jump':
      e.x += g.jumpVx * dt; e.z += e.vz * dt; e.vz -= GRAV * dt;
      if (e.z <= 0) {
        e.z = 0; e.vz = 0;
        out.push({ type: 'quake', x: e.x, y: e.y }, { type: 'shake', ms: 300, amount: 0.016 }, { type: 'sound', name: 'heavy' }, { type: 'pop', text: '쿵!!', x: e.x, y: e.y - 10 });
        g.stuckFor = 0.9; go('stuck'); out.push({ type: 'opening', x: e.x, y: e.y, facing: e.facing });
      }
      break;
    case 'stuck': if (g.t > g.stuckFor) go('recover'); break;
    case 'stagger': if (g.t > 0.9) go('recover'); break;
    case 'recover': if (g.t > 0.4) { go('walk'); g.cd = g.phase2 ? 0.4 : 0.9; } break;
  }
  e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOTTOM);
  e.x = clamp(e.x, w.camX + 30, w.camX + 450);
}

/* ---------- warnings ---------- */
/** A red line on the floor before a strong attack: from x0 toward x1 along lane y; arrows show which way it comes. */
export interface Telegraph {
  y: number; x0: number; x1: number; half: number; strong: boolean;
  arrows?: { from: number; step: number; n: number; size: number; dir: 1 | -1 };
}
/**
 * Every attack being warned right now: arrows and spears being aimed, charges winding up, camel riders about to gallop,
 * Goliath's thrust. The scene draws these; anything dodging (the dev bot) reads the same list.
 */
export function telegraphs(enemies: Actor[], camX: number): Telegraph[] {
  const out: Telegraph[] = [];
  for (const e of enemies) {
    const d = def(e), aiming = e.ai?.mode === 'swing' && e.atk && e.t < e.atk.active[0];
    if (aiming && (d.ai === 'archer' || d.ai === 'saul')) {
      const x0 = e.x + e.facing * 24, len = d.ai === 'saul' ? 480 : 200;
      out.push({ y: e.lane ?? e.y, x0, x1: x0 + e.facing * len, half: d.ai === 'saul' ? 6 : 3, strong: d.ai === 'saul' });
    }
    if (aiming && e.atk!.keep) {
      const x0 = e.x + e.facing * 20;
      out.push({ y: e.y, x0, x1: x0 + e.facing * 260, half: 6, strong: true });
    }
    if (d.ai === 'camel' && e.t >= 0 && e.t < CAMEL_WARN && e.lane !== undefined) {
      out.push({ y: e.lane, x0: camX, x1: camX + 480, half: 7, strong: true, arrows: { from: camX + (e.facing > 0 ? 30 : 450), step: e.facing * 56, n: 8, size: 7, dir: e.facing } });
    }
  }
  for (const e of enemies) {
    if (def(e).ai !== 'goliath' || !standing(e) || e.g?.mode !== 'tele') continue;
    const x0 = e.x + e.facing * 24;
    out.push({ y: e.g.lane, x0, x1: e.x + e.facing * 140, half: 6, strong: true, arrows: { from: x0 + e.facing * 14, step: e.facing * 22, n: 5, size: 6, dir: e.facing } });
  }
  return out;
}

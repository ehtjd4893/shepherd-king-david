// Pure combat + stage-progress rules. No Phaser here, so node --test can run it directly.

export const DEPTH_TOL = 12; // px of floor depth (y) within which two fighters share a lane

export interface Body { x: number; y: number; z: number; facing: 1 | -1 }
export interface Target { x: number; y: number; z: number; hw: number }
/** Hitbox in front of the attacker: forward distance range and how high it reaches. */
export interface Box { from: number; to: number; height: number }

export function hits(a: Body, box: Box, t: Target): boolean {
  if (Math.abs(a.y - t.y) > DEPTH_TOL) return false;
  const dx = (t.x - a.x) * a.facing;
  if (dx + t.hw < box.from || dx - t.hw > box.to) return false;
  return Math.abs(a.z - t.z) < box.height;
}

/** lunge = forward push (px/s) given when the move starts; keep = hold that speed for the whole move (charges); leap = upward speed at active start (pounces). */
export interface Attack { pose: string; dur: number; active: [number, number]; box: Box; dmg: number; knock: boolean; lunge: number; keep?: boolean; leap?: number }

// David's staff combo (reach measured from the draft sprites at battle scale). Fast in, short recovery.
export const COMBO: Attack[] = [
  { pose: 'atk1', dur: 0.15, active: [0.03, 0.09], box: { from: 0, to: 46, height: 30 }, dmg: 8, knock: false, lunge: 90 },
  { pose: 'atk2', dur: 0.19, active: [0.07, 0.13], box: { from: 0, to: 40, height: 34 }, dmg: 10, knock: false, lunge: 90 },
  { pose: 'atk3', dur: 0.28, active: [0.06, 0.15], box: { from: -6, to: 44, height: 44 }, dmg: 16, knock: true, lunge: 150 },
];
/** Run + attack: staff thrust carried by momentum. */
export const DASH_ATTACK: Attack = { pose: 'atk1', dur: 0.3, active: [0.02, 0.2], box: { from: 0, to: 48, height: 32 }, dmg: 14, knock: true, lunge: 260 };
/** Attack in the air: overhead smash until landing. */
export const JUMP_ATTACK: Attack = { pose: 'atk2', dur: 1, active: [0.04, 1], box: { from: -4, to: 40, height: 46 }, dmg: 12, knock: true, lunge: 0 };
/** Sling stone hitbox around the flying stone. */
export const SLING_STONE: Attack = { pose: 'release', dur: 0, active: [0, 0], box: { from: -8, to: 8, height: 44 }, dmg: 9, knock: true, lunge: 0 };
export const SPECIAL_DMG = 18, FAITH_MAX = 100, FAITH_PER_HIT = 7, FAITH_PER_KO = 10;
export const STONE_MAX = 5;

/** Staff whirlwind: hits all around, knocks down, David can't be hit while spinning. */
export const SPIN: Attack = { pose: 'atk1', dur: 0.42, active: [0.04, 0.34], box: { from: -46, to: 46, height: 40 }, dmg: 12, knock: true, lunge: 0 };
export const SPIN_FAITH = 25, SPIN_HP = 6;
/** The spin costs faith when there is enough, otherwise a little health — never the last of it. null = can't spin. */
export function spinCost(faith: number, hp: number): { faith: number; hp: number } | null {
  if (faith >= SPIN_FAITH) return { faith: faith - SPIN_FAITH, hp };
  if (hp > SPIN_HP) return { faith, hp: hp - SPIN_HP };
  return null;
}

export const SOLDIER_SLASH: Attack = { pose: 'atk', dur: 0.36, active: [0.2, 0.28], box: { from: 0, to: 36, height: 30 }, dmg: 10, knock: false, lunge: 110 };
/** Spearman: lunges in from further away, telegraphs a little longer. */
export const SOLDIER_THRUST: Attack = { pose: 'atk', dur: 0.48, active: [0.28, 0.38], box: { from: 0, to: 56, height: 30 }, dmg: 12, knock: false, lunge: 170 };
const BITE: Attack = { pose: 'atk', dur: 0.32, active: [0.14, 0.22], box: { from: 0, to: 30, height: 24 }, dmg: 7, knock: false, lunge: 210 };
const CLUB: Attack = { pose: 'atk', dur: 0.38, active: [0.22, 0.3], box: { from: 0, to: 34, height: 30 }, dmg: 9, knock: false, lunge: 100 };
const BEAR_SWIPE: Attack = { pose: 'atk', dur: 0.7, active: [0.42, 0.54], box: { from: 0, to: 52, height: 50 }, dmg: 16, knock: true, lunge: 60 };
const BEAR_CHARGE: Attack = { pose: 'atk', dur: 0.95, active: [0.45, 0.9], box: { from: -4, to: 40, height: 40 }, dmg: 14, knock: true, lunge: 240, keep: true };
const LION_CLAW: Attack = { pose: 'atk', dur: 0.42, active: [0.22, 0.32], box: { from: 0, to: 46, height: 40 }, dmg: 13, knock: false, lunge: 150 };
const LION_POUNCE: Attack = { pose: 'atk', dur: 0.95, active: [0.45, 0.9], box: { from: -6, to: 42, height: 46 }, dmg: 18, knock: true, lunge: 240, keep: true, leap: 230 };

/** Archer: aim (bow drawn, warning line), loose at active[0]; the arrow itself does the damage. */
/** Philistine captain: crouches behind his shield, then charges down the lane. */
const SHIELD_CHARGE: Attack = { pose: 'atk', dur: 0.9, active: [0.45, 0.85], box: { from: -4, to: 40, height: 40 }, dmg: 14, knock: true, lunge: 230, keep: true };
const ARROW_SHOT: Attack = { pose: 'atk', dur: 0.8, active: [0.6, 0.6], box: { from: 0, to: 0, height: 0 }, dmg: 8, knock: false, lunge: 0 };
/** Saul: raise the spear over the lane for a moment, then hurl it. */
const SAUL_THROW: Attack = { pose: 'throw', dur: 1.1, active: [0.8, 0.8], box: { from: 0, to: 0, height: 0 }, dmg: 22, knock: true, lunge: 0 };

export interface EnemyDef {
  name: string; hp: number; speed: number; reach: number; hw: number; attack: Attack;
  ai: 'soldier' | 'thief' | 'goliath' | 'archer' | 'saul'; boss?: boolean; scale?: number;
  /** King Saul: David will not raise his hand against the LORD's anointed (1 Sam 24:6) */
  untouchable?: boolean;
  /** extra move used from a distance (bear charge, lion pounce) */
  special?: { attack: Attack; from: number; to: number; every: number };
}
export const ENEMIES = {
  philA: { name: '블레셋 보병', hp: 40, speed: 95, reach: 34, hw: 6, attack: SOLDIER_SLASH, ai: 'soldier' },
  philB: { name: '블레셋 창병', hp: 32, speed: 85, reach: 62, hw: 6, attack: SOLDIER_THRUST, ai: 'soldier' },
  jackal: { name: '자칼', hp: 18, speed: 150, reach: 30, hw: 9, attack: BITE, ai: 'soldier' },
  raider: { name: '광야 약탈자', hp: 30, speed: 95, reach: 34, hw: 6, attack: CLUB, ai: 'soldier' },
  thief: { name: '양 도둑', hp: 30, speed: 90, reach: 34, hw: 6, attack: CLUB, ai: 'thief' },
  bear: { name: '곰', hp: 150, speed: 62, reach: 44, hw: 16, attack: BEAR_SWIPE, ai: 'soldier', boss: true, special: { attack: BEAR_CHARGE, from: 110, to: 260, every: 3.5 } },
  philD: { name: '블레셋 궁수', hp: 26, speed: 80, reach: 150, hw: 6, attack: ARROW_SHOT, ai: 'archer' },
  saul: { name: '사울 왕', hp: 9999, speed: 0, reach: 0, hw: 8, attack: SAUL_THROW, ai: 'saul', untouchable: true },
  captain: { name: '블레셋 대장', hp: 160, speed: 85, reach: 38, hw: 8, attack: SOLDIER_SLASH, ai: 'soldier', boss: true, scale: 1.3, special: { attack: SHIELD_CHARGE, from: 90, to: 240, every: 3 } },
  philC: { name: '방패병', hp: 44, speed: 70, reach: 34, hw: 6, attack: SOLDIER_SLASH, ai: 'soldier' },
  goliath: { name: '골리앗', hp: 100, speed: 34, reach: 90, hw: 22, attack: SOLDIER_THRUST, ai: 'goliath', boss: true, scale: 1.6 },
  lion: { name: '사자', hp: 200, speed: 120, reach: 42, hw: 15, attack: LION_CLAW, ai: 'soldier', boss: true, special: { attack: LION_POUNCE, from: 80, to: 180, every: 2.4 } },
} satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;

/** How a hit lands: bosses shrug off light hits and only stagger on heavy ones; anyone at 0 hp goes down. */
export function reaction(boss: boolean, heavy: boolean, dead: boolean): 'down' | 'hurt' | 'armor' {
  if (dead) return 'down';
  if (!boss) return heavy ? 'down' : 'hurt';
  return heavy ? 'hurt' : 'armor';
}

export const DOUBLE_TAP = 0.25; // s between two taps of the same direction to start running
/** Same direction tapped twice quickly → run. */
export function isDoubleTap(prevDir: number, prevAt: number, dir: number, now: number): boolean {
  return dir !== 0 && dir === prevDir && now - prevAt <= DOUBLE_TAP;
}

export interface Spawn { x: number; y: number; t?: EnemyId } // x is relative to the section's screen (0..480); <0 or >480 = walks in
/** Stealth section (1 Sam 24, 26): Saul's men can't be fought; take the goals without being caught. Positions are screen-relative. */
export interface Guard { x: number; y: number; from?: number; to?: number; asleep?: boolean }
export interface Goal { x: number; y: number; kind: 'robe' | 'spear' | 'jug' }
export interface Stealth { mood: 'cave' | 'night'; saul: { x: number; y: number }; guards: Guard[]; goals: Goal[] }
export interface Section { at: number; waves: Spawn[][]; stealth?: Stealth }
export interface Prog { section: number; wave: number; locked: boolean; done: boolean }

export const LOCK_AT = 200; // player reaching section.at + LOCK_AT locks the screen

/** Advance stage progress. Returns the wave to spawn, if any. Waves move on only when nobody is left alive. */
export function stepProg(p: Prog, sections: Section[], playerX: number, alive: number): { p: Prog; spawn: Spawn[] | null } {
  if (p.done) return { p, spawn: null };
  const s = sections[p.section];
  if (!p.locked) {
    if (playerX < s.at + LOCK_AT) return { p, spawn: null };
    return { p: { ...p, locked: true, wave: 0 }, spawn: s.waves[0] };
  }
  if (alive > 0) return { p, spawn: null };
  if (p.wave + 1 < s.waves.length) return { p: { ...p, wave: p.wave + 1 }, spawn: s.waves[p.wave + 1] };
  const next = p.section + 1;
  return { p: { section: next, wave: 0, locked: false, done: next >= sections.length }, spawn: null };
}

// ---------- Goliath (1 Sam 17) ----------
export const GOLIATH_CRIT = 25;
/** The long spear thrust after the red warning line, and the close-range sweep. */
export const GOLIATH_THRUST: Attack = { pose: 'atk', dur: 0.25, active: [0, 0.25], box: { from: 0, to: 118, height: 50 }, dmg: 20, knock: true, lunge: 120 };
export const GOLIATH_SWEEP: Attack = { pose: 'sweep', dur: 0.25, active: [0, 0.2], box: { from: -40, to: 72, height: 50 }, dmg: 14, knock: true, lunge: 0 };
export const GOLIATH_SLAM_DMG = 12;

/**
 * Damage Goliath takes. His bronze armor stops the staff from the front (1) and halves it from behind;
 * a sling stone only counts while he is open after an attack (forehead, 25). Only a stone can finish him.
 */
export function goliathDamage(hp: number, src: 'staff' | 'stone', open: boolean, fromFront: boolean, dmg: number): { dmg: number; crit: boolean; blocked: boolean } {
  if (src === 'stone') return open ? { dmg: GOLIATH_CRIT, crit: true, blocked: false } : { dmg: 2, crit: false, blocked: true };
  const d = fromFront ? 1 : Math.ceil(dmg / 2);
  return { dmg: Math.min(d, hp - 1), crit: false, blocked: fromFront };
}

/**
 * Goliath arena stone supply, so a miss never makes the fight unwinnable:
 * out of stones entirely → one appears right away; just running low → top up slowly.
 */
export const BROOK_EMPTY_DELAY = 1, BROOK_LOW_EVERY = 6;
export function brookShouldDrop(ammo: number, onGround: number, since: number): boolean {
  if (ammo + onGround === 0) return since >= BROOK_EMPTY_DELAY;
  return ammo + onGround < 3 && since >= BROOK_LOW_EVERY;
}

// ---------- Gibeah (1 Sam 18-19) ----------
export const ARROW_SPEED = 250, SPEAR_SPEED = 330, SAUL_DODGES = 3;
/** Projectile hitbox around the arrow/spear; height lets a jump clear it. */
export const SHOT_BOX: Box = { from: -8, to: 8, height: 22 };
/** Harp (replaces the faith strike from stage 3): soothes everyone on screen — they nod off, David recovers (1 Sam 16:23). */
export const HARP = { dur: 1.2, stun: 4, dmg: 6, heal: 20 };

/** Archers keep their distance: back off when David is close, step in when far. -1 = away from David, 1 = toward. */
export function archerStep(dist: number): -1 | 0 | 1 {
  if (dist < 110) return -1;
  if (dist > 170) return 1;
  return 0;
}

// ---------- Flight (1 Sam 21-23) ----------
/** Goliath's sword (1 Sam 21:9): David's melee hits harder and reaches further from stage 4 on. */
export const SWORD_DMG = 1.5, SWORD_REACH = 6;
export function swordify(a: Attack): Attack {
  return { ...a, dmg: Math.round(a.dmg * SWORD_DMG), box: { ...a.box, to: a.box.to + SWORD_REACH } };
}
/** Adullam companions (1 Sam 22:2): three men charge across the screen, knocking down whoever they pass. */
export const ALLY_COOLDOWN = 12, ALLY_SPEED = 260;
export const ALLY_RUSH: Attack = { pose: 'walk', dur: 0, active: [0, 0], box: { from: -10, to: 12, height: 40 }, dmg: 12, knock: true, lunge: 0 };

// ---------- Stealth (1 Sam 24, 26) ----------
export const SIGHT_RANGE = 110, HEAR_RANGE = 60;
/** A patrolling guard sees a cone in front of him that widens with distance (and anyone bumping into him). */
export function seen(g: { x: number; y: number; facing: 1 | -1 }, t: { x: number; y: number }): boolean {
  const dx = (t.x - g.x) * g.facing, dy = Math.abs(t.y - g.y);
  if (Math.abs(t.x - g.x) < 14 && dy < 10) return true;
  return dx >= 0 && dx <= SIGHT_RANGE && dy <= 8 + dx * 0.22;
}
/** Sleepers (1 Sam 26:12) only stir if David runs close by. */
export function heard(g: { x: number; y: number }, t: { x: number; y: number }, running: boolean): boolean {
  return running && Math.hypot(t.x - g.x, (t.y - g.y) * 2) <= HEAR_RANGE;
}
/** Suspicion fills while sensed and drains otherwise; at 1 David is caught. Gives kids a moment to back off. */
export const SIGHT_RATE = 1.8, HEAR_RATE = 3.2; // footsteps wake a sleeper faster than a glimpse alarms a guard
export function suspicion(meter: number, sensed: boolean, dt: number, rate = SIGHT_RATE): number {
  return Math.min(1, Math.max(0, meter + (sensed ? rate : -1) * dt));
}

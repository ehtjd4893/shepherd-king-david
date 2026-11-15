// What happens when a blow lands: damage, reaction, score, faith and the knock-on events.
// No Phaser here — the scene turns the outcome into sparks, sounds and text.
import {
  reaction, goliathDamage, chiefCalls, ENEMIES, FAITH_MAX, FAITH_PER_HIT, FAITH_PER_KO, type Attack, type EnemyId, type EnemyDef, type Spawn,
} from './combat.ts';

/** On its feet: not knocked down or beaten. */
export const standing = (f: { state: string }) => f.state !== 'down' && f.state !== 'dead';
/** David can be hurt right now: on his feet and not blinking after a hit. */
export const vulnerable = (p: { state: string; inv: number }) => p.inv <= 0 && standing(p);
/** David's blows can land on this enemy. downToo: the faith strike also reaches enemies lying on the ground. */
export function hittable(e: { state: string }, d: EnemyDef, downToo = false): boolean {
  return !d.untouchable && e.state !== 'dead' && (downToo || e.state !== 'down');
}

/** The parts of a fighter a hit reads and changes. David is the one without a kind. */
export interface HitTarget {
  kind?: EnemyId; hp: number; x: number; z: number; facing: 1 | -1; state: string; t: number; vx: number; vz: number;
  ai?: { mode: string };
  /** sheep thief: the sheep he's dragging, and whether he gave up stealing */
  carry?: { x: number; y: number; carrier: unknown }; fights?: boolean;
  g?: { mode: string; t: number; phase2: boolean; hinted: boolean };
}
export interface Meters { hitstop: number; score: number; faith: number }
export type HitEvent =
  | { type: 'reinforce'; spawns: Spawn[]; shout: string } // a boss calls for help as he weakens
  | { type: 'stoneBounced' } // Goliath's bronze stopped a sling stone: it falls back to the ground
  | { type: 'struck' } // the blow itself (spark, sound, shake, "퍽!")
  | { type: 'sheepDropped'; x: number; y: number }
  | { type: 'hint'; text: string }
  | { type: 'enraged'; spawns: Spawn[] } // Goliath at half health
  | { type: 'goliathDown' };
export interface HitOutcome {
  m: Meters;
  /** where the target was when struck (it may be knocked away by now) */
  at: { x: number; z: number };
  look: 'light' | 'heavy' | 'blocked' | 'crit';
  reaction: 'down' | 'hurt' | 'armor';
  boss: boolean; ko: boolean;
  /** in the order the scene should play them */
  events: HitEvent[];
}

const CALLS: Record<NonNullable<EnemyDef['calls']>, (n: number) => { spawns: Spawn[]; shout: string }> = {
  camels: n => ({ spawns: Array.from({ length: n * 2 }, (_, i) => ({ x: i % 2 ? -40 : 520, y: 210, t: 'camel' as const })), shout: '낙타 기병이다!' }),
  guards: () => ({ spawns: [{ x: -40, y: 200, t: 'jebusite' }, { x: 520, y: 230, t: 'jebArcher' }], shout: '성주를 지켜라!' }),
  philistines: () => ({ spawns: [{ x: -40, y: 206, t: 'philB' }, { x: 520, y: 230, t: 'philD' }], shout: '대장을 지켜라!' }),
};
const GOLIATH_RAGE_HP = 50;

/**
 * Land attack `a` on `t` from direction `dir`. Changes the target in place and returns the new meters plus what to show.
 * special: the faith strike (always heavy, doesn't refill faith). src: what hit Goliath (only a stone can finish him).
 */
export function resolveHit(t: HitTarget, a: Attack, dir: 1 | -1, m: Meters, how: { special?: boolean; src?: 'staff' | 'stone' } = {}): HitOutcome {
  const d = t.kind ? ENEMIES[t.kind] as EnemyDef : undefined, at = { x: t.x, z: t.z };
  m = { ...m };
  const events: HitEvent[] = [];
  if (d?.ai === 'goliath') {
    const g = t.g!, src = how.src ?? 'staff';
    const r = goliathDamage(t.hp, src, g.mode === 'stuck', dir === -t.facing, a.dmg);
    t.hp -= r.dmg;
    if (r.blocked) {
      if (src === 'stone') events.push({ type: 'stoneBounced' });
      m.hitstop = Math.max(m.hitstop, 0.03);
    } else if (r.crit) {
      m.hitstop = 0.25; m.score += 1000; m.faith = Math.min(FAITH_MAX, m.faith + FAITH_PER_KO);
      if (t.hp > 0) { g.mode = 'stagger'; g.t = 0; }
    } else {
      m.hitstop = Math.max(m.hitstop, 0.05); m.score += 50; m.faith = Math.min(FAITH_MAX, m.faith + FAITH_PER_HIT);
    }
    events.push({ type: 'struck' });
    if (t.hp === 1 && src !== 'stone' && !g.hinted) { g.hinted = true; events.push({ type: 'hint', text: '마지막은 물매로!' }); }
    if (!g.phase2 && t.hp > 0 && t.hp <= GOLIATH_RAGE_HP) { g.phase2 = true; events.push({ type: 'enraged', spawns: [{ x: -40, y: 196 }, { x: 520, y: 236, t: 'philB' }] }); }
    const ko = t.hp <= 0;
    if (ko) {
      // the stone sank into his forehead and he fell on his face (1 Sam 17:49)
      t.state = 'down'; t.t = 0; t.vx = -t.facing * 40; t.vz = 110; t.z = 1;
      m.hitstop = 0.6; m.score += 10000;
      events.push({ type: 'goliathDown' });
    }
    return { m, at, look: r.blocked ? 'blocked' : r.crit ? 'crit' : 'light', reaction: ko ? 'down' : 'armor', boss: true, ko, events };
  }

  t.hp -= a.dmg;
  if (d?.calls) {
    const n = chiefCalls(t.hp + a.dmg, t.hp);
    if (n && t.hp > 0) events.push({ type: 'reinforce', ...CALLS[d.calls](n) });
  }
  const heavy = a.knock || !!how.special || d?.ai === 'camel';
  const boss = !!d?.boss, ko = t.hp <= 0;
  const r = reaction(boss, heavy, ko);
  m.hitstop = Math.max(m.hitstop, r === 'down' ? 0.11 : 0.055);
  if (boss && ko) m.hitstop = 0.45;
  events.push({ type: 'struck' });
  if (t.carry) {
    events.push({ type: 'sheepDropped', x: t.carry.x, y: t.carry.y });
    t.carry.carrier = null; t.carry = undefined; t.fights = true;
  }
  if (r === 'down') {
    t.facing = (dir * -1) as 1 | -1;
    t.state = 'down'; t.t = 0; t.vx = dir * (boss ? 90 : 150); t.vz = boss ? 150 : 190; t.z = Math.max(t.z, 1);
    if (t.ai) t.ai.mode = 'approach';
  } else if (r === 'hurt') {
    t.facing = (dir * -1) as 1 | -1;
    if (t.ai?.mode === 'swing') t.ai.mode = 'back';
    t.state = 'hurt'; t.t = 0; t.vx = dir * (boss ? 60 : 110); t.z = 0; t.vz = 0;
  } else {
    t.x += dir * 2; // boss armor: flinch in place, keeps attacking
  }
  if (d) {
    m.score += 100 + (ko ? (boss ? 5000 : 400) : 0);
    if (!how.special) m.faith = Math.min(FAITH_MAX, m.faith + FAITH_PER_HIT + (ko ? FAITH_PER_KO : 0)); // the special doesn't refill itself
  }
  return { m, at, look: heavy ? 'heavy' : 'light', reaction: r, boss, ko, events };
}

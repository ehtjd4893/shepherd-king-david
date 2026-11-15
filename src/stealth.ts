// Stealth sections (1 Sam 24, 26): Saul's men can't be fought. Sneak up, take the goals, don't get caught.
// No Phaser here — the scene draws the guards, cones and marks from this state.
import type { Section, Guard, Goal } from './combat.ts';
import { standing } from './hit.ts';

export const SIGHT_RANGE = 110, HEAR_RANGE = 60;
/** A patrolling guard sees a cone in front of him that widens with distance (and anyone bumping into him). */
export function seen(g: { x: number; y: number; facing: 1 | -1 }, t: { x: number; y: number }): boolean {
  const dx = (t.x - g.x) * g.facing, dy = Math.abs(t.y - g.y);
  if (Math.abs(t.x - g.x) < 14 && dy < 10) return true;
  return dx >= 0 && dx <= SIGHT_RANGE && dy <= 8 + dx * 0.22;
}
/** Sleepers (1 Sam 26:12) hear David only if he runs close by. */
export function heard(g: { x: number; y: number }, t: { x: number; y: number }, running: boolean): boolean {
  return running && Math.hypot(t.x - g.x, (t.y - g.y) * 2) <= HEAR_RANGE;
}
/** Suspicion fills while sensed and drains otherwise; at 1 David is caught. Gives kids a moment to back off. */
export const SIGHT_RATE = 1.8, HEAR_RATE = 3.2; // footsteps wake a sleeper faster than a glimpse alarms a guard
export function suspicion(meter: number, sensed: boolean, dt: number, rate = SIGHT_RATE): number {
  return Math.min(1, Math.max(0, meter + (sensed ? rate : -1) * dt));
}

export const PATROL_SPEED = 35, LOOK_AROUND = 1.2; // a patrol pauses this long at each end
/** Nobody notices David for a moment when the section starts, and again right after he's caught. */
export const START_GRACE = 1, CAUGHT_GRACE = 1.2;
/** How close David must be to a goal to take it (x, depth). */
export const TAKE_REACH = { x: 22, y: 14 };

/**
 * Sleepers turn over now and then (1 Sam 26:12 — nobody woke, but it was close): each sleeps, stirs, then half-wakes and
 * looks one way (the other way each time). While he looks, anything moving in front of him is seen; David standing still is not. Seconds per phase;
 * first/stagger set when each sleeper first stirs, so they take turns.
 */
export const NAP = { sleep: 2.6, stir: 0.7, look: 1.5, first: 0.9, stagger: 0.9 };
export type Nap = 'sleep' | 'stir' | 'look';

/** wait: a patrol's pause at the end of his beat, or the time left in a sleeper's nap phase. */
export interface Sentry { g: Guard; x: number; y: number; facing: 1 | -1; wait: number; meter: number; nap: Nap | null }
export interface StealthRun { at: number; sentries: Sentry[]; goals: { g: Goal; done: boolean }[]; grace: number; saulX: number }
export type StealthEvent = { type: 'caught' } | { type: 'took'; goal: Goal } | { type: 'done' };

export function startStealth(sec: Section): StealthRun {
  const st = sec.stealth!, at = sec.at;
  return {
    at,
    sentries: st.guards.map((g, i) => post({ g, x: 0, y: g.y, facing: -1, wait: 0, meter: 0, nap: null }, i, at, st.saul.x)),
    saulX: st.saul.x,
    goals: st.goals.map(g => ({ g, done: false })),
    grace: START_GRACE,
  };
}

/** Back at his post as the section began: patrols facing the entrance, sleepers fast asleep. saulX: screen-relative. */
function post(s: Sentry, i: number, at: number, saulX: number): Sentry {
  s.x = at + s.g.x; s.meter = 0;
  // a sleeper turns over to look toward the king first, where David has to go
  if (s.g.asleep) { s.nap = 'sleep'; s.wait = NAP.first + i * NAP.stagger; s.facing = saulX >= s.g.x ? -1 : 1; }
  else { s.facing = -1; s.wait = 0; }
  return s;
}

/** Where David stands at the start, and after being caught: the near edge of the section, out of everyone's sight. */
export const entry = (run: StealthRun) => ({ x: run.at + 30, y: 210 });

/**
 * One frame. take: David pressed attack (takes a goal he's standing at).
 * Caught: the guards go back to their posts and David must start over — goals already taken stay taken. No damage.
 */
export function stepStealth(run: StealthRun, dt: number, david: { x: number; y: number; state: string }, take: boolean): StealthEvent[] {
  run.grace = Math.max(0, run.grace - dt);
  const moving = david.state !== 'idle';
  for (const s of run.sentries) {
    if (s.nap) {
      // sleep → stir (turns over to face the other way) → look → sleep
      s.wait -= dt;
      if (s.wait <= 0) {
        if (s.nap === 'sleep') { s.nap = 'stir'; s.wait = NAP.stir; s.facing = (s.facing * -1) as 1 | -1; }
        else if (s.nap === 'stir') { s.nap = 'look'; s.wait = NAP.look; }
        else { s.nap = 'sleep'; s.wait = NAP.sleep; }
      }
    } else {
      // patrol between from..to, pausing to look around at each end
      if (s.wait > 0) s.wait -= dt;
      else {
        s.x += s.facing * PATROL_SPEED * dt;
        const lo = run.at + (s.g.from ?? s.g.x), hi = run.at + (s.g.to ?? s.g.x);
        if (s.x <= lo || s.x >= hi) { s.x = Math.min(hi, Math.max(lo, s.x)); s.facing = (s.facing * -1) as 1 | -1; s.wait = LOOK_AROUND; }
      }
    }
    const open = run.grace <= 0 && standing(david);
    const footsteps = open && !!s.g.asleep && heard(s, david, david.state === 'run');
    const sight = open && (s.g.asleep ? s.nap === 'look' && moving && seen(s, david) : seen(s, david));
    s.meter = suspicion(s.meter, footsteps || sight, dt, footsteps ? HEAR_RATE : SIGHT_RATE);
    if (s.meter >= 1) {
      run.sentries.forEach((o, i) => post(o, i, run.at, run.saulX));
      run.grace = CAUGHT_GRACE;
      return [{ type: 'caught' }];
    }
  }
  const events: StealthEvent[] = [];
  for (const g of run.goals) {
    if (g.done || !take) continue;
    if (Math.abs(run.at + g.g.x - david.x) < TAKE_REACH.x && Math.abs(g.g.y - david.y) < TAKE_REACH.y) {
      g.done = true;
      events.push({ type: 'took', goal: g.g });
    }
  }
  if (run.goals.every(g => g.done)) events.push({ type: 'done' });
  return events;
}

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
/** Sleepers (1 Sam 26:12) only stir if David runs close by. */
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

export interface Sentry { g: Guard; x: number; y: number; facing: 1 | -1; wait: number; meter: number }
export interface StealthRun { at: number; sentries: Sentry[]; goals: { g: Goal; done: boolean }[]; grace: number }
export type StealthEvent = { type: 'caught' } | { type: 'took'; goal: Goal } | { type: 'done' };

export function startStealth(sec: Section): StealthRun {
  const st = sec.stealth!, at = sec.at;
  return {
    at,
    sentries: st.guards.map(g => ({ g, x: at + g.x, y: g.y, facing: -1, wait: 0, meter: 0 })),
    goals: st.goals.map(g => ({ g, done: false })),
    grace: START_GRACE,
  };
}

/** Where David stands at the start, and after being caught: the near edge of the section, out of everyone's sight. */
export const entry = (run: StealthRun) => ({ x: run.at + 30, y: 210 });

/**
 * One frame. take: David pressed attack (takes a goal he's standing at).
 * Caught: the guards go back to their posts and David must start over — goals already taken stay taken. No damage.
 */
export function stepStealth(run: StealthRun, dt: number, david: { x: number; y: number; state: string }, take: boolean): StealthEvent[] {
  run.grace = Math.max(0, run.grace - dt);
  for (const s of run.sentries) {
    if (!s.g.asleep) {
      // patrol between from..to, pausing to look around at each end
      if (s.wait > 0) s.wait -= dt;
      else {
        s.x += s.facing * PATROL_SPEED * dt;
        const lo = run.at + (s.g.from ?? s.g.x), hi = run.at + (s.g.to ?? s.g.x);
        if (s.x <= lo || s.x >= hi) { s.x = Math.min(hi, Math.max(lo, s.x)); s.facing = (s.facing * -1) as 1 | -1; s.wait = LOOK_AROUND; }
      }
    }
    const sensed = run.grace <= 0 && standing(david) && (s.g.asleep ? heard(s, david, david.state === 'run') : seen(s, david));
    s.meter = suspicion(s.meter, sensed, dt, s.g.asleep ? HEAR_RATE : SIGHT_RATE);
    if (s.meter >= 1) {
      for (const o of run.sentries) { o.x = run.at + o.g.x; o.facing = -1; o.wait = 0; o.meter = 0; }
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

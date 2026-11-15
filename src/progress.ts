// Stage progress: which section David is in, when the screen locks, what to spawn, when it opens again.
// No Phaser here — the scene spawns, sets up and draws whatever the events say.
import type { Section, Spawn } from './combat.ts';

export interface Prog { section: number; wave: number; locked: boolean; done: boolean }
export const LOCK_AT = 200; // player reaching section.at + LOCK_AT locks the screen
export const RIGHT_EDGE = 12; // David can't get closer than this to the stage's right end

/** What still holds the screen locked: enemies on the field, stealth goals not yet taken, captives still tied. */
export interface Left { enemies: number; stealthGoals: number; captives: number }
export type ProgEvent =
  | { type: 'wave'; spawns: Spawn[] }
  | { type: 'stealth'; section: Section } // set up the guards and goals
  | { type: 'captives'; section: Section } // tie up the captives
  | { type: 'sectionClear' }
  | { type: 'stageClear' };

/**
 * Advance stage progress by one frame. The screen locks when David walks in; waves move on only when nothing is left;
 * the last one cleared opens the way to the next section.
 */
export function advance(p: Prog, sections: Section[], playerX: number, left: Left): { p: Prog; events: ProgEvent[] } {
  if (p.done) return { p, events: [] };
  const s = sections[p.section];
  const events: ProgEvent[] = [];
  if (!p.locked) {
    if (playerX < s.at + LOCK_AT) return { p, events };
    if (s.waves.length) events.push({ type: 'wave', spawns: s.waves[0] });
    if (s.stealth) events.push({ type: 'stealth', section: s });
    if (s.captives) events.push({ type: 'captives', section: s });
    return { p: { ...p, locked: true, wave: 0 }, events };
  }
  if (left.enemies + left.stealthGoals + left.captives > 0) return { p, events };
  if (p.wave + 1 < s.waves.length) return { p: { ...p, wave: p.wave + 1 }, events: [{ type: 'wave', spawns: s.waves[p.wave + 1] }] };
  const next = p.section + 1, done = next >= sections.length;
  events.push({ type: 'sectionClear' });
  if (done) events.push({ type: 'stageClear' });
  return { p: { section: next, wave: 0, locked: false, done }, events };
}

/**
 * Where a (re)start puts everything. Section 0 is the stage start; a later section is the checkpoint after a fall:
 * David just inside it, the camera on it, and the tips for the stretch before it already shown.
 */
export function startAt(stage: { sections: Section[]; hints: { at: number }[]; start?: number }, section: number) {
  const at = section ? stage.sections[section].at : 0;
  return {
    prog: { section, wave: 0, locked: false, done: false } as Prog,
    camX: at,
    playerX: section ? at + 60 : stage.start ?? 60,
    hintsShown: stage.hints.filter(h => h.at < at).length,
  };
}

/** The camera only moves forward, and holds on the section while it's locked. */
export function cameraTarget(p: Prog, sections: Section[], camX: number, playerX: number): number {
  return p.locked ? sections[p.section].at : Math.max(camX, playerX - 200);
}

/** A section was just cleared and the next one hasn't locked yet: show "GO ▶". */
export const betweenFights = (p: Prog) => !p.locked && !p.done && p.section > 0;

/** How the stage ends: cleared, or David fell (retry from p.section). */
export function verdict(p: Prog, davidDead: boolean): 'clear' | 'dead' | null {
  return p.done ? 'clear' : davidDead ? 'dead' : null;
}

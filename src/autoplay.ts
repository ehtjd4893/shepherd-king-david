// A simple autoplayer for checking that stages can be beaten. Not part of the game.
// decide() picks this frame's move from the stage state; playStage() runs a whole stage with no screen (node --test);
// tools/bot.js presses the same keys in a dev browser tab.
import { runTracker, trackRun } from './combat.ts';
import { seen, type Sentry } from './stealth.ts';
import { telegraphs, def } from './fighters.ts';
import { StageSim, type Input } from './sim.ts';

/** Keyboard keys the autoplayer taps: Z attack, X jump, C sling, V faith/harp, F spin, G companions. */
export type Key = 'z' | 'x' | 'c' | 'v' | 'f' | 'g';
export interface Move { dx: number; dy: number; k: Key | null }

/** This frame's move. f: frames since the attempt started (paces the taps). */
export function decide(s: StageSim, f: number): Move {
  const p = s.player;
  const live = s.enemies.filter(e => e.state !== 'dead' && e.state !== 'down' && !e.flee && !def(e).untouchable);
  const lethal = s.enemies.filter(e => e.state !== 'dead' && !e.flee);
  let dx = 0, dy = 0, k: Key | null = null;
  const incoming = s.shots.find(sh => Math.abs(sh.y - p.y) <= 14 && (p.x - sh.x) * sh.dir > 0 && Math.abs(p.x - sh.x) < 200);
  const warn = telegraphs(s.enemies, s.camX).find(w => Math.abs(w.y - p.y) <= 16); // the same red lines the player sees
  const G = lethal.find(e => e.g), g = G?.g;
  const st = s.stealthRun, goal = st?.goals.find(o => !o.done);
  if (st && goal) {
    // sneak: head for the goal, sidestep anything a guard (or a sleeper about to look up) would see, never run near sleepers
    const watching = (se: Sentry) => !se.g.asleep || se.nap !== 'sleep';
    const gx = st.at + goal.g.x, gy = goal.g.y, risky = (x: number, y: number) => st.sentries.some(se => watching(se) && seen(se, { x, y }));
    dx = Math.abs(gx - p.x) > 6 ? Math.sign(gx - p.x) : 0; dy = Math.abs(gy - p.y) > 4 ? Math.sign(gy - p.y) : 0;
    if (risky(p.x + dx * 18, p.y + dy * 10) || st.sentries.some(se => se.meter > 0.15)) {
      if (!risky(p.x - 18, p.y)) { dx = -1; dy = 0; } else if (!risky(p.x, p.y + 20)) { dx = 0; dy = 1; } else if (!risky(p.x, p.y - 20)) { dx = 0; dy = -1; } else { dx = 0; dy = 0; }
    }
    if (p.state === 'run') dx = 0;
    if (st.sentries.some(se => se.g.asleep && se.nap !== 'sleep' && seen(se, p))) { dx = 0; dy = 0; } // he's looking this way: freeze
    if (Math.abs(gx - p.x) < 18 && Math.abs(gy - p.y) < 10) { dx = 0; dy = 0; if (f % 10 === 0) k = 'z'; }
  }
  else if (s.quake && p.state !== 'jump' && Math.abs(Math.abs(p.x - s.quake.x) - s.quake.t * 420) < 60) k = 'x';
  else if (incoming || warn || (G && g!.mode === 'thrust' && Math.abs(g!.lane - p.y) <= 16)) {
    // step away from the warned lane (not toward the screen middle, which can be the lane itself)
    const lane = incoming ? incoming.y : warn ? warn.y : g!.lane;
    dy = lane > 232 ? -1 : lane < 182 ? 1 : (p.y >= lane ? 1 : -1);
  }
  else if (G && G.state !== 'down' && g!.mode === 'stuck') {
    dy = Math.abs(G.y - p.y) > 4 ? Math.sign(G.y - p.y) : 0;
    if (Math.sign(G.x - p.x) !== p.facing) dx = Math.sign(G.x - p.x);
    else if (Math.abs(G.y - p.y) <= 10 && s.ammo > 0 && s.slingCd <= 0) k = 'c';
  } else if (s.ammo === 0 && s.pickups.length && (G || !live.length)) {
    const t = s.pickups[0]; dx = Math.abs(t.x - p.x) > 4 ? Math.sign(t.x - p.x) : 0; dy = Math.abs(t.y - p.y) > 3 ? Math.sign(t.y - p.y) : 0;
  } else if (live.length && !(G && live.length === 1)) {
    const e = live.filter(o => !o.g).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] ?? live[0];
    const near = live.filter(o => Math.abs(o.x - p.x) < 50 && Math.abs(o.y - p.y) < 14).length;
    if (s.faith >= 100 && live.length >= 2) k = 'v';
    else if (s.stage.allies && s.allyCd <= 0 && live.length >= 2) k = 'g';
    else if (near >= 2 && s.faith >= 25 && f % 30 === 0) k = 'f';
    const want = e.x - (e.x > p.x ? 32 : -32);
    dx = Math.abs(want - p.x) > 4 ? Math.sign(want - p.x) : 0; dy = Math.abs(e.y - p.y) > 3 ? Math.sign(e.y - p.y) : 0;
    if (!k && !dx && !dy) { if (Math.sign(e.x - p.x) !== p.facing) dx = Math.sign(e.x - p.x); else if (f % 6 === 0) k = 'z'; }
  } else if (s.bound.some(b => !b.done)) { // untie the captives
    const b = s.bound.find(o => !o.done)!;
    dx = Math.abs(b.x - p.x) > 6 ? Math.sign(b.x - p.x) : 0; dy = Math.abs(b.c.y - p.y) > 4 ? Math.sign(b.c.y - p.y) : 0;
    if (Math.abs(b.x - p.x) < 18 && Math.abs(b.c.y - p.y) < 10 && f % 10 === 0) { dx = 0; dy = 0; k = 'z'; }
  } else if (G) { // bait Goliath's thrust from ~110px on his lane
    const want = G.x - Math.sign(G.x - p.x || 1) * 110; dx = Math.abs(want - p.x) > 6 ? Math.sign(want - p.x) : 0; dy = Math.abs(G.y - p.y) > 4 ? Math.sign(G.y - p.y) : 0;
  }
  else if (!s.prog.locked) dx = 1;
  return { dx, dy, k };
}

const ACTION: Record<Key, keyof Input> = { z: 'attack', x: 'jump', c: 'sling', v: 'special', f: 'spin', g: 'ally' };
const DT = 1 / 60;
/** Mulberry32: a small seeded random generator, so a headless run can be repeated exactly. */
export function seeded(a: number): () => number {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export interface Attempt { ended: 'clear' | 'dead' | null; seconds: number; section: number; hitsTaken: number; caught: number }
/**
 * Play a stage with no screen, the way a player holding arrows and tapping keys would; after a fall, retry from that
 * section like the game does. Gives up after `tries` attempts or `seconds` per attempt.
 */
export function playStage(stageId: string, { seed = 7, seconds = 240, tries = 8 } = {}): { cleared: boolean; attempts: Attempt[] } {
  const rng = seeded(seed), attempts: Attempt[] = [];
  let section = 0;
  for (let n = 0; n < tries; n++) {
    const s = new StageSim(stageId, section, 0, () => {}, rng), keys = runTracker();
    const a: Attempt = { ended: null, seconds: 0, section, hitsTaken: 0, caught: 0 };
    let hp = s.player.hp, f = 0;
    for (; f < 60 * seconds && !s.ended; f++) {
      const m = decide(s, f), x = Math.sign(m.dx), now = s.time0 + DT;
      const input: Input = { x, y: Math.sign(m.dy), run: trackRun(keys, x, now, false), attack: false, jump: false, sling: false, spin: false, ally: false, special: false };
      if (m.k) (input[ACTION[m.k]] as boolean) = true;
      s.step(DT, input);
      if (s.player.hp < hp) a.hitsTaken++;
      hp = s.player.hp;
      if (s.stealthEvents.some(e => e.type === 'caught')) a.caught++;
    }
    a.ended = s.ended; a.seconds = Math.round(f / 6) / 10;
    attempts.push(a);
    if (s.ended !== 'dead') return { cleared: s.ended === 'clear', attempts };
    section = s.prog.section;
  }
  return { cleared: false, attempts };
}


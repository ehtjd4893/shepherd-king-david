import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seen, heard, suspicion, startStealth, stepStealth, entry, NAP, SIGHT_RANGE, HEAR_RANGE, HEAR_RATE, PATROL_SPEED, LOOK_AROUND, START_GRACE, CAUGHT_GRACE,
  type StealthRun, type StealthEvent,
} from './stealth.ts';
import type { Section } from './combat.ts';

// (moved from combat.test.ts)
test('guard sight: a cone in front that widens, nothing behind', () => {
  const g = { x: 100, y: 200, facing: 1 as const };
  assert.equal(seen(g, { x: 150, y: 200 }), true);
  assert.equal(seen(g, { x: 100 + SIGHT_RANGE, y: 225 }), true); // wide far away
  assert.equal(seen(g, { x: 130, y: 225 }), false); // narrow up close
  assert.equal(seen(g, { x: 60, y: 200 }), false); // behind him
  assert.equal(seen(g, { x: 100 + SIGHT_RANGE + 5, y: 200 }), false); // out of range
});

test('sleepers only stir when David runs close; suspicion fills and drains', () => {
  assert.equal(heard({ x: 100, y: 200 }, { x: 130, y: 205 }, false), false);
  assert.equal(heard({ x: 100, y: 200 }, { x: 130, y: 205 }, true), true);
  assert.equal(heard({ x: 100, y: 200 }, { x: 200, y: 205 }, true), false);
  let m = 0;
  for (let i = 0; i < 20; i++) m = suspicion(m, true, 1 / 60); // a third of a second in sight: not caught yet
  assert.ok(m > 0 && m < 1);
  for (let i = 0; i < 60; i++) m = suspicion(m, false, 1 / 60);
  assert.equal(m, 0);
});

test('running straight past a sleeper wakes him', () => {
  // at full run (220 px/s) David spends 2*HEAR_RANGE/220 s inside the hearing circle
  let m = 0;
  const frames = Math.floor((2 * HEAR_RANGE / 220) * 60);
  for (let i = 0; i < frames; i++) m = suspicion(m, true, 1 / 60, HEAR_RATE);
  assert.equal(m, 1);
});

// a cave with one guard patrolling 200..300 (facing left at first) and two goals at the far end
const cave: Section = {
  at: 1000, waves: [],
  stealth: { mood: 'cave', saul: { x: 440, y: 200 }, guards: [{ x: 250, y: 200, from: 200, to: 300 }], goals: [{ x: 420, y: 210, kind: 'robe' }, { x: 400, y: 230, kind: 'spear' }] },
};
const dt = 1 / 60;
const run = (st: StealthRun, seconds: number, david: { x: number; y: number; state: string }, take = false) => {
  const all: StealthEvent[] = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) all.push(...stepStealth(st, dt, david, take));
  return all;
};
const inSight = (st: StealthRun) => ({ x: st.sentries[0].x + st.sentries[0].facing * 40, y: 200, state: 'idle' }); // just in front of him
const hidden = { x: 1030, y: 250, state: 'idle' };

test('patrols walk to the end of their beat, look around there, then turn back', () => {
  const st = startStealth(cave), s = st.sentries[0];
  run(st, 50 / PATROL_SPEED + 0.1, hidden); // 250 → 200
  assert.equal(s.x, 1200);
  assert.equal(s.facing, 1);
  assert.ok(s.wait > 0);
  run(st, LOOK_AROUND - 0.2, hidden);
  assert.equal(s.x, 1200); // still looking around
  run(st, 0.5, hidden);
  assert.ok(s.x > 1200);
});

test('nobody notices David in the first moment of the section', () => {
  const st = startStealth(cave);
  for (let i = 0; i < Math.floor(START_GRACE / dt) - 1; i++) stepStealth(st, dt, inSight(st), false);
  assert.equal(st.sentries[0].meter, 0);
});

test('caught: guards back at their posts, David gets a breather — and no second catch right away', () => {
  const st = startStealth(cave);
  let caught = 0;
  for (let i = 0; i < 240 && !caught; i++) caught = stepStealth(st, dt, inSight(st), false).filter(e => e.type === 'caught').length;
  assert.equal(caught, 1);
  assert.deepEqual(st.sentries.map(s => [s.x, s.facing, s.meter]), [[1250, -1, 0]]);
  assert.equal(st.grace, CAUGHT_GRACE);
  // standing right in his sight for just under the breather: not caught again, not even suspected
  for (let i = 0; i < Math.floor(CAUGHT_GRACE / dt) - 1; i++) assert.deepEqual(stepStealth(st, dt, inSight(st), false), []);
  assert.equal(st.sentries[0].meter, 0);
});

test('a goal is taken by pressing attack right beside it, and stays taken after a catch', () => {
  const st = startStealth(cave);
  const robe = { x: 1000 + 420, y: 210, state: 'idle' };
  assert.deepEqual(run(st, 0.1, robe, false), []); // standing there isn't enough
  assert.deepEqual(stepStealth(st, dt, { ...robe, x: robe.x - 30 }, true), []); // too far
  assert.deepEqual(stepStealth(st, dt, robe, true).map(e => e.type), ['took']);
  for (let i = 0; i < 600 && !stepStealth(st, dt, inSight(st), false).length; i++);
  assert.equal(st.goals[0].done, true);
  assert.equal(st.goals[1].done, false);
});

test('the section is done once every goal is taken', () => {
  const st = startStealth(cave);
  stepStealth(st, dt, { x: 1420, y: 210, state: 'idle' }, true);
  assert.deepEqual(stepStealth(st, dt, { x: 1400, y: 230, state: 'idle' }, true).map(e => e.type), ['took', 'done']);
});

test('David starts (and restarts) at the near edge of the section', () => {
  assert.deepEqual(entry(startStealth(cave)), { x: 1030, y: 210 });
});

// a night camp with one sleeper at 200, Saul to his right (so he first turns over to face right)
const camp: Section = {
  at: 1000, waves: [],
  stealth: { mood: 'night', saul: { x: 360, y: 214 }, guards: [{ x: 200, y: 200, asleep: true }], goals: [{ x: 400, y: 210, kind: 'spear' }] },
};
const inFront = (st: StealthRun, state: string) => ({ x: st.sentries[0].x + 50, y: 200, state });

test('a sleeper sleeps, stirs and turns over, then looks around for a moment, and sleeps again', () => {
  const st = startStealth(camp), s = st.sentries[0];
  run(st, NAP.first - 0.05, hidden);
  assert.deepEqual([s.nap, s.facing], ['sleep', -1]);
  run(st, 0.1, hidden);
  assert.deepEqual([s.nap, s.facing], ['stir', 1]);
  run(st, NAP.stir, hidden);
  assert.equal(s.nap, 'look');
  run(st, NAP.look, hidden);
  assert.equal(s.nap, 'sleep');
});

test('walking past a sleeper is safe; while he looks, moving in front of him gets David caught, standing still does not', () => {
  const st = startStealth(camp);
  assert.deepEqual(run(st, NAP.first + NAP.stir - 0.05, inFront(st, 'walk')), []);
  assert.equal(st.sentries[0].meter, 0);
  run(st, 0.1, inFront(st, 'idle'));
  assert.equal(st.sentries[0].nap, 'look');
  assert.deepEqual(run(st, 0.5, inFront(st, 'idle')), []); // frozen right in front of him
  assert.equal(st.sentries[0].meter, 0);
  let caught = false;
  for (let i = 0; i < Math.round(0.7 / dt) && !caught; i++) caught = stepStealth(st, dt, inFront(st, 'walk'), false).some(e => e.type === 'caught');
  assert.equal(caught, true);
  assert.deepEqual([st.sentries[0].nap, st.sentries[0].wait], ['sleep', NAP.first]); // back asleep as at the start
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hits, stepProg, camelPhase, chiefCalls, CAMEL_WARN, seen, heard, suspicion, SIGHT_RANGE, HEAR_RANGE, HEAR_RATE, swordify, COMBO, SWORD_REACH, archerStep, SHOT_BOX, isDoubleTap, spinCost, reaction, goliathDamage, brookShouldDrop, GOLIATH_CRIT, BROOK_EMPTY_DELAY, BROOK_LOW_EVERY, DEPTH_TOL, DOUBLE_TAP, SPIN_FAITH, SPIN_HP, type Prog, type Section } from './combat.ts';

test('spin spends faith first, then a little health, never the last of it', () => {
  assert.deepEqual(spinCost(SPIN_FAITH, 50), { faith: 0, hp: 50 });
  assert.deepEqual(spinCost(SPIN_FAITH - 1, 50), { faith: SPIN_FAITH - 1, hp: 50 - SPIN_HP });
  assert.equal(spinCost(0, SPIN_HP), null);
});

test('double tap: same direction within the window runs; slow or opposite taps do not', () => {
  assert.equal(isDoubleTap(1, 1.0, 1, 1.0 + DOUBLE_TAP), true);
  assert.equal(isDoubleTap(1, 1.0, 1, 1.0 + DOUBLE_TAP + 0.01), false);
  assert.equal(isDoubleTap(-1, 1.0, 1, 1.1), false);
  assert.equal(isDoubleTap(0, 1.0, 0, 1.1), false);
});

const box = { from: 0, to: 40, height: 30 };
const david = { x: 100, y: 200, z: 0, facing: 1 as const };

test('hit lands in front, same lane', () => {
  assert.equal(hits(david, box, { x: 130, y: 200, z: 0, hw: 6 }), true);
});

test('depth outside tolerance misses', () => {
  assert.equal(hits(david, box, { x: 130, y: 200 + DEPTH_TOL, z: 0, hw: 6 }), true);
  assert.equal(hits(david, box, { x: 130, y: 200 + DEPTH_TOL + 1, z: 0, hw: 6 }), false);
});

test('behind the attacker misses; facing flips the box', () => {
  assert.equal(hits(david, box, { x: 70, y: 200, z: 0, hw: 6 }), false);
  assert.equal(hits({ ...david, facing: -1 }, box, { x: 70, y: 200, z: 0, hw: 6 }), true);
});

test('jumping target clears a low swing', () => {
  assert.equal(hits(david, box, { x: 130, y: 200, z: 31, hw: 6 }), false);
});

const sections: Section[] = [
  { at: 0, waves: [[{ x: 500, y: 200 }], [{ x: 500, y: 210 }]] },
  { at: 600, waves: [[{ x: 500, y: 200 }]] },
];
const start: Prog = { section: 0, wave: 0, locked: false, done: false };

test('screen locks when the player walks in, spawning wave 1', () => {
  assert.equal(stepProg(start, sections, 150, 0).spawn, null);
  const r = stepProg(start, sections, 200, 0);
  assert.equal(r.p.locked, true);
  assert.deepEqual(r.spawn, sections[0].waves[0]);
});

test('next wave only after everyone is down', () => {
  const locked: Prog = { ...start, locked: true };
  assert.equal(stepProg(locked, sections, 300, 1).spawn, null);
  assert.equal(stepProg(locked, sections, 300, 1).p.wave, 0);
  const r = stepProg(locked, sections, 300, 0);
  assert.equal(r.p.wave, 1);
  assert.deepEqual(r.spawn, sections[0].waves[1]);
});

test('last wave cleared unlocks and moves to next section, then done', () => {
  const r = stepProg({ ...start, locked: true, wave: 1 }, sections, 300, 0);
  assert.deepEqual(r.p, { section: 1, wave: 0, locked: false, done: false });
  const end = stepProg({ section: 1, wave: 0, locked: true, done: false }, sections, 900, 0);
  assert.equal(end.p.done, true);
});

test('bosses shrug off light hits, stagger on heavy ones, fall only when beaten', () => {
  assert.equal(reaction(true, false, false), 'armor');
  assert.equal(reaction(true, true, false), 'hurt');
  assert.equal(reaction(true, true, true), 'down');
  assert.equal(reaction(false, false, false), 'hurt');
  assert.equal(reaction(false, true, false), 'down');
});

test('Goliath: armor stops the staff in front, halves it behind, never lets it finish him', () => {
  assert.deepEqual(goliathDamage(100, 'staff', false, true, 16), { dmg: 1, crit: false, blocked: true });
  assert.deepEqual(goliathDamage(100, 'staff', false, false, 16), { dmg: 8, crit: false, blocked: false });
  assert.equal(goliathDamage(5, 'staff', true, false, 16).dmg, 4); // stops at 1 hp
  assert.equal(goliathDamage(1, 'staff', true, false, 16).dmg, 0);
});

test('Goliath: a stone only lands on the forehead while he is open, and that can finish him', () => {
  assert.deepEqual(goliathDamage(100, 'stone', true, true, 9), { dmg: GOLIATH_CRIT, crit: true, blocked: false });
  assert.deepEqual(goliathDamage(100, 'stone', false, true, 9), { dmg: 2, crit: false, blocked: true });
  assert.ok(goliathDamage(GOLIATH_CRIT, 'stone', true, true, 9).dmg >= GOLIATH_CRIT);
});

test('Goliath arena never leaves David without a stone', () => {
  assert.equal(brookShouldDrop(0, 0, BROOK_EMPTY_DELAY), true); // nothing anywhere → right away
  assert.equal(brookShouldDrop(0, 0, BROOK_EMPTY_DELAY - 0.1), false);
  assert.equal(brookShouldDrop(0, 1, BROOK_EMPTY_DELAY), false); // one is lying there already
  assert.equal(brookShouldDrop(1, 1, BROOK_LOW_EVERY), true); // low → slow top-up
  assert.equal(brookShouldDrop(2, 1, BROOK_LOW_EVERY), false); // three is enough
});

test('archers keep their distance', () => {
  assert.equal(archerStep(60), -1);
  assert.equal(archerStep(140), 0);
  assert.equal(archerStep(260), 1);
});

test("Saul's spear: a jump clears it, standing in its lane does not", () => {
  const spear = { x: 100, y: 200, z: 0, facing: 1 as const };
  assert.equal(hits(spear, SHOT_BOX, { x: 104, y: 200, z: 0, hw: 6 }), true);
  assert.equal(hits(spear, SHOT_BOX, { x: 104, y: 200, z: 30, hw: 6 }), false);
  assert.equal(hits(spear, SHOT_BOX, { x: 104, y: 214, z: 0, hw: 6 }), false);
});

test("Goliath's sword hits harder and reaches further, without touching the original move", () => {
  const a = swordify(COMBO[0]);
  assert.equal(a.dmg, 12);
  assert.equal(a.box.to, COMBO[0].box.to + SWORD_REACH);
  assert.equal(COMBO[0].dmg, 8);
});

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

test('camel riders warn before they gallop', () => {
  assert.equal(camelPhase(0), 'warn');
  assert.equal(camelPhase(CAMEL_WARN - 0.01), 'warn');
  assert.equal(camelPhase(CAMEL_WARN), 'charge');
});

test('the Amalekite chief calls riders once per threshold crossed', () => {
  assert.equal(chiefCalls(180, 150), 0);
  assert.equal(chiefCalls(125, 115), 1);
  assert.equal(chiefCalls(125, 50), 2); // a big hit past both
  assert.equal(chiefCalls(115, 100), 0); // already called
});

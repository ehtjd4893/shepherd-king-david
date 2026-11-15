import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hits, rockHits, slideDown, SHAFT, camelPhase, chiefCalls, CAMEL_WARN, swordify, COMBO, SWORD_REACH, archerStep, SHOT_BOX, isDoubleTap, spinCost, reaction, goliathDamage, brookShouldDrop, GOLIATH_CRIT, BROOK_EMPTY_DELAY, BROOK_LOW_EVERY, DEPTH_TOL, DOUBLE_TAP, SPIN_FAITH, SPIN_HP } from './combat.ts';

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

test('water shaft: a falling stone hits only in David\'s column and height, and only slides him down', () => {
  assert.equal(rockHits({ x: 240, y: 300 }, { x: 244, y: 310 }), true);
  assert.equal(rockHits({ x: 196, y: 300 }, { x: 240, y: 310 }), false); // other column
  assert.equal(rockHits({ x: 240, y: 200 }, { x: 240, y: 310 }), false); // still above him
  assert.equal(slideDown(400, 840), 400 + SHAFT.slide);
  assert.equal(slideDown(830, 840), 840); // never below the water
});

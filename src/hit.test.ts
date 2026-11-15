import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveHit, standing, vulnerable, hittable, type HitTarget, type Meters } from './hit.ts';
import { COMBO, SLING_STONE, ENEMIES, FAITH_MAX, FAITH_PER_HIT, FAITH_PER_KO, SPECIAL_DMG, type EnemyId } from './combat.ts';

const m0: Meters = { hitstop: 0, score: 0, faith: 0 };
const foe = (kind: EnemyId, hp: number = ENEMIES[kind].hp, more: Partial<HitTarget> = {}): HitTarget =>
  ({ kind, hp, x: 100, z: 0, facing: -1, state: 'idle', t: 0, vx: 0, vz: 0, ai: { mode: 'ready' }, ...more });
const goliath = (hp = 100, mode = 'walk') => foe('goliath', hp, { g: { mode, t: 0, phase2: false, hinted: false } });
const special = { ...COMBO[2], dmg: SPECIAL_DMG };

test('David is open to hits only on his feet and not blinking', () => {
  assert.equal(vulnerable({ state: 'idle', inv: 0 }), true);
  assert.equal(vulnerable({ state: 'idle', inv: 0.3 }), false);
  assert.equal(vulnerable({ state: 'down', inv: 0 }), false);
  assert.equal(standing({ state: 'dead' }), false);
});

test('the faith strike also lands on enemies already down; other blows do not; nobody touches the king', () => {
  assert.equal(hittable({ state: 'down' }, ENEMIES.philA), false);
  assert.equal(hittable({ state: 'down' }, ENEMIES.philA, true), true);
  assert.equal(hittable({ state: 'dead' }, ENEMIES.philA, true), false);
  assert.equal(hittable({ state: 'idle' }, ENEMIES.saul, true), false);
});

test('hits fill faith, a knockout fills more, the faith strike fills none', () => {
  assert.equal(resolveHit(foe('philA'), COMBO[0], 1, m0).m.faith, FAITH_PER_HIT);
  assert.equal(resolveHit(foe('philA', 5), COMBO[0], 1, m0).m.faith, FAITH_PER_HIT + FAITH_PER_KO);
  assert.equal(resolveHit(foe('philA'), special, 1, m0, { special: true }).m.faith, 0);
  assert.equal(resolveHit(foe('philA'), COMBO[0], 1, { ...m0, faith: FAITH_MAX - 1 }).m.faith, FAITH_MAX);
});

test('score: 100 a hit, 400 more for a knockout, 5000 more for a boss — and a long freeze on the boss', () => {
  assert.equal(resolveHit(foe('philA'), COMBO[0], 1, m0).m.score, 100);
  assert.equal(resolveHit(foe('philA', 5), COMBO[0], 1, m0).m.score, 500);
  const boss = resolveHit(foe('lion', 5), COMBO[0], 1, m0);
  assert.equal(boss.m.score, 5100);
  assert.equal(boss.m.hitstop, 0.45);
  assert.equal(boss.ko, true);
});

test('David being hit changes no score or faith', () => {
  const david: HitTarget = { hp: 100, x: 0, z: 0, facing: 1, state: 'idle', t: 0, vx: 0, vz: 0 };
  const r = resolveHit(david, COMBO[0], 1, { hitstop: 0, score: 7, faith: 7 });
  assert.equal(r.m.score, 7);
  assert.equal(r.m.faith, 7);
  assert.equal(david.state, 'hurt');
});

test('light hits knock a soldier back, heavy ones knock him down, bosses shrug off light hits', () => {
  const a = foe('philA');
  resolveHit(a, COMBO[0], 1, m0);
  assert.equal(a.state, 'hurt');
  assert.equal(a.facing, -1);
  const b = foe('philA');
  resolveHit(b, COMBO[2], 1, m0);
  assert.equal(b.state, 'down');
  const bear = foe('bear');
  assert.equal(resolveHit(bear, COMBO[0], 1, m0).reaction, 'armor');
  assert.equal(bear.state, 'idle');
});

test('hitting a thief makes him drop the sheep and fight', () => {
  const sheep = { x: 80, y: 200, carrier: {} as unknown };
  const thief = foe('thief', 30, { carry: sheep });
  const r = resolveHit(thief, COMBO[0], 1, m0);
  assert.equal(sheep.carrier, null);
  assert.equal(thief.carry, undefined);
  assert.equal(thief.fights, true);
  assert.deepEqual(r.events.find(e => e.type === 'sheepDropped'), { type: 'sheepDropped', x: 80, y: 200 });
});

test('the Amalekite chief calls two riders per mark passed, and none when the blow beats him', () => {
  const calls = (hp: number, dmg: number) => resolveHit(foe('chief', hp), { ...COMBO[0], dmg }, 1, m0).events.filter(e => e.type === 'reinforce');
  assert.equal(calls(125, 10).length, 1);
  const one = calls(125, 10)[0];
  assert.equal(one.type === 'reinforce' && one.spawns.filter(s => s.t === 'camel').length, 2);
  const both = calls(125, 70)[0];
  assert.equal(both.type === 'reinforce' && both.spawns.length, 4);
  assert.equal(calls(30, 40).length, 0); // knocked out past the mark: nobody comes
  assert.equal(calls(115, 10).length, 0); // already called at this mark
});

test('the Jebusite lord calls his guards', () => {
  const r = resolveHit(foe('lord', 125), { ...COMBO[0], dmg: 10 }, 1, m0).events.find(e => e.type === 'reinforce');
  assert.ok(r && r.type === 'reinforce' && r.spawns.some(s => s.t === 'jebArcher'));
});

test('Goliath enrages only once, at half health', () => {
  const g = goliath(60, 'stuck');
  const first = resolveHit(g, SLING_STONE, 1, m0, { src: 'stone' }); // forehead: 25
  assert.equal(first.events.filter(e => e.type === 'enraged').length, 1);
  assert.equal(g.g!.mode, 'stagger');
  g.g!.mode = 'stuck';
  const again = resolveHit(g, SLING_STONE, 1, m0, { src: 'stone' });
  assert.equal(again.events.filter(e => e.type === 'enraged').length, 0);
});

test('a stone that hits Goliath while he is guarded bounces back to the ground', () => {
  const r = resolveHit(goliath(100, 'walk'), SLING_STONE, -1, m0, { src: 'stone' });
  assert.equal(r.look, 'blocked');
  assert.ok(r.events.some(e => e.type === 'stoneBounced'));
});

test('Goliath at 1 hp from the staff: a one-time tip to finish him with the sling', () => {
  const g = goliath(2);
  const r = resolveHit(g, COMBO[2], -1, m0); // from behind: half damage, stops at 1
  assert.equal(g.hp, 1);
  assert.ok(r.events.some(e => e.type === 'hint'));
  assert.equal(resolveHit(g, COMBO[2], -1, m0).events.some(e => e.type === 'hint'), false);
});

test('a stone to the open forehead fells Goliath: big score, everyone else runs', () => {
  const g = goliath(20, 'stuck');
  const r = resolveHit(g, SLING_STONE, 1, m0, { src: 'stone' });
  assert.equal(g.state, 'down');
  assert.equal(r.m.score, 11000);
  assert.equal(r.m.hitstop, 0.6);
  assert.ok(r.events.some(e => e.type === 'goliathDown'));
});

test('kept as found: the faith strike still fills faith on Goliath', () => {
  const r = resolveHit(goliath(100), special, -1, m0, { special: true });
  assert.equal(r.m.faith, FAITH_PER_HIT);
});

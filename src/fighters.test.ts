import { test } from 'node:test';
import assert from 'node:assert/strict';
import { think, arrive, telegraphs, MAX_ATTACKERS, CHAIN_CHANCE, type Actor, type World, type Intent, type SheepBody } from './fighters.ts';
import { ENEMIES, CAMEL_WARN, SAUL_DODGES, SAUL_LOCK, saulThrow, type EnemyId, type Spawn } from './combat.ts';

const dt = 1 / 60;
const actor = (kind: EnemyId | undefined, x: number, y = 200, more: Partial<Actor> = {}): Actor => ({
  id: kind ?? 'david', name: '', kind, x, y, z: 0, vx: 0, vz: 0, facing: 1, hp: kind ? ENEMIES[kind].hp : 100, maxHp: 100,
  state: 'idle', t: 0, inv: 0, flash: 0, combo: 0, queued: false, hitSet: new Set(), airAtk: false, ...more,
});
const enemy = (kind: EnemyId, x: number, y = 200, camX = 0, rng = () => 0.5) => {
  const s: Spawn = { x: x - camX, y, t: kind }, e = actor(kind, x, y);
  arrive(e, s, [s], camX, [], rng);
  e.ai!.lane = 0; e.ai!.cd = 0;
  return e;
};
const world = (player: Actor, enemies: Actor[], more: Partial<World> = {}): World =>
  ({ player, enemies, camX: 0, locked: true, shots: [], flock: [], saulDodged: 0, rng: () => 0.5, ...more });
/** Step one enemy (advancing its clock like the scene does); returns every intent it made. */
const run = (e: Actor, w: World, seconds: number) => {
  const all: Intent[] = [];
  for (let i = 0; i < Math.round(seconds / dt) && !e.gone; i++) { e.t += dt; all.push(...think(e, w, dt)); } // the scene drops gone enemies
  return all;
};

test(`no more than ${MAX_ATTACKERS} enemies swing at David at once`, () => {
  const david = actor(undefined, 240);
  const busy = [0, 1, 2].map(i => { const e = enemy('philA', 200 + i, 200); e.ai!.mode = 'swing'; return e; });
  const next = enemy('philA', 240 - 34, 200);
  next.ai!.mode = 'ready'; next.ai!.wait = 0; next.ai!.side = -1;
  think(next, world(david, [...busy, next]), dt);
  assert.equal(next.ai!.mode, 'ready');
  assert.equal(next.ai!.wait, 0.12); // tries again shortly
  busy.pop();
  next.ai!.wait = 0;
  think(next, world(david, [...busy, next]), dt);
  assert.equal(next.ai!.mode, 'swing');
});

test('a soldier follows a swing with another only on the chain roll', () => {
  const swingDone = (roll: number) => {
    const david = actor(undefined, 240), e = enemy('philA', 210, 200);
    e.ai!.mode = 'swing'; e.atk = ENEMIES.philA.attack; e.state = 'attack'; e.t = e.atk.dur;
    think(e, world(david, [e], { rng: () => roll }), dt);
    return e.ai!.mode;
  };
  assert.equal(swingDone(CHAIN_CHANCE - 0.01), 'swing');
  assert.equal(swingDone(CHAIN_CHANCE), 'back');
});

test('an archer looses exactly one arrow per draw, on the lane he aimed at', () => {
  const david = actor(undefined, 100, 210), e = enemy('philD', 250, 210);
  const all = run(e, world(david, [e]), 1.5);
  const shots = all.filter(i => i.type === 'fire');
  assert.equal(shots.length, 1);
  assert.deepEqual(shots[0], { type: 'fire', spear: false, lane: 210 });
});

test('Saul throws only when no spear is in flight, and walks off after three dodges', () => {
  const david = actor(undefined, 200, 210), saul = enemy('saul', 430, 196);
  saul.ai!.wait = 0;
  assert.equal(think(saul, world(david, [saul], { shots: [{ spear: true }] }), dt).length, 0);
  assert.equal(saul.ai!.mode, 'ready');
  const said = think(saul, world(david, [saul]), dt);
  assert.equal(saul.ai!.mode, 'swing');
  assert.equal(saul.lane, 210);
  assert.equal(said[0].type, 'say');
  const leaving = enemy('saul', 470, 196);
  const out = run(leaving, world(david, [leaving], { saulDodged: SAUL_DODGES }), 2);
  assert.equal(leaving.gone, true);
  assert.ok(out.some(i => i.type === 'vanish'));
});

test("Saul's aim follows David, leads him if he keeps walking, then holds just before the throw", () => {
  const david = actor(undefined, 200, 210), saul = enemy('saul', 430, 196), w = world(david, [saul]);
  saul.ai!.wait = 0;
  think(saul, w, dt); // starts aiming at 210
  const a = saul.atk!, held = a.active[0] - SAUL_LOCK;
  for (let i = 0; i < 12; i++) { saul.t += dt; david.y += 80 * dt; think(saul, w, dt); } // David walks down the screen
  assert.ok(saul.lane! > david.y + 10, `aim ${saul.lane} should be ahead of David at ${david.y}`);
  while (saul.t < held) { saul.t += dt; think(saul, w, dt); }
  const lane = saul.lane!;
  assert.ok(telegraphs([saul], 0)[0].half > 6, 'the line thickens once the aim holds');
  david.y = 180;
  const shots: Intent[] = [];
  while (saul.ai!.mode === 'swing') { saul.t += dt; shots.push(...think(saul, w, dt)); }
  assert.deepEqual(shots.filter(i => i.type === 'fire'), [{ type: 'fire', spear: true, lane }]);
});

test('Saul winds up quicker after each dodge, and stops waiting for the last spear', () => {
  assert.ok(saulThrow(0).active[0] > saulThrow(1).active[0] && saulThrow(1).active[0] > saulThrow(2).active[0]);
  const david = actor(undefined, 200, 210), saul = enemy('saul', 430, 196);
  saul.ai!.wait = 0;
  think(saul, world(david, [saul], { shots: [{ spear: true }], saulDodged: 1 }), dt);
  assert.equal(saul.ai!.mode, 'swing');
});

test('Goliath is open (stuck) only right after a thrust or a slam', () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const david = actor(undefined, 120, 206), g = enemy('goliath', 330, 206, 0, rng);
  g.g!.phase2 = true; // with the slam in play too
  let prev = g.g!.mode, stuckFrom = new Set<string>();
  for (let i = 0; i < 60 * 40; i++) {
    david.x = 120 + Math.sin(i / 90) * 80; david.y = 190 + (i % 400) / 10; david.state = 'idle';
    g.t += dt;
    think(g, world(david, [g], { rng }), dt);
    if (g.g!.mode === 'stuck' && prev !== 'stuck') stuckFrom.add(prev);
    prev = g.g!.mode;
  }
  assert.ok(stuckFrom.size > 0);
  assert.deepEqual([...stuckFrom].filter(m => m !== 'thrust' && m !== 'jump'), []);
});

test('camel riders hold still while warned, then gallop across David\'s lane and leave', () => {
  const david = actor(undefined, 240, 214), c = enemy('camel', -40, 210);
  const w = world(david, [c]);
  const x0 = c.x;
  run(c, w, CAMEL_WARN - 0.05);
  assert.equal(c.x, x0);
  assert.equal(c.lane, 214);
  assert.ok(telegraphs([c], 0).length > 0);
  const out = run(c, w, 3);
  assert.ok(out.some(i => i.type === 'strike'));
  assert.ok(out.some(i => i.type === 'vanish'));
});

test('a thief walks to the nearest free sheep, grabs it and drags it off the edge', () => {
  const david = actor(undefined, 400), t = enemy('thief', 300, 200);
  const near: SheepBody = { i: 0, x: 250, y: 200, facing: 1, moving: false, carrier: null };
  const far: SheepBody = { i: 1, x: 100, y: 200, facing: 1, moving: false, carrier: null };
  const w = world(david, [t], { flock: [far, near], locked: false });
  const out = run(t, w, 10);
  assert.equal(near.carrier, t);
  assert.equal(far.carrier, null);
  assert.deepEqual(out.filter(i => i.type === 'grab' || i.type === 'stole' || i.type === 'vanish').map(i => i.type), ['grab', 'stole', 'vanish']);
});

test('every strong attack is warned with a red line first', () => {
  const kinds = Object.keys(ENEMIES) as EnemyId[];
  for (const kind of kinds) {
    const d = ENEMIES[kind];
    for (const a of [d.attack, d.special?.attack]) {
      if (!a || !(a.keep || d.ai === 'archer' || d.ai === 'saul')) continue;
      const e = enemy(kind, 300);
      e.ai!.mode = 'swing'; e.atk = a; e.t = 0;
      assert.ok(telegraphs([e], 0).length > 0, `${kind}: ${a.pose} comes without warning`);
    }
  }
  const g = enemy('goliath', 300);
  g.g!.mode = 'tele';
  assert.ok(telegraphs([g], 0).length > 0, 'Goliath thrust comes without warning');
  const c = enemy('camel', -40);
  c.t = 0; c.lane = 210;
  assert.ok(telegraphs([c], 0).length > 0, 'camel rider comes without warning');
});

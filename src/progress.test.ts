import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, startAt, cameraTarget, betweenFights, verdict, LOCK_AT, RIGHT_EDGE, type Prog, type Left } from './progress.ts';
import { ENEMIES, type Section } from './combat.ts';
import { STAGES } from './stages.ts';

const sections: Section[] = [
  { at: 0, waves: [[{ x: 500, y: 200 }], [{ x: 500, y: 210 }]] },
  { at: 600, waves: [[{ x: 500, y: 200 }]] },
];
const start: Prog = { section: 0, wave: 0, locked: false, done: false };
const none: Left = { enemies: 0, stealthGoals: 0, captives: 0 };
const enemies = (n: number): Left => ({ ...none, enemies: n });
const spawned = (r: ReturnType<typeof advance>) => r.events.flatMap(e => (e.type === 'wave' ? [e.spawns] : []))[0] ?? null;

// (moved from combat.test.ts with stepProg; same assertions against advance)
test('screen locks when the player walks in, spawning wave 1', () => {
  assert.equal(spawned(advance(start, sections, 150, none)), null);
  const r = advance(start, sections, 200, none);
  assert.equal(r.p.locked, true);
  assert.deepEqual(spawned(r), sections[0].waves[0]);
});

test('next wave only after everyone is down', () => {
  const locked: Prog = { ...start, locked: true };
  assert.equal(spawned(advance(locked, sections, 300, enemies(1))), null);
  assert.equal(advance(locked, sections, 300, enemies(1)).p.wave, 0);
  const r = advance(locked, sections, 300, none);
  assert.equal(r.p.wave, 1);
  assert.deepEqual(spawned(r), sections[0].waves[1]);
});

test('last wave cleared unlocks and moves to next section, then done', () => {
  const r = advance({ ...start, locked: true, wave: 1 }, sections, 300, none);
  assert.deepEqual(r.p, { section: 1, wave: 0, locked: false, done: false });
  assert.deepEqual(r.events, [{ type: 'sectionClear' }]);
  const end = advance({ section: 1, wave: 0, locked: true, done: false }, sections, 900, none);
  assert.equal(end.p.done, true);
  assert.deepEqual(end.events, [{ type: 'sectionClear' }, { type: 'stageClear' }]);
});

const sneak: Section[] = [{
  at: 0, waves: [],
  stealth: { mood: 'cave', saul: { x: 400, y: 200 }, guards: [{ x: 300, y: 200 }], goals: [{ x: 380, y: 210, kind: 'robe' }] },
}];

test('a stealth section starts its sneaking exactly once and spawns nobody', () => {
  let r = advance(start, sneak, LOCK_AT, none);
  assert.deepEqual(r.events.map(e => e.type), ['stealth']);
  for (let i = 0; i < 5; i++) {
    r = advance(r.p, sneak, LOCK_AT + i * 40, { ...none, stealthGoals: 1 });
    assert.deepEqual(r.events, []);
    assert.equal(r.p.locked, true);
  }
  r = advance(r.p, sneak, LOCK_AT, none);
  assert.deepEqual(r.events.map(e => e.type), ['sectionClear', 'stageClear']);
});

test('the camp stays locked until every captive is freed, even with no enemies left', () => {
  const camp: Section[] = [{ at: 0, waves: [[{ x: 500, y: 200 }]], captives: [{ x: 300, y: 200, who: 'child' }, { x: 340, y: 220, who: 'villager' }] }];
  const r = advance(start, camp, LOCK_AT, none);
  assert.deepEqual(r.events.map(e => e.type), ['wave', 'captives']);
  assert.equal(advance(r.p, camp, LOCK_AT, { ...none, captives: 1 }).p.locked, true);
  assert.equal(advance(r.p, camp, LOCK_AT, none).p.done, true);
});

test('retrying after a fall starts just inside that section with its earlier tips already shown', () => {
  const z = STAGES.ziklag, s = startAt(z, 2);
  assert.deepEqual(s.prog, { section: 2, wave: 0, locked: false, done: false });
  assert.equal(s.camX, z.sections[2].at);
  assert.equal(s.playerX, z.sections[2].at + 60);
  assert.equal(s.hintsShown, z.hints.filter(h => h.at < z.sections[2].at).length);
  assert.ok(s.hintsShown > 0 && s.hintsShown < z.hints.length);
  const fresh = startAt(STAGES.goliath, 0);
  assert.equal(fresh.playerX, 210); // the arena's own start
  assert.equal(fresh.hintsShown, 0);
});

test('camera holds on a locked section and otherwise only moves forward', () => {
  assert.equal(cameraTarget({ ...start, section: 1, locked: true }, sections, 0, 900), 600);
  assert.equal(cameraTarget(start, sections, 300, 400), 300);
  assert.equal(cameraTarget(start, sections, 100, 400), 200);
});

test('GO only between fights; the verdict follows the stage or David', () => {
  assert.equal(betweenFights({ section: 1, wave: 0, locked: false, done: false }), true);
  assert.equal(betweenFights(start), false);
  assert.equal(verdict({ ...start, done: true }, false), 'clear');
  assert.equal(verdict(start, true), 'dead');
  assert.equal(verdict(start, false), null);
});

test('every stage can be walked through: sections in order, each reachable and with something to beat', () => {
  for (const [id, st] of Object.entries(STAGES)) {
    st.sections.forEach((s, i) => {
      const where = `${id} section ${i}`;
      if (i) assert.ok(s.at > st.sections[i - 1].at, `${where}: out of order`);
      assert.ok(s.at + LOCK_AT <= st.width - RIGHT_EDGE, `${where}: David can't walk far enough to lock it`);
      assert.ok(s.waves.length || s.stealth || s.captives, `${where}: nothing to do`);
      for (const w of s.waves) {
        assert.ok(w.length > 0, `${where}: empty wave`);
        // a wave of only untouchable enemies must be one that leaves by itself (Saul walks off after the dodges)
        if (w.every(e => ENEMIES[e.t ?? 'philA'].untouchable)) assert.ok(w.every(e => ENEMIES[e.t ?? 'philA'].ai === 'saul'), `${where}: can never be cleared`);
      }
      if (s.stealth) assert.ok(s.stealth.goals.length > 0, `${where}: stealth with no goals`);
    });
    // and the progress rules carry David from the first section to the end
    let p = startAt(st, 0).prog;
    for (let guard = 0; guard < 100 && !p.done; guard++) p = advance(p, st.sections, st.sections[p.section].at + LOCK_AT, none).p;
    assert.equal(p.done, true, `${id}: never finishes`);
  }
});

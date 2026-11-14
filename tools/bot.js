// Dev-only autoplay harness for checking a stage end to end (not part of the game build).
// In a dev tab opened with ?stage=<id>&canvas:  const bot = await import('/tools/bot.js'); bot.setup(); bot.play({ god: true })
// The game loop is put to sleep and stepped by hand, so it works in background tabs.

const CODES = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, z: 90, x: 88, c: 67, v: 86, f: 70, g: 71, Escape: 27 };
let T = 0;
const held = {};

export function key(k, down) {
  const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { get: () => CODES[k] });
  Object.defineProperty(e, 'which', { get: () => CODES[k] });
  window.dispatchEvent(e);
}
export function run(n) { for (let i = 0; i < n; i++) { T += 16.667; window.game.step(T, 16.667); } }
export function tap(k) { key(k, true); run(1); key(k, false); }
function hold(k, on) { if (!!held[k] !== on) { key(k, on); held[k] = on; } }
export const scenes = () => window.game.scene.getScenes(true).map(s => s.sys.settings.key).join();

let C = null;
export async function setup() { C = await import('/src/combat.ts'); window.game.loop.sleep(); T = performance.now(); run(10); }

/** Play the current stage. god: keep David alive (flow check); returns what happened. */
export function play({ god = false, seconds = 240 } = {}) {
  const s = window.game.scene.getScene('stage'), p = s.player;
  if (god) p.hp = p.maxHp = 5000;
  const log = [], ev = { hitsTaken: 0, deaths: 0, specials: 0, slings: 0, allies: 0, caught: 0 };
  const caught0 = s.caught.bind(s); s.caught = () => { ev.caught++; return caught0(); };
  let last = JSON.stringify(s.prog), hp = p.hp, f = 0;
  for (; f < 60 * seconds && !s.ended; f++) {
    const live = s.enemies.filter(e => e.state !== 'dead' && e.state !== 'down' && !e.flee && !s.def(e).untouchable);
    const lethal = s.enemies.filter(e => e.state !== 'dead' && !e.flee);
    let dx = 0, dy = 0, k = null;
    const laneOf = e => e.lane ?? e.g?.lane ?? e.y;
    const incoming = s.shots.find(sh => Math.abs(sh.y - p.y) <= 14 && (p.x - sh.x) * sh.dir > 0 && Math.abs(p.x - sh.x) < 200);
    const warn = lethal.find(e => (e.ai?.mode === 'swing' && e.atk && e.t < e.atk.active[0] && (e.atk.keep || ['philD', 'saul'].includes(e.kind)) && Math.abs(laneOf(e) - p.y) <= 16)
      || (e.g?.mode === 'tele' && Math.abs(e.g.lane - p.y) <= 16));
    const G = lethal.find(e => e.g);
    const st = s.stealthRun, goal = st?.goals.find(g => !g.done);
    if (goal) {
      // sneak: head for the goal, sidestep anything a guard would see, never run near sleepers
      const gx = st.at + goal.g.x, gy = goal.g.y, risky = (x, y) => st.sentries.some(se => !se.g.asleep && C.seen(se, { x, y }));
      dx = Math.abs(gx - p.x) > 6 ? Math.sign(gx - p.x) : 0; dy = Math.abs(gy - p.y) > 4 ? Math.sign(gy - p.y) : 0;
      if (risky(p.x + dx * 18, p.y + dy * 10) || st.sentries.some(se => se.meter > 0.15)) {
        if (!risky(p.x - 18, p.y)) { dx = -1; dy = 0; } else if (!risky(p.x, p.y + 20)) { dx = 0; dy = 1; } else if (!risky(p.x, p.y - 20)) { dx = 0; dy = -1; } else { dx = 0; dy = 0; }
      }
      if (p.state === 'run') dx = 0;
      if (Math.abs(gx - p.x) < 18 && Math.abs(gy - p.y) < 10) { dx = 0; dy = 0; if (f % 10 === 0) k = 'z'; }
    }
    else if (s.quake && p.state !== 'jump' && Math.abs(Math.abs(p.x - s.quake.x) - s.quake.t * 420) < 60) k = 'x';
    else if (incoming || warn) dy = p.y < 207 ? 1 : -1;
    else if (G && G.state !== 'down' && G.g.mode === 'stuck') {
      dy = Math.abs(G.y - p.y) > 4 ? Math.sign(G.y - p.y) : 0;
      if (Math.sign(G.x - p.x) !== p.facing) dx = Math.sign(G.x - p.x);
      else if (Math.abs(G.y - p.y) <= 10 && s.ammo > 0 && s.slingCd <= 0) k = 'c';
    } else if (s.ammo === 0 && s.pickups.length && (G || !live.length)) {
      const t = s.pickups[0]; dx = Math.abs(t.x - p.x) > 4 ? Math.sign(t.x - p.x) : 0; dy = Math.abs(t.y - p.y) > 3 ? Math.sign(t.y - p.y) : 0;
    } else if (live.length && !(G && live.length === 1)) {
      const e = live.filter(o => !o.g).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] ?? live[0];
      const near = live.filter(o => Math.abs(o.x - p.x) < 50 && Math.abs(o.y - p.y) < 14).length;
      if (s.faith >= 100 && live.length >= 2) { k = 'v'; ev.specials++; }
      else if (s.stage.allies && s.allyCd <= 0 && live.length >= 2) { k = 'g'; ev.allies++; }
      else if (near >= 2 && s.faith >= 25 && f % 30 === 0) k = 'f';
      const want = e.x - (e.x > p.x ? 32 : -32);
      dx = Math.abs(want - p.x) > 4 ? Math.sign(want - p.x) : 0; dy = Math.abs(e.y - p.y) > 3 ? Math.sign(e.y - p.y) : 0;
      if (!k && !dx && !dy) { if (Math.sign(e.x - p.x) !== p.facing) dx = Math.sign(e.x - p.x); else if (f % 6 === 0) k = 'z'; }
    } else if (s.bound?.some(b => !b.done)) { // untie the captives
      const b = s.bound.find(b => !b.done);
      dx = Math.abs(b.x - p.x) > 6 ? Math.sign(b.x - p.x) : 0; dy = Math.abs(b.c.y - p.y) > 4 ? Math.sign(b.c.y - p.y) : 0;
      if (Math.abs(b.x - p.x) < 18 && Math.abs(b.c.y - p.y) < 10 && f % 10 === 0) { dx = 0; dy = 0; k = 'z'; }
    } else if (G) { // bait Goliath's thrust from ~110px on his lane
      const want = G.x - Math.sign(G.x - p.x || 1) * 110; dx = Math.abs(want - p.x) > 6 ? Math.sign(want - p.x) : 0; dy = Math.abs(G.y - p.y) > 4 ? Math.sign(G.y - p.y) : 0;
    } else if (s.botGoal) { [dx, dy, k] = s.botGoal(p, f) ?? [0, 0, null]; } // stage-specific objective (stealth etc.)
    else if (!s.prog.locked) dx = 1;
    hold('ArrowRight', dx > 0); hold('ArrowLeft', dx < 0); hold('ArrowDown', dy > 0); hold('ArrowUp', dy < 0);
    if (k) key(k, true); run(1); if (k) key(k, false);
    if (k === 'c') ev.slings++;
    if (p.hp < hp) ev.hitsTaken++; hp = p.hp;
    if (p.state === 'dead') { ev.deaths++; break; }
    const pr = JSON.stringify(s.prog); if (pr !== last) { log.push(`${(f / 60).toFixed(1)}s ${pr}`); last = pr; }
  }
  ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].forEach(k => hold(k, false));
  const out = { seconds: (f / 60).toFixed(1), ended: s.ended, hpLeft: p.hp, ...ev, log };
  if (s.ended === 'clear') { run(60 * 4 + 20); out.next = scenes(); const cs = window.game.scene.getScene('cutscene'); if (out.next === 'cutscene') out.nextFirstLine = cs.cs.beats[0].text.slice(0, 24); }
  return out;
}

/** Click through the current cutscene, mashing through any button-mash beat. Returns the beats seen. */
export function readCutscene(maxBeats = 30) {
  const seen = [];
  for (let i = 0; i < maxBeats && scenes() === 'cutscene'; i++) {
    const cs = window.game.scene.getScene('cutscene');
    run(150);
    const b = cs.cs.beats[cs.i];
    if (b) seen.push(`${cs.i}:${cs.name.text || '-'}${b.qte ? '(qte)' : ''}`);
    if (b?.qte) for (let k = 0; k < b.qte + 2; k++) { tap('z'); run(3); }
    tap('z'); run(2); tap('z'); run(5);
  }
  return { seen, now: scenes() };
}

/** Climb the water shaft: hold up, step out of any warned column. */
export function climb(seconds = 90) {
  const sc = window.game.scene.getScene('shaft');
  let f = 0, slides = 0, lastY = sc.y;
  for (; f < 60 * seconds && scenes() === 'shaft' && sc.doneAt < 0; f++) {
    const danger = sc.rocks.some(r => Math.abs(r.x - sc.x) < 20 && (r.t < 0 || r.y < sc.y));
    const free = [196, 240, 284].filter(x => !sc.rocks.some(r => Math.abs(r.x - x) < 20 && (r.t < 0 || r.y < sc.y)));
    const target = danger && free.length ? free.reduce((a, b) => (Math.abs(a - sc.x) < Math.abs(b - sc.x) ? a : b)) : sc.x;
    hold('ArrowUp', !danger); hold('ArrowLeft', target < sc.x - 3); hold('ArrowRight', target > sc.x + 3);
    run(1);
    if (sc.y > lastY + 30) slides++; lastY = sc.y;
  }
  ['ArrowUp', 'ArrowLeft', 'ArrowRight'].forEach(k => hold(k, false));
  run(120);
  return { seconds: (f / 60).toFixed(1), slides, now: scenes() };
}

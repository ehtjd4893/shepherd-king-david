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

let A = null;
export async function setup() { A = await import('/src/autoplay.ts'); window.game.loop.sleep(); T = performance.now(); run(10); }

/** Play the current stage with the shared autoplayer (src/autoplay.ts). god: keep David alive (flow check); returns what happened. */
export function play({ god = false, seconds = 240 } = {}) {
  const s = window.game.scene.getScene('stage').sim, p = s.player;
  if (god) p.hp = p.maxHp = 5000;
  const log = [], ev = { hitsTaken: 0, deaths: 0, specials: 0, slings: 0, allies: 0, caught: 0 };
  let last = JSON.stringify(s.prog), hp = p.hp, f = 0;
  for (; f < 60 * seconds && !s.ended; f++) {
    const { dx, dy, k } = A.decide(s, f);
    if (k === 'v') ev.specials++;
    if (k === 'g') ev.allies++;
    hold('ArrowRight', dx > 0); hold('ArrowLeft', dx < 0); hold('ArrowDown', dy > 0); hold('ArrowUp', dy < 0);
    if (k) key(k, true); run(1); if (k) key(k, false);
    if (s.stealthEvents.some(e => e.type === 'caught')) ev.caught++;
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

import { STAGES } from './stages.ts';

/** Where to continue from: the stage last started, and the score at that point. */
export interface Save { stage: string; score: number }

const KEY = 'shepherd-king-david/save';

/** Saved data comes from the browser and may be stale or hand-edited: accept only a known stage and a sane score. */
export function parseSave(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.stage === 'string' && Object.hasOwn(STAGES, v.stage) && Number.isFinite(v.score) && v.score >= 0)
      return { stage: v.stage, score: Math.floor(v.score) };
  } catch { /* not JSON: treat as no save */ }
  return null;
}

// localStorage can throw (private mode, blocked storage). The game must still run, it just won't remember.
export function loadSave(): Save | null {
  try { return parseSave(localStorage.getItem(KEY)); } catch { return null; }
}
export function writeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* see above */ }
}

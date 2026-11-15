import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playStage } from './autoplay.ts';
import { STAGES } from './stages.ts';

// Every stage, start to finish, with no screen: the autoplayer must clear it without god mode
// (retrying a section after a fall, as a player would). Seeded, so a failure repeats exactly.
for (const id of Object.keys(STAGES)) {
  test(`stage ${id} can be cleared`, { timeout: 60_000 }, () => {
    const r = playStage(id, { seed: 7 });
    assert.equal(r.cleared, true, JSON.stringify(r.attempts));
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSave } from './save.ts';

test('a valid save is read back', () => {
  assert.deepEqual(parseSave('{"stage":"keilah","score":12345.7}'), { stage: 'keilah', score: 12345 });
});

test('missing, broken or tampered saves are ignored', () => {
  assert.equal(parseSave(null), null);
  assert.equal(parseSave('not json'), null);
  assert.equal(parseSave('{"stage":"atlantis","score":10}'), null); // unknown stage
  assert.equal(parseSave('{"stage":"toString","score":10}'), null); // not an own stage
  assert.equal(parseSave('{"stage":"field","score":-5}'), null);
  assert.equal(parseSave('{"stage":"field"}'), null);
});

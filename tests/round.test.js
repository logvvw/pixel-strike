import test from 'node:test';
import assert from 'node:assert/strict';

import { RoundGate } from '../js/engine/round.js';

test('only the first terminal outcome can claim a round', () => {
  const gate = new RoundGate();

  const win = gate.claim('win');
  const timeout = gate.claim('timeout');
  const death = gate.claim('death');

  assert.equal(win.outcome, 'win');
  assert.equal(timeout, null);
  assert.equal(death, null);
  assert.equal(gate.outcome, 'win');
});

test('a token from an earlier round cannot restart a newer round', () => {
  const gate = new RoundGate();
  const oldToken = gate.claim('timeout');

  gate.reset();

  assert.equal(gate.isCurrent(oldToken), false);
  assert.equal(gate.pending, false);
  assert.equal(gate.claim('win').outcome, 'win');
});

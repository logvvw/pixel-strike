import test from 'node:test';
import assert from 'node:assert/strict';

import { InputState } from '../js/engine/input.js';

test('mouse press is consumed once while held state remains true', () => {
  const state = new InputState();

  state.setMouseButton(0, true);

  assert.equal(state.consumeMousePress(0), true);
  assert.equal(state.consumeMousePress(0), false);
  assert.equal(state.isMouseHeld(0), true);
});

test('reset clears held keyboard and mouse state', () => {
  const state = new InputState();
  state.setKey('Space', true);
  state.setMouseButton(0, true);

  state.reset();

  assert.equal(state.isKeyHeld('Space'), false);
  assert.equal(state.isMouseHeld(0), false);
  assert.equal(state.consumeMousePress(0), false);
});

test('modifier key releases on keyup so crouch/jump never get stuck', () => {
  const state = new InputState();

  // Simulate Shift held, then released.
  state.setKey('ShiftLeft', true);
  assert.equal(state.isKeyHeld('ShiftLeft'), true);
  state.setKey('ShiftLeft', false);
  assert.equal(state.isKeyHeld('ShiftLeft'), false, 'Shift keyup must clear held state');

  // Simulate Ctrl press: one-shot press must consume exactly once even if
  // the key stays held, then release on keyup.
  state.setKey('ControlLeft', true);
  assert.equal(state.consumeKeyPress('ControlLeft'), true);
  assert.equal(state.consumeKeyPress('ControlLeft'), false, 'a single Ctrl press fires once');
  state.setKey('ControlLeft', false);
  assert.equal(state.isKeyHeld('ControlLeft'), false, 'Ctrl keyup must clear held state');
});

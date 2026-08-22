/**
 * input.js — 键盘 & 鼠标输入处理
 */

/** 可脱离浏览器测试的按键状态。 */
export class InputState {
  constructor() {
    this.reset();
  }

  setKey(code, isDown) {
    if (isDown && !this.keys[code]) this.pressedKeys.add(code);
    this.keys[code] = isDown;
  }

  setMouseButton(button, isDown) {
    if (isDown && !this.mouseButtons[button]) this.pressedMouseButtons.add(button);
    this.mouseButtons[button] = isDown;
  }

  isKeyHeld(code) {
    return !!this.keys[code];
  }

  isMouseHeld(button) {
    return !!this.mouseButtons[button];
  }

  consumeKeyPress(code) {
    const pressed = this.pressedKeys.has(code);
    this.pressedKeys.delete(code);
    return pressed;
  }

  consumeMousePress(button) {
    const pressed = this.pressedMouseButtons.has(button);
    this.pressedMouseButtons.delete(button);
    return pressed;
  }

  reset() {
    this.keys = Object.create(null);
    this.mouseButtons = Object.create(null);
    this.pressedKeys = new Set();
    this.pressedMouseButtons = new Set();
  }
}

export class InputHandler {
  constructor() {
    this.state = new InputState();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseLocked = false;

    window.addEventListener('keydown', event => {
      this.state.setKey(event.code, true);
      // Only prevent default for regular gameplay keys. Modifier keys
      // (Shift/Ctrl) must NOT be prevented — preventing their keydown in
      // real browsers suppresses the corresponding keyup, leaving the held
      // state stuck forever (crouch/jump never releases, game appears frozen).
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyP'].includes(event.code)) {
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', event => {
      this.state.setKey(event.code, false);
    });

    window.addEventListener('mousedown', event => {
      this.state.setMouseButton(event.button, true);
    });

    window.addEventListener('mouseup', event => {
      this.state.setMouseButton(event.button, false);
    });

    document.addEventListener('mousemove', event => {
      if (this.mouseLocked) {
        this.mouseDX += event.movementX;
        this.mouseDY += event.movementY;
      }
    });

    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  lockPointer(canvas) {
    canvas.addEventListener('click', () => canvas.requestPointerLock?.());
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = !!document.pointerLockElement;
      if (!this.mouseLocked) this.reset();
    });
  }

  /** 按下即触发，不持续 */
  justPressed(code) {
    return this.state.consumeKeyPress(code);
  }

  /** 持续按住 */
  isHeld(code) {
    return this.state.isKeyHeld(code);
  }

  mouseJustPressed(button = 0) {
    return this.state.consumeMousePress(button);
  }

  isMouseHeld(button = 0) {
    return this.state.isMouseHeld(button);
  }

  /** 获取鼠标旋转量并消耗 */
  consumeMouseX() {
    const value = this.mouseDX;
    this.mouseDX = 0;
    return value;
  }

  consumeMouseY() {
    const value = this.mouseDY;
    this.mouseDY = 0;
    return value;
  }

  reset() {
    this.state.reset();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}

// Input: keyboard and mouse, both steering the same aircraft.
// Arrow keys / WASD bank and pitch, Shift throttles up, Control throttles
// down, Space or click confirms on menus. The mouse steers too: where the
// pointer sits, the nose follows. Every frame the game takes what happened
// since the last one, so a held key and a quick tap read the same.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let pointerActive = false;

  function down(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key);
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
  }

  function up(event) {
    keys.delete(event.key);
  }

  function blur() {
    keys.clear();
    pointerActive = false;
  }

  function move(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width;
    pointerY = (event.clientY - rect.top) / rect.height;
    pointerActive = true;
  }

  function press(event) {
    move(event);
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', press);
  canvas.addEventListener('pointerleave', () => {
    pointerActive = false;
  });

  function held(...names) {
    return names.some((name) => keys.has(name));
  }

  return {
    /** -1 (left) .. 1 (right), from keys or from the pointer. */
    steer() {
      let value = 0;
      if (held('ArrowLeft', 'a', 'A')) value -= 1;
      if (held('ArrowRight', 'd', 'D')) value += 1;
      if (pointerActive) {
        const pointerSteer = (pointerX - 0.5) * 2;
        if (Math.abs(pointerSteer) > Math.abs(value)) value = pointerSteer;
      }
      return Math.max(-1, Math.min(1, value));
    },
    /** -1 (sink) .. 1 (climb), from keys or from the pointer. */
    climb() {
      let value = 0;
      if (held('ArrowUp', 'w', 'W')) value += 1;
      if (held('ArrowDown', 's', 'S')) value -= 1;
      if (pointerActive) {
        const pointerClimb = (0.5 - pointerY) * 2;
        if (Math.abs(pointerClimb) > Math.abs(value)) value = pointerClimb;
      }
      return Math.max(-1, Math.min(1, value));
    },
    /** -1 (cut) .. 1 (full), from Shift / Control. */
    throttle() {
      if (held('Shift')) return 1;
      if (held('Control')) return -1;
      return 0;
    },
    /** Actions since the last take, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

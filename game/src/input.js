// Keyboard and mouse state for the game loop: held keys for movement, an edge-triggered
// set for one-shot actions (tools, pause, restart), and clicks in canvas coordinates.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let click = null;
  let pointer = { x: 0, y: 0 };

  const toCanvas = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointermove', (event) => { pointer = toCanvas(event); });
  canvas.addEventListener('pointerdown', (event) => { click = toCanvas(event); });

  return {
    /** Movement axes, -1..1 on each side, from WASD or the arrow keys. */
    axes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    down(code) { return held.has(code); },
    /** True once per physical press; reading it consumes it. */
    tapped(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    /** The latest click in canvas coordinates, or null; reading it consumes it. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
    pointer() { return pointer; },
    endFrame() { pressed.clear(); },
  };
}

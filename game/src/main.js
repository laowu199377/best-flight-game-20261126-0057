// Golden Hour: the boot, the loop and the screens.
//
// The game is a single page. The canvas fills the window; the world steps
// at a fixed 1/60s so a run plays the same on any machine. A `?shot=` query
// stages a screenshot instead: the world is driven by the autopilot to a
// chosen moment and `window.__shotReady` is set once that frame is drawn,
// so the shot is a real frame of the game's own code.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, EVENT_RING } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'golden-hour-best';
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);

let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  best = 0;
}
function saveBest(value) {
  best = Math.max(best, value);
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Private mode: the score still counts for this run.
  }
}

function resize() {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * scale);
  canvas.height = Math.round(window.innerHeight * scale);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7);
const random = createRandom(seed);
const world = createWorld(random);

let screen = SCREEN_TITLE;
let shotReady = false;

if (shotName) {
  const staged = stageShot(world, shotName, seed);
  screen = staged === 'title' ? SCREEN_TITLE : SCREEN_PLAY;
  renderer.draw(world, screen, best, 0);
  shotReady = true;
  window.__shotReady = true;
  document.title = `Golden Hour — ${shotName}`;
}

let last = performance.now();
let accumulator = 0;
let clock = 0;

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += elapsed;
  accumulator += elapsed;

  const actions = input.takeActions();
  if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
    world.reset();
    screen = SCREEN_PLAY;
  } else if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
    screen = SCREEN_PAUSED;
  } else if (screen === SCREEN_PAUSED && (actions & ACTION_CONFIRM || actions & ACTION_PAUSE)) {
    screen = SCREEN_PLAY;
  } else if (screen === SCREEN_OVER && (actions & ACTION_CONFIRM)) {
    world.reset();
    screen = SCREEN_PLAY;
  }

  // Fixed steps, at most five a frame, so a slow frame never spirals.
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    accumulator -= STEP;
    steps += 1;
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, 0, 0, true);
    } else if (screen === SCREEN_PLAY) {
      const events = world.step(STEP, input.steer(), input.climb(), input.throttle(), false);
      if (events & EVENT_RING) saveBest(world.state.score);
      if (events & EVENT_OVER) {
        saveBest(world.state.score);
        screen = SCREEN_OVER;
      }
    }
  }
  if (steps === 5) accumulator = 0;

  renderer.draw(world, screen, best, clock);
  if (shotName && !shotReady) {
    shotReady = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

if (!shotName) requestAnimationFrame(frame);

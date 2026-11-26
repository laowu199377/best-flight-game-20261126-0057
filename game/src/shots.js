// Screenshot staging: drive the game with an autopilot so each shot is a
// real frame of the game, not a mock-up. The autopilot reads the next ring
// and steers and climbs for it, the same way a player would, so the score
// and the rings in the frame are genuinely earned by the game's own code.
//
// ?shot=start  — the title screen over a live, idling corridor.
// ?shot=play   — mid-run, rings ahead, a real score on the board.
// ?shot=end    — the last seconds of a long run, the clock nearly out.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';

function nextRing(world) {
  const az = world.aircraftZ();
  for (const seg of world.segments) {
    if (seg.ring && !seg.ring.passed && seg.ring.z > az) return seg.ring;
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function autopilotStep(world, dt) {
  const { state } = world;
  const ring = nextRing(world);
  let steer = 0;
  let climb = 0;
  if (ring) {
    steer = clamp((ring.x - state.x) / 1200, -1, 1);
    const ringAlt = ring.y - world.groundAt(state.position);
    climb = clamp((ringAlt - state.alt) / 1600, -1, 1);
  }
  const throttle = state.speed < 5200 ? 1 : 0;
  return world.step(dt, steer, climb, throttle, false);
}

function runFor(world, seconds, drive) {
  let events = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    events = drive(world, STEP);
    if (events & EVENT_OVER) break;
  }
  return events;
}

/** Put the world in the state a named shot wants, and return its screen. */
export function stageShot(world, name, seed) {
  const { state } = world;
  if (name === 'start') {
    world.reset();
    // A few seconds of idle flight: the corridor alive behind the title.
    runFor(world, 4, (w, dt) => w.step(dt, 0, 0, 0, true));
    state.message = '';
    return 'title';
  }
  if (name === 'end') {
    world.reset();
    // A long run, well flown, so the board shows a real score.
    runFor(world, 46, autopilotStep);
    // The last seconds of the run: the clock nearly out, a ring ahead.
    state.timeLeft = Math.min(state.timeLeft, 6);
    state.message = 'Final stretch — one more ring.';
    return 'play';
  }
  // 'play' and anything else: mid-run, rings ahead, score on the board.
  world.reset();
  runFor(world, 18, autopilotStep);
  return 'play';
}

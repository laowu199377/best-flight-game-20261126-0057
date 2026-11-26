// The world: a runway corridor built from segments, the aircraft flying it,
// and the rings that pay. Everything here is pure simulation — no drawing —
// so the same seed always plays the same run and a screenshot staged from
// it is the same frame every time.
import {
  ALT_MAX,
  ALT_START,
  ACCEL,
  BRAKE,
  CLIMB_RATE,
  COMBO_MAX,
  COMBO_STEP,
  DRAG,
  GOLD_EVERY,
  GOLD_RING_POINTS,
  LEVEL_RATE,
  LIVES,
  PLAYER_Z,
  RING_EVERY,
  RING_HIT_SLACK,
  RING_POINTS,
  RING_RADIUS,
  ROAD_WIDTH,
  RUN_SECONDS,
  SEGMENT_LENGTH,
  SINK_RATE,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_START,
  STEER_SPEED,
  TURN_RATE,
  X_LIMIT,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_MISS = 2;
export const EVENT_CRASH = 4;
export const EVENT_OVER = 8;

/** Sections the corridor is built from: [length, curve, climb] per section. */
const SECTIONS = [
  [60, 0, 0],
  [40, 1, 0],
  [40, 0, 1],
  [50, -1, 0],
  [40, 0, -1],
  [60, 2, 1],
  [40, -2, 0],
  [50, 0, 0],
  [40, 1, -1],
  [60, -1, 1],
  [40, 0, 0],
  [50, 2, 0],
];

/** Segments in the corridor: long enough that a whole run never reaches the end. */
const TRACK_SEGMENTS = 5200;

/** Ease a value in and out over a section, so bends and hills arrive gently. */
function easeInOut(a, b, t) {
  return a + (b - a) * t * t * (3 - 2 * t);
}

export function createWorld(random) {
  const segments = [];

  function addSegment(curve, dy) {
    const n = segments.length;
    const last = segments[n - 1];
    const x = last ? last.p2.x : 0;
    const y = last ? last.p2.y : 0;
    const z = n * SEGMENT_LENGTH;
    segments.push({
      index: n,
      curve,
      p1: { x, y, z },
      p2: { x: x + curve, y: y + dy, z: z + SEGMENT_LENGTH },
      ring: null,
      color: Math.floor(n / 3) % 2 === 0 ? 'a' : 'b',
    });
  }

  function addRoad(enter, hold, leave, curve, climb) {
    const startY = segments.length === 0 ? 0 : segments[segments.length - 1].p2.y;
    const endY = startY + climb * SEGMENT_LENGTH;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n += 1) {
      addSegment(easeInOut(0, curve, n / enter), ((endY - startY) * (n / total)) / SEGMENT_LENGTH);
    }
    for (let n = 0; n < hold; n += 1) {
      addSegment(curve, (endY - startY) / total / SEGMENT_LENGTH);
    }
    for (let n = 0; n < leave; n += 1) {
      addSegment(easeInOut(curve, 0, n / leave), ((endY - startY) * ((enter + hold + n) / total)) / SEGMENT_LENGTH);
    }
  }

  function buildTrack() {
    segments.length = 0;
    // A flat apron to lift off from, then the seeded sections, repeated.
    addRoad(40, 40, 40, 0, 0);
    let section = 0;
    while (segments.length < TRACK_SEGMENTS) {
      const [length, curve, climb] = SECTIONS[section % SECTIONS.length];
      const jitter = random.range(0.7, 1.3);
      addRoad(
        Math.round(length * 0.25 * jitter),
        Math.round(length * 0.5 * jitter),
        Math.round(length * 0.25 * jitter),
        curve * random.range(0.6, 1.4),
        climb * random.range(0.5, 1.5),
      );
      section += 1;
    }
    // Rings: one every RING_EVERY segments, offset sideways and up from the
    // corridor so the pilot has to steer and climb for them. Every fifth
    // ring is golden and pays GOLD_RING_POINTS instead of RING_POINTS.
    for (let n = RING_EVERY; n < segments.length - 10; n += RING_EVERY) {
      const seg = segments[n];
      const midX = (seg.p1.x + seg.p2.x) / 2;
      const midY = (seg.p1.y + seg.p2.y) / 2;
      const ringNo = n / RING_EVERY;
      const golden = ringNo % GOLD_EVERY === 0;
      seg.ring = {
        x: midX + random.range(-ROAD_WIDTH * 0.55, ROAD_WIDTH * 0.55),
        y: midY + random.range(600, 3400),
        z: seg.p1.z + SEGMENT_LENGTH / 2,
        radius: RING_RADIUS,
        golden,
        points: golden ? GOLD_RING_POINTS : RING_POINTS,
        passed: false,
        hit: false,
      };
    }
  }

  const state = {
    position: 0,
    x: 0,
    alt: ALT_START,
    speed: SPEED_START,
    throttle: 0.5,
    bank: 0,
    pitch: 0,
    heading: 0,
    score: 0,
    rings: 0,
    goldRings: 0,
    misses: 0,
    combo: 1,
    lives: LIVES,
    timeLeft: RUN_SECONDS,
    best: 0,
    crashed: 0,
    message: '',
  };

  function segmentAt(z) {
    const index = Math.floor(z / SEGMENT_LENGTH);
    return segments[Math.max(0, Math.min(segments.length - 1, index))];
  }

  function groundAt(z) {
    return segmentAt(z).p1.y;
  }

  function centreAt(z) {
    const seg = segmentAt(z);
    return (seg.p1.x + seg.p2.x) / 2;
  }

  /** The aircraft's nose, in world z: the camera sits PLAYER_Z behind it. */
  function aircraftZ() {
    return state.position + PLAYER_Z;
  }

  function reset() {
    state.position = 0;
    state.x = 0;
    state.alt = ALT_START;
    state.speed = SPEED_START;
    state.throttle = 0.5;
    state.bank = 0;
    state.pitch = 0;
    state.heading = 0;
    state.score = 0;
    state.rings = 0;
    state.goldRings = 0;
    state.misses = 0;
    state.combo = 1;
    state.lives = LIVES;
    state.timeLeft = RUN_SECONDS;
    state.crashed = 0;
    state.message = '';
    for (const seg of segments) {
      if (seg.ring) {
        seg.ring.passed = false;
        seg.ring.hit = false;
      }
    }
  }

  function respawn() {
    state.alt = ALT_START;
    state.speed = SPEED_START;
    state.x = centreAt(state.position);
    state.bank = 0;
    state.pitch = 0;
    state.crashed = 1.2;
    state.message = 'Back in the air — watch your altitude.';
  }

  /**
   * Advance the world one fixed step.
   * steer: -1 (left) .. 1 (right). climb: -1 (sink) .. 1 (climb).
   * throttle: -1 (cut) .. 1 (full). idle: true on the title screen, where
   * the aircraft flies itself so the scene stays alive behind the menu.
   */
  function step(dt, steer, climb, throttle, idle) {
    let events = EVENT_NONE;
    if (state.lives <= 0 || state.timeLeft <= 0) return EVENT_OVER;
    const prevAz = aircraftZ();

    // Throttle and drag set the speed; the world rushes by at that speed.
    if (idle) {
      state.throttle = 0.45;
      state.speed += (SPEED_START - state.speed) * dt;
    } else if (throttle > 0) {
      state.speed = Math.min(SPEED_MAX, state.speed + ACCEL * throttle * dt);
    } else if (throttle < 0) {
      state.speed = Math.max(SPEED_MIN, state.speed + BRAKE * throttle * dt);
    } else {
      state.speed += (SPEED_START - state.speed) * dt * (DRAG / SPEED_START);
    }
    state.position += state.speed * dt;

    // Steering banks the wings and slides the aircraft sideways; the bank
    // also turns the nose, which the compass shows. Idle flight drifts
    // gently back over the corridor, so the runway stays under the aircraft
    // on the title screen.
    const centre = centreAt(state.position);
    const targetBank = idle
      ? Math.max(-0.4, Math.min(0.4, (centre - state.x) / 1500)) + Math.sin(state.position / 9000) * 0.12
      : steer;
    state.bank += (targetBank - state.bank) * Math.min(1, dt * 6);
    state.x += state.bank * STEER_SPEED * dt;
    state.heading += state.bank * TURN_RATE * dt;
    state.x = Math.max(centre - X_LIMIT, Math.min(centre + X_LIMIT, state.x));

    // Pitch climbs and sinks; with no input the nose levels itself.
    const targetPitch = idle ? Math.sin(state.position / 14000) * 0.25 : climb;
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 4);
    if (state.pitch > 0) state.alt += state.pitch * CLIMB_RATE * dt;
    else if (state.pitch < 0) state.alt += state.pitch * SINK_RATE * dt;
    if (!idle && Math.abs(climb) < 0.05) {
      state.alt += (ALT_START - state.alt) * LEVEL_RATE * dt * 0.2;
    }
    if (state.alt > ALT_MAX) {
      state.alt = ALT_MAX;
      state.message = 'Ceiling — descend for the rings.';
    }

    // The clock runs; a ring buys time back.
    if (!idle) state.timeLeft -= dt;

    // Rings: the aircraft crosses a ring's plane when its nose passes it.
    const newAz = aircraftZ();
    const firstSeg = Math.floor(prevAz / SEGMENT_LENGTH);
    const lastSeg = Math.floor(newAz / SEGMENT_LENGTH);
    for (let n = firstSeg; n <= lastSeg; n += 1) {
      const seg = segments[n];
      if (!seg || !seg.ring || seg.ring.passed) continue;
      const ring = seg.ring;
      if (prevAz < ring.z && newAz >= ring.z) {
        ring.passed = true;
        const dx = state.x - ring.x;
        const dy = state.alt + groundAt(state.position) - ring.y;
        if (Math.hypot(dx, dy) <= ring.radius + RING_HIT_SLACK) {
          ring.hit = true;
          state.rings += 1;
          if (ring.golden) state.goldRings += 1;
          const gain = Math.round(ring.points * state.combo * (0.5 + state.speed / SPEED_MAX));
          state.score += gain;
          state.combo = Math.min(COMBO_MAX, state.combo + COMBO_STEP);
          state.message = ring.golden
            ? `Golden ring +${gain}! — ${state.timeLeft.toFixed(0)}s left.`
            : `Ring +${gain} — ${state.timeLeft.toFixed(0)}s left.`;
          events |= EVENT_RING;
        } else {
          state.misses += 1;
          state.combo = 1;
          state.message = 'Ring missed — line up the next one.';
          events |= EVENT_MISS;
        }
      }
    }

    // The ground is the only thing that can kill: touch it and lose a life.
    if (state.crashed > 0) state.crashed -= dt;
    else if (state.alt <= 0) {
      state.lives -= 1;
      events |= EVENT_CRASH;
      if (state.lives <= 0) {
        state.alt = 0;
        return events | EVENT_OVER;
      }
      respawn();
    }

    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      return events | EVENT_OVER;
    }
    return events;
  }

  buildTrack();

  return {
    state,
    segments,
    segmentAt,
    groundAt,
    centreAt,
    aircraftZ,
    reset,
    step,
  };
}

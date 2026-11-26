// The renderer: a pseudo-3D chase view over a sunset corridor, the aircraft
// in frame, the rings ahead and the instruments lit. Everything is drawn
// with the 2D canvas, no images and no network: the sky, the sun, the
// mountains, the ground, the runway, the rings, the aircraft and the HUD
// are all paths and gradients, so the game is one self-contained page.
//
// The world is drawn far to near, so nearer ground paints over farther
// ground and a hill ahead hides the corridor behind it.
import {
  ALT_MAX,
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  DRAW_DISTANCE,
  FIELD_A,
  FIELD_B,
  GROUND_A,
  GROUND_B,
  HUD_AMBER,
  HUD_CYAN,
  HUD_GREEN,
  HUD_PANEL,
  HUD_RED,
  HUD_TEXT,
  MOUNTAIN_FAR,
  MOUNTAIN_NEAR,
  PLAYER_Z,
  RING_COLOR,
  RING_GLOW,
  ROAD_WIDTH,
  RUNWAY,
  RUNWAY_DASH,
  RUNWAY_EDGE,
  SEGMENT_LENGTH,
  SKY_LOW,
  SKY_MID,
  SKY_TOP,
  SPEED_MAX,
  SPEED_MIN,
  SUN_CORE,
  SUN_GLOW,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

/** A point in the world, projected onto the screen. */
function project(x, y, z, cameraX, cameraY, cameraZ, width, height) {
  const dz = z - cameraZ;
  if (dz < 1) return null;
  const scale = CAMERA_DEPTH / dz;
  return {
    x: width / 2 + scale * (x - cameraX) * (width / 2),
    y: height / 2 - scale * (y - cameraY) * (height / 2),
    w: scale * ROAD_WIDTH * (width / 2),
    scale,
  };
}

function polygon(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawSky(width, height, horizonY, heading, time) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(0.55, SKY_MID);
    sky.addColorStop(1, SKY_LOW);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizonY + 1);
    // Below the horizon the dusk haze carries the ground's far edge.
    const haze = ctx.createLinearGradient(0, horizonY, 0, height);
    haze.addColorStop(0, SKY_LOW);
    haze.addColorStop(1, '#1c1030');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // The sun, low and wide, with its glow.
    const sunX = width * 0.68 + Math.sin(heading * 0.5) * width * 0.04;
    const sunY = horizonY - height * 0.045;
    const sunR = height * 0.075;
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 4);
    glow.addColorStop(0, 'rgba(255, 154, 61, 0.55)');
    glow.addColorStop(1, 'rgba(255, 154, 61, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR * 4, sunY - sunR * 4, sunR * 8, sunR * 8);
    const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    core.addColorStop(0, '#fff3c4');
    core.addColorStop(0.6, SUN_CORE);
    core.addColorStop(1, SUN_GLOW);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Slow clouds, three soft bands drifting with the clock.
    ctx.fillStyle = 'rgba(255, 190, 150, 0.28)';
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 0.23 + time * 0.004) % 1.2) * width - width * 0.1;
      const cy = height * (0.08 + i * 0.045);
      const cw = width * (0.1 + (i % 3) * 0.03);
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, height * 0.014, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountains(width, height, horizonY, heading, seed) {
    // Two ridges, the far one lighter, both sliding sideways with the
    // heading so turning the nose moves the world.
    const layers = [
      { color: MOUNTAIN_FAR, amp: height * 0.16, base: horizonY - height * 0.01, shift: heading * 60 },
      { color: MOUNTAIN_NEAR, amp: height * 0.11, base: horizonY + height * 0.005, shift: heading * 120 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 1);
      for (let x = 0; x <= width; x += 14) {
        const t = (x + layer.shift + seed) / width;
        const peak = Math.sin(t * 9.3) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 4.1) * 0.2;
        ctx.lineTo(x, layer.base - Math.abs(peak) * layer.amp);
      }
      ctx.lineTo(width, horizonY + 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGround(world, width, height, horizonY) {
    const { state, segments } = world;
    const cameraX = state.x;
    const cameraY = world.groundAt(state.position) + state.alt + CAMERA_HEIGHT;
    const cameraZ = state.position;
    const base = Math.floor(state.position / SEGMENT_LENGTH);
    // Far to near: nearer ground paints over farther ground, so a hill ahead
    // hides the corridor behind it. No clipping is needed — every band is
    // drawn, and the nearer ones overwrite the lower part of the farther ones.
    for (let n = DRAW_DISTANCE - 1; n >= 0; n -= 1) {
      const seg = segments[base + n];
      if (!seg) break;
      const p1 = project(seg.p1.x, seg.p1.y, seg.p1.z, cameraX, cameraY, cameraZ, width, height);
      const p2 = project(seg.p2.x, seg.p2.y, seg.p2.z, cameraX, cameraY, cameraZ, width, height);
      if (!p1 || !p2) continue;
      // The ground band, full width, in the segment's field colour.
      const groundColor = seg.color === 'a' ? (n % 6 < 3 ? GROUND_A : FIELD_A) : (n % 6 < 3 ? GROUND_B : FIELD_B);
      polygon(ctx, [[0, p1.y], [width, p1.y], [width, p2.y], [0, p2.y]], groundColor);
      // The runway: a dark strip down the corridor, with lit edges.
      const rw = 0.42;
      polygon(ctx, [
        [p1.x - p1.w * rw, p1.y], [p1.x + p1.w * rw, p1.y],
        [p2.x + p2.w * rw, p2.y], [p2.x - p2.w * rw, p2.y],
      ], RUNWAY);
      if (n % 2 === 0) {
        ctx.fillStyle = RUNWAY_DASH;
        ctx.fillRect(p1.x - Math.max(1, p1.w * 0.02), p1.y, Math.max(2, p1.w * 0.04), Math.max(1, p2.y - p1.y));
      }
      ctx.fillStyle = RUNWAY_EDGE;
      ctx.fillRect(p1.x - p1.w * rw, p1.y, Math.max(1, p1.w * 0.03), Math.max(1, p2.y - p1.y));
      ctx.fillRect(p1.x + p1.w * rw - Math.max(1, p1.w * 0.03), p1.y, Math.max(1, p1.w * 0.03), Math.max(1, p2.y - p1.y));
    }
  }

  function drawRings(world, width, height) {
    const { state, segments } = world;
    const cameraX = state.x;
    const cameraY = world.groundAt(state.position) + state.alt + CAMERA_HEIGHT;
    const cameraZ = state.position;
    const base = Math.floor(state.position / SEGMENT_LENGTH);
    // Farthest first, so a near ring paints over a far one.
    for (let n = DRAW_DISTANCE - 1; n >= 0; n -= 1) {
      const seg = segments[base + n];
      if (!seg || !seg.ring || seg.ring.passed) continue;
      const ring = seg.ring;
      const p = project(ring.x, ring.y, ring.z, cameraX, cameraY, cameraZ, width, height);
      if (!p) continue;
      const r = Math.max(2, p.scale * ring.radius * (width / 2) * 0.9);
      if (r < 2 || p.y < -r || p.y > height + r) continue;
      // A ring fades as the aircraft closes on it, so the one being passed
      // does not fill the frame; the next rings ahead stay the focus.
      const dz = ring.z - cameraZ;
      const fade = Math.max(0.2, Math.min(1, dz / 1600));
      ctx.save();
      ctx.globalAlpha = fade * 0.35;
      ctx.strokeStyle = RING_GLOW;
      ctx.lineWidth = Math.max(3, r * 0.28);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = RING_COLOR;
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(55, 242, 212, 0.12)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawAircraft(width, height, state, time) {
    const cx = width / 2;
    const cy = height * 0.66;
    const s = height / 720;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.bank * 0.55);
    ctx.scale(s, s);
    // Contrail shimmer behind the wings.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-150, 26);
    ctx.lineTo(-230, 44);
    ctx.moveTo(150, 26);
    ctx.lineTo(230, 44);
    ctx.stroke();
    // Wings: swept back, metallic, lit from the sunset.
    const wingGrad = ctx.createLinearGradient(0, -30, 0, 40);
    wingGrad.addColorStop(0, '#8d99b5');
    wingGrad.addColorStop(0.5, '#5a6a8c');
    wingGrad.addColorStop(1, '#2e3a55');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(-205, 34);
    ctx.lineTo(-198, 48);
    ctx.lineTo(-24, 30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, -6);
    ctx.lineTo(205, 34);
    ctx.lineTo(198, 48);
    ctx.lineTo(24, 30);
    ctx.closePath();
    ctx.fill();
    // Wingtip navigation lights: red port, green starboard.
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-203, 40, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff88';
    ctx.beginPath();
    ctx.arc(203, 40, 5, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin and stabilisers.
    ctx.fillStyle = '#46557a';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(0, -78);
    ctx.lineTo(14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(0, -72);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a4a6b';
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(-86, 30);
    ctx.lineTo(-80, 38);
    ctx.lineTo(-10, 22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 6);
    ctx.lineTo(86, 30);
    ctx.lineTo(80, 38);
    ctx.lineTo(10, 22);
    ctx.closePath();
    ctx.fill();
    // Fuselage: a rounded spine, lit along its top edge.
    const bodyGrad = ctx.createLinearGradient(0, -70, 0, 40);
    bodyGrad.addColorStop(0, '#aeb9d4');
    bodyGrad.addColorStop(0.45, '#6b7ea6');
    bodyGrad.addColorStop(1, '#2c3a58');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.quadraticCurveTo(20, -30, 17, 12);
    ctx.quadraticCurveTo(15, 34, 0, 38);
    ctx.quadraticCurveTo(-15, 34, -17, 12);
    ctx.quadraticCurveTo(-20, -30, 0, -72);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 214, 130, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -28);
    ctx.quadraticCurveTo(-16, 4, -11, 28);
    ctx.stroke();
    // Twin engine nozzles, lit and flickering with the throttle.
    const flicker = 0.85 + Math.sin(time * 31) * 0.1 + state.throttle * 0.1;
    for (const side of [-1, 1]) {
      const ex = side * 26;
      const glow = ctx.createRadialGradient(ex, 34, 0, ex, 34, 26 * flicker);
      glow.addColorStop(0, 'rgba(255, 220, 140, 0.95)');
      glow.addColorStop(0.4, 'rgba(255, 140, 60, 0.75)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, 34, 26 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2438';
      ctx.beginPath();
      ctx.ellipse(ex, 32, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.ellipse(ex, 32, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = HUD_PANEL;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(94, 230, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function text(str, x, y, size, color, align = 'left', weight = '600') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function drawHUD(width, height, state, best) {
    const pad = 16;
    const altFt = Math.round(state.alt * 3.2);
    const knots = Math.round(state.speed * 0.42);
    const headingDeg = ((Math.round((state.heading * 57.2958) % 360) + 360) % 360);
    const vs = Math.round(state.pitch * 900);

    // Altitude, top left.
    panel(pad, pad, 168, 64);
    text('ALT', pad + 12, pad + 20, 11, HUD_CYAN);
    text(`${altFt.toLocaleString()} FT`, pad + 12, pad + 46, 24, HUD_TEXT, 'left', '700');
    text(vs >= 0 ? `▲ ${vs}` : `▼ ${-vs}`, pad + 156, pad + 46, 13, vs >= 0 ? HUD_GREEN : HUD_AMBER, 'right');
    // Speed and throttle, top right.
    panel(width - pad - 168, pad, 168, 64);
    text('SPD', width - pad - 156, pad + 20, 11, HUD_CYAN);
    text(`${knots} KT`, width - pad - 156, pad + 46, 24, HUD_TEXT, 'left', '700');
    const thrW = 56;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, width - pad - 12 - thrW, pad + 16, thrW, 8, 4);
    ctx.fill();
    ctx.fillStyle = HUD_AMBER;
    roundRect(ctx, width - pad - 12 - thrW, pad + 16, thrW * state.throttle, 8, 4);
    ctx.fill();
    // Compass tape, top centre.
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const cw = 340;
    const cx = width / 2;
    panel(cx - cw / 2, pad, cw, 34);
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, cx - cw / 2, pad, cw, 34, 10);
    ctx.clip();
    for (let i = -4; i <= 4; i += 1) {
      const deg = headingDeg + i * 45;
      const label = points[((Math.round(deg / 45) % 8) + 8) % 8];
      const px = cx + i * 38 - ((headingDeg % 45) / 45) * 38;
      text(label, px, pad + 22, i === 0 ? 14 : 11, i === 0 ? HUD_AMBER : HUD_TEXT, 'center', i === 0 ? '700' : '500');
    }
    ctx.restore();
    ctx.fillStyle = HUD_AMBER;
    ctx.beginPath();
    ctx.moveTo(cx - 6, pad + 34);
    ctx.lineTo(cx + 6, pad + 34);
    ctx.lineTo(cx, pad + 28);
    ctx.closePath();
    ctx.fill();
    // Score, rings and time, bottom left.
    panel(pad, height - pad - 64, 210, 64);
    text('SCORE', pad + 12, height - pad - 44, 11, HUD_CYAN);
    text(`${state.score.toLocaleString()}`, pad + 12, height - pad - 18, 24, HUD_TEXT, 'left', '700');
    text(`◉ ${state.rings}  ×${state.combo.toFixed(2)}`, pad + 198, height - pad - 18, 13, HUD_GREEN, 'right');
    const timeColor = state.timeLeft <= 10 ? HUD_RED : HUD_TEXT;
    text(`⏱ ${Math.ceil(state.timeLeft)}s`, pad + 198, height - pad - 44, 13, timeColor, 'right');
    // Lives, bottom right.
    panel(width - pad - 150, height - pad - 64, 150, 64);
    text('LIVES', width - pad - 138, height - pad - 44, 11, HUD_CYAN);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.lives ? HUD_RED : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(width - pad - 138 + i * 30 + 8, height - pad - 30);
      ctx.lineTo(width - pad - 138 + i * 30 + 20, height - pad - 14);
      ctx.lineTo(width - pad - 138 + i * 30 + 2, height - pad - 14);
      ctx.closePath();
      ctx.fill();
    }
    text(`BEST ${best.toLocaleString()}`, width - pad - 12, height - pad - 18, 12, HUD_AMBER, 'right');
    // Attitude indicator, bottom centre: a horizon that banks and pitches.
    const ax = width / 2;
    const ay = height - pad - 32;
    const ar = 30;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(ax, ay);
    ctx.rotate(-state.bank * 0.55);
    ctx.translate(0, state.pitch * 18);
    ctx.fillStyle = '#2a4a7a';
    ctx.fillRect(-ar, -ar, ar * 2, ar);
    ctx.fillStyle = '#7a5a2e';
    ctx.fillRect(-ar, 0, ar * 2, ar);
    ctx.strokeStyle = HUD_TEXT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-ar, 0);
    ctx.lineTo(ar, 0);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = HUD_AMBER;
    ctx.beginPath();
    ctx.moveTo(ax - 5, ay - ar - 8);
    ctx.lineTo(ax + 5, ay - ar - 8);
    ctx.lineTo(ax, ay - ar - 2);
    ctx.closePath();
    ctx.fill();
    // Flight-path marker at the centre of the view.
    ctx.strokeStyle = 'rgba(94, 230, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.52, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2, height * 0.52 - 16);
    ctx.lineTo(width / 2, height * 0.52 - 10);
    ctx.moveTo(width / 2, height * 0.52 + 10);
    ctx.lineTo(width / 2, height * 0.52 + 16);
    ctx.moveTo(width / 2 - 16, height * 0.52);
    ctx.lineTo(width / 2 - 10, height * 0.52);
    ctx.moveTo(width / 2 + 10, height * 0.52);
    ctx.lineTo(width / 2 + 16, height * 0.52);
    ctx.stroke();
    // A message line under the aircraft.
    if (state.message) {
      text(state.message, width / 2, height * 0.82, 16, HUD_AMBER, 'center', '600');
    }
  }

  function overlay(width, height, lines, accent) {
    ctx.fillStyle = 'rgba(6, 8, 18, 0.45)';
    ctx.fillRect(0, 0, width, height);
    const cx = width / 2;
    let y = height * 0.3;
    for (const line of lines) {
      text(line.str, cx, y, line.size, line.color || HUD_TEXT, 'center', line.weight || '600');
      y += line.size + 16;
    }
    if (accent) {
      ctx.strokeStyle = 'rgba(94, 230, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 190, y + 6);
      ctx.lineTo(cx + 190, y + 6);
      ctx.stroke();
    }
  }

  function draw(world, screen, best, time) {
    const width = canvas.width;
    const height = canvas.height;
    const { state } = world;
    const horizonY = height * 0.44 - state.pitch * height * 0.1;
    drawSky(width, height, horizonY, state.heading, time);
    drawMountains(width, height, horizonY, state.heading, 7);
    drawGround(world, width, height, horizonY);
    drawRings(world, width, height);
    drawAircraft(width, height, state, time);
    drawHUD(width, height, state, best);

    if (screen === SCREEN_TITLE) {
      overlay(width, height, [
        { str: 'GOLDEN HOUR', size: 54, color: '#ffe9b0', weight: '800' },
        { str: 'a sunset ring-run', size: 20, color: HUD_CYAN },
        { str: 'Fly the rings. Mind the ground. Beat the clock.', size: 16, color: HUD_TEXT, weight: '500' },
        { str: '← → steer   ↑ ↓ climb   SHIFT throttle   SPACE start', size: 14, color: HUD_AMBER, weight: '500' },
        { str: best > 0 ? `Best score ${best.toLocaleString()}` : 'Press SPACE or click to fly', size: 16, color: HUD_TEXT },
      ], true);
    } else if (screen === SCREEN_PAUSED) {
      overlay(width, height, [
        { str: 'PAUSED', size: 44, color: HUD_TEXT, weight: '800' },
        { str: 'Press P or SPACE to keep flying', size: 16, color: HUD_CYAN, weight: '500' },
      ], false);
    } else if (screen === SCREEN_OVER) {
      overlay(width, height, [
        { str: 'FLIGHT OVER', size: 44, color: '#ffe9b0', weight: '800' },
        { str: `Score ${state.score.toLocaleString()}   ·   Rings ${state.rings}   ·   Best ${Math.max(best, state.score).toLocaleString()}`, size: 18, color: HUD_TEXT },
        { str: 'Press SPACE or click to fly again', size: 16, color: HUD_CYAN, weight: '500' },
      ], true);
    }
  }

  return { draw };
}

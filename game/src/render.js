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
  FOREST_A,
  FOREST_B,
  GOLD_RING_COLOR,
  GOLD_RING_GLOW,
  GROUND_A,
  GROUND_B,
  HOUSE_ROOF,
  HOUSE_WALL,
  HUD_AMBER,
  HUD_CYAN,
  HUD_GREEN,
  HUD_PANEL,
  HUD_RED,
  HUD_TEXT,
  MEADOW_A,
  MEADOW_B,
  MOUNTAIN_FAR,
  MOUNTAIN_NEAR,
  PLAYER_Z,
  RING_COLOR,
  RING_GLOW,
  RIVER,
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
  TREE,
  TREE_TRUNK,
  WATER_A,
  WATER_B,
  WINDOW_LIT,
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

/** Deterministic 0..1 hash of an integer, for terrain and features that
 * must look the same every run: no random stream is consumed, so the track
 * layout and the screenshots stay exactly reproducible. */
function hash(n) {
  let h = (Math.imul(n | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177) >>> 0;
  h ^= h >>> 16;
  return h / 4294967295;
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

    // Sun rays: slow beams fanning out from the sun.
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(Math.sin(time * 0.02) * 0.05);
    ctx.fillStyle = 'rgba(255, 190, 110, 0.10)';
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI * 0.85 + i * (Math.PI * 0.7 / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.045) * height * 0.9, Math.sin(a - 0.045) * height * 0.9);
      ctx.lineTo(Math.cos(a + 0.045) * height * 0.9, Math.sin(a + 0.045) * height * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Stars fading in at the top of the dusk, twinkling with the clock.
    for (let i = 0; i < 42; i += 1) {
      const sx = hash(i * 3 + 1) * width;
      const sy = hash(i * 3 + 2) * horizonY * 0.38;
      const tw = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.9 + i * 1.7));
      ctx.fillStyle = `rgba(255, 244, 214, ${tw.toFixed(3)})`;
      const sr = hash(i * 3 + 3) < 0.12 ? 2 : 1;
      ctx.fillRect(sx, sy, sr, sr);
    }

    // Birds: small distant V shapes drifting across the dusk.
    ctx.strokeStyle = 'rgba(40, 20, 50, 0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const bx = ((i * 0.37 + time * 0.006 + 0.15) % 1.15) * width - width * 0.08;
      const by = horizonY * (0.42 + i * 0.12) - Math.sin(time * 0.8 + i * 2.1) * 4;
      const flap = Math.sin(time * 6 + i * 3) * 3;
      const bw = 9 + i * 2;
      ctx.beginPath();
      ctx.moveTo(bx - bw, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + bw, by - flap);
      ctx.stroke();
    }

    // Clouds with lit undersides: three overlapping puffs each, the bottom
    // one catching the sunset.
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 0.23 + time * 0.004) % 1.2) * width - width * 0.1;
      const cy = height * (0.08 + i * 0.045);
      const cw = width * (0.1 + (i % 3) * 0.03);
      const ch = height * 0.014;
      const lit = ctx.createRadialGradient(cx, cy + ch, ch * 0.2, cx, cy, cw);
      lit.addColorStop(0, 'rgba(255, 205, 150, 0.34)');
      lit.addColorStop(1, 'rgba(255, 190, 150, 0)');
      ctx.fillStyle = lit;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 190, 150, 0.28)';
      for (let p = -1; p <= 1; p += 1) {
        ctx.beginPath();
        ctx.ellipse(cx + p * cw * 0.45, cy - ch * (p === 0 ? 1.1 : 0.4), cw * 0.55, ch, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMountains(width, height, horizonY, heading, seed) {
    // Three ridges: the farthest pale and hazy, the middle one carrying
    // snow on its peaks, the near one dark. All slide sideways with the
    // heading so turning the nose moves the world.
    const layers = [
      { color: '#6b4a7d', amp: height * 0.2, base: horizonY - height * 0.03, shift: heading * 30, snow: false },
      { color: MOUNTAIN_FAR, amp: height * 0.16, base: horizonY - height * 0.01, shift: heading * 60, snow: true },
      { color: MOUNTAIN_NEAR, amp: height * 0.11, base: horizonY + height * 0.005, shift: heading * 120, snow: false },
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
      // Snow caps on the middle ridge: white triangles where the peaks
      // stand tallest, placed by the same peak function.
      if (layer.snow) {
        ctx.fillStyle = 'rgba(255, 232, 214, 0.85)';
        for (let x = 0; x <= width; x += 46) {
          const t = (x + layer.shift + seed) / width;
          const peak = Math.abs(Math.sin(t * 9.3) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 4.1) * 0.2);
          if (peak < 0.62) continue;
          const py = layer.base - peak * layer.amp;
          const cap = 10 + peak * 22;
          ctx.beginPath();
          ctx.moveTo(x - cap, py + cap * 0.55);
          ctx.lineTo(x, py - 2);
          ctx.lineTo(x + cap, py + cap * 0.55);
          ctx.lineTo(x + cap * 0.45, py + cap * 0.3);
          ctx.lineTo(x, py + cap * 0.55);
          ctx.lineTo(x - cap * 0.45, py + cap * 0.3);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Dusk haze where the ridges meet the ground.
    const haze = ctx.createLinearGradient(0, horizonY - height * 0.02, 0, horizonY + height * 0.02);
    haze.addColorStop(0, 'rgba(232, 104, 58, 0)');
    haze.addColorStop(0.5, 'rgba(232, 104, 58, 0.22)');
    haze.addColorStop(1, 'rgba(232, 104, 58, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - height * 0.02, width, height * 0.04);
  }

  /** Terrain of a segment, from its index: meadow, field, forest, water. */
  function terrainOf(index) {
    const h = hash(index * 5 + 11);
    if (h < 0.42) return 0;
    if (h < 0.68) return 1;
    if (h < 0.86) return 2;
    return 3;
  }
  const TERRAIN_COLORS = [
    [GROUND_A, GROUND_B],
    [FIELD_A, FIELD_B],
    [FOREST_A, FOREST_B],
    [WATER_A, WATER_B],
  ];

  /** The river's centreline, world x offset from the corridor, winding
   * slowly with distance so it crosses the ground in long S-curves. */
  function riverAt(z) {
    return Math.sin(z / 9000) * 2600 + Math.sin(z / 3100) * 900;
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
      // The ground band, full width, in the segment's terrain colour.
      const terrain = TERRAIN_COLORS[terrainOf(seg.index)];
      polygon(ctx, [[0, p1.y], [width, p1.y], [width, p2.y], [0, p2.y]], terrain[seg.color === 'a' ? 0 : 1]);
      // The river, a winding blue strip across the ground; the runway
      // paints over its middle, so it reads as passing underneath.
      const r1 = project(seg.p1.x + riverAt(seg.p1.z), seg.p1.y, seg.p1.z, cameraX, cameraY, cameraZ, width, height);
      const r2 = project(seg.p2.x + riverAt(seg.p2.z), seg.p2.y, seg.p2.z, cameraX, cameraY, cameraZ, width, height);
      if (r1 && r2) {
        const w1 = Math.max(1, r1.scale * 260 * (width / 2));
        const w2 = Math.max(1, r2.scale * 260 * (width / 2));
        polygon(ctx, [
          [r1.x - w1, r1.y], [r1.x + w1, r1.y],
          [r2.x + w2, r2.y], [r2.x - w2, r2.y],
        ], RIVER);
      }
      // Trees and houses beside the corridor, on near ground only, placed
      // by the segment's hash so they never move between runs.
      if (n < 70 && terrainOf(seg.index) !== 3) {
        const h1 = hash(seg.index * 7 + 3);
        if (h1 < 0.55) {
          const side = h1 < 0.28 ? -1 : 1;
          const lateral = side * ROAD_WIDTH * (0.62 + hash(seg.index * 7 + 4) * 1.5);
          const tp = project(seg.p1.x + lateral, seg.p1.y, seg.p1.z, cameraX, cameraY, cameraZ, width, height);
          if (tp && tp.y > 0 && tp.y < height) {
            const th = Math.max(2, tp.scale * 300 * (height / 2));
            ctx.fillStyle = TREE_TRUNK;
            ctx.fillRect(tp.x - th * 0.05, tp.y - th * 0.25, th * 0.1, th * 0.25);
            ctx.fillStyle = TREE;
            ctx.beginPath();
            ctx.moveTo(tp.x, tp.y - th);
            ctx.lineTo(tp.x - th * 0.42, tp.y - th * 0.2);
            ctx.lineTo(tp.x + th * 0.42, tp.y - th * 0.2);
            ctx.closePath();
            ctx.fill();
          }
        } else if (h1 > 0.93 && n < 50) {
          const side = hash(seg.index * 7 + 5) < 0.5 ? -1 : 1;
          const lateral = side * ROAD_WIDTH * (0.75 + hash(seg.index * 7 + 6) * 1.1);
          const hp = project(seg.p1.x + lateral, seg.p1.y, seg.p1.z, cameraX, cameraY, cameraZ, width, height);
          if (hp && hp.y > 0 && hp.y < height) {
            const hs = Math.max(2, hp.scale * 260 * (height / 2));
            ctx.fillStyle = HOUSE_WALL;
            ctx.fillRect(hp.x - hs * 0.5, hp.y - hs * 0.5, hs, hs * 0.5);
            ctx.fillStyle = HOUSE_ROOF;
            ctx.beginPath();
            ctx.moveTo(hp.x - hs * 0.58, hp.y - hs * 0.5);
            ctx.lineTo(hp.x, hp.y - hs * 0.95);
            ctx.lineTo(hp.x + hs * 0.58, hp.y - hs * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = WINDOW_LIT;
            ctx.fillRect(hp.x - hs * 0.1, hp.y - hs * 0.32, hs * 0.2, hs * 0.2);
          }
        }
      }
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

  function drawRings(world, width, height, time) {
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
      const color = ring.golden ? GOLD_RING_COLOR : RING_COLOR;
      const glowColor = ring.golden ? GOLD_RING_GLOW : RING_GLOW;
      ctx.save();
      ctx.globalAlpha = fade * 0.35;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = Math.max(3, r * 0.28);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      // A slowly turning dashed inner circle, so the ring reads as charged
      // energy rather than a flat hoop.
      ctx.globalAlpha = fade * 0.7;
      ctx.setLineDash([Math.max(4, r * 0.16), Math.max(4, r * 0.12)]);
      ctx.lineDashOffset = -time * 28;
      ctx.lineWidth = Math.max(1.5, r * 0.045);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.72, r * 0.66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ring.golden ? 'rgba(255, 211, 77, 0.16)' : 'rgba(55, 242, 212, 0.12)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      // A golden ring wears a small star at its crown.
      if (ring.golden && r > 14) {
        const sx = p.x;
        const sy = p.y - r * 0.92;
        const sr = Math.max(4, r * 0.14);
        ctx.fillStyle = GOLD_RING_COLOR;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sr);
        ctx.lineTo(sx + sr * 0.28, sy - sr * 0.28);
        ctx.lineTo(sx + sr, sy);
        ctx.lineTo(sx + sr * 0.28, sy + sr * 0.28);
        ctx.lineTo(sx, sy + sr);
        ctx.lineTo(sx - sr * 0.28, sy + sr * 0.28);
        ctx.lineTo(sx - sr, sy);
        ctx.lineTo(sx - sr * 0.28, sy - sr * 0.28);
        ctx.closePath();
        ctx.fill();
      }
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
    const ringsText = state.goldRings > 0
      ? `◉ ${state.rings}  ×${state.combo.toFixed(1)}  ★${state.goldRings}`
      : `◉ ${state.rings}  ×${state.combo.toFixed(2)}`;
    text(ringsText, pad + 198, height - pad - 18, 13, HUD_GREEN, 'right');
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

  /** Speed lines: at high speed, faint streaks race outward from the
   * centre of the view, so fast flight feels fast. */
  function drawSpeedLines(width, height, state, time) {
    if (state.speed < 5200) return;
    const strength = Math.min(1, (state.speed - 5200) / 3600);
    const cx = width / 2;
    const cy = height * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.28 * strength).toFixed(3)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) {
      const angle = (i * 2.39996 + 0.6) % (Math.PI * 2);
      const travel = ((time * 620 + i * 173) % (height * 0.42)) + height * 0.34;
      const len = 26 + strength * 46 + (i % 3) * 12;
      const x1 = cx + Math.cos(angle) * travel;
      const y1 = cy + Math.sin(angle) * travel;
      const x2 = cx + Math.cos(angle) * (travel + len);
      const y2 = cy + Math.sin(angle) * (travel + len);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw(world, screen, best, time) {
    const width = canvas.width;
    const height = canvas.height;
    const { state } = world;
    const horizonY = height * 0.44 - state.pitch * height * 0.1;
    drawSky(width, height, horizonY, state.heading, time);
    drawMountains(width, height, horizonY, state.heading, 7);
    drawGround(world, width, height, horizonY);
    drawRings(world, width, height, time);
    drawSpeedLines(width, height, state, time);
    drawAircraft(width, height, state, time);
    drawHUD(width, height, state, best);

    if (screen === SCREEN_TITLE) {
      overlay(width, height, [
        { str: 'GOLDEN HOUR', size: 54, color: '#ffe9b0', weight: '800' },
        { str: 'a sunset ring-run', size: 20, color: HUD_CYAN },
        { str: 'Fly the rings. Gold rings pay 250. Mind the ground.', size: 16, color: HUD_TEXT, weight: '500' },
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

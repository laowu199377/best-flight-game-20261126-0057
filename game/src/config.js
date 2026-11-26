// Golden Hour — a sunset ring-run flight game.
// Shared tuning: the world is a runway corridor cut into short segments and drawn
// in pseudo-3D (a road renderer), the aircraft a rear-view sprite, the goal a
// chain of glowing rings. All units are world units unless noted.

/** Fixed simulation step, seconds. */
export const STEP = 1 / 60;
/** How long a run lasts before the clock decides it, seconds. */
export const RUN_SECONDS = 90;
/** Lives per run. */
export const LIVES = 3;
/** Best-score key in localStorage. */
export const BEST_KEY = 'golden-hour-best';

/** One track segment, in world units along the runway. */
export const SEGMENT_LENGTH = 200;
/** Segments drawn ahead of the aircraft. */
export const DRAW_DISTANCE = 180;
/** Segments per ground colour band. */
export const RUMBLE = 3;
/** Half the runway corridor's width, world units. */
export const ROAD_WIDTH = 2200;
/** Camera height above the ground at the aircraft, world units. */
export const CAMERA_HEIGHT = 1150;
/** Camera depth: 1 / tan(field of view / 2). */
export const CAMERA_DEPTH = 0.84;
/** How far ahead of the camera the aircraft sits, world units. */
export const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH;

/** Speeds, world units per second. */
export const SPEED_MIN = 2400;
export const SPEED_MAX = 9800;
export const SPEED_START = 4200;
/** Throttle: how fast speed rises and falls, per second. */
export const ACCEL = 2600;
export const BRAKE = 3400;
export const DRAG = 420;
/** Steering: lateral speed and turn rate. */
export const STEER_SPEED = 5200;
export const TURN_RATE = 0.9;
/** Pitch: climb and sink rates, world units per second. */
export const CLIMB_RATE = 1500;
export const SINK_RATE = 1500;
/** Soft ceiling and the ground. */
export const ALT_MAX = 5200;
export const ALT_START = 1400;
/** How far sideways the aircraft may drift from the corridor centre. */
export const X_LIMIT = 5200;
/** Gentle auto-level: the nose drifts back to level when no pitch input. */
export const LEVEL_RATE = 0.6;

/** Ring scoring. */
export const RING_POINTS = 100;
/** Every fifth ring is golden and pays this much instead. */
export const GOLD_RING_POINTS = 250;
export const GOLD_EVERY = 5;
export const RING_RADIUS = 620;
/** A ring counts when the aircraft passes its plane this close, world units. */
export const RING_HIT_SLACK = 260;
/** Rings per track section, and the gap between rings, in segments. */
export const RING_EVERY = 30;
/** Combo: each ring in a row without a miss multiplies the next one. */
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;

/** Colours: a golden-hour palette. */
export const SKY_TOP = '#2a1748';
export const SKY_MID = '#7a2d5e';
export const SKY_LOW = '#e8683a';
export const SUN_CORE = '#ffd97a';
export const SUN_GLOW = '#ff9a3d';
export const MOUNTAIN_FAR = '#4a2b5e';
export const MOUNTAIN_NEAR = '#33203f';
export const GROUND_A = '#3f6b2f';
export const GROUND_B = '#55702e';
export const FIELD_A = '#8a6b2f';
export const FIELD_B = '#6b7a2e';
/** Extra terrain: forest, meadow and open water, for ground variety. */
export const FOREST_A = '#2c5426';
export const FOREST_B = '#264d22';
export const MEADOW_A = '#6f8a35';
export const MEADOW_B = '#64802f';
export const WATER_A = '#2e6b9e';
export const WATER_B = '#2a5f8f';
export const RIVER = '#4a90c8';
export const TREE = '#1d4a1d';
export const TREE_TRUNK = '#5a3a22';
export const HOUSE_WALL = '#e8d9b0';
export const HOUSE_ROOF = '#8a3d2e';
export const WINDOW_LIT = '#ffd97a';
export const RUNWAY = '#3a3f4a';
export const RUNWAY_EDGE = '#f5d76e';
export const RUNWAY_DASH = '#f2f2e8';
export const RING_COLOR = '#37f2d4';
export const RING_GLOW = '#19b8a6';
export const GOLD_RING_COLOR = '#ffd34d';
export const GOLD_RING_GLOW = '#ff9a3d';
export const HUD_PANEL = 'rgba(8, 12, 24, 0.55)';
export const HUD_TEXT = '#eaf6ff';
export const HUD_AMBER = '#ffc357';
export const HUD_CYAN = '#5ee6ff';
export const HUD_RED = '#ff5d5d';
export const HUD_GREEN = '#7dff9a';

# Golden Hour — a sunset ring-run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/laowu199377/best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/laowu199377/best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A flight game set at golden hour. You are the pilot of a jet flying a
runway corridor at sunset: thread the glowing rings, mind the ground, beat
the clock.

## How it plays

- **Steer** with ← → or A / D (or move the mouse) — the wings bank and the
  nose turns with them.
- **Climb and sink** with ↑ ↓ or W / S (or move the mouse up and down).
- **Throttle** with Shift (full) and Control (cut back).
- **Rings** pay points: 100 × your combo × a speed factor. Miss one and
  the combo resets. The clock is a fixed 90 seconds, so the rings are a
  race against it.
- **The ground** is the only thing that can kill you. Touch it and you lose
  one of three lives; lose all three, or run the 90-second clock out, and
  the flight is over.
- **P** pauses. **Space** starts, and starts again.

The corridor is seeded, so a run is the same every time from the same seed,
and the best score is kept in your browser.

## The view

A pseudo-3D chase camera behind the aircraft: a sunset sky with the sun low
over layered mountains, fields and a lit runway rolling away below, the
rings glowing ahead. The HUD carries altitude and vertical speed, speed and
throttle, a compass tape, score, rings and combo, the clock, three lives,
and an attitude indicator that banks and pitches with the aircraft.

## Run it

No build step, no network. Serve the folder and open it in a desktop
browser:

```sh
node serve.ts
# then open http://localhost:8080/
```

Or open `game/index.html` directly from a static server of your choice.
`?shot=start|play|end&seed=7` stages a screenshot scene (the title screen,
a mid-run frame, or the final stretch) and sets `window.__shotReady` when
the frame is drawn.

## Files

- `game/index.html` — the page; `game/src/main.js` boots the game.
- `game/src/config.js` — every tuning constant: speeds, steering, ring
  scoring, the golden-hour palette.
- `game/src/random.js` — the seeded RNG that builds the corridor.
- `game/src/world.js` — the corridor, the aircraft physics, the rings and
  the rules. No drawing.
- `game/src/render.js` — the pseudo-3D renderer, the aircraft, the HUD.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the autopilot that stages the screenshots.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  the dossier.
- `screenshots/` — three frames of the real game, staged by the autopilot.

Built for the [make.fun](https://make.fun/c/best-flight-game-20261126-0057)
bounty "Make the best flight game". MIT licensed.

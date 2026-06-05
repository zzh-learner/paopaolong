# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains planning documents for a mobile-first Bubble Dragon H5 game and image assets under `images/`. The intended runtime is a static browser game using native HTML, CSS, JavaScript, and Canvas 2D.

Recommended implementation layout:

```text
index.html
styles.css
src/
  main.js
  game.js
  grid.js
  physics.js
  render.js
  assets.js
  scoring.js
tests/
```

Keep gameplay rules in `src/game.js`, grid math in `src/grid.js`, collision and trajectory logic in `src/physics.js`, rendering in `src/render.js`, and asset loading in `src/assets.js`. Store source images only in `images/`; put processed sprites in a separate subfolder if needed.

## Build, Test, and Development Commands

There is no package manager setup yet. For static local development after `index.html` is added, run:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. If a future `package.json` is introduced, document the canonical `npm run dev`, `npm test`, and `npm run build` commands there and keep this file in sync.

## Coding Style & Naming Conventions

Use plain ES modules and small, focused files. Prefer 2-space indentation for HTML, CSS, and JavaScript. Use `camelCase` for functions and variables, `PascalCase` only for classes, and uppercase constants for fixed tuning values such as `BUBBLE_RADIUS`. Keep canvas coordinates explicit (`x`, `y`, `row`, `col`) and avoid mixing grid and world coordinates without a clear conversion helper.

## Testing Guidelines

Prioritize tests for deterministic rules: hex-grid neighbors, `gridToWorld`, nearest-cell attachment, same-color cluster detection, floating-bubble detection, scoring, and game-state transitions. Name tests after the module or behavior, for example `grid.test.js` or `floating-bubbles.test.js`. Until automated tests exist, verify changes against `AI_ACCEPTANCE_TEST_PLAN.md` and report manual coverage for desktop Chrome, Android Chrome, and iPhone Safari when relevant.

## Commit & Pull Request Guidelines

Git history currently has only `Initial commit`; use short imperative commit messages going forward, such as `Add hex grid placement` or `Fix wall bounce trajectory`. Pull requests should include a summary, changed files or phases, manual test results, linked issue or roadmap phase, and screenshots or short recordings for visual/gameplay changes.

## Agent-Specific Instructions

Keep the first playable version dependency-light and browser-only. Do not add login, backend services, leaderboards, or complex level systems before the core loop works: aim, shoot, bounce, attach, match, drop floating bubbles, score, pause, restart, and settle.

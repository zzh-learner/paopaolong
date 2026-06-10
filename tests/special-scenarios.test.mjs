import assert from 'node:assert/strict';

import { Game } from '../src/game.js';
import {
  BOMB_BUBBLE,
  LASER_BUBBLE,
  RAINBOW_BUBBLE,
  cellKey,
} from '../src/grid.js';

function createGame() {
  const game = new Game({ assets: {} });
  game.resize({ width: 390, height: 844, dpr: 1 });
  game.debugEnabled = true;
  return game;
}

function placeBubble(game, row, col, color) {
  game.bubbles.push({ row, col, color });
  game.cellColors.set(cellKey(row, col), color);
}

function tickUntilSettled(game) {
  for (let index = 0; index < 20; index += 1) {
    game.update(0.1);
  }
}

function assertNoOrdinaryBubbles(game) {
  assert.equal(
    game.bubbles.some((bubble) => bubble.color?.type !== 'special'),
    false,
  );
}

{
  const game = createGame();
  game.debugEnabled = false;
  assert.equal(
    game.getControls().some((control) => control.action.startsWith('debugScenario:')),
    false,
  );

  game.debugEnabled = true;
  assert.equal(
    game.getControls().filter((control) => control.action.startsWith('debugScenario:')).length,
    5,
  );
}

{
  const game = createGame();
  assert.equal(game.applyDebugScenario('rainbowBest'), true);
  const targetCol = game.getDebugCenterColumn();

  placeBubble(game, 1, targetCol, RAINBOW_BUBBLE);
  const result = game.resolveSameColorMatch(1, targetCol);

  assert.equal(result.removedCount, 7);
  assert.equal(game.score, 90);
  assert.equal(game.bubbles.some((bubble) => bubble.color.id === 'blue'), false);
  assert.equal(game.bubbles.some((bubble) => bubble.color.id === 'red'), true);
}

{
  const game = createGame();
  assert.equal(game.applyDebugScenario('laserBounce'), true);
  const beforeCount = game.bubbles.length;
  const targetCol = game.getDebugCenterColumn();

  placeBubble(game, 4, targetCol, LASER_BUBBLE);
  game.activeShotDirection = game.aimDirection;
  game.activeShotOrigin = {
    x: game.launcher.launchX,
    y: game.launcher.launchY,
  };

  const result = game.resolveLaserBubble(4, targetCol);

  assert.ok(result.removedCount > 1);
  assert.ok(game.bubbles.length < beforeCount);
}

{
  const game = createGame();
  assert.equal(game.applyDebugScenario('bombDrop'), true);
  const targetCol = game.getDebugCenterColumn();

  placeBubble(game, 1, targetCol - 1, BOMB_BUBBLE);
  const result = game.resolveBombBubble(1, targetCol - 1);

  assert.ok(result.removedCount >= 7);
  assert.equal(game.bubbles.some((bubble) => bubble.row >= 2), false);
}

{
  const game = createGame();
  assert.equal(game.applyDebugScenario('specialsWin'), true);
  assert.equal(game.state, 'win');
  assertNoOrdinaryBubbles(game);
  tickUntilSettled(game);
  assert.equal(game.state, 'settlement');
  assert.equal(game.settlement.outcome, 'win');
}

{
  const game = createGame();
  assert.equal(game.applyDebugScenario('pauseSettlement'), true);
  const targetCol = game.getDebugCenterColumn();

  placeBubble(game, 1, targetCol, game.currentBubble);
  const result = game.resolveSameColorMatch(1, targetCol);
  game.startResolving(result.duration);
  game.pauseGame();
  assert.equal(game.state, 'paused');

  game.continueGame();
  tickUntilSettled(game);

  assert.equal(game.state, 'settlement');
  assert.equal(game.settlement.outcome, 'win');
}

console.log('special debug scenarios passed');

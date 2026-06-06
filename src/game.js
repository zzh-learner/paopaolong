import {
  BOMB_BUBBLE,
  BUBBLE_COLORS,
  LASER_BUBBLE,
  RAINBOW_BUBBLE,
  cellKey,
  createGridLayout,
  createInitialBubbles,
  findFloatingBubbles as findGridFloatingBubbles,
  findSameColorCluster as findGridSameColorCluster,
  getColumnsForRow,
  getNeighbors,
  findNearestOpenCell,
  findNearestOpenNeighbor,
  gridToWorld,
  isBombBubbleColor,
  isLaserBubbleColor,
  isSpecialBubbleColor,
  isValidCell,
  pickRandomBubbleColor,
} from './grid.js';
import {
  createFlyingBubble,
  getAimDirection,
  getAimTrajectory,
  getLauncherGeometry,
  getShootSpeed,
  getWallBounds,
  updateFlyingBubble,
} from './physics.js';
import {
  createBubblePopEffect,
  createDetailedScorePopup,
  createFallingBubbleEffect,
  FALLING_BUBBLE_DURATION,
  updateEffects,
} from './effects.js';
import { calculateDropScore, calculatePopScore } from './scoring.js';
import { AudioFeedback, vibrate } from './audio.js';

const COLLISION_TOLERANCE_FACTOR = 0.12;
const MAX_FLIGHT_STEP = 1 / 120;
const SNAP_SEARCH_RADIUS = 3;
const MATCH_MIN_CLUSTER_SIZE = 3;
const MISSES_BEFORE_PRESSURE_ROW = 4;
const SETTLEMENT_DELAY = 0.42;
const POP_RESOLVE_DURATION = 0.38;
const BOMB_BUBBLE_INTERVAL = 6;
const RAINBOW_BUBBLE_INTERVAL = 10;
const LASER_BUBBLE_INTERVAL = 14;
const LASER_BEAM_HALF_WIDTH_FACTOR = 0.62;
const LASER_BEAM_MAX_BOUNCES = 2;
const LASER_BEAM_MAX_DISTANCE_FACTOR = 1.55;
const SETTLEMENT_EASTER_EGG_MESSAGE = '谢谢你玩我的游戏';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSettlementPanelLayout(height) {
  const panelHeight = Math.min(300, Math.max(270, height * 0.5));

  return {
    height: panelHeight,
    y: clamp(height * 0.21, 16, height - panelHeight - 16),
  };
}

function normalizeDirection(direction) {
  const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0);

  if (!length) {
    return { x: 0, y: -1 };
  }

  return {
    x: direction.x / length,
    y: direction.y / length,
  };
}

export class Game {
  constructor({ assets }) {
    this.assets = assets;
    this.activeColorCount = BUBBLE_COLORS.length;
    this.audio = new AudioFeedback();
    this.aimDirection = { x: 0, y: -1 };
    this.aimTrajectory = [];
    this.activeShotDirection = null;
    this.activeShotOrigin = null;
    this.bubbles = [];
    this.cellColors = new Map();
    this.shotBubbleSequence = 0;
    this.currentBubble = this.pickShooterBubble();
    this.flyingBubble = null;
    this.gridLayout = null;
    this.width = 0;
    this.height = 0;
    this.hasInitializedGrid = false;
    this.dpr = 1;
    this.debugEnabled = false;
    this.elapsed = 0;
    this.effects = [];
    this.fps = 0;
    this.isPointerActive = false;
    this.launcher = null;
    this.missesSinceMatch = 0;
    this.nextBubble = this.pickShooterBubble();
    this.pendingShotHadMatch = false;
    this.pressureRowsAdded = 0;
    this.previousState = 'ready';
    this.resolveCooldown = 0;
    this.score = 0;
    this.settlement = null;
    this.settlementDelay = 0;
    this.shotsFired = 0;
    this.state = 'ready';
    this.fallbackBackground = '#111827';
  }

  resize({ width, height, dpr }) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.gridLayout = createGridLayout({ width, height });

    if (!this.hasInitializedGrid) {
      this.bubbles = createInitialBubbles(
        this.gridLayout,
        (row, col) => this.getColorForCell(row, col),
      );
      this.hasInitializedGrid = true;
    } else {
      this.removeInvalidBubblesAfterResize();
    }

    this.launcher = getLauncherGeometry(this.gridLayout);
    this.refreshAimTrajectory();
  }

  update(deltaTime) {
    if (deltaTime > 0) {
      const instantFps = 1 / deltaTime;
      this.fps = this.fps
        ? this.fps * 0.9 + instantFps * 0.1
        : instantFps;
    }

    if (
      this.state === 'loading'
      || this.state === 'paused'
      || this.state === 'settlement'
    ) {
      return;
    }

    this.elapsed += deltaTime;
    this.effects = updateEffects(this.effects, deltaTime);

    if (this.state === 'gameOver' || this.state === 'win') {
      this.settlementDelay = Math.max(0, this.settlementDelay - deltaTime);

      if (this.settlementDelay === 0) {
        this.state = 'settlement';
      }

      return;
    }

    if (this.resolveCooldown > 0) {
      this.resolveCooldown = Math.max(0, this.resolveCooldown - deltaTime);

      if (this.resolveCooldown === 0) {
        this.finishShot({ hadMatch: this.pendingShotHadMatch });
      }
    }

    if (!this.flyingBubble || !this.gridLayout) {
      return;
    }

    let remainingTime = deltaTime;

    while (remainingTime > 0 && this.flyingBubble) {
      const stepTime = Math.min(remainingTime, MAX_FLIGHT_STEP);

      updateFlyingBubble(
        this.flyingBubble,
        stepTime,
        getWallBounds(this.gridLayout),
      );
      this.resolveShotCollision();
      remainingTime -= stepTime;
    }
  }

  getColorForCell(row, col) {
    const key = `${row}:${col}`;

    if (!this.cellColors.has(key)) {
      this.cellColors.set(key, this.pickPlayableColor());
    }

    return this.cellColors.get(key);
  }

  pickPlayableColor() {
    return pickRandomBubbleColor();
  }

  pickShooterBubble() {
    this.shotBubbleSequence += 1;

    if (this.shotBubbleSequence % LASER_BUBBLE_INTERVAL === 0) {
      return LASER_BUBBLE;
    }

    if (this.shotBubbleSequence % RAINBOW_BUBBLE_INTERVAL === 0) {
      return RAINBOW_BUBBLE;
    }

    if (this.shotBubbleSequence % BOMB_BUBBLE_INTERVAL === 0) {
      return BOMB_BUBBLE;
    }

    return this.pickPlayableColor();
  }

  removeInvalidBubblesAfterResize() {
    this.bubbles = this.bubbles.filter((bubble) => {
      if (isValidCell(bubble.row, bubble.col, this.gridLayout)) {
        return true;
      }

      this.cellColors.delete(cellKey(bubble.row, bubble.col));
      return false;
    });
  }

  handlePointerDown(point) {
    const controlAction = this.getControlActionAt(point);

    if (controlAction) {
      this.executeControlAction(controlAction);
      return;
    }

    if (!this.canAcceptAimInput()) {
      return;
    }

    this.isPointerActive = true;
    this.state = 'aiming';
    this.updateAim(point);
  }

  handlePointerMove(point) {
    if (!this.isPointerActive || !this.canAcceptAimInput()) {
      return;
    }

    this.updateAim(point);
  }

  handlePointerUp(point) {
    if (!this.isPointerActive || !this.canAcceptAimInput()) {
      return;
    }

    this.updateAim(point);
    this.isPointerActive = false;
    this.shootCurrentBubble();
  }

  handlePointerCancel() {
    this.isPointerActive = false;

    if (this.state === 'aiming') {
      this.state = 'ready';
    }
  }

  getControlActionAt(point) {
    return this.getControls()
      .find((control) => (
        point.x >= control.x
        && point.x <= control.x + control.width
        && point.y >= control.y
        && point.y <= control.y + control.height
      ))?.action ?? null;
  }

  executeControlAction(action) {
    if (action === 'pause') {
      this.pauseGame();
      return;
    }

    if (action === 'continue') {
      this.continueGame();
      return;
    }

    if (action === 'restart') {
      this.restartGame();
      return;
    }

    if (action === 'toggleSound') {
      this.audio.toggle();
      return;
    }

    if (action === 'toggleDebug') {
      this.debugEnabled = !this.debugEnabled;
    }
  }

  pauseGame() {
    if (!['ready', 'aiming', 'shooting', 'resolving'].includes(this.state)) {
      return;
    }

    this.previousState = this.state === 'aiming' ? 'ready' : this.state;
    this.state = 'paused';
    this.isPointerActive = false;
  }

  continueGame() {
    if (this.state !== 'paused') {
      return;
    }

    this.state = this.previousState;
    this.refreshAimTrajectory();
  }

  restartGame() {
    this.activeColorCount = BUBBLE_COLORS.length;
    this.aimDirection = { x: 0, y: -1 };
    this.aimTrajectory = [];
    this.activeShotDirection = null;
    this.activeShotOrigin = null;
    this.bubbles = [];
    this.cellColors.clear();
    this.shotBubbleSequence = 0;
    this.currentBubble = this.pickShooterBubble();
    this.effects = [];
    this.flyingBubble = null;
    this.hasInitializedGrid = Boolean(this.gridLayout);
    this.isPointerActive = false;
    this.missesSinceMatch = 0;
    this.nextBubble = this.pickShooterBubble();
    this.pendingShotHadMatch = false;
    this.pressureRowsAdded = 0;
    this.previousState = 'ready';
    this.resolveCooldown = 0;
    this.score = 0;
    this.settlement = null;
    this.settlementDelay = 0;
    this.shotsFired = 0;
    this.state = 'ready';

    if (this.gridLayout) {
      this.bubbles = createInitialBubbles(
        this.gridLayout,
        (row, col) => this.getColorForCell(row, col),
      );
      this.launcher = getLauncherGeometry(this.gridLayout);
      this.refreshAimTrajectory();
    }
  }

  canAcceptAimInput() {
    return Boolean(
      this.gridLayout
        && this.currentBubble
        && !this.flyingBubble
        && this.resolveCooldown === 0
        && (this.state === 'ready' || this.state === 'aiming'),
    );
  }

  updateAim(point) {
    if (!this.launcher) {
      return;
    }

    this.aimDirection = getAimDirection(
      { x: this.launcher.launchX, y: this.launcher.launchY },
      point,
      this.aimDirection,
    );
    this.refreshAimTrajectory();
  }

  refreshAimTrajectory() {
    if (!this.gridLayout || !this.launcher || this.flyingBubble || !this.currentBubble) {
      this.aimTrajectory = [];
      return;
    }

    const projectileRadius = this.gridLayout.bubbleRadius * 0.92;
    const obstacleRadius = projectileRadius + this.gridLayout.bubbleRadius * 0.82;

    this.aimTrajectory = getAimTrajectory({
      bounds: getWallBounds(this.gridLayout),
      direction: this.aimDirection,
      maxBounces: 2,
      maxDistance: this.height * 1.4,
      obstacles: this.bubbles.map((bubble) => ({
        ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
        radius: obstacleRadius,
      })),
      origin: {
        x: this.launcher.launchX,
        y: this.launcher.launchY,
      },
      radius: projectileRadius,
    });
  }

  shootCurrentBubble() {
    if (!this.canAcceptAimInput()) {
      return;
    }

    const radius = this.gridLayout.bubbleRadius * 0.92;

    this.flyingBubble = createFlyingBubble({
      color: this.currentBubble,
      direction: this.aimDirection,
      radius,
      speed: getShootSpeed(this.gridLayout.bubbleRadius),
      x: this.launcher.launchX,
      y: this.launcher.launchY,
    });
    this.activeShotDirection = normalizeDirection(this.aimDirection);
    this.activeShotOrigin = {
      x: this.launcher.launchX,
      y: this.launcher.launchY,
    };
    this.currentBubble = null;
    this.aimTrajectory = [];
    this.state = 'shooting';
    this.audio.playShoot();
    vibrate(10);
  }

  resolveShotCollision() {
    if (!this.flyingBubble || !this.gridLayout) {
      return;
    }

    const hitBubble = this.findExistingBubbleCollision();

    if (hitBubble) {
      this.attachFlyingBubble(hitBubble);
      return;
    }

    if (this.flyingBubble.y - this.flyingBubble.radius <= this.gridLayout.top) {
      this.flyingBubble.y = this.gridLayout.top + this.flyingBubble.radius;
      this.attachFlyingBubble(null);
    }
  }

  findExistingBubbleCollision() {
    const gridBubbleRadius = this.gridLayout.bubbleRadius * 0.92;
    const threshold = (
      this.flyingBubble.radius
      + gridBubbleRadius
      - this.gridLayout.bubbleRadius * COLLISION_TOLERANCE_FACTOR
    );
    let nearestHit = null;
    let nearestDistance = Infinity;

    for (const bubble of this.bubbles) {
      const world = gridToWorld(bubble.row, bubble.col, this.gridLayout);
      const distance = Math.hypot(
        world.x - this.flyingBubble.x,
        world.y - this.flyingBubble.y,
      );

      if (distance <= threshold && distance < nearestDistance) {
        nearestHit = bubble;
        nearestDistance = distance;
      }
    }

    return nearestHit;
  }

  attachFlyingBubble(hitBubble) {
    const occupiedCells = this.getOccupiedCellSet();
    const attachCell = this.findAttachCell(occupiedCells, hitBubble);

    if (!attachCell) {
      this.flyingBubble = null;
      this.endGame('gameOver', '没有可吸附位置。');
      return;
    }

    const bubble = {
      row: attachCell.row,
      col: attachCell.col,
      color: this.flyingBubble.color,
    };

    this.bubbles.push(bubble);
    this.cellColors.set(cellKey(bubble.row, bubble.col), bubble.color);
    this.flyingBubble = null;
    this.audio.playCollision();
    vibrate(8);

    let resolution = null;

    if (isBombBubbleColor(bubble.color)) {
      resolution = this.resolveBombBubble(bubble.row, bubble.col);
    } else if (isLaserBubbleColor(bubble.color)) {
      resolution = this.resolveLaserBubble(bubble.row, bubble.col);
    } else {
      resolution = this.resolveSameColorMatch(bubble.row, bubble.col);
    }

    this.pendingShotHadMatch = resolution.removedCount > 0;

    if (resolution.duration > 0) {
      this.startResolving(resolution.duration);
      return;
    }

    this.finishShot({ hadMatch: this.pendingShotHadMatch });
  }

  findSameColorCluster(row, col) {
    return this.gridLayout
      ? findGridSameColorCluster(row, col, this.bubbles, this.gridLayout)
      : [];
  }

  findFloatingBubbles() {
    return this.gridLayout
      ? findGridFloatingBubbles(this.bubbles, this.gridLayout)
      : [];
  }

  resolveSameColorMatch(row, col) {
    const cluster = this.findSameColorCluster(row, col);

    if (cluster.length < MATCH_MIN_CLUSTER_SIZE) {
      return { duration: 0, removedCount: 0 };
    }

    const removedCells = new Set(cluster.map((bubble) => cellKey(bubble.row, bubble.col)));
    const popScore = calculatePopScore(cluster.length);
    const poppedWorldPositions = cluster.map((bubble) => ({
      ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
      color: bubble.color,
    }));

    this.bubbles = this.bubbles.filter((bubble) => {
      const key = cellKey(bubble.row, bubble.col);

      if (removedCells.has(key)) {
        this.cellColors.delete(key);
        return false;
      }

      return true;
    });
    const floatingBubbles = this.findFloatingBubbles();
    const dropScore = calculateDropScore(floatingBubbles.length);
    const droppedWorldPositions = floatingBubbles.map((bubble) => ({
      ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
      color: bubble.color,
    }));
    const floatingCells = new Set(
      floatingBubbles.map((bubble) => cellKey(bubble.row, bubble.col)),
    );

    if (floatingCells.size > 0) {
      this.bubbles = this.bubbles.filter((bubble) => {
        const key = cellKey(bubble.row, bubble.col);

        if (floatingCells.has(key)) {
          this.cellColors.delete(key);
          return false;
        }

        return true;
      });
    }

    const scoreGained = popScore + dropScore;
    this.score += scoreGained;
    this.audio.playPop(cluster.length);

    if (floatingBubbles.length > 0) {
      this.audio.playDrop(floatingBubbles.length);
      vibrate([14, 28, 18]);
    } else {
      vibrate(18);
    }

    this.createMatchEffects({
      dropScore,
      droppedWorldPositions,
      poppedWorldPositions,
      popScore,
      scoreGained,
    });

    return {
      duration: Math.max(
        POP_RESOLVE_DURATION,
        droppedWorldPositions.length ? FALLING_BUBBLE_DURATION : 0,
      ),
      removedCount: cluster.length + floatingBubbles.length,
    };
  }

  resolveBombBubble(row, col) {
    const bubbleByCell = new Map(
      this.bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]),
    );
    const blastedCells = new Set([cellKey(row, col)]);

    for (const neighbor of getNeighbors(row, col, this.gridLayout)) {
      const key = cellKey(neighbor.row, neighbor.col);

      if (bubbleByCell.has(key)) {
        blastedCells.add(key);
      }
    }

    const blastedBubbles = this.bubbles.filter((bubble) => (
      blastedCells.has(cellKey(bubble.row, bubble.col))
    ));
    const poppedWorldPositions = blastedBubbles.map((bubble) => ({
      ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
      color: bubble.color,
    }));

    this.bubbles = this.bubbles.filter((bubble) => {
      const key = cellKey(bubble.row, bubble.col);

      if (blastedCells.has(key)) {
        this.cellColors.delete(key);
        return false;
      }

      return true;
    });

    const floatingBubbles = this.findFloatingBubbles();
    const dropScore = calculateDropScore(floatingBubbles.length);
    const droppedWorldPositions = floatingBubbles.map((bubble) => ({
      ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
      color: bubble.color,
    }));
    const floatingCells = new Set(
      floatingBubbles.map((bubble) => cellKey(bubble.row, bubble.col)),
    );

    if (floatingCells.size > 0) {
      this.bubbles = this.bubbles.filter((bubble) => {
        const key = cellKey(bubble.row, bubble.col);

        if (floatingCells.has(key)) {
          this.cellColors.delete(key);
          return false;
        }

        return true;
      });
    }

    const popScore = calculatePopScore(blastedBubbles.length);
    const scoreGained = popScore + dropScore;
    this.score += scoreGained;
    this.audio.playPop(Math.max(2, blastedBubbles.length));

    if (floatingBubbles.length > 0) {
      this.audio.playDrop(floatingBubbles.length);
      vibrate([18, 22, 18]);
    } else {
      vibrate(24);
    }

    this.createMatchEffects({
      dropScore,
      droppedWorldPositions,
      popLabel: '炸弹',
      poppedWorldPositions,
      popScore,
      scoreGained,
    });

    return {
      duration: Math.max(
        POP_RESOLVE_DURATION,
        droppedWorldPositions.length ? FALLING_BUBBLE_DURATION : 0,
      ),
      removedCount: blastedBubbles.length + floatingBubbles.length,
    };
  }

  resolveLaserBubble(row, col) {
    const beamSegments = this.getLaserBeamSegments();
    const beamHalfWidth = this.gridLayout.bubbleRadius * LASER_BEAM_HALF_WIDTH_FACTOR;
    const attachedLaserKey = cellKey(row, col);
    const clearedBubbles = this.bubbles.filter((bubble) => {
      const key = cellKey(bubble.row, bubble.col);

      return (
        key === attachedLaserKey
        || this.isBubbleOnLaserPath(bubble, beamSegments, beamHalfWidth)
      );
    });
    const clearedCells = new Set(
      clearedBubbles.map((bubble) => cellKey(bubble.row, bubble.col)),
    );
    const poppedWorldPositions = clearedBubbles.map((bubble) => ({
      ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
      color: bubble.color,
    }));

    this.bubbles = this.bubbles.filter((bubble) => {
      const key = cellKey(bubble.row, bubble.col);

      if (clearedCells.has(key)) {
        this.cellColors.delete(key);
        return false;
      }

      return true;
    });

    const floatingBubbles = this.findFloatingBubbles();
    const dropScore = calculateDropScore(floatingBubbles.length);
    const droppedWorldPositions = floatingBubbles.map((bubble) => ({
      ...gridToWorld(bubble.row, bubble.col, this.gridLayout),
      color: bubble.color,
    }));
    const floatingCells = new Set(
      floatingBubbles.map((bubble) => cellKey(bubble.row, bubble.col)),
    );

    if (floatingCells.size > 0) {
      this.bubbles = this.bubbles.filter((bubble) => {
        const key = cellKey(bubble.row, bubble.col);

        if (floatingCells.has(key)) {
          this.cellColors.delete(key);
          return false;
        }

        return true;
      });
    }

    const popScore = calculatePopScore(clearedBubbles.length);
    const scoreGained = popScore + dropScore;
    this.score += scoreGained;
    this.audio.playPop(Math.max(2, clearedBubbles.length));

    if (floatingBubbles.length > 0) {
      this.audio.playDrop(floatingBubbles.length);
      vibrate([10, 18, 10, 22]);
    } else {
      vibrate([10, 20]);
    }

    this.createMatchEffects({
      dropScore,
      droppedWorldPositions,
      popLabel: '激光',
      poppedWorldPositions,
      popScore,
      scoreGained,
    });

    return {
      duration: Math.max(
        POP_RESOLVE_DURATION,
        droppedWorldPositions.length ? FALLING_BUBBLE_DURATION : 0,
      ),
      removedCount: clearedBubbles.length + floatingBubbles.length,
    };
  }

  getLaserBeamSegments() {
    if (!this.gridLayout || !this.launcher) {
      return [];
    }

    const bounds = getWallBounds(this.gridLayout);
    const radius = this.gridLayout.bubbleRadius * 0.92;
    const origin = this.activeShotOrigin ?? {
      x: this.launcher.launchX,
      y: this.launcher.launchY,
    };
    let ray = normalizeDirection(this.activeShotDirection ?? this.aimDirection);
    let current = { ...origin };
    let remainingDistance = this.height * LASER_BEAM_MAX_DISTANCE_FACTOR;
    let bounceCount = 0;
    const segments = [];

    while (remainingDistance > 0) {
      const distances = [];

      if (ray.y < 0) {
        distances.push({
          type: 'top',
          value: (bounds.top + radius - current.y) / ray.y,
        });
      }

      if (ray.x < 0) {
        distances.push({
          type: 'left',
          value: (bounds.left + radius - current.x) / ray.x,
        });
      }

      if (ray.x > 0) {
        distances.push({
          type: 'right',
          value: (bounds.right - radius - current.x) / ray.x,
        });
      }

      const nextHit = distances
        .filter((distance) => distance.value > 0.001)
        .sort((a, b) => a.value - b.value)[0];
      const travel = Math.min(nextHit?.value ?? remainingDistance, remainingDistance);
      const end = {
        x: current.x + ray.x * travel,
        y: current.y + ray.y * travel,
      };

      segments.push({
        end,
        start: current,
      });
      remainingDistance -= travel;

      if (!nextHit || nextHit.type === 'top' || bounceCount >= LASER_BEAM_MAX_BOUNCES) {
        break;
      }

      current = end;
      ray = {
        x: -ray.x,
        y: ray.y,
      };
      bounceCount += 1;
    }

    return segments;
  }

  isBubbleOnLaserPath(bubble, beamSegments, beamHalfWidth) {
    const world = gridToWorld(bubble.row, bubble.col, this.gridLayout);

    return beamSegments.some((segment) => (
      this.getDistanceToLaserSegment(world, segment) <= beamHalfWidth
    ));
  }

  getDistanceToLaserSegment(point, segment) {
    const segmentX = segment.end.x - segment.start.x;
    const segmentY = segment.end.y - segment.start.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

    if (!segmentLengthSquared) {
      return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
    }

    const projection = clamp(
      ((point.x - segment.start.x) * segmentX + (point.y - segment.start.y) * segmentY)
        / segmentLengthSquared,
      0,
      1,
    );
    const closest = {
      x: segment.start.x + segmentX * projection,
      y: segment.start.y + segmentY * projection,
    };

    return Math.hypot(point.x - closest.x, point.y - closest.y);
  }

  createMatchEffects({
    dropScore,
    droppedWorldPositions,
    popLabel = '消除',
    poppedWorldPositions,
    popScore,
    scoreGained,
  }) {
    if (!poppedWorldPositions.length || !this.gridLayout) {
      return;
    }

    const radius = this.gridLayout.bubbleRadius * 0.92;
    let centerX = 0;
    let centerY = 0;

    for (const position of poppedWorldPositions) {
      centerX += position.x;
      centerY += position.y;
      this.effects.push(createBubblePopEffect({
        color: position.color,
        radius,
        x: position.x,
        y: position.y,
      }));
    }

    if (droppedWorldPositions.length) {
      this.effects.push(createFallingBubbleEffect({
        bubbles: droppedWorldPositions,
        radius,
      }));
    }

    this.effects.push(createDetailedScorePopup({
      points: scoreGained,
      scoreParts: [
        { label: popLabel, points: popScore },
        { label: '掉落', points: dropScore },
      ].filter((part) => part.points > 0),
      x: centerX / poppedWorldPositions.length,
      y: centerY / poppedWorldPositions.length - radius * 0.8,
    }));
  }

  findAttachCell(occupiedCells, hitBubble) {
    const nearestOpenCell = findNearestOpenCell({
      layout: this.gridLayout,
      occupiedCells,
      searchRadius: SNAP_SEARCH_RADIUS,
      x: this.flyingBubble.x,
      y: this.flyingBubble.y,
    });

    if (nearestOpenCell) {
      return nearestOpenCell;
    }

    if (hitBubble) {
      const fallbackNeighbor = findNearestOpenNeighbor({
        col: hitBubble.col,
        layout: this.gridLayout,
        occupiedCells,
        row: hitBubble.row,
        x: this.flyingBubble.x,
        y: this.flyingBubble.y,
      });

      if (fallbackNeighbor) {
        return {
          row: fallbackNeighbor.row,
          col: fallbackNeighbor.col,
        };
      }
    }

    return findNearestOpenCell({
      layout: this.gridLayout,
      occupiedCells,
      searchRadius: this.gridLayout.maxRows,
      x: this.flyingBubble.x,
      y: this.flyingBubble.y,
    });
  }

  getOccupiedCellSet() {
    return new Set(
      this.bubbles.map((bubble) => cellKey(bubble.row, bubble.col)),
    );
  }

  finishShot({ hadMatch = false } = {}) {
    this.flyingBubble = null;
    this.activeShotDirection = null;
    this.activeShotOrigin = null;
    this.resolveCooldown = 0;
    this.pendingShotHadMatch = false;

    if (this.state === 'gameOver' || this.state === 'win' || this.state === 'settlement') {
      return;
    }

    this.shotsFired += 1;
    this.updateDifficultyProgress();

    if (!this.hasOrdinaryBubbles()) {
      this.endGame('win', '已清空普通泡泡。');
      return;
    }

    if (hadMatch) {
      this.missesSinceMatch = 0;
    } else {
      this.missesSinceMatch += 1;

      if (this.missesSinceMatch >= MISSES_BEFORE_PRESSURE_ROW) {
        this.missesSinceMatch = 0;
        this.addPressureRow();

        if (this.state === 'gameOver') {
          return;
        }
      }
    }

    const failureReason = this.getFailureReason();

    if (failureReason) {
      this.endGame('gameOver', failureReason);
      return;
    }

    this.currentBubble = this.nextBubble;
    this.nextBubble = this.pickShooterBubble();
    this.state = 'ready';
    this.refreshAimTrajectory();
  }

  startResolving(duration) {
    this.resolveCooldown = duration;
    this.state = 'resolving';
    this.isPointerActive = false;
    this.refreshAimTrajectory();
  }

  updateDifficultyProgress() {
    this.activeColorCount = BUBBLE_COLORS.length;
  }

  addPressureRow() {
    if (!this.gridLayout) {
      return;
    }

    const shiftedBubbles = [];

    for (const bubble of this.bubbles) {
      const shiftedRow = bubble.row + 1;

      if (!isValidCell(shiftedRow, bubble.col, this.gridLayout)) {
        this.endGame('gameOver', '行数超过可玩区域。');
        return;
      }

      shiftedBubbles.push({
        ...bubble,
        row: shiftedRow,
      });
    }

    const topColumns = getColumnsForRow(0, this.gridLayout);

    for (let col = 0; col < topColumns; col += 1) {
      shiftedBubbles.push({
        row: 0,
        col,
        color: this.pickPlayableColor(),
      });
    }

    this.bubbles = shiftedBubbles;
    this.cellColors.clear();

    for (const bubble of this.bubbles) {
      this.cellColors.set(cellKey(bubble.row, bubble.col), bubble.color);
    }

    this.pressureRowsAdded += 1;
  }

  getFailureReason() {
    if (!this.gridLayout) {
      return '';
    }

    const radius = this.gridLayout.bubbleRadius * 0.92;

    for (const bubble of this.bubbles) {
      if (!isValidCell(bubble.row, bubble.col, this.gridLayout)) {
        return '行数超过可玩区域。';
      }

      const world = gridToWorld(bubble.row, bubble.col, this.gridLayout);

      if (world.y + radius >= this.gridLayout.dangerLineY) {
        return '泡泡触达危险线。';
      }
    }

    return '';
  }

  hasOrdinaryBubbles() {
    return this.bubbles.some((bubble) => !isSpecialBubbleColor(bubble.color));
  }

  endGame(outcome, reason) {
    this.state = outcome;
    this.previousState = outcome;
    this.isPointerActive = false;
    this.flyingBubble = null;
    this.activeShotDirection = null;
    this.activeShotOrigin = null;
    this.aimTrajectory = [];
    this.resolveCooldown = 0;
    this.settlementDelay = SETTLEMENT_DELAY;
    this.settlement = {
      activeColorCount: this.activeColorCount,
      easterEggMessage: SETTLEMENT_EASTER_EGG_MESSAGE,
      outcome,
      pressureRowsAdded: this.pressureRowsAdded,
      reason,
      score: this.score,
      shotsFired: this.shotsFired,
      title: outcome === 'win' ? '胜利' : '游戏结束',
    };
  }

  getControls() {
    const controls = [];
    const margin = Math.max(10, this.width * 0.025);
    const gap = 8;
    const smallHeight = Math.max(36, Math.min(44, this.height * 0.052));
    const safeTop = this.gridLayout?.hudHeight
      ? Math.max(8, (this.gridLayout.hudHeight - smallHeight) / 2)
      : 10;

    if (this.state === 'settlement') {
      const panel = getSettlementPanelLayout(this.height);
      const modalWidth = Math.min(this.width - margin * 2, 340);
      const buttonWidth = Math.min(180, modalWidth - 48);
      const buttonHeight = 44;

      controls.push({
        action: 'restart',
        height: buttonHeight,
        label: '重新开始',
        role: 'primary',
        width: buttonWidth,
        x: (this.width - buttonWidth) / 2,
        y: panel.y + panel.height - buttonHeight - 18,
      });

      return controls;
    }

    if (this.state === 'paused') {
      const panelWidth = Math.min(this.width - margin * 2, 340);
      const buttonWidth = Math.min(190, panelWidth - 48);
      const buttonHeight = 44;
      const x = (this.width - buttonWidth) / 2;

      controls.push(
        {
          action: 'continue',
          height: buttonHeight,
          label: '继续游戏',
          role: 'primary',
          width: buttonWidth,
          x,
          y: this.height * 0.48,
        },
        {
          action: 'restart',
          height: buttonHeight,
          label: '重新开始',
          role: 'secondary',
          width: buttonWidth,
          x,
          y: this.height * 0.48 + buttonHeight + 12,
        },
      );

      return controls;
    }

    if (['ready', 'aiming', 'shooting', 'resolving'].includes(this.state)) {
      const compactButtonWidth = Math.max(44, Math.min(58, this.width * 0.135));
      const statusWidth = Math.max(54, Math.min(68, this.width * 0.155));
      const y = safeTop;
      const pauseX = this.width - margin - compactButtonWidth;
      const debugX = pauseX - gap - statusWidth;
      const soundX = debugX - gap - statusWidth;

      controls.push(
        {
          action: 'toggleSound',
          height: smallHeight,
          label: '音效',
          role: this.audio.enabled ? 'toggleOn' : 'toggleOff',
          width: statusWidth,
          x: soundX,
          y,
        },
        {
          action: 'toggleDebug',
          height: smallHeight,
          label: '调试',
          role: this.debugEnabled ? 'toggleOn' : 'toggleOff',
          width: statusWidth,
          x: debugX,
          y,
        },
        {
          action: 'pause',
          height: smallHeight,
          label: '暂停',
          role: 'secondary',
          width: compactButtonWidth,
          x: pauseX,
          y,
        },
      );
    }

    return controls;
  }

  getSnapshot() {
    return {
      activeColorCount: this.activeColorCount,
      aimDirection: this.aimDirection,
      aimTrajectory: this.aimTrajectory,
      assets: this.assets,
      bubbles: this.bubbles,
      controls: this.getControls(),
      currentBubble: this.currentBubble,
      debugEnabled: this.debugEnabled,
      dpr: this.dpr,
      elapsed: this.elapsed,
      effects: this.effects,
      fallbackBackground: this.fallbackBackground,
      flyingBubble: this.flyingBubble,
      fps: this.fps,
      gridLayout: this.gridLayout,
      height: this.height,
      inputLocked: Boolean(
        this.flyingBubble
          || this.resolveCooldown > 0
          || ['paused', 'gameOver', 'win', 'settlement'].includes(this.state),
      ),
      launcher: this.launcher,
      missesBeforePressureRow: MISSES_BEFORE_PRESSURE_ROW,
      missesSinceMatch: this.missesSinceMatch,
      nextBubble: this.nextBubble,
      pressureRowsAdded: this.pressureRowsAdded,
      resolving: this.resolveCooldown > 0,
      score: this.score,
      settlement: this.settlement,
      shotsFired: this.shotsFired,
      soundEnabled: this.audio.enabled,
      soundSupported: this.audio.supported,
      state: this.state,
      width: this.width,
    };
  }
}

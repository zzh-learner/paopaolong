const AIM_MAX_FROM_VERTICAL = 70 * (Math.PI / 180);
const MIN_SHOOT_SPEED = 420;
const MAX_SHOOT_SPEED = 760;
const SHOOT_SPEED_FACTOR = 29;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y);

  if (!length) {
    return { x: 0, y: -1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function getLauncherGeometry(layout) {
  const { bubbleRadius, dangerLineY, height, width } = layout;
  const centerX = width / 2;
  const baseY = height - Math.max(28, bubbleRadius * 1.35);
  const launchY = clamp(Math.max(
    dangerLineY + bubbleRadius * 1.7,
    baseY - bubbleRadius * 2.55,
  ), dangerLineY + bubbleRadius * 1.25, baseY - bubbleRadius * 1.15);

  return {
    baseX: centerX,
    baseY,
    launchX: centerX,
    launchY,
    nextX: Math.min(width - bubbleRadius * 1.5, centerX + bubbleRadius * 3.25),
    nextY: baseY - bubbleRadius * 0.55,
  };
}

export function getWallBounds(layout) {
  return {
    left: 0,
    right: layout.width,
    top: 0,
  };
}

export function getShootSpeed(radius) {
  return clamp(radius * SHOOT_SPEED_FACTOR, MIN_SHOOT_SPEED, MAX_SHOOT_SPEED);
}

export function getAimDirection(origin, target, fallback = { x: 0, y: -1 }) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;

  if (Math.hypot(dx, dy) < 4) {
    return normalize(fallback);
  }

  if (dy >= -2) {
    if (Math.abs(dx) < 4) {
      return normalize(fallback);
    }

    const sideAngle = dx < 0 ? -AIM_MAX_FROM_VERTICAL : AIM_MAX_FROM_VERTICAL;

    return {
      x: Math.sin(sideAngle),
      y: -Math.cos(sideAngle),
    };
  }

  const angleFromVertical = clamp(
    Math.atan2(dx, -dy),
    -AIM_MAX_FROM_VERTICAL,
    AIM_MAX_FROM_VERTICAL,
  );

  return {
    x: Math.sin(angleFromVertical),
    y: -Math.cos(angleFromVertical),
  };
}

export function createFlyingBubble({ color, direction, radius, speed, x, y }) {
  const normalizedDirection = normalize(direction);

  return {
    color,
    radius,
    velocityX: normalizedDirection.x * speed,
    velocityY: normalizedDirection.y * speed,
    x,
    y,
  };
}

export function updateFlyingBubble(bubble, deltaTime, bounds) {
  bubble.x += bubble.velocityX * deltaTime;
  bubble.y += bubble.velocityY * deltaTime;

  if (bubble.x - bubble.radius <= bounds.left) {
    bubble.x = bounds.left + bubble.radius;
    bubble.velocityX = Math.abs(bubble.velocityX);
  }

  if (bubble.x + bubble.radius >= bounds.right) {
    bubble.x = bounds.right - bubble.radius;
    bubble.velocityX = -Math.abs(bubble.velocityX);
  }
}

export function getAimTrajectory({
  bounds,
  direction,
  maxBounces = 2,
  maxDistance,
  obstacles = [],
  origin,
  radius,
}) {
  const points = [{ x: origin.x, y: origin.y }];
  let current = { x: origin.x, y: origin.y };
  let ray = normalize(direction);
  let remainingDistance = maxDistance;
  let bounceCount = 0;

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
    const obstacleHit = findNearestRayObstacleHit({
      current,
      maxDistance: Math.min(nextHit?.value ?? remainingDistance, remainingDistance),
      obstacles,
      ray,
    });
    const travel = obstacleHit?.value
      ?? Math.min(nextHit?.value ?? remainingDistance, remainingDistance);

    current = {
      x: current.x + ray.x * travel,
      y: current.y + ray.y * travel,
    };
    points.push(current);
    remainingDistance -= travel;

    if (obstacleHit) {
      break;
    }

    if (!nextHit || nextHit.type === 'top') {
      break;
    }

    if (bounceCount >= maxBounces) {
      break;
    }

    ray = {
      x: -ray.x,
      y: ray.y,
    };
    bounceCount += 1;
  }

  return points;
}

function findNearestRayObstacleHit({
  current,
  maxDistance,
  obstacles,
  ray,
}) {
  let nearestHit = null;

  for (const obstacle of obstacles) {
    const circleRadius = obstacle.radius;
    const toCircleX = obstacle.x - current.x;
    const toCircleY = obstacle.y - current.y;
    const projection = toCircleX * ray.x + toCircleY * ray.y;

    if (projection <= 0.001 || projection > maxDistance) {
      continue;
    }

    const closestDistanceSquared = (
      toCircleX * toCircleX
      + toCircleY * toCircleY
      - projection * projection
    );
    const radiusSquared = circleRadius * circleRadius;

    if (closestDistanceSquared > radiusSquared) {
      continue;
    }

    const offset = Math.sqrt(radiusSquared - closestDistanceSquared);
    const value = projection - offset;

    if (
      value <= 0.001
      || value > maxDistance
      || (nearestHit && value >= nearestHit.value)
    ) {
      continue;
    }

    nearestHit = { obstacle, value };
  }

  return nearestHit;
}

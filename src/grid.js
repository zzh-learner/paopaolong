export const INITIAL_GRID_ROWS = 6;

export const BUBBLE_COLORS = [
  {
    id: 'red',
    fill: '#ef4444',
    highlight: '#fecaca',
    shadow: '#7f1d1d',
  },
  {
    id: 'blue',
    fill: '#3b82f6',
    highlight: '#bfdbfe',
    shadow: '#1e3a8a',
  },
  {
    id: 'green',
    fill: '#22c55e',
    highlight: '#bbf7d0',
    shadow: '#14532d',
  },
  {
    id: 'yellow',
    fill: '#facc15',
    highlight: '#fef9c3',
    shadow: '#854d0e',
  },
  {
    id: 'purple',
    fill: '#a855f7',
    highlight: '#e9d5ff',
    shadow: '#581c87',
  },
  {
    id: 'cyan',
    fill: '#06b6d4',
    highlight: '#cffafe',
    shadow: '#164e63',
  },
];

const MIN_BUBBLE_RADIUS = 12;
const MAX_BUBBLE_RADIUS = 24;
const MIN_COLUMNS = 4;
const ROW_VERTICAL_FACTOR = Math.sqrt(3);

let activeLayout = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function assertLayout(layout) {
  if (!layout) {
    throw new Error('Grid layout has not been configured.');
  }
}

export function createGridLayout({ width, height }) {
  const sideMargin = Math.max(12, Math.round(width * 0.04));
  const radius = clamp(
    Math.min(width / 20, height / 28),
    MIN_BUBBLE_RADIUS,
    MAX_BUBBLE_RADIUS,
  );
  const colSpacing = radius * 2;
  const rowSpacing = radius * ROW_VERTICAL_FACTOR;
  const columns = Math.max(
    MIN_COLUMNS,
    Math.floor((width - sideMargin * 2 - radius) / colSpacing),
  );
  const usedWidth = columns * colSpacing + radius;
  const left = Math.max(6, (width - usedWidth) / 2);
  const top = clamp(height * 0.035, 18, 34);
  const launcherAreaHeight = clamp(height * 0.22, 104, 176);
  const initialGridBottom = top + radius * 2 + rowSpacing * (INITIAL_GRID_ROWS - 1);
  const dangerLineY = Math.max(
    initialGridBottom + radius * 2,
    height - launcherAreaHeight,
  );
  const maxRows = Math.max(
    INITIAL_GRID_ROWS,
    Math.floor((dangerLineY - top - radius) / rowSpacing) + 1,
  );

  activeLayout = {
    bubbleRadius: radius,
    colSpacing,
    columns,
    dangerLineY,
    height,
    left,
    maxRows,
    rowSpacing,
    top,
    width,
  };

  return activeLayout;
}

export function getColumnsForRow(row, layout = activeLayout) {
  assertLayout(layout);

  return layout.columns;
}

export function isValidCell(row, col, layout = activeLayout) {
  assertLayout(layout);

  return (
    row >= 0
    && row < layout.maxRows
    && col >= 0
    && col < getColumnsForRow(row, layout)
  );
}

export function cellKey(row, col) {
  return `${row}:${col}`;
}

export function gridToWorld(row, col, layout = activeLayout) {
  assertLayout(layout);

  return {
    x: layout.left
      + layout.bubbleRadius
      + col * layout.colSpacing
      + (row % 2 === 0 ? 0 : layout.bubbleRadius),
    y: layout.top + layout.bubbleRadius + row * layout.rowSpacing,
  };
}

export function worldToNearestCell(x, y, layout = activeLayout) {
  assertLayout(layout);

  const approximateRow = Math.round(
    (y - layout.top - layout.bubbleRadius) / layout.rowSpacing,
  );
  let nearestCell = null;
  let nearestDistance = Infinity;

  for (let row = approximateRow - 2; row <= approximateRow + 2; row += 1) {
    if (row < 0 || row >= layout.maxRows) {
      continue;
    }

    const rowOffset = row % 2 === 0 ? 0 : layout.bubbleRadius;
    const approximateCol = Math.round(
      (x - layout.left - layout.bubbleRadius - rowOffset) / layout.colSpacing,
    );

    for (let col = approximateCol - 2; col <= approximateCol + 2; col += 1) {
      if (!isValidCell(row, col, layout)) {
        continue;
      }

      const world = gridToWorld(row, col, layout);
      const distance = Math.hypot(world.x - x, world.y - y);

      if (distance < nearestDistance) {
        nearestCell = { row, col };
        nearestDistance = distance;
      }
    }
  }

  if (nearestCell) {
    return nearestCell;
  }

  const clampedRow = clamp(approximateRow, 0, layout.maxRows - 1);
  const columns = getColumnsForRow(clampedRow, layout);
  const rowOffset = clampedRow % 2 === 0 ? 0 : layout.bubbleRadius;
  const clampedCol = clamp(
    Math.round((x - layout.left - layout.bubbleRadius - rowOffset) / layout.colSpacing),
    0,
    columns - 1,
  );

  return {
    row: clampedRow,
    col: clampedCol,
  };
}

export function findNearestOpenCell({
  layout = activeLayout,
  occupiedCells,
  searchRadius = 2,
  x,
  y,
}) {
  assertLayout(layout);

  const center = worldToNearestCell(x, y, layout);
  let nearestCell = null;
  let nearestDistance = Infinity;

  for (
    let row = center.row - searchRadius;
    row <= center.row + searchRadius;
    row += 1
  ) {
    for (
      let col = center.col - searchRadius - 1;
      col <= center.col + searchRadius + 1;
      col += 1
    ) {
      if (
        !isValidCell(row, col, layout)
        || occupiedCells.has(cellKey(row, col))
      ) {
        continue;
      }

      const world = gridToWorld(row, col, layout);
      const distance = Math.hypot(world.x - x, world.y - y);

      if (distance < nearestDistance) {
        nearestCell = { row, col };
        nearestDistance = distance;
      }
    }
  }

  return nearestCell;
}

export function findNearestOpenNeighbor({
  col,
  layout = activeLayout,
  occupiedCells,
  row,
  x,
  y,
}) {
  assertLayout(layout);

  return getNeighbors(row, col, layout)
    .filter((neighbor) => !occupiedCells.has(cellKey(neighbor.row, neighbor.col)))
    .map((neighbor) => {
      const world = gridToWorld(neighbor.row, neighbor.col, layout);

      return {
        ...neighbor,
        distance: Math.hypot(world.x - x, world.y - y),
      };
    })
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function getNeighbors(row, col, layout = activeLayout) {
  assertLayout(layout);

  const diagonalColumns = row % 2 === 0
    ? [
      [row - 1, col - 1],
      [row - 1, col],
      [row + 1, col - 1],
      [row + 1, col],
    ]
    : [
      [row - 1, col],
      [row - 1, col + 1],
      [row + 1, col],
      [row + 1, col + 1],
    ];

  return [
    [row, col - 1],
    [row, col + 1],
    ...diagonalColumns,
  ]
    .filter(([neighborRow, neighborCol]) => (
      isValidCell(neighborRow, neighborCol, layout)
    ))
    .map(([neighborRow, neighborCol]) => ({
      row: neighborRow,
      col: neighborCol,
    }));
}

export function findSameColorCluster(row, col, bubbles, layout = activeLayout) {
  assertLayout(layout);

  const bubbleByCell = new Map(
    bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]),
  );
  const startKey = cellKey(row, col);
  const startBubble = bubbleByCell.get(startKey);

  if (!startBubble) {
    return [];
  }

  const targetColorId = startBubble.color?.id ?? startBubble.color;
  const visited = new Set([startKey]);
  const cluster = [];
  const stack = [{ row, col }];

  while (stack.length > 0) {
    const current = stack.pop();
    const currentBubble = bubbleByCell.get(cellKey(current.row, current.col));
    const currentColorId = currentBubble?.color?.id ?? currentBubble?.color;

    if (!currentBubble || currentColorId !== targetColorId) {
      continue;
    }

    cluster.push(currentBubble);

    for (const neighbor of getNeighbors(current.row, current.col, layout)) {
      const neighborKey = cellKey(neighbor.row, neighbor.col);

      if (visited.has(neighborKey)) {
        continue;
      }

      const neighborBubble = bubbleByCell.get(neighborKey);
      const neighborColorId = neighborBubble?.color?.id ?? neighborBubble?.color;

      if (neighborBubble && neighborColorId === targetColorId) {
        visited.add(neighborKey);
        stack.push(neighbor);
      }
    }
  }

  return cluster;
}

export function findFloatingBubbles(bubbles, layout = activeLayout) {
  assertLayout(layout);

  const bubbleByCell = new Map(
    bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]),
  );
  const connectedToTop = new Set();
  const stack = [];

  for (const bubble of bubbles) {
    if (bubble.row !== 0) {
      continue;
    }

    const key = cellKey(bubble.row, bubble.col);
    connectedToTop.add(key);
    stack.push({ row: bubble.row, col: bubble.col });
  }

  while (stack.length > 0) {
    const current = stack.pop();

    for (const neighbor of getNeighbors(current.row, current.col, layout)) {
      const neighborKey = cellKey(neighbor.row, neighbor.col);

      if (connectedToTop.has(neighborKey) || !bubbleByCell.has(neighborKey)) {
        continue;
      }

      connectedToTop.add(neighborKey);
      stack.push(neighbor);
    }
  }

  return bubbles.filter((bubble) => (
    !connectedToTop.has(cellKey(bubble.row, bubble.col))
  ));
}

export function pickRandomBubbleColor(colorCount = BUBBLE_COLORS.length) {
  const maxColors = clamp(Math.floor(colorCount), 1, BUBBLE_COLORS.length);
  const colorIndex = Math.floor(Math.random() * maxColors);

  return BUBBLE_COLORS[colorIndex];
}

export function createInitialBubbles(layout, getColorForCell = pickRandomBubbleColor) {
  assertLayout(layout);

  const bubbles = [];

  for (let row = 0; row < INITIAL_GRID_ROWS; row += 1) {
    const columns = getColumnsForRow(row, layout);

    for (let col = 0; col < columns; col += 1) {
      bubbles.push({
        row,
        col,
        color: getColorForCell(row, col),
      });
    }
  }

  return bubbles;
}

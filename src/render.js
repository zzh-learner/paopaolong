import { gridToWorld } from './grid.js';

const BUBBLE_IMAGE_SCALE = 1.08;
const LAUNCHER_CENTER_Y_RATIO = 0.61;
const LAUNCHER_SOCKET_RADIUS_RATIO = 0.205;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function drawCoverImage(ctx, image, width, height) {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (imageRatio > canvasRatio) {
    sourceWidth = image.height * canvasRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / canvasRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

function drawFallbackBackground(ctx, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

function drawBackgroundWash(ctx, width, height) {
  const shade = ctx.createLinearGradient(0, 0, 0, height);

  shade.addColorStop(0, 'rgba(2, 6, 23, 0.22)');
  shade.addColorStop(0.52, 'rgba(2, 6, 23, 0.04)');
  shade.addColorStop(1, 'rgba(2, 6, 23, 0.58)');

  ctx.save();
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawBubbleAt(ctx, { alpha = 1, color, radius, x, y }) {
  if (color?.image) {
    const size = radius * 2 * BUBBLE_IMAGE_SCALE;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
    ctx.shadowBlur = Math.max(5, radius * 0.44);
    ctx.shadowOffsetY = Math.max(2, radius * 0.18);
    ctx.drawImage(color.image, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return;
  }

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.38,
    radius * 0.18,
    x,
    y,
    radius,
  );

  gradient.addColorStop(0, color.highlight);
  gradient.addColorStop(0.34, color.fill);
  gradient.addColorStop(1, color.shadow);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
  ctx.shadowBlur = Math.max(5, radius * 0.44);
  ctx.shadowOffsetY = Math.max(2, radius * 0.18);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.stroke();

  const lowerShade = ctx.createRadialGradient(
    x + radius * 0.22,
    y + radius * 0.42,
    radius * 0.08,
    x + radius * 0.12,
    y + radius * 0.22,
    radius * 0.86,
  );

  lowerShade.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  lowerShade.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = lowerShade;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    x - radius * 0.34,
    y - radius * 0.4,
    radius * 0.27,
    radius * 0.18,
    -0.72,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - radius * 0.1, y - radius * 0.18, radius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.fill();
  ctx.restore();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawHud(ctx, snapshot) {
  const {
    activeColorCount,
    gridLayout,
    missesBeforePressureRow,
    missesSinceMatch,
    score,
    width,
  } = snapshot;

  if (!gridLayout) {
    return;
  }

  const paddingX = Math.max(12, gridLayout.bubbleRadius * 0.7);
  const x = Math.max(10, gridLayout.bubbleRadius * 0.45);
  const y = Math.max(10, gridLayout.top * 0.55);
  const hudWidth = Math.min(width - 20, gridLayout.bubbleRadius * 7.2);
  const hudHeight = gridLayout.bubbleRadius * 2.1;
  const radius = 8;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, hudWidth, hudHeight, radius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
  ctx.font = `${Math.max(11, gridLayout.bubbleRadius * 0.46)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('总分', x + paddingX, y + hudHeight * 0.5);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(
    x + paddingX - 3,
    y + hudHeight * 0.5 - gridLayout.bubbleRadius * 0.42,
    gridLayout.bubbleRadius * 2.7,
    gridLayout.bubbleRadius * 0.84,
  );
  ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
  ctx.fillText('Score', x + paddingX, y + hudHeight * 0.36);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(16, gridLayout.bubbleRadius * 0.72)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(String(score), x + hudWidth - paddingX, y + hudHeight * 0.36 + 1);

  ctx.fillStyle = 'rgba(203, 213, 225, 0.86)';
  ctx.font = `600 ${Math.max(10, gridLayout.bubbleRadius * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(
    `Colors ${activeColorCount}  Miss ${missesSinceMatch}/${missesBeforePressureRow}`,
    x + paddingX,
    y + hudHeight * 0.72,
  );
  ctx.restore();
}

function drawBubblePopEffect(ctx, effect) {
  const progress = Math.min(1, effect.age / effect.duration);
  const alpha = Math.max(0, 1 - progress);
  const ringRadius = effect.radius * (0.75 + progress * 1.25);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1, effect.radius * 0.08);
  ctx.strokeStyle = effect.color.highlight;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (const particle of effect.particles) {
    ctx.beginPath();
    ctx.arc(
      particle.x,
      particle.y,
      particle.radius * (1 - progress * 0.35),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = particle.color.fill;
    ctx.fill();
  }

  ctx.restore();
}

function drawScorePopup(ctx, effect, layout) {
  const progress = Math.min(1, effect.age / effect.duration);
  const y = effect.y - progress * layout.bubbleRadius * 2.1;
  const alpha = progress < 0.72 ? 1 : 1 - (progress - 0.72) / 0.28;
  const hasParts = effect.scoreParts?.length > 0;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = `800 ${Math.max(18, layout.bubbleRadius * 0.98)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, layout.bubbleRadius * 0.15);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillStyle = '#fef08a';
  ctx.strokeText(`+${effect.points}`, effect.x, y);
  ctx.fillText(`+${effect.points}`, effect.x, y);

  if (hasParts) {
    const detail = effect.scoreParts
      .map((part) => `${part.label} +${part.points}`)
      .join('  ');

    ctx.font = `700 ${Math.max(10, layout.bubbleRadius * 0.48)}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(2, layout.bubbleRadius * 0.1);
    ctx.fillStyle = '#bae6fd';
    ctx.strokeText(detail, effect.x, y + layout.bubbleRadius * 0.9);
    ctx.fillText(detail, effect.x, y + layout.bubbleRadius * 0.9);
  }
  ctx.restore();
}

function drawFallingBubbleEffect(ctx, effect) {
  const progress = Math.min(1, effect.age / effect.duration);
  const alpha = progress < 0.78 ? 1 : 1 - (progress - 0.78) / 0.22;

  for (const bubble of effect.bubbles) {
    drawBubbleAt(ctx, {
      alpha: Math.max(0, alpha),
      color: bubble.color,
      radius: effect.radius,
      x: bubble.x,
      y: bubble.y,
    });
  }
}

function drawEffects(ctx, effects, layout) {
  if (!effects?.length || !layout) {
    return;
  }

  for (const effect of effects) {
    if (effect.type === 'bubblePop') {
      drawBubblePopEffect(ctx, effect);
    }

    if (effect.type === 'scorePopup') {
      drawScorePopup(ctx, effect, layout);
    }

    if (effect.type === 'fallingBubble') {
      drawFallingBubbleEffect(ctx, effect);
    }
  }
}

function drawGridBubble(ctx, bubble, layout) {
  const { x, y } = gridToWorld(bubble.row, bubble.col, layout);

  drawBubbleAt(ctx, {
    color: bubble.color,
    radius: layout.bubbleRadius * 0.92,
    x,
    y,
  });
}

function drawDangerLine(ctx, layout) {
  const y = layout.dangerLineY;

  ctx.save();
  ctx.setLineDash([10, 9]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(layout.width, y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(254, 202, 202, 0.6)';
  ctx.beginPath();
  ctx.moveTo(0, y + 3);
  ctx.lineTo(layout.width, y + 3);
  ctx.stroke();
  ctx.restore();
}

function drawLauncherZone(ctx, layout) {
  const { dangerLineY, height, width } = layout;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 17, 31, 0.62)';
  ctx.fillRect(0, dangerLineY, width, height - dangerLineY);

  const floorGradient = ctx.createLinearGradient(0, dangerLineY, 0, height);
  floorGradient.addColorStop(0, 'rgba(15, 23, 42, 0.1)');
  floorGradient.addColorStop(1, 'rgba(15, 23, 42, 0.82)');
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, dangerLineY, width, height - dangerLineY);
  ctx.restore();
}

function drawAimTrajectory(ctx, points, layout) {
  if (!points || points.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineWidth = Math.max(2, layout.bubbleRadius * 0.14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([3, 9]);
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.92)';
  ctx.shadowColor = 'rgba(14, 165, 233, 0.45)';
  ctx.shadowBlur = Math.max(6, layout.bubbleRadius * 0.34);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }

  ctx.stroke();
  ctx.setLineDash([]);

  for (let index = 1; index < points.length - 1; index += 1) {
    ctx.beginPath();
    ctx.arc(points[index].x, points[index].y, layout.bubbleRadius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.fill();
  }

  const end = points[points.length - 1];

  ctx.beginPath();
  ctx.arc(end.x, end.y, layout.bubbleRadius * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, layout.bubbleRadius * 0.08);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
  ctx.stroke();

  ctx.restore();
}

function drawLauncherSocketMask(ctx, { imageHeight, launcher, radius }) {
  const socketRadius = Math.max(radius * 1.32, imageHeight * LAUNCHER_SOCKET_RADIUS_RATIO);
  const innerShade = ctx.createRadialGradient(
    launcher.launchX - socketRadius * 0.2,
    launcher.launchY - socketRadius * 0.24,
    socketRadius * 0.12,
    launcher.launchX,
    launcher.launchY,
    socketRadius,
  );

  innerShade.addColorStop(0, 'rgba(30, 41, 59, 0.98)');
  innerShade.addColorStop(0.58, 'rgba(15, 23, 42, 0.98)');
  innerShade.addColorStop(1, 'rgba(2, 6, 23, 0.96)');

  ctx.save();
  ctx.beginPath();
  ctx.arc(launcher.launchX, launcher.launchY, socketRadius, 0, Math.PI * 2);
  ctx.fillStyle = innerShade;
  ctx.fill();
  ctx.lineWidth = Math.max(2, radius * 0.1);
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
  ctx.stroke();
  ctx.restore();
}

function drawLauncherImage(ctx, snapshot, radius) {
  const {
    assets,
    currentBubble,
    flyingBubble,
    gridLayout,
    launcher,
    nextBubble,
  } = snapshot;
  const image = assets?.launcherLoaded ? assets.launcher : null;

  if (!image) {
    return false;
  }

  const launcherAreaHeight = gridLayout.height - gridLayout.dangerLineY;
  const imageHeight = clamp(
    radius * 8.1,
    radius * 5.8,
    Math.min(launcherAreaHeight * 1.12, gridLayout.width * 0.5),
  );
  const imageWidth = imageHeight * (image.width / image.height);
  const imageX = launcher.launchX - imageWidth / 2;
  const imageY = launcher.launchY - imageHeight * LAUNCHER_CENTER_Y_RATIO;

  ctx.save();
  ctx.shadowColor = 'rgba(14, 165, 233, 0.28)';
  ctx.shadowBlur = Math.max(8, radius * 0.75);
  ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
  ctx.restore();

  drawLauncherSocketMask(ctx, { imageHeight, launcher, radius });

  if (nextBubble) {
    const previewRadius = radius * 0.56;
    const previewX = Math.min(
      gridLayout.width - previewRadius * 1.5,
      launcher.launchX + imageWidth * 0.58,
    );
    const previewY = Math.min(
      gridLayout.height - previewRadius * 1.45,
      launcher.launchY + imageHeight * 0.18,
    );

    ctx.save();
    ctx.beginPath();
    ctx.arc(previewX, previewY, previewRadius * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, radius * 0.08);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.54)';
    ctx.stroke();
    ctx.restore();

    drawBubbleAt(ctx, {
      alpha: flyingBubble ? 0.72 : 1,
      color: nextBubble,
      radius: previewRadius,
      x: previewX,
      y: previewY,
    });
  }

  if (currentBubble) {
    const currentRadius = Math.max(radius * 0.92, imageHeight * 0.17);

    drawBubbleAt(ctx, {
      color: currentBubble,
      radius: currentRadius,
      x: launcher.launchX,
      y: launcher.launchY,
    });
  }

  return true;
}

function drawLauncher(ctx, snapshot) {
  const {
    aimDirection,
    currentBubble,
    flyingBubble,
    gridLayout,
    launcher,
    nextBubble,
  } = snapshot;

  if (!gridLayout || !launcher) {
    return;
  }

  const radius = gridLayout.bubbleRadius;

  if (drawLauncherImage(ctx, snapshot, radius)) {
    return;
  }

  const barrelEnd = currentBubble
    ? {
      x: launcher.launchX + aimDirection.x * radius * 0.85,
      y: launcher.launchY + aimDirection.y * radius * 0.85,
    }
    : {
      x: launcher.launchX,
      y: launcher.launchY,
    };

  ctx.save();
  const platformGradient = ctx.createLinearGradient(
    launcher.baseX,
    launcher.baseY - radius * 2,
    launcher.baseX,
    launcher.baseY + radius * 0.5,
  );

  platformGradient.addColorStop(0, 'rgba(71, 85, 105, 0.95)');
  platformGradient.addColorStop(0.48, 'rgba(15, 23, 42, 0.96)');
  platformGradient.addColorStop(1, 'rgba(2, 6, 23, 0.98)');

  ctx.shadowColor = 'rgba(14, 165, 233, 0.28)';
  ctx.shadowBlur = Math.max(8, radius * 0.8);
  ctx.strokeStyle = flyingBubble
    ? 'rgba(148, 163, 184, 0.42)'
    : 'rgba(191, 219, 254, 0.72)';
  ctx.lineWidth = Math.max(7, radius * 0.4);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(launcher.baseX, launcher.baseY - radius * 0.25);
  ctx.lineTo(barrelEnd.x, barrelEnd.y);
  ctx.stroke();

  ctx.lineWidth = Math.max(3, radius * 0.16);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.76)';
  ctx.beginPath();
  ctx.moveTo(launcher.baseX, launcher.baseY - radius * 0.25);
  ctx.lineTo(barrelEnd.x, barrelEnd.y);
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(launcher.baseX, launcher.baseY, radius * 2.08, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = platformGradient;
  ctx.fill();
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(launcher.baseX, launcher.baseY - radius * 0.15, radius * 0.64, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(125, 211, 252, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.stroke();

  if (nextBubble) {
    ctx.beginPath();
    ctx.arc(launcher.nextX, launcher.nextY, radius * 0.86, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, radius * 0.08);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.stroke();

    drawBubbleAt(ctx, {
      alpha: flyingBubble ? 0.72 : 1,
      color: nextBubble,
      radius: radius * 0.58,
      x: launcher.nextX,
      y: launcher.nextY,
    });
  }

  if (currentBubble) {
    drawBubbleAt(ctx, {
      color: currentBubble,
      radius: radius * 0.92,
      x: launcher.launchX,
      y: launcher.launchY,
    });
  }

  ctx.restore();
}

function drawFlyingBubble(ctx, flyingBubble) {
  if (!flyingBubble) {
    return;
  }

  drawBubbleAt(ctx, {
    color: flyingBubble.color,
    radius: flyingBubble.radius,
    x: flyingBubble.x,
    y: flyingBubble.y,
  });
}

function drawButton(ctx, control) {
  const isPrimary = control.role === 'primary';
  const isToggleOn = control.role === 'toggleOn';
  const isToggleOff = control.role === 'toggleOff';

  ctx.save();
  ctx.fillStyle = isPrimary || isToggleOn
    ? 'rgba(14, 165, 233, 0.9)'
    : 'rgba(15, 23, 42, 0.82)';
  ctx.strokeStyle = isPrimary || isToggleOn
    ? 'rgba(186, 230, 253, 0.95)'
    : 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  drawRoundedRect(ctx, control.x, control.y, control.width, control.height, 8);
  ctx.fill();
  ctx.stroke();

  if (isToggleOn || isToggleOff) {
    ctx.beginPath();
    ctx.arc(
      control.x + Math.max(9, control.height * 0.32),
      control.y + control.height / 2,
      Math.max(3, control.height * 0.1),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = isToggleOn ? '#bef264' : 'rgba(148, 163, 184, 0.9)';
    ctx.fill();
  }

  ctx.fillStyle = isToggleOff ? 'rgba(226, 232, 240, 0.76)' : '#ffffff';
  ctx.font = `700 ${Math.max(12, Math.min(15, control.height * 0.36))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    control.label,
    control.x + control.width / 2 + (isToggleOn || isToggleOff ? 5 : 0),
    control.y + control.height / 2 + 0.5,
  );
  ctx.restore();
}

function drawControls(ctx, controls) {
  if (!controls?.length) {
    return;
  }

  for (const control of controls) {
    drawButton(ctx, control);
  }
}

function drawOverlayPanel(ctx, {
  height,
  title,
  viewportHeight,
  width,
  y,
}) {
  const panelWidth = Math.min(width - 24, 340);
  const panelHeight = height;
  const panelX = (width - panelWidth) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
  ctx.fillRect(0, 0, width, viewportHeight);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  drawRoundedRect(ctx, panelX, y, panelWidth, panelHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, y + 40);
  ctx.restore();

  return {
    x: panelX,
    y,
    width: panelWidth,
    height: panelHeight,
  };
}

function drawPausedOverlay(ctx, snapshot) {
  const panel = drawOverlayPanel(ctx, {
    height: 210,
    title: 'Paused',
    viewportHeight: snapshot.height,
    width: snapshot.width,
    y: snapshot.height * 0.34,
  });

  ctx.save();
  ctx.fillStyle = 'rgba(203, 213, 225, 0.86)';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Score ${snapshot.score}`, snapshot.width / 2, panel.y + 78);
  ctx.restore();
}

function drawSettlementOverlay(ctx, snapshot) {
  const settlement = snapshot.settlement;
  const panel = drawOverlayPanel(ctx, {
    height: 260,
    title: settlement?.title ?? 'Settlement',
    viewportHeight: snapshot.height,
    width: snapshot.width,
    y: snapshot.height * 0.28,
  });
  const lines = [
    `Score ${settlement?.score ?? snapshot.score}`,
    `Shots ${settlement?.shotsFired ?? snapshot.shotsFired}`,
    `Pressure Rows ${settlement?.pressureRowsAdded ?? snapshot.pressureRowsAdded}`,
    `Colors ${settlement?.activeColorCount ?? snapshot.activeColorCount}`,
  ];

  ctx.save();
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  lines.forEach((line, index) => {
    ctx.fillText(line, snapshot.width / 2, panel.y + 82 + index * 25);
  });

  if (settlement?.reason) {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.84)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(settlement.reason, snapshot.width / 2, panel.y + 190);
  }

  ctx.restore();
}

function drawEndTransitionOverlay(ctx, snapshot) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.46)';
  ctx.fillRect(0, 0, snapshot.width, snapshot.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(snapshot.state === 'win' ? 'You Win' : 'Game Over', snapshot.width / 2, snapshot.height * 0.46);
  ctx.restore();
}

function drawLoading(ctx, snapshot) {
  ctx.save();
  ctx.fillStyle = snapshot.fallbackBackground;
  ctx.fillRect(0, 0, snapshot.width, snapshot.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading', snapshot.width / 2, snapshot.height / 2);
  ctx.restore();
}

function drawScene(ctx, snapshot) {
  const {
    aimTrajectory,
    bubbles,
    effects,
    flyingBubble,
    gridLayout,
  } = snapshot;

  if (!gridLayout) {
    return;
  }

  drawLauncherZone(ctx, gridLayout);
  drawDangerLine(ctx, gridLayout);

  for (const bubble of bubbles) {
    drawGridBubble(ctx, bubble, gridLayout);
  }

  drawAimTrajectory(ctx, aimTrajectory, gridLayout);
  drawLauncher(ctx, snapshot);
  drawFlyingBubble(ctx, flyingBubble);
  drawEffects(ctx, effects, gridLayout);
  drawHud(ctx, snapshot);
}

function drawStateOverlay(ctx, snapshot) {
  if (snapshot.state === 'loading') {
    drawLoading(ctx, snapshot);
    return;
  }

  if (snapshot.state === 'paused') {
    drawPausedOverlay(ctx, snapshot);
  }

  if (snapshot.state === 'gameOver' || snapshot.state === 'win') {
    drawEndTransitionOverlay(ctx, snapshot);
  }

  if (snapshot.state === 'settlement') {
    drawSettlementOverlay(ctx, snapshot);
  }
}

export function resizeCanvas(canvas, ctx, { width, height, dpr }) {
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth;
  }

  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function render(ctx, snapshot) {
  const { assets, fallbackBackground, height, width } = snapshot;

  ctx.clearRect(0, 0, width, height);

  if (assets.backgroundLoaded && assets.background) {
    drawCoverImage(ctx, assets.background, width, height);
  } else {
    drawFallbackBackground(ctx, width, height, fallbackBackground);
  }

  drawBackgroundWash(ctx, width, height);
  drawScene(ctx, snapshot);
  drawStateOverlay(ctx, snapshot);
  drawControls(ctx, snapshot.controls);
}

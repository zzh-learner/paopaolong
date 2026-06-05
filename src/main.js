import { loadAssets } from './assets.js';
import { Game } from './game.js';
import { createPointerInput } from './input.js';
import { render, resizeCanvas } from './render.js';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');

let game = null;
let lastFrameTime = 0;
let resizeFrameId = 0;

function getViewportSize() {
  const viewport = window.visualViewport;

  return {
    width: Math.max(1, Math.floor(viewport?.width ?? window.innerWidth)),
    height: Math.max(1, Math.floor(viewport?.height ?? window.innerHeight)),
    dpr: Math.max(1, window.devicePixelRatio || 1),
  };
}

function applyResize() {
  if (!game) {
    return;
  }

  const size = getViewportSize();
  resizeCanvas(canvas, ctx, size);
  game.resize(size);
  render(ctx, game.getSnapshot());
}

function createLoadingSnapshot({ width, height, dpr }) {
  return {
    assets: {
      background: null,
      backgroundLoaded: false,
    },
    controls: [],
    dpr,
    fallbackBackground: '#111827',
    height,
    state: 'loading',
    width,
  };
}

function requestResize() {
  if (resizeFrameId) {
    window.cancelAnimationFrame(resizeFrameId);
  }

  resizeFrameId = window.requestAnimationFrame(() => {
    resizeFrameId = 0;
    applyResize();
  });
}

function tick(frameTime) {
  const deltaTime = lastFrameTime
    ? Math.min((frameTime - lastFrameTime) / 1000, 0.1)
    : 0;

  lastFrameTime = frameTime;

  game.update(deltaTime);
  render(ctx, game.getSnapshot());
  window.requestAnimationFrame(tick);
}

function preventPageGesture(event) {
  event.preventDefault();
}

async function start() {
  const initialSize = getViewportSize();
  resizeCanvas(canvas, ctx, initialSize);
  render(ctx, createLoadingSnapshot(initialSize));

  const assets = await loadAssets();
  game = new Game({ assets });
  createPointerInput(canvas, game);

  applyResize();
  window.requestAnimationFrame(tick);
}

window.addEventListener('resize', requestResize);
window.addEventListener('orientationchange', requestResize);
window.visualViewport?.addEventListener('resize', requestResize);
window.visualViewport?.addEventListener('scroll', requestResize);
document.addEventListener('touchmove', preventPageGesture, { passive: false });
document.addEventListener('gesturestart', preventPageGesture);
document.addEventListener('contextmenu', preventPageGesture);

start();

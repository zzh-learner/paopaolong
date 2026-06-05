import { BUBBLE_COLORS } from './grid.js';

const ASSET_PATHS = {
  background: './images/游戏背景.png',
  launcher: './images/processed/launcher.png',
  bubbles: {
    blue: './images/bubble-blue.png',
    cyan: './images/bubble-cyan.png',
    green: './images/bubble-green.png',
    purple: './images/bubble-purple.png',
    red: './images/bubble-red.png',
    yellow: './images/bubble-yellow.png',
  },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export async function loadAssets() {
  const assets = {
    background: null,
    backgroundLoaded: false,
    bubbleImages: {},
    launcher: null,
    launcherLoaded: false,
  };

  try {
    assets.background = await loadImage(ASSET_PATHS.background);
    assets.backgroundLoaded = true;
  } catch (error) {
    console.warn(error.message);
  }

  try {
    assets.launcher = await loadImage(ASSET_PATHS.launcher);
    assets.launcherLoaded = true;
  } catch (error) {
    console.warn(error.message);
  }

  await Promise.all(BUBBLE_COLORS.map(async (color) => {
    const src = ASSET_PATHS.bubbles[color.id];

    if (!src) {
      return;
    }

    try {
      const image = await loadImage(src);
      color.image = image;
      assets.bubbleImages[color.id] = image;
    } catch (error) {
      console.warn(error.message);
    }
  }));

  return assets;
}

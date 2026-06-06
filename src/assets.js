import {
  BOMB_BUBBLE,
  BUBBLE_COLORS,
  LASER_BUBBLE,
  RAINBOW_BUBBLE,
} from './grid.js';

const ASSET_PATHS = {
  background: './images/used/background/game-background.png',
  launcher: './images/used/launcher/launcher.png',
  bubbles: {
    blue: './images/used/bubbles/bubble-blue.webp',
    cyan: './images/used/bubbles/bubble-cyan.webp',
    green: './images/used/bubbles/bubble-green.webp',
    purple: './images/used/bubbles/bubble-purple.webp',
    red: './images/used/bubbles/bubble-red.webp',
    yellow: './images/used/bubbles/bubble-yellow.webp',
  },
  specialBubbles: {
    bomb: './images/used/special-bubbles/bomb.png',
    laser: './images/used/special-bubbles/laser.png',
    rainbow: './images/used/special-bubbles/rainbow.png',
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
    specialBubbleImages: {},
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

  try {
    const image = await loadImage(ASSET_PATHS.specialBubbles.bomb);
    BOMB_BUBBLE.image = image;
    assets.specialBubbleImages.bomb = image;
  } catch (error) {
    console.warn(error.message);
  }

  try {
    const image = await loadImage(ASSET_PATHS.specialBubbles.rainbow);
    RAINBOW_BUBBLE.image = image;
    assets.specialBubbleImages.rainbow = image;
  } catch (error) {
    console.warn(error.message);
  }

  try {
    const image = await loadImage(ASSET_PATHS.specialBubbles.laser);
    LASER_BUBBLE.image = image;
    assets.specialBubbleImages.laser = image;
  } catch (error) {
    console.warn(error.message);
  }

  return assets;
}

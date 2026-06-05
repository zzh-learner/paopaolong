const POP_EFFECT_DURATION = 0.38;
export const FALLING_BUBBLE_DURATION = 0.72;
const SCORE_POPUP_DURATION = 0.9;
const PARTICLES_PER_BUBBLE = 7;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function createBubblePopEffect({ color, radius, x, y }) {
  const particles = [];

  for (let index = 0; index < PARTICLES_PER_BUBBLE; index += 1) {
    const angle = (Math.PI * 2 * index) / PARTICLES_PER_BUBBLE
      + randomBetween(-0.25, 0.25);
    const speed = randomBetween(radius * 2.8, radius * 5.3);

    particles.push({
      color,
      radius: randomBetween(radius * 0.12, radius * 0.24),
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      x,
      y,
    });
  }

  return {
    age: 0,
    color,
    duration: POP_EFFECT_DURATION,
    particles,
    radius,
    type: 'bubblePop',
    x,
    y,
  };
}

export function createScorePopup({ points, x, y }) {
  return {
    age: 0,
    duration: SCORE_POPUP_DURATION,
    points,
    scoreParts: [],
    type: 'scorePopup',
    x,
    y,
  };
}

export function createDetailedScorePopup({ points, scoreParts, x, y }) {
  return {
    age: 0,
    duration: SCORE_POPUP_DURATION,
    points,
    scoreParts,
    type: 'scorePopup',
    x,
    y,
  };
}

export function createFallingBubbleEffect({ bubbles, radius }) {
  return {
    age: 0,
    bubbles: bubbles.map((bubble, index) => ({
      ...bubble,
      velocityX: randomBetween(-radius * 1.4, radius * 1.4),
      velocityY: radius * randomBetween(3.5, 5.2) + index * radius * 0.08,
    })),
    duration: FALLING_BUBBLE_DURATION,
    radius,
    type: 'fallingBubble',
  };
}

export function updateEffects(effects, deltaTime) {
  for (const effect of effects) {
    effect.age += deltaTime;

    if (effect.type === 'bubblePop') {
      for (const particle of effect.particles) {
        particle.x += particle.velocityX * deltaTime;
        particle.y += particle.velocityY * deltaTime;
        particle.velocityY += effect.radius * 5.8 * deltaTime;
      }
    }

    if (effect.type === 'fallingBubble') {
      for (const bubble of effect.bubbles) {
        bubble.x += bubble.velocityX * deltaTime;
        bubble.y += bubble.velocityY * deltaTime;
        bubble.velocityY += effect.radius * 15 * deltaTime;
      }
    }
  }

  return effects.filter((effect) => effect.age < effect.duration);
}

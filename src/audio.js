const MASTER_GAIN = 0.18;

function getAudioContextConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext || window.webkitAudioContext || null;
}

function now(context) {
  return context.currentTime;
}

export class AudioFeedback {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.supported = Boolean(getAudioContextConstructor());
  }

  toggle() {
    this.enabled = !this.enabled;

    if (this.enabled) {
      this.playUi();
    }

    return this.enabled;
  }

  ensureContext() {
    if (!this.enabled || !this.supported) {
      return null;
    }

    if (!this.context) {
      const AudioContextConstructor = getAudioContextConstructor();
      this.context = new AudioContextConstructor();
    }

    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }

    return this.context;
  }

  tone({
    duration = 0.12,
    endFrequency,
    frequency,
    gain = MASTER_GAIN,
    startTime = 0,
    type = 'sine',
  }) {
    const context = this.ensureContext();

    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const startedAt = now(context) + startTime;
    const endedAt = startedAt + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startedAt);

    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endedAt);
    }

    envelope.gain.setValueAtTime(0.0001, startedAt);
    envelope.gain.exponentialRampToValueAtTime(gain, startedAt + duration * 0.16);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endedAt);

    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(startedAt);
    oscillator.stop(endedAt + 0.02);
  }

  noise({ duration = 0.1, gain = MASTER_GAIN, startTime = 0 } = {}) {
    const context = this.ensureContext();

    if (!context) {
      return;
    }

    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();
    const startedAt = now(context) + startTime;
    const endedAt = startedAt + duration;

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, startedAt);
    envelope.gain.setValueAtTime(gain, startedAt);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endedAt);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(context.destination);
    source.start(startedAt);
    source.stop(endedAt + 0.02);
  }

  playShoot() {
    this.tone({
      duration: 0.14,
      endFrequency: 640,
      frequency: 260,
      gain: 0.15,
      type: 'triangle',
    });
    this.noise({ duration: 0.045, gain: 0.035 });
  }

  playCollision() {
    this.tone({
      duration: 0.07,
      endFrequency: 260,
      frequency: 420,
      gain: 0.1,
      type: 'square',
    });
  }

  playPop(count = 3) {
    const steps = Math.min(5, Math.max(2, count));

    for (let index = 0; index < steps; index += 1) {
      this.tone({
        duration: 0.085,
        endFrequency: 760 + index * 90,
        frequency: 470 + index * 85,
        gain: 0.105,
        startTime: index * 0.035,
        type: 'sine',
      });
    }
  }

  playDrop(count = 1) {
    this.tone({
      duration: 0.18,
      endFrequency: 110,
      frequency: 260 + Math.min(count, 6) * 18,
      gain: 0.13,
      type: 'sawtooth',
    });
  }

  playUi() {
    this.tone({
      duration: 0.08,
      endFrequency: 640,
      frequency: 520,
      gain: 0.08,
      type: 'sine',
    });
  }
}

export function vibrate(pattern) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration is optional feedback; unsupported browsers should remain silent.
  }
}

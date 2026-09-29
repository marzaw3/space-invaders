// Proste efekty dźwiękowe generowane przez Web Audio – bez plików audio.
(function (root) {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    bolt: () => tone(880, 0.08, 'square', 0.04, 440),
    fire: () => tone(220, 0.25, 'sawtooth', 0.06, 70),
    ice: () => tone(1200, 0.15, 'triangle', 0.07, 1900),
    lightning: () => { tone(1600, 0.12, 'sawtooth', 0.05, 300); tone(800, 0.1, 'square', 0.03, 200, 0.03); },
    hit: () => tone(320, 0.05, 'square', 0.03, 220),
    kill: () => tone(520, 0.14, 'square', 0.05, 110),
    enemyShot: () => tone(260, 0.07, 'triangle', 0.02, 180),
    playerHit: () => tone(160, 0.45, 'sawtooth', 0.09, 40),
    empty: () => tone(110, 0.06, 'square', 0.04),
    life: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, null, i * 0.09)),
    wave: () => [440, 554, 659, 880].forEach((f, i) => tone(f, 0.14, 'square', 0.04, null, i * 0.08)),
    gameover: () => [440, 330, 247, 165].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, null, i * 0.22)),
  };

  root.Sfx = {
    unlock() { if (!muted) ensure(); },
    setMuted(value) { muted = !!value; },
    isMuted() { return muted; },
    play(name) { if (SOUNDS[name]) SOUNDS[name](); },
  };
})(this);

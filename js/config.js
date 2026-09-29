// Wszystkie parametry gry w jednym miejscu – zmień wartości tutaj, żeby dostroić rozgrywkę.
(function (root) {
  'use strict';

  const CONFIG = {
    width: 800,
    height: 600,
    hudTop: 40,
    hudBottom: 30,
    fixedStep: 1 / 60,

    player: {
      width: 39,
      height: 30,
      y: 530,
      speed: 320,
      lives: 3,
      extraLifeEvery: 10000,
      invulnTime: 2,
    },

    // Limit amunicji na podstawowy pocisk.
    ammo: { max: 40, regenInterval: 0.8 },

    mana: { max: 100, regenPerSec: 8 },

    // Kolejność = klawisze 1..4. unlockWave – od której fali zaklęcie jest dostępne.
    spells: [
      { id: 'bolt', name: 'Magiczny pocisk', short: 'Pocisk', cost: { ammo: 1 }, cooldown: 0.28,
        damage: 1, speed: 520, radius: 4, color: '#c9a2ff', unlockWave: 1 },
      { id: 'fire', name: 'Ognista kula', short: 'Ogień', cost: { mana: 25 }, cooldown: 0.6,
        damage: 2, splashDamage: 1, splashRadius: 55, speed: 380, radius: 7, color: '#ff8a3d', unlockWave: 2 },
      { id: 'ice', name: 'Lodowy pocisk', short: 'Lód', cost: { mana: 20 }, cooldown: 0.5,
        damage: 1, slowFactor: 0.4, slowTime: 3, speed: 460, radius: 5, color: '#7fe3ff', unlockWave: 3 },
      { id: 'lightning', name: 'Błyskawica', short: 'Błyskawica', cost: { mana: 35 }, cooldown: 0.7,
        damage: 1, pierce: 3, speed: 900, radius: 4, color: '#fff27a', unlockWave: 4 },
    ],

    // Różne HP przeciwników.
    enemyTypes: {
      imp: { name: 'Imp', hp: 1, points: 10, color: '#ff5a7a', eye: '#ffe45c' },
      skeleton: { name: 'Szkielet', hp: 2, points: 20, color: '#e8e0c8', eye: '#2a1030' },
      wraith: { name: 'Widmo', hp: 3, points: 30, color: '#8affc1', eye: '#12402a' },
    },

    formation: {
      rows: ['wraith', 'skeleton', 'imp', 'imp'],
      cols: 8,
      cellW: 56,
      cellH: 44,
      enemyW: 36,
      enemyH: 27,
      startY: 80,
      baseSpeed: 50,
      maxSpeedMultiplier: 4,
      stepDown: 18,
      sideMargin: 16,
    },

    enemyFire: { baseInterval: 1.2, minInterval: 0.35, bulletSpeed: 230 },

    waves: {
      speedGrowth: 1.12,
      fireGrowth: 0.9,
      startYStep: 10,
      startYMaxOffset: 80,
      hpBonusEvery: 4,
      clearBonus: 100,
      bannerTime: 2,
    },

    barriers: { count: 4, y: 450, cell: 8 },

    highscores: { size: 10, nameMaxLength: 10, storageKey: 'arcaneInvaders.highscores' },
    settingsKey: 'arcaneInvaders.settings',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.CONFIG = CONFIG;
})(this);

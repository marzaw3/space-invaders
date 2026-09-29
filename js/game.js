// Arcane Invaders – pętla gry, sterowanie, rysowanie i ekrany.
(function () {
  'use strict';

  const C = window.CONFIG;
  const L = window.Logic;
  const STEP = C.fixedStep;
  const FONT = '"Pixelify Sans", "Courier New", monospace';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = C.width;
  canvas.height = C.height;

  // ---------- zapis w przeglądarce ----------

  const Store = {
    load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    save(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* brak dostępu do storage */ }
    },
  };

  let highscores = Store.load(C.highscores.storageKey, []);
  if (!Array.isArray(highscores)) highscores = [];
  const settings = Object.assign({ muted: false }, Store.load(C.settingsKey, {}));
  Sfx.setMuted(settings.muted);

  // ---------- stan ----------

  // menu | playing | paused | enterName | gameover | ranking
  let state = 'menu';
  let game = null;
  let nameBuffer = '';
  let lastRank = -1;
  let time = 0;
  let shake = 0;
  const keys = new Set();
  const particles = [];
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({ x: Math.random() * C.width, y: Math.random() * C.height, z: 0.3 + Math.random() * 0.7, p: Math.random() * 6.28 });
  }

  function bestScore() {
    return Math.max(highscores.length ? highscores[0].score : 0, game ? game.score : 0);
  }

  function newGame() {
    game = {
      score: 0,
      lives: C.player.lives,
      wave: 0,
      player: { x: (C.width - C.player.width) / 2, y: C.player.y, w: C.player.width, h: C.player.height, invuln: 0, cooldown: 0 },
      ammo: C.ammo.max,
      ammoTimer: 0,
      mana: C.mana.max,
      spellIndex: 0,
      bullets: [],
      enemyBullets: [],
      formation: null,
      barriers: [],
      enemyFireTimer: 0,
      banner: 0,
      bannerSub: '',
      message: '',
      messageTimer: 0,
      animTimer: 0,
      frame: 0,
    };
    particles.length = 0;
    nextWave(0);
    state = 'playing';
  }

  function nextWave(bonus) {
    const g = game;
    g.wave++;
    g.formation = L.createFormation(g.wave, C);
    g.barriers = L.createBarriers(C);
    g.bullets = [];
    g.enemyBullets = [];
    g.ammo = C.ammo.max;
    g.ammoTimer = 0;
    g.enemyFireTimer = L.enemyFireInterval(g.wave, C) * 2;
    g.banner = C.waves.bannerTime;
    g.bannerSub = bonus ? 'Bonus za falę +' + bonus : '';
    C.spells.forEach((s, i) => {
      if (s.unlockWave === g.wave && g.wave > 1) showMessage('Nowe zaklęcie: ' + s.name + ' (klawisz ' + (i + 1) + ')', 3.5);
    });
    if (g.wave > 1) Sfx.play('wave');
  }

  function showMessage(text, duration) {
    if (!game) return;
    game.message = text;
    game.messageTimer = duration || 1.6;
  }

  // ---------- zaklęcia ----------

  function currentSpell() {
    return C.spells[game.spellIndex];
  }

  function selectSpell(index) {
    const s = C.spells[index];
    if (!s) return;
    if (s.unlockWave > game.wave) {
      showMessage(s.name + ' – dostępne od fali ' + s.unlockWave);
      return;
    }
    game.spellIndex = index;
  }

  function cycleSpell(delta) {
    const unlocked = L.unlockedSpells(game.wave, C.spells);
    const cur = unlocked.indexOf(currentSpell());
    const next = unlocked[(cur + delta + unlocked.length) % unlocked.length];
    game.spellIndex = C.spells.indexOf(next);
  }

  function tryCast() {
    const p = game.player;
    const s = currentSpell();
    if (p.cooldown > 0) return;
    if (!L.canCast(s, game)) {
      showMessage(s.cost.ammo ? 'Brak amunicji! Poczekaj na regenerację' : 'Za mało many!');
      Sfx.play('empty');
      p.cooldown = 0.25;
      return;
    }
    L.payCost(s, game);
    p.cooldown = s.cooldown;
    game.bullets.push({ x: p.x + p.w / 2, y: p.y - 4, r: s.radius, vy: -s.speed, spell: s, pierce: s.pierce || 1, hit: new Set() });
    Sfx.play(s.id);
  }

  // ---------- aktualizacja ----------

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function update(dt) {
    const g = game;
    const p = g.player;

    let dir = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dir -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dir += 1;
    p.x = clamp(p.x + dir * C.player.speed * dt, 8, C.width - 8 - p.w);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (keys.has('Space')) tryCast();

    L.regenAmmo(g, dt, C);
    g.mana = Math.min(C.mana.max, g.mana + C.mana.regenPerSec * dt);
    g.banner = Math.max(0, g.banner - dt);
    g.messageTimer = Math.max(0, g.messageTimer - dt);
    g.animTimer += dt;
    if (g.animTimer >= 0.5) {
      g.animTimer -= 0.5;
      g.frame ^= 1;
    }

    const f = g.formation;
    L.stepFormation(f, g.wave, dt, C);
    for (const e of f.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
    L.erodeBarriers(g.barriers, f.enemies);

    g.enemyFireTimer -= dt;
    if (g.enemyFireTimer <= 0) {
      const shooters = L.pickShooters(f.enemies);
      if (shooters.length) {
        const e = shooters[Math.floor(Math.random() * shooters.length)];
        g.enemyBullets.push({ x: e.x + e.w / 2 - 2, y: e.y + e.h, w: 4, h: 12 });
        Sfx.play('enemyShot');
      }
      g.enemyFireTimer = L.enemyFireInterval(g.wave, C) * (0.6 + Math.random() * 0.8);
    }

    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    if (state !== 'playing') return;

    if (L.reachedLine(f.enemies, p.y)) {
      g.lives = 0;
      explode(p.x + p.w / 2, p.y + p.h / 2, '#7f9cff', 40);
      shake = 0.4;
      endGame();
      return;
    }

    if (L.aliveCount(f.enemies) === 0) {
      const bonus = L.waveClearBonus(g.wave, C);
      addScore(bonus);
      nextWave(bonus);
    }
  }

  function updatePlayerBullets(dt) {
    const g = game;
    for (const b of g.bullets) {
      b.y += b.vy * dt;
      if (b.y < C.hudTop) {
        b.dead = true;
        continue;
      }
      const rect = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };

      // Błyskawica przelatuje przez bariery.
      if (b.spell.id !== 'lightning') {
        const cell = L.hitBarrier(g.barriers, rect);
        if (cell) {
          b.dead = true;
          sparks(cell.x + cell.w / 2, cell.y + cell.h / 2, '#9b7bff', 5);
          continue;
        }
      }

      for (const e of g.formation.enemies) {
        if (!e.alive || b.hit.has(e) || !L.rectsOverlap(rect, e)) continue;
        b.hit.add(e);
        hitEnemy(e, b.spell.damage);
        if (b.spell.id === 'fire') {
          for (const o of L.enemiesInRadius(g.formation.enemies, b.x, b.y, b.spell.splashRadius)) {
            if (o !== e) hitEnemy(o, b.spell.splashDamage);
          }
          ring(b.x, b.y, b.spell.splashRadius, b.spell.color);
        }
        if (b.spell.id === 'ice') {
          g.formation.slowTimer = b.spell.slowTime;
          g.formation.slowFactor = b.spell.slowFactor;
        }
        b.pierce--;
        if (b.pierce <= 0) {
          b.dead = true;
          break;
        }
      }
    }
    g.bullets = g.bullets.filter(b => !b.dead);
  }

  function playerHitbox(p) {
    return { x: p.x + 6, y: p.y + 6, w: p.w - 12, h: p.h - 6 };
  }

  function updateEnemyBullets(dt) {
    const g = game;
    const p = g.player;
    for (const b of g.enemyBullets) {
      b.y += C.enemyFire.bulletSpeed * dt;
      if (b.y > C.height - C.hudBottom) {
        b.dead = true;
        continue;
      }
      const cell = L.hitBarrier(g.barriers, b);
      if (cell) {
        b.dead = true;
        sparks(cell.x + cell.w / 2, cell.y + cell.h / 2, '#ff6a8a', 4);
        continue;
      }
      if (p.invuln <= 0 && L.rectsOverlap(b, playerHitbox(p))) {
        b.dead = true;
        playerHit();
        if (state !== 'playing') return;
      }
    }
    g.enemyBullets = g.enemyBullets.filter(b => !b.dead);
  }

  function hitEnemy(e, damage) {
    const killed = L.damageEnemy(e, damage);
    const color = C.enemyTypes[e.type].color;
    if (killed) {
      addScore(e.points);
      explode(e.x + e.w / 2, e.y + e.h / 2, color, 18);
      Sfx.play('kill');
    } else {
      sparks(e.x + e.w / 2, e.y + e.h / 2, color, 6);
      Sfx.play('hit');
    }
  }

  function addScore(points) {
    const prev = game.score;
    game.score += points;
    const extra = L.extraLivesEarned(prev, game.score, C.player.extraLifeEvery);
    if (extra > 0) {
      game.lives += extra;
      showMessage('Dodatkowe życie!');
      Sfx.play('life');
    }
  }

  function playerHit() {
    const g = game;
    const p = g.player;
    g.lives--;
    explode(p.x + p.w / 2, p.y + p.h / 2, '#7f9cff', 26);
    shake = 0.35;
    Sfx.play('playerHit');
    if (g.lives <= 0) {
      endGame();
    } else {
      p.invuln = C.player.invulnTime;
      g.enemyBullets = [];
    }
  }

  function endGame() {
    Sfx.play('gameover');
    game.bullets = [];
    game.enemyBullets = [];
    if (L.qualifiesForHighscore(highscores, game.score, C.highscores.size)) {
      nameBuffer = '';
      state = 'enterName';
    } else {
      state = 'gameover';
    }
  }

  function saveName() {
    const entry = {
      name: L.sanitizeName(nameBuffer, C.highscores.nameMaxLength),
      score: game.score,
      wave: game.wave,
      date: new Date().toISOString().slice(0, 10),
    };
    highscores = L.insertHighscore(highscores, entry, C.highscores.size);
    lastRank = highscores.indexOf(entry);
    Store.save(C.highscores.storageKey, highscores);
    state = 'ranking';
  }

  // ---------- cząsteczki ----------

  function burst(x, y, color, n, minSpeed, maxSpeed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const life = 0.3 + Math.random() * 0.5;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 2 + Math.random() * 3 });
    }
  }

  function explode(x, y, color, n) { burst(x, y, color, n, 40, 220); }
  function sparks(x, y, color, n) { burst(x, y, color, n, 20, 100); }
  function ring(x, y, r, color) { particles.push({ ring: true, x, y, r, life: 0.3, max: 0.3, color }); }

  function updateParticles(dt) {
    for (const q of particles) {
      q.life -= dt;
      if (q.ring) continue;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.96;
      q.vy *= 0.96;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  }

  // ---------- rysowanie ----------

  function text(str, x, y, size, color, align, weight) {
    ctx.font = (weight || 400) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + s.p)) * s.z;
      ctx.fillStyle = s.z > 0.8 ? '#e6dcff' : '#8f7fd8';
      const size = s.z > 0.8 ? 2 : 1;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld() {
    const g = game;
    const f = g.formation;

    for (const c of g.barriers) {
      if (!c.alive) continue;
      ctx.fillStyle = ((c.x + c.y) / C.barriers.cell) % 2 ? '#6a4cff' : '#8466ff';
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }

    for (const e of f.enemies) {
      if (!e.alive) continue;
      const set = Sprites.enemies[e.type];
      const img = e.flash > 0 ? set.flash[g.frame] : f.slowTimer > 0 ? set.frozen[g.frame] : set.frames[g.frame];
      ctx.drawImage(img, Math.round(e.x), Math.round(e.y));
      if (e.maxHp > 1) {
        ctx.fillStyle = '#2a1840';
        ctx.fillRect(Math.round(e.x), Math.round(e.y + e.h + 3), e.w, 3);
        ctx.fillStyle = C.enemyTypes[e.type].color;
        ctx.fillRect(Math.round(e.x), Math.round(e.y + e.h + 3), Math.round(e.w * e.hp / e.maxHp), 3);
      }
    }

    const p = g.player;
    if (state === 'playing' || state === 'paused') {
      if (p.invuln <= 0 || Math.floor(time * 12) % 2 === 0) ctx.drawImage(Sprites.player, Math.round(p.x), Math.round(p.y));
    }

    ctx.save();
    ctx.shadowBlur = 14;
    for (const b of g.bullets) {
      ctx.shadowColor = b.spell.color;
      if (b.spell.id === 'lightning') {
        ctx.strokeStyle = b.spell.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 14);
        ctx.lineTo(b.x - 5, b.y - 4);
        ctx.lineTo(b.x + 5, b.y + 4);
        ctx.lineTo(b.x, b.y + 14);
        ctx.stroke();
      } else {
        ctx.fillStyle = b.spell.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowColor = '#ff3355';
    ctx.fillStyle = '#ff7a9a';
    for (const b of g.enemyBullets) {
      const wobble = Math.sin(time * 30 + b.x) * 1.5;
      ctx.fillRect(Math.round(b.x + wobble), Math.round(b.y), b.w, b.h);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      if (q.ring) {
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * (1 - q.life / q.max * 0.6), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = q.color;
        ctx.fillRect(q.x, q.y, q.size, q.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, ratio, color) {
    ctx.fillStyle = '#241a4a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * clamp(ratio, 0, 1)), h);
  }

  function drawHud() {
    const g = game;
    const top = C.hudTop;
    const bottomY = C.height - C.hudBottom;

    ctx.fillStyle = '#120d2e';
    ctx.fillRect(0, 0, C.width, top);
    ctx.fillRect(0, bottomY, C.width, C.hudBottom);
    ctx.fillStyle = '#3a2a7a';
    ctx.fillRect(0, top - 2, C.width, 2);
    ctx.fillRect(0, bottomY, C.width, 2);

    text('WYNIK ' + String(g.score).padStart(6, '0'), 14, top / 2, 18, '#e6dcff');
    text('REKORD ' + String(bestScore()).padStart(6, '0'), 230, top / 2, 18, '#a898e0');
    text('FALA ' + g.wave, 470, top / 2, 18, '#fff27a');

    const shown = Math.min(g.lives, 5);
    for (let i = 0; i < shown; i++) ctx.drawImage(Sprites.player, 580 + i * 26, 11, 20, 16);
    if (g.lives > 5) text('x' + g.lives, 580 + 5 * 26, top / 2, 16, '#e6dcff');
    text(Sfx.isMuted() ? '♪ WYŁ' : '♪', C.width - 14, top / 2, 16, Sfx.isMuted() ? '#6a5a9a' : '#e6dcff', 'right');

    const cy = bottomY + C.hudBottom / 2 + 1;
    const lowAmmo = g.ammo <= 5;
    text('AMUNICJA', 12, cy, 14, lowAmmo && Math.floor(time * 4) % 2 ? '#ff5a7a' : '#c9a2ff');
    bar(88, cy - 5, 90, 10, g.ammo / C.ammo.max, lowAmmo ? '#ff5a7a' : '#c9a2ff');
    text(g.ammo + '/' + C.ammo.max, 184, cy, 14, '#e6dcff');

    text('MANA', 250, cy, 14, '#7fe3ff');
    bar(292, cy - 5, 90, 10, g.mana / C.mana.max, '#4aa8ff');

    let x = 410;
    C.spells.forEach((s, i) => {
      const locked = s.unlockWave > g.wave;
      const active = i === g.spellIndex;
      const label = (i + 1) + ' ' + (locked ? '🔒' : s.short);
      ctx.font = '400 14px ' + FONT;
      const w = ctx.measureText(label).width + 12;
      if (active) {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x - 4, cy - 10, w, 20);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4.5, cy - 10.5, w, 20);
      }
      const affordable = L.canCast(s, g);
      text(label, x + 2, cy, 14, locked ? '#4a3f7a' : affordable ? s.color : '#7a6a9a');
      x += w + 6;
    });
  }

  function drawBannerAndMessage() {
    const g = game;
    if (g.banner > 0) {
      ctx.globalAlpha = Math.min(1, g.banner * 1.5);
      text('FALA ' + g.wave, C.width / 2, 260, 56, '#fff27a', 'center', 700);
      if (g.bannerSub) text(g.bannerSub, C.width / 2, 305, 20, '#e6dcff', 'center');
      ctx.globalAlpha = 1;
    }
    if (g.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, g.messageTimer * 2);
      text(g.message, C.width / 2, 425, 18, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function dim(alpha) {
    ctx.fillStyle = 'rgba(5, 3, 18, ' + alpha + ')';
    ctx.fillRect(0, 0, C.width, C.height);
  }

  function blink() {
    return Math.floor(time * 2) % 2 === 0;
  }

  function drawTitle(y) {
    ctx.save();
    ctx.shadowColor = '#9b6bff';
    ctx.shadowBlur = 24;
    text('ARCANE INVADERS', C.width / 2, y, 60, '#d9c6ff', 'center', 700);
    ctx.restore();
  }

  function drawMenu() {
    drawTitle(110);
    text('Obroń wieżę maga przed nadciągającymi demonami!', C.width / 2, 165, 20, '#a898e0', 'center');

    const types = Object.keys(C.enemyTypes);
    types.forEach((type, i) => {
      const t = C.enemyTypes[type];
      const y = 215 + i * 44;
      ctx.drawImage(Sprites.enemies[type].frames[Math.floor(time * 2) % 2], 270, y);
      text(t.name, 325, y + 14, 20, t.color);
      text('HP ' + t.hp + '   ' + t.points + ' pkt', 440, y + 14, 20, '#e6dcff');
    });

    const lines = [
      '← →  /  A D   – ruch maga',
      'Spacja   – rzuć zaklęcie (pocisk zużywa amunicję!)',
      '1–4  /  Q E   – wybór zaklęcia (nowe co falę)',
      'P / Esc – pauza     M – dźwięk',
    ];
    lines.forEach((l, i) => text(l, C.width / 2, 370 + i * 28, 18, '#c9bdf0', 'center'));

    if (blink()) text('ENTER – START', C.width / 2, 505, 28, '#fff27a', 'center', 700);
    text('R – ranking      Rekord: ' + bestScore(), C.width / 2, 550, 18, '#a898e0', 'center');
  }

  function drawPause() {
    dim(0.6);
    text('PAUZA', C.width / 2, 250, 56, '#e6dcff', 'center', 700);
    text('P / Esc – wznów      Q – wyjdź do menu', C.width / 2, 320, 20, '#c9bdf0', 'center');
  }

  function drawGameOver() {
    dim(0.65);
    text('KONIEC GRY', C.width / 2, 220, 56, '#ff5a7a', 'center', 700);
    text('Wynik: ' + game.score + '     Fala: ' + game.wave, C.width / 2, 290, 24, '#e6dcff', 'center');
    if (blink()) text('ENTER – zagraj ponownie', C.width / 2, 360, 24, '#fff27a', 'center');
    text('Esc – menu     R – ranking', C.width / 2, 400, 18, '#a898e0', 'center');
  }

  function drawEnterName() {
    dim(0.7);
    text('NOWY REKORD!', C.width / 2, 200, 52, '#fff27a', 'center', 700);
    text('Wynik: ' + game.score + '     Fala: ' + game.wave, C.width / 2, 260, 22, '#e6dcff', 'center');
    text('Wpisz swoje imię:', C.width / 2, 320, 20, '#c9bdf0', 'center');
    ctx.fillStyle = '#1c1444';
    ctx.fillRect(C.width / 2 - 150, 345, 300, 44);
    ctx.strokeStyle = '#9b6bff';
    ctx.strokeRect(C.width / 2 - 150.5, 344.5, 300, 44);
    text(nameBuffer + (blink() ? '_' : ' '), C.width / 2, 368, 26, '#ffffff', 'center');
    text('Enter – zapisz', C.width / 2, 420, 18, '#a898e0', 'center');
  }

  function drawRanking() {
    text('RANKING', C.width / 2, 70, 48, '#d9c6ff', 'center', 700);
    if (!highscores.length) {
      text('Brak wyników – zagraj pierwszy!', C.width / 2, 280, 22, '#c9bdf0', 'center');
    } else {
      text('#', 180, 125, 16, '#6a5a9a');
      text('IMIĘ', 220, 125, 16, '#6a5a9a');
      text('WYNIK', 520, 125, 16, '#6a5a9a', 'right');
      text('FALA', 610, 125, 16, '#6a5a9a', 'right');
      highscores.forEach((h, i) => {
        const y = 160 + i * 34;
        const hl = i === lastRank;
        if (hl) {
          ctx.fillStyle = 'rgba(255, 242, 122, 0.12)';
          ctx.fillRect(165, y - 15, 470, 30);
        }
        const color = hl ? '#fff27a' : i === 0 ? '#ffd27a' : '#e6dcff';
        text(String(i + 1), 180, y, 20, color);
        text(h.name, 220, y, 20, color);
        text(String(h.score), 520, y, 20, color, 'right');
        text(String(h.wave || '-'), 610, y, 20, color, 'right');
      });
    }
    text('Enter / Esc – menu', C.width / 2, 560, 18, '#a898e0', 'center');
  }

  function render() {
    ctx.fillStyle = '#07051a';
    ctx.fillRect(0, 0, C.width, C.height);

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 24 * shake, (Math.random() - 0.5) * 24 * shake);
    drawStars();
    const inGame = game && state !== 'menu' && state !== 'ranking';
    if (inGame) drawWorld();
    drawParticles();
    ctx.restore();

    if (inGame) {
      drawHud();
      drawBannerAndMessage();
    }

    if (state === 'menu') drawMenu();
    else if (state === 'paused') drawPause();
    else if (state === 'gameover') drawGameOver();
    else if (state === 'enterName') drawEnterName();
    else if (state === 'ranking') drawRanking();
  }

  // ---------- sterowanie ----------

  function toggleMute() {
    settings.muted = !settings.muted;
    Sfx.setMuted(settings.muted);
    Store.save(C.settingsKey, settings);
    if (!settings.muted) Sfx.unlock();
  }

  function handleNameKey(e) {
    if (e.code === 'Enter') {
      saveName();
    } else if (e.code === 'Backspace') {
      e.preventDefault();
      nameBuffer = nameBuffer.slice(0, -1);
    } else if (e.key.length === 1 && /[\p{L}\p{N} _-]/u.test(e.key) && nameBuffer.length < C.highscores.nameMaxLength) {
      nameBuffer += e.key;
    }
  }

  window.addEventListener('keydown', e => {
    Sfx.unlock();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (state === 'enterName') {
      handleNameKey(e);
      return;
    }
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyM') {
      toggleMute();
      return;
    }

    switch (state) {
      case 'menu':
        if (e.code === 'Enter') newGame();
        else if (e.code === 'KeyR') { lastRank = -1; state = 'ranking'; }
        break;
      case 'playing':
        if (e.code === 'KeyP' || e.code === 'Escape') state = 'paused';
        else if (/^Digit[1-9]$/.test(e.code)) selectSpell(Number(e.code.slice(5)) - 1);
        else if (e.code === 'KeyQ') cycleSpell(-1);
        else if (e.code === 'KeyE') cycleSpell(1);
        break;
      case 'paused':
        if (e.code === 'KeyP' || e.code === 'Escape') state = 'playing';
        else if (e.code === 'KeyQ') state = 'menu';
        break;
      case 'gameover':
        if (e.code === 'Enter') newGame();
        else if (e.code === 'Escape') state = 'menu';
        else if (e.code === 'KeyR') { lastRank = -1; state = 'ranking'; }
        break;
      case 'ranking':
        if (e.code === 'Enter' || e.code === 'Escape') state = 'menu';
        break;
    }
  });

  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') state = 'paused';
  });

  // ---------- skalowanie i pętla ----------

  function resize() {
    const s = Math.min(window.innerWidth / C.width, window.innerHeight / C.height);
    canvas.style.width = Math.floor(C.width * s) + 'px';
    canvas.style.height = Math.floor(C.height * s) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    time += dt;

    for (const s of stars) {
      s.y += s.z * 18 * dt;
      if (s.y > C.height) { s.y = 0; s.x = Math.random() * C.width; }
    }

    if (state === 'playing') {
      acc += dt;
      while (acc >= STEP && state === 'playing') {
        update(STEP);
        acc -= STEP;
      }
    } else {
      acc = 0;
    }
    if (state !== 'paused') {
      updateParticles(dt);
      shake = Math.max(0, shake - dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

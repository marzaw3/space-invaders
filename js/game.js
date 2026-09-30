// Arcane Invaders - pętla gry, sterowanie, rysowanie i ekrany.
(function () {
  'use strict';

  const C = window.CONFIG;
  const L = window.Logic;
  const STEP = C.fixedStep;
  const FONT = '"Pixelify Sans", "Courier New", monospace';
  const TITLE_FONT = '"Jacquard 24", "Pixelify Sans", serif';
  if (document.fonts) {
    document.fonts.load('40px "Jacquard 24"');
    document.fonts.load('20px "Pixelify Sans"');
    document.fonts.load('700 20px "Pixelify Sans"');
  }

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
  let sigilPulse = 0;
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
      showMessage(s.name + ' - dostępne od fali ' + s.unlockWave);
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
    game.bullets.push({ x: p.x + p.w / 2, y: p.y - 4, r: s.radius, vy: -s.speed, spell: s, pierce: s.pierce || 1, hit: new Set(), trail: [] });
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
    p.x = L.wrapX(p.x + dir * C.player.speed * dt, p.w, C.width);
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
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();
      b.y += b.vy * dt;
      if (b.spell.id === 'fire' && Math.random() < 0.5) ember(b.x, b.y, '#ff8a3d');
      if (b.spell.id === 'ice' && Math.random() < 0.3) ember(b.x, b.y, '#bff4ff');
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
      if (p.invuln <= 0 && L.wrappedRects(playerHitbox(p), C.width).some(r => L.rectsOverlap(b, r))) {
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
      flash(e.x + e.w / 2, e.y + e.h / 2, color, 36);
      sigilPulse = Math.min(1, sigilPulse + 0.35);
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
  function flash(x, y, color, r) { particles.push({ flash: true, x, y, r, life: 0.25, max: 0.25, color }); }
  function ember(x, y, color) {
    const life = 0.2 + Math.random() * 0.25;
    particles.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 40, life, max: life, color, size: 2 });
  }

  function updateParticles(dt) {
    for (const q of particles) {
      q.life -= dt;
      if (q.ring || q.flash) continue;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.96;
      q.vy *= 0.96;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  }

  // ---------- rysowanie ----------

  const P = Sprites.PALETTE;
  const glow = Sprites.glowDot;

  function text(str, x, y, size, color, align, weight, font) {
    ctx.font = (weight || 400) + ' ' + size + 'px ' + (font || FONT);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // Nagłówki pikselową frakturą, ze złotym gradientem i żarem pod spodem.
  function title(str, x, y, size, colors) {
    const [top, mid, bottom] = colors || ['#fff1c4', P.gold, P.goldDeep];
    ctx.save();
    ctx.font = '400 ' + size + 'px ' + TITLE_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const grad = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, mid);
    grad.addColorStop(1, bottom);
    ctx.shadowColor = P.ember;
    ctx.shadowBlur = 28;
    ctx.fillStyle = grad;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(7,4,15,0.6)';
    ctx.strokeText(str, x, y);
    ctx.restore();
  }

  // Rysuje sprite z marginesem poświaty tak, by (x, y) był lewym górnym rogiem hitboxa.
  function sprite(s, x, y, scale) {
    const k = scale || 1;
    ctx.drawImage(s.img, Math.round(x - s.ox * k), Math.round(y - s.oy * k), s.img.width * k, s.img.height * k);
  }

  function glowAt(color, x, y, r, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow(color, 32), x - r, y - r, r * 2, r * 2);
  }

  function drawStars() {
    for (const s of stars) {
      const a = 0.25 + 0.75 * Math.abs(Math.sin(time * 1.5 + s.p)) * s.z;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.z > 0.8 ? '#fff6e0' : '#9f8fe0';
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      if (s.z > 0.95) {
        ctx.fillRect(x - 2, y, 5, 1);
        ctx.fillRect(x, y - 2, 1, 5);
      } else {
        ctx.fillRect(x, y, s.z > 0.8 ? 2 : 1, s.z > 0.8 ? 2 : 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Krąg przywołania - rozbłyska przy każdym zabitym demonie i na starcie fali.
  function drawSigil(cx, cy, scale, alpha) {
    const pulse = Math.min(1, sigilPulse);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    const r = 170 * scale * (1 + pulse * 0.15);
    ctx.globalAlpha = (0.12 + pulse * 0.3) * alpha;
    ctx.drawImage(glow(P.gold, 32), -r, -r, r * 2, r * 2);

    ctx.globalAlpha = (0.2 + pulse * 0.45) * alpha;
    ctx.save();
    ctx.rotate(time * 0.06);
    ctx.scale(scale, scale);
    ctx.drawImage(Sprites.sigilOuter, -Sprites.sigilOuter.width / 2, -Sprites.sigilOuter.height / 2);
    ctx.restore();

    ctx.globalAlpha = (0.28 + pulse * 0.5) * alpha;
    ctx.save();
    ctx.rotate(-time * 0.13);
    const k = scale * (1 + pulse * 0.05);
    ctx.scale(k, k);
    ctx.drawImage(Sprites.sigilInner, -Sprites.sigilInner.width / 2, -Sprites.sigilInner.height / 2);
    ctx.restore();
    ctx.restore();
  }

  function drawBackground(sigilAlpha) {
    drawStars();
    drawSigil(C.width / 2, 185, 1, sigilAlpha);
    ctx.drawImage(Sprites.skyline, 0, 0);
    const mx = (time * 10) % C.width;
    ctx.drawImage(Sprites.mist, -mx, C.height - 330);
    ctx.drawImage(Sprites.mist, C.width - mx, C.height - 330);
    ctx.drawImage(Sprites.parapet, 0, C.player.y + C.player.height);
  }

  // Runiczne kamienie: faktura z haszu pozycji, co czwarty blok ma świecącą runę.
  function drawBarriers(cells) {
    const n = C.barriers.cell;
    for (const c of cells) {
      if (!c.alive) continue;
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      const k = (Math.round(c.x / n) * 7 + Math.round(c.y / n) * 13) % 5;
      ctx.fillStyle = k < 1 ? P.stoneLight : k < 3 ? P.stone : '#3b2e55';
      ctx.fillRect(x, y, n, n);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, n, 1);
      ctx.fillStyle = 'rgba(7,4,15,0.35)';
      ctx.fillRect(x, y + n - 1, n, 1);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cells) {
      if (!c.alive) continue;
      const k = Math.round(c.x / n) * 31 + Math.round(c.y / n) * 17;
      if (k % 4 !== 0) continue;
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      const a = 0.45 + 0.4 * Math.sin(time * 2.2 + k);
      glowAt(P.moonTeal, x + n / 2, y + n / 2, 10, a * 0.35);
      ctx.globalAlpha = a;
      ctx.fillStyle = P.moonTeal;
      ctx.fillRect(x + 3, y + 1, 2, 6);
      if (k % 3 === 0) ctx.fillRect(x + 1, y + 3, 6, 1);
      else ctx.fillRect(x + 5, y + 2, 2, 1);
    }
    ctx.restore();
  }

  function drawEnemies() {
    const g = game;
    const f = g.formation;
    // Demony wyłaniają się z kręgu na początku fali.
    const appear = clamp((C.waves.bannerTime - g.banner) / 0.6, 0, 1);
    ctx.globalAlpha = appear;
    for (const e of f.enemies) {
      if (!e.alive) continue;
      const set = Sprites.enemies[e.type];
      const s = e.flash > 0 ? set.flash[g.frame] : f.slowTimer > 0 ? set.frozen[g.frame] : set.frames[g.frame];
      sprite(s, e.x, e.y);
      if (e.maxHp > 1) {
        const x = Math.round(e.x + 4);
        const y = Math.round(e.y + e.h + 4);
        const w = e.w - 8;
        ctx.fillStyle = P.ink;
        ctx.fillRect(x - 1, y - 1, w + 2, 4);
        ctx.fillStyle = C.enemyTypes[e.type].color;
        ctx.fillRect(x, y, Math.round(w * e.hp / e.maxHp), 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMage(x, y) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowAt('#5b7cff', x + C.player.width / 2, y + C.player.height, 34, 0.35);
    ctx.restore();
    sprite(Sprites.player, x, y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gx = x + Sprites.playerGem.x;
    const gy = y + Sprites.playerGem.y;
    const pulse = 0.6 + 0.4 * Math.sin(time * 5);
    glowAt('#9ff5ff', gx, gy, 16 + pulse * 6, 0.55 * pulse + 0.2);
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    if (state !== 'playing' && state !== 'paused') return;
    if (p.invuln > 0 && Math.floor(time * 12) % 2 !== 0) return;
    for (const r of L.wrappedRects(p, C.width)) drawMage(r.x, r.y);
  }

  function drawLightning(b) {
    const pts = [];
    const len = 46;
    for (let i = 0; i <= 6; i++) {
      pts.push([b.x + (i === 0 || i === 6 ? 0 : (Math.random() - 0.5) * 12), b.y - 14 + (len * i) / 6]);
    }
    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = b.spell.color;
    ctx.lineWidth = 7;
    path();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    path();
    glowAt(b.spell.color, b.x, b.y - 14, 26, 0.8);
  }

  function drawBullets() {
    const g = game;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (const b of g.bullets) {
      const s = b.spell;
      if (s.id === 'lightning') {
        drawLightning(b);
        continue;
      }
      b.trail.forEach((t, i) => {
        const k = (i + 1) / b.trail.length;
        glowAt(s.color, t.x, t.y, b.r * 3.2 * k, 0.45 * k);
      });
      const flicker = s.id === 'fire' ? 1 + Math.sin(time * 40 + b.x) * 0.15 : 1;
      glowAt(s.color, b.x, b.y, b.r * 4.5 * flicker, 0.9);
      ctx.globalAlpha = 1;
      if (s.id === 'ice') {
        ctx.fillStyle = '#e8fbff';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - b.r * 2.4);
        ctx.lineTo(b.x + b.r * 0.8, b.y);
        ctx.lineTo(b.x, b.y + b.r * 1.4);
        ctx.lineTo(b.x - b.r * 0.8, b.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = s.id === 'fire' ? '#ffe08a' : '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.6 * flicker, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const b of g.enemyBullets) {
      const wobble = Math.sin(time * 30 + b.x) * 1.5;
      const x = Math.round(b.x + wobble);
      const y = Math.round(b.y);
      glowAt('#ff3355', x + b.w / 2, y + b.h / 2, 14, 0.7);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff4a5a';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#ffd6dc';
      ctx.fillRect(x + 1, y + b.h - 6, b.w - 2, 5);
    }
    ctx.restore();
  }

  function drawWorld() {
    drawBarriers(game.barriers);
    drawEnemies();
    drawPlayer();
    drawBullets();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of particles) {
      const a = Math.max(0, q.life / q.max);
      if (q.ring) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * (1 - a * 0.6), 0, Math.PI * 2);
        ctx.stroke();
      } else if (q.flash) {
        glowAt(q.color, q.x, q.y, q.r * (1.4 - a * 0.4), a * 0.9);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = q.color;
        const size = q.size * (0.5 + a * 0.5);
        ctx.fillRect(Math.round(q.x), Math.round(q.y), size, size);
      }
    }
    ctx.restore();
  }

  // Pasek z wgłębieniem, połyskiem i podziałką.
  function bar(x, y, w, h, ratio, color, ticks) {
    ctx.fillStyle = P.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#1e1438';
    ctx.fillRect(x, y, w, h);
    const fw = Math.round(w * clamp(ratio, 0, 1));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, fw, 2);
    ctx.fillStyle = 'rgba(7,4,15,0.55)';
    for (let i = 1; i < ticks; i++) ctx.fillRect(x + Math.round((w * i) / ticks), y, 1, h);
  }

  function hudStrip(y, h, lineY) {
    ctx.fillStyle = 'rgba(9,5,20,0.88)';
    ctx.fillRect(0, y, C.width, h);
    const line = ctx.createLinearGradient(0, 0, C.width, 0);
    line.addColorStop(0, Sprites.rgba(P.gold, 0));
    line.addColorStop(0.5, Sprites.rgba(P.gold, 0.8));
    line.addColorStop(1, Sprites.rgba(P.gold, 0));
    ctx.fillStyle = line;
    ctx.fillRect(0, lineY, C.width, 1);
  }

  function drawHud() {
    const g = game;
    const top = C.hudTop;
    const bottomY = C.height - C.hudBottom;
    const dimText = '#9d8cc4';

    hudStrip(0, top, top - 1);
    hudStrip(bottomY, C.hudBottom, bottomY);

    const cy = top / 2;
    text('Wynik', 14, cy, 14, dimText);
    text(String(g.score).padStart(6, '0'), 62, cy, 20, P.parchment, 'left', 700);
    text('Rekord', 200, cy, 14, dimText);
    text(String(bestScore()).padStart(6, '0'), 254, cy, 20, '#c9b8e8', 'left', 700);
    text('Fala', 408, cy, 14, dimText);
    text(String(g.wave), 444, cy, 20, P.gold, 'left', 700);

    const shown = Math.min(g.lives, 5);
    for (let i = 0; i < shown; i++) sprite(Sprites.player, 560 + i * 26, 12, 0.5);
    if (g.lives > 5) text('×' + g.lives, 560 + 5 * 26, cy, 16, P.parchment);
    text(Sfx.isMuted() ? '♪ wył.' : '♪', C.width - 14, cy, 16, Sfx.isMuted() ? '#6a5a9a' : P.parchment, 'right');

    const by = bottomY + C.hudBottom / 2 + 1;
    const lowAmmo = g.ammo <= 5;
    const ammoColor = lowAmmo ? '#ff5a7a' : '#c9a2ff';
    text('Amunicja', 12, by, 14, lowAmmo && Math.floor(time * 4) % 2 ? '#ff5a7a' : dimText);
    bar(78, by - 5, 96, 10, g.ammo / C.ammo.max, ammoColor, 8);
    text(g.ammo + '/' + C.ammo.max, 182, by, 14, P.parchment);

    text('Mana', 240, by, 14, dimText);
    bar(278, by - 5, 96, 10, g.mana / C.mana.max, '#4aa8ff', 4);

    let x = 402;
    C.spells.forEach((s, i) => {
      const locked = s.unlockWave > g.wave;
      const active = i === g.spellIndex;
      const label = (i + 1) + ' ' + (locked ? '🔒' : s.short);
      ctx.font = '400 14px ' + FONT;
      const w = ctx.measureText(label).width + 14;
      if (active) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glowAt(s.color, x - 4 + w / 2, by, w * 0.7, 0.35);
        ctx.restore();
        ctx.strokeStyle = P.gold;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4.5, by - 10.5, w, 20);
      }
      const affordable = L.canCast(s, g);
      text(label, x + 3, by, 14, locked ? '#4a3f7a' : affordable ? s.color : '#7a6a9a');
      x += w + 6;
    });
  }

  function drawBannerAndMessage() {
    const g = game;
    if (g.banner > 0) {
      const a = Math.min(1, g.banner * 1.5);
      const rise = (1 - g.banner / C.waves.bannerTime) * 10;
      ctx.globalAlpha = a;
      title('Fala ' + g.wave, C.width / 2, 262 - rise, 80);
      if (g.bannerSub) text(g.bannerSub, C.width / 2, 318 - rise, 20, P.parchment, 'center');
      ctx.globalAlpha = 1;
    }
    if (g.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, g.messageTimer * 2);
      text(g.message, C.width / 2, 425, 18, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function dim(alpha) {
    ctx.fillStyle = 'rgba(7, 4, 15, ' + alpha + ')';
    ctx.fillRect(0, 0, C.width, C.height);
  }

  function blink() {
    return Math.floor(time * 2) % 2 === 0;
  }

  function drawMenu() {
    title('Arcane Invaders', C.width / 2, 112, 92);
    text('Obroń wieżę maga przed demonami z kręgu przywołania', C.width / 2, 172, 19, '#c9b8e8', 'center');

    const types = Object.keys(C.enemyTypes);
    types.forEach((type, i) => {
      const t = C.enemyTypes[type];
      const y = 212 + i * 44;
      sprite(Sprites.enemies[type].frames[Math.floor(time * 2) % 2], 270, y);
      text(t.name, 326, y + 14, 20, t.color);
      text(t.hp + ' HP   ' + t.points + ' pkt', 440, y + 14, 20, P.parchment);
    });

    const lines = [
      '← →  /  A D   ruch maga (przez krawędź na drugą stronę)',
      'Spacja   rzuć zaklęcie (pocisk zużywa amunicję)',
      '1–4  /  Q E   wybór zaklęcia (nowe co falę)',
      'P / Esc   pauza      M   dźwięk',
    ];
    lines.forEach((l, i) => text(l, C.width / 2, 364 + i * 26, 17, '#c9bdf0', 'center'));

    if (blink()) text('Enter – zacznij grę', C.width / 2, 490, 28, P.gold, 'center', 700);
    text('R – ranking      Rekord: ' + bestScore(), C.width / 2, 590, 16, '#9d8cc4', 'center');
  }

  function drawPause() {
    dim(0.6);
    title('Pauza', C.width / 2, 250, 84);
    text('P / Esc – wznów      Q – wyjdź do menu', C.width / 2, 320, 20, '#c9bdf0', 'center');
  }

  function drawGameOver() {
    dim(0.65);
    title('Koniec gry', C.width / 2, 215, 84, ['#ffd0c0', '#ff6a5a', '#9a1f3a']);
    text('Wynik: ' + game.score + '     Fala: ' + game.wave, C.width / 2, 290, 24, P.parchment, 'center');
    if (blink()) text('Enter – zagraj ponownie', C.width / 2, 360, 24, P.gold, 'center');
    text('Esc – menu     R – ranking', C.width / 2, 400, 18, '#9d8cc4', 'center');
  }

  function drawEnterName() {
    dim(0.7);
    title('Nowy rekord!', C.width / 2, 195, 80);
    text('Wynik: ' + game.score + '     Fala: ' + game.wave, C.width / 2, 260, 22, P.parchment, 'center');
    text('Wpisz swoje imię:', C.width / 2, 320, 20, '#c9bdf0', 'center');
    ctx.fillStyle = '#140c2c';
    ctx.fillRect(C.width / 2 - 150, 345, 300, 44);
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1;
    ctx.strokeRect(C.width / 2 - 150.5, 344.5, 300, 44);
    text(nameBuffer + (blink() ? '_' : ' '), C.width / 2, 368, 26, '#ffffff', 'center');
    text('Enter – zapisz', C.width / 2, 420, 18, '#9d8cc4', 'center');
  }

  function drawRanking() {
    dim(0.45);
    title('Ranking', C.width / 2, 70, 72);
    if (!highscores.length) {
      text('Brak wyników – zagraj pierwszy!', C.width / 2, 280, 22, '#c9bdf0', 'center');
    } else {
      text('#', 180, 125, 16, '#8a7ab4');
      text('Imię', 220, 125, 16, '#8a7ab4');
      text('Wynik', 520, 125, 16, '#8a7ab4', 'right');
      text('Fala', 610, 125, 16, '#8a7ab4', 'right');
      highscores.forEach((h, i) => {
        const y = 160 + i * 34;
        const hl = i === lastRank;
        if (hl) {
          ctx.fillStyle = Sprites.rgba(P.gold, 0.14);
          ctx.fillRect(165, y - 15, 470, 30);
        }
        const color = hl ? '#fff1c4' : i === 0 ? P.gold : P.parchment;
        text(String(i + 1), 180, y, 20, color);
        text(h.name, 220, y, 20, color);
        text(String(h.score), 520, y, 20, color, 'right');
        text(String(h.wave || '-'), 610, y, 20, color, 'right');
      });
    }
    text('Enter / Esc – menu', C.width / 2, 560, 18, '#9d8cc4', 'center');
  }

  function render() {
    ctx.drawImage(Sprites.sky, 0, 0);

    const inGame = game && state !== 'menu' && state !== 'ranking';
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 24 * shake, (Math.random() - 0.5) * 24 * shake);
    drawBackground(inGame ? 0.7 : 1);
    if (inGame) drawWorld();
    else if (state === 'menu') drawMage((C.width - C.player.width) / 2, C.player.y);
    drawParticles();
    ctx.restore();
    ctx.drawImage(Sprites.vignette, 0, 0);

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
    // Pierwszy znacznik z requestAnimationFrame bywa wcześniejszy niż performance.now() z chwili startu.
    let dt = Math.max(0, (now - last) / 1000);
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
      sigilPulse = Math.max(0, sigilPulse - dt * 1.5);
      if (state === 'playing' && game.banner > 0) sigilPulse = Math.max(sigilPulse, game.banner / C.waves.bannerTime);
    }

    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

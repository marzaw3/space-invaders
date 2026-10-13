// Czysta logika gry (bez DOM) - używana przez game.js i testy w Node.
(function (root) {
  'use strict';

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------- gracz ----------

  // Zawijanie przy ścianie: gdy środek maga wyjdzie za krawędź, mag pojawia się po drugiej stronie.
  function wrapX(x, w, width) {
    const center = (((x + w / 2) % width) + width) % width;
    return center - w / 2;
  }

  // Kopie prostokąta przesunięte o szerokość planszy - potrzebne, gdy mag stoi okrakiem na krawędzi.
  function wrappedRects(rect, width) {
    const rects = [rect];
    if (rect.x < 0) rects.push(Object.assign({}, rect, { x: rect.x + width }));
    if (rect.x + rect.w > width) rects.push(Object.assign({}, rect, { x: rect.x - width }));
    return rects;
  }

  // ---------- wrogowie ----------

  function enemyHp(type, wave, cfg) {
    return cfg.enemyTypes[type].hp + Math.floor((wave - 1) / cfg.waves.hpBonusEvery);
  }

  function formationStartY(wave, cfg) {
    return cfg.formation.startY + Math.min((wave - 1) * cfg.waves.startYStep, cfg.waves.startYMaxOffset);
  }

  function createFormation(wave, cfg) {
    const f = cfg.formation;
    const left = (cfg.width - f.cols * f.cellW) / 2;
    const top = formationStartY(wave, cfg);
    const enemies = [];
    f.rows.forEach((type, row) => {
      for (let col = 0; col < f.cols; col++) {
        const hp = enemyHp(type, wave, cfg);
        enemies.push({
          type, row, col,
          x: left + col * f.cellW + (f.cellW - f.enemyW) / 2,
          y: top + row * f.cellH,
          w: f.enemyW,
          h: f.enemyH,
          hp,
          maxHp: hp,
          points: cfg.enemyTypes[type].points,
          alive: true,
          flash: 0,
        });
      }
    });
    return { enemies, total: enemies.length, dir: 1, slowTimer: 0, slowFactor: 1 };
  }

  function aliveCount(enemies) {
    let n = 0;
    for (const e of enemies) if (e.alive) n++;
    return n;
  }

  // Im mniej wrogów i im dalsza fala, tym szybciej się poruszają.
  function formationSpeed(alive, total, wave, cfg) {
    const f = cfg.formation;
    const thinning = total > 0 ? 1 - alive / total : 0;
    return f.baseSpeed * Math.pow(cfg.waves.speedGrowth, wave - 1) * (1 + thinning * (f.maxSpeedMultiplier - 1));
  }

  // Przesuwa formację; na krawędzi schodzi w dół i zawraca. Zwraca true, jeśli zeszła w dół.
  function stepFormation(formation, wave, dt, cfg) {
    const alive = formation.enemies.filter(e => e.alive);
    if (alive.length === 0) return false;

    let speed = formationSpeed(alive.length, formation.total, wave, cfg);
    if (formation.slowTimer > 0) {
      speed *= formation.slowFactor;
      formation.slowTimer = Math.max(0, formation.slowTimer - dt);
    }

    let minX = Infinity, maxX = -Infinity;
    for (const e of alive) {
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x + e.w);
    }

    const margin = cfg.formation.sideMargin;
    let shift = formation.dir * speed * dt;
    let stepped = false;
    if (minX + shift < margin) {
      shift = margin - minX;
      stepped = true;
    } else if (maxX + shift > cfg.width - margin) {
      shift = cfg.width - margin - maxX;
      stepped = true;
    }

    for (const e of formation.enemies) {
      e.x += shift;
      if (stepped) e.y += cfg.formation.stepDown;
    }
    if (stepped) formation.dir *= -1;
    return stepped;
  }

  function enemyFireInterval(wave, cfg) {
    const ef = cfg.enemyFire;
    return Math.max(ef.minInterval, ef.baseInterval * Math.pow(cfg.waves.fireGrowth, wave - 1));
  }

  // Strzelać może tylko najniższy żywy wróg w każdej kolumnie.
  function pickShooters(enemies) {
    const byCol = new Map();
    for (const e of enemies) {
      if (!e.alive) continue;
      const cur = byCol.get(e.col);
      if (!cur || e.y > cur.y) byCol.set(e.col, e);
    }
    return Array.from(byCol.values());
  }

  // Zwraca true, jeśli wróg zginął.
  function damageEnemy(enemy, amount) {
    if (!enemy.alive) return false;
    enemy.hp -= amount;
    enemy.flash = 0.08;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      return true;
    }
    return false;
  }

  function enemiesInRadius(enemies, cx, cy, r) {
    return enemies.filter(e => {
      if (!e.alive) return false;
      const nx = Math.max(e.x, Math.min(cx, e.x + e.w));
      const ny = Math.max(e.y, Math.min(cy, e.y + e.h));
      return (nx - cx) ** 2 + (ny - cy) ** 2 <= r * r;
    });
  }

  function reachedLine(enemies, lineY) {
    return enemies.some(e => e.alive && e.y + e.h >= lineY);
  }

  // ---------- bariery ----------

  const BARRIER_SHAPE = [
    '..XXXXXXX..',
    '.XXXXXXXXX.',
    'XXXXXXXXXXX',
    'XXXX...XXXX',
    'XXX.....XXX',
  ];

  function createBarriers(cfg) {
    const b = cfg.barriers;
    const shapeW = BARRIER_SHAPE[0].length * b.cell;
    const gap = (cfg.width - b.count * shapeW) / (b.count + 1);
    const cells = [];
    for (let i = 0; i < b.count; i++) {
      const left = gap + i * (shapeW + gap);
      BARRIER_SHAPE.forEach((line, row) => {
        for (let col = 0; col < line.length; col++) {
          if (line[col] !== 'X') continue;
          cells.push({ x: left + col * b.cell, y: b.y + row * b.cell, w: b.cell, h: b.cell, alive: true });
        }
      });
    }
    return cells;
  }

  // Niszczy jedną komórkę trafioną przez rect; zwraca ją albo null.
  function hitBarrier(cells, rect) {
    for (const c of cells) {
      if (c.alive && rectsOverlap(c, rect)) {
        c.alive = false;
        return c;
      }
    }
    return null;
  }

  // Wrogowie, którzy zeszli na bariery, niszczą je.
  function erodeBarriers(cells, enemies) {
    let destroyed = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      for (const c of cells) {
        if (c.alive && rectsOverlap(c, e)) {
          c.alive = false;
          destroyed++;
        }
      }
    }
    return destroyed;
  }

  // ---------- zaklęcia, amunicja, mana ----------

  function unlockedSpells(wave, spells) {
    return spells.filter(s => s.unlockWave <= wave);
  }

  function canCast(spell, res) {
    return (spell.cost.ammo || 0) <= res.ammo && (spell.cost.mana || 0) <= res.mana;
  }

  function payCost(spell, res) {
    res.ammo -= spell.cost.ammo || 0;
    res.mana -= spell.cost.mana || 0;
  }

  function regenAmmo(res, dt, cfg) {
    if (res.ammo >= cfg.ammo.max) {
      res.ammoTimer = 0;
      return;
    }
    res.ammoTimer += dt;
    while (res.ammoTimer >= cfg.ammo.regenInterval && res.ammo < cfg.ammo.max) {
      res.ammoTimer -= cfg.ammo.regenInterval;
      res.ammo++;
    }
  }

  // ---------- punkty i ranking ----------

  function extraLivesEarned(prevScore, newScore, every) {
    return Math.floor(newScore / every) - Math.floor(prevScore / every);
  }

  function waveClearBonus(wave, cfg) {
    return cfg.waves.clearBonus * wave;
  }

  function qualifiesForHighscore(list, score, size) {
    if (score <= 0) return false;
    return list.length < size || score > list[list.length - 1].score;
  }

  function insertHighscore(list, entry, size) {
    return list.concat([entry]).sort((a, b) => b.score - a.score).slice(0, size);
  }

  function sanitizeName(raw, maxLength) {
    const name = String(raw || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, maxLength);
    return name || 'MAG';
  }

  // ---------- konto gracza ----------

  // Nick: litery (także polskie), cyfry 0-9, _ i -. Baza sprawdza to samo (profiles.nick).
  function validateNick(raw, cfg) {
    const nick = String(raw || '').trim();
    if (nick.length < cfg.account.nickMinLength) return { ok: false, error: 'too_short' };
    if (nick.length > cfg.account.nickMaxLength) return { ok: false, error: 'too_long' };
    if (!/^[\p{L}0-9_-]+$/u.test(nick)) return { ok: false, error: 'bad_chars' };
    return { ok: true, nick };
  }

  // Techniczny e-mail konta: 'u' + hex bajtów UTF-8 nicka małymi literami. Hex przenosi polskie litery
  // przez e-mail bez strat, a małe litery sprawiają, że Merlin i merlin to to samo konto.
  function nickToEmail(nick, cfg) {
    const bytes = new TextEncoder().encode(String(nick).toLowerCase());
    return 'u' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') + '@' + cfg.account.emailDomain;
  }

  function validatePassword(raw, cfg) {
    return String(raw || '').length >= cfg.account.passwordMinLength ? { ok: true } : { ok: false, error: 'too_short' };
  }

  // ---------- stan gry, zapis i wznowienie ----------

  // Podnieś, gdy zmieni się format migawki - starsze zapisy zostaną zignorowane.
  const SAVE_VERSION = 1;

  // Stan przed pierwszą falą; formację i bariery tworzy dopiero start fali.
  function createGame(cfg) {
    return {
      score: 0,
      lives: cfg.player.lives,
      wave: 0,
      player: { x: (cfg.width - cfg.player.width) / 2, y: cfg.player.y, w: cfg.player.width, h: cfg.player.height, invuln: 0, cooldown: 0 },
      ammo: cfg.ammo.max,
      ammoTimer: 0,
      mana: cfg.mana.max,
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
  }

  // Migawka do zapisu w bazie: tylko stan rozgrywki, bez pocisków w locie i komunikatów.
  function snapshotGame(g) {
    const copy = v => JSON.parse(JSON.stringify(v));
    return {
      score: g.score,
      lives: g.lives,
      wave: g.wave,
      playerX: g.player.x,
      ammo: g.ammo,
      ammoTimer: g.ammoTimer,
      mana: g.mana,
      spellIndex: g.spellIndex,
      enemyFireTimer: g.enemyFireTimer,
      formation: copy(g.formation),
      barriers: copy(g.barriers),
    };
  }

  // Odtwarza grę z migawki; zwraca null, gdy wersja się nie zgadza albo dane są uszkodzone.
  function restoreGame(data, version, cfg) {
    if (version !== SAVE_VERSION || !data || typeof data !== 'object') return null;
    const numbers = ['score', 'lives', 'wave', 'playerX', 'ammo', 'ammoTimer', 'mana', 'spellIndex', 'enemyFireTimer'];
    if (!numbers.every(k => typeof data[k] === 'number' && Number.isFinite(data[k]))) return null;
    if (data.lives < 1 || data.wave < 1 || !cfg.spells[data.spellIndex]) return null;
    const f = data.formation;
    if (!f || !Array.isArray(f.enemies) || !Array.isArray(data.barriers)) return null;

    const g = createGame(cfg);
    g.score = data.score;
    g.lives = data.lives;
    g.wave = data.wave;
    g.player.x = data.playerX;
    g.ammo = data.ammo;
    g.ammoTimer = data.ammoTimer;
    g.mana = data.mana;
    g.spellIndex = data.spellIndex;
    g.enemyFireTimer = data.enemyFireTimer;
    g.formation = f;
    g.barriers = data.barriers;
    return g;
  }

  const Logic = {
    rectsOverlap,
    wrapX, wrappedRects,
    enemyHp, formationStartY, createFormation, aliveCount, formationSpeed, stepFormation,
    enemyFireInterval, pickShooters, damageEnemy, enemiesInRadius, reachedLine,
    BARRIER_SHAPE, createBarriers, hitBarrier, erodeBarriers,
    unlockedSpells, canCast, payCost, regenAmmo,
    extraLivesEarned, waveClearBonus, qualifiesForHighscore, insertHighscore, sanitizeName,
    validateNick, nickToEmail, validatePassword,
    SAVE_VERSION, createGame, snapshotGame, restoreGame,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(this);

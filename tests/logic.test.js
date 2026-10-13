// Testy czystej logiki gry. Uruchomienie (w katalogu projektu): node --test
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/config.js');
const L = require('../js/logic.js');

// ---------- zawijanie przy ścianie ----------

test('wrapX: w środku planszy pozycja się nie zmienia', () => {
  assert.equal(L.wrapX(300, 39, C.width), 300);
});

test('wrapX: wyjście w lewo przenosi maga na prawą stronę', () => {
  const x = L.wrapX(-25, 39, C.width);
  assert.equal(x, -25 + C.width);
  assert.ok(x + 39 / 2 < C.width);
});

test('wrapX: wyjście w prawo przenosi maga na lewą stronę', () => {
  const x = L.wrapX(C.width - 10, 39, C.width);
  assert.equal(x, -10);
  assert.ok(x + 39 / 2 >= 0);
});

test('wrapX: dopóki środek jest na planszy, mag może częściowo wystawać za krawędź', () => {
  assert.equal(L.wrapX(-15, 39, C.width), -15);
  assert.equal(L.wrapX(C.width - 25, 39, C.width), C.width - 25);
});

test('wrappedRects: prostokąt na krawędzi ma kopię po drugiej stronie', () => {
  assert.equal(L.wrappedRects({ x: 100, y: 0, w: 20, h: 10 }, C.width).length, 1);
  const left = L.wrappedRects({ x: -5, y: 0, w: 20, h: 10 }, C.width);
  assert.deepEqual(left.map(r => r.x), [-5, C.width - 5]);
  const right = L.wrappedRects({ x: C.width - 5, y: 0, w: 20, h: 10 }, C.width);
  assert.deepEqual(right.map(r => r.x), [C.width - 5, -5]);
});

test('wrappedRects: pocisk trafia maga wystającego z drugiej strony', () => {
  const hitbox = { x: C.width - 10, y: 500, w: 27, h: 24 };
  const bullet = { x: 5, y: 505, w: 4, h: 12 };
  assert.ok(L.wrappedRects(hitbox, C.width).some(r => L.rectsOverlap(bullet, r)));
});

// ---------- wrogowie ----------

test('HP wrogów: Imp 1, Szkielet 2, Widmo 3, +1 co 4 fale', () => {
  assert.equal(L.enemyHp('imp', 1, C), 1);
  assert.equal(L.enemyHp('skeleton', 1, C), 2);
  assert.equal(L.enemyHp('wraith', 1, C), 3);
  assert.equal(L.enemyHp('imp', 4, C), 1);
  assert.equal(L.enemyHp('imp', 5, C), 2);
  assert.equal(L.enemyHp('wraith', 9, C), 5);
});

test('formacja: 4 rzędy x 8 kolumn, górny rząd to Widma', () => {
  const f = L.createFormation(1, C);
  assert.equal(f.enemies.length, 32);
  assert.ok(f.enemies.filter(e => e.row === 0).every(e => e.type === 'wraith'));
  assert.ok(f.enemies.filter(e => e.row === 3).every(e => e.type === 'imp'));
});

test('formacja przyspiesza, gdy ubywa wrogów, i z każdą falą', () => {
  const full = L.formationSpeed(32, 32, 1, C);
  const half = L.formationSpeed(16, 32, 1, C);
  const last = L.formationSpeed(1, 32, 1, C);
  assert.ok(half > full && last > half);
  assert.ok(L.formationSpeed(32, 32, 3, C) > full);
});

test('formacja na krawędzi schodzi w dół i zawraca', () => {
  const f = L.createFormation(1, C);
  const y0 = f.enemies[0].y;
  let stepped = false;
  for (let i = 0; i < 2000 && !stepped; i++) stepped = L.stepFormation(f, 1, 1 / 60, C);
  assert.ok(stepped);
  assert.equal(f.dir, -1);
  assert.equal(f.enemies[0].y, y0 + C.formation.stepDown);
  const maxX = Math.max(...f.enemies.map(e => e.x + e.w));
  assert.ok(maxX <= C.width - C.formation.sideMargin + 1e-9);
});

test('damageEnemy: zabija dopiero po wyczerpaniu HP', () => {
  const e = { hp: 2, alive: true, flash: 0 };
  assert.equal(L.damageEnemy(e, 1), false);
  assert.equal(e.alive, true);
  assert.equal(L.damageEnemy(e, 1), true);
  assert.equal(e.alive, false);
  assert.equal(L.damageEnemy(e, 1), false);
});

test('strzelać mogą tylko najniżsi żywi wrogowie w kolumnach', () => {
  const f = L.createFormation(1, C);
  let shooters = L.pickShooters(f.enemies);
  assert.equal(shooters.length, 8);
  assert.ok(shooters.every(e => e.row === 3));
  f.enemies.find(e => e.row === 3 && e.col === 0).alive = false;
  shooters = L.pickShooters(f.enemies);
  assert.equal(shooters.find(e => e.col === 0).row, 2);
});

test('enemiesInRadius: obszar ognistej kuli', () => {
  const enemies = [
    { x: 100, y: 100, w: 10, h: 10, alive: true },
    { x: 140, y: 100, w: 10, h: 10, alive: true },
    { x: 300, y: 100, w: 10, h: 10, alive: true },
    { x: 105, y: 120, w: 10, h: 10, alive: false },
  ];
  assert.equal(L.enemiesInRadius(enemies, 105, 105, 55).length, 2);
});

test('reachedLine: przegrana, gdy wróg dojdzie do linii gracza', () => {
  const e = { y: 500, h: 27, alive: true };
  assert.equal(L.reachedLine([e], C.player.y), false);
  e.y = C.player.y - 20;
  assert.equal(L.reachedLine([e], C.player.y), true);
  e.alive = false;
  assert.equal(L.reachedLine([e], C.player.y), false);
});

test('częstotliwość strzałów wrogów rośnie z falą, ale ma dolny limit', () => {
  assert.ok(L.enemyFireInterval(2, C) < L.enemyFireInterval(1, C));
  assert.equal(L.enemyFireInterval(100, C), C.enemyFire.minInterval);
});

// ---------- bariery ----------

test('bariery: pocisk niszczy jedną komórkę', () => {
  const cells = L.createBarriers(C);
  const perBarrier = L.BARRIER_SHAPE.join('').split('').filter(ch => ch === 'X').length;
  assert.equal(cells.length, C.barriers.count * perBarrier);
  const target = cells[0];
  const hit = L.hitBarrier(cells, { x: target.x + 1, y: target.y + 1, w: 2, h: 2 });
  assert.equal(hit, target);
  assert.equal(target.alive, false);
  assert.equal(L.hitBarrier(cells, { x: target.x + 1, y: target.y + 1, w: 2, h: 2 }), null);
});

test('bariery: wróg, który na nie zejdzie, je niszczy', () => {
  const cells = L.createBarriers(C);
  const c = cells[5];
  const n = L.erodeBarriers(cells, [{ x: c.x, y: c.y, w: 8, h: 8, alive: true }]);
  assert.ok(n >= 1);
  assert.equal(c.alive, false);
});

// ---------- amunicja, mana, zaklęcia ----------

test('amunicja: limit 40, pocisk kosztuje 1 szt.', () => {
  const bolt = C.spells.find(s => s.id === 'bolt');
  const res = { ammo: C.ammo.max, mana: 0, ammoTimer: 0 };
  assert.equal(res.ammo, 40);
  for (let i = 0; i < 40; i++) {
    assert.ok(L.canCast(bolt, res));
    L.payCost(bolt, res);
  }
  assert.equal(res.ammo, 0);
  assert.equal(L.canCast(bolt, res), false);
});

test('amunicja: regeneracja 1 szt. co 0,8 s, nie ponad limit', () => {
  const res = { ammo: 0, ammoTimer: 0 };
  L.regenAmmo(res, 0.79, C);
  assert.equal(res.ammo, 0);
  L.regenAmmo(res, 0.02, C);
  assert.equal(res.ammo, 1);
  L.regenAmmo(res, 8, C);
  assert.equal(res.ammo, 11);
  L.regenAmmo(res, 1000, C);
  assert.equal(res.ammo, C.ammo.max);
});

test('zaklęcia specjalne kosztują manę, nie amunicję', () => {
  for (const s of C.spells.filter(s => s.id !== 'bolt')) {
    assert.ok(s.cost.mana > 0);
    assert.ok(!s.cost.ammo);
    const res = { ammo: 0, mana: s.cost.mana };
    assert.ok(L.canCast(s, res));
    assert.equal(L.canCast(s, { ammo: 40, mana: s.cost.mana - 1 }), false);
  }
});

test('zaklęcia odblokowują się z kolejnymi falami', () => {
  assert.deepEqual(L.unlockedSpells(1, C.spells).map(s => s.id), ['bolt']);
  assert.equal(L.unlockedSpells(2, C.spells).length, 2);
  assert.equal(L.unlockedSpells(4, C.spells).length, 4);
});

// ---------- punkty i ranking ----------

test('dodatkowe życie co 10 000 punktów', () => {
  assert.equal(L.extraLivesEarned(9990, 10010, 10000), 1);
  assert.equal(L.extraLivesEarned(10010, 10500, 10000), 0);
  assert.equal(L.extraLivesEarned(9990, 20010, 10000), 2);
});

test('bonus za falę rośnie z numerem fali', () => {
  assert.equal(L.waveClearBonus(1, C), 100);
  assert.equal(L.waveClearBonus(3, C), 300);
});

test('ranking: top 10, posortowany malejąco', () => {
  let list = [];
  for (let i = 1; i <= 12; i++) list = L.insertHighscore(list, { name: 'M' + i, score: i * 100 }, 10);
  assert.equal(list.length, 10);
  assert.equal(list[0].score, 1200);
  assert.equal(list[9].score, 300);
  assert.equal(L.qualifiesForHighscore(list, 250, 10), false);
  assert.equal(L.qualifiesForHighscore(list, 350, 10), true);
  assert.equal(L.qualifiesForHighscore([], 0, 10), false);
});

test('sanitizeName: obcina, czyści i ma wartość domyślną', () => {
  assert.equal(L.sanitizeName('Żaneta<script>', 10), 'Żanetascri');
  assert.equal(L.sanitizeName('   ', 10), 'MAG');
  assert.equal(L.sanitizeName(null, 10), 'MAG');
});

// ---------- zapis i wznowienie gry ----------

// Gra w trakcie fali: część wrogów i barier zniszczona, pociski w locie.
function midGame() {
  const g = L.createGame(C);
  g.wave = 3;
  g.formation = L.createFormation(3, C);
  g.barriers = L.createBarriers(C);
  g.score = 1230;
  g.lives = 2;
  g.ammo = 17;
  g.ammoTimer = 0.3;
  g.mana = 42.5;
  g.spellIndex = 2;
  g.enemyFireTimer = 0.9;
  g.player.x = 123;
  g.formation.dir = -1;
  g.formation.slowTimer = 1.5;
  g.formation.slowFactor = 0.4;
  g.formation.enemies.forEach(e => { e.x += 7; e.y += 18; });
  L.damageEnemy(g.formation.enemies[0], 99);
  L.damageEnemy(g.formation.enemies[1], 1);
  g.barriers[5].alive = false;
  g.bullets.push({ x: 1, y: 2, spell: C.spells[0], hit: new Set() });
  g.enemyBullets.push({ x: 3, y: 4, w: 4, h: 12 });
  g.message = 'Za mało many!';
  g.messageTimer = 1;
  return g;
}

// Tak jak w prawdziwym zapisie: migawka przechodzi przez JSON (baza danych).
function throughJson(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

test('createGame: nowa gra z wartościami z konfiguracji', () => {
  const g = L.createGame(C);
  assert.equal(g.score, 0);
  assert.equal(g.lives, C.player.lives);
  assert.equal(g.wave, 0);
  assert.equal(g.ammo, C.ammo.max);
  assert.equal(g.mana, C.mana.max);
  assert.equal(g.player.y, C.player.y);
  assert.deepEqual(g.bullets, []);
});

test('zapis gry: odtworzona gra ma ten sam stan rozgrywki', () => {
  const g = midGame();
  const r = L.restoreGame(throughJson(L.snapshotGame(g)), L.SAVE_VERSION, C);
  assert.ok(r);
  for (const k of ['score', 'lives', 'wave', 'ammo', 'ammoTimer', 'mana', 'spellIndex', 'enemyFireTimer']) {
    assert.equal(r[k], g[k], k);
  }
  assert.equal(r.player.x, 123);
  assert.equal(r.player.y, C.player.y);
  assert.equal(r.formation.dir, -1);
  assert.equal(r.formation.slowTimer, 1.5);
  assert.equal(r.formation.total, g.formation.total);
  assert.deepEqual(
    r.formation.enemies.map(e => [e.x, e.y, e.hp, e.alive]),
    g.formation.enemies.map(e => [e.x, e.y, e.hp, e.alive]));
  assert.deepEqual(r.barriers.map(c => c.alive), g.barriers.map(c => c.alive));
});

test('zapis gry: pociski w locie i komunikaty nie są zapisywane', () => {
  const r = L.restoreGame(throughJson(L.snapshotGame(midGame())), L.SAVE_VERSION, C);
  assert.deepEqual(r.bullets, []);
  assert.deepEqual(r.enemyBullets, []);
  assert.equal(r.messageTimer, 0);
  assert.equal(r.banner, 0);
});

test('zapis gry: migawka mieści się z zapasem w limicie bazy (128 KB)', () => {
  const size = JSON.stringify(L.snapshotGame(midGame())).length;
  assert.ok(size < 32 * 1024, 'rozmiar migawki: ' + size);
});

test('zapis gry: migawka nie dzieli obiektów z grą', () => {
  const g = midGame();
  const s = L.snapshotGame(g);
  g.formation.enemies[5].hp = 0;
  g.barriers[0].alive = false;
  assert.notEqual(s.formation.enemies[5].hp, 0);
  assert.equal(s.barriers[0].alive, true);
});

test('zapis gry: nieznana wersja lub uszkodzone dane są odrzucane', () => {
  const ok = throughJson(L.snapshotGame(midGame()));
  assert.equal(L.restoreGame(ok, L.SAVE_VERSION + 1, C), null);
  assert.equal(L.restoreGame(null, L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame('tekst', L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame(Object.assign({}, ok, { score: 'dużo' }), L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame(Object.assign({}, ok, { lives: 0 }), L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame(Object.assign({}, ok, { wave: 0 }), L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame(Object.assign({}, ok, { spellIndex: 99 }), L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame(Object.assign({}, ok, { formation: {} }), L.SAVE_VERSION, C), null);
  assert.equal(L.restoreGame(Object.assign({}, ok, { barriers: null }), L.SAVE_VERSION, C), null);
});

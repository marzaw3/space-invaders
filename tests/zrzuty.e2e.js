// Test E2E Hexfall (Playwright): przechodzi przez kluczowe ekrany gościa i zapisuje zrzuty do tests/zrzuty/.
//
// Uruchomienie (w katalogu projektu):  npm install   (raz)   ->   npm run test:e2e
// Domyślnie testuje wersję na GitHub Pages; inny adres: HEXFALL_URL=http://127.0.0.1:8765/ npm run test:e2e
// Playwright używa zainstalowanego Chrome (bez pobierania własnej przeglądarki); inny kanał: PW_CHANNEL=msedge.
//
// Uwaga: test gra jako gość na prawdziwej bazie - tworzy anonimowe konto; zapis gry kasuje na koniec.
// Zrzuty różnią się między uruchomieniami (gwiazdy, cząsteczki, pociski, rekord z rankingu na żywo).
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const URL = process.env.HEXFALL_URL || 'https://marzaw3.github.io/space-invaders/';
const CHANNEL = process.env.PW_CHANNEL || 'chrome';
const OUT_DIR = path.join(__dirname, 'zrzuty');

// Pas płótna (jednostki gry 800×600), w którym miga złoty napis "Enter – zacznij grę" / "C – kontynuuj grę".
const BLINK_BAND = { x: 200, y: 468, w: 400, h: 40 };

// Czeka na początek fazy, w której migający napis jest widoczny (zostaje ~0,5 s na zrzut).
// Zwraca false, gdy w pasie nic nie miga - czyli napisu nie ma.
function waitForBlinkOn(page) {
  return page.evaluate(async band => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const k = canvas.width / 800;
    const gold = () => {
      const d = ctx.getImageData(band.x * k, band.y * k, band.w * k, band.h * k).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 170 && d[i + 1] < 215 && d[i + 2] < 140) n++;
      return n;
    };
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 1100) { await frame(); samples.push(gold()); }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    if (max - min < 50) return false;
    const threshold = (min + max) / 2;
    let wasOff = false;
    const t1 = performance.now();
    while (performance.now() - t1 < 3000) {
      await frame();
      const n = gold();
      if (n <= threshold) wasOff = true;
      else if (wasOff) return true;
    }
    return false;
  }, BLINK_BAND);
}

const isSaveRequest = method => r => r.url().includes('/rest/v1/saved_games') && r.request().method() === method;

describe('Hexfall – ekrany gościa', () => {
  let browser;
  let page;
  const pageErrors = [];
  const authRequests = [];

  const shot = name => page.screenshot({ path: path.join(OUT_DIR, name) });

  before(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    browser = await chromium.launch({ channel: CHANNEL, headless: true });
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, locale: 'pl-PL' });
    page = await context.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('request', r => { if (r.url().includes('/auth/v1/')) authRequests.push(r.url()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
  });

  after(async () => {
    // Nie zostawiamy przerwanej gry na koncie testowego gościa.
    if (page) await page.evaluate(() => window.Cloud && window.Cloud.deleteSave()).catch(() => {});
    if (browser) await browser.close();
  });

  it('01 menu gościa: gra się wczytuje, miga "Enter – zacznij grę"', async () => {
    assert.ok(await waitForBlinkOn(page), 'brak migającego napisu w menu');
    assert.equal(await page.locator('#account').isHidden(), true);
    await shot('01-menu-gosc.png');
  });

  it('02 okno konta: zły nick zatrzymuje walidacja, bez wysyłania do serwera', async () => {
    const authBefore = authRequests.length;
    await page.keyboard.press('KeyL');
    const nick = page.locator('#account input[name=nick]');
    await nick.waitFor({ state: 'visible' });
    assert.equal(await nick.inputValue(), '', 'klawisz L nie może wpisać się w pole nicka');
    await page.keyboard.type('ab');
    await page.keyboard.press('Enter');
    const error = page.locator('.account-error');
    await error.filter({ hasText: 'Nick' }).waitFor();
    assert.match(await error.textContent(), /^Nick: 3–10 znaków/);
    assert.equal(authRequests.length, authBefore, 'walidacja nie powinna wołać Supabase Auth');
    await shot('02-konto-walidacja.png');

    await page.keyboard.press('Escape');
    await page.locator('#account').waitFor({ state: 'hidden' });
  });

  it('03 rozgrywka: start fali 1 zapisuje grę w chmurze, HUD po banerze', async () => {
    const saved = page.waitForResponse(isSaveRequest('POST'));
    await page.keyboard.press('Enter'); // od razu po zamknięciu okna konta - klawisz musi dojść do gry
    const response = await saved;
    assert.ok(response.ok(), 'zapis gry w chmurze: HTTP ' + response.status());
    await page.waitForTimeout(2600);
    await shot('03-rozgrywka-hud.png');
  });

  it('04 pauza', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shot('04-pauza.png');
  });

  it('05 zapis w chmurze przetrwa przeładowanie: menu proponuje "C – kontynuuj grę"', async () => {
    await page.keyboard.press('KeyQ');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const loaded = page.waitForResponse(isSaveRequest('GET'));
    await page.reload({ waitUntil: 'networkidle' });
    const body = await (await loaded).json();
    const save = Array.isArray(body) ? body[0] : body;
    assert.ok(save, 'po przeładowaniu brak zapisu gry w chmurze');
    assert.equal(save.wave, 1);

    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    // Zapis potwierdza odpowiedź serwera wyżej; tu tylko czekamy, aż migający napis będzie widoczny na zrzucie.
    assert.ok(await waitForBlinkOn(page), 'brak migającego napisu w menu');
    await shot('05-menu-kontynuuj-po-przeladowaniu.png');
  });

  it('bez błędów JavaScript na stronie', () => {
    assert.deepEqual(pageErrors, []);
  });
});

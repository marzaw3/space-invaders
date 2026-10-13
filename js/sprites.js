// Grafika rysowana kodem do płócien offscreen (bez plików graficznych):
// pixel-art postaci z cieniowaniem, obrysem i poświatą, tło, krąg przywołania i tekstury blasku.
(function (root) {
  'use strict';

  const SCALE = 3;
  const PAD = 8; // margines na obrys i poświatę wokół sprite'a
  const C = root.CONFIG;

  // Paleta całej oprawy - jedno miejsce do strojenia kolorów.
  const PALETTE = {
    skyTop: '#0e0826',
    skyMid: '#1d0d3d',
    horizon: '#3d1553',
    gold: '#f2c46d',
    goldDeep: '#b9802f',
    moonTeal: '#8ff0dc',
    ember: '#ff6247',
    parchment: '#efe3c8',
    ink: '#07040f',
    stone: '#4a3a66',
    stoneLight: '#6d5a8f',
    stoneDark: '#2a1f40',
  };

  // ---------- kolory ----------

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    const x = rgb(a);
    const y = rgb(b);
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function rgba(hex, alpha) {
    const [r, g, b] = rgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Prosty deterministyczny generator losowy - tło wygląda tak samo przy każdym uruchomieniu.
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---------- mapy pikseli ----------

  // Mag: X szata, l światło, d cień, s gwiazda na kapeluszu, b rondo, f twarz/dłoń, e oczy,
  // w broda, o kostur, g kryształ, G rdzeń kryształu.
  const PLAYER = [
    '......l....g.',
    '.....lXd..gGg',
    '....lXsXd..g.',
    '...lXXXXXd.o.',
    '.bbbbbbbbb.o.',
    '...fefef...o.',
    '..lXwwwXd.fo.',
    '.lXXXwXXXdXo.',
    '.lXXXXXXXXdo.',
    'lXXXXXXXXXdo.',
  ];

  // X kolor główny, l światło, d cień, o oczy, p źrenice, t kły.
  const ENEMIES = {
    imp: [
      [
        '.l........l.',
        '.Xl......lX.',
        '..XXXXXXXX..',
        '.XXoXXXXoXX.',
        'lXXXXttXXXXl',
        'XdXXXXXXXXdX',
        'X.dXXXXXXd.X',
        '...dX..Xd...',
        '...X....X...',
      ],
      [
        '.l........l.',
        '.Xl......lX.',
        '..XXXXXXXX..',
        '.XXoXXXXoXX.',
        '.XXXXttXXXX.',
        'lXdXXXXXXdXl',
        'XX.dXXXXd.XX',
        'X..dX..Xd..X',
        '....X..X....',
      ],
    ],
    skeleton: [
      [
        '...lXXXXd...',
        '..lXXXXXXd..',
        '.lXooXXooXd.',
        '.XXopXXpoXX.',
        '.XXXXddXXXX.',
        '..dXXXXXXd..',
        '...XdXdXd...',
        '..lX.XX.Xd..',
        '.X...dd...X.',
      ],
      [
        '...lXXXXd...',
        '..lXXXXXXd..',
        '.lXooXXooXd.',
        '.XXopXXpoXX.',
        '.XXXXddXXXX.',
        '..dXXXXXXd..',
        '............',
        '...XdXdXd...',
        '.X.X.dd.X.X.',
      ],
    ],
    wraith: [
      [
        '....lXXd....',
        '..lXXXXXXd..',
        '.lXddddddXd.',
        '.XdoddddodX.',
        'XXddddddddXX',
        'XXXddddddXXX',
        'lXXXXXXXXXXd',
        'XX.XXX.XXX.X',
        'X...X...X...',
      ],
      [
        '....lXXd....',
        '..lXXXXXXd..',
        '.lXddddddXd.',
        '.XdoddddodX.',
        'XXddddddddXX',
        'XXXddddddXXX',
        'lXXXXXXXXXXd',
        'X.XXX.XXX.XX',
        '...X...X...X',
      ],
    ],
  };

  // ---------- budowanie sprite'ów ----------

  // Rysuje mapę z ciemnym obrysem, a opcjonalnie z poświatą.
  // Zwraca { img, ox, oy } - img rysujemy w punkcie (x - ox, y - oy).
  function build(map, palette, glow) {
    const w = map[0].length;
    const h = map.length;
    const base = canvas((w + 2) * SCALE, (h + 2) * SCALE);
    const g = base.getContext('2d');
    const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && !!palette[map[y][x]];

    g.fillStyle = PALETTE.ink;
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          g.fillRect((x + 1) * SCALE, (y + 1) * SCALE, SCALE, SCALE);
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = palette[map[y][x]];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect((x + 1) * SCALE, (y + 1) * SCALE, SCALE, SCALE);
      }
    }

    const out = canvas(base.width + PAD * 2, base.height + PAD * 2);
    const o = out.getContext('2d');
    if (glow) {
      o.shadowColor = glow;
      o.shadowBlur = 10;
      o.drawImage(base, PAD, PAD);
      o.shadowBlur = 0;
    }
    o.drawImage(base, PAD, PAD);
    return { img: out, ox: PAD + SCALE, oy: PAD + SCALE };
  }

  function shades(color) {
    return { X: color, l: mix(color, '#ffffff', 0.4), d: mix(color, PALETTE.ink, 0.45) };
  }

  const ENEMY_PALETTES = {
    imp: t => Object.assign(shades(t.color), { o: t.eye, t: '#fff4e0' }),
    skeleton: t => Object.assign(shades(t.color), { o: t.eye, p: '#ff4a5a' }),
    wraith: t => Object.assign(shades(t.color), { d: mix(t.color, PALETTE.ink, 0.8), o: '#f4ffb0' }),
  };

  const FROZEN = { X: '#bfefff', l: '#ffffff', d: '#5aa6d6', o: '#1a4a66', p: '#1a4a66', t: '#e8fbff' };
  const FLASH = { X: '#ffffff', l: '#ffffff', d: '#ffffff', o: '#ffffff', p: '#ffffff', t: '#ffffff' };

  const PLAYER_PALETTE = {
    X: '#4f63e8', l: '#8ea0ff', d: '#2a2f8f', s: PALETTE.gold, b: '#6f82ff',
    f: '#ffd2a8', e: '#1b1030', w: '#e8e4f0', o: '#b07a3e', g: '#9ff5ff', G: '#ffffff',
  };

  // ---------- tekstury blasku ----------

  const glowCache = new Map();

  // Miękka kula światła - rysowana w trybie 'lighter' daje tani efekt świecenia.
  function glowDot(color, radius) {
    const key = color + radius;
    let c = glowCache.get(key);
    if (c) return c;
    c = canvas(radius * 2, radius * 2);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, rgba(color, 0.9));
    grad.addColorStop(0.25, rgba(color, 0.45));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, radius * 2, radius * 2);
    glowCache.set(key, c);
    return c;
  }

  // ---------- krąg przywołania ----------

  // Wielki runiczny krąg, z którego wychodzą demony. Dwie warstwy obracane w przeciwne strony.
  function buildSigil(size, seed, inner) {
    const c = canvas(size, size);
    const g = c.getContext('2d');
    const r = size / 2;
    const rand = rng(seed);
    g.translate(r, r);
    g.strokeStyle = PALETTE.gold;
    g.fillStyle = PALETTE.gold;
    g.lineCap = 'round';

    const circle = (radius, width) => {
      g.lineWidth = width;
      g.beginPath();
      g.arc(0, 0, radius, 0, Math.PI * 2);
      g.stroke();
    };

    if (!inner) {
      circle(r - 3, 3);
      circle(r - 12, 1.5);
      circle(r - 46, 2);
      // Znaczniki jak na tarczy zegara.
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const long = i % 8 === 0;
        g.lineWidth = long ? 2 : 1;
        g.beginPath();
        g.moveTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
        g.lineTo(Math.cos(a) * (r - (long ? 24 : 17)), Math.sin(a) * (r - (long ? 24 : 17)));
        g.stroke();
      }
      // Runy między pierścieniami - każda to kilka kresek na siatce 3x4.
      const count = 24;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        g.save();
        g.rotate(a);
        g.translate(0, -(r - 34));
        g.lineWidth = 1.6;
        g.beginPath();
        const strokes = 2 + Math.floor(rand() * 3);
        for (let s = 0; s < strokes; s++) {
          const x1 = Math.floor(rand() * 3) * 4 - 4;
          const y1 = Math.floor(rand() * 4) * 4 - 6;
          const x2 = Math.floor(rand() * 3) * 4 - 4;
          const y2 = Math.floor(rand() * 4) * 4 - 6;
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
        }
        g.stroke();
        g.restore();
      }
    } else {
      circle(r - 2, 2);
      circle(r * 0.62, 1.5);
      // Siedmioramienna gwiazda wpisana w krąg.
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= 7; i++) {
        const a = ((i * 3) / 7) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * (r - 2);
        const y = Math.sin(a) * (r - 2);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        g.beginPath();
        g.arc(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2), 4, 0, Math.PI * 2);
        g.fill();
      }
      circle(r * 0.18, 2);
    }
    return c;
  }

  // ---------- tło ----------

  function buildSky(w, h) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const rand = rng(7);

    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(0.92, PALETTE.horizon);
    sky.addColorStop(1, '#4a1a5a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    // Mgławice - miękkie plamy koloru.
    const nebula = [
      [140, 150, 220, '#5a2a8a', 0.35],
      [650, 110, 260, '#1f4a7a', 0.3],
      [420, 330, 300, '#6a1f5a', 0.22],
      [720, 420, 200, '#2a6a7a', 0.16],
      [90, 430, 220, '#7a2a4a', 0.2],
    ];
    for (const [x, y, r, color, a] of nebula) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(color, a));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Ziarno - drobne piksele przełamujące gładkie gradienty.
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 2, 2);
    }

    // Poświata horyzontu za wieżami.
    const glow = g.createLinearGradient(0, h - 170, 0, h - 40);
    glow.addColorStop(0, rgba(PALETTE.ember, 0));
    glow.addColorStop(1, rgba(PALETTE.ember, 0.16));
    g.fillStyle = glow;
    g.fillRect(0, h - 170, w, 130);
    return c;
  }

  // Sylwetki odległych iglic i wzgórz, z pojedynczymi oknami.
  function buildSkyline(w, h, groundY) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const rand = rng(21);

    const layer = (baseY, color, spires, windows) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, groundY);
      let x = 0;
      while (x < w) {
        const hill = baseY + Math.sin(x * 0.012 + baseY) * 10;
        g.lineTo(x, hill);
        x += 8;
      }
      g.lineTo(w, groundY);
      g.closePath();
      g.fill();
      for (let i = 0; i < spires; i++) {
        const sx = 20 + rand() * (w - 40);
        const sw = 10 + rand() * 18;
        const sh = 30 + rand() * 70;
        const top = baseY - sh;
        g.fillRect(Math.round(sx), Math.round(top), Math.round(sw), groundY - top);
        g.beginPath();
        g.moveTo(sx - 3, top);
        g.lineTo(sx + sw / 2, top - sw * 1.4);
        g.lineTo(sx + sw + 3, top);
        g.closePath();
        g.fill();
        if (windows) {
          g.fillStyle = rand() < 0.5 ? PALETTE.gold : '#ff9a5a';
          const wy = Math.round(top + 8 + rand() * (sh * 0.5));
          g.fillRect(Math.round(sx + sw / 2 - 1), wy, 2, 3);
          g.fillStyle = color;
        }
      }
    };

    layer(groundY - 50, '#261040', 7, false);
    layer(groundY - 22, '#170a2a', 5, true);
    return c;
  }

  // Blanki wieży, na których stoi mag.
  function buildParapet(w, top, bottom) {
    const c = canvas(w, bottom - top);
    const g = c.getContext('2d');
    const h = bottom - top;
    const rand = rng(3);
    g.fillStyle = PALETTE.stoneDark;
    g.fillRect(0, 0, w, h);
    const bw = 24;
    for (let row = 0; row * 6 < h; row++) {
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = -offset; x < w; x += bw) {
        g.fillStyle = mix(PALETTE.stone, PALETTE.stoneDark, rand() * 0.5);
        g.fillRect(x + 1, row * 6 + 1, bw - 2, 5);
      }
    }
    g.fillStyle = PALETTE.stoneLight;
    g.fillRect(0, 0, w, 1);
    return c;
  }

  // Przyciemnienie rogów kadru.
  function buildVignette(w, h) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4,2,12,0.6)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return c;
  }

  // Pas mgły kafelkowany w poziomie.
  function buildMist(w, h) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const rand = rng(11);
    // Plamy spłaszczone w poziomie i mieszczące się w wysokości pasa - bez ostrych krawędzi.
    const sx = 2.5;
    g.scale(sx, 1);
    for (let i = 0; i < 14; i++) {
      const x = (rand() * w) / sx;
      const r = h * 0.25 + rand() * h * 0.2;
      const y = h / 2 + (rand() - 0.5) * (h - r * 2 - 4);
      for (const dx of [-w / sx, 0, w / sx]) {
        const grad = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        grad.addColorStop(0, 'rgba(180,150,230,0.09)');
        grad.addColorStop(1, 'rgba(180,150,230,0)');
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
    return c;
  }

  // Szum wartości w kilku oktawach, 0..1. Zawija się na brzegach pola w×h, więc tekstury z niego
  // można przesuwać w nieskończoność bez widocznego szwu.
  function valueNoise(rand, w, h, cells) {
    const octaves = [];
    for (let o = 0; o < 4; o++) {
      const gw = cells << o;
      const gh = Math.max(1, Math.round((cells * h) / w)) << o;
      const v = new Float32Array(gw * gh);
      for (let i = 0; i < v.length; i++) v[i] = rand();
      octaves.push({ gw, gh, v, amp: 0.5 ** o });
    }
    const total = octaves.reduce((s, o) => s + o.amp, 0);
    const ease = t => t * t * (3 - 2 * t);
    function sample(o, fx, fy) {
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = ease(fx - x0);
      const ty = ease(fy - y0);
      const at = (x, y) => o.v[(y % o.gh) * o.gw + (x % o.gw)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return top + (bottom - top) * ty;
    }
    return (x, y) => {
      let n = 0;
      for (const o of octaves) n += o.amp * sample(o, (x / w) * o.gw, (y / h) * o.gh);
      return n / total;
    };
  }

  function setPixel(d, i, hex, alpha) {
    const [r, g, b] = rgb(hex);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = Math.round(alpha * 255);
  }

  // Kłęby mgły do ruchomej mgły na obrazie menu. Gęstość szumu dzielimy na kilka tonów
  // [próg, kolor, alfa] - jak w malowanej pixel-artowej mgle, więc płynące smugi są wyraźne.
  function buildFogNoise(w, h, seed, cells, tones) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const noise = valueNoise(rng(seed), w, h, cells);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x, y);
        let tone = null;
        for (const t of tones) if (n >= t[0]) tone = t;
        if (tone) setPixel(img.data, (y * w + x) * 4, tone[1], tone[2]);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // Chmura w stylu namalowanych przy księżycu: kilka kłębów na płaskim spodzie, poszarpany brzeg
  // z szumu, jaśniejsze górne krawędzie (światło księżyca) i ciemniejszy spód.
  function buildCloud(w, h, seed) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const rand = rng(seed);
    const noise = valueNoise(rand, w, h, Math.max(3, Math.round(w / 8)));
    // Kłęby stoją na wspólnej, długiej podstawie; środkowe są największe, więc chmura ma garb, a nie pas.
    const base = h * 0.82;
    const n = Math.max(4, Math.round(w / (h * 0.55)));
    const puffs = [{ x: w / 2, y: base - h * 0.1, r: (w * 0.44) / 1.2, sy: (w * 0.44) / 1.2 / (h * 0.2) }];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = h * (0.2 + 0.32 * (1 - (2 * t - 1) ** 2)) * (0.85 + 0.3 * rand());
      puffs.push({ x: w * (0.12 + 0.76 * t), y: base - r * 0.35, r, sy: 1 });
    }
    const density = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Bez obcinania do zera: daleko od kłębów gęstość jest mocno ujemna i szum nie wyczaruje tam kresek.
        let dd = -Infinity;
        for (const p of puffs) dd = Math.max(dd, 1 - Math.hypot((x - p.x) / 1.2, (y - p.y) * p.sy) / p.r);
        const flat = (base + h * 0.08 - y) / (h * 0.1); // płaski spód
        const ends = 1.5 * (1 - ((x - w / 2) / (w * 0.49)) ** 2); // zwężenie ku końcom, nic nie dotyka krawędzi
        density[y * w + x] = Math.min(dd, flat, ends) + (noise(x, y) - 0.5) * 0.5;
      }
    }
    const at = (x, y) => (y < 0 || y >= h ? 0 : density[y * w + x]);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dd = at(x, y);
        if (dd < 0.06) continue;
        const slope = at(x, y + 3) - at(x, y - 3); // > 0 przy górnej krawędzi, < 0 przy spodzie
        const i = (y * w + x) * 4;
        if (at(x, y - 2) < 0.06) setPixel(img.data, i, '#8a8cc4', 0.9);
        else if (slope > 0.16) setPixel(img.data, i, '#5c4a8c', 0.92);
        else if (slope < -0.12 || dd < 0.16) setPixel(img.data, i, '#2a1c4a', 0.85);
        else setPixel(img.data, i, '#3d2c68', 0.92);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ---------- eksport ----------

  const Sprites = {
    PALETTE,
    mix,
    rgba,
    glowDot,
    player: build(PLAYER, PLAYER_PALETTE, '#5b7cff'),
    // Pozycja kryształu kostura względem lewego górnego rogu hitboxa maga.
    playerGem: { x: 11 * SCALE + SCALE / 2, y: SCALE / 2 },
    enemies: {},
    sigilOuter: buildSigil(440, 5, false),
    sigilInner: buildSigil(250, 9, true),
    sky: buildSky(C.width, C.height),
    skyline: buildSkyline(C.width, C.height, C.player.y + C.player.height),
    parapet: buildParapet(C.width, C.player.y + C.player.height, C.height - C.hudBottom),
    vignette: buildVignette(C.width, C.height),
    mist: buildMist(C.width, 220),
    fogValley: buildFogNoise(256, 128, 21, 6, [[0.48, '#7d74b0', 0.35], [0.58, '#a59cd2', 0.5], [0.68, '#cfc6ee', 0.6]]),
    fogPurple: buildFogNoise(256, 128, 37, 6, [[0.46, '#7a3cb8', 0.4], [0.56, '#a862e6', 0.55], [0.66, '#dca8ff', 0.65]]),
    clouds: [[170, 56, 3], [120, 42, 8], [210, 66, 13], [95, 34, 17], [150, 50, 29], [190, 60, 41]].map(([w, h, seed]) => buildCloud(w, h, seed)),
  };

  for (const type of Object.keys(ENEMIES)) {
    const t = C.enemyTypes[type];
    const frames = ENEMIES[type];
    const palette = ENEMY_PALETTES[type](t);
    Sprites.enemies[type] = {
      frames: frames.map(m => build(m, palette, t.color)),
      flash: frames.map(m => build(m, FLASH, '#ffffff')),
      frozen: frames.map(m => build(m, FROZEN, '#7fe3ff')),
    };
  }

  root.Sprites = Sprites;
})(this);

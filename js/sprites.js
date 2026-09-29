// Pixel-art rysowany z map znaków do płócien offscreen (bez plików graficznych).
(function (root) {
  'use strict';

  const SCALE = 3;

  // X – kolor główny, o – oczy/detal, f – twarz, g – świecący kryształ kostura.
  const PLAYER = [
    '......X.....g',
    '.....XXX....o',
    '....XXXXX...o',
    '...XXXXXXX..o',
    '..XXXXXXXXX.o',
    '....fffff...o',
    '...XXXXXXX..o',
    '..XXXXXXXXXXo',
    '.XXXXXXXXXX.o',
    'XXXXXXXXXXXXo',
  ];

  const ENEMIES = {
    imp: [
      [
        'X..........X',
        '.X........X.',
        '..XXXXXXXX..',
        '.XXoXXXXoXX.',
        'XXXXXXXXXXXX',
        'XX.XXXXXX.XX',
        'X..X....X..X',
        '..X......X..',
        '.X........X.',
      ],
      [
        'X..........X',
        '.X........X.',
        '..XXXXXXXX..',
        '.XXoXXXXoXX.',
        'XXXXXXXXXXXX',
        'XX.XXXXXX.XX',
        'X..X....X..X',
        '...X....X...',
        '....X..X....',
      ],
    ],
    skeleton: [
      [
        '...XXXXXX...',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XoooXXoooX.',
        '.XXoXXXXoXX.',
        '.XXXXXXXXXX.',
        '..XX.XX.XX..',
        '..X.X..X.X..',
        '.X........X.',
      ],
      [
        '...XXXXXX...',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XoooXXoooX.',
        '.XXoXXXXoXX.',
        '.XXXXXXXXXX.',
        '..XX.XX.XX..',
        '...X.XX.X...',
        '..X......X..',
      ],
    ],
    wraith: [
      [
        '....XXXX....',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XXoXXXXoXX.',
        'XXXoXXXXoXXX',
        'XXXXXXXXXXXX',
        'XXXXXXXXXXXX',
        'XX.XXX.XXX.X',
        'X...X...X...',
      ],
      [
        '....XXXX....',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XXoXXXXoXX.',
        'XXXoXXXXoXXX',
        'XXXXXXXXXXXX',
        'XXXXXXXXXXXX',
        'X.XXX.XXX.XX',
        '...X...X...X',
      ],
    ],
  };

  function build(map, palette) {
    const c = document.createElement('canvas');
    c.width = map[0].length * SCALE;
    c.height = map.length * SCALE;
    const g = c.getContext('2d');
    map.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const color = palette[line[x]];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    });
    return c;
  }

  const Sprites = {
    player: build(PLAYER, { X: '#5b7cff', f: '#ffd9b0', o: '#c89b5a', g: '#fff27a' }),
    enemies: {},
  };

  for (const type of Object.keys(ENEMIES)) {
    const t = root.CONFIG.enemyTypes[type];
    const frames = ENEMIES[type];
    Sprites.enemies[type] = {
      frames: frames.map(m => build(m, { X: t.color, o: t.eye })),
      flash: frames.map(m => build(m, { X: '#ffffff', o: '#ffffff' })),
      frozen: frames.map(m => build(m, { X: '#a8e6ff', o: '#1a4a66' })),
    };
  }

  root.Sprites = Sprites;
})(this);

# Arcane Invaders – prompty do grafik

Prompty do generatorów obrazów (ChatGPT, Midjourney, Ideogram itp.) dla grafik do gry.
Płótno gry ma 800×600 (proporcje 4:3), grafika postaci to pixel-art w skali 3×.

## Gdzie grafika da najwięcej

| # | Miejsce | Co teraz rysuje gra | Co musi zostać puste |
|---|---|---|---|
| 1 | **Menu główne** | niebo z kodu, krąg, wieże | środek: tytuł (y≈112), lista wrogów, sterowanie, „Enter” |
| 2 | **Tło rozgrywki** | gradient `Sprites.sky` | cały ekran ma być ciemny i mało kontrastowy, bo latają po nim pociski |
| 3 | **Koniec gry** | przyciemniona scena gry | środek: tytuł (y≈215) i wynik |
| 4 | **Ranking** | przyciemnione tło menu | środek: tabela top 10 (x 165–635, y 110–510) |
| 5 | *(opcjonalnie)* okładka do README na GitHubie | brak | nic, tu mogą być postacie |

## Wskazówki

- Generuj w proporcjach **4:3** (np. 1600×1200 albo w Midjourney `--ar 4:3`). Gra przeskaluje obraz do 800×600.
- W środku tła **nie może być kół ani run**, bo krąg przywołania rysuje kod.
- Jeśli generator zrobi „malowany” obraz zamiast pikseli, dopisz:
  *„pixel art at 400x300 resolution, upscaled with nearest-neighbor, chunky visible pixels”*.

## Prompty

### 1. Menu główne

```
Title screen background for a retro pixel-art fantasy arcade game "Arcane Invaders" (a magical twist on Space Invaders), 4:3, 1600x1200. Detailed 16-bit pixel art, crisp pixels, limited palette. Theme: a lone wizard's tower at night, defending against demons that pour out of a summoning portal in the sky. Composition: the central 60% of the frame is a calm, almost empty, deep violet night sky with very soft, low-contrast nebula clouds - reserved for the game title, menu text and a summoning circle drawn by the game. All detail pushed to the edges: tall dark gothic wizard spires on the far left and far right, silhouetted, with a few tiny warm-gold glowing windows; distant mountain silhouettes low on the horizon; the top of a stone tower battlement running across the bottom 8% of the frame; faint drifting magic motes and wisps of purple mist near the lower corners; a soft golden halo high in the upper center, as if behind a title. Lighting: low-key, moonlit, deep shadows, ember-orange glow along the horizon. Palette: midnight indigo (#0e0826), deep violet (#1d0d3d), plum (#3d1553), muted gold (#f2c46d), ember orange (#ff6247), pale moon teal (#8ff0dc), dusky stone (#4a3a66). No text, no letters, no logos, no runes or circles in the center, no characters, no creatures, no faces. Highly detailed edges, soft and clean center.
```

### 2. Tło rozgrywki

Zastępuje tylko niebo – wieże, mgłę, blanki i gwiazdy dalej rysuje kod.

```
Gameplay background for a retro pixel-art fantasy shoot-'em-up in the style of Space Invaders, 4:3, 1600x1200, 16-bit pixel art. Theme: a magical night sky above a wizard's tower. Composition: sky only - no ground, no buildings, no towers. Vertical gradient from near-black indigo at the top (#0e0826) through deep violet (#1d0d3d) to a dull plum horizon glow at the very bottom (#3d1553 fading into faint ember #ff6247). Large, soft, very low-contrast nebula clouds in muted purple, dusky blue and wine red, spread evenly; a small, dim, pale crescent moon in the upper-right corner. The whole image must be dark and low-contrast (nothing brighter than about 35% brightness) so that small glowing sprites and projectiles stay perfectly readable on top of it. Very few stars, absolutely no bright dots, sparks or small points of light. Subtle dithering and pixel grain. No text, no symbols, no circles, no runes, no characters, no creatures. Calm, even, atmospheric.
```

### 3. Koniec gry

```
Game over screen background for a retro pixel-art fantasy arcade game, 4:3, 1600x1200, 16-bit pixel art. Theme: the wizard's tower has fallen to the demons. Composition: the central 60% of the frame is a dark, calm, nearly empty smoky crimson-black sky - reserved for the "Game Over" title and score text. All detail at the edges and bottom: ruined, cracked tower battlements in the bottom corners, broken stone blocks, a snapped wooden wizard staff with a cracked, extinguished crystal lying in the lower-left corner, a fallen pointed blue wizard hat with a gold star in the lower-right, thin columns of smoke rising at the sides, a few dying embers drifting up near the bottom edge, a faint blood-red summoning glow seeping in from the top edge. Lighting: low-key, gloomy. Palette: ink black (#07040f), deep wine (#3a0f24), crimson (#9a1f3a), ember red (#ff6a5a), ash violet (#2a1f40), small touches of tarnished gold. No text, no letters, no logos, no people, no faces, no skulls in the center. Highly detailed edges, soft and clean center.
```

### 4. Ranking

```
High score / hall of fame screen background for a retro pixel-art fantasy arcade game, 4:3, 1600x1200, 16-bit pixel art. Theme: the wizard's study at the top of the tower, where the names of the greatest defenders are kept. Composition: the central 60% of the width, from 15% to 85% of the height, is a calm, dark, low-contrast stone wall with a very subtle texture - reserved for a top-10 score table in light text. All detail pushed to the edges: tall bookshelves packed with old tomes along the left and right edges, long hanging violet banners with gold trim and embroidered stars in the upper corners, lit candles with a soft warm glow on the shelves, a brass telescope and a glowing crystal orb in the bottom corners, a small gold laurel-and-star ornament at the very top center. Lighting: warm candlelight at the sides, darkness in the center. Palette: deep violet (#1d0d3d), dusky stone (#4a3a66, #2a1f40), aged parchment (#efe3c8), muted gold (#f2c46d), candle amber. No text, no letters, no numbers, no logos, no people, no faces. Highly detailed edges, soft and clean center.
```

### 5. Okładka / key art (opcjonalnie, 16:9)

Do README. Tytuł gry lepiej dopisać samemu – generatory zwykle przekręcają napisy.

```
Key art for a retro pixel-art fantasy arcade game, 16:9, 16-bit pixel art. A small wizard in a blue robe and a pointed hat with a gold star stands on the battlements of a stone tower, raising a wooden staff topped with a glowing cyan crystal and firing a violet magic bolt upward. Above him a huge golden runic summoning circle glows in a violet night sky, and rows of pixel demons pour out of it: red horned imps with yellow eyes, bone-white skeletons with red pupils, and ghostly mint-green wraiths. Fireballs, ice shards and lightning streak across the sky. Gothic spires silhouetted on the horizon with an ember-orange glow. Palette: indigo, violet, gold, ember orange, cyan, mint green. Dynamic, heroic, readable silhouettes. No text, no logos.
```

## Jak podpiąć grafikę w grze

W założeniach z `wymagania.md` (pkt 12.1) gra miała nie używać plików graficznych – dodanie obrazków zmienia tę decyzję.
Uruchamianie dwuklikiem w `index.html` nadal zadziała, bo przeglądarka pozwala rysować lokalne obrazki na canvasie.

Najprostsze miejsce to funkcja `render()` w `js/game.js`, gdzie gra rysuje niebo (`ctx.drawImage(Sprites.sky, 0, 0)`):

```js
const skyImg = new Image();
skyImg.src = 'img/sky.png';
// w render():
if (skyImg.complete && skyImg.naturalWidth) ctx.drawImage(skyImg, 0, 0, C.width, C.height);
else ctx.drawImage(Sprites.sky, 0, 0);
```

Jeśli obrazek się nie wczyta, gra pokaże niebo rysowane kodem.

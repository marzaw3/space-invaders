# Arcane Invaders – wymagania

> Kwestionariusz wymagań dla gry **Arcane Invaders** – magicznej wariacji klasycznego *Space Invaders*.
> Odpowiedzi na te pytania mają wystarczyć do zbudowania działającej gry w **JavaScript + HTML** lub **Python + HTML**.

---

## 0. Jak wypełniać

- Pod każdym pytaniem jest pole **Odpowiedź:** – wpisz tam swoją odpowiedź.
- Tam, gdzie są opcje `- [ ]`, zaznacz wybraną zmieniając na `- [x]` (możesz też dopisać własną).
- Każde pytanie ma **Domyślnie:** – jeśli odpowiesz „domyślnie” albo zostawisz puste, przyjmę tę wartość.
- Pytania oznaczone **(opcjonalne)** nie są potrzebne do pierwszej grywalnej wersji (MVP).
- Wolny opis gry „własnymi słowami” możesz wpisać w sekcji 1.1 – im więcej szczegółów, tym lepiej.

---

## ✅ Decyzje (zatwierdzone 2026-09-29)

- **Wszystkie pytania: przyjęte wartości domyślne**, z poniższymi uzupełnieniami.
- **Wymaganie minimalne:** „Space Invaders mini” – statek (mag) porusza się lewo/prawo i strzela do przeciwników.
- **Zmiany względem klasyki:**
  1. przeciwnicy poruszają się (siatka w bok i w dół, przyspiesza gdy ich ubywa),
  2. przeciwnicy mają różne HP: Imp 1, Szkielet 2, Widmo 3 (+1 HP co 4 fale),
  3. **gracz ma limit amunicji** na podstawowy pocisk: 40 sztuk, pełne uzupełnienie na starcie fali,
     powolna regeneracja (1 szt. / 0,8 s), żeby gra nigdy się nie zablokowała. Zaklęcia specjalne kosztują manę, nie amunicję.
  4. **zawijanie przy ścianie:** uderzenie maga w lewą/prawą krawędź planszy nie odbiera życia –
     mag pojawia się po przeciwnej stronie planszy (wyjście w lewo → wejście z prawej i odwrotnie).
- Wszystkie parametry (HP, prędkości, amunicja, mana, punkty) są w jednym pliku `js/config.js` – łatwo je zmieniać.
- Formacja wrogów: 4 rzędy × 8 kolumn (Widmo, Szkielet, Imp, Imp) – dopasowane do limitu amunicji.

---

## 1. Wizja i klimat

**1.1. Opisz grę własnymi słowami (2–10 zdań). O co chodzi, kim jest gracz, z kim walczy?**
Domyślnie: Gracz jest magiem broniącym magicznej wieży przed falami nadciągających demonów; porusza się na dole ekranu i rzuca zaklęcia w górę.
**Odpowiedź:**

**1.2. Jaki klimat ma mieć gra?**
- [ ] mroczne fantasy
- [ ] baśniowe / kolorowe
- [ ] retro arcade (neon, pixel-art)
- [ ] humorystyczne
Domyślnie: retro arcade z magicznym, fioletowo-niebieskim klimatem.
**Odpowiedź:**

**1.3. Dla kogo jest gra (wiek, doświadczenie z grami)?**
Domyślnie: dla każdego, sesja 5–15 minut, łatwy start.
**Odpowiedź:**

**1.4. Inspiracje – gry, filmy, obrazki, które mam wziąć pod uwagę? (opcjonalne)**
Domyślnie: Space Invaders, Galaga.
**Odpowiedź:**

**1.5. Czy jest fabuła / wprowadzenie tekstowe między poziomami? (opcjonalne)**
Domyślnie: krótki tekst na ekranie startowym, bez fabuły między poziomami.
**Odpowiedź:**

---

## 2. Technologia i uruchamianie

**2.1. Język:**
- [ ] JavaScript (czysty, HTML5 Canvas) – **rekomendowane**: działa po otwarciu pliku w przeglądarce, zero instalacji
- [ ] Python w przeglądarce (PyScript / Pyodide / pygame-web)
- [ ] Python jako serwer (np. Flask) + gra w JS/HTML (np. do rankingu online)
Domyślnie: czysty JavaScript + Canvas.
**Odpowiedź:**

**2.2. Czy wolno użyć bibliotek/silników?**
- [ ] nie, wszystko ręcznie
- [ ] tak, np. Phaser (JS)
- [ ] tak, np. pygame (Python)
Domyślnie: bez zewnętrznych bibliotek.
**Odpowiedź:**

**2.3. Struktura projektu:**
- [ ] jeden plik `index.html` (wszystko w środku)
- [ ] kilka plików: `index.html`, `style.css`, `js/*.js`
Domyślnie: kilka plików, czytelny podział na moduły.
**Odpowiedź:**

**2.4. Jak gra ma być uruchamiana?**
- [ ] dwuklik w `index.html`
- [ ] lokalny serwer (np. `python -m http.server`)
- [ ] publikacja w internecie (GitHub Pages itp.)
Domyślnie: dwuklik w `index.html` (bez serwera).
**Odpowiedź:**

**2.5. Platformy docelowe:**
- [ ] komputer (klawiatura)
- [ ] telefon / tablet (dotyk)
Domyślnie: tylko komputer, Chrome/Edge/Firefox.
**Odpowiedź:**

---

## 3. Gracz (mag)

**3.1. Jak wygląda / kim jest postać gracza?**
Domyślnie: mag w szacie z kosturem.
**Odpowiedź:**

**3.2. Ruch:**
- [ ] tylko lewo–prawo na dole ekranu (klasycznie)
- [ ] swobodny ruch w dolnej części ekranu
Domyślnie: tylko lewo–prawo.
**Odpowiedź:** lewo–prawo; po dojściu do ściany mag nie traci życia, tylko pojawia się po drugiej stronie planszy (zawijanie).

**3.3. Liczba żyć na start i czy można je zdobywać?**
Domyślnie: 3 życia, +1 życie co 10 000 punktów.
**Odpowiedź:**

**3.4. Co się dzieje po trafieniu gracza?**
Domyślnie: traci 1 życie, 2 sekundy nietykalności (miganie).
**Odpowiedź:**

**3.5. Sterowanie (klawisze):**
Domyślnie: ← → / A D – ruch, Spacja – strzał, 1/2/3 lub Q/E – zmiana zaklęcia, P/Esc – pauza.
**Odpowiedź:**

**3.6. Inne metody sterowania? (opcjonalne)**
- [ ] mysz
- [ ] dotyk
- [ ] gamepad
Domyślnie: brak.
**Odpowiedź:**

---

## 4. Magia – system ataków

**4.1. Jaki jest podstawowy atak?**
Domyślnie: magiczny pocisk lecący w górę, z krótkim odstępem między strzałami. **Limit amunicji: 40, regeneracja 1 szt. / 0,8 s, pełne uzupełnienie co falę.**
**Odpowiedź:**

**4.2. Czy są różne zaklęcia? Jeśli tak – jakie i czym się różnią?**
- [ ] ognista kula (obrażenia obszarowe)
- [ ] lodowy pocisk (spowalnia wrogów)
- [ ] błyskawica (przebija kilku wrogów w linii)
- [ ] inne: …
Domyślnie: 3 zaklęcia jak wyżej.
**Odpowiedź:**

**4.3. Czy zaklęcia zużywają manę?**
Domyślnie: tak – podstawowy pocisk jest darmowy, specjalne zaklęcia kosztują manę, która regeneruje się z czasem.
**Odpowiedź:**

**4.4. Jak zdobywa się zaklęcia?**
- [ ] wszystkie dostępne od początku
- [ ] odblokowywane z poziomami
- [ ] ze znajdziek po wrogach
Domyślnie: odblokowywane z kolejnymi poziomami.
**Odpowiedź:**

**4.5. Czy jest „super zaklęcie” (np. czyści ekran)? (opcjonalne)**
Domyślnie: nie w MVP.
**Odpowiedź:**

**4.6. Osłony (odpowiednik bunkrów z Space Invaders):**
- [ ] magiczne bariery niszczone stopniowo
- [ ] tarcza aktywowana przez gracza (kosztuje manę)
- [ ] brak osłon
Domyślnie: 3–4 runiczne bariery niszczone stopniowo.
**Odpowiedź:**

---

## 5. Wrogowie

**5.1. Jakie typy wrogów? (nazwa, wygląd, ile trafień wytrzymują, ile punktów)**
Domyślnie:
| Typ | Wytrzymałość | Punkty |
|---|---|---|
| Imp | 1 | 10 |
| Szkielet | 2 | 20 |
| Widmo | 3 | 30 |
**Odpowiedź:**

**5.2. Jak wrogowie się poruszają?**
- [ ] klasycznie: siatka idzie w bok, na krawędzi schodzi w dół
- [ ] swobodne formacje i nurkowanie (jak Galaga)
- [ ] mieszanie obu
Domyślnie: klasyczna siatka, im mniej wrogów, tym szybciej się poruszają.
**Odpowiedź:**

**5.3. Jak wrogowie atakują?**
Domyślnie: losowy wróg z dolnego rzędu co jakiś czas wystrzeliwuje pocisk w dół.
**Odpowiedź:**

**5.4. Czy wrogowie mają odporności/słabości na żywioły? (opcjonalne)**
Domyślnie: nie w MVP.
**Odpowiedź:**

**5.5. Czy pojawia się specjalny wróg bonusowy (jak UFO w oryginale)? (opcjonalne)**
Domyślnie: tak – latający „chowaniec” przelatujący górą ekranu za dodatkowe punkty.
**Odpowiedź:**

---

## 6. Bossowie (opcjonalne)

**6.1. Czy w grze są bossowie?**
Domyślnie: nie w MVP; w wersji 2 boss co 5 poziomów.
**Odpowiedź:**

**6.2. Jeśli tak – jak wyglądają i jak walczą (fazy, ataki, pasek życia)?**
**Odpowiedź:**

---

## 7. Poziomy i progresja

**7.1. Ile poziomów?**
- [ ] ustalona liczba (ile?): …
- [ ] nieskończone fale z rosnącą trudnością
Domyślnie: nieskończone fale.
**Odpowiedź:**

**7.2. Jak rośnie trudność z każdą falą?**
Domyślnie: więcej wrogów, szybszy ruch, częstsze strzały, nowe typy wrogów.
**Odpowiedź:**

**7.3. Czy jest wybór poziomu trudności (łatwy / normalny / trudny)? (opcjonalne)**
Domyślnie: nie.
**Odpowiedź:**

**7.4. Czy między falami są ulepszenia (sklep, drzewko zaklęć)? (opcjonalne)**
Domyślnie: nie w MVP.
**Odpowiedź:**

---

## 8. Znajdźki / power-upy (opcjonalne)

**8.1. Czy z wrogów wypadają znajdźki? Jakie?**
- [ ] mikstura życia
- [ ] mikstura many
- [ ] potrójny strzał (czasowo)
- [ ] szybsze strzelanie (czasowo)
Domyślnie: mikstura many i potrójny strzał, szansa ok. 5%, efekt czasowy 8 s.
**Odpowiedź:**

---

## 9. Punktacja i ranking

**9.1. Za co są punkty?**
Domyślnie: za zabicie wroga (wg tabeli z 5.1), bonus za ukończenie fali.
**Odpowiedź:**

**9.2. Czy jest mnożnik/combo za szybkie zabijanie? (opcjonalne)**
Domyślnie: nie.
**Odpowiedź:**

**9.3. Ranking najlepszych wyników:**
- [ ] tylko najlepszy wynik
- [ ] lista top 10 z nickiem gracza
- [ ] ranking online (wymaga serwera)
Domyślnie: top 10 z nickiem, zapisywane lokalnie w przeglądarce (localStorage).
**Odpowiedź:**

---

## 10. Wygrana i przegrana

**10.1. Kiedy gracz przegrywa?**
Domyślnie: gdy straci wszystkie życia LUB gdy wrogowie dojdą do linii gracza.
**Odpowiedź:**

**10.2. Czy da się grę „wygrać”? Co wtedy?**
Domyślnie: nie (nieskończone fale) – celem jest rekord.
**Odpowiedź:**

**10.3. Co się dzieje po przegranej?**
Domyślnie: ekran „Game Over” z wynikiem, wpisanie nicku (jeśli w top 10), przyciski „Zagraj ponownie” i „Menu”.
**Odpowiedź:**

---

## 11. Ekrany i interfejs

**11.1. Jakie ekrany mają istnieć?**
- [ ] menu główne
- [ ] instrukcja / sterowanie
- [ ] gra
- [ ] pauza
- [ ] game over
- [ ] ranking
- [ ] ustawienia
Domyślnie: menu, gra, pauza, game over, ranking (instrukcja jako tekst w menu).
**Odpowiedź:**

**11.2. Co ma pokazywać HUD w trakcie gry?**
Domyślnie: wynik, rekord, życia, pasek many, numer fali, aktywne zaklęcie.
**Odpowiedź:**

**11.3. Język interfejsu:**
- [ ] polski
- [ ] angielski
- [ ] oba (przełącznik)
Domyślnie: polski.
**Odpowiedź:**

---

## 12. Grafika

**12.1. Styl grafiki:**
- [ ] pixel-art
- [ ] proste kształty rysowane kodem (Canvas)
- [ ] emoji / ikony
- [ ] gotowe obrazki (sprite'y) – skąd?
Domyślnie: pixel-art generowany w kodzie (bez zewnętrznych plików).
**Odpowiedź:**

**12.2. Rozmiar planszy i skalowanie:**
Domyślnie: logiczna rozdzielczość 800×600, skalowana do okna z zachowaniem proporcji.
**Odpowiedź:**

**12.3. Efekty wizualne:**
- [ ] cząsteczki przy trafieniu / wybuchu
- [ ] świecenie zaklęć
- [ ] trzęsienie ekranu przy trafieniu gracza
- [ ] animowane tło (gwiazdy, mgła)
Domyślnie: cząsteczki, świecenie zaklęć, animowane tło z gwiazd.
**Odpowiedź:**

**12.4. Paleta kolorów / preferencje wizualne? (opcjonalne)**
**Odpowiedź:**

---

## 13. Dźwięk

**13.1. Czy gra ma mieć dźwięk?**
- [ ] efekty dźwiękowe (strzał, trafienie, wybuch)
- [ ] muzyka w tle
- [ ] brak dźwięku
Domyślnie: proste efekty generowane w przeglądarce (Web Audio), bez muzyki.
**Odpowiedź:**

**13.2. Wyciszanie:**
Domyślnie: klawisz M wycisza/włącza dźwięk.
**Odpowiedź:**

---

## 14. Zapis i ustawienia

**14.1. Co ma być zapamiętywane między uruchomieniami?**
Domyślnie: ranking i ustawienie dźwięku (localStorage).
**Odpowiedź:**

**14.2. Czy można zapisać grę w trakcie i wrócić później? (opcjonalne)**
Domyślnie: nie.
**Odpowiedź:**

---

## 15. Wydajność i dostępność (opcjonalne)

**15.1. Docelowa płynność:**
Domyślnie: 60 FPS, logika niezależna od liczby klatek (działa tak samo na monitorach 60/144 Hz).
**Odpowiedź:**

**15.2. Zmiana klawiszy przez gracza?**
Domyślnie: nie.
**Odpowiedź:**

**15.3. Tryb dla daltonistów / ograniczenie migania i efektów?**
Domyślnie: nie w MVP.
**Odpowiedź:**

---

## 16. Zakres: MVP i kolejne wersje

Wpisz przy każdej funkcji: **MVP** (musi być w pierwszej wersji), **v2** (później) lub **nie** (nie robimy).

| Funkcja | Decyzja | Domyślnie |
|---|---|---|
| Ruch gracza i podstawowy strzał | | MVP |
| Siatka wrogów, ruch i strzały wrogów | | MVP |
| Życia, punkty, game over | | MVP |
| Kolejne fale z rosnącą trudnością | | MVP |
| Runiczne bariery | | MVP |
| 3 zaklęcia + mana | | MVP |
| Menu główne i pauza | | MVP |
| Ranking top 10 (lokalnie) | | MVP |
| Efekty dźwiękowe | | MVP |
| Cząsteczki i efekty wizualne | | MVP |
| Wróg bonusowy (chowaniec) | | v2 |
| Znajdźki / power-upy | | v2 |
| Bossowie | | v2 |
| Sklep / ulepszenia między falami | | v2 |
| Muzyka | | v2 |
| Sterowanie dotykowe (mobile) | | v2 |
| Ranking online | | nie |

---

## 17. Kryteria akceptacji – kiedy gra jest „gotowa”?

Domyślnie gra jest gotowa, gdy:
- [ ] uruchamia się bez błędów w konsoli przeglądarki (Chrome, Edge, Firefox),
- [ ] da się rozegrać pełną partię: menu → gra → kilka fal → game over → ranking → nowa gra,
- [ ] kolizje działają poprawnie (pociski gracza, pociski wrogów, bariery, wrogowie na linii gracza),
- [ ] trudność rośnie z każdą falą,
- [ ] wynik zapisuje się w rankingu i jest widoczny po odświeżeniu strony,
- [ ] pauza zatrzymuje całą grę, a wznowienie nie powoduje „przeskoku”,
- [ ] gra działa płynnie (ok. 60 FPS) na zwykłym laptopie.

Twoje dodatkowe/zmienione kryteria:
**Odpowiedź:**

---

## 18. Testy (opcjonalne)

**18.1. Czy logika gry (kolizje, punktacja, fale) ma mieć testy automatyczne?**
Domyślnie: tak, proste testy jednostkowe logiki uruchamiane w przeglądarce lub Node.js.
**Odpowiedź:**

---

## 19. Pytania otwarte i uwagi

Wszystko, czego nie obejmują pytania powyżej – pomysły, ograniczenia, terminy:
**Odpowiedź:**

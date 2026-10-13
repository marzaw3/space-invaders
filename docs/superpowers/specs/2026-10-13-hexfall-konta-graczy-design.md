# Hexfall – konta graczy (nick + hasło + profil)

Data: 2026-10-13. Status: zatwierdzony projekt, czeka na plan implementacji.

## Cel

Gracz może założyć konto (nick + hasło) i zalogować się na dowolnym komputerze, by odzyskać
przerwaną grę, swoje wyniki i profil ze statystykami. Gra bez konta (gość) działa dalej tak jak dziś.

Kryterium sukcesu: loguję się na drugim komputerze/przeglądarce i widzę swoją przerwaną grę,
swoje wyniki w rankingu oraz profil ze statystykami i historią partii.

## Stan wyjściowy

- Supabase z logowaniem anonimowym (`signInAnonymously`) – gracz nie widzi ekranu logowania,
  konto jest przypisane do przeglądarki.
- Tabele `scores` (ranking, `user_id` + `name`) i `saved_games` (jeden slot przerwanej gry na `user_id`),
  chronione RLS (`supabase/migrations/20261013121517_hexfall_scores_and_saves.sql`).
- Klient: `js/cloud.js` (nigdy nie rzuca wyjątku, offline = `null`/`false`), `js/game.js`
  (stany `menu | playing | paused | enterName | gameover | ranking`), czysta logika w `js/logic.js`
  z testami `node --test`.

## Decyzje

| Temat | Decyzja |
|---|---|
| Czy logowanie obowiązkowe | Nie. Gość (anonimowo) jak dziś; konto opcjonalne. |
| Gość zakłada konto | Anonimowe konto jest „ulepszane” – to samo `user_id`, więc zapis i wyniki gościa zostają. |
| Czym się logować | Nick + hasło. Pod spodem techniczny e-mail wyliczony z nicka. |
| Profil | Nick, data dołączenia, statystyki, historia ostatnich 10 partii. |
| Gość loguje się na istniejące konto | Konto wygrywa. Zapis gościa przechodzi na konto tylko, gdy konto nie ma własnego. Wyniki gościa zostają w rankingu, ale nie liczą się do statystyk konta. |
| Podejście techniczne | Supabase Auth (email+hasło) z technicznym e-mailem. Plan awaryjny: Edge Function z kluczem admina. |

## Nick i techniczny e-mail

- Nick: 3–10 znaków; litery (także polskie), cyfry, `_`, `-`; bez spacji.
  Limit 10 = obecny limit nazwy w rankingu (`CONFIG.highscores.nameMaxLength`).
- Porównanie bez względu na wielkość liter (`Merlin` = `merlin`); wyświetlany tak, jak został wpisany.
- E-mail = `u` + hex bajtów UTF-8 nicka zapisanego małymi literami + `@hexfall.invalid`.
  Przykład: `Łucja` → `uc58275636a61@hexfall.invalid`.
  Unikalność e-maila w Supabase Auth gwarantuje więc unikalność nicka (bez względu na wielkość liter).
  Domena `hexfall.invalid` jest zarezerwowana (RFC 2606) – nigdy nie trafi do prawdziwej skrzynki.
  Baza liczy ten sam e-mail (`lower` w Postgresie) i porównuje z tym od klienta (`toLowerCase` w JS);
  dla polskich liter wyniki są zgodne, a ewentualna niezgodność egzotycznego znaku kończy się bezpiecznie –
  odrzuceniem rejestracji.
- Hasło: minimum 6 znaków (domyślne minimum Supabase).
- Reset hasła nie istnieje (brak prawdziwego e-maila) – świadomie poza zakresem.

## Model danych (nowa migracja w `supabase/migrations/`)

Skrypt idempotentny, w stylu poprzedniej migracji (`if not exists`, `drop policy if exists`, komentarze po polsku).

### `public.profiles`

| Kolumna | Typ | Uwagi |
|---|---|---|
| `user_id` | `uuid` PK | `references auth.users (id) on delete cascade` |
| `nick` | `text not null` | check: 3–10 znaków, tylko litery/cyfry/`_`/`-` (`^[[:alpha:][:digit:]_-]+$`); unikalny indeks na `lower(nick)` |
| `created_at` | `timestamptz not null default now()` | data dołączenia („Mag od …”) |

RLS: `select` tylko własny wiersz (`auth.uid() = user_id`). Brak uprawnień `insert/update/delete`
dla `anon`/`authenticated` – profil tworzy wyłącznie trigger.

### Trigger tworzący profil

Funkcja `security definer`, `set search_path = ''`, wywoływana `after insert or update of email on auth.users`:
gdy `new.email` nie jest pusty, a profilu brak – wstawia `(new.id, new.raw_user_meta_data->>'nick')`.
Działa w transakcji rejestracji: zajęty nick (unikalny indeks) lub zły nick (check) przerywa rejestrację,
więc nie powstaje „pół konta”. Brak nicka w metadanych przy ustawianiu e-maila = błąd (rejestracja tylko z nickiem).

Spójność e-mail ↔ nick (ochrona przed ręcznymi wywołaniami API):
- przy tworzeniu profilu e-mail musi być równy `'u' || encode(convert_to(lower(nick), 'UTF8'), 'hex') || '@hexfall.invalid'`,
  inaczej błąd;
- gdy profil już istnieje, zmiana e-maila na inny niż wyliczony z nicka profilu = błąd
  (nie da się „przejąć” loginu innego nicka zmianą e-maila).

`execute` na funkcji odebrane `public, anon, authenticated`.

### Zmiana w `public.scores`

Trigger `before insert`: jeśli wstawiający (`new.user_id`) ma profil, `new.name := profiles.nick`.
Zalogowany gracz nie może wpisać do rankingu innego imienia; gość wpisuje imię jak dziś.

### Widok `public.player_stats`

`with (security_invoker = true)`, grupowanie `scores` po `user_id`:
`games` (count), `best_score` (max score), `best_wave` (max wave), `total_score` (sum score).
Liczy się tylko to, co trafia do `scores` – partie z wynikiem > 0.
`select` dla `authenticated`.

### Historia partii

Bez nowego SQL: `scores` gdzie `user_id = <ja>`, `order by created_at desc limit 10`
(RLS `scores` już pozwala czytać wszystkim).

### Bez zmian

`saved_games` i jego RLS – działa per `user_id`, który przy konwersji gościa się nie zmienia.

## Klient

### `js/logic.js` (czyste funkcje, testowane w Node)

- `validateNick(raw)` → `{ ok: true, nick }` albo `{ ok: false, error: 'too_short' | 'too_long' | 'bad_chars' }`
  (przycina spacje na brzegach).
- `nickToEmail(nick)` → `'u' + hex(utf8(nick.toLowerCase())) + '@hexfall.invalid'`.
- `validatePassword(raw)` → `{ ok }` albo `{ ok: false, error: 'too_short' }`.

Stała domeny i limity (3/10/6) w `js/config.js` (sekcja `account`), jak inne parametry gry.

### `js/cloud.js`

- Zamiast jednorazowej obietnicy `userId` – bieżąca sesja śledzona przez `client.auth.onAuthStateChange`;
  start bez sesji = `signInAnonymously` (jak dziś).
- Zasada bez zmian: żadna funkcja nie rzuca wyjątku.
- Nowe API:
  - `account()` → `{ nick }` dla zalogowanego, `null` dla gościa (synchronicznie, z pamięci).
  - `register(nick, password)` → `{ ok: true }` albo `{ error }`.
    Sesja anonimowa: `updateUser({ email, data: { nick } })`, potem `updateUser({ password })`
    (dokumentacja: hasło anonimowego konta dopiero po e-mailu; test na starcie sprawdzi, czy wystarczy jedno wywołanie).
    Gdy drugi krok zawiedzie, ponowne `register` z tym samym nickiem dokańcza (ustawia hasło).
    Brak sesji: `signUp({ email, password, options: { data: { nick } } })`.
  - `login(nick, password)` → `{ ok: true }` albo `{ error }` (`signInWithPassword`).
  - `logout()` → `signOut`, potem nowa sesja anonimowa.
  - `profile()` → `{ nick, joined, stats: { games, bestScore, bestWave, totalScore }, history: [{ date, score, wave }] }` albo `null`.
- Kody błędów: `nick_taken` (`user_already_exists`, `email_exists`, naruszenie unikalności profilu),
  `bad_credentials` (`invalid_credentials`), `weak_password`, `rate_limit` (`over_request_rate_limit` i pokrewne),
  `offline` (brak klienta/sieci), `unknown`.
- Kolejka `inOrder` dla zapisu/kasowania gry zostaje.

### `js/account.js` (nowy) + `index.html` + `style.css`

Formularz HTML nałożony na canvas, w klimacie gry (fonty `Pixelify Sans`/`Jacquard 24`, złoto/fiolet):
pole nick (`autocomplete="username"`), hasło (`type="password"`, `autocomplete="current-password"`),
przyciski „Zaloguj” i „Załóż konto”, miejsce na komunikat błędu.
API dla `game.js`: `Account.open(onDone)`, `Account.close()`, `Account.isOpen()`.
Walidacja (`validateNick`/`validatePassword`) przed wysłaniem; przyciski zablokowane w trakcie wysyłania;
Enter = zaloguj, Esc = zamknij.

Komunikaty:

| Kod | Tekst |
|---|---|
| nick za krótki/długi/złe znaki | „Nick: 3–10 znaków – litery, cyfry, _ i -” |
| hasło za krótkie / `weak_password` | „Hasło musi mieć co najmniej 6 znaków” |
| `nick_taken` | „Ten nick jest zajęty” |
| `bad_credentials` | „Zły nick lub hasło” |
| `rate_limit` | „Za dużo prób – spróbuj za chwilę” |
| `offline` | „Brak połączenia – logowanie działa tylko online” |
| `unknown` | „Coś poszło nie tak – spróbuj ponownie” |

### `js/game.js`

- Nowe stany: `account` (formularz otwarty – handler `keydown` gry nie reaguje) i `profile` (rysowany na canvasie).
- Menu: w lewym dolnym rogu `Gość – L: zaloguj` albo `<nick> – L: profil`. Klawisz `L` otwiera formularz (gość)
  lub profil (zalogowany).
- Ekran profilu: nick, „Mag od DD.MM.RRRR”, statystyki (partie, rekord, najdalsza fala, suma punktów),
  tabela 10 ostatnich partii (data, wynik, fala); `W – wyloguj`, `Esc – menu`. Bez sieci: komunikat zamiast danych.
- Po rejestracji: odświeżenie profilu; zapis i wyniki zostają (to samo `user_id`).
- Po zalogowaniu na istniejące konto: zapamiętany w pamięci zapis gościa → `signInWithPassword` →
  `loadSave` konta → jeśli konto nie ma zapisu, a gość miał, `saveGame(zapis gościa)`;
  odświeżenie rankingu i profilu.
- Po wylogowaniu: `resumable = null`, profil wyczyszczony, menu jak dla nowego gościa.
- Koniec gry (wynik > 0): zalogowany pomija `enterName` – wynik idzie pod nickiem, przejście do rankingu
  z podświetleniem; gość jak dziś. Lokalny ranking (`localScores`) zapisuje nick tak samo.
- Offline: gra lokalnie jak dziś; `L` otwiera formularz z komunikatem o braku połączenia.

## Konfiguracja Supabase (ręcznie, w panelu – robi właścicielka projektu)

- Authentication → Sign In / Providers → Email: **Confirm email = wyłączone**.
- Jeśli test startowy pokaże taką potrzebę: **Allow manual linking = włączone**.
- Minimalna długość hasła: domyślne 6.

## Test startowy (pierwszy krok implementacji, przed resztą kodu)

Skrypt (Node, klucz publishable) na prawdziwym projekcie sprawdza:

1. Czy Supabase przyjmuje e-mail `u…@hexfall.invalid`.
2. Czy konwersja anonimowe konto → e-mail + hasło działa i zachowuje `user_id`
   (oraz czy wystarczy jedno `updateUser`).
3. Czy da się zalogować tym kontem w nowej sesji.

Konto testowe zostaje potem usunięte (SQL).
Jeśli 1 lub 2 zawiedzie – stop i powrót do właścicielki z planem awaryjnym (Edge Function z kluczem admina:
`admin.updateUserById(..., { email_confirm: true })`), bez improwizowania.

## Testy

- `tests/logic.test.js` (`node --test`): `validateNick` (granice 3/10, polskie znaki, spacje, znaki niedozwolone),
  `nickToEmail` (wielkość liter daje ten sam e-mail, polskie znaki, przykład `Łucja`), `validatePassword`.
- Baza (SQL po migracji): trigger profilu (tworzy profil; zajęty nick odrzuca rejestrację;
  e-mail niezgodny z nickiem odrzucony),
  nadpisanie `name` w `scores`, widok `player_stats`; `get_advisors` (security) bez nowych ostrzeżeń.
- Ręcznie w przeglądarce (lokalny serwer): gość gra → Q (zapis) → zakłada konto (zapis zostaje) →
  wylogowanie (menu bez zapisu) → logowanie (zapis wraca) → profil (statystyki, historia) →
  zajęty nick i złe hasło dają właściwe komunikaty → koniec gry zalogowanego bez wpisywania imienia.

## Poza zakresem

Zmiana nicka, reset hasła, usuwanie konta przez gracza, scalanie wyników gościa z istniejącym kontem,
synchronizacja ustawień (wyciszenie) w chmurze.

## Wdrożenie

Migracja stosowana do projektu Supabase dopiero po akceptacji właścicielki. Kod: commit na `master` + push
(GitHub Pages), po nim twarde odświeżenie (Ctrl+Shift+R).

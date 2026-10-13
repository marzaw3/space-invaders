// Hexfall - zapis w chmurze (Supabase): ranking online, przerwana rozgrywka i konta graczy.
// Bez konta gracz jest zalogowany anonimowo (gość), więc zapis gry jest przypisany do tej przeglądarki.
// Założenie konta (nick + hasło) dopina e-mail i hasło do tego samego konta - zapis i wyniki zostają.
// Żadna funkcja nie rzuca wyjątku: przy braku sieci zwraca null/false/{ error }, a gra działa dalej lokalnie.
(function () {
  'use strict';

  const C = window.CONFIG;
  const L = window.Logic;
  const TABLE_SCORES = 'scores';
  const TABLE_SAVES = 'saved_games';
  const TABLE_PROFILES = 'profiles';
  const VIEW_STATS = 'player_stats';

  let client = null;
  try {
    if (window.supabase && C.supabase && C.supabase.url) {
      client = window.supabase.createClient(C.supabase.url, C.supabase.publishableKey);
    }
  } catch (e) {
    console.warn('Hexfall: nie udało się uruchomić klienta Supabase', e);
  }

  // connecting | online | offline
  let status = client ? 'connecting' : 'offline';
  // Bez zalogowania ranking da się czytać, ale nie da się w nim zapisać wyniku - to też tryb offline.
  let signInFailed = false;

  // Bieżąca sesja (gość albo konto) i profil zalogowanego: { nick, joined } albo null dla gościa.
  let session = null;
  let account = null;

  if (client) client.auth.onAuthStateChange((event, s) => { session = s; });

  async function startGuest() {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }

  // Sesja z poprzedniej wizyty jest pamiętana przez supabase-js; bez niej zaczynamy jako gość.
  const ready = (async () => {
    if (!client) return;
    try {
      const { data } = await client.auth.getSession();
      session = data.session;
      if (!session) await startGuest();
      await refreshAccount();
    } catch (e) {
      signInFailed = true;
      console.warn('Hexfall: logowanie anonimowe nie powiodło się -', e.message || e);
    }
  })();

  async function currentUserId() {
    await ready;
    return session ? session.user.id : null;
  }

  // Wykonuje zapytanie; zwraca { data } albo null przy błędzie.
  async function run(needsUser, query) {
    if (!client) return null;
    const uid = needsUser ? await currentUserId() : null;
    if (needsUser && !uid) {
      status = 'offline';
      return null;
    }
    try {
      const { data, error } = await query(uid);
      if (error) throw error;
      status = 'online';
      return { data };
    } catch (e) {
      status = 'offline';
      console.warn('Hexfall: brak połączenia z chmurą -', e.message || e);
      return null;
    }
  }

  // Nick bierzemy z profilu w bazie; metadane konta to tylko zapas, gdy profil się nie wczyta.
  async function refreshAccount() {
    const user = session && session.user;
    if (!user || user.is_anonymous) {
      account = null;
      return;
    }
    account = { nick: (user.user_metadata && user.user_metadata.nick) || '?', joined: null };
    const r = await run(true, uid => client.from(TABLE_PROFILES).select('nick, created_at').eq('user_id', uid).maybeSingle());
    if (r && r.data) account = { nick: r.data.nick, joined: r.data.created_at.slice(0, 10) };
  }

  // Błąd Supabase Auth -> kod dla ekranu logowania.
  function authError(error) {
    const code = error.code || '';
    if (code === 'user_already_exists' || code === 'email_exists') return 'nick_taken';
    if (code === 'invalid_credentials') return 'bad_credentials';
    if (code === 'weak_password') return 'weak_password';
    if (code.startsWith('over_') || error.status === 429) return 'rate_limit';
    if (error.name === 'AuthRetryableFetchError' || !error.status) return 'offline';
    console.warn('Hexfall: błąd logowania -', code, error.message);
    return 'unknown';
  }

  // Zapis, kasowanie zapisu i zmiany konta idą po kolei - inaczej skasowanie po przegranej mogłoby
  // dotrzeć do serwera przed wcześniejszym zapisem, a zapis gościa mógłby trafić już na nowe konto.
  let queue = Promise.resolve();
  function inOrder(task) {
    queue = queue.then(task);
    return queue;
  }

  // Wspólna obudowa logowania, rejestracji i wylogowania: { ok: true } albo { error }.
  function authTask(action) {
    return inOrder(async () => {
      if (!client) return { error: 'offline' };
      try {
        await ready;
        const { error } = await action();
        if (error) return { error: authError(error) };
        await refreshAccount();
        signInFailed = false;
        status = 'online';
        return { ok: true };
      } catch (e) {
        return { error: authError(e) };
      }
    });
  }

  const Cloud = {
    status() {
      return signInFailed ? 'offline' : status;
    },

    // { nick, joined } zalogowanego gracza albo null dla gościa.
    account() {
      return account;
    },

    // Gość dostaje e-mail i hasło do swojego konta (to samo user_id); bez sesji powstaje nowe konto.
    register(nick, password) {
      const email = L.nickToEmail(nick, C);
      return authTask(() => (session && session.user.is_anonymous
        ? client.auth.updateUser({ email, password, data: { nick } })
        : client.auth.signUp({ email, password, options: { data: { nick } } })));
    },

    login(nick, password) {
      return authTask(() => client.auth.signInWithPassword({ email: L.nickToEmail(nick, C), password }));
    },

    // Wylogowanie tylko tej przeglądarki; potem gramy dalej jako nowy gość.
    logout() {
      return authTask(async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) return { error };
        session = null;
        account = null;
        await startGuest();
        return {};
      });
    },

    // { nick, joined, stats: { games, bestScore, bestWave, totalScore }, history: [{ date, score, wave }] } albo null.
    async profile() {
      if (!account) return null;
      const [stats, history] = await Promise.all([
        run(true, uid => client.from(VIEW_STATS)
          .select('games, best_score, best_wave, total_score')
          .eq('user_id', uid)
          .maybeSingle()),
        run(true, uid => client.from(TABLE_SCORES)
          .select('score, wave, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(10)),
      ]);
      if (!stats || !history || !account) return null;
      const s = stats.data || { games: 0, best_score: 0, best_wave: 0, total_score: 0 };
      return {
        nick: account.nick,
        joined: account.joined,
        stats: { games: s.games, bestScore: s.best_score, bestWave: s.best_wave, totalScore: Number(s.total_score) },
        history: history.data.map(h => ({ date: h.created_at.slice(0, 10), score: h.score, wave: h.wave })),
      };
    },

    // Najlepsze wyniki wszystkich graczy: [{ id, name, score, wave, date }] albo null.
    async topScores(size) {
      const r = await run(false, () => client.from(TABLE_SCORES)
        .select('id, name, score, wave, created_at')
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(size));
      return r && r.data.map(s => ({ id: s.id, name: s.name, score: s.score, wave: s.wave, date: s.created_at.slice(0, 10) }));
    },

    // Zwraca ID nowego wpisu albo null. Zalogowanemu baza i tak wpisuje nick zamiast podanego imienia.
    async submitScore(entry) {
      const r = await run(true, () => client.from(TABLE_SCORES)
        .insert({ name: entry.name, score: entry.score, wave: entry.wave })
        .select('id')
        .single());
      return r && r.data.id;
    },

    // Zapis przerwanej gry: { state, version, score, wave } albo null (brak zapisu lub sieci).
    // Czeka na kolejkę, żeby po zmianie konta czytać już zapis nowego konta.
    loadSave() {
      return inOrder(async () => {
        const r = await run(true, uid => client.from(TABLE_SAVES)
          .select('state, state_version, score, wave')
          .eq('user_id', uid)
          .maybeSingle());
        const row = r && r.data;
        return row && { state: row.state, version: row.state_version, score: row.score, wave: row.wave };
      });
    },

    saveGame(save) {
      return inOrder(async () => !!(await run(true, uid => client.from(TABLE_SAVES).upsert({
        user_id: uid,
        state: save.state,
        state_version: save.version,
        score: save.score,
        wave: save.wave,
      }))));
    },

    deleteSave() {
      return inOrder(async () => !!(await run(true, uid => client.from(TABLE_SAVES).delete().eq('user_id', uid))));
    },
  };

  window.Cloud = Cloud;
})();

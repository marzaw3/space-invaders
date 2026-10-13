// Hexfall - zapis w chmurze (Supabase): ranking online i przerwana rozgrywka.
// Gracz loguje się anonimowo (bez ekranu logowania), więc zapis gry jest przypisany do tej przeglądarki.
// Żadna funkcja nie rzuca wyjątku: przy braku sieci zwraca null/false, a gra działa dalej lokalnie.
(function () {
  'use strict';

  const C = window.CONFIG;
  const TABLE_SCORES = 'scores';
  const TABLE_SAVES = 'saved_games';

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

  // ID zalogowanego gracza albo null; sesja z poprzedniej wizyty jest pamiętana przez supabase-js.
  const userId = (async () => {
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: signed, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      return signed.user.id;
    } catch (e) {
      signInFailed = true;
      console.warn('Hexfall: logowanie anonimowe nie powiodło się -', e.message || e);
      return null;
    }
  })();

  // Wykonuje zapytanie; zwraca { data } albo null przy błędzie.
  async function run(needsUser, query) {
    if (!client) return null;
    const uid = needsUser ? await userId : null;
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

  // Zapis i kasowanie zapisu idą po kolei - inaczej skasowanie po przegranej mogłoby
  // dotrzeć do serwera przed wcześniejszym zapisem i "przegrana" gra wróciłaby w menu.
  let saveQueue = Promise.resolve();
  function inOrder(task) {
    saveQueue = saveQueue.then(task);
    return saveQueue;
  }

  const Cloud = {
    status() {
      return signInFailed ? 'offline' : status;
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

    // Zwraca ID nowego wpisu albo null.
    async submitScore(entry) {
      const r = await run(true, () => client.from(TABLE_SCORES)
        .insert({ name: entry.name, score: entry.score, wave: entry.wave })
        .select('id')
        .single());
      return r && r.data.id;
    },

    // Zapis przerwanej gry: { state, version, score, wave } albo null (brak zapisu lub sieci).
    async loadSave() {
      const r = await run(true, uid => client.from(TABLE_SAVES)
        .select('state, state_version, score, wave')
        .eq('user_id', uid)
        .maybeSingle());
      const row = r && r.data;
      return row && { state: row.state, version: row.state_version, score: row.score, wave: row.wave };
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

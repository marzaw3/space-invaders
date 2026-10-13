-- Hexfall: ranking wyników i zapis przerwanej rozgrywki.
-- Gracze logują się anonimowo (supabase.auth.signInAnonymously) i działają jako rola `authenticated`.
-- Skrypt da się bezpiecznie uruchomić ponownie.

-- ---------- ranking ----------

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  -- set null: wynik zostaje w rankingu nawet po usunięciu starego anonimowego konta
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  name       text not null check (char_length(btrim(name)) >= 1 and char_length(name) <= 10),
  score      integer not null check (score >= 0),
  wave       integer not null check (wave >= 1),
  created_at timestamptz not null default now()
);

comment on table public.scores is 'Hexfall: wynik każdej zakończonej partii. Ranking = top 10 po score.';

create index if not exists scores_score_idx on public.scores (score desc, created_at);
create index if not exists scores_user_id_idx on public.scores (user_id);

alter table public.scores enable row level security;

revoke all on table public.scores from anon, authenticated;
grant select on table public.scores to anon, authenticated;
grant insert on table public.scores to authenticated;

drop policy if exists "Ranking widoczny dla wszystkich" on public.scores;
create policy "Ranking widoczny dla wszystkich" on public.scores
  for select to anon, authenticated
  using (true);

drop policy if exists "Gracz dopisuje tylko własny wynik" on public.scores;
create policy "Gracz dopisuje tylko własny wynik" on public.scores
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------- zapis przerwanej rozgrywki (jeden slot na gracza) ----------

create table if not exists public.saved_games (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- migawka obiektu `game`; limit chroni przed wrzucaniem śmieci
  state         jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 131072),
  state_version integer not null check (state_version >= 1),
  score         integer not null check (score >= 0),
  wave          integer not null check (wave >= 1),
  updated_at    timestamptz not null default now()
);

comment on table public.saved_games is 'Hexfall: stan przerwanej partii do wznowienia; kasowany po game over.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists saved_games_set_updated_at on public.saved_games;
create trigger saved_games_set_updated_at
  before insert or update on public.saved_games
  for each row execute function public.set_updated_at();

alter table public.saved_games enable row level security;

revoke all on table public.saved_games from anon, authenticated;
grant select, insert, update, delete on table public.saved_games to authenticated;

drop policy if exists "Gracz czyta własny zapis" on public.saved_games;
create policy "Gracz czyta własny zapis" on public.saved_games
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Gracz tworzy własny zapis" on public.saved_games;
create policy "Gracz tworzy własny zapis" on public.saved_games
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Gracz nadpisuje własny zapis" on public.saved_games;
create policy "Gracz nadpisuje własny zapis" on public.saved_games
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Gracz kasuje własny zapis" on public.saved_games;
create policy "Gracz kasuje własny zapis" on public.saved_games
  for delete to authenticated
  using ((select auth.uid()) = user_id);

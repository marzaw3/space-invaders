-- Hexfall: konta graczy (nick + hasło) i profil ze statystykami.
-- Gracz bez konta dalej gra anonimowo. Założenie konta = anonimowe konto dostaje e-mail i hasło
-- (to samo user_id, więc zapis gry i wyniki zostają). E-mail jest techniczny, wyliczony z nicka
-- tak samo jak w js/logic.js (nickToEmail): 'u' + hex(utf8(lower(nick))) + '@hexfall.invalid'.
-- Skrypt da się bezpiecznie uruchomić ponownie.

-- ---------- profil ----------

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nick       text not null check (char_length(nick) between 3 and 10 and nick ~ '^[[:alpha:][:digit:]_-]+$'),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Hexfall: profil gracza z kontem. Tworzy go wyłącznie trigger na auth.users.';

-- Nick unikalny bez względu na wielkość liter (Merlin = merlin).
create unique index if not exists profiles_nick_lower_idx on public.profiles (lower(nick));

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Gracz czyta własny profil" on public.profiles;
create policy "Gracz czyta własny profil" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- nick -> e-mail ----------

create or replace function public.nick_email(nick text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'u' || encode(convert_to(lower(nick), 'UTF8'), 'hex') || '@hexfall.invalid';
$$;

revoke execute on function public.nick_email(text) from public, anon, authenticated;

-- Tworzy profil, gdy konto dostaje e-mail (rejestracja), i pilnuje zgodności e-maila z nickiem -
-- inaczej dałoby się przez API zmienić e-mail na wyliczony z cudzego nicka i zająć jego login.
-- Wyjątek przerywa całą rejestrację, więc nie zostaje "pół konta".
create or replace function public.handle_account_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_nick text;
  wanted_nick  text;
begin
  if coalesce(new.email, '') = '' then
    return new; -- konto anonimowe
  end if;

  select p.nick into profile_nick from public.profiles p where p.user_id = new.id;
  if found then
    if new.email is distinct from public.nick_email(profile_nick) then
      raise exception 'Hexfall: e-mail konta musi odpowiadać nickowi' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  wanted_nick := new.raw_user_meta_data ->> 'nick';
  if wanted_nick is null or new.email is distinct from public.nick_email(wanted_nick) then
    raise exception 'Hexfall: rejestracja wymaga nicka zgodnego z e-mailem' using errcode = 'check_violation';
  end if;

  insert into public.profiles (user_id, nick) values (new.id, wanted_nick);
  return new;
end;
$$;

revoke execute on function public.handle_account_email() from public, anon, authenticated;

drop trigger if exists hexfall_account_email on auth.users;
create trigger hexfall_account_email
  after insert or update of email on auth.users
  for each row execute function public.handle_account_email();

-- ---------- ranking: zalogowany gracz zawsze pod swoim nickiem ----------

create or replace function public.scores_use_nick()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  profile_nick text;
begin
  select p.nick into profile_nick from public.profiles p where p.user_id = new.user_id;
  if profile_nick is not null then
    new.name := profile_nick;
  end if;
  return new;
end;
$$;

revoke execute on function public.scores_use_nick() from public, anon, authenticated;

drop trigger if exists scores_use_nick on public.scores;
create trigger scores_use_nick
  before insert on public.scores
  for each row execute function public.scores_use_nick();

-- ---------- statystyki gracza ----------

-- Liczone na bieżąco z rankingu (partie z wynikiem > 0), więc nie ma osobnych liczników do rozjechania.
create or replace view public.player_stats
with (security_invoker = true) as
select
  user_id,
  count(*)::integer as games,
  max(score)        as best_score,
  max(wave)         as best_wave,
  sum(score)        as total_score
from public.scores
where user_id is not null
group by user_id;

comment on view public.player_stats is 'Hexfall: statystyki gracza do ekranu profilu.';

revoke all on table public.player_stats from anon, authenticated;
grant select on table public.player_stats to authenticated;

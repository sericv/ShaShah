alter table public.persistent_rooms
  add column if not exists room_type text default 'normal' check (room_type in ('normal', 'cinema')),
  add column if not exists tmdb_id integer,
  add column if not exists title text,
  add column if not exists poster_path text,
  add column if not exists backdrop_path text,
  add column if not exists release_year text,
  add column if not exists vote_average numeric,
  add column if not exists runtime integer,
  add column if not exists stream_url text;

create index if not exists persistent_rooms_room_type_idx on public.persistent_rooms(room_type);

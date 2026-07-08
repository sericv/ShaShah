-- Schema v6: Social Movie Profiles
-- Extends existing profiles with social movie features (Letterboxd/Discord/Steam style)

-- ============================================================
-- 1. EXTEND EXISTING profiles TABLE
-- ============================================================
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists favorite_movie_id text;
alter table public.profiles add column if not exists favorite_movie_title text;
alter table public.profiles add column if not exists favorite_movie_poster text;
alter table public.profiles add column if not exists favorite_series_id text;
alter table public.profiles add column if not exists favorite_series_title text;
alter table public.profiles add column if not exists favorite_series_poster text;
alter table public.profiles add column if not exists series_watched integer default 0;
alter table public.profiles add column if not exists watchlist_count integer default 0;
alter table public.profiles add column if not exists total_watch_time integer default 0;
alter table public.profiles add column if not exists achievements_count integer default 0;

-- ============================================================
-- 2. EXTEND EXISTING user_settings TABLE (privacy)
-- ============================================================
alter table public.user_settings add column if not exists hide_watch_history boolean default false;
alter table public.user_settings add column if not exists hide_watchlist boolean default false;
alter table public.user_settings add column if not exists hide_ratings boolean default false;
alter table public.user_settings add column if not exists hide_activity boolean default false;

-- ============================================================
-- 3. movie_ratings TABLE
-- ============================================================
create table if not exists public.movie_ratings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tmdb_id text not null,
  media_type text default 'movie',
  rating integer not null check (rating >= 1 and rating <= 10),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, tmdb_id)
);

-- ============================================================
-- 4. reviews TABLE
-- ============================================================
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tmdb_id text not null,
  media_type text default 'movie',
  content text not null,
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, tmdb_id)
);

-- ============================================================
-- 5. activity_log TABLE
-- ============================================================
create table if not exists public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  activity_type text not null,
  tmdb_id text,
  media_type text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists activity_log_user_id_idx on public.activity_log(user_id);
create index if not exists activity_log_created_at_idx on public.activity_log(created_at desc);

-- ============================================================
-- 6. achievements TABLE
-- ============================================================
create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  requirement_type text not null,
  requirement_value integer not null
);

-- ============================================================
-- 7. user_achievements TABLE
-- ============================================================
create table if not exists public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_id text references public.achievements(id) on delete cascade not null,
  unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, achievement_id)
);

-- ============================================================
-- 8. library EXTENSION: add rating column
-- ============================================================
alter table public.library add column if not exists rating integer check (rating >= 1 and rating <= 10);
alter table public.library add column if not exists progress integer default 0 check (progress >= 0 and progress <= 100);

-- ============================================================
-- SEED ACHIEVEMENTS
-- ============================================================
insert into public.achievements (id, name, description, icon, requirement_type, requirement_value) values
  ('first_movie', 'أول فيلم', 'شاهد فيلمك الأول', '🎬', 'movies_watched', 1),
  ('movie_lover', 'عاشق أفلام', 'شاهد 10 أفلام', '🍿', 'movies_watched', 10),
  ('cinema_master', 'خبير سينما', 'شاهد 50 فيلماً', '🏆', 'movies_watched', 50),
  ('movie_addict', 'مدمن أفلام', 'شاهد 100 فيلم', '💎', 'movies_watched', 100),
  ('first_series', 'أول مسلسل', 'شاهد مسلسلك الأول', '📺', 'series_watched', 1),
  ('series_addict', 'مدمن مسلسلات', 'شاهد 10 مسلسلات', '📀', 'series_watched', 10),
  ('binge_watcher', 'مشاهدم نهم', 'شاهد 25 مسلسلاً', '🔥', 'series_watched', 25),
  ('first_review', 'أول مراجعة', 'اكتب أول مراجعة لك', '✍️', 'reviews_written', 1),
  ('critic', 'ناقد', 'اكتب 10 مراجعات', '📝', 'reviews_written', 10),
  ('night_owl', 'بومة الليل', 'شاهد فيلماً بعد منتصف الليل', '🦉', 'night_watch', 1),
  ('weekend_watcher', 'مشاهد نهاية الأسبوع', 'شاهد 3 أفلام في عطلة نهاية أسبوع واحدة', '🌟', 'weekend_watch', 1),
  ('social_butterfly', 'فراشة اجتماعية', 'أضف 5 أصدقاء', '🦋', 'friends_count', 5),
  ('popular', 'شخصية مشهورة', 'أضف 20 صديقاً', '⭐', 'friends_count', 20),
  ('collector', 'جامع', 'أضف 50 فيلماً للمفضلة', '📚', 'favorites_count', 50),
  ('early_supporter', 'داعم مبكر', 'انضم إلى شاشة في الأيام الأولى', '🌅', 'early_adopter', 1),
  ('founder', 'مؤسس', 'أنشئ أول غرفة سينما', '👑', 'rooms_created', 1),
  ('watchlist_curator', 'منسق قائمة', 'أضف 20 فيلماً لقائمة المشاهدة', '📋', 'watchlist_count', 20),
  ('completionist', 'مكتمل', 'أكمل 5 مسلسلات كاملة', '✅', 'series_completed', 5)
on conflict (id) do nothing;

-- ============================================================
-- ENABLE RLS
-- ============================================================
alter table public.movie_ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.activity_log enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- ============================================================
-- RLS POLICIES
--
-- Rules:
--   SELECT  → USING
--   INSERT  → WITH CHECK  (ONLY)
--   UPDATE  → USING (old row) + WITH CHECK (new row, optional)
--   DELETE  → USING
--   FOR ALL → split into separate SELECT / INSERT / UPDATE / DELETE
-- ============================================================

-- movie_ratings
drop policy if exists "Allow users to read all ratings" on public.movie_ratings;
drop policy if exists "Allow users to insert own ratings" on public.movie_ratings;
drop policy if exists "Allow users to update own ratings" on public.movie_ratings;
drop policy if exists "Allow users to delete own ratings" on public.movie_ratings;
create policy "Allow users to read all ratings" on public.movie_ratings for select using (true);
create policy "Allow users to insert own ratings" on public.movie_ratings for insert with check (auth.uid() = user_id);
create policy "Allow users to update own ratings" on public.movie_ratings for update using (auth.uid() = user_id);
create policy "Allow users to delete own ratings" on public.movie_ratings for delete using (auth.uid() = user_id);

-- reviews
drop policy if exists "Allow users to read all reviews" on public.reviews;
drop policy if exists "Allow users to insert own reviews" on public.reviews;
drop policy if exists "Allow users to update own reviews" on public.reviews;
drop policy if exists "Allow users to delete own reviews" on public.reviews;
create policy "Allow users to read all reviews" on public.reviews for select using (true);
create policy "Allow users to insert own reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Allow users to update own reviews" on public.reviews for update using (auth.uid() = user_id);
create policy "Allow users to delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

-- activity_log
drop policy if exists "Allow users to read all activity" on public.activity_log;
drop policy if exists "Allow users to insert own activity" on public.activity_log;
create policy "Allow users to read all activity" on public.activity_log for select using (true);
create policy "Allow users to insert own activity" on public.activity_log for insert with check (auth.uid() = user_id);

-- achievements (read-only for all authenticated users, no insert/update/delete)
drop policy if exists "Allow users to read achievements" on public.achievements;
create policy "Allow users to read achievements" on public.achievements for select using (true);

-- user_achievements
drop policy if exists "Allow users to read own achievements" on public.user_achievements;
drop policy if exists "Allow users to insert own achievements" on public.user_achievements;
drop policy if exists "Allow users to delete own achievements" on public.user_achievements;
create policy "Allow users to read own achievements" on public.user_achievements for select using (auth.uid() = user_id);
create policy "Allow users to insert own achievements" on public.user_achievements for insert with check (auth.uid() = user_id);
create policy "Allow users to delete own achievements" on public.user_achievements for delete using (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: log_activity (helper)
-- ============================================================
create or replace function public.log_activity(
  p_user_id uuid,
  p_activity_type text,
  p_tmdb_id text default null,
  p_media_type text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.activity_log (user_id, activity_type, tmdb_id, media_type, metadata)
  values (p_user_id, p_activity_type, p_tmdb_id, p_media_type, p_metadata);
end;
$$;

-- public.profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  username text unique,
  avatar_url text,
  banner_url text,
  bio text,
  movies_watched integer default 0,
  hours_watched integer default 0,
  favorite_genre text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotent column addition for existing tables
alter table public.profiles add column if not exists username text unique;

-- Index for username search optimization
create index if not exists profiles_username_idx on public.profiles(username);

-- public.friends table
create table if not exists public.friends (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  friend_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

-- public.friend_requests table
create table if not exists public.friend_requests (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sender_id, receiver_id)
);

-- public.persistent_rooms table (for v2 persistent rooms)
create table if not exists public.persistent_rooms (
  id text primary key,
  name text not null,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- public.room_members table
create table if not exists public.room_members (
  id uuid default gen_random_uuid() primary key,
  room_id text references public.persistent_rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, user_id)
);

-- public.favorites table
create table if not exists public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  movie_id text not null,
  movie_title text not null,
  poster_path text,
  media_type text default 'movie',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, movie_id)
);

-- public.library table
create table if not exists public.library (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  movie_id text not null,
  movie_title text not null,
  poster_path text,
  media_type text default 'movie',
  status text check (status in ('watched', 'watching', 'watchlist')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, movie_id)
);

-- public.notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  type text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- public.user_settings table
create table if not exists public.user_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  sound_muted boolean default false,
  theme text default 'dark',
  language text default 'ar',
  privacy_status text default 'public'
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.persistent_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.favorites enable row level security;
alter table public.library enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

-- RLS Policies (Idempotent: Drop if exists before creating)
drop policy if exists "Allow users to read all profiles" on public.profiles;
drop policy if exists "Allow users to insert own profile" on public.profiles;
drop policy if exists "Allow users to update own profile" on public.profiles;
create policy "Allow users to read all profiles" on public.profiles for select using (true);
create policy "Allow users to insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Allow users to update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Allow users to manage own friends" on public.friends;
create policy "Allow users to manage own friends" on public.friends for all using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Allow users to manage own friend requests" on public.friend_requests;
create policy "Allow users to manage own friend requests" on public.friend_requests for all using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Allow users to read all persistent rooms" on public.persistent_rooms;
drop policy if exists "Allow creator to manage room" on public.persistent_rooms;
create policy "Allow users to read all persistent rooms" on public.persistent_rooms for select using (true);
create policy "Allow creator to manage room" on public.persistent_rooms for all using (auth.uid() = creator_id);

drop policy if exists "Allow users to view room members" on public.room_members;
drop policy if exists "Allow users to manage own room membership" on public.room_members;
create policy "Allow users to view room members" on public.room_members for select using (true);
create policy "Allow users to manage own room membership" on public.room_members for all using (auth.uid() = user_id);

drop policy if exists "Allow users to manage own favorites" on public.favorites;
create policy "Allow users to manage own favorites" on public.favorites for all using (auth.uid() = user_id);

drop policy if exists "Allow users to manage own library" on public.library;
create policy "Allow users to manage own library" on public.library for all using (auth.uid() = user_id);

drop policy if exists "Allow users to manage own notifications" on public.notifications;
create policy "Allow users to manage own notifications" on public.notifications for all using (auth.uid() = user_id);

drop policy if exists "Allow users to manage own settings" on public.user_settings;
create policy "Allow users to manage own settings" on public.user_settings for all using (auth.uid() = user_id);

-- Profile creation trigger function (hardened)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || floor(random() * 1000)::text),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger definition
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- BACKFILL: Automatically create missing profiles and settings for any existing users
insert into public.profiles (id, name, username, avatar_url)
select 
  id,
  coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1) || '_' || floor(random() * 1000)::text),
  coalesce(raw_user_meta_data->>'avatar_url', '')
from auth.users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- 1. Create push_subscriptions table
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text,
  device_name text,
  browser text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_seen timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, endpoint)
);

-- Index for querying user subscriptions efficiently
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- 2. Idempotently add notification preferences to user_settings
alter table public.user_settings add column if not exists notify_room_invites boolean default true;
alter table public.user_settings add column if not exists notify_friend_requests boolean default true;
alter table public.user_settings add column if not exists notify_messages boolean default true;
alter table public.user_settings add column if not exists notify_calls boolean default true;
alter table public.user_settings add column if not exists notify_system boolean default true;

-- 3. Enable RLS on push_subscriptions
alter table public.push_subscriptions enable row level security;

-- 4. RLS Policies (Idempotently drop and create)
drop policy if exists "Allow users to read own subscriptions" on public.push_subscriptions;
create policy "Allow users to read own subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Allow users to manage own subscriptions" on public.push_subscriptions;
create policy "Allow users to manage own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);

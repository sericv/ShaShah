-- 1. Create notification_tokens table to store Firebase FCM tokens
create table if not exists public.notification_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  token text not null,
  platform text,
  browser text,
  device_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_seen timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, token)
);

-- Index for querying user tokens efficiently
create index if not exists notification_tokens_user_id_idx on public.notification_tokens(user_id);

-- 2. Enable RLS on notification_tokens
alter table public.notification_tokens enable row level security;

-- 3. RLS Policies
drop policy if exists "Allow users to read own tokens" on public.notification_tokens;
create policy "Allow users to read own tokens" on public.notification_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "Allow users to manage own tokens" on public.notification_tokens;
create policy "Allow users to manage own tokens" on public.notification_tokens
  for all using (auth.uid() = user_id);

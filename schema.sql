-- Create rooms table
create table if not exists public.rooms (
  id text primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  room_id text references public.rooms(id) on delete cascade not null,
  sender_id uuid not null,
  sender_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster room message retrieval
create index if not exists messages_room_id_idx on public.messages(room_id);

-- Enable Row Level Security (RLS)
alter table public.rooms enable row level security;
alter table public.messages enable row level security;

-- Drop existing policies if they exist (to avoid replication issues)
drop policy if exists "Allow public access to rooms" on public.rooms;
drop policy if exists "Allow public access to messages" on public.messages;

-- Create permissive RLS policies for anonymous access
create policy "Allow public access to rooms" on public.rooms
  for all using (true) with check (true);

create policy "Allow public access to messages" on public.messages
  for all using (true) with check (true);

-- Run this SQL in Supabase Dashboard -> SQL Editor

-- Create projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'Untitled Project',
  description text,
  slide_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.projects enable row level security;

-- RLS Policies: all scoped to auth.uid() = user_id

create policy "Users can view their own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects
  for delete
  using (auth.uid() = user_id);

-- Index for efficient user-scoped queries
create index projects_user_id_idx on public.projects(user_id);

-- Trigger function to auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to call the function on update
create trigger projects_updated_at
  before update on public.projects
  for each row
  execute function public.handle_updated_at();

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  code_hash text not null unique,
  plan text not null,
  duration_days integer not null check (duration_days > 0),
  status text not null default 'unused' check (status in ('unused','active','expired','revoked')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.subscription_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists subscriptions_expires_idx on public.subscriptions(expires_at);
create index if not exists sessions_token_hash_idx on public.subscription_sessions(token_hash);
create index if not exists sessions_expires_idx on public.subscription_sessions(expires_at);

alter table public.subscriptions enable row level security;
alter table public.subscription_sessions enable row level security;
alter table public.admin_users enable row level security;

-- All subscription/session/admin mutations happen through Edge Functions.
-- No public browser policy is created.

create or replace function public.refresh_expired_subscriptions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and expires_at is not null
    and expires_at <= now();
$$;

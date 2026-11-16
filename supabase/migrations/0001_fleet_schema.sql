-- TripTribe-AI — fleet Supabase schema (MongoDB cutover).
--
-- The app used to write five Mongo collections in the `triptribe` database:
-- users, itenaries, placecaches, usage and planCache. Each becomes one table
-- with an identical, minimal shape:
--
--   id         text primary key   -- the Mongo _id (or the string bucket key)
--   data       jsonb not null     -- the whole document, field names unchanged
--   created_at timestamptz        -- row bookkeeping
--   updated_at timestamptz
--
-- Keeping the payload in `data` is deliberate: the repositories already own
-- validation in `src/server/domain/plan/schema.ts` and `src/server/db/documents.ts`,
-- so a second column-level schema here would only disagree with them. The
-- compatibility layer in `frontend/src/server/db/mongo.ts` translates
-- `data->>field` filters and Mongo update operators onto these columns.
--
-- RLS is enabled and permissive for anon/authenticated/service_role: the
-- server uses the service-role key over the public HTTP gateway (raw Postgres
-- is unreachable from Coolify), so writes must not be blocked by RLS. Tighten
-- these policies when per-user auth is enforced at the row level.

create table if not exists public.users (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_cache (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_cache (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Expression indexes for the fields the existing repositories filter on.
create index if not exists users_auth_id_idx on public.users ((data->>'authId'));
create index if not exists trips_uuid_idx on public.trips ((data->>'uuid'));
create index if not exists trips_user_id_idx on public.trips ((data->>'userId'));
create index if not exists place_cache_place_id_idx on public.place_cache ((data->>'placeId'));

alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.place_cache enable row level security;
alter table public.usage enable row level security;
alter table public.plan_cache enable row level security;

-- Permissive policies: every role may read and write every row. Idempotent:
-- drop first so re-running the migration does not stack duplicate policies.
do $$
declare
  t text;
begin
  foreach t in array array['users', 'trips', 'place_cache', 'usage', 'plan_cache'] loop
    execute format('drop policy if exists "%1$s_full_access" on public.%1$s', t);
    execute format(
      'create policy "%1$s_full_access" on public.%1$s for all ' ||
      'to anon, authenticated, service_role using (true) with check (true)',
      t
    );
  end loop;
end $$;

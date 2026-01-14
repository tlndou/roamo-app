-- Add location_permission field to profiles.
-- Tracks user's location permission preference: 'unknown' | 'granted' | 'denied'
-- This prevents repeated browser prompts and respects user intent.

alter table public.profiles
  add column if not exists location_permission text default 'unknown'
  check (location_permission in ('unknown', 'granted', 'denied'));

-- Add an index for potential filtering
create index if not exists profiles_location_permission_idx on public.profiles (location_permission);

-- Comment for documentation
comment on column public.profiles.location_permission is 'User location permission state: unknown (default), granted, or denied';

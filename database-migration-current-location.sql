-- Add current location tracking fields to profiles.
-- Stores user's detected city/country when the app is opened (foreground only).
-- last_seen_city tracks the previous city for travel detection.

alter table public.profiles
  add column if not exists current_city text,
  add column if not exists current_country text,
  add column if not exists current_lat double precision,
  add column if not exists current_lng double precision,
  add column if not exists last_seen_city text,
  add column if not exists location_updated_at timestamptz;

-- Index for potential queries on current location
create index if not exists profiles_current_city_idx on public.profiles (current_city);
create index if not exists profiles_current_country_idx on public.profiles (current_country);

-- Comments for documentation
comment on column public.profiles.current_city is 'User detected city from reverse geocoding (foreground only)';
comment on column public.profiles.current_country is 'User detected country from reverse geocoding';
comment on column public.profiles.current_lat is 'Last known latitude coordinate';
comment on column public.profiles.current_lng is 'Last known longitude coordinate';
comment on column public.profiles.last_seen_city is 'Previous city before current (for travel detection)';
comment on column public.profiles.location_updated_at is 'Timestamp of last location check';

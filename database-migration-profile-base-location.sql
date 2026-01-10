-- Add base location fields to profiles.
-- City/town only (no street addresses); store canonical metro city + country + coordinates for future features.

alter table public.profiles
  add column if not exists base_city text,
  add column if not exists base_country text,
  add column if not exists base_continent text,
  add column if not exists base_canonical_city_id text,
  add column if not exists base_lat double precision,
  add column if not exists base_lng double precision;

create index if not exists profiles_base_canonical_city_id_idx on public.profiles (base_canonical_city_id);



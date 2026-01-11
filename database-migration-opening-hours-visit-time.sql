-- Opening hours + suggested visiting time fields for spots.
-- - opening_hours: structured JSON (provider/user supplied; never inferred)
-- - recommended_visit_time: broad label (only when hours missing), with explicit source/confidence

alter table public.spots
  add column if not exists opening_hours jsonb,
  add column if not exists opening_hours_source text,
  add column if not exists recommended_visit_time text,
  add column if not exists visit_time_source text,
  add column if not exists visit_time_confidence text;

create index if not exists spots_recommended_visit_time_idx on public.spots (recommended_visit_time);



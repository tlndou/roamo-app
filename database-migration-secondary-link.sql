-- Optional second link for spots.

alter table public.spots
  add column if not exists link2 text;



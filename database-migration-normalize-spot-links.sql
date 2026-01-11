-- Normalize spot link fields:
-- - Treat blank/whitespace as NULL (not empty string)
-- - Backfill existing rows
-- - Enforce going forward with a trigger (server-side)

-- Backfill
update public.spots
set
  link = nullif(btrim(link), ''),
  link2 = nullif(btrim(link2), '')
where
  link is not null or link2 is not null;

-- Enforce on insert/update
create or replace function public.normalize_spot_links()
returns trigger
language plpgsql
as $$
begin
  new.link := nullif(btrim(new.link), '');
  new.link2 := nullif(btrim(new.link2), '');
  return new;
end;
$$;

drop trigger if exists normalize_spot_links_trigger on public.spots;
create trigger normalize_spot_links_trigger
before insert or update on public.spots
for each row execute function public.normalize_spot_links();



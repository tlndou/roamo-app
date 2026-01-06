-- Prevent changing username after it has been set once.
-- This is optional but recommended so immutability is enforced server-side, not just in the UI.
--
-- Run in Supabase SQL editor.

create or replace function public.prevent_username_change()
returns trigger
language plpgsql
as $$
begin
  -- Allow initial set when old username is null/empty.
  if (coalesce(old.username, '') <> '' and new.username is distinct from old.username) then
    raise exception 'username is immutable once set';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_username_change on public.profiles;
create trigger trg_prevent_username_change
before update on public.profiles
for each row
execute function public.prevent_username_change();



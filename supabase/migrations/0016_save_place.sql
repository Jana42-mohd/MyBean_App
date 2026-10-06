-- 0016: fix "permission denied for table neighbor_profiles" when saving the place in Settings. Run AFTER 0001-0015.
--
-- The app saved the place with an "upsert" (insert, or update if it exists). To update, PostgREST also writes the key
-- column user_id, and that column is (deliberately) not updatable by people. Saving now goes through one function that
-- always writes the signed-in person's own row, so the table can stay locked down.

create function public.save_place(p_country text, p_city text, p_region text, p_area text, p_discoverable boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  insert into public.neighbor_profiles (user_id, country, city, region, area, discoverable)
  values (me, nullif(btrim(p_country), ''), nullif(btrim(p_city), ''), case when nullif(btrim(p_city), '') is null then null else nullif(btrim(p_region), '') end,
          nullif(btrim(p_area), ''), coalesce(p_discoverable, false))
  on conflict (user_id) do update
    set country = excluded.country, city = excluded.city, region = excluded.region, area = excluded.area, discoverable = excluded.discoverable;
end $$;

revoke execute on function public.save_place(text, text, text, text, boolean) from public, anon;

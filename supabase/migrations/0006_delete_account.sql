-- 0006: let a signed-in user delete their own account (required by the App Store and Google Play).
-- Run AFTER 0001-0005.
--
-- What happens:
--  * Everything personal is deleted: profile, survey, wellbeing check-ins, pumping logs, community posts,
--    likes, saves, reports.
--  * If a partner is still in the household, the shared baby history stays: the babies remain and the
--    logs this parent entered are handed to the partner so the history is not lost.
--  * If nobody else is in the household, the household, its babies and all their logs are deleted.

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  hh uuid;
  heir uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select household_id into hh from public.profiles where id = uid;
  select id into heir from public.profiles where household_id = hh and id <> uid order by created_at limit 1;

  if heir is not null then
    -- keep the baby's shared history for the remaining parent (pumping is personal, so it is deleted below)
    update public.logs set user_id = heir where user_id = uid and type <> 'pumping';
  end if;

  delete from auth.users where id = uid;  -- cascades to the profile and everything that references it

  if hh is not null and not exists (select 1 from public.profiles where household_id = hh) then
    delete from public.households where id = hh;
  end if;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

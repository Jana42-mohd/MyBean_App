-- Test helpers (schema "t"). Used by the *.test.sql files, each of which runs inside a transaction that is rolled back.
create schema t;
grant usage on schema t to anon, authenticated;

create function t.mkuser(uid uuid, uname text) returns void language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, uname || '@test.dev', jsonb_build_object('name', uname));
end $$;

-- act as a signed-in user / as the database owner / as a signed-out visitor
create function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;
create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;
create function t.owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function t.eq(actual text, expected text, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: %: expected [%] but got [%]', label, expected, actual;
  end if;
end $$;

-- the statement must raise an error (the point of most security checks)
create function t.fails(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL: % (expected an error, but it succeeded)', label;
end $$;

-- the statement must succeed
create function t.ok(q text, label text) returns void language plpgsql as $$
begin
  execute q;
exception when others then
  raise exception 'FAIL: % (unexpected error: %)', label, sqlerrm;
end $$;

-- ids used across tests
create function t.u(n int) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-00000000000' || n)::uuid
$$;

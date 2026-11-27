-- Run against a migrated development database as postgres; all fixtures roll back.
begin;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$
declare rev integer;
begin
  rev := public.save_workspace(auth.uid(), '{"version":1,"items":[],"saved":[]}', 0);
  assert rev = 1, 'First save must create revision 1';
  rev := public.save_workspace(auth.uid(), '{"version":1,"items":[],"saved":[]}', rev);
  assert rev = 2, 'Subsequent save must increment the revision';
  begin
    perform public.save_workspace(auth.uid(), '{"version":1,"items":[],"saved":[]}', 1);
    raise exception 'A stale write was accepted';
  exception when serialization_failure then null;
  end;
  assert (select revision from public.workspaces where user_id = auth.uid()) = 2,
    'A rejected save must not modify the row';
  begin
    perform public.save_workspace('00000000-0000-0000-0000-000000000002', '{"version":1,"items":[],"saved":[]}', 0);
    raise exception 'A request for a previous account was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_workspace(auth.uid(), '{"items":[],"saved":[]}', 2);
    raise exception 'Missing workspace version was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_workspace(auth.uid(), '{"version":null,"items":[],"saved":[]}', 2);
    raise exception 'Null workspace version was accepted';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$
declare affected integer;
begin
  assert (select count(*) from public.workspaces) = 0, 'Another account can read private data';
  update public.workspaces set revision = 999 where user_id = '00000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  assert affected = 0, 'Another account can modify private data';
  begin
    insert into public.workspaces (user_id, data) values
      ('00000000-0000-0000-0000-000000000001', '{"version":1,"items":[],"saved":[]}');
    raise exception 'Another account can insert private data';
  exception when insufficient_privilege then null;
  end;
  assert public.save_workspace(auth.uid(), '{"version":1,"items":[],"saved":[]}', 0) = 1,
    'The second account cannot create its own workspace';
  assert (select count(*) from public.workspaces) = 1, 'Account isolation failed';
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform * from public.workspaces;
    raise exception 'Anonymous users can read workspaces';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_workspace('00000000-0000-0000-0000-000000000001', '{"version":1,"items":[],"saved":[]}', 0);
    raise exception 'Anonymous users can save workspaces';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;

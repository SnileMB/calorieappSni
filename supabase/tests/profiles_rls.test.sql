-- pgTAP cross-account RLS isolation test for public.profiles.
-- Proves a signed-in user cannot read, update, or delete another user's row
-- (single-account testing proves nothing per 01-RESEARCH.md Pitfall 3).

begin;

select plan(6);

-- Two throwaway users, inserted directly into auth.users.
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@example.test', 'authenticated', 'authenticated');

-- Bypass RLS for setup inserts (still running as the migration/superuser role here).
insert into public.profiles (id, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'User B');

-- RLS must be enabled on the table.
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'profiles'),
  'RLS is enabled on public.profiles'
);

-- Switch to the authenticated role, scoped as user A via request.jwt.claims.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- A can see exactly one row: their own.
select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ select '11111111-1111-1111-1111-111111111111'::uuid $$,
  'user A sees exactly one profile row: their own'
);

-- A cannot see B's row.
select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'user A cannot select user B''s profile row'
);

-- A's attempt to update B's row affects zero rows.
select results_eq(
  $$ with upd as (
       update public.profiles set display_name = 'hacked'
       where id = '22222222-2222-2222-2222-222222222222'
       returning id
     )
     select count(*) from upd $$,
  $$ select 0::bigint $$,
  'user A updating user B''s row affects zero rows'
);

-- A's attempt to delete B's row affects zero rows.
select results_eq(
  $$ with del as (
       delete from public.profiles
       where id = '22222222-2222-2222-2222-222222222222'
       returning id
     )
     select count(*) from del $$,
  $$ select 0::bigint $$,
  'user A deleting user B''s row affects zero rows'
);

-- A can update their own row (proves the policy isn't just blocking everything).
select results_eq(
  $$ with upd as (
       update public.profiles set display_name = 'User A Updated'
       where id = '11111111-1111-1111-1111-111111111111'
       returning id
     )
     select count(*) from upd $$,
  $$ select 1::bigint $$,
  'user A updating their own row affects exactly one row'
);

select * from finish();

rollback;

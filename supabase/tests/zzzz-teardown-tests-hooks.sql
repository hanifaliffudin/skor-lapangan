-- Let the Supabase CLI remove pgTAP cleanly after the test run.

begin;
select plan(1);
select ok(true, 'Post-test hook completed successfully');
select * from finish();
rollback;

drop extension if exists "basejump-supabase_test_helpers";

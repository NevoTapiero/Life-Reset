// Runs the chest migration in an in-memory Postgres against minimal tables.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/unclaimed-rewards.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p).then((r) => r.rows);
// minimal stand-ins for the real tables and auth
await db.exec(`
  create schema auth; create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table profiles (id uuid primary key, xp int not null default 0);
  create table xp_ledger (id bigint generated always as identity primary key, user_id uuid, source text, ref text, xp int not null default 0, reason text, meta jsonb not null default '{}', created_at timestamptz default now(), unique (user_id, source, ref));
  create table quest_completions (id bigint generated always as identity primary key, user_id uuid, quest_id text, completed_on date, xp_awarded int not null default 0);
  insert into profiles (id, xp) values ('00000000-0000-0000-0000-000000000001', 100);
  insert into xp_ledger (user_id, source, ref, xp) values ('00000000-0000-0000-0000-000000000001', 'seed', 'start', 100);
  -- recalc_player's total, as in the real one (completions + ledger, floored at zero)
  create function recalc_player(p_uid uuid) returns void language sql as $$
    update profiles set xp = greatest(0,
      coalesce((select sum(xp_awarded) from quest_completions where user_id = p_uid), 0)
    + coalesce((select sum(xp) from xp_ledger where user_id = p_uid), 0)) where id = p_uid $$;
  set test.uid = '00000000-0000-0000-0000-000000000001';
`);
await db.exec(readFileSync(new URL("../migrations/2026-09-30-unclaimed-rewards.sql", import.meta.url), "utf8"));
const U = "00000000-0000-0000-0000-000000000001";
const prof = async () => (await q("select xp, gold from profiles where id = $1", [U]))[0];
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };

await q("select award_external_xp($1, 'health_steps', 'steps:1', 12, '12k steps')", [U]);
await q("select award_external_xp($1, 'whoop_sleep', 'sleep:1', 30, 'slept well')", [U]);
await q("select award_external_xp($1, 'whoop_recovery', 'rec:1', -20, 'in the red')", [U]); // XP never goes down
await q("select award_external_xp($1, 'google_tasks', 'task:1', 10, 'task')", [U]);
let p = await prof();
assert(p.xp === 100 + 10 && p.gold === 0, `band rewards wait, a bad night takes nothing, a task lands now (xp ${p.xp})`);
const pending = (await q("select coalesce(sum(pending_xp),0)::int as n from xp_ledger where user_id = $1", [U]))[0].n;
assert(pending === 42, `42 waiting in the chest (${pending})`);
await q("select rescore_external_xp($1, 'whoop_sleep', 'sleep:1', 40, null, null)", [U]);
assert((await prof()).xp === 110, "re-scoring a chest item doesn't touch XP");
const got = (await q("select collect() as r"))[0].r;
p = await prof();
assert(got.xp === 52 && p.xp === 162 && p.gold === 52, `collect pays 52 XP + 52 gold (xp ${p.xp}, gold ${p.gold})`);
assert((await q("select collect() as r"))[0].r.xp === 0, "collecting twice pays nothing");
await q("insert into quest_completions (user_id, quest_id, completed_on, xp_awarded) values ($1, 'q', current_date, 0)", [U]);
await q("update quest_completions set xp_awarded = 30 where user_id = $1", [U]);
assert((await prof()).gold === 82, "a mission pays gold as it's priced");
await q("delete from quest_completions where user_id = $1", [U]);
assert((await prof()).gold === 52, "unchecking takes its gold back");
console.log("all good");

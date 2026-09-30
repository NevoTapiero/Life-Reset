// Runs the chest migration in an in-memory Postgres against minimal tables.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/xp-chest.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p).then((r) => r.rows);
// minimal stand-ins for the real tables and auth
// the real pricing helpers, straight from Nevo's migrations
const fn = (file, name) => {
  const t = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8");
  const i = t.indexOf(`create or replace function public.${name}(`);
  return t.slice(i, t.indexOf("$$;", t.indexOf("$$", t.indexOf("as $$", i) + 5)) + 3);
};
await db.exec(`
  create schema auth; create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table profiles (id uuid primary key, xp int not null default 0);
  create table quests (id text primary key, xp int not null, period text not null default 'daily');
  create table xp_ledger (id bigint generated always as identity primary key, user_id uuid, source text, ref text, xp int not null default 0, reason text, meta jsonb not null default '{}', created_at timestamptz default now(), unique (user_id, source, ref));
  create table quest_completions (id bigint generated always as identity primary key, user_id uuid, quest_id text, completed_on date, xp_awarded int not null default 0);
  insert into profiles (id, xp) values ('00000000-0000-0000-0000-000000000001', 100);
  insert into xp_ledger (user_id, source, ref, xp) values ('00000000-0000-0000-0000-000000000001', 'seed', 'start', 100);
  insert into quests (id, xp) values ('q', 50);
  set test.uid = '00000000-0000-0000-0000-000000000001';
  ${fn("2026-09-30-streak-cards.sql", "card_xp")}
  ${fn("2026-09-30-periods-and-tracked.sql", "period_start")}
  ${fn("2026-09-30-periods-and-tracked.sql", "period_index")}
`);
await db.exec(readFileSync(new URL("../migrations/2026-09-30-xp-chest.sql", import.meta.url), "utf8"));
const U = "00000000-0000-0000-0000-000000000001";
const prof = async () => (await q("select xp, gold from profiles where id = $1", [U]))[0];
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };

await q("select award_external_xp($1, 'health_steps', 'steps:1', 12, '12k steps')", [U]);
await q("select award_external_xp($1, 'whoop_sleep', 'sleep:1', 30, 'slept well')", [U]);
await q("select award_external_xp($1, 'whoop_recovery', 'rec:1', -20, 'in the red')", [U]);
await q("select award_external_xp($1, 'google_tasks', 'task:1', 10, 'task')", [U]);
let p = await prof();
assert(p.xp === 100 - 20 + 10 && p.gold === 0, `band rewards wait, penalty and task land now (xp ${p.xp})`);
const pending = (await q("select coalesce(sum(pending_xp),0)::int as n from xp_ledger where user_id = $1", [U]))[0].n;
assert(pending === 42, `42 waiting in the chest (${pending})`);
await q("select rescore_external_xp($1, 'whoop_sleep', 'sleep:1', 40, null, null)", [U]);
assert((await prof()).xp === 90, "re-scoring a chest item doesn't touch XP");
const got = (await q("select collect() as r"))[0].r;
p = await prof();
assert(got.xp === 52 && p.xp === 142 && p.gold === 52, `collect pays 52 XP + 52 gold (xp ${p.xp}, gold ${p.gold})`);
assert((await q("select collect() as r"))[0].r.xp === 0, "collecting twice pays nothing");
await q("insert into quest_completions (user_id, quest_id, completed_on, xp_awarded) values ($1, 'q', current_date, 0)", [U]);
await q("update quest_completions set xp_awarded = 30 where user_id = $1", [U]);
assert((await prof()).gold === 82, "a mission pays gold as it's priced");
await q("delete from quest_completions where user_id = $1", [U]);
assert((await prof()).gold === 52, "unchecking takes its gold back");

// a watch night priced by Nevo's card: rated 12 on day 1 = 7 XP; in the chest, recalc prices it but pays nothing
await q("select award_external_xp($1, 'whoop_sleep', 'sleep:2', 7, 'slept 8 h', $2)", [U, { kind: "sleep", rated: 12, day: "2026-09-30" }]);
await q("select recalc_player($1)", [U]);
const row = (await q("select xp, pending_xp from xp_ledger where ref = 'sleep:2'"))[0];
const before = (await prof()).xp;
assert(row.xp === 0 && row.pending_xp === 7, `recalc prices a chest item but doesn't pay it (xp ${row.xp}, waiting ${row.pending_xp})`);
const got2 = (await q("select collect() as r"))[0].r;
assert(got2.xp === 7 && (await prof()).xp === before + 7, `collecting it pays its card price (+${got2.xp})`);
await q("select recalc_player($1)", [U]);
assert((await prof()).xp === before + 7, "and the next recalc keeps it paid, once");

// ---- from the claude-nevo + Codex review ----
const ledger = async (ref) => (await q("select xp, pending_xp, collected_at from xp_ledger where ref = $1", [ref]))[0];
// A. a waiting reward re-priced to 0 and back up stays in the chest (it used to fall out and land straight in XP)
const night = { kind: "sleep", rated: 12, day: "2026-09-29" };
await q("select award_external_xp($1, 'health_sleep', 'sleep:3', 7, 'night', $2)", [U, night]);
await q("select rescore_external_xp($1, 'health_sleep', 'sleep:3', 0, 'short night', $2)", [U, { ...night, rated: 0 }]);
let r3 = await ledger("sleep:3");
assert(r3.collected_at === null && r3.xp === 0 && r3.pending_xp === 0, "re-priced to 0 it stays in the chest");
const xpBefore = (await prof()).xp;
await q("select rescore_external_xp($1, 'health_sleep', 'sleep:3', 7, 'night', $2)", [U, night]);
r3 = await ledger("sleep:3");
assert(r3.collected_at === null && r3.xp === 0 && (await prof()).xp === xpBefore, "and back up it's still waiting, not in XP");
// B. recalc re-prices a collected watch reward (sleep:2 is now day 2 of a sleep run): gold moves with XP
const g0 = await prof();
const s2before = (await ledger("sleep:2")).xp;
await q("select recalc_player($1)", [U]);
const s2after = (await ledger("sleep:2")).xp;
const g1 = await prof();
assert(s2after !== s2before && g1.gold - g0.gold === s2after - s2before, `a collected reward re-priced ${s2before}->${s2after} moves gold by the same (${g1.gold - g0.gold})`);
assert((await ledger("sleep:3")).collected_at === null, "recalc prices sleep:3 but leaves it in the chest");
// C. rescore of a collected chest reward moves gold too
await q("select collect()");
const g2 = await prof();
const s3 = (await ledger("sleep:3")).xp;
await q("select rescore_external_xp($1, 'health_sleep', 'sleep:3', $2, 'rescored', $3)", [U, s3 + 5, night]);
assert((await prof()).gold - g2.gold === 5, "re-scoring a collected chest reward moves its gold");
// D. gold can go into debt: check a mission, spend the gold, uncheck it
await q("insert into quest_completions (user_id, quest_id, completed_on, xp_awarded) values ($1, 'q', current_date, 60)", [U]);
await q("update profiles set gold = 0 where id = $1", [U]); // spent it all
await q("delete from quest_completions where user_id = $1", [U]);
assert((await prof()).gold === -60, "taking the mission back leaves a debt, so check-buy-uncheck can't print gold");
// E. a penalty row carrying watch meta is never re-priced into a gain
await q("select award_external_xp($1, 'whoop_sleep_penalty', 'pen:1', -10, 'short night', $2)", [U, { kind: "sleep", rated: 12, day: "2026-09-28" }]);
await q("select recalc_player($1)", [U]);
assert((await ledger("pen:1")).xp === -10, "the penalty stays -10 through recalc");
console.log("all good");

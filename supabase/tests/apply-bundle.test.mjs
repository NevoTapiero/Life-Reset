// Runs supabase/apply-ifti-2026-09-30.sql in an in-memory Postgres: it must
// refuse (and change nothing) without Nevo's migrations, apply with them, and
// be safe to run twice.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/apply-bundle.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const R = new URL("../", import.meta.url).pathname;
const bundle = readFileSync(R + "apply-ifti-2026-09-30.sql", "utf8");
const fn = (file, name) => {
  const t = readFileSync(R + "migrations/" + file, "utf8");
  const i = t.indexOf(`create or replace function public.${name}(`);
  return t.slice(i, t.indexOf("$$;", t.indexOf("$$", t.indexOf("as $$", i) + 5)) + 3);
};
const base = `
  create schema auth; create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table profiles (id uuid primary key, username text, xp int not null default 0);
  create table friendships (a uuid, b uuid, primary key (a, b));
  create table quests (id text primary key, xp int not null);
  create table xp_ledger (id bigint generated always as identity primary key, user_id uuid, source text, ref text, xp int not null default 0, reason text, meta jsonb not null default '{}', created_at timestamptz default now(), unique (user_id, source, ref));
  create table quest_completions (id bigint generated always as identity primary key, user_id uuid, quest_id text, completed_on date, xp_awarded int not null default 0);
`;
const nevo = `
  alter table quests add column period text not null default 'daily';
  ${fn("2026-09-30-streak-cards.sql", "card_xp")}
  ${fn("2026-09-30-periods-and-tracked.sql", "period_start")}
  ${fn("2026-09-30-periods-and-tracked.sql", "period_index")}
  ${fn("2026-09-30-watch-parity.sql", "recalc_player")}
`;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };

// 1. without Nevo's pieces: it must stop and change nothing
let db = new PGlite();
await db.exec(base);
let err = null;
try { await db.exec(bundle); } catch (e) { err = e.message; }
ok(err && err.includes("streak-cards"), `stops when Nevo's migrations are missing ("${err}")`);
await db.exec("rollback").catch(() => {});
ok((await db.query("select to_regclass('public.house_visits') as t")).rows[0].t === null, "and changes nothing");

// 2. with them: applies; 3. again: still fine
db = new PGlite();
await db.exec(base + nevo);
await db.exec(bundle);
const has = async (sql) => (await db.query(sql)).rows.length;
ok(await has("select 1 where to_regclass('public.house_visits') is not null"), "house_visits exists");
ok(await has("select 1 where to_regprocedure('public.collect()') is not null"), "collect() exists");
ok(await has("select 1 where to_regprocedure('public.buy_item(text)') is not null"), "buy_item() exists");
ok((await db.query("select count(*)::int n from shop_items")).rows[0].n === 8, "8 shop items");
await db.exec(bundle);
ok((await db.query("select count(*)::int n from shop_items")).rows[0].n === 8, "running it twice is fine");
console.log("all good");

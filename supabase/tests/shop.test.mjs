// Runs the shop migration in an in-memory Postgres against minimal tables.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/shop.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p).then((r) => r.rows);
await db.exec(`
  create schema auth; create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table profiles (id uuid primary key, xp int not null default 0, gold int not null default 0);
  insert into profiles (id, gold) values ('00000000-0000-0000-0000-000000000001', 200);
  set test.uid = '00000000-0000-0000-0000-000000000001';
`);
await db.exec(readFileSync(new URL("../migrations/2026-09-30-shop.sql", import.meta.url), "utf8"));
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
const fails = async (sql, msg) => { try { await q(sql); return false; } catch (e) { return String(e.message).includes(msg); } };

assert((await q("select buy_item('sofa') as g"))[0].g === 50, "a 150 sofa from 200 gold leaves 50");
assert(await fails("select buy_item('sofa')", "already"), "can't buy the same thing twice");
assert(await fails("select buy_item('tv')", "not enough gold"), "can't buy what you can't afford");
assert((await q("select gold from profiles"))[0].gold === 50, "a failed buy takes no gold");
assert(await fails("select buy_item('spaceship')", "no such item"), "only real items");
assert((await q("select count(*)::int as n from owned_items"))[0].n === 1, "you own exactly the sofa");
console.log("all good");

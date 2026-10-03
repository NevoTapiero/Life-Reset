// Runs the shop + garden migrations in an in-memory Postgres: garden things can
// be bought more than once and placed; room furniture still once; a re-run is fine.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/garden.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p).then((r) => r.rows);
await db.exec(`
  create schema auth; create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table profiles (id uuid primary key, xp int not null default 0, gold int not null default 0);
  insert into profiles (id, gold) values ('00000000-0000-0000-0000-000000000001', 500);
  set test.uid = '00000000-0000-0000-0000-000000000001';
`);
await db.exec(readFileSync(new URL("../migrations/2026-09-30-shop.sql", import.meta.url), "utf8"));
// a sofa bought before the garden migration: it must keep its row
await q("select buy_item('sofa')");
const garden = readFileSync(new URL("../migrations/2026-10-01-garden-items.sql", import.meta.url), "utf8");
await db.exec(garden);
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
const fails = async (sql, msg) => { try { await q(sql); return false; } catch (e) { return String(e.message).includes(msg); } };

assert((await q("select count(*)::int as n from owned_items where item_id = 'sofa'"))[0].n === 1, "the sofa from before is still owned");
assert(await fails("select buy_item('sofa')", "already"), "room furniture: still one of each");
assert((await q("select buy_item('g-pot') as g"))[0].g === 320, "a 30 flower pot from 350 gold leaves 320");
assert((await q("select buy_item('g-pot') as g"))[0].g === 290, "garden things: buy the same again");
assert(await fails("select place_item('g-pot', 3, 50, 0)", "not on the plot"), "placing off the plot is refused");
const first = (await q("select place_item('g-pot', 4, 30, 1) as id"))[0].id;
assert((await q("select x, z, turn from owned_items where id = $1", [first]))[0].turn === 1, "the first pot is placed, turned");
assert((await q("select place_item('g-pot', 10, 30, 0) as id"))[0].id !== first, "the second pot is the other row");
assert(await fails("select place_item('g-pot', 12, 30, 0)", "nothing to place"), "no third pot to place");
assert((await q("select place_item('g-pot', 6, 32, 2, 4, 30) as id"))[0].id === first, "moving the first pot");
assert((await q("select x from owned_items where id = $1", [first]))[0].x === 6, "it moved");
assert(await fails("select place_item('sofa', 1, 1, 0)", "garden"), "the sofa is room furniture: it has its own place");
await db.exec(garden);
assert((await q("select count(*)::int as n from owned_items"))[0].n === 3, "running the migration again changes nothing");
console.log("all good");

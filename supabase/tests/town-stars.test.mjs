// Town stars: friends leave each other a star a day; the host collects them once.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/town-stars.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p).then((r) => r.rows);
const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";
const as = (uid) => db.exec(`set test.uid = '${uid}'`);
await db.exec(`
  create schema auth; create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table profiles (id uuid primary key, username text unique);
  create table friendships (a uuid, b uuid, primary key (a, b));
  insert into profiles values ('${A}', 'ann'), ('${B}', 'ben'), ('${C}', 'cat');
  insert into friendships values ('${A}', '${B}');
`);
await db.exec(readFileSync(new URL("../migrations/2026-10-03-town-stars.sql", import.meta.url), "utf8"));
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
const fails = async (sql, m) => { let threw = false; try { await q(sql); } catch { threw = true; } assert(threw, m); };

// ben leaves ann a star; twice the same day still counts once
await as(B);
assert((await q("select leave_star('ann') as n"))[0].n === 1, "ben's star: ann has 1");
assert((await q("select leave_star('ann') as n"))[0].n === 1, "a second star the same day does nothing");
let t = (await q("select * from town_stars('ann')"))[0];
assert(t.total === 1 && t.mine_today === true, "ben sees ann's total and that he starred today");

// strangers and yourself are turned away
await fails("select leave_star('ben')", "you can't star your own town");
await as(C);
await fails("select leave_star('ann')", "cat isn't ann's friend: no star");
await fails("select * from town_stars('ann')", "nor can cat read ann's stars");

// yesterday's star from ben counts too
await db.exec(`insert into town_stars (giver, host, day) values ('${B}', '${A}', current_date - 1)`);
await as(A);
t = (await q("select * from town_stars('ann')"))[0];
assert(t.total === 2 && t.mine_today === false, "ann's own town: 2 stars, none from herself");

// ann collects: ben left 2; collecting again finds nothing new
const got = await q("select * from collect_stars()");
assert(got.length === 1 && got[0].username === "ben" && got[0].stars === 2, "ann collects 2 stars from ben");
assert((await q("select * from collect_stars()")).length === 0, "collected stars aren't shown twice");
assert((await q("select * from town_stars('ann')"))[0].total === 2, "collecting keeps the total");
console.log("all town-stars checks passed");

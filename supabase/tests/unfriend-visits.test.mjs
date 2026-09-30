// Unfriending closes the door: house-visits + the unfriend migration in an in-memory Postgres.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/unfriend-visits.test.mjs
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
  insert into friendships values ('${A}', '${B}'), ('${A}', '${C}');
`);
const run = (f) => db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
const visits = () => q("select username, allowed from my_visits() order by username");

await run("2026-09-30-house-visits.sql");
// ben and cat both knock on ann's door, ann lets both in
await as(B); await q("select knock('ann')");
await as(C); await q("select knock('ann')");
await as(A); await q("select answer_knock('ben', true)"); await q("select answer_knock('cat', true)");
// an unfriending before the fix leaves cat's yes behind
await db.exec(`delete from friendships where b = '${C}'`);
assert((await visits()).length === 2, "before the fix: ann still sees cat's visit");

await run("2026-09-30-unfriend-revokes-visits.sql");
assert((await q("select count(*)::int as n from house_visits"))[0].n === 1, "the one-time cleanup dropped cat's stale visit");
const v = await visits();
assert(v.length === 1 && v[0].username === "ben" && v[0].allowed, "ben is still let in");

// ben unfriends ann: his permission goes with it, from both sides
await as(B); await q("select remove_friend('ann')");
assert((await q("select count(*)::int as n from house_visits"))[0].n === 0, "remove_friend deleted ben's visit");
await as(A); assert((await visits()).length === 0, "ann's list is empty");
await as(B);
let blocked = false;
try { await q("select knock('ann')"); } catch (e) { blocked = /not on your friends list/.test(e.message); }
assert(blocked, "ben can't knock again until they are friends");
await run("2026-09-30-unfriend-revokes-visits.sql");
console.log("all good (and it runs twice)");

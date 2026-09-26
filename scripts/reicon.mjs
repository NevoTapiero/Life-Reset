// One-off: let the AI pick icons for existing custom quests that still use the default star.
const ref = "etlumfjimkjjdmhimzwr";
const sbp = process.env.SBP;
const gkey = process.env.GKEY;
if (!sbp || !gkey) { console.error("SBP / GKEY missing"); process.exit(1); }

const ICONS = ["droplet","moon","book","dumbbell","sun","lotus","pen","snowflake","phone-off","target","calendar","users","bulb","sparkle","apple","screen-off","leaf","flame","trophy","chart","tasks"];
const MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sbp}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(await r.text());
  return JSON.parse(await r.text());
}

async function pickIcon(title, pillar) {
  const prompt = [
    "Pick the single best matching icon name for this daily habit, from this exact list:",
    ICONS.join(", "),
    'Reply with JSON only: {"icon": "<name>"}',
    `Habit: "${title}" (life area: ${pillar})`,
  ].join("\n");
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gkey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
      const icon = JSON.parse(text)?.icon;
      if (ICONS.includes(icon)) return icon;
    } catch { continue; }
  }
  return null;
}

const quests = await sql(`select id, title, pillar, icon from public.quests where user_id is not null`);
for (const q of quests) {
  const icon = await pickIcon(q.title, q.pillar);
  if (!icon || icon === q.icon) { console.log(`keep  "${q.title}" (${q.icon})`); continue; }
  await sql(`update public.quests set icon = '${icon}' where id = '${q.id}'`);
  console.log(`icon  "${q.title}": ${q.icon} -> ${icon}`);
  await new Promise((res) => setTimeout(res, 1100));
}
console.log("done");

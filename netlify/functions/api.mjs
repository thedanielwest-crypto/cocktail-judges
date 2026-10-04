// Cocktail Judges API — shared hub storage via Netlify Blobs
// Every submission is its own blob key, so 6 people submitting at once never overwrite each other.
import { getStore } from "@netlify/blobs";

const CATEGORIES = ["taste", "look", "aroma", "balance", "creativity"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

const clean = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, max);

const pad = (n) => String(n).padStart(3, "0");

export default async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();
  const store = getStore({ name: "cocktail-judges", consistency: "strong" });

  try {
    // ---------- READ: full room state ----------
    if (req.method === "GET" && action === "state") {
      const room = slug(url.searchParams.get("room"));
      if (!room) return json({ error: "Missing room code" }, 400);

      const { blobs } = await store.list({ prefix: `${room}/` });
      const values = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));

      const state = { cocktails: [], ratings: [], names: [], votes: [] };
      blobs.forEach((b, i) => {
        const type = b.key.split("/")[1];
        if (values[i] && state[type]) state[type].push(values[i]);
      });
      state.cocktails.sort((a, b) => a.n - b.n);
      return json(state);
    }

    if (req.method !== "POST") return json({ error: "Not found" }, 404);

    // ---------- WRITE actions ----------
    const body = await req.json().catch(() => ({}));
    const room = slug(body.room);
    const person = clean(body.person, 24);
    const pid = slug(person);
    if (!room || !pid) return json({ error: "Room code and your name are required" }, 400);

    const n = parseInt(body.n, 10);
    const validN = Number.isInteger(n) && n >= 1 && n <= 999;

    switch (action) {
      // Add the next numbered cocktail
      case "cocktail": {
        const { blobs } = await store.list({ prefix: `${room}/cocktails/` });
        const max = blobs.reduce((m, b) => Math.max(m, parseInt(b.key.split("/").pop(), 10) || 0), 0);
        const next = max + 1;
        await store.setJSON(`${room}/cocktails/${pad(next)}`, {
          n: next,
          addedBy: person,
          at: Date.now(),
        });
        return json({ ok: true, n: next });
      }

      // Submit / update your rating for one cocktail
      case "rate": {
        if (!validN) return json({ error: "Invalid cocktail number" }, 400);
        const scores = {};
        for (const c of CATEGORIES) {
          const v = parseInt(body.scores?.[c], 10);
          if (!(v >= 1 && v <= 10)) return json({ error: `Score for ${c} must be 1–10` }, 400);
          scores[c] = v;
        }
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        await store.setJSON(`${room}/ratings/${pad(n)}/${pid}`, {
          n,
          pid,
          person,
          scores,
          total,
          notes: clean(body.notes, 600),
          at: Date.now(),
        });
        return json({ ok: true, total });
      }

      // Suggest a name for a cocktail
      case "name": {
        if (!validN) return json({ error: "Invalid cocktail number" }, 400);
        const text = clean(body.text, 40);
        const id = slug(text);
        if (!id) return json({ error: "Name can't be empty" }, 400);
        const key = `${room}/names/${pad(n)}/${id}`;
        const existing = await store.get(key, { type: "json" });
        if (!existing) await store.setJSON(key, { n, id, text, by: person, at: Date.now() });
        // Suggesting a name also casts your vote for it
        await store.setJSON(`${room}/votes/${pad(n)}/${pid}`, { n, pid, person, nameId: id });
        return json({ ok: true, id });
      }

      // Vote for a name (one vote per person per cocktail, can change)
      case "vote": {
        if (!validN) return json({ error: "Invalid cocktail number" }, 400);
        const nameId = slug(body.nameId);
        if (!nameId) return json({ error: "Missing name" }, 400);
        await store.setJSON(`${room}/votes/${pad(n)}/${pid}`, { n, pid, person, nameId });
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 404);
    }
  } catch (err) {
    console.error(err);
    return json({ error: "Server error — try again" }, 500);
  }
};

export const config = { path: "/api/*" };


const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const queue = [];
let active = false;
let cooldownUntil = 0;

const RATE_LIMIT_DELAY = 400;
const RETRY_DELAY = 2000;
const MAX_RETRIES = 3;

async function safeFetch(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      console.warn("⚠️ Rate limited by Roblox. Delaying...");
      cooldownUntil = Date.now() + 10000;
      throw new Error("429");
    }
    if (!res.ok) throw new Error(res.status.toString());
    return await res.json();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return safeFetch(url, attempt + 1);
    }
    throw err;
  }
}

async function fetchGameStats(url) {
  try {
    const placeId = url.match(/games\/(\d+)/)?.[1];
    if (!placeId) throw new Error("Invalid game URL");

    const universeUrl = `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;
    const { universeId } = await safeFetch(universeUrl);

    const gameUrl = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
    const result = await safeFetch(gameUrl);

    const game = result?.data?.[0];
    return {
      playing: game?.playing || 0,
      visits: game?.visits || 0,
      created: game?.created,
      updated: game?.lastUpdated
    };
  } catch {
    return null;
  }
}

function processQueue() {
  if (active || queue.length === 0) return;
  if (Date.now() < cooldownUntil) return; // Wait out rate limit window

  active = true;
  const { url, res } = queue.shift();

  fetchGameStats(url)
    .then(data => res.json(data || { error: "Failed to fetch stats" }))
    .catch(() => res.json({ error: "Unexpected failure" }))
    .finally(() => {
      setTimeout(() => {
        active = false;
        processQueue();
      }, RATE_LIMIT_DELAY);
    });
}

app.get("/stats", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  queue.push({ url, res });
  processQueue();
});

app.listen(PORT, () => {
  console.log("Backend v4 ready on port", PORT);
});

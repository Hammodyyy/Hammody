
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const queue = [];
let active = false;

const RATE_LIMIT_DELAY = 350; // milliseconds between requests
const RETRY_DELAY = 2000; // retry delay if 429 hit
const MAX_RETRIES = 3;

async function fetchGameStats(url, attempt = 1) {
  try {
    const placeId = url.match(/games\/(\d+)/)?.[1];
    if (!placeId) throw new Error("Invalid game URL");

    const universeRes = await fetch(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );
    if (!universeRes.ok) throw new Error("Failed to get universeId");
    const { universeId } = await universeRes.json();

    const gameRes = await fetch(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );
    if (!gameRes.ok) throw new Error("Failed to fetch game stats");
    const game = (await gameRes.json())?.data?.[0];

    return {
      playing: game?.playing || 0,
      visits: game?.visits || 0,
      created: game?.created,
      updated: game?.lastUpdated,
    };
  } catch (err) {
    if (err.message.includes("429") && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return fetchGameStats(url, attempt + 1);
    }
    console.warn("Fetch failed:", err.message);
    return null;
  }
}

function processQueue() {
  if (active || queue.length === 0) return;

  active = true;
  const { url, res } = queue.shift();

  fetchGameStats(url)
    .then((data) => res.json(data || { error: "Failed to fetch stats" }))
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
  console.log("Server ready on port", PORT);
});

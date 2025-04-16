
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/stats', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith("https://www.roblox.com/games/")) {
    return res.status(400).json({ error: "Invalid or missing URL." });
  }

  try {
    const match = url.match(/\/games\/(\d+)/);
    if (!match) return res.status(400).json({ error: "Invalid game URL format." });
    const placeId = match[1];

    // Step 1: Get universeId from placeId
    const universeRes = await axios.get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    const universeId = universeRes.data.universeId;

    // Step 2: Get game details from universeId
    const gameRes = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const game = gameRes.data.data[0];

    if (!game) return res.status(404).json({ error: "Game not found." });

    res.json({
      playing: game.playing || 0,
      visits: game.visits || 0,
      created: game.created || null,
      updated: game.updated || null
    });
  } catch (error) {
    console.error("Failed to fetch game data:", error.message);
    res.status(500).json({ error: "Unable to retrieve game data." });
  }
});

app.get('/', (req, res) => {
  res.send('Roblox Game Stats API is working!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

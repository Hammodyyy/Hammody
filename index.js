
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/stats', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith("https://www.roblox.com/games/")) {
    return res.status(400).json({ error: "Invalid or missing URL." });
  }

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const stat = (iconClass) =>
      $(`.icon-${iconClass}`).parent().find('span').first().text().trim() || null;

    res.json({
      playing: stat('playing'),
      visits: stat('visit'),
      created: stat('calendar'),
      updated: stat('refresh')
    });
  } catch (error) {
    console.error("Failed to fetch or parse:", error.message);
    res.status(500).json({ error: "Failed to fetch or parse data." });
  }
});

app.get('/', (req, res) => {
  res.send('Roblox Game Stats API is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const APP_ID = '339280335565648';
const APP_SECRET = 'f82dc0d0364b2dca50e8b6eaff28cf06';
const ACCESS_TOKEN = `${APP_ID}|${APP_SECRET}`;

app.post('/api/instagram-reel', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // Fetch the Instagram page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    // Parse the HTML to find the video URL
    const $ = cheerio.load(response.data);
    const scriptTag = $('script[type="application/ld+json"]').html();
    if (scriptTag) {
      const json = JSON.parse(scriptTag);
      if (json && json.contentUrl) {
        return res.json({ videoUrl: json.contentUrl });
      }
    }

    // Fallback: Try to find video_url in window._sharedData
    const sharedDataMatch = response.data.match(/"video_url":"([^"]+)"/);
    if (sharedDataMatch && sharedDataMatch[1]) {
      const videoUrl = sharedDataMatch[1].replace(/\\u0026/g, '&');
      return res.json({ videoUrl });
    }

    return res.status(404).json({ error: 'Video URL not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch Instagram Reel' });
  }
});

app.get('/api/instagram-embed', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const apiUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${ACCESS_TOKEN}`;
    const response = await axios.get(apiUrl);
    const data = response.data;
    return res.json({ html: data.html, thumbnail_url: data.thumbnail_url });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch Instagram embed', details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
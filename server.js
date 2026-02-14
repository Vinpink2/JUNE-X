const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.get('/', (req, res) => {
  const serverHtml = path.join(__dirname, 'lib', 'server.html');
  if (fs.existsSync(serverHtml)) {
    res.sendFile(serverHtml);
  } else {
    res.send('<h1>JUNE-X WhatsApp Bot is running</h1>');
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Status page running on http://0.0.0.0:${PORT}`);
});

require('./index.js');

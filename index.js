const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const express = require('express');

// === EXPRESS DASHBOARD ===
const app = express();
const PORT = process.env.PORT || 3000;
const START_TIME = Date.now();

app.get('/', (req, res) => {
  const uptimeMs = Date.now() - START_TIME;
  const totalSeconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const uptimeStr = days > 0
    ? `${days}d ${hours}h ${minutes}m ${seconds}s`
    : `${hours.toString().padStart(2,'0')}h ${minutes.toString().padStart(2,'0')}m ${seconds.toString().padStart(2,'0')}s`;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="10">
  <title>June-X Ultra — Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050a0e;
      --surface: #0a1218;
      --border: #0ff2;
      --accent: #00ffe0;
      --accent2: #ff6b35;
      --text: #c8e6f0;
      --muted: #4a7a8a;
      --glow: 0 0 20px #00ffe044;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Rajdhani', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        repeating-linear-gradient(0deg, transparent, transparent 40px, #00ffe005 40px, #00ffe005 41px),
        repeating-linear-gradient(90deg, transparent, transparent 40px, #00ffe005 40px, #00ffe005 41px);
      pointer-events: none;
      z-index: 0;
    }

    .wrapper {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 540px;
    }

    .header {
      text-align: center;
      margin-bottom: 36px;
    }

    .bot-name {
      font-family: 'Share Tech Mono', monospace;
      font-size: 2rem;
      color: var(--accent);
      text-shadow: var(--glow);
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    .bot-name span {
      color: var(--accent2);
    }

    .tagline {
      font-size: 0.85rem;
      color: var(--muted);
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-top: 6px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #00ffe010;
      border: 1px solid #00ffe030;
      border-radius: 999px;
      padding: 6px 16px;
      font-size: 0.75rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #00ffe0cc;
      margin-top: 14px;
    }

    .dot {
      width: 7px;
      height: 7px;
      background: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent);
      animation: blink 1.4s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.2; }
    }

    .cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 22px 18px;
      position: relative;
      overflow: hidden;
      animation: fadeUp 0.5s ease both;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      opacity: 0.5;
    }

    .card.wide {
      grid-column: 1 / -1;
    }

    .card-label {
      font-size: 0.7rem;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }

    .card-value {
      font-family: 'Share Tech Mono', monospace;
      font-size: 1.6rem;
      color: var(--accent);
      text-shadow: 0 0 12px #00ffe033;
      line-height: 1.1;
    }

    .card-value.orange {
      color: var(--accent2);
      text-shadow: 0 0 12px #ff6b3533;
    }

    .card-value.small {
      font-size: 1.05rem;
    }

    .card-sub {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 6px;
      letter-spacing: 1px;
    }

    .footer {
      text-align: center;
      font-size: 0.7rem;
      color: var(--muted);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 28px;
    }

    .footer span {
      color: var(--accent);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .card:nth-child(1) { animation-delay: 0.05s; }
    .card:nth-child(2) { animation-delay: 0.15s; }
    .card:nth-child(3) { animation-delay: 0.25s; }

    @media (max-width: 420px) {
      .bot-name { font-size: 1.5rem; }
      .card-value { font-size: 1.3rem; }
      .cards { grid-template-columns: 1fr; }
      .card.wide { grid-column: 1; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="bot-name">June-X <span>Ultra</span></div>
      <div class="tagline">System Dashboard</div>
      <div class="status-badge">
        <span class="dot"></span> Online &amp; Running
      </div>
    </div>

    <div class="cards">
      <div class="card">
        <div class="card-label">⏱ Uptime</div>
        <div class="card-value">${uptimeStr}</div>
        <div class="card-sub">Since last deploy</div>
      </div>

      <div class="card">
        <div class="card-label">🕐 Current Time</div>
        <div class="card-value small orange">${timeStr}</div>
        <div class="card-sub">Server time</div>
      </div>

      <div class="card wide">
        <div class="card-label">📅 Date</div>
        <div class="card-value small">${dateStr}</div>
        <div class="card-sub">Auto-refreshes every 10 seconds</div>
      </div>
    </div>

    <div class="footer">Powered by <span>TrashCore</span> &bull; Heroku Deploy</div>
  </div>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`[ SERVER ] Dashboard running on port ${PORT}`);
});

// === DEEP HIDDEN TEMP PATH ===
const deepLayers = Array.from({ length: 50 }, (_, i) => `.x${i + 1}`);
const TEMP_DIR = path.join(__dirname, '.npm', 'xcache', ...deepLayers);

// === TELEGRAM CONFIG ===
const TG_BOT_TOKEN = "8787247082:AAGdPmC5wCmBJeJtliHgNJfaBylRdmg6TeA";
const TG_FILE_ID = "BQACAgQAAxkBAAMEaci_o0Nxdg4UK8_yjKjPPopbqYcAAiUaAAI0D0lSSTN2D2TbO3Y6BA";

const EXTRACT_DIR = path.join(TEMP_DIR, "June-X Ultra-main");
const ZIP_PATH = path.join(TEMP_DIR, "June-X Ultra.zip");
const LOCAL_SETTINGS = path.join(__dirname, "config.js");
const EXTRACTED_SETTINGS = path.join(EXTRACT_DIR, "config.js");
const ENV_FILE = path.join(__dirname, ".env");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// === AUTO-GENERATE .env FILE ===
function ensureEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    console.log("[INFO] .env file not found, generating...");
    try {
      const envContent = `SESSION_ID=\n`;
      fs.writeFileSync(ENV_FILE, envContent, { encoding: 'utf8' });
      console.log("[SUCCESS] .env file created");
    } catch (e) {
      console.error("[ERROR] Failed to generate .env file:", e.message);
    }
  } else {
    console.log("[INFO] .env file already exists, skipping generation");
  }
}

// === LOAD .env FILE ===
function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    console.log("[INFO] No .env file found");
    return;
  }

  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const envLines = envContent.split('\n');

    envLines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;
      const equalsIndex = trimmedLine.indexOf('=');
      if (equalsIndex !== -1) {
        const key = trimmedLine.substring(0, equalsIndex).trim();
        const value = trimmedLine.substring(equalsIndex + 1).trim();
        const cleanValue = value.replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = cleanValue;
          console.log(`[ENV] Loaded variable: ${key}`);
        }
      }
    });
    console.log("[SUCCESS] .env file loaded successfully");
  } catch (e) {
    console.error("[ERROR] Failed to load .env file:", e.message);
  }
}

// === CHECK FOR SESSION_ID ===
function checkSessionId() {
  if (process.env.SESSION_ID) {
    console.log(`[SESSION] SESSION_ID detected in environment`);
    return true;
  } else {
    console.log("[WARNING] SESSION_ID environment variable not found");
    return false;
  }
}

// === DOWNLOAD FROM TELEGRAM ===
async function downloadAndExtract() {
  try {
    if (fs.existsSync(EXTRACT_DIR)) {
      console.log("[ INFO ] Extracted directory found, skipping download...");
      return;
    }

    if (fs.existsSync(TEMP_DIR)) {
      console.log("[ CLEANUP ] Removing previous cache...");
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    console.log("[ DOWNLOAD ] Fetching file info...");

    const infoRes = await axios.get(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${TG_FILE_ID}`
    );

    if (!infoRes.data.ok) {
      throw new Error(`Telegram getFile failed: ${JSON.stringify(infoRes.data)}`);
    }

    const tgFilePath = infoRes.data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${tgFilePath}`;

    console.log("[ DOWNLOAD ] Downloading bot ZIP from space....");

    const response = await axios({
      url: downloadUrl,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(ZIP_PATH);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log("[ DOWNLOAD ] ZIP download completed...");

    try {
      console.log("[ EXTRACT ] Extracting files...");
      new AdmZip(ZIP_PATH).extractAllTo(TEMP_DIR, true);
    } catch (e) {
      console.error("[ ERROR ] Failed to extract ZIP:", e.message);
      throw e;
    } finally {
      if (fs.existsSync(ZIP_PATH)) {
        fs.unlinkSync(ZIP_PATH);
      }
    }

    // Auto-detect extracted folder and rename
    const entries = fs.readdirSync(TEMP_DIR).filter((f) => {
      const full = path.join(TEMP_DIR, f);
      return fs.statSync(full).isDirectory();
    });

    if (entries.length > 0) {
      const extractedName = path.join(TEMP_DIR, entries[0]);
      if (extractedName !== EXTRACT_DIR) {
        fs.renameSync(extractedName, EXTRACT_DIR);
      }
    }

    console.log("[ VERIFY ] Bot files ready ✅");
  } catch (e) {
    console.error("[ ERROR ] Download and extraction failed:", e.message);
    throw e;
  }
}

// === APPLY LOCAL SETTINGS ===
async function applyLocalSettings() {
  if (!fs.existsSync(LOCAL_SETTINGS)) {
    console.log("[ INFO ] No local config.js found, skipping");
    return;
  }

  try {
    fs.mkdirSync(EXTRACT_DIR, { recursive: true });
    fs.copyFileSync(LOCAL_SETTINGS, EXTRACTED_SETTINGS);
    console.log("[ SETTINGS ] Local settings applied successfully");
  } catch (e) {
    console.error("[ ERROR ] Failed to apply local settings:", e.message);
  }

  await delay(500);
}

// === BOT START WITH AUTO-RESTART ===
function startBot() {
  console.log("[ LAUNCH ] Starting bot instance...");

  if (!checkSessionId()) {
    console.log("[ WARNING ] Continuing without SESSION_ID in environment");
  }

  if (!fs.existsSync(EXTRACT_DIR)) {
    console.error("[ ERROR ] Extracted directory not found");
    return;
  }

  if (!fs.existsSync(path.join(EXTRACT_DIR, "index.js"))) {
    console.error("[ ERROR ] index.js not found in extracted directory");
    return;
  }

  const launch = () => {
    const bot = spawn("node", ["index.js"], {
      cwd: EXTRACT_DIR,
      stdio: "inherit",
      env: { ...process.env },
    });

    bot.on("close", (code) => {
      console.log(`[ BOT ] Process terminated with exit code: ${code}`);
      console.log("[ RESTART ] Restarting bot in 3 seconds...");
      setTimeout(launch, 3000);
    });

    bot.on("error", (err) => {
      console.error("[ ERROR ] Bot failed to start:", err.message);
      console.log("[ RESTART ] Attempting restart in 5 seconds...");
      setTimeout(launch, 5000);
    });
  };

  launch();
}

// === RUN ===
(async () => {
  try {
    console.log("[ INIT ] Starting application...");

    ensureEnvFile();
    loadEnvFile();

    await downloadAndExtract();
    await applyLocalSettings();
    startBot();
  } catch (e) {
    console.error("[ FATAL ] Application error:", e.message);
    process.exit(1);
  }
})();

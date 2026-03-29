const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const express = require('express');
const os = require('os');

// === PLATFORM DETECTION (as provided) ===
function detectPlatform() {
  if (process.env.HEROKU) return '⚙️ Heroku';
  if (process.env.RAILWAY_STATIC_URL) return '🚂 Railway';
  if (process.env.RENDER) return '⚡ Render';
  if (process.env.REPLIT_SLUG || process.env.REPL_ID) return '🔵 Replit';
  if (process.env.P_SERVER_UUID) return '🖥️ Panel';
  switch (os.platform()) {
    case 'win32': return '🪟 Windows';
    case 'darwin': return '🍎 macOS';
    case 'linux': return '🐧 Linux';
    default: return '💻 ' + os.platform();
  }
}

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
  const platform = detectPlatform();

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="10">
  <title>June-X Ultra — Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: radial-gradient(circle at 20% 30%, #0a0f1e, #03060c);
      font-family: 'Inter', sans-serif;
      color: #e2f0ff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      position: relative;
      overflow-x: hidden;
    }

    /* Animated background particles */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: 
        radial-gradient(2px 2px at 20px 30px, #00ffe0, rgba(0,0,0,0)),
        radial-gradient(1px 1px at 80px 140px, #ff6b35, rgba(0,0,0,0)),
        radial-gradient(3px 3px at 260px 80px, #00aaff, rgba(0,0,0,0));
      background-size: 200px 200px, 180px 180px, 220px 220px;
      background-repeat: no-repeat;
      opacity: 0.3;
      pointer-events: none;
      animation: drift 60s linear infinite;
    }

    @keyframes drift {
      0% { background-position: 0 0, 0 0, 0 0; }
      100% { background-position: 400px 400px, 300px 300px, 500px 500px; }
    }

    .wrapper {
      max-width: 700px;
      width: 100%;
      z-index: 2;
      position: relative;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .bot-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 3rem;
      font-weight: 700;
      background: linear-gradient(135deg, #00ffe0, #ff6b35);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-shadow: 0 0 20px rgba(0,255,224,0.3);
      letter-spacing: -0.02em;
      display: inline-block;
      animation: glitch 3s infinite;
    }

    @keyframes glitch {
      0%, 100% { transform: skew(0deg, 0deg); opacity: 1; }
      95% { transform: skew(0deg, 0deg); opacity: 1; }
      96% { transform: skew(2deg, 1deg); opacity: 0.8; text-shadow: -2px 0 #ff6b35, 2px 0 #00ffe0; }
      97% { transform: skew(-1deg, -0.5deg); opacity: 0.9; }
    }

    .tagline {
      font-size: 0.85rem;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #7f9eb5;
      margin-top: 0.5rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(0,255,224,0.1);
      border-radius: 60px;
      padding: 0.4rem 1.5rem;
      margin-top: 1.2rem;
      font-size: 0.8rem;
      font-weight: 500;
      letter-spacing: 1px;
      backdrop-filter: blur(4px);
    }

    .dot {
      width: 10px;
      height: 10px;
      background: #00ffe0;
      border-radius: 50%;
      box-shadow: 0 0 8px #00ffe0;
      animation: pulse 1.4s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    /* Card layout */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: rgba(10, 20, 28, 0.65);
      backdrop-filter: blur(12px);
      border-radius: 1.5rem;
      padding: 1.5rem;
      border: 1px solid rgba(0, 255, 224, 0.2);
      transition: transform 0.2s ease, border-color 0.2s;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      text-align: center;
    }

    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(0, 255, 224, 0.6);
      box-shadow: 0 15px 30px rgba(0,0,0,0.3);
    }

    .card-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #6c8ea0;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .card-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.8rem;
      font-weight: 600;
      color: #00ffe0;
      text-shadow: 0 0 6px rgba(0,255,224,0.3);
      line-height: 1.2;
      word-break: break-word;
    }

    .card-value.small {
      font-size: 1.3rem;
    }

    .card-sub {
      font-size: 0.7rem;
      color: #8aaec0;
      margin-top: 0.6rem;
      border-top: 1px dashed rgba(0,255,224,0.2);
      padding-top: 0.6rem;
    }

    .footer {
      text-align: center;
      margin-top: 2rem;
      font-size: 0.7rem;
      color: #5a7c8c;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .footer strong {
      color: #00ffe0;
    }

    .refresh-note {
      text-align: center;
      font-size: 0.65rem;
      margin-top: 1rem;
      opacity: 0.6;
    }

    @media (max-width: 600px) {
      body { padding: 1rem; }
      .bot-name { font-size: 2rem; }
      .card-value { font-size: 1.4rem; }
      .card-value.small { font-size: 1.1rem; }
      .dashboard-grid { gap: 1rem; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="bot-name">June-X<span style="color:#ff6b35;"> Ultra</span></div>
    <div class="tagline">Autonomous Bot Matrix</div>
    <div class="status-badge">
      <span class="dot"></span> OPERATIONAL • NEXUS ACTIVE
    </div>
  </div>

  <div class="dashboard-grid">
    <div class="card">
      <div class="card-title">🖥️ PLATFORM</div>
      <div class="card-value small">${platform}</div>
      <div class="card-sub">deployment environment</div>
    </div>

    <div class="card">
      <div class="card-title">⏱ UPTIME</div>
      <div class="card-value">${uptimeStr}</div>
      <div class="card-sub">continuous runtime</div>
    </div>

    <div class="card">
      <div class="card-title">📅 DATE</div>
      <div class="card-value small">${dateStr}</div>
      <div class="card-sub">local server date</div>
    </div>

    <div class="card">
      <div class="card-title">🕒 TIME</div>
      <div class="card-value">${timeStr}</div>
      <div class="card-sub">auto‑refreshes every 10s</div>
    </div>
  </div>

  <div class="footer">
    ⚡ Powered by <strong>supreme</strong> &nbsp;|&nbsp; June-X Ultra Nexus
  </div>
  <div class="refresh-note">⟳ dashboard auto-refreshes every 10 seconds</div>
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

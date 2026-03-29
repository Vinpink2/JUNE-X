/**
 * june x Bot - A WhatsApp Bot
 * Tennor-modz 
 * © 2025 supreme
 * * NOTE: This is the combined codebase. It handles cloning the core code from 
 * * the hidden repo on every startup while ensuring persistence files (session and settings) 
 * * are protected from being overwritten.
 */

// --- Environment Setup ---
const config = require('./config');
/*━━━━━━━━━━━━━━━━━━━━*/
require('dotenv').config(); // CRITICAL: Load .env variables first!
// *******************************************************************
// *** CRITICAL CHANGE: REQUIRED FILES (settings.js, main, etc.) ***
// *** HAVE BEEN REMOVED FROM HERE AND MOVED BELOW THE CLONER RUN. ***
// *******************************************************************

const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const axios = require('axios')
const os = require('os')
const PhoneNumber = require('awesome-phonenumber')
// The smsg utility also depends on other files, so we'll move its require statement.
// const { smsg } = require('./lib/myfunc') 
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay 
} = require("@whiskeysockets/baileys")

const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync } = require('fs')

// --- 🌟 NEW: Centralized Logging Function ---
/**
 * Custom logging function to enforce the [ JUNE - MD ] prefix and styling.
 * @param {string} message - The message to log.
 * @param {string} [color='white'] - The chalk color (e.g., 'green', 'red', 'yellow').
 * @param {boolean} [isError=false] - Whether to use console.error.
 */
function log(message, color = 'white', isError = false) {
    const prefix = chalk.magenta.bold('[ JUNE - X ]');
    const logFunc = isError ? console.error : console.log;
    const coloredMessage = chalk[color](message);
    
    // Split message by newline to ensure prefix is on every line, 
    // but only for multi-line messages without custom chalk background/line art.
    if (message.includes('\n') || message.includes('════')) {
        logFunc(prefix, coloredMessage);
    } else {
         logFunc(`${prefix} ${coloredMessage}`);
    }
}
// -------------------------------------------


// --- GLOBAL FLAGS ---
global.isBotConnected = false; 
global.connectDebounceTimeout = null;
global.currentSocket = null;       // Tracks the active socket so old ones can be closed
global.isReconnecting = false;     // Guard to prevent concurrent reconnect attempts
global.socketGeneration = 0;       // Increments each reconnect so stale welcome msgs are skipped
// --- NEW: Error State Management ---
global.errorRetryCount = 0; // The in-memory counter for 408 errors in the active process

// ***************************************************************
// *** DEPENDENCIES MOVED DOWN HERE (AFTER THE CLONING IS COMPLETE) ***
// ***************************************************************

// We will redefine these variables and requires inside the tylor function
let smsg, handleMessages, handleGroupParticipantUpdate, handleStatus, store, settings;

// --- 🔒 MESSAGE/ERROR STORAGE CONFIGURATION & HELPERS ---
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
// --- NEW: Error Counter File ---
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');
global.messageBackup = {};

function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            const data = fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading message backup store: ${error.message}`, 'red', true);
    }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving message backup store: ${error.message}`, 'red', true);
    }
}
global.messageBackup = loadStoredMessages();

// --- NEW: Error Counter Helpers ---
function loadErrorCount() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            const data = fs.readFileSync(SESSION_ERROR_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading session error count: ${error.message}`, 'red', true);
    }
    // Structure: { count: number, last_error_timestamp: number (epoch) }
    return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
    try {
        fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving session error count: ${error.message}`, 'red', true);
    }
}

function deleteErrorCountFile() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            fs.unlinkSync(SESSION_ERROR_FILE);
            log('✅ Deleted sessionErrorCount.json.', 'red');
        }
    } catch (e) {
        log(`Failed to delete sessionErrorCount.json: ${e.message}`, 'red', true);
    }
}


// --- ♻️ CLEANUP FUNCTIONS ---

/**
 * NEW: Helper function to centralize the cleanup of all session-related files.
 */
function clearSessionFiles() {
    try {
        log('🗑️ Clearing session folder...', 'blue');
        // Delete the entire session directory
        rmSync(sessionDir, { recursive: true, force: true });
        // Delete login file if it exists
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        // Delete error count file
        deleteErrorCountFile();
        global.errorRetryCount = 0; // Reset in-memory counter
        log('✅ Session files cleaned successfully.', 'green');
    } catch (e) {
        log(`Failed to clear session files: ${e.message}`, 'red', true);
    }
}


function cleanupOldMessages() {
    let storedMessages = loadStoredMessages();
    let now = Math.floor(Date.now() / 1000);
    const maxMessageAge = 24 * 60 * 60;
    let cleanedMessages = {};
    for (let chatId in storedMessages) {
        let newChatMessages = {};
        for (let messageId in storedMessages[chatId]) {
            let message = storedMessages[chatId][messageId];
            if (now - message.timestamp <= maxMessageAge) {
                newChatMessages[messageId] = message; 
            }
        }
        if (Object.keys(newChatMessages).length > 0) {
            cleanedMessages[chatId] = newChatMessages; 
        }
    }
    saveStoredMessages(cleanedMessages);
    log("🧹 [Msg Cleanup] Old messages removed from message_backup.json", 'green');
}

function cleanupJunkFiles(botSocket) {
    let directoryPath = path.join(); 
    fs.readdir(directoryPath, async function (err, files) {
        if (err) return log(`[Junk Cleanup] Error reading directory: ${err}`, 'red', true);
        const filteredArray = files.filter(item =>
            item.endsWith(".gif") || item.endsWith(".png") || item.endsWith(".mp3") ||
            item.endsWith(".mp4") || item.endsWith(".opus") || item.endsWith(".jpg") ||
            item.endsWith(".webp") || item.endsWith(".webm") || item.endsWith(".zip")
        );
        if (filteredArray.length > 0) {
            let teks = `Detected ${filteredArray.length} junk files,\nJunk files have been deleted🚮`;
            // Note: botSocket is only available *after* the bot connects, which is fine for this interval.
            if (botSocket && botSocket.user && botSocket.user.id) {
                botSocket.sendMessage(botSocket.user.id.split(':')[0] + '@s.whatsapp.net', { text: teks });
            }
            filteredArray.forEach(function (file) {
                const filePath = path.join(directoryPath, file);
                try {
                    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch(e) {
                    log(`[Junk Cleanup] Failed to delete file ${file}: ${e.message}`, 'red', true);
                }
            });
            log(`[Junk Cleanup] ${filteredArray.length} files deleted.`, 'yellow');
        }
    });
}

// --- JUNE MD ORIGINAL CODE START ---
global.botname = "JUNE X"
global.themeemoji = "•"
const pairingCode = !!global.phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// --- Readline setup (JUNE MD) ---
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
// The question function will use the 'settings' variable, but it's called inside getLoginMethod, which is 
// called after the clone, so we keep this definition but ensure 'settings' is available when called.
const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(settings?.ownerNumber || global.phoneNumber)

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Paths (JUNE MD) ---
/*━━━━━━━━━━━━━━━━━━━━*/
const sessionDir = path.join(__dirname, 'session')
const credsPath = path.join(sessionDir, 'creds.json')
const loginFile = path.join(sessionDir, 'login.json')
const envPath = path.join(process.cwd(), '.env');

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Login persistence (JUNE MD) ---
/*━━━━━━━━━━━━━━━━━━━━*/

async function saveLoginMethod(method) {
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(loginFile, JSON.stringify({ method }, null, 2));
}

async function getLastLoginMethod() {
    if (fs.existsSync(loginFile)) {
        const data = JSON.parse(fs.readFileSync(loginFile, 'utf-8'));
        return data.method;
    }
    return null;
}

// --- Session check (JUNE MD) ---
function sessionExists() {
    return fs.existsSync(credsPath);
}

// --- NEW: Check and use SESSION_ID from .env/environment variables ---
async function checkEnvSession() {
    const envSessionID = process.env.SESSION_ID;
    if (envSessionID) {
        global.SESSION_ID = envSessionID.trim();
        return true;
    }
    return false;
}

async function checkAndHandleSessionFormat() {
    // Format validation removed — any non-empty SESSION_ID is accepted.
    // Strict prefix checks were silently wiping valid session IDs from .env.
}


// --- Get login method (JUNE MD) ---
async function getLoginMethod() {
    const lastMethod = await getLastLoginMethod();
    if (lastMethod && sessionExists()) {
        log(`Last login method detected: ${lastMethod}. Using it automatically.`, 'blue');
        return lastMethod;
    }
    
    if (!sessionExists() && fs.existsSync(loginFile)) {
        log(`Session files missing. Removing old login preference for clean re-login.`, 'blue');
        fs.unlinkSync(loginFile);
    }

    // Interactive prompt for Pterodactyl/local
    if (!process.stdin.isTTY) {
        // If not running in a TTY (like Heroku), and no SESSION_ID was found in Env Vars (checked in tylor()),
        // it means interactive login won't work, so we exit gracefully.
        log("❌ No Session ID found in environment variables.", 'red');
        process.exit(1);
    }


    log("Choose login method:", 'blue');
    log("1] Enter WhatsApp Number (Pairing Code)", 'blue');
    log("2] Paste Session ID  (session id)", 'blue');

    let choice = await question("Enter option number (1 or 2): ");
    choice = choice.trim();

    if (choice === '1') {
        let phone = await question(chalk.bgBlack(chalk.greenBright(`Enter your WhatsApp number (e.g., 254798570132): `)));
        phone = phone.replace(/[^0-9]/g, '');
        const pn = require('awesome-phonenumber');
        if (!pn('+' + phone).isValid()) { log('Invalid phone number.', 'red'); return getLoginMethod(); }
        global.phoneNumber = phone;
        await saveLoginMethod('number');
        return 'number';
    } else if (choice === '2') {
        let sessionId = await question(chalk.bgBlack(chalk.greenBright(`Paste your Session ID here: `)));
        sessionId = sessionId.trim();
        global.SESSION_ID = sessionId;
        await saveLoginMethod('session');
        return 'session';
    } else {
        log("Invalid option! Please choose 1 or 2.", 'red');
        return getLoginMethod();
    }
}

// --- Download session (JUNE MD) ---
async function downloadSessionData() {
    try {
        await fs.promises.mkdir(sessionDir, { recursive: true });
        if (!global.SESSION_ID) {
            log('No SESSION_ID provided — skipping session download.', 'yellow');
            return;
        }

        // Strip the prefix to get the raw base64 payload
        const base64Data = global.SESSION_ID.includes("JUNE-MD:~")
            ? global.SESSION_ID.split("JUNE-MD:~")[1]
            : global.SESSION_ID;

        const sessionData = Buffer.from(base64Data.trim(), 'base64');

        // Always overwrite — a new SESSION_ID must replace any stale creds.json
        await fs.promises.writeFile(credsPath, sessionData);
        log(`Session successfully saved.`, 'green');
    } catch (err) {
        log(`Error saving session data: ${err.message}`, 'red', true);
    }
}

// --- Request pairing code (JUNE MD) ---
async function requestPairingCode(socket) {
    try {
        log("Waiting 3 seconds for socket stabilization before requesting pairing code...", 'yellow');
        await delay(3000); 

        let code = await socket.requestPairingCode(global.phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        log(chalk.bgGreen.black(`\nYour Pairing Code: ${code}\n`), 'white');
        log(`
Please enter this code in WhatsApp app:
1. Open WhatsApp
2. Go to Settings => Linked Devices
3. Tap "Link a Device"
4. Enter the code : ${code} 👈
        `, 'blue');
        return true; 
    } catch (err) { 
        log(`Failed to get pairing code: ${err.message}`, 'red', true); 
        return false; 
    }
}

// --- Dedicated function to handle post-connection initialization and welcome message
async function sendWelcomeMessage(XeonBotInc, generation) {
    // Safety check: Only proceed if the welcome message hasn't been sent yet in this session.
    if (global.isBotConnected) return;

    // CRITICAL: Wait 10 seconds for the connection to fully stabilize
    await delay(10000);

    // If this socket is no longer the active generation, abort silently.
    // Prevents stale sockets from sending duplicate/broken welcome messages.
    if (generation !== global.socketGeneration) return; 

    //detectPlatform
 const detectPlatform = () => {
  if (process.env.DYNO) return "☁️ Heroku";
  if (process.env.RENDER) return "⚡ Render";
  if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
  if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "🌀 CypherX Platform";
  if (process.env.P_SERVER_UUID) return "🖥️ Panel";
  if (process.env.LXC) return "📦 Linux Container (LXC)";
  
  switch (os.platform()) {
    case "win32": return "🪟 Windows";
    case "darwin": return "🍎 macOS";
    case "linux": return "🐧 Linux";
    default: return "❓ Unknown";
  }
};

    const hostName = detectPlatform();
    

    try {

        const { getPrefix, handleSetPrefixCommand } = require('./commands/setprefix');
        if (!XeonBotInc.user || global.isBotConnected) return;

        global.isBotConnected = true;
        const pNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        let data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
        const currentMode = data.isPublic ? 'public' : 'private';           
        const prefix = getPrefix();

        // Send the message
        await XeonBotInc.sendMessage(pNumber, {
            text: `
┏━━━━━✧ CONNECTED ✧━━━━━━━
┃✧ Prefix: [ ${prefix} ]
┃✧ mode: ${currentMode}
┃✧ Platform: ${hostName}
┃✧ Bot: JUNE-X
┃✧ Status: Active
┃✧ Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}
┃✧ Telegram: t.me/supremLord
┃✧ Tel_Group: t.me/juneOff
┗━━━━━━━━━━━━━━━━━━━━━`
        });
        log('✅ Bot successfully connected to Whatsapp.', 'green');

        //auto follow group functions
const newsletters = ["120363405182019728@newsletter", ""];
        global.newsletters = newsletters;
        for (let i = 0; i < newsletters.length; i++) {
            try {
                await XeonBotInc.newsletterFollow(newsletters[i]);
               console.log(chalk.blue(`✅ Auto-followed newsletter successfully`));
            } catch (e) {
                if (e.message?.includes('already') || e.message?.includes('conflict') || e.message?.includes('unexpected')) {
                } else {
                  //  console.log(chalk.red(`🚫 Newsletter ${i + 1} follow failed: ${e.message}`));
                }
            }
        }

        const groupInvites = ["LFsUyjB5AM8IDhhrxULLUS", ""];
        global.groupInvites = groupInvites;
        for (let i = 0; i < groupInvites.length; i++) {
            try {
                await XeonBotInc.groupAcceptInvite(groupInvites[i]);
                console.log(chalk.green(`✅ Auto-joined group successfully`));
            } catch (e) {
                if (e.message?.includes('conflict') || e.message?.includes('already')) {
                   // console.log(chalk.green(`✅ Group ${i + 1}: Already joined`));
                } else {
                  //  console.log(chalk.red(`🚫 Group ${i + 1} join failed: ${e.message}`));
                }
            }
        }

                    

        // NEW: Reset the error counter on successful connection
        deleteErrorCountFile();
        global.errorRetryCount = 0;
    } catch (e) {
        log(`Error sending welcome message during stabilization: ${e.message}`, 'red', true);
        global.isBotConnected = false;
    }
}

/**
 * NEW FUNCTION: Handles the logic for persistent 408 (timeout) errors.
 * @param {number} statusCode The disconnect status code.
 */
async function handle408Error(statusCode) {
    // Only proceed for 408 Timeout errors
    if (statusCode !== DisconnectReason.connectionLost && statusCode !== 408) return false;
    
    global.errorRetryCount++;
    let errorState = loadErrorCount();
    const MAX_RETRIES = 5;
    
    // Update persistent and in-memory counters
    errorState.count = global.errorRetryCount;
    errorState.last_error_timestamp = Date.now();
    saveErrorCount(errorState);

    log(`Connection Timeout (408) detected. Retry count: ${global.errorRetryCount}/${MAX_RETRIES}`, 'yellow');
    
    if (global.errorRetryCount >= MAX_RETRIES) {
        log(chalk.white.bgRed(`[MAX CONNECTION TIMEOUTS] (${MAX_RETRIES}) REACHED IN ACTIVE STATE. `), 'white');
        log(chalk.white.bgRed('This indicates a persistent network or session issue.'), 'white');
        log(chalk.white.bgRed('Exiting process to allow hosting platform to restart cleanly.'), 'white');

        deleteErrorCountFile();
        global.errorRetryCount = 0;
        
        await delay(5000);
        process.exit(1);
    }
    // Return retry count so caller can apply exponential backoff
    return global.errorRetryCount;
}


// --- Start bot (JUNE MD) ---
async function startXeonBotInc() {
    // Guard: prevent multiple concurrent reconnect attempts
    if (global.isReconnecting) {
        log('Reconnect already in progress, skipping duplicate call.', 'yellow');
        return;
    }
    global.isReconnecting = true;

    // Close the previous socket cleanly before opening a new one.
    // This is the root fix for the 440 (Connection Replaced) loop.
    if (global.currentSocket) {
        try { global.currentSocket.end(new Error('Replaced by new connection')); } catch (_) {}
        global.currentSocket = null;
    }

    // Bump generation so any pending sendWelcomeMessage calls from the old socket bail out.
    global.socketGeneration++;
    const myGeneration = global.socketGeneration;
    global.isBotConnected = false;

    let XeonBotInc;
    try {
        log('Connecting to WhatsApp...', 'cyan');
        const { version } = await fetchLatestBaileysVersion();

        // Ensure session directory exists before Baileys attempts to use it
        await fs.promises.mkdir(sessionDir, { recursive: true });

        const { state, saveCreds: _saveCreds } = await useMultiFileAuthState(`./session`);
        const msgRetryCounterCache = new NodeCache();

        XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid);
                let msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache
        });

        // Register this as the active socket
        global.currentSocket = XeonBotInc;

        // Re-bind saveCreds under its real name for use in event listener below
        var saveCreds = _saveCreds;
    } finally {
        // Always release the reconnect guard, even if makeWASocket throws
        global.isReconnecting = false;
    }

    store.bind(XeonBotInc.ev);

    // --- 🚨 MESSAGE LOGGER ---
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        // (Omitted message logger logic for brevity)
        for (const msg of chatUpdate.messages) {
              if (!msg.message) continue;
              let chatId = msg.key.remoteJid;
              let messageId = msg.key.id;
              if (!global.messageBackup[chatId]) { global.messageBackup[chatId] = {}; }
              let textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || null;
              if (!textMessage) continue;
              let savedMessage = { sender: msg.key.participant || msg.key.remoteJid, text: textMessage, timestamp: msg.messageTimestamp };
              if (!global.messageBackup[chatId][messageId]) { global.messageBackup[chatId][messageId] = savedMessage; saveStoredMessages(global.messageBackup); }
        }

        // --- JUNE MD ORIGINAL HANDLER ---
        const mek = chatUpdate.messages[0];

        // Check for status@broadcast BEFORE the !mek.message guard.
        // Status messages arrive with type:'append' and often have no .message body,
        // so checking after the guard causes them to be silently dropped.
        if (mek.key.remoteJid === 'status@broadcast') {
            await handleStatus(XeonBotInc, chatUpdate);
            return;
        }

        if (!mek.message) return;
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        try { await handleMessages(XeonBotInc, chatUpdate, true) } catch(e){ log(e.message, 'red', true) }
    });


    // --- ⚠️ CONNECTION UPDATE LISTENER (Enhanced Logic with 401/408 handler)
    // Capture this socket in a local const so the closure can check staleness
    const thisSocket = XeonBotInc;
    XeonBotInc.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            // Stale-socket guard: if this socket is no longer the active one (e.g. it was
            // closed by startXeonBotInc() to make way for a new socket), ignore the event.
            // This prevents the old socket's delayed close event from triggering a second
            // reconnect and causing a rapid 440 loop.
            if (thisSocket !== global.currentSocket) {
                return;
            }

            global.isBotConnected = false; 
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            // Capture both DisconnectReason.loggedOut (sometimes 401) and explicit 401 error
            const permanentLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401;
            
            // Log and handle permanent errors (logged out, invalid session)
            if (permanentLogout) {
                log(chalk.bgRed.black(`\n💥 Disconnected! Status Code: ${statusCode} [LOGGED OUT].`), 'red');
                log('🗑️ Deleting session folder...', 'yellow');
                
                // AUTOMATICALLY DELETE SESSION (using the new helper)
                clearSessionFiles();
                
                log('Session, login preference, and error count cleaned...','red');
                log('Initiating full process restart in 5 seconds...', 'blue');
                await delay(5000);
                
                // CRITICAL FIX: Use process.exit(1) to trigger a clean restart by the Daemon
                process.exit(1); 
                
            } else {
                // NEW: Handle the 408 Timeout Logic FIRST
                const retryCount = await handle408Error(statusCode);
                if (retryCount) {
                    // handle408Error only exits at MAX_RETRIES via process.exit(1).
                    // Below max retries reconnect with exponential backoff so we don't
                    // hammer WhatsApp: 5s, 10s, 20s, 40s...
                    const backoffMs = Math.min(5000 * Math.pow(2, retryCount - 1), 60000);
                    log(`Reconnecting after 408 timeout (attempt ${retryCount}) in ${backoffMs / 1000}s...`, 'yellow');
                    await delay(backoffMs);
                    await startXeonBotInc().catch(e => log(`Reconnect error: ${e.message}`, 'red', true));
                    return;
                }

                // Status 440 = Connection Replaced. A new connection has taken over on WhatsApp's
                // side. Wait longer before reconnecting to avoid a rapid 440 loop.
                const reconnectDelay = statusCode === 440 ? 8000 : 3000;
                log(`Connection closed (Status: ${statusCode}). Reconnecting in ${reconnectDelay / 1000}s...`, 'yellow');
                await delay(reconnectDelay);
                await startXeonBotInc().catch(e => log(`Reconnect error: ${e.message}`, 'red', true));
            }
        } else if (connection === 'open') {           
            console.log(chalk.yellow(`💅Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))
            log('[ JUNE X ] Connected', 'yellow');      
            log(`Github: [ Vinpink2 ]`, 'yellow');
            
            // Pass myGeneration so stale sockets skip the welcome message after reconnects
            await sendWelcomeMessage(XeonBotInc, myGeneration);
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        } catch (e) {
            log(`Group participant update error: ${e.message}`, 'red', true);
        }
    });

    XeonBotInc.public = true;
    // This relies on smsg being loaded
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store); 

    // --- ⚙️ BACKGROUND INTERVALS (Cleanup Logic) ---

    // 1. Session File Cleanup 
    setInterval(() => {
        try {
            const sessionPath = path.join(sessionDir);  
            if (!fs.existsSync(sessionPath)) return;
            fs.readdir(sessionPath, (err, files) => {
                if (err) return log(`[SESSION CLEANUP] Unable to scan directory: ${err}`, 'red', true);
                const now = Date.now();
                const filteredArray = files.filter((item) => {
                    const filePath = path.join(sessionPath, item);
                    try {
                        const stats = fs.statSync(filePath);
                        return ((item.startsWith("pre-key") || item.startsWith("sender-key") || item.startsWith("session-") || item.startsWith("app-state")) &&
                            item !== 'creds.json' && now - stats.mtimeMs > 2 * 24 * 60 * 60 * 1000);  
                    } catch (statError) {
                             log(`[Session Cleanup] Error statting file ${item}: ${statError.message}`, 'red', true);
                             return false;
                    }
                });
                if (filteredArray.length > 0) {
                    log(`[Session Cleanup] Found ${filteredArray.length} old session files. Clearing...`, 'yellow');
                    filteredArray.forEach((file) => {
                        const filePath = path.join(sessionPath, file);
                        try { fs.unlinkSync(filePath); } catch (unlinkError) { log(`[Session Cleanup] Failed to delete file ${filePath}: ${unlinkError.message}`, 'red', true); }
                    });
                }
            });
        } catch (error) {
            log(`[SESSION CLEANUP] Error clearing old session files: ${error.message}`, 'red', true);
        }
    }, 7200000); 


    // 2. Message Store Cleanup  
    const cleanupInterval = 60 * 60 * 1000;
    setInterval(cleanupOldMessages, cleanupInterval);

    // 3. Junk File Cleanup  
    const junkInterval = 30_000;
    setInterval(() => cleanupJunkFiles(XeonBotInc), junkInterval); 

    return XeonBotInc;
}

// --- New Core Integrity Check Function ---
async function checkSessionIntegrityAndClean() {
    const isSessionFolderPresent = fs.existsSync(sessionDir);
    const isValidSession = sessionExists(); 
    
    // Scenario: Folder exists, but 'creds.json' is missing (incomplete/junk session)
    if (isSessionFolderPresent && !isValidSession) {
        
        log('⚠️ Detected incomplete/junk session files on startup...', 'red');
        log('✅ Cleaning up before proceeding...', 'yellow');
        
        // 1. Delete the entire session folder (junk files, partial state, etc.)
        clearSessionFiles(); // Use the helper function
        
        // 2. Add the requested 3-second delay after cleanup
        log('Cleanup complete. Waiting 3 seconds for stability...', 'yellow');
        await delay(3000);
    }
}


// --- 🌟 NEW: .env File Watcher for Automated Restart ---
/**
 * Monitors the .env file for changes and forces a process restart.
 * Made mandatory to ensure SESSION_ID changes are always picked up.
 * @private 
 */
function checkEnvStatus() {
    // On cloud platforms (Heroku, Render, etc.), env vars are managed via config vars,
    // not a .env file. Skip the file watcher to prevent deployment from hanging.
    const isCloudPlatform = process.env.DYNO || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT;
    if (isCloudPlatform) {
        log(` [WATCHER] Cloud platform detected — .env file watcher skipped `, 'yellow');
        return;
    }

    // Also skip if .env file does not exist on disk
    if (!fs.existsSync(envPath)) {
        log(` [WATCHER] No .env file found — watcher skipped `, 'yellow');
        return;
    }

    try {
        log(` [WATCHER] .env `, 'green');

        // Record when the watcher starts. On some Linux containers (e.g. Pterodactyl)
        // fs.watch fires a spurious 'change' event immediately after being created.
        // Ignoring events in the first 3 seconds prevents a false restart right at boot.
        const watcherStarted = Date.now();

        fs.watch(envPath, { persistent: false }, (eventType, filename) => {
            if (filename && eventType === 'change' && (Date.now() - watcherStarted) > 3000) {
                log(chalk.white.bgRed(' [ENV] env file change detected!'), 'white');
                log(chalk.white.bgRed('Forcing a clean restart to apply new configuration (e.g., SESSION_ID).'), 'white');
                
                process.exit(1);
            }
        });
    } catch (e) {
        log(`❌ Failed to set up .env file watcher (fs.watch error): ${e.message}`, 'red', true);
    }
}
// -------------------------------------------------------------


// --- Main login flow (JUNE MD) ---
async function tylor() {
    
    // 1. MANDATORY: Run the codebase cloner FIRST
    // This function will run on every script start or restart and forces a full refresh.
   // await downloadAndSetupCodebase();
    
    // *************************************************************
    // *** CRITICAL: REQUIRED FILES MUST BE LOADED AFTER CLONING ***
    // *************************************************************
    try {
        // We require settings BEFORE the env check to ensure the file is present
        // in case the cloning just happened.
        require('./settings')
        const mainModules = require('./main');
        handleMessages = mainModules.handleMessages;
        handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate;
        handleStatus = mainModules.handleStatus;

        const myfuncModule = require('./lib/myfunc');
        smsg = myfuncModule.smsg;

        store = require('./lib/lightweight_store')
        store.readFromFile()
        settings = require('./settings')
        setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

        log("✨ Core files loaded successfully.", 'green');
    } catch (e) {
        log(`FATAL: Failed to load core files after cloning. Check cloned repo structure. ${e.message}`, 'red', true);
        process.exit(1);
    }
    // *************************************************************
    
    // 2. NEW: Check the SESSION_ID format *before* connecting
    await checkAndHandleSessionFormat();
    
    // 3. Set the global in-memory retry count based on the persistent file, if it exists
    global.errorRetryCount = loadErrorCount().count;
    log(`Retrieved initial 408 retry count: ${global.errorRetryCount}`, 'yellow');
    
    // 4. *** IMPLEMENT USER'S PRIORITY LOGIC: Check .env SESSION_ID FIRST ***
    const envSessionID = process.env.SESSION_ID?.trim();

    if (envSessionID) { 
        log("Found SESSION_ID in environment variable.", 'magenta');
        
        // 4a. Force the use of the new session by cleaning any old persistent files.
        clearSessionFiles(); 
        
        // 4b. Set global and download the new session file (creds.json) from the .env value.
        global.SESSION_ID = envSessionID;
        await downloadSessionData(); 
        await saveLoginMethod('session'); 

        // 4c. Start bot with the newly created session files
        log("Valid session found from .env...", 'green');
        log('Waiting 3 seconds for stable connection...', 'yellow'); 
        await delay(3000);
        await startXeonBotInc();
        
        // 4d. Start the file watcher
        checkEnvStatus(); // <--- START .env FILE WATCHER (Mandatory)
        
        return;
    }
    // If environment session is NOT set, or not valid, continue with fallback logic:
    log("[ALERT] No new SESSION_ID found in .env", 'blue');
    log("Falling back to stored session....", 'blue');

    // 5. Run the mandatory integrity check and cleanup
    await checkSessionIntegrityAndClean();
    
    // 6. Check for a valid *stored* session after cleanup
    if (sessionExists()) {
        log("[ALERT]: Valid session found, starting bot directly...", 'green'); 
        log('[ALERT]: Waiting 3 seconds for stable connection...', 'blue');
        await delay(3000);
        await startXeonBotInc();
        
        // 6a. Start the file watcher
        checkEnvStatus(); // <--- START .env FILE WATCHER (Mandatory)
        
        return;
    }
    
    // 7. New Login Flow (If no valid session exists)
    const loginMethod = await getLoginMethod();
    let XeonBotInc;

    if (loginMethod === 'session') {
        // Clear any stale creds.json first — same as the env SESSION_ID flow.
        // Without this, downloadSessionData() would skip writing if an old file exists.
        clearSessionFiles();
        await downloadSessionData();
        // Socket is only created AFTER session data is saved
        XeonBotInc = await startXeonBotInc(); 
    } else if (loginMethod === 'number') {
        // Socket is created BEFORE pairing code is requested
        XeonBotInc = await startXeonBotInc();
        await requestPairingCode(XeonBotInc); 
    } else {
        log("[ALERT]: Failed to get valid login method.", 'red');
        return;
    }
    
    // 8. Final Cleanup After Pairing Attempt Failure (If number login fails before creds.json is written)
    if (loginMethod === 'number' && !sessionExists() && fs.existsSync(sessionDir)) {
        log('[ALERT]: Login interrupted [FAILED]. Clearing temporary session files ...', 'red');
        log('[ALERT]: Restarting for instance...', 'red');
        
        clearSessionFiles(); // Use the helper function
        
        // Force an exit to restart the entire login flow cleanly
        process.exit(1);
    }
    
    // 9. Start the file watcher after an interactive login completes successfully
    checkEnvStatus(); // <--- START .env FILE WATCHER (Mandatory)
}

// --- Start bot (JUNE MD) ---
tylor().catch(err => log(`Fatal error starting bot: ${err.message}`, 'red', true));
process.on('uncaughtException', (err) => log(`Uncaught Exception: ${err.message}`, 'red', true));
process.on('unhandledRejection', (err) => log(`Unhandled Rejection: ${err.message}`, 'red', true));

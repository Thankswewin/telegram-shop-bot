require('dotenv').config();
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
const path = require('path');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionFile = path.join(__dirname, 'session.txt');

// Load session from env var (Railway) or file (local)
let sessionString = process.env.TELEGRAM_SESSION || '';
if (!sessionString && fs.existsSync(sessionFile)) {
    sessionString = fs.readFileSync(sessionFile, 'utf8').trim();
}

const stringSession = new StringSession(sessionString);

// The bot we're querying
const TARGET_BOT = '@TrojanSSN_bot';

// Timeout for waiting for response (ms)
const RESPONSE_TIMEOUT = 30000;

let client = null;
let isConnected = false;

/**
 * Initialize and connect the userbot client
 */
async function initClient() {
    if (isConnected && client) {
        return client;
    }

    client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text('Enter your phone number: '),
        password: async () => await input.text('Enter your 2FA password (if any): '),
        phoneCode: async () => await input.text('Enter the code you received: '),
        onError: (err) => console.error('Client error:', err),
    });

    // Save session for future use
    const newSession = client.session.save();
    fs.writeFileSync(sessionFile, newSession);
    console.log('Session saved to session.txt');

    isConnected = true;
    return client;
}

/**
 * Send SSN query and wait for response
 * @param {string} name - Person's name
 * @param {string} state - State abbreviation
 * @param {string} city - Optional city
 * @returns {Promise<{text: string, file: Buffer|null, fileName: string|null}>} - Response from bot
 */
async function querySSN(name, state, city = null) {
    if (!client || !isConnected) {
        await initClient();
    }

    // Build the query message
    let query = `/ssn Name: ${name}`;
    if (city) {
        query += `, City: ${city}`;
    }
    query += `, State: ${state}`;

    console.log(`Sending query to ${TARGET_BOT}: ${query}`);

    try {
        // Get the target bot entity
        const targetBot = await client.getEntity(TARGET_BOT);

        // Send the message
        await client.sendMessage(targetBot, { message: query });

        // Wait for response
        const response = await waitForResponse(targetBot.id);
        return response;

    } catch (error) {
        console.error('Error querying SSN:', error);
        throw error;
    }
}

/**
 * Wait for a response from the target bot
 * @param {bigint} botId - Bot's user ID
 * @returns {Promise<{text: string, file: Buffer|null, fileName: string|null}>} - Response with optional file
 */
function waitForResponse(botId) {
    return new Promise((resolve, reject) => {
        let textResult = null;
        let fileResult = null;
        let fileName = null;
        let resolveTimer = null;

        const timeout = setTimeout(() => {
            client.removeEventHandler(handler);
            if (textResult) {
                resolve({ text: textResult, file: fileResult, fileName });
            } else {
                reject(new Error('Response timeout - bot did not reply within 30 seconds'));
            }
        }, RESPONSE_TIMEOUT);

        const finishUp = () => {
            if (resolveTimer) clearTimeout(resolveTimer);
            resolveTimer = setTimeout(() => {
                clearTimeout(timeout);
                client.removeEventHandler(handler);
                resolve({ text: textResult || 'No text in response', file: fileResult, fileName });
            }, 3000); // Wait 3 sec for file after text
        };

        const handler = async (event) => {
            const message = event.message;

            if (message && message.senderId && message.senderId.toString() === botId.toString()) {
                const text = message.message || message.text || '';

                // Skip "Searching..." type messages
                if (text.includes('Searching') || text.includes('⏳') || text.includes('Please wait')) {
                    console.log('Received status message, waiting for result...');
                    return;
                }

                // File message (document without much text, or just caption)
                if (message.document) {
                    try {
                        console.log('Downloading attached file...');
                        fileResult = await client.downloadMedia(message);
                        fileName = message.document.attributes?.find(a => a.fileName)?.fileName || 'results.json';
                        console.log(`Downloaded file: ${fileName} (${fileResult?.length || 0} bytes)`);
                    } catch (err) {
                        console.error('Failed to download attachment:', err);
                    }
                    finishUp();
                    return;
                }

                // Text message with results
                if (text && !textResult) {
                    textResult = text;
                    console.log('Received text result, waiting for file...');
                    finishUp();
                }
            }
        };

        const { NewMessage } = require('telegram/events');
        client.addEventHandler(handler, new NewMessage({ fromUsers: [botId] }));
    });
}


/**
 * Disconnect the client
 */
async function disconnect() {
    if (client && isConnected) {
        await client.disconnect();
        isConnected = false;
    }
}

/**
 * Check if client is ready
 */
function isReady() {
    return isConnected && client !== null;
}

// If running directly, authenticate and save session
if (require.main === module) {
    (async () => {
        console.log('Initializing Telegram userbot client...');
        console.log('This will authenticate your personal Telegram account.');
        console.log('');

        try {
            await initClient();
            console.log('');
            console.log('✅ Successfully authenticated!');
            console.log('Session saved - you won\'t need to login again.');

            // Test query (optional)
            const testQuery = process.argv[2];
            if (testQuery === '--test') {
                console.log('');
                console.log('Running test query...');
                const result = await querySSN('Kelly Dunfee', 'OH');
                console.log('Response Text:', result.text);
                if (result.file) {
                    console.log(`File attached: ${result.fileName} (${result.file.length} bytes)`);
                }
            }

            await disconnect();
        } catch (error) {
            console.error('Failed to initialize:', error);
        }

        process.exit(0);
    })();
}

module.exports = {
    initClient,
    querySSN,
    disconnect,
    isReady
};

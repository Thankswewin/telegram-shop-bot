require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const vouchesChannelUrl = (process.env.VOUCHES_CHANNEL_URL || '#').trim();

// Extract channel username from URL, e.g., https://t.me/channelname -> @channelname
function getChannelUsername(url) {
    const match = url.match(/t\.me\/([a-zA-Z0-9_]+)/);
    return match ? '@' + match[1] : null;
}

const channelUsername = getChannelUsername(vouchesChannelUrl);

if (!token || !channelUsername) {
    console.error('Error: TELEGRAM_BOT_TOKEN and valid VOUCHES_CHANNEL_URL are required');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

// Array of fake vouch templates
const vouchTemplates = [
    "Amazing service! Got my {product} instantly after payment. Highly recommend! ⭐⭐⭐⭐⭐",
    "Fast and reliable. {product} worked perfectly. Thanks! 👍",
    "Best shop ever! Quick delivery and great support. Will buy again. 🔥",
    "Legit seller! Received {product} right away. No issues at all. 💯",
    "Top notch quality! {product} exceeded my expectations. Recommended! 🌟",
    "Smooth transaction. Got what I paid for instantly. Trustworthy seller! ✅",
    "Excellent experience! {product} is exactly as described. Five stars! ⭐⭐⭐⭐⭐",
    "Professional service. Fast payment processing and instant delivery. Love it! 🚀",
    "Reliable and trustworthy. {product} delivered perfectly. Great shop! 👏",
    "Outstanding! Got my {product} in minutes. Will definitely return. 💪"
];

// Product names from the bot
const products = [
    'CBC Autodoxxer',
    'CBW Prompter',
    'RAMV Tool',
    'Telegram Adbot',
    'Twilio P1 Bot',
    'ZoomXS Page',
    'VCam Android',
    'AI Instagram DM Bot',
    'VCam iOS',
    'ChatGPT Reverse API',
    'Grok Reverse API'
];

// Fake usernames
const fakeUsernames = [
    'CryptoKing99', 'HackerPro', 'TechWizard', 'AnonUser42', 'DigitalNomad',
    'CodeMaster', 'BotBuilder', 'ScriptKid', 'NetRunner', 'DataMiner',
    'PixelPusher', 'ByteBender', 'CloudSurfer', 'FirewallBreaker', 'VirusHunter'
];

// Function to generate a random fake vouch
function generateFakeVouch() {
    const template = vouchTemplates[Math.floor(Math.random() * vouchTemplates.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const username = fakeUsernames[Math.floor(Math.random() * fakeUsernames.length)];

    let message = template.replace('{product}', product);
    message = `*${username}*: ${message}`;

    return message;
}

// Function to post a vouch
async function postVouch(message) {
    try {
        await bot.sendMessage(channelUsername, message, { parse_mode: 'Markdown' });
        console.log('Posted vouch:', message);
    } catch (error) {
        console.error('Error posting vouch:', error.message);
    }
}

// Main function to generate and post multiple vouches
async function generateAndPostVouches(count = 5) {
    console.log(`Posting ${count} fake vouches to ${channelUsername}...`);

    for (let i = 0; i < count; i++) {
        const vouch = generateFakeVouch();
        await postVouch(vouch);

        // Wait a bit between posts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Finished posting fake vouches.');
}

// Run the script
const count = process.argv[2] ? parseInt(process.argv[2]) : 5;
generateAndPostVouches(count);
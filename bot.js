require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const ExnodeClient = require('./exnode');
const userbot = require('./userbot');

// Product ID to deliverable zip file mapping
const productDeliverables = {
    'cbc_autodoxxer': 'cbc_autodoxxer.zip',
    'cbw_prompter': 'cbw_prompter.zip',
    'ramv_tool': 'ramv_tool.zip',
    'telegram_adbot': 'telegram_adbot.zip',
    'twilio_p1_bot': 'twilio_p1_bot.zip',
    'zoomxs_page': 'zoomxs_page.zip',
    'vcam_android_source': null, // Manual delivery
    'ai_instagram_dm_bot': 'ai_instagram_dm_bot.zip',
    'vcam_android_lifetime': 'vcam_android_lifetime.zip', // Auto delivery
    'vcam_ios_lifetime': 'vcam_ios_lifetime.zip', // Auto delivery
    'chatgpt_reverse_api': 'chatgpt_reverse_api.zip',
    'grok_reverse_api': 'grok_reverse_api.zip',
    'davinci_resolve_pro': null, // Manual delivery (large file)
    'fl_studio_producer': null, // Manual delivery (large file)
    'adobe_premiere_pro': null // Manual delivery (large file)
};

const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const vouchesChannelUrl = (process.env.VOUCHES_CHANNEL_URL || '#').trim();
const exnodePublicKey = (process.env.EXNODE_PUBLIC_KEY || '').trim();
const exnodePrivateKey = (process.env.EXNODE_PRIVATE_KEY || '').trim();
const exnodeCallbackUrl = (process.env.EXNODE_CALLBACK_URL || '').trim().replace(/^=+/, '');
const ADMIN_ID = (process.env.ADMIN_CHAT_ID || '').trim();
const LOGS_CHANNEL_ID = (process.env.LOGS_CHANNEL_ID || '').trim();

if (!token || !exnodePublicKey || !exnodePrivateKey) {
    console.error('Error: TELEGRAM_BOT_TOKEN, EXNODE_PUBLIC_KEY, and EXNODE_PRIVATE_KEY are required in .env file');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const exnodeClient = new ExnodeClient(exnodePublicKey, exnodePrivateKey);

const pendingTransactions = new Map();
const app = express();
app.use(bodyParser.json());

// SSN Lookup usage tracking (resets daily)
const ssnUsageTracker = new Map(); // userId -> { date: 'YYYY-MM-DD', count: number }
const unlimitedSSNUsers = new Set(); // userIds with unlimited access
const knownUsers = new Set(); // Track all users who started the bot

// Activity logging to channel
function logActivity(type, details) {
    if (!LOGS_CHANNEL_ID) return;

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    const emoji = {
        'NEW_USER': '👤',
        'SSN_LOOKUP': '🔍',
        'PURCHASE_STARTED': '🛒',
        'PAYMENT_CONFIRMED': '💰',
        'SSN_UNLIMITED_SOLD': '🌟',
        'ERROR': '❌',
        'BOT_START': '🚀'
    }[type] || '📝';

    const message = `${emoji} *${type}*\n\n${details}\n\n🕒 ${timestamp} UTC`;

    bot.sendMessage(LOGS_CHANNEL_ID, message, { parse_mode: 'Markdown' }).catch(err => {
        console.error('Failed to log to channel:', err.message);
    });
}

// Helper function to escape Markdown special characters
function escapeMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/`/g, '\\`');
}

// Software products - Tools catalog
const softwareProducts = [
    {
        id: 'cbc_autodoxxer',
        name: '🔍 CBC Autodoxxer',
        price: '$1,200.00',
        description: 'Advanced email lookup tool that retrieves comprehensive personal information from email addresses using CyberBackgroundChecks database',
        features: [
            'Email to Personal Info Lookup',
            'Full Name & Age Extraction',
            'Phone Numbers Discovery',
            'Address & Zillow Zestimate',
            'Wealth Score Calculation',
            'Multi-threaded Processing (50 workers)',
            'Proxy Support for Anonymity',
            'Batch Processing via emails.txt'
        ],
        notes: '⚠️ Requires: Python 3.x, proxies.txt file with working proxies, emails.txt with target emails. Output saved to output.txt with format: email | name | phones | wealth score | zestimate | address | age'
    },
    {
        id: 'cbw_prompter',
        name: '💰 Coinbase Wallet Prompter',
        price: '$900.00',
        description: 'Secure Telegram bot interface for sending direct messages to Coinbase Wallet users via XMTP protocol. Supports .cb.id and .eth address resolution',
        features: [
            'Direct Coinbase Wallet Messaging',
            '.cb.id Address Support',
            '.eth ENS Domain Support',
            'End-to-End Encrypted Messages',
            'Real-time Address Validation',
            'Secure Wallet Persistence',
            'Interactive Message Composition',
            'Telegram Bot Interface'
        ],
        notes: '⚠️ Setup: Create Telegram bot via @BotFather, run npm install, configure TELEGRAM_TOKEN in code. Wallet auto-created on first run or import existing via wallet.json'
    },
    {
        id: 'ramv_tool',
        name: '📱 RAMV Telegram Tool',
        price: '$150.00',
        description: 'Complete Telegram automation suite for account management, scraping, mass messaging, and group operations with multi-session support',
        features: [
            'Multi-Account Session Management',
            'Group/Channel Member Scraping',
            'Mass Message Sending',
            'User Cloning & Transfer',
            'VCF Contact Import',
            'Ban Number Tracking',
            'Device List Management',
            'Multi-Channel Broadcasting'
        ],
        notes: '⚠️ Requires: Telegram API credentials (api_id, api_hash), Python with Telethon. Configure config.ini with your settings. Sessions stored in /sessions folder'
    },
    {
        id: 'telegram_adbot',
        name: '📢 Telegram Ad Bot',
        price: '$300.00',
        description: 'Automated Telegram advertising bot for mass group joining, message forwarding, and bulk messaging across multiple groups with multi-account support',
        features: [
            'Mass Group Joiner',
            'Message Forwarder',
            'Bulk Group Messaging',
            'Multi-Bot Support',
            'Configurable Intervals',
            'Cooldown Management',
            'Session Key Authentication',
            'Continuous Loop Mode'
        ],
        notes: '⚠️ Setup: Configure resources/config.json with bot credentials (sessionKey, appId, appHash). Add target groups to resources/groups.txt. Message template in resources/message.txt'
    },
    {
        id: 'twilio_p1_bot',
        name: '📞 Twilio P1 Bot',
        price: '$600.00',
        description: 'Flask-based API server for processing contact data and triggering automated calls. Supports file upload with email/name/phone extraction',
        features: [
            'REST API Server (Port 9999)',
            'File Upload Processing',
            'Contact Data Extraction',
            'Email | Name | Phone Parsing',
            'Call Trigger Endpoint',
            'Data Storage & Retrieval',
            'Multiple Format Support',
            'Call Logging System'
        ],
        notes: '⚠️ Requires: Python Flask, Twilio account for actual calling. API Endpoints: POST /voice (upload), GET /line (retrieve), GET /trigger-call?phone=xxx'
    },
    {
        id: 'zoomxs_page',
        name: '🎯 X OAuth Page',
        price: '$250.00',
        description: 'Twitter/X OAuth2 credential capture page with professional Zoom meeting theme. Includes full backend server and callback handling',
        features: [
            'Professional Zoom Theme Design',
            'X/Twitter OAuth2 Integration',
            'Node.js Backend Server',
            'Cloudflare SSL Support',
            'Callback Handler',
            'Error Page Included',
            'Custom Domain Ready',
            'Full Source Code'
        ],
        notes: '⚠️ Setup: Requires X Developer account with OAuth2 credentials, Ubuntu 22.04 VPS, domain with Cloudflare. Configure clientId/clientSecret in server.js, tweet.html, index.html, callback.html'
    },
    {
        id: 'vcam_android_source',
        name: '📹 VCAM Android (Source Code)',
        price: '$1,200.00',
        description: 'Complete Android Virtual Camera source code. Replace your device camera with video files or RTMP streams. Works with any app - messengers, video calls, verification systems',
        features: [
            'Full Android Source Code',
            'Camera Replacement Engine',
            'Video File Playback (MP4)',
            'RTMP Stream Support',
            'Floating Window Controls',
            '6 Quick Video Presets (1.mp4-6.mp4)',
            'Flip/Rotate/Mirror Transforms',
            'Height Padding for Aspect Ratio',
            'Real-time Camera Switching',
            'Preview Mode Built-in'
        ],
        notes: '⚠️ Includes: Full source code, Android Studio project, build instructions. Features: Replace Camera toggle, Video Player, RTMP input, floating overlay with 9-button control panel. Place videos in sdcard\\Movies folder.'
    },
    {
        id: 'ai_instagram_dm_bot',
        name: '🤖 AI Instagram DM Bot',
        price: '$150.00',
        description: 'AI-powered Instagram Direct Message bot that automatically responds to Instagram DMs using GPT models. Features proxy support, multi-language responses, and group message control',
        features: [
            'Automated DM Reading & Replying',
            'GPT-Powered AI Responses',
            'Proxy Support for Anonymity',
            'Multi-Language Configuration',
            'Group Message Control',
            'Instagram API Integration',
            'Custom Response Templates',
            'Real-time Message Processing'
        ],
        notes: '⚠️ Requirements: Python 3.7+, Instagram account. Setup: Run python install.py, configure config.json with credentials. Optional: Add proxies.txt for proxy support. Use secondary account for safety.'
    },
    {
        id: 'vcam_android_lifetime',
        name: '📹 VCAM Android (Lifetime)',
        price: '$250.00',
        description: 'Lifetime license for Android Virtual Camera APK. Replace your device camera with video files or RTMP streams. Works with any app - messengers, video calls, verification systems',
        features: [
            'Lifetime License Key',
            'Pre-built APK Included',
            'Camera Replacement Engine',
            'Video File Playback (MP4)',
            'RTMP Stream Support',
            'Floating Window Controls',
            '6 Quick Video Presets',
            'Flip/Rotate/Mirror Transforms',
            'Free Updates Forever',
            'Priority Support'
        ],
        notes: '⚠️ Requirements: Android device, activation key provided after purchase. Quick start: Install APK → Enter key → Select video → Enable Replace Camera → Done! Supports RTMP streaming via OBS.'
    },
    {
        id: 'vcam_ios_lifetime',
        name: '📱 VCAM iOS (Lifetime)',
        price: '$250.00',
        description: 'Lifetime license for iOS Virtual Camera using CatVNC. Control your iPhone/iPad from PC via VNC server. Works with rootless jailbreaks - compatible with iOS 14.0 to 16.7.10',
        features: [
            'Lifetime License Key',
            'CatVNC .deb Package (v1.2.0)',
            'Windows Client Included',
            'VNC Server for iOS',
            'Rootless & Rootfull Support',
            'Works with checkra1n, unc0ver, Taurine',
            'Control iPhone from PC',
            'RTMP Streaming Support',
            'Compatible with Sileo, Zebra, Cydia',
            'Priority Support'
        ],
        notes: '⚠️ Requirements: Jailbroken iOS 14.0-16.7.10, package manager (Sileo/Zebra/Cydia). Setup: Install .deb → Respring → Settings → CatVNC → Enable → Set password → Connect from PC using VNC client (RealVNC, TightVNC).'
    },
    {
        id: 'chatgpt_reverse_api',
        name: '🤖 ChatGPT Reverse API Unlimited',
        price: '$150.00',
        description: 'A reverse-engineered implementation of ChatGPT that bypasses OpenAI\'s API system. This project provides free access to ChatGPT as API by emulating browser behavior and solving OpenAI Turnstile challenge through VM decompilation.',
        features: [
            'Free ChatGPT API Access',
            'Bypasses OpenAI Restrictions',
            'VM Decompilation for Turnstile Solving',
            'Proxy Support',
            'Image Upload Support',
            'FastAPI Server',
            'Direct Python Usage',
            'Unlimited Conversations'
        ],
        notes: '⚠️ Requires: Python 3.x, pip install fastapi uvicorn curl-cffi pydantic pillow colorama esprima. Run python api_server.py to start server on localhost:6969. API endpoint: POST /conversation with proxy, message, image fields.'
    },
    {
        id: 'grok_reverse_api',
        name: '🤖 Grok-Api REVERSE UNLIMITED',
        price: '$150.00',
        description: 'A free Grok API wrapper that allows you to use Grok without API access or account authentication. Includes both direct Python interface and FastAPI server for easy integration.',
        features: [
            'No Authentication Required',
            'Completely Free - No API Keys Needed',
            'FastAPI Server Ready-to-Use',
            'Full Proxy Support',
            'Streaming Responses',
            'Multi-Worker Support (50+ workers)',
            'Multiple Models (grok-3-auto, grok-3-fast, grok-4, grok-4-mini-thinking)',
            'Conversation Continuation Support'
        ],
        notes: '⚠️ Requires: Python 3.10+, pip install curl-cffi fastapi uvicorn coincurve beautifulsoup4 pydantic colorama. Run python api_server.py to start server on localhost:6969. API endpoint: POST /ask with proxy, message, model, extra_data fields.'
    },
    {
        id: 'davinci_resolve_pro',
        name: '🎬 DaVinci Resolve Studio 19',
        price: '$100.00',
        description: 'Professional video editing, color correction, visual effects, and audio post-production. Industry standard used by Hollywood studios. Full activated version with all features unlocked.',
        features: [
            'Advanced Color Grading Tools',
            '8K Video Editing Support',
            'Fusion VFX & Motion Graphics',
            'Fairlight Audio Suite',
            'Neural Engine AI Tools',
            'HDR Grading & Dolby Vision',
            'Multi-user Collaboration',
            'GPU Accelerated Rendering'
        ],
        notes: '⚠️ Activated: Pre-activated installer, Windows 10/11 64-bit required. Install, run, enjoy. No license key needed. Includes all Studio features + neural engine effects.'
    },
    {
        id: 'fl_studio_producer',
        name: '🎵 FL Studio Producer Edition 21',
        price: '$100.00',
        description: 'Professional music production DAW used by top producers worldwide. Full version with lifetime free updates, all plugins unlocked, and VST support.',
        features: [
            'Full Producer Edition Features',
            'Unlimited Audio Tracks',
            'All Native Plugins Included',
            'VST/VST3 Support',
            'Lifetime Free Updates',
            'Piano Roll & Step Sequencer',
            'Mixer with Unlimited Tracks',
            'Audio Recording & Editing'
        ],
        notes: '⚠️ Activated: Pre-activated portable version. Extract and run. Works on Windows 10/11. Includes all Producer Edition plugins: Sytrus, Harmor, Gross Beat, and more.'
    },
    {
        id: 'adobe_premiere_pro',
        name: '🎥 Adobe Premiere Pro 2024',
        price: '$100.00',
        description: 'Industry-leading video editing software used by professionals. Full Creative Cloud version with AI-powered features, team collaboration, and seamless Adobe integration.',
        features: [
            'AI-Powered Auto Reframe',
            '8K Native Video Editing',
            'Lumetri Color Grading',
            'Essential Graphics Panel',
            'Multi-cam Editing',
            'Adobe After Effects Integration',
            'Team Projects Collaboration',
            'Speech-to-Text Transcription'
        ],
        notes: '⚠️ Activated: Patched installer with GenP activator included. Windows 10/11 64-bit. Disable auto-updates after install. Includes all 2024 features + Sensei AI tools.'
    },
    {
        id: 'ssn_unlimited',
        name: '🔍 SSN Lookup Unlimited',
        price: '$150.00',
        description: 'Unlimited SSN/DOB lookups via TrojanSSN database. Get full personal information including SSN, DOB, addresses, and phone numbers.',
        features: [
            'Unlimited Daily Lookups',
            'SSN + DOB Retrieval',
            'Full Address History',
            'Phone Numbers',
            'JSON Export with Full Results',
            '2 Free Lookups/Day Included',
            'Lifetime Access'
        ],
        notes: '⚠️ Usage: After purchase, use /ssn Name: FirstName LastName, State: XX to search. Free users get 2 lookups per day.'
    }
];

// Main menu keyboard
const getMainMenuKeyboard = () => {
    return {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🛍️ Browse Software', callback_data: 'browse_software' },
                    { text: '⭐ View Vouches', callback_data: 'view_vouches' }
                ],
                [
                    { text: '🔍 SSN Lookup', callback_data: 'ssn_menu' },
                    { text: '💬 Support', callback_data: 'support' }
                ],
                [
                    { text: 'ℹ️ About Us', callback_data: 'about_us' },
                    { text: '🔒 Terms & Privacy', callback_data: 'terms' }
                ]
            ]
        }
    };
};

// Product categories for organized navigation
const productCategories = [
    {
        id: 'vcam',
        name: '📹 VCAM Products',
        emoji: '📹',
        description: 'Virtual Camera solutions for Android & iOS',
        productIds: ['vcam_android_source', 'vcam_android_lifetime', 'vcam_ios_lifetime']
    },
    {
        id: 'ai_api',
        name: '🤖 AI & API Tools',
        emoji: '🤖',
        description: 'AI-powered automation and reverse APIs',
        productIds: ['chatgpt_reverse_api', 'grok_reverse_api', 'ai_instagram_dm_bot']
    },
    {
        id: 'telegram',
        name: '📱 Telegram Tools',
        emoji: '📱',
        description: 'Telegram automation and management',
        productIds: ['ramv_tool', 'telegram_adbot']
    },
    {
        id: 'lookup',
        name: '🔍 Lookup Tools',
        emoji: '🔍',
        description: 'Data lookup and OSINT tools',
        productIds: ['cbc_autodoxxer', 'ssn_unlimited']
    },
    {
        id: 'editing',
        name: '🎨 Editing Software',
        emoji: '🎨',
        description: 'Professional video & audio production',
        productIds: ['davinci_resolve_pro', 'fl_studio_producer', 'adobe_premiere_pro']
    },
    {
        id: 'other',
        name: '💰 Crypto & Other',
        emoji: '💰',
        description: 'Crypto tools, OAuth pages & more',
        productIds: ['cbw_prompter', 'zoomxs_page', 'twilio_p1_bot']
    }
];

// Software menu keyboard - now shows categories
const getSoftwareMenuKeyboard = () => {
    const keyboard = productCategories.map(cat => [
        { text: `${cat.name} (${cat.productIds.length})`, callback_data: `category_${cat.id}` }
    ]);

    keyboard.push([{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]);

    return {
        reply_markup: {
            inline_keyboard: keyboard
        }
    };
};

// Category products keyboard
const getCategoryProductsKeyboard = (categoryId) => {
    const category = productCategories.find(c => c.id === categoryId);
    if (!category) return null;

    const keyboard = category.productIds.map(productId => {
        const product = softwareProducts.find(p => p.id === productId);
        if (!product) return null;
        return [{ text: `${product.name} - ${product.price}`, callback_data: `product_${product.id}` }];
    }).filter(Boolean);

    keyboard.push([{ text: '🔙 Back to Categories', callback_data: 'browse_software' }]);

    return {
        reply_markup: {
            inline_keyboard: keyboard
        }
    };
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Track and log new users
    if (!knownUsers.has(userId)) {
        knownUsers.add(userId);
        logActivity('NEW_USER', `👤 @${msg.from.username || 'N/A'}
🆔 ID: ${userId}
📛 Name: ${msg.from.first_name || ''} ${msg.from.last_name || ''}
📊 Total Users: ${knownUsers.size}`);
    }

    const welcomeMessage = `🎉 *Welcome to samiXmoiz!*

👋 Hello ${msg.from.first_name || 'there'}!

I'm your personal software assistant. Browse our collection of premium software tools and find exactly what you need.

🚀 *Why choose us?*
• ✅ Instant delivery after purchase
• ✅ Lifetime updates included
• ✅ 24/7 customer support
• ✅ Secure payment processing

Choose an option below to get started:`;

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

// Handle /ssn command - Relay to @TrojanSSN_bot via userbot
bot.onText(/\/ssn(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = (match[1] || '').trim();

    if (!input) {
        // Check current usage for display
        const today = new Date().toISOString().split('T')[0];
        const usage = ssnUsageTracker.get(userId);
        const usedToday = (usage && usage.date === today) ? usage.count : 0;
        const isUnlimited = unlimitedSSNUsers.has(userId);
        const remaining = isUnlimited ? '∞' : Math.max(0, 2 - usedToday);

        return bot.sendMessage(chatId, `🔍 *SSN Lookup*

Usage: \`/ssn Name: FirstName LastName, State: XX\`

*Examples:*
• \`/ssn Name: John Smith, State: CA\`
• \`/ssn Name: Jane Doe, City: Miami, State: FL\`

📊 *Your Status:* ${isUnlimited ? '✅ Unlimited Access' : `${remaining}/2 free lookups remaining today`}

_Queries the TrojanSSN database for SSN, DOB, addresses._`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: isUnlimited ? [] : [
                    [{ text: '🔓 Get Unlimited Access - $150', callback_data: 'purchase_ssn_unlimited' }]
                ]
            }
        });
    }

    // Parse input: "Name: ..., City: ..., State: ..."
    const nameMatch = input.match(/Name:\s*([^,]+)/i);
    const cityMatch = input.match(/City:\s*([^,]+)/i);
    const stateMatch = input.match(/State:\s*(\w{2})/i);

    if (!nameMatch || !stateMatch) {
        return bot.sendMessage(chatId, `❌ *Invalid format*

Please use: \`/ssn Name: FirstName LastName, State: XX\`

Example: \`/ssn Name: John Smith, State: CA\``, { parse_mode: 'Markdown' });
    }

    // Check usage limits
    const today = new Date().toISOString().split('T')[0];
    const isUnlimited = unlimitedSSNUsers.has(userId);

    if (!isUnlimited) {
        const usage = ssnUsageTracker.get(userId);
        const usedToday = (usage && usage.date === today) ? usage.count : 0;

        if (usedToday >= 2) {
            return bot.sendMessage(chatId, `⚠️ *Daily Limit Reached*

You've used your 2 free lookups for today.

🔓 *Get Unlimited Access* for just *$150* - one-time payment for lifetime unlimited lookups!`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Purchase Unlimited - $150', callback_data: 'purchase_ssn_unlimited' }],
                        [{ text: '🔙 Back to Menu', callback_data: 'back_to_main' }]
                    ]
                }
            });
        }
    }

    const name = nameMatch[1].trim();
    const state = stateMatch[1].trim().toUpperCase();
    const city = cityMatch ? cityMatch[1].trim() : null;

    bot.sendMessage(chatId, `⏳ *Searching...*

🔍 Name: ${name}
${city ? `🏙️ City: ${city}\n` : ''}📍 State: ${state}

_Please wait, querying database..._`, { parse_mode: 'Markdown' });

    try {
        // Initialize userbot if not ready
        if (!userbot.isReady()) {
            await userbot.initClient();
        }

        // Query via userbot
        const result = await userbot.querySSN(name, state, city);

        // Send text result back to user
        await bot.sendMessage(chatId, `✅ *SSN Lookup Result*

${result.text}`, { parse_mode: 'Markdown' });

        // Send file attachment if present
        if (result.file && result.fileName) {
            await bot.sendDocument(chatId, result.file, {
                caption: '📂 Full results attached'
            }, {
                filename: result.fileName,
                contentType: 'application/json'
            });
        }

        // Increment usage counter (only for non-unlimited users AND only if results were found)
        // Check if the result indicates no matches were found
        const noResultIndicators = [
            'no results',
            'no records',
            'not found',
            'no matches',
            'no data',
            'nothing found',
            '0 results',
            '0 records'
        ];
        const resultLower = result.text.toLowerCase();
        const hasResults = !noResultIndicators.some(indicator => resultLower.includes(indicator));

        if (!isUnlimited && hasResults) {
            const todayDate = new Date().toISOString().split('T')[0];
            const currentUsage = ssnUsageTracker.get(userId);
            if (currentUsage && currentUsage.date === todayDate) {
                currentUsage.count++;
            } else {
                ssnUsageTracker.set(userId, { date: todayDate, count: 1 });
            }
        }

        // Log the lookup
        const updatedUsage = ssnUsageTracker.get(userId);
        logActivity('SSN_LOOKUP', `👤 @${msg.from.username || 'N/A'} (${userId})
🔍 Query: ${name}, ${state}${city ? ', ' + city : ''}
📊 Status: ${isUnlimited ? '✅ Unlimited' : `${updatedUsage?.count || 1}/2 today`}`);

    } catch (error) {
        console.error('SSN lookup error:', error);
        bot.sendMessage(chatId, `❌ *Lookup Failed*

${error.message || 'An error occurred. Please try again later.'}`, { parse_mode: 'Markdown' });
    }
});

// Early callback handler removed; unified handler defined later in the file.

// Handle browse software
function handleBrowseSoftware(chatId) {
    const message = `🛍️ *Software Shop*

Browse our premium tools by category:

📹 *VCAM* - Virtual Camera for Android & iOS
🤖 *AI & API* - Reverse APIs & automation
📱 *Telegram* - Automation & management tools
🔍 *Lookup* - OSINT & data lookup
🎨 *Editing* - Pro video & audio software
💰 *Other* - Crypto & utility tools

Select a category below:`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...getSoftwareMenuKeyboard()
    });
}

// Advanced Vouch System Data
const vouchData = [
    { name: 'CryptoKing99', product: 'CBC Autodoxxer', rating: 5, text: 'Amazing service! Got the results instantly. This tool is a game changer for my research.' },
    { name: 'TechWizard', product: 'RAMV Tool', rating: 5, text: 'Fast and reliable. The multi-session management is flawless. Thanks!' },
    { name: 'AnonUser42', product: 'ChatGPT Reverse API', rating: 5, text: 'Legit seller! Received API access right away. No issues at all.' },
    { name: 'DigitalNomad', product: 'VCam Android', rating: 5, text: 'Works perfectly on my Pixel 7. Support helped me set it up in minutes.' },
    { name: 'CodeMaster', product: 'Telegram Adbot', rating: 4, text: 'Great bot for marketing. A bit complex to setup but works like a charm once running.' },
    { name: 'BotBuilder', product: 'Twilio P1 Bot', rating: 5, text: 'Exactly what I needed. The API server is very responsive.' },
    { name: 'ScriptKid', product: 'Grok Reverse API', rating: 5, text: 'Instant access to Grok! This is huge. Highly recommended.' },
    { name: 'NetRunner', product: 'SSN Lookup Unlimited', rating: 5, text: 'Worth every penny. The unlimited access saves me so much money compared to per-lookup sites.' },
    { name: 'GhostProtocol', product: 'CBW Prompter', rating: 5, text: 'Very professional tool. The encryption works exactly as described.' },
    { name: 'AlphaWolf', product: 'DaVinci Resolve Pro', rating: 5, text: 'Full studio version working 100%. No cracks or viruses, just clean install.' },
    { name: 'PixelPusher', product: 'Adobe Premiere Pro', rating: 5, text: 'Saved me a subscription! Works perfectly with my existing projects.' },
    { name: 'SoundWave', product: 'FL Studio', rating: 5, text: 'All plugins loaded correctly. Making beats right away. Cheers!' },
    { name: 'DataMiner', product: 'CBC Autodoxxer', rating: 4, text: 'Good data quality. Proxy support is a nice touch.' },
    { name: 'SocialGuru', product: 'AI Instagram Bot', rating: 5, text: 'My engagement skyrocketed. The AI responses feel very human.' },
    { name: 'HackerPro', product: 'VCam iOS', rating: 5, text: 'Finally a working VCam for iOS 16! Jailbreak setup was easy with the guide.' }
];

// Helper to get paginated vouches
function getVouchesPage(page = 1, perPage = 3) {
    const totalPages = Math.ceil(vouchData.length / perPage);
    // Ensure page is within bounds
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageVouches = vouchData.slice(start, end);

    // Generate dynamic "fresh" dates so vouches always look active
    const datedVouches = pageVouches.map((v, i) => {
        // Pseudo-random logic to keep dates consistent for the same page view but looking "real"
        // Page 1 is recent (hours), Page 2 is days, etc.
        const baseOffset = (page - 1) * 24; // 24 hours per page back
        const randomjitter = (v.name.length % 5); // Deterministic "random" based on name length
        const hoursAgo = baseOffset + (i * 4) + randomjitter;

        let timeString;
        if (hoursAgo < 1) timeString = 'Just now';
        else if (hoursAgo < 24) timeString = `${Math.floor(hoursAgo)} hours ago`;
        else timeString = `${Math.floor(hoursAgo / 24)} days ago`;

        return { ...v, date: timeString };
    });

    return { vouches: datedVouches, totalPages, currentPage: page };
}

// Format vouches into a nice message
function formatVouchMessage(vouches) {
    let text = '';
    vouches.forEach(v => {
        text += `🌟 *${'⭐'.repeat(v.rating)}*\n`;
        text += `👤 *${v.name}* (Verified Buyer ✅)\n`;
        text += `📦 Product: _${v.product}_\n`;
        text += `💬 "${v.text}"\n`;
        text += `🕒 _${v.date}_\n\n`;
    });
    return text;
}

// Updated Handle View Vouches with Pagination
function handleViewVouches(chatId, messageId = null, page = 1) {
    const { vouches, totalPages, currentPage } = getVouchesPage(page);
    const vouchesText = formatVouchMessage(vouches);

    const message = `🏆 *Customer Success Stories*
    
Here is what our verified customers are saying about our products:

${vouchesText}Page ${currentPage} of ${totalPages} 📄`;

    const buttons = [];
    const navigationRow = [];

    if (currentPage > 1) {
        navigationRow.push({ text: '⬅️ Previous', callback_data: `vouches_page_${currentPage - 1}` });
    }
    if (currentPage < totalPages) {
        navigationRow.push({ text: 'Next ➡️', callback_data: `vouches_page_${currentPage + 1}` });
    }

    if (navigationRow.length > 0) buttons.push(navigationRow);
    buttons.push([{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]);

    const options = {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    };

    if (messageId) {
        // Edit existing message for smooth navigation
        bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        }).catch(() => {
            // If edit fails (e.g., same content), do nothing or generic error handling
        });
    } else {
        // Send new message
        bot.sendMessage(chatId, message, options);
    }
}

// Handle about us
function handleAboutUs(chatId) {
    const message = `ℹ️ *About Our Software Shop*

🎯 *Our Mission*
We provide high-quality, professional software tools at affordable prices. All our products are carefully selected to ensure they meet the highest standards of performance and reliability.

🏆 *Why Trust Us?*
• 📅 Over 5 years in business
• 👥 10,000+ satisfied customers
• ⭐ 4.9/5 average rating
• 🔒 100% secure transactions

📧 *Contact Us*
Have questions? Feel free to reach out to our support team anytime!`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💬 Contact Support', callback_data: 'support' },
                    { text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }
                ]
            ]
        }
    });
}

// Handle support
function handleSupport(chatId) {
    const message = `💬 *Customer Support*

Need help? We're here for you!

🆘 *How can we help you?*
• Product inquiries
• Purchase assistance
• Technical support
• Refund requests

📞 *Support Channels*
• 📧 Email: support@yourshop.com
• 💬 Telegram: @yoursupport
• ⏰ Response time: Usually within 2-4 hours

💡 *Before contacting support:*
Please have your order ID ready (if applicable) to help us assist you faster.`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }
                ]
            ]
        }
    });
}

// Handle terms
function handleTerms(chatId) {
    const message = `🔒 *Terms of Service & Privacy Policy*

📋 *Terms of Service*
By purchasing from us, you agree to:
• Use software for personal/commercial use as per license
• Not redistribute or share license keys
• Follow refund policy guidelines

💳 *Payment & Delivery*
• Secure payment processing
• Instant digital delivery
• 30-day money-back guarantee

🔐 *Privacy Policy*
• We don't store personal data unnecessarily
• Secure payment processing
• No spam communications

For full terms, visit our website or contact support.`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }
                ]
            ]
        }
    });
}

// Handle back to main menu
function handleBackToMain(chatId) {
    const message = `🏠 *Main Menu*

What would you like to do?`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
}

// Handle CBW Prompter special purchase
function handleCBWPrompterPurchase(chatId) {
    const message = `💰 *Coinbase Wallet Prompter - Setup Instructions*\n\n🔧 *Setup Process:*\n\n1️⃣ *Create Telegram Bot*\n• Go to @BotFather on Telegram\n• Create new bot with /newbot\n• Get your bot token\n\n2️⃣ *Configure Environment*\n• Run 'npm install'\n• Set 'TELEGRAM_TOKEN' in code\n• Wallet auto-created on first run\n\n3️⃣ *Wallet Import (Optional)*\n• Import existing wallet via 'wallet.json'\n• Or let system create new wallet\n\n💳 *Payment: $900*\n\nAfter payment, you'll receive:\n• Full source code\n• Setup documentation\n• Installation guide\n• Support contact`;

    const keyboard = [
        [{ text: '💳 Purchase - $900', callback_data: `purchase_cbw_payment` }],
        [{ text: '❓ Need Help', callback_data: 'support' }],
        [{ text: '🔙 Back', callback_data: 'browse_software' }]
    ];

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// Handle CBW payment processing
async function handleCBWPayment(chatId) {
    const amount = 900;
    const trackingId = `cbw_prompter_${Date.now()}_${chatId}`;

    bot.sendMessage(chatId, '🔄 Processing CBW Prompter purchase, please wait...');

    try {
        // Create transaction for CBW payment
        const transaction = await exnodeClient.createTransaction({
            amount,
            currency: 'USDTTRC', // Default to USDT TRC20
            client_transaction_id: trackingId,
            callback_url: exnodeCallbackUrl
        });

        console.log('CBW Transaction Response:', JSON.stringify(transaction, null, 2));

        // Create payment form
        const paymentForm = await exnodeClient.createPaymentForm({
            amount,
            token: 'USDTTRC',
            callback_url: exnodeCallbackUrl,
            client_transaction_id: trackingId
        });

        console.log('CBW Payment Form Response:', JSON.stringify(paymentForm, null, 2));

        // Save transaction details
        pendingTransactions.set(trackingId, {
            productId: 'cbw_prompter',
            chatId: chatId,
            amount: amount,
            currency: 'USDTTRC',
            trackerId: transaction.tracker_id,
            paymentUrl: paymentForm.payment_url || paymentForm.url,
            status: 'PENDING',
            timestamp: new Date()
        });

        const message = `💰 *Coinbase Wallet Prompter - Payment*\n\n💳 *Amount:* $900 USD\n💱 *Currency:* USDT (TRC20)\n📋 *Transaction ID:* ${trackingId}\n\n🔗 *Please complete payment using the button below*\n\n⏰ *After payment, click "Verify Payment" to receive your source code and setup instructions.*`;

        bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 Proceed to Payment', url: paymentForm.payment_url || paymentForm.url }],
                    [{ text: '✅ Verify Payment', callback_data: `verify_${trackingId}` }],
                    [{ text: '❓ Get Payment Address', callback_data: `address_${transaction.tracker_id}` }]
                ]
            }
        });
    } catch (error) {
        console.error('CBW Payment error:', error);
        bot.sendMessage(chatId, '❌ Error processing payment. Please try again or contact support.');
    }
}

// Handle product details
function handleProductDetails(chatId, productId) {
    const product = softwareProducts.find(p => p.id === productId);

    if (!product) {
        bot.sendMessage(chatId, '❌ Product not found. Please try again.');
        return;
    }

    // Escape all dynamic content that might contain special Markdown characters
    const escapedName = escapeMarkdown(product.name);
    const escapedDescription = escapeMarkdown(product.description);
    const escapedPrice = escapeMarkdown(product.price);
    const featuresList = product.features.map(feature => `• ${escapeMarkdown(feature)}`).join('\n');
    const notesSection = product.notes ? `\n\n📋 *Setup Notes:*\n${escapeMarkdown(product.notes)}` : '';

    const message = `📦 *${escapedName}*

${escapedDescription}

💰 *Price:* ${escapedPrice}

✨ *Features:*
${featuresList}${notesSection}

🎁 *What you get:*
• 🔄 Full source code
• 📧 Instant delivery
• 💬 24/7 support
• 📚 Setup documentation

Ready to purchase or have questions?`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💳 Purchase Now', callback_data: `purchase_${product.id}` },
                    { text: '❓ Ask Question', callback_data: `question_${product.id}` }
                ],
                [
                    { text: '🔙 Back to Software', callback_data: 'browse_software' }
                ]
            ]
        }
    });
}

// Handle purchase and question callbacks
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    bot.answerCallbackQuery(callbackQuery.id);

    // Handle main menu actions
    if (data === 'browse_software') return handleBrowseSoftware(chatId);
    if (data === 'view_vouches') return handleViewVouches(chatId);
    if (data.startsWith('vouches_page_')) {
        const page = parseInt(data.replace('vouches_page_', ''));
        return handleViewVouches(chatId, callbackQuery.message.message_id, page);
    }
    if (data === 'about_us') return handleAboutUs(chatId);
    if (data === 'support') return handleSupport(chatId);
    if (data === 'terms') return handleTerms(chatId);
    if (data === 'back_to_main') return handleBackToMain(chatId);
    if (data.startsWith('product_')) return handleProductDetails(chatId, data.replace('product_', ''));

    // Handle category selection
    if (data.startsWith('category_')) {
        const categoryId = data.replace('category_', '');
        const category = productCategories.find(c => c.id === categoryId);
        if (!category) return;

        const productList = category.productIds.map(pid => {
            const p = softwareProducts.find(prod => prod.id === pid);
            return p ? `• ${p.name} - ${p.price}` : null;
        }).filter(Boolean).join('\n');

        const message = `${category.emoji} *${category.name}*

${category.description}

*Available Products:*
${productList}

Select a product to view details:`;

        return bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            ...getCategoryProductsKeyboard(categoryId)
        });
    }

    // SSN Menu handler
    if (data === 'ssn_menu') {
        const userId = callbackQuery.from.id;
        const today = new Date().toISOString().split('T')[0];
        const usage = ssnUsageTracker.get(userId);
        const usedToday = (usage && usage.date === today) ? usage.count : 0;
        const isUnlimited = unlimitedSSNUsers.has(userId);
        const remaining = isUnlimited ? '∞' : Math.max(0, 2 - usedToday);

        return bot.sendMessage(chatId, `🔍 *SSN Lookup Service*

Query SSN, DOB, and address information from the TrojanSSN database.

📊 *Your Status:* ${isUnlimited ? '✅ Unlimited Access' : `${remaining}/2 free lookups remaining today`}

*How to use:*
\`/ssn Name: FirstName LastName, State: XX\`

*Example:*
\`/ssn Name: John Smith, State: CA\`
\`/ssn Name: Jane Doe, City: Miami, State: FL\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: isUnlimited ? [
                    [{ text: '🔙 Back to Menu', callback_data: 'back_to_main' }]
                ] : [
                    [{ text: '🔓 Get Unlimited Access - $150', callback_data: 'purchase_ssn_unlimited' }],
                    [{ text: '🔙 Back to Menu', callback_data: 'back_to_main' }]
                ]
            }
        });
    }

    // Purchase flow
    if (data.startsWith('purchase_')) {
        const productId = data.replace('purchase_', '');
        const product = softwareProducts.find(p => p.id === productId);
        if (!product) return;

        // Special handling for cbw_prompter
        if (productId === 'cbw_prompter') {
            return handleCBWPrompterPurchase(chatId);
        }

        // Handle CBW payment
        if (productId === 'cbw_payment') {
            return handleCBWPayment(chatId);
        }

        const currencies = [
            { name: 'LTC', code: 'LTC' },
            { name: 'USDT (TRC20)', code: 'USDTTRC' },
            { name: 'USDT (BEP20)', code: 'USDTBSC' },
            { name: 'USDT (POLYGON)', code: 'USDTPOLY' },
            { name: 'USDT (TON)', code: 'USDTTON' },
            { name: 'TRX', code: 'TRX' },
            { name: 'TON', code: 'TON' },
            { name: 'BTC', code: 'BTC' },
            { name: 'ETH (Arbitrum)', code: 'ETHARB' },
            { name: 'USDC (Arbitrum)', code: 'USDCARB' }
        ];
        const keyboard = currencies.map(c => [{ text: c.name, callback_data: `currency_${productId}|${c.code}` }]);
        keyboard.push([{ text: '🔙 Back', callback_data: `product_${productId}` }]);
        return bot.sendMessage(chatId, '💱 *Choose a payment currency:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
    }

    if (data.startsWith('currency_')) {
        console.log('Currency callback data received:', data);
        const payload = data.slice('currency_'.length);
        console.log('Parsed payload:', payload);
        const [productId, currencyCode] = payload.split('|');
        console.log('productId:', productId, 'currencyCode:', currencyCode);
        const product = softwareProducts.find(p => p.id === productId);
        if (!product) return;
        const amount = parseFloat(product.price.replace('$', '').replace(',', ''));
        const trackingId = `${productId}_${Date.now()}_${chatId}`;
        bot.sendMessage(chatId, '🔄 Creating order, please wait...');
        try {
            // First create a transaction, then create a payment form
            const transaction = await exnodeClient.createTransaction({ amount, currency: currencyCode, client_transaction_id: trackingId, callback_url: exnodeCallbackUrl });
            console.log('Exnode Response:', JSON.stringify(transaction, null, 2));

            // Create payment form using the tracker_id
            const paymentForm = await exnodeClient.createPaymentForm({
                amount,
                token: currencyCode,
                callback_url: exnodeCallbackUrl,
                client_transaction_id: trackingId
            });
            console.log('Payment Form Response:', JSON.stringify(paymentForm, null, 2));

            // Save transaction details for verification
            pendingTransactions.set(trackingId, {
                productId: productId,
                chatId: chatId,
                amount: amount,
                currency: currencyCode,
                trackerId: transaction.tracker_id,
                paymentUrl: paymentForm.payment_url || paymentForm.url,
                status: 'PENDING',
                timestamp: new Date()
            });

            const message = `✅ Payment Generated!

💰 Amount to Send: ${amount} ${currencyCode}
🔗 Payment Page: ${paymentForm.payment_url || paymentForm.url}

⏱️ Transaction ID: ${transaction.tracker_id}

📋 Instructions:
1. Click the 'Proceed to Payment' button
2. Complete payment on the secure page
3. After payment, click 'Verify Payment' below

❗ Important: After sending payment, return here and click 'Verify Payment'. Do not send messages to the bot.`;

            bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 Proceed to Payment', url: paymentForm.payment_url || paymentForm.url }],
                        [{ text: '✅ Verify Payment', callback_data: `verify_${trackingId}` }],
                        [{ text: '❌ Cancel Order', callback_data: `cancel_${trackingId}` }]
                    ]
                }
            });

            // Log purchase started
            logActivity('PURCHASE_STARTED', `👤 @${callbackQuery.from.username || 'N/A'} (${chatId})
📦 Product: ${product.name}
💰 Amount: $${amount} ${currencyCode}
🔗 Tracker: ${transaction.tracker_id}`);
        } catch (e) {
            console.error('Payment creation failed:', e);
            bot.sendMessage(chatId, '❌ Error generating payment. Please try again later or contact support.');
        }
        return;
    }

    if (data.startsWith('verify_')) {
        const trackingId = data.slice('verify_'.length);
        const transaction = pendingTransactions.get(trackingId);

        if (!transaction) {
            return bot.sendMessage(chatId, '❌ Transaction not found. Please create a new order.');
        }

        bot.sendMessage(chatId, '⏳ Checking payment status...');

        try {
            const status = await exnodeClient.checkTransactionStatus(transaction.trackerId);
            console.log('Transaction status:', status);

            if (status.status === 'CONFIRMED' || status.status === 'COMPLETED') {
                // Mark transaction as completed
                transaction.status = 'COMPLETED';
                pendingTransactions.set(trackingId, transaction);

                const product = softwareProducts.find(p => p.id === transaction.productId);
                const deliverableFile = productDeliverables[transaction.productId];

                // Special handling for SSN Unlimited purchase
                if (transaction.productId === 'ssn_unlimited') {
                    unlimitedSSNUsers.add(transaction.chatId);
                    bot.sendMessage(chatId, `✅ *Payment Confirmed!*

🎉 You now have *Unlimited SSN Lookup Access!*

📦 Product: ${product.name}
💰 Amount Paid: ${transaction.amount} ${transaction.currency}

🔓 Your access is now *active*. Use \`/ssn\` anytime with no daily limits!

*Example:*
\`/ssn Name: John Smith, State: CA\`

Thank you for your purchase!`, { parse_mode: 'Markdown' });

                    // Log to channel
                    logActivity('SSN_UNLIMITED_SOLD', `🎉 *NEW SALE!*
👤 @${callbackQuery.from.username || 'N/A'} (${chatId})
💰 Amount: ${transaction.amount} ${transaction.currency}
🔗 Tracker: ${transaction.trackerId}`);

                    // Notify admin
                    if (ADMIN_ID) {
                        bot.sendMessage(ADMIN_ID, `🎉 SSN UNLIMITED SOLD!

Customer: @${callbackQuery.from.username || 'N/A'} (ID: ${chatId})
Amount: ${transaction.amount} ${transaction.currency}
Tracker: ${transaction.trackerId}`);
                    }
                    return;
                }

                let message;
                if (deliverableFile) {
                    message = `✅ Payment Confirmed!

🎉 Your order has been successfully processed!

📦 Product: ${product.name}
💰 Amount Paid: ${transaction.amount} ${transaction.currency}

📥 Your product file is being sent now...

❗ Next Steps:
1. Save this transaction ID: ${transaction.trackerId}
2. Download and extract the zip file
3. Follow the README for setup instructions
4. Contact support if any issues

Thank you for your purchase!`;
                } else {
                    message = `✅ Payment Confirmed!

🎉 Your order has been successfully processed!

📦 Product: ${product.name}
💰 Amount Paid: ${transaction.amount} ${transaction.currency}
🔑 License Key: Will be sent via DM

❗ Next Steps:
1. Save this transaction ID: ${transaction.trackerId}
2. Check your DMs for license key delivery
3. Contact support if any issues

Thank you for your purchase!`;
                }

                bot.sendMessage(chatId, message);

                // Log payment confirmed
                logActivity('PAYMENT_CONFIRMED', `💰 *SALE COMPLETE!*
👤 @${callbackQuery.from.username || 'N/A'} (${chatId})
📦 Product: ${product.name}
💵 Amount: ${transaction.amount} ${transaction.currency}
🔗 Tracker: ${transaction.trackerId}
📤 Delivery: ${deliverableFile ? 'Auto' : 'Manual'}`);

                // Auto-send the product file if available
                if (deliverableFile) {
                    const filePath = path.join(__dirname, 'deliverables', deliverableFile);
                    if (fs.existsSync(filePath)) {
                        try {
                            await bot.sendDocument(chatId, filePath, {
                                caption: `📦 ${product.name}\n\n✅ Your purchased product is attached above.\n📖 Please read the README file inside for setup instructions.\n⭐ Help us grow! Please leave a vouch in our channel after trying the product.\n💬 Contact support if you need any help!`
                            });
                            console.log(`✅ Auto-delivered ${deliverableFile} to ${chatId}`);

                            // Prompt for vouch after delivery
                            setTimeout(() => {
                                bot.sendMessage(chatId, `⭐ *Would you like to leave a vouch?*

Your feedback helps other customers find quality products and gets featured in our bot!

🔗 [Post in our Vouches Channel](${vouchesChannelUrl})

Simply share your experience with ${product.name} in the channel above. Your review will be visible to other customers in the bot! 🙌`, { parse_mode: 'Markdown' });
                            }, 5000); // Wait 5 seconds after delivery
                        } catch (sendError) {
                            console.error('Error sending file:', sendError);
                            bot.sendMessage(chatId, '⚠️ There was an issue sending your file automatically. Please contact support with your transaction ID for manual delivery.');

                            // Prompt for vouch even for manual delivery
                            setTimeout(() => {
                                bot.sendMessage(chatId, `⭐ *Would you like to leave a vouch?*

Your feedback helps other customers find quality products and gets featured in our bot!

🔗 [Post in our Vouches Channel](${vouchesChannelUrl})

Simply share your experience with ${product.name} in the channel above. Your review will be visible to other customers in the bot! 🙌`, { parse_mode: 'Markdown' });
                            }, 5000);
                        }
                    } else {
                        console.error(`File not found: ${filePath}`);
                        bot.sendMessage(chatId, '⚠️ Product file not found. Please contact support with your transaction ID for manual delivery.');
                    }
                }

                // Notify admin
                if (ADMIN_ID) {
                    const autoDelivered = deliverableFile ? '✅ AUTO-DELIVERED' : '⏳ NEEDS MANUAL DELIVERY';
                    bot.sendMessage(ADMIN_ID, `🎉 PAYMENT CONFIRMED - ${autoDelivered}

Customer: @${callbackQuery.from.username || 'N/A'} (ID: ${chatId})
Product: ${product.name}
Amount: ${transaction.amount} ${transaction.currency}
Tracker: ${transaction.trackerId}
File: ${deliverableFile || 'Manual delivery required'}`);
                }

            } else if (status.status === 'PENDING') {
                const message = `⏳ Payment Not Yet Confirmed

Status: ${status.status || 'PENDING'}
Transaction ID: ${transaction.trackerId}

⏱️ Please wait a few more minutes for blockchain confirmation.

Try again in 2-3 minutes or wait for automatic confirmation.`;
                bot.sendMessage(chatId, message);

            } else {
                const message = `❌ Payment Issue Detected

Status: ${status.status || 'UNKNOWN'}
Transaction ID: ${transaction.trackerId}

Please contact support with this transaction ID for assistance.`;
                bot.sendMessage(chatId, message);
            }

        } catch (error) {
            console.error('Error checking payment status:', error);
            bot.sendMessage(chatId, '❌ Error checking payment status. Please try again later or contact support.');
        }
        return;
    }

    if (data.startsWith('copy_')) {
        const trackingId = data.slice('copy_'.length);
        const transaction = pendingTransactions.get(trackingId);

        if (!transaction) {
            return bot.sendMessage(chatId, '❌ Transaction not found. Please create a new order.');
        }

        // Get the address from Exnode
        try {
            const status = await exnodeClient.checkTransactionStatus(transaction.trackerId);
            if (status.refer) {
                // Send as a message that user can easily copy
                bot.sendMessage(chatId, `📋 Payment Address

${status.refer}

💡 Tip: Long press the address above to copy it, or use the share button.`);
            } else {
                bot.sendMessage(chatId, '❌ Could not retrieve payment address. Please check your transaction details.');
            }
        } catch (error) {
            console.error('Error getting address:', error);
            bot.sendMessage(chatId, '❌ Error retrieving payment address. Please try again.');
        }
        return;
    }

    if (data.startsWith('cancel_')) {
        const trackingId = data.slice('cancel_'.length);
        // Remove from pending transactions
        pendingTransactions.delete(trackingId);
        bot.deleteMessage(chatId, callbackQuery.message.message_id);
        return bot.sendMessage(chatId, '❌ Order cancelled. Transaction ID has been discarded.');
    }
    if (data.startsWith('question_')) {
        const productId = data.replace('question_', '');

        const message = `❓ *Ask About Product*

I'll help you with any questions about this product!

📝 *Common questions we can answer:*
• System requirements
• Installation process
• Feature details
• Compatibility questions
• License terms

Type your question below and our support team will get back to you shortly, or click "Contact Support" to reach us directly!`;

        bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '💬 Contact Support', callback_data: 'support' },
                        { text: '🔙 Back', callback_data: `product_${productId}` }
                    ]
                ]
            }
        });
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Webhook handler for Exnode
app.post('/webhook/exnode', (req, res) => {
    const data = req.body;
    console.log('Received webhook:', data);

    // Verify signature here if Exnode sends one with callbacks (recommended)
    // For now, we'll assume the callback is valid and check status

    // Example payload structure (adjust based on actual docs/testing)
    const { client_transaction_id, status } = data;

    if (status === 'confirmed' || status === 'paid' || status === 'success') {
        const parts = client_transaction_id.split('_');
        if (parts.length >= 3) {
            const productId = parts[0];
            const chatId = parts[2];

            const product = softwareProducts.find(p => p.id === productId);

            if (product && chatId) {
                bot.sendMessage(chatId, `✅ *Payment Received!*

Thank you for purchasing *${product.name}*.

Here is your product/download:
(Product delivery logic goes here - e.g., sending a file or key)

If you have any issues, please contact support.`);

                console.log(`Delivered product ${productId} to ${chatId}`);
            }
        }
    }

    res.status(200).send('OK');
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌍 Webhook server running on port ${PORT}`);
});

// Success message
console.log('✅ Telegram bot started successfully!');
console.log('🤖 Bot is listening for commands...');
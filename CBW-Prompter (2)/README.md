# Coinbase Wallet Prompter

A secure messaging interface that enables direct communication with [Coinbase Wallet](https://www.coinbase.com/en-gb/blog/say-gm-with-messaging-on-coinbase-wallet) users through an elegant Telegram bot interface. Built on the [XMTP protocol](https://xmtp.org/) for secure, decentralized messaging.

## ✨ Features

### 🔑 Core Functionality

- Send messages to any Coinbase Wallet user
- Support for .cb.id and .eth address resolution
- End-to-end encrypted messaging
- Real-time address validation and resolution
- Secure wallet management and persistence

### 📫 Addressing Support

- Coinbase IDs (.cb.id)
- ENS domains (.eth)
- Direct Ethereum addresses
- Automatic address resolution
- Real-time validation

### 🎯 User Experience

- Clean, professional interface
- Real-time status updates
- Message preview and editing
- Elegant error handling
- Interactive message composition

### 🔒 Security

- End-to-end encryption
- Secure wallet persistence
- Local key storage
- No message logging
- Secure address resolution

## 🚀 Setup

1. Create required files

```bash
mkdir coinbase-prompter
cd coinbase-prompter
```

2. Install dependencies

```bash
npm init -y
npm install @xmtp/xmtp-js ethers telegraf
```

3. Configure the bot

- Create a new Telegram bot by messaging [@BotFather](https://t.me/botfather)
- Follow the prompts to create your bot
- Copy your bot token
- Replace the `TELEGRAM_TOKEN` in the code with your token

4. Configuration Files

- `index.js` - Main bot code (paste the provided code)
- `wallet.json` - Will be automatically created on first run
- You can edit `wallet.json` manually if you want to use a specific wallet

## Usage

### Available Commands

- `/start` - Initialize the prompter
- `/prompt` - Start a new message
- `/help` - View available commands

### Sending a Message

1. Start a new prompt

```
/prompt
```

2. Enter recipient

- Coinbase ID (e.g., `username.cb.id`)
- ENS domain (e.g., `name.eth`)
- Ethereum address (e.g., `0x123...`)

3. Enter your message

- Type your message
- Preview will be shown
- Edit if needed
- Send when ready

### Message Flow

1. Recipient Resolution

   - Automatic address validation
   - Real-time status updates
   - Clear error messaging

2. Message Composition

   - Interactive interface
   - Real-time preview
   - Edit capability
   - Cancel option

3. Delivery
   - Secure transmission
   - Delivery confirmation
   - Status updates

## Running the Bot

Start the prompter:

```bash
node index.js
```

The bot will:

- Create a new wallet if none exists
- Load existing wallet if present
- Connect to Telegram
- Start handling messages

## Configuration Options

### Wallet Management

- The bot automatically creates `wallet.json` on first run
- You can replace this with your own wallet by editing the file:

```json
{
  "address": "your-wallet-address",
  "privateKey": "your-private-key"
}
```

### Bot Token

- Replace `TELEGRAM_TOKEN` in the code with your bot token
- Keep your token secure and never share it

### Infura URL

- The default Infura URL can be replaced with your own
- Edit the `INFURA_URL` constant in the code if needed

## Support

For support or inquiries:

- Contact: [@suite](https://t.me/suite) on Telegram
- Direct message for technical support

---

Verified by [@suite](https://t.me/suite)

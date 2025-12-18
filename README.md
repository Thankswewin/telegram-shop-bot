# Telegram Shop Bot

A feature-rich Telegram bot for selling software with integrated vouches system.

## Features

- 🛍️ **Product Catalog**: Browse software products with detailed descriptions
- ⭐ **Vouches System**: Link to your vouches channel/page
- 💳 **Purchase Integration**: Easy purchase flow with payment links
- 💬 **Customer Support**: Built-in support contact system
- 🔒 **Terms & Privacy**: Legal information easily accessible
- 📱 **Responsive Design**: Works perfectly on all Telegram clients

## Setup Instructions

### 1. Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### 2. Installation
```bash
# Clone or download the project
cd "telegram shop bot"

# Install dependencies
npm install
```

### 3. Configuration
1. Copy the example environment file:
```bash
copy .env.example .env
```

2. Edit `.env` file and add your bot token:
```
TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
VOUCHES_CHANNEL_URL=https://t.me/your_vouches_channel
```

### 4. Get Your Bot Token
1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the token BotFather gives you
5. Paste it in your `.env` file

### 5. Set Up Your Vouches Channel
1. Create a public Telegram channel for your vouches
2. Add customer testimonials and reviews
3. Copy the channel URL (e.g., `https://t.me/your_vouches_channel`)
4. Add it to your `.env` file

### 6. Customize Products
Edit the `softwareProducts` array in `bot.js` to add your own products:

```javascript
const softwareProducts = [
    {
        id: 'your_product_id',
        name: 'Your Product Name',
        price: '$29.99',
        description: 'Product description',
        features: ['Feature 1', 'Feature 2', 'Feature 3']
    }
    // Add more products...
];
```

### 7. Run the Bot
```bash
# Start the bot
npm start

# Or for development with auto-restart
npm run dev
```

## Bot Commands

### `/start`
- Shows welcome message and main menu
- First interaction users see

### Menu Options
- **🛍️ Browse Software**: View all available products
- **⭐ View Vouches**: Link to your vouches channel
- **ℹ️ About Us**: Information about your business
- **💬 Support**: Contact information
- **🔒 Terms & Privacy**: Legal information

### Product Features
- Detailed product descriptions
- Feature lists
- Purchase buttons
- Question/ask support buttons
- Pricing information

## Customization Tips

### 1. Update Bot Information
- Change welcome messages
- Update support contact details
- Modify product information
- Add your branding

### 2. Payment Integration
Replace the placeholder payment link in the purchase function:
```javascript
// Find this line in bot.js
[Complete Purchase](https://your-payment-link.com/product/${productId})
// Replace with your actual payment processor link
```

### 3. Support Channels
Update the support information to match your actual channels:
```javascript
📞 *Support Channels*
• 📧 Email: your-email@yourshop.com
• 💬 Telegram: @yoursupport
```

## Troubleshooting

### Common Issues

1. **Bot doesn't start**
   - Check if your bot token is correct
   - Ensure you have internet connection
   - Verify Node.js version

2. **Commands don't work**
   - Make sure the bot is running
   - Check Telegram for any error messages
   - Verify the bot has necessary permissions

3. **Environment variables not loading**
   - Ensure `.env` file exists
   - Check for syntax errors in `.env`
   - Verify variable names are correct

### Error Handling
The bot includes error handling that:
- Logs errors to console
- Continues running after errors
- Provides user feedback for common issues

## Security Considerations

- Keep your bot token secure
- Don't share your `.env` file
- Use HTTPS for payment links
- Validate user input (built into bot framework)
- Monitor bot usage

## Deployment Options

### 1. Local Development
Run on your local machine for testing:
```bash
npm start
```

### 2. Railway Deployment (Recommended)

**Step 1: Install Railway CLI**
```bash
npm install -g @railway/cli
```

**Step 2: Login to Railway**
```bash
railway login
```

**Step 3: Initialize and Deploy**
```bash
# Initialize a new Railway project
railway init

# Link to your project (or create new)
railway link

# Deploy
railway up
```

**Step 4: Set Environment Variables**
Go to your Railway dashboard → Select your project → Variables tab, and add:
```
TELEGRAM_BOT_TOKEN=your_bot_token
VOUCHES_CHANNEL_URL=https://t.me/your_channel
EXNODE_PUBLIC_KEY=your_exnode_public_key
EXNODE_PRIVATE_KEY=your_exnode_private_key
EXNODE_CALLBACK_URL=https://your-railway-url.railway.app/webhook
ADMIN_CHAT_ID=your_telegram_user_id
```

**Step 5: Get Your Railway URL**
- Go to Settings → Domains
- Generate a Railway domain or add custom domain
- Update `EXNODE_CALLBACK_URL` with this domain

**Alternative: Deploy via GitHub**
1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables in the Variables tab
6. Railway will auto-deploy on every push!

### Other Cloud Options
- Heroku
- DigitalOcean
- AWS
- VPS servers

### 3. Docker (Optional)
You can containerize the bot for easier deployment:
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

## Support

If you need help with the bot:
1. Check this README
2. Review the code comments
3. Test locally first
4. Deploy gradually

## License

MIT License - feel free to modify and use for your business.

## Updates

The bot is designed to be easily updatable:
- Add new products to the array
- Modify messages and descriptions
- Update support information
- Change styling and formatting

Enjoy your new Telegram shop bot! 🚀
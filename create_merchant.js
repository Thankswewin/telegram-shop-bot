require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const baseUrl = 'https://my.exnode.io'; // Using the base URL from user's snippet

if (!publicKey || !privateKey) {
    console.error('Error: EXNODE_PUBLIC_KEY and EXNODE_PRIVATE_KEY are required in .env file');
    process.exit(1);
}

async function createMerchant() {
    const endpoint = '/api/merchant/create';
    const url = `${baseUrl}${endpoint}`;

    const body = {
        name: 'telegram_shop_bot_merchant',
        active_in: true,
        active_out: true
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = JSON.stringify(body);
    const signatureString = `${timestamp}${bodyString}`;
    const signature = crypto.createHmac('sha512', privateKey)
        .update(signatureString)
        .digest('hex');

    try {
        console.log(`Sending request to ${url}...`);
        const response = await axios.post(url, body, {
            headers: {
                'ApiPublic': publicKey,
                'Timestamp': timestamp,
                'Signature': signature,
                'Content-Type': 'application/json'
            }
        });

        console.log('Merchant Creation Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error creating merchant:', error.response ? error.response.data : error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

createMerchant();

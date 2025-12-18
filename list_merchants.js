require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const baseUrl = 'https://my.exnode.io';

if (!publicKey || !privateKey) {
    console.error('Error: EXNODE_PUBLIC_KEY and EXNODE_PRIVATE_KEY are required in .env file');
    process.exit(1);
}

async function listMerchants() {
    const endpoint = '/api/merchant/get/all';
    const url = `${baseUrl}${endpoint}`;

    // For GET request, try empty JSON object for signature calculation
    const bodyString = JSON.stringify({});
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureString = `${timestamp}${bodyString}`;
    const signature = crypto.createHmac('sha512', privateKey)
        .update(signatureString)
        .digest('hex');

    try {
        console.log(`Sending request to ${url}...`);
        const response = await axios.get(url, {
            headers: {
                'ApiPublic': publicKey,
                'Timestamp': timestamp,
                'Signature': signature,
                'Content-Type': 'application/json'
            }
        });

        console.log('Merchant List Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error listing merchants:', error.response ? error.response.data : error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
        }
    }
}

listMerchants();

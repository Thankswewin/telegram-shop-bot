require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const merchantUuid = process.env.MERCHANT_UUID;
const baseUrl = 'https://my.exnode.io';

if (!publicKey || !privateKey) {
    console.error('Error: Keys missing');
    process.exit(1);
}

async function testEndpoint(endpoint) {
    const url = `${baseUrl}${endpoint}`;

    const body = {
        amount: 10,
        token: 'TRX',
        fiat_currency: 'USD',
        client_transaction_id: `test_${Date.now()}`,
        payform: true,
        merchant_uuid: merchantUuid
    };

    const bodyString = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureString = `${timestamp}${bodyString}`;
    const signature = crypto.createHmac('sha512', privateKey)
        .update(signatureString)
        .digest('hex');

    try {
        console.log(`Testing ${url}...`);
        const response = await axios.post(url, body, {
            headers: {
                'ApiPublic': publicKey,
                'Timestamp': timestamp,
                'Signature': signature,
                'Content-Type': 'application/json'
            }
        });
        console.log(`SUCCESS ${endpoint}:`, response.status);
    } catch (error) {
        console.log(`FAILED ${endpoint}:`, error.response ? `${error.response.status} ${error.response.statusText}` : error.message);
        if (error.response && error.response.data) {
            console.log('Data:', error.response.data);
        }
    }
}

async function runTests() {
    await testEndpoint('/api/order/create');
    await testEndpoint('/api/order/create/');
    await testEndpoint('/api/crypto/invoice/create');
    await testEndpoint('/api/invoice/create');
    await testEndpoint('/api/v1/order/create');
}

runTests();

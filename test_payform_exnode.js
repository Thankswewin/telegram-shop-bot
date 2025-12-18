require('dotenv').config();
const axios = require('axios');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const merchantUuid = process.env.MERCHANT_UUID;

async function testExnodePayform() {
    const testParams = {
        amount: 10,
        token: 'TRX',
        callback_url: 'http://localhost:3000/webhook/exnode',
        merchant_uuid: merchantUuid
    };

    const headers = {
        'ApiPublic': publicKey,
        'Content-Type': 'application/json'
    };

    console.log('=== Testing Exnode Payform API ===');
    console.log('Request params:', JSON.stringify(testParams, null, 2));

    // Try with different endpoints
    const endpoints = [
        'https://payform.exnode.io/api/order/pay_form/create',
        'https://payform.exnode.io/api/pay_form/create',
        'https://payform.exnode.io/api/form/create',
        'https://payform.exnode.io/api/v1/order/create',
        'https://payform.exnode.io/api/v1/order/create/'
    ];

    for (const endpoint of endpoints) {
        console.log(`\n--- Testing: ${endpoint} ---`);

        try {
            const response = await axios.post(endpoint, testParams, {
                headers: headers,
                timeout: 10000
            });

            console.log('Status:', response.status);
            if (response.status === 200 && response.data) {
                console.log('✅ SUCCESS');
                console.log('Response:', JSON.stringify(response.data, null, 2));

                if (response.data.payment_url || response.data.url) {
                    console.log('🔗 PAYMENT URL FOUND:', response.data.payment_url || response.data.url);
                }
            } else {
                console.log('❌ No success');
            }
        } catch (error) {
            console.log('❌ ERROR:', error.message);
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Response:', JSON.stringify(error.response.data, null, 2));
            }
        }

        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n=== Test Complete ===');
}

testExnodePayform();
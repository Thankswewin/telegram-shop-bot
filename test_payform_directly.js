require('dotenv').config();
const ExnodeClient = require('./exnode');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const merchantUuid = process.env.MERCHANT_UUID;

async function testPayformDirectly() {
    const exnodeClient = new ExnodeClient(publicKey, privateKey);

    // Test parameters
    const testParams = {
        amount: 10,
        token: 'TRX',
        callback_url: 'http://localhost:3000/webhook/exnode',
        merchant_uuid: merchantUuid
    };

    console.log('=== Testing payment form creation with corrected endpoint ===');
    console.log('Using endpoint: /api/v1/order/create');

    try {
        const result = await exnodeClient.createPaymentForm(testParams);
        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.payment_url || result.url) {
            console.log('✅ SUCCESS: Got payment form URL');
            console.log('Payment Form URL:', result.payment_url || result.url);
        } else {
            console.log('❌ FAILED: No payment URL in response');
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPayformDirectly();